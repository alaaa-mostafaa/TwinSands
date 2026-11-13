"""Radar view of Haughton crater (Devon Island, Canada) for the Water story -> public/photos/story_haughton_radar.webp

Source: Canadian Space Agency RADARSAT-1 open archive on AWS (s3://radarsat-r1-l1-cog, open licence; see
https://donnees-data.asc-csa.gc.ca/en/dataset/radarsat1 and https://github.com/asc-csa/radarsat1-scripts).
Scene RS1_X0481880_F1_20010103_075409_HH_SGF: Fine beam 1, HH, 3 January 2001 (polar night: radar needs no sunlight).
Found with CSA's scene index (r1_data_with_aws.csv in asc-csa/radarsat1-scripts) by testing which footprints contain
the crater centre (75.38 N, 89.68 W). The image is placed on a lat/lon grid with its own ground control points and shown
as radar brightness in decibels (bright = rough or tilted toward the satellite).
Run: .venv/bin/python pipeline/fetch_radar.py
"""
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.control import GroundControlPoint
from rasterio.transform import from_bounds
from rasterio.warp import Resampling, reproject

ROOT = Path(__file__).resolve().parents[1]
URL = "https://s3-ca-central-1.amazonaws.com/radarsat-r1-l1-cog/2001/1/RS1_X0481880_F1_20010103_075409_HH_SGF.tif"
LAT, LON, HALF, F, N = 75.38, -89.68, 0.22, 2, 900

with rasterio.open(URL) as src:
    gcps, gcrs = src.gcps
    a = src.read(1, out_shape=(src.height // F, src.width // F)).astype("float32")
g2 = [GroundControlPoint(row=g.row / F, col=g.col / F, x=g.x, y=g.y) for g in gcps]
dlon = HALF / np.cos(np.radians(LAT))
dst = np.zeros((N, N), "float32")
reproject(a, dst, gcps=g2, src_crs=gcrs or "EPSG:4326", dst_transform=from_bounds(LON - dlon, LAT - HALF, LON + dlon, LAT + HALF, N, N),
          dst_crs="EPSG:4326", resampling=Resampling.average, src_nodata=0, dst_nodata=0)
db = np.where(dst > 0, 10 * np.log10(np.maximum(dst, 1)), np.nan)
lo, hi = np.nanpercentile(db, 2), np.nanpercentile(db, 98)
img = (np.clip((np.nan_to_num(db, nan=lo) - lo) / (hi - lo), 0, 1) * 255).astype("uint8")
Image.fromarray(img).convert("RGB").save(ROOT / "public" / "photos" / "story_haughton_radar.webp", quality=86, method=6)
print("saved")
