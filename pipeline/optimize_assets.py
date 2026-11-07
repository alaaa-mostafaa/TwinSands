"""Make the site fast: convert everything in public/ to WebP and right-size it. Safe to re-run.

- photos/*.jpg            -> .webp, max 1400 px
- tex/*.jpg               -> .webp (2048 x 1024); the three base maps also get a *_4k.webp for the hero
- hillshade/*.png         -> greyscale .webp
Run after fetch_textures.py / fetch_extras.py / build_twins.py:  .venv/bin/python pipeline/optimize_assets.py
"""
import json
from pathlib import Path

from PIL import Image

PUB = Path(__file__).resolve().parents[1] / "public"

for f in (PUB / "photos").glob("*.jpg"):
    im = Image.open(f).convert("RGB")
    im.thumbnail((1400, 1400))
    im.save(f.with_suffix(".webp"), quality=78, method=6)
    f.unlink()

for f in (PUB / "tex").glob("*.jpg"):
    im = Image.open(f).convert("RGB")
    if f.stem in ("earth_base", "mars_base", "moon_base"):
        im.save(f.with_name(f.stem + "_4k.webp"), quality=78, method=6)
        im = im.resize((2048, 1024), Image.LANCZOS)
    im.save(f.with_suffix(".webp"), quality=82, method=6)
    f.unlink()

for f in (PUB / "hillshade").glob("*.png"):
    Image.open(f).convert("L").save(f.with_suffix(".webp"), quality=80, method=6)
    f.unlink()

p = PUB / "data" / "twins.json"
if p.exists():
    d = json.loads(p.read_text())
    for k in ("targets", "earth"):
        for s in d[k]:
            if s.get("hillshade"):
                s["hillshade"] = s["hillshade"].replace(".png", ".webp")
    p.write_text(json.dumps(d, separators=(",", ":")))
print("optimized")
