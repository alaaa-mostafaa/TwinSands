"""Day-to-night land temperature swing for the Soil trail -> public/tex/earth_tswing.webp

Source: JAXA GCOM-C / SGLI Level-3 Land Surface Temperature v3, monthly, daytime and nighttime (a JAXA G-Portal
product), July 2025, read as Cloud-Optimized GeoTIFFs from the open JAXA Earth API (https://data.earth.jaxa.jp,
STAC https://data.earth.jaxa.jp/stac/cog/v1/catalog.json). Stored as uint16; kelvin = value x 0.02; 65535 = no data.
Bare, dry ground can't hold heat, so it swings hardest between day and night: the same reason Mars and the Moon,
with no water and little or no air, swing by 100+ degrees.
Run: .venv/bin/python pipeline/fetch_jaxa_lst.py
"""
import json
import urllib.request
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
B = ("https://s3.ap-northeast-1.wasabisys.com/je-pds/cog/v1/JAXA.G-Portal_GCOM-C.SGLI_standard.L3-LST.{dn}"
     ".v3_global_monthly/2025-07/0/{tile}/S90.00-N90.00.json")
W, H = 2048, 1024


def grid(dn):
    out = np.full((H, W), np.nan, "float32")
    for tile, x0 in (("W180.00-E000.00", 0), ("E000.00-E180.00", W // 2)):
        u = B.format(dn=dn, tile=tile)
        item = json.load(urllib.request.urlopen(u, timeout=60))
        href = u.rsplit("/", 1)[0] + "/" + list(item["assets"].values())[0]["href"][2:]
        with rasterio.open(href) as s:
            a = s.read(1, out_shape=(H, W // 2)).astype("float32")
        a[(a >= 65535) | (a == 0)] = np.nan
        out[:, x0:x0 + W // 2] = a * 0.02 - 273.15
    return out


sw = grid("daytime") - grid("nighttime")
v = np.clip(np.nan_to_num(sw, nan=-1), 0, 45)
stops = np.array([[0.12, 0.30, 0.55], [0.35, 0.55, 0.55], [0.90, 0.70, 0.40], [0.85, 0.38, 0.15], [0.65, 0.12, 0.08]])
pos = np.array([0, 8, 18, 28, 45])
rgb = np.stack([np.interp(v, pos, stops[:, k]) for k in range(3)], -1)
base = np.asarray(Image.open(ROOT / "public" / "tex" / "earth_base.webp").convert("RGB").resize((W, H)), dtype="float32") / 255
mix = np.where(np.isfinite(sw)[..., None], 0.2 * base + 0.8 * rgb, base * 0.45)
Image.fromarray((np.clip(mix, 0, 1) * 255).astype("uint8")).save(ROOT / "public" / "tex" / "earth_tswing.webp", quality=82, method=6)
print("saved")
