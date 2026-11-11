"""Usage: python generate.py <character> <anim> [<anim>...]   (or 'all')
Calls OpenAI image edit with the character reference; saves raw output to assets/sprites/<char>/raw/."""
import base64, os, sys, time, requests
from pathlib import Path
from config import STYLE, LAYOUT, CHARACTERS, ANIMS, grid_for

ROOT = Path(__file__).resolve().parents[2]
MODEL = os.environ.get("SPRITE_MODEL", "gpt-image-1.5")

def load_key():
    for line in (ROOT / ".env").read_text().splitlines():
        if line.startswith("OPENAI_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"')
    raise SystemExit("OPENAI_API_KEY missing")

def build_prompt(char, anim):
    n, _, _, _, pose = ANIMS[anim]
    return "\n\n".join([
        f"Create a pixel-art fighting-game spritesheet of the animation '{anim.replace('_',' ')}' for the character in the reference sheet.",
        CHARACTERS[char]["identity"], STYLE, LAYOUT.format(n=n, grid=("in 2 rows of %d frames each (a grid)" % (n // 2)) if grid_for(n) == 2 else "in a single horizontal row"),
        f"ANIMATION ({n} frames): {pose}",
        "The character's face, hair, costume, colours and body proportions must be identical in every frame and identical to the reference.",
    ])

def generate(char, anim, attempt=0):
    key = load_key()
    ref = ROOT / "assets/sprites" / char / "reference.png"
    out = ROOT / "assets/sprites" / char / "raw" / f"{char}_{anim}_{attempt}.png"
    with open(ref, "rb") as f:
        r = requests.post("https://api.openai.com/v1/images/edits",
            headers={"Authorization": f"Bearer {key}"},
            files=[("image[]", (ref.name, f, "image/png"))],
            data={"model": MODEL, "prompt": build_prompt(char, anim), "size": "1536x1024",
                  "quality": "high", "input_fidelity": "high", "n": "1"}, timeout=600)
    if r.status_code != 200:
        raise RuntimeError(f"{r.status_code}: {r.text[:500]}")
    out.write_bytes(base64.b64decode(r.json()["data"][0]["b64_json"]))
    print("saved", out)
    return out

if __name__ == "__main__":
    char, names = sys.argv[1], sys.argv[2:]
    if names == ["all"]: names = list(ANIMS)
    attempt = int(os.environ.get("ATTEMPT", "0"))
    for a in names:
        generate(char, a, attempt)
