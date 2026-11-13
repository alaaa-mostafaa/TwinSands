"""(Tested, not used on the site: AMSR2 values over hot deserts read higher than over temperate land, which looks unreliable for this use.)
How dry is Earth's ground? JAXA soil moisture map for the Soil trail -> public/tex/earth_soilmoist.webp

Source: JAXA GCOM-W / AMSR2 Level-3 Soil Moisture Content (a JAXA G-Portal product), July monthly normal 2012-2021,
served openly as Cloud-Optimized GeoTIFFs by the JAXA Earth API (https://data.earth.jaxa.jp), STAC at
https://data.earth.jaxa.jp/stac/cog/v1/catalog.json. Values: volumetric water content (%).
Mars' surface soil holds essentially no liquid water, so the driest deserts on this map are the most Mars-like.
Run: .venv/bin/python pipeline/fetch_soil_moisture.py [month 01-12]
"""
import json
import sys
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
M = sys.argv[1] if len(sys.argv) > 1 else "07"
C = ("https://s3.ap-northeast-1.wasabisys.com/je-pds/cog/v1/"
     "JAXA.G-Portal_GCOM-W.AMSR2_standard.L3-SMC.daytime.v3_global_monthly-normal")
W, H = 2048, 1024
out = np.full((H, W), np.nan, dtype="float32")
for half, x0 in (("W180.00-S90.00-E000.00-N90.00", 0), ("E000.00-S90.00-E180.00-N90.00", W // 2)):
    tile = "W180.00-E000.00" if x0 == 0 else "E000.00-E180.00"
    url = f"{C}/{M}/0/{tile}/{half}-SMC_2012_2021.tif"
    with rasterio.open(url) as src:
        a = src.read(1, out_shape=(H, W // 2), masked=True).astype("float32").filled(np.nan)
        nd = src.nodata
    if nd is not None:
        a[a == nd] = np.nan
    a[a < 0] = np.nan
    a = a / 10.0                      # stored as 0.1 % units
    out[:, x0:x0 + W // 2] = a
print("valid", np.isfinite(out).mean(), "range", np.nanmin(out), np.nanmax(out))

# colour: driest = Mars rust, wetter = blue-green; no data (ice sheets, dense forest, ocean) = dim base map
v = np.clip(np.nan_to_num(out, nan=-1), 0, 40)          # percent water by volume
stops = np.array([[0.80, 0.30, 0.13], [0.90, 0.58, 0.30], [0.45, 0.62, 0.40], [0.20, 0.50, 0.55], [0.10, 0.30, 0.75]])
pos = np.array([0, 4, 10, 20, 40])
rgb = np.stack([np.interp(v, pos, stops[:, k]) for k in range(3)], -1)
base = np.asarray(Image.open(ROOT / "public" / "tex" / "earth_base.webp").convert("RGB").resize((W, H)), dtype="float32") / 255
mix = np.where(np.isfinite(out)[..., None], 0.2 * base + 0.8 * rgb, base * 0.45)
Image.fromarray((np.clip(mix, 0, 1) * 255).astype("uint8")).save(ROOT / "public" / "tex" / "earth_soilmoist.webp", quality=82, method=6)
(ROOT / "public" / "data" / "soilmoist.json").write_text(json.dumps({"source": "JAXA GCOM-W AMSR2 L3 soil moisture (G-Portal product) via JAXA Earth API", "month": M, "years": "2012-2021"}))
print("saved")
