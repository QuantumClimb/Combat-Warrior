import sys
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
char, out = sys.argv[1], sys.argv[2]
fs = sorted((ROOT/"assets/sprites"/char).glob(f"{char}_*.png"))
ims = [Image.open(f) for f in fs]
W = max(i.width for i in ims); H = sum(i.height + 4 for i in ims)
c = Image.new("RGBA", (W, H), (60, 60, 80, 255)); y = 0
for i in ims: c.alpha_composite(i, (0, y)); y += i.height + 4
c.thumbnail((1600, 3000)); c.save(out); print(len(ims), c.size)
