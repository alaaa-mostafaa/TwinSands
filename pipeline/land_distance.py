"""Distance-to-land map for the Meet Mars "continents close into a ball" animation.

Reads public/tex/earth_land_mask.png (white = land) and writes public/tex/earth_land_dist.png:
0 on land, rising with distance from the nearest coast (grid steps, wrapping east-west), scaled so
255 = the 97th percentile of ocean distance. The shader grows land by raising a threshold on it.
Run:  .venv/bin/python pipeline/land_distance.py
"""
from pathlib import Path

import numpy as np
from PIL import Image

TEX = Path(__file__).resolve().parents[1] / "public" / "tex"
land = np.asarray(Image.open(TEX / "earth_land_mask.png").convert("L").resize((1024, 512), Image.NEAREST)) > 127
dist = np.where(land, 0, np.inf).astype(np.float32)
# Brushfire: each pass extends known distances by one step (8-neighbour, diagonal = sqrt 2).
for _ in range(400):
    best = dist.copy()
    for dy, dx, c in ((0, 1, 1), (0, -1, 1), (1, 0, 1), (-1, 0, 1), (1, 1, 1.414), (1, -1, 1.414), (-1, 1, 1.414), (-1, -1, 1.414)):
        sh = np.roll(dist, dx, axis=1)                      # east-west wraps around the globe
        sh = np.roll(sh, dy, axis=0)
        if dy == 1: sh[0, :] = np.inf                        # no wrap across the poles
        if dy == -1: sh[-1, :] = np.inf
        best = np.minimum(best, sh + c)
    if np.array_equal(best, dist):
        break
    dist = best
ocean = dist[~land]
p97 = float(np.percentile(ocean[np.isfinite(ocean)], 97))
out = np.clip(dist / p97, 0, 1) * 255
Image.fromarray(out.astype(np.uint8), "L").save(TEX / "earth_land_dist.png", optimize=True)
print("p97 distance", round(p97, 1), "px; land fraction", round(float(land.mean()), 3))
