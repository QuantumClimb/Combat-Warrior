"""Usage: python process.py <character> <anim> [raw_attempt]
Chroma-keys the raw sheet, slices frames, aligns them to a common baseline, packs a sheet and writes a manifest entry."""
import json, sys
import numpy as np
from pathlib import Path
from PIL import Image
from scipy import ndimage
from config import ANIMS, grid_for, LIFT, SCALE_REF

ROOT = Path(__file__).resolve().parents[2]
TARGET_STAND_H = 240   # px height of a standing idle character after scaling
PAD = 8

def key_green(img):
    rgb = img.convert("RGB"); a = np.asarray(rgb).astype(np.int16)
    hsv = np.asarray(rgb.convert("HSV")).astype(np.float32)   # PIL: H 0-255 (float: int16 overflowed on crimson hues)
    h, s, v = hsv[..., 0] * 360 / 255, hsv[..., 1] / 255, hsv[..., 2] / 255
    bg = (h > 62) & (h < 170) & (s > 0.18) & (v > 0.25)
    bg |= (h > 51) & (h <= 62) & (s > 0.6) & (v < 0.78)      # olive glow halo (gold trim is brighter)
    # dark ground shadow strip (green-tinted dark)
    # Ground shadow: dark green-tinted pixels, but ONLY as thin wide strips. Black hair/outlines carry the same green tint,
    # so a plain colour rule eats them (it removed Rudrani's braid) -> filter by shape.
    dark = (h > 68) & (h < 170) & (s > 0.2) & (v <= 0.25) & (v > 0.05)
    dlab, dn = ndimage.label(dark, structure=np.ones((3, 3)))
    for i, sl in enumerate(ndimage.find_objects(dlab), start=1):
        hh, ww = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if hh <= 30 and ww >= 3 * hh and ww >= 40:
            bg[sl] |= (dlab[sl] == i)
    fg = ~bg
    fg = ndimage.binary_erosion(ndimage.binary_opening(fg, iterations=1), iterations=1)
    lab, n = ndimage.label(fg)
    if n:
        sizes = ndimage.sum(fg, lab, range(1, n + 1))
        fg = np.isin(lab, [i + 1 for i, sz in enumerate(sizes) if sz > 400])
    fg = ndimage.binary_fill_holes(fg) & ~(bg & ~ndimage.binary_dilation(fg, iterations=1) )
    rgba = np.dstack([a.clip(0, 255).astype(np.uint8), (fg * 255).astype(np.uint8)])
    edge = ndimage.binary_dilation(~fg, iterations=2) & fg
    spill = np.minimum(rgba[..., 1], np.maximum(rgba[..., 0], rgba[..., 2]))
    rgba[..., 1] = np.where(edge, spill, rgba[..., 1])
    return Image.fromarray(rgba), fg

def row_bands(fg, rows):
    r = fg.any(axis=1); bands, s = [], None
    for y, v in enumerate(r):
        if v and s is None: s = y
        if not v and s is not None: bands.append([s, y]); s = None
    if s is not None: bands.append([s, len(r)])
    i = 0
    while i < len(bands) - 1:            # rows are separated by natural gaps; merge only tiny ones (stray pixels / floating hair)
        if bands[i+1][0] - bands[i][1] < 25: bands[i][1] = bands[i+1][1]; del bands[i+1]
        else: i += 1
    return bands

def slice_frames(fg, n):
    cols = fg.any(axis=0)
    runs, start = [], None
    for x, v in enumerate(cols):
        if v and start is None: start = x
        if not v and start is not None: runs.append([start, x]); start = None
    if start is not None: runs.append([start, len(cols)])
    i = 0
    while i < len(runs) - 1:                               # merge only tiny gaps (stray pixels)
        if runs[i + 1][0] - runs[i][1] < 6: runs[i][1] = runs[i + 1][1]; del runs[i + 1]
        else: i += 1
    return runs

def process(char, anim, attempt=0):
    n, fps, loop, airborne, _ = ANIMS[anim]
    adir = ROOT / "assets/sprites" / char
    raw = Image.open(adir / "raw" / f"{char}_{anim}_{attempt}.png")
    rgba, fg = key_green(raw)
    rows = grid_for(n); bands = row_bands(fg, rows)
    problems = []
    boxes = []
    for by0, by1 in bands:
        for x0, x1 in slice_frames(fg[by0:by1], 0):
            ys = np.where(fg[by0:by1, x0:x1].any(axis=1))[0]
            boxes.append((x0, x1, by0 + ys.min(), by0 + ys.max() + 1))
    found = len(boxes)
    if found != n:
        if found > n:   # model drew extras: keep n evenly spaced frames in order
            boxes = boxes[:n]   # keep the first n (row-major); print(f"note: {found} frames found, kept first {n}")
        else: problems.append(f"found {found} frames, expected {n}")
    frames = []
    H, W = fg.shape
    for x0, x1, y0, y1 in boxes:
        if x0 <= 1 or x1 >= W - 1 or y0 <= 1 or y1 >= H - 1: problems.append("frame touches canvas edge")
        frames.append((rgba.crop((x0, y0, x1, y1)), y0, y1, (x0 + x1) // 2))
    # per-sheet scale: normalise a reference frame to (fraction * standing height)
    sel, frac = SCALE_REF[anim]
    hs = [f[0].height for f in frames]
    ref_h = max(hs) if sel == "max" else min(hs) if sel == "min" else hs[min(sel, len(hs) - 1)]
    scale = frac * TARGET_STAND_H / ref_h
    scaled = []
    for im, y0, y1, cx in frames:
        sz = (max(1, round(im.width * scale)), max(1, round(im.height * scale)))
        im2 = im.resize(sz, Image.LANCZOS)
        al = np.asarray(im2)[..., 3] > 0
        xs = np.nonzero(al.any(axis=0))[0]
        col_w = al.sum(axis=0).astype(float)
        cmx = float((col_w * np.arange(len(col_w))).sum() / max(col_w.sum(), 1))   # body-mass centre
        scaled.append((im2, y0, y1, cmx))
    half = max(max(f[3], f[0].width - f[3]) for f in scaled)
    cw = int(2 * half) + 2 * PAD + 2
    if airborne:  # lift by designed jump arc (model draws all frames on one line)
        lf = LIFT[anim]; tops = [lf[min(i, len(lf)-1)] * TARGET_STAND_H for i in range(len(scaled))]
        ch = int(max(f[0].height + t for f, t in zip(scaled, tops))) + 2 * PAD
        offs = [ch - PAD - f[0].height - int(t) for f, t in zip(scaled, tops)]
    else:         # feet on common baseline
        ch = max(f[0].height for f in scaled) + 2 * PAD
        offs = [ch - PAD - f[0].height for f in scaled]
    sheet = Image.new("RGBA", (cw * len(scaled), ch), (0, 0, 0, 0))
    coords = []
    for i, ((im, _, _, cmx), oy) in enumerate(zip(scaled, offs)):
        sheet.alpha_composite(im, (i * cw + int(round(cw / 2 - cmx)), oy))
        coords.append({"index": i, "x": i * cw, "y": 0, "w": cw, "h": ch})
    out = adir / f"{char}_{anim}.png"
    sheet.save(out)
    entry = {"animation": anim, "file": out.name, "frame_count": len(scaled), "image_size": [sheet.width, sheet.height],
             "frame_size": [cw, ch], "fps": fps, "loop": loop, "frames": coords, "source": f"raw/{char}_{anim}_{attempt}.png"}
    mf = adir / f"{char}.json"
    m = json.loads(mf.read_text()) if mf.exists() else {"character": char, "animations": {}}
    m["animations"][anim] = entry
    mf.write_text(json.dumps(m, indent=2))
    print(anim, "OK" if not problems else "PROBLEMS: " + "; ".join(sorted(set(problems))), (cw, ch))
    return not problems

if __name__ == "__main__":
    process(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 0)
