"""Give every hillshade its own contrast stretch (1st-99th percentile -> full range), so ridges, valleys and
craters stand out and different places stop looking like the same flat grey. Only the brightness scale changes;
the terrain itself is untouched. Safe to re-run (a stretched image stretches to itself).
Run: .venv/bin/python pipeline/stretch_hillshades.py
"""
from pathlib import Path
import numpy as np
from PIL import Image

for f in (Path(__file__).resolve().parents[1] / "public" / "hillshade").glob("*.webp"):
    a = np.asarray(Image.open(f).convert("L"), dtype="float32")
    lo, hi = np.percentile(a, 1), np.percentile(a, 99)
    if hi - lo < 1:
        continue
    b = np.clip((a - lo) / (hi - lo), 0, 1) ** 1.15          # slight gamma so shadows read as shadows
    Image.fromarray((b * 255).astype("uint8")).save(f, quality=82, method=6)
print("stretched")
