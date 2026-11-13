"""Wide "far" backdrop terrain for the Explore walk -> public/terrain/<id>.far.bin (+ "far" entry in index.json)

120 km x 120 km around each walk, sampled into the SAME local frame as the 12 km walk window (azimuthal
equidistant on the body's sphere, centred on the window centre, north up, x east), as a 200 x 200 grid of
uint16 heights (min + v / 65535 * (max - min) metres). Only the needed bytes are read over HTTP.

  Mars:  NASA MOLA + ESA HRSC blended global DEM, 200 m (uncompressed strip TIFF: GTIFF_DIRECT_IO keeps reads small)
  Moon south pole: NASA LRO LOLA LDEM_75S_120M, polar stereographic, 120 m (PDS3 float, km relative to 1737.4 km)

The far grid is shifted by the median (near - far) over the walk square, so CTX-based walks (about 30 m above
the MOLA/HRSC heights) meet their backdrop without a step. The 12 km .bin files are not touched.

Needs: uv pip install --python .venv/bin/python rasterio==1.4.3 numpy
Run:   .venv/bin/python pipeline/fetch_far_terrain.py mars-gale mars-jezero moon-shackleton-rim moon-malapert-massif
       Add --cache DIR (e.g. pipeline/.cache/far, git-ignored) to keep each raw 300 x 300 read as DIR/<id>.far.npy and reuse it on the next run
       (a pole read can take most of an hour on a slow link).
"""
import json
import os
import sys
from pathlib import Path

import numpy as np

# Only fetch the bytes we need: no sidecar directory listings, and read just our columns of the
# 213 KB-wide uncompressed strips of the global Mars DEM instead of whole strips.
for k, v in {"GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR", "GTIFF_DIRECT_IO": "YES", "GDAL_HTTP_MULTIRANGE": "YES"}.items():
    os.environ.setdefault(k, v)
import rasterio  # noqa: E402
from rasterio.crs import CRS  # noqa: E402
from rasterio.enums import Resampling  # noqa: E402
from rasterio.transform import from_origin  # noqa: E402
from rasterio.vrt import WarpedVRT  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "terrain"
MOLA_HRSC = "https://planetarymaps.usgs.gov/mosaic/Mars/HRSC_MOLA_Blend/Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif"
LDEM_75S = "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/float_img/ldem_75s_120m_float.lbl"
LDEM_75S_240 = LDEM_75S.replace("120m", "240m")   # 4x fewer bytes; plenty for a 600 m backdrop grid
MARS_R, MOON_R = 3396190.0, 1737400.0
# id: (sphere radius m, window centre lat, lon (same centre as the 12 km walk window), DEM, metres per DEM unit)
SITES = {
    "mars-gale": (MARS_R, -4.6019, 137.4724, MOLA_HRSC, 1.0),
    "mars-jezero": (MARS_R, 18.4286, 77.4388, MOLA_HRSC, 1.0),
    "moon-shackleton-rim": (MOON_R, -89.7721, -156.5898, LDEM_75S, 1000.0),   # LDEM values are km
    "moon-malapert-massif": (MOON_R, -85.9897, -0.2363, LDEM_75S_240, 1000.0),
}
SIZE, PX, N = 120_000.0, 300, 200          # read 300 px at 400 m, area-average down to 200 (as for Olympus)


def read_local(R, lat, lon, url, size, px):
    crs = CRS.from_proj4(f"+proj=aeqd +lat_0={lat} +lon_0={lon} +R={R} +units=m +no_defs")
    tr = from_origin(-size / 2, size / 2, size / px, size / px)        # row 0 = north edge, col 0 = west edge
    with rasterio.open(url) as s, WarpedVRT(s, crs=crs, transform=tr, width=px, height=px,
                                            resampling=Resampling.bilinear, src_nodata=s.nodata,
                                            nodata=np.nan, dtype="float32") as v:
        return v.read(1).astype("float64")    # raw DN: rasterio does not apply the PDS OFFSET (1737.4)


def fill_nans(a):
    a = a.copy()
    for _ in range(200):
        m = np.isnan(a)
        if not m.any():
            break
        p = np.pad(a, 1, mode="edge")
        nb = np.stack([p[:-2, 1:-1], p[2:, 1:-1], p[1:-1, :-2], p[1:-1, 2:]])
        a[m] = np.nanmean(nb, axis=0)[m]
    return np.nan_to_num(a, nan=float(np.nanmean(a)))


def resample(a, n):
    k = a.shape[0] / n
    idx = (np.arange(n + 1) * k).astype(int)
    return np.array([[a[idx[i]:idx[i + 1], idx[j]:idx[j + 1]].mean() for j in range(n)] for i in range(n)])


def bilinear(grid, size, x, z):
    """Sample a square grid laid out like the walk mesh (vertices span +-size/2, row 0 north) at x east, z south."""
    n = grid.shape[0]
    c = np.clip((x + size / 2) * (n - 1) / size, 0, n - 1.001)
    r = np.clip((z + size / 2) * (n - 1) / size, 0, n - 1.001)
    c0, r0 = c.astype(int), r.astype(int)
    fc, fr = c - c0, r - r0
    g = lambda rr, cc: grid[rr, cc]
    return (g(r0, c0) * (1 - fc) + g(r0, c0 + 1) * fc) * (1 - fr) + (g(r0 + 1, c0) * (1 - fc) + g(r0 + 1, c0 + 1) * fc) * fr


args = sys.argv[1:]
cache = None
if "--cache" in args:
    i = args.index("--cache"); cache = Path(args[i + 1]); del args[i:i + 2]
    cache.mkdir(parents=True, exist_ok=True)
index = json.loads((OUT / "index.json").read_text())
for rid in args or list(SITES):
    R, lat, lon, url, unit = SITES[rid]
    hit = cache / f"{rid}.far.npy" if cache else None
    if hit and hit.exists():
        raw = np.load(hit).astype("float64")
    else:
        raw = read_local(R, lat, lon, url, SIZE, PX) * unit
        if hit:
            np.save(hit, raw.astype("float32"))
    fz = resample(fill_nans(raw), N)
    m = index[rid]
    q = np.fromfile(OUT / f"{rid}.bin", "<u2").reshape(m["n"], m["n"])
    near = m["min"] + q / 65535 * (m["max"] - m["min"])
    # vertical tie: far vertices inside the walk square vs the near grid at the same spots
    xs = np.linspace(-SIZE / 2, SIZE / 2, N)
    X, Z = np.meshgrid(xs, xs)
    inside = (np.abs(X) < m["size_m"] / 2) & (np.abs(Z) < m["size_m"] / 2)
    diff = bilinear(near, m["size_m"], X[inside], Z[inside]) - fz[inside]
    shift = float(np.median(diff))
    print(rid, f"near - far: median {shift:.1f} m, spread {np.std(diff):.1f} m", flush=True)
    fz = fz + shift
    lo, hi = float(fz.min()), float(fz.max())
    np.round((fz - lo) / max(hi - lo, 1e-6) * 65535).astype("<u2").tofile(OUT / f"{rid}.far.bin")
    m["far"] = {"n": N, "size_m": SIZE, "min": round(lo, 2), "max": round(hi, 2), "source": url.replace(".lbl", ".img"),
                "datum_shift_m": round(shift, 1)}
    print(rid, f"backdrop relief {hi - lo:.0f} m", flush=True)
    (OUT / "index.json").write_text(json.dumps(index, indent=1))   # after each site, so a slow later one can't lose it
