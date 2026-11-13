"""Water in the top metre of Mars, for the Water trail -> public/tex/mars_water.webp

Source: NASA 2001 Mars Odyssey Gamma Ray Spectrometer, "Water concentration" map (H2O weight %, 5 x 5 degree, smoothed),
NASA Planetary Data System, ODY-M-GRS-5-ELEMENTS-V1.0:
https://pds-geosciences.wustl.edu/ody/ody-m-grs-5-elements-v1/odgm_xxxx/data/smoothed/h2o_sr_5x5.tab
The instrument cannot measure under the seasonal CO2 frost near the poles; those cells are 9999.999 (no data).
We smooth the 5-degree grid onto the 2:1 globe texture and blend it over the Viking colour mosaic.
Run: .venv/bin/python pipeline/fetch_mars_water.py
"""
import io
from pathlib import Path

import numpy as np
import requests
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
URL = "https://pds-geosciences.wustl.edu/ody/ody-m-grs-5-elements-v1/odgm_xxxx/data/smoothed/h2o_sr_5x5.tab"
rows = np.loadtxt(io.StringIO(requests.get(URL, timeout=120).text))
lat, lon, h2o = rows[:, 0], rows[:, 1], rows[:, 2]
grid = np.full((36, 72), np.nan, "float32")                     # 5-degree cells, north up, lon 0..360
for la, lo, v in zip(lat, lon, h2o):
    if v < 9000:
        grid[int((90 - la) // 5), int((lo % 360) // 5)] = v
print("cells with data", np.isfinite(grid).mean().round(3), "range", np.nanmin(grid), np.nanmax(grid))

# texture is -180..180 like the other Mars maps: shift by half
grid = np.roll(grid, 36, axis=1)
W, H = 2048, 1024
valid = np.isfinite(grid).astype("float32")
g = Image.fromarray(np.nan_to_num(grid, nan=0)).resize((W, H), Image.BICUBIC)
m = Image.fromarray(valid).resize((W, H), Image.BICUBIC)
gv, mv = np.asarray(g, "float32"), np.asarray(m, "float32")
val = np.where(mv > 0.5, gv / np.maximum(mv, 1e-3), np.nan)

# colour (same ramp as the legend): driest ~2% -> wettest ~8% water by weight
v = np.clip(np.nan_to_num(val, nan=0), 2, 8)
stops = np.array([[0.55, 0.20, 0.10], [0.80, 0.48, 0.25], [0.35, 0.65, 0.78], [0.12, 0.40, 0.88], [0.05, 0.15, 0.70]])
pos = np.array([2, 3.2, 4.5, 6, 8])
rgb = np.stack([np.interp(v, pos, stops[:, k]) for k in range(3)], -1)
base = np.asarray(Image.open(ROOT / "public" / "tex" / "mars_base.webp").convert("RGB").resize((W, H)), "float32") / 255
grey = base.mean(-1, keepdims=True)
mix = np.where(np.isfinite(val)[..., None], 0.12 * grey + 0.88 * rgb, grey * 0.55)
Image.fromarray((np.clip(mix, 0, 1) * 255).astype("uint8")).save(ROOT / "public" / "tex" / "mars_water.webp", quality=84, method=6)
print("saved")
