"""Earth permafrost map for the Water trail -> public/tex/earth_permafrost.webp (+ legend values in data/permafrost.json)

Source: ESA Climate Change Initiative Permafrost, combined L4 dataset (ground temperature & permafrost area fraction),
found through the ESA Open Science Catalog (product "esa-cci-permafrost") and read from the public DeepESDL Zarr cube
s3://deep-esdl-public/esa-cci-permafrost-1x1151x1641-1.0.0.zarr (1 km, northern hemisphere polar stereographic, 2000-2019).

We read the permafrost area fraction (PFR, % of each 1 km cell that is permafrost) for the latest year (2019), and
reproject it onto the same 2:1 equirectangular grid as the site's other Earth maps, so it can wrap the 3D globe.
Run: .venv/bin/python pipeline/fetch_permafrost.py
"""
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numcodecs
import numpy as np
import requests
from PIL import Image
from pyproj import CRS, Transformer

ROOT = Path(__file__).resolve().parents[1]
Z = "https://deep-esdl-public.s3.eu-central-1.amazonaws.com/esa-cci-permafrost-1x1151x1641-1.0.0.zarr"
meta = requests.get(f"{Z}/.zmetadata", timeout=60).json()["metadata"]
arr = meta["PFR/.zarray"]
T, H, W = arr["shape"]
ch, cw = arr["chunks"][1:]
codec = numcodecs.get_codec(arr["compressor"])
year = T - 1


def coord(name):
    a = meta[f"{name}/.zarray"]
    raw = requests.get(f"{Z}/{name}/0", timeout=60).content
    return np.frombuffer(numcodecs.get_codec(a["compressor"]).decode(raw), dtype=a["dtype"])


xs, ys = coord("x"), coord("y")
crs_wkt = meta["spatial_ref/.zattrs"].get("crs_wkt") or meta["spatial_ref/.zattrs"].get("spatial_ref")

pfr = np.full((H, W), np.nan, dtype="float32")


def chunk(ij):
    i, j = ij
    r = requests.get(f"{Z}/PFR/{year}.{i}.{j}", timeout=120)
    if r.status_code != 200:
        return
    a = np.frombuffer(codec.decode(r.content), dtype=arr["dtype"]).reshape(ch, cw).astype("float32")
    fill = arr.get("fill_value")
    if fill is not None:
        a[a == fill] = np.nan
    h, w = min(ch, H - i * ch), min(cw, W - j * cw)
    pfr[i * ch:i * ch + h, j * cw:j * cw + w] = a[:h, :w]


with ThreadPoolExecutor(8) as ex:
    list(ex.map(chunk, [(i, j) for i in range(-(-H // ch)) for j in range(-(-W // cw))]))
print("read", np.isfinite(pfr).mean())

# reproject to equirectangular 2048 x 1024 (only latitudes 25-90 N have data)
OW, OH = 2048, 1024
lon = (np.arange(OW) + 0.5) / OW * 360 - 180
lat = 90 - (np.arange(OH) + 0.5) / OH * 180
LON, LAT = np.meshgrid(lon, lat)
north = LAT > 25
tr = Transformer.from_crs("EPSG:4326", CRS.from_wkt(crs_wkt) if crs_wkt else CRS.from_epsg(3995), always_xy=True)
px, py = tr.transform(LON[north], LAT[north])
dx, dy = xs[1] - xs[0], ys[1] - ys[0]
ci = np.round((px - xs[0]) / dx).astype(int)
ri = np.round((py - ys[0]) / dy).astype(int)
ok = (ci >= 0) & (ci < W) & (ri >= 0) & (ri < H)
val = np.full(px.shape, np.nan, dtype="float32")
val[ok] = pfr[ri[ok], ci[ok]]
out = np.full((OH, OW), np.nan, dtype="float32")
out[north] = val

# colour: no permafrost = transparent-ish dark, then pale blue -> deep blue with more frozen ground
v = np.nan_to_num(out, nan=0) / 100
stops = np.array([[0.05, 0.05, 0.08], [0.55, 0.78, 0.95], [0.25, 0.55, 0.9], [0.1, 0.25, 0.75]])
pos = np.array([0, 0.05, 0.5, 1])
rgb = np.stack([np.interp(v, pos, stops[:, k]) for k in range(3)], -1)
base = np.asarray(Image.open(ROOT / "public" / "tex" / "earth_base.webp").convert("RGB").resize((OW, OH)), dtype="float32") / 255
mix = np.where((v > 0)[..., None], 0.15 * base + 0.85 * rgb, base * 0.55)
Image.fromarray((np.clip(mix, 0, 1) * 255).astype("uint8")).save(ROOT / "public" / "tex" / "earth_permafrost.webp", quality=82, method=6)
(ROOT / "public" / "data" / "permafrost.json").write_text(json.dumps({
    "source": "ESA CCI Permafrost (via ESA Open Science Catalog / DeepESDL)", "year": 2000 + year,
    "variable": "permafrost area fraction, %"}))
print("saved, year", 2000 + year)
