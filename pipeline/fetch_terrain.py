"""Real 3D terrain for the "Explore" walk -> public/terrain/<id>.bin (+ index.json)

Reads a 12 km x 12 km elevation window (30 m grid) around each region straight from the USGS Astrogeology
analysis-ready archive (MRO CTX DTMs for Mars, Barker et al. LOLA south-pole DEMs for the Moon), using the
Terrestrial Analog Finder's window reader (only the needed bytes are downloaded). Each window is saved as a
256 x 256 grid of uint16 heights; heights = min + value / 65535 * (max - min) metres.

Needs: uv pip install rasterio==1.5.2 pyproj==3.8.0
Run:   .venv/bin/python pipeline/fetch_terrain.py [path/to/terrestrial-analog-finder]
"""
import json
import sys
from pathlib import Path

import numpy as np
import requests

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent
sys.path.insert(0, str(SRC / "backend"))
from pipeline import sources  # noqa: E402  (Terrestrial Analog Finder)

OUT = ROOT / "public" / "terrain"
OUT.mkdir(parents=True, exist_ok=True)
REGIONS = ["mars-gale", "mars-jezero", "mars-olympus",
           "moon-shackleton-rim", "moon-malapert-massif", "moon-highlands"]
# Sites that are not in the analog finder's locations.json: (body, lat, lon, DEM url, source resolution m).
# Olympus Mons: the south wall of the summit caldera, where the rim drops ~3.2 km to the caldera floor.
# CTX DTMs only cover ~40% of this wall, so we use the gap-free NASA MOLA + ESA HRSC blended global DEM (200 m).
MOLA_HRSC = "https://planetarymaps.usgs.gov/mosaic/Mars/HRSC_MOLA_Blend/Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif"
# Lunar highlands: the Apollo 16 landing site in the Descartes highlands, from the NASA LRO LOLA global DEM (118 m).
LOLA = "https://planetarymaps.usgs.gov/mosaic/Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif"
EXTRA = {"mars-olympus": ("mars", 17.8095, -133.55, MOLA_HRSC, 200.0),
         "moon-highlands": ("moon", -8.97, 15.50, LOLA, 118.0)}
N = 256


def fill_nans(a):
    """Fill missing cells by repeatedly averaging their valid neighbours (no invented relief)."""
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
    """Area-average resample a square grid to n x n."""
    k = a.shape[0] / n
    idx = (np.arange(n + 1) * k).astype(int)
    return np.array([[a[idx[i]:idx[i + 1], idx[j]:idx[j + 1]].mean() for j in range(n)] for i in range(n)], dtype="float32")


locs = {l["id"]: l for l in json.loads((SRC / "data" / "processed" / "locations.json").read_text())["locations"]}
index = {}
for rid in REGIONS:
    if rid in EXTRA:
        body, lat, lon, url, res = EXTRA[rid]
        w = sources.read_astrogeo_window(body, url, lat, lon, res)
    else:
        l = locs[rid]
        item = requests.get(l["source_item"]["stac_url"], timeout=60).json()
        url = item["assets"]["dtm"]["href"]
        w = sources.read_astrogeo_window(l["body"], url, l["lat"], l["lon"], l["source_item"]["gsd_m"])
    valid = float(np.isfinite(w.elevation).mean())
    z = resample(fill_nans(w.elevation), N)
    if rid in EXTRA and EXTRA[rid][4] > 50:       # coarse source: soften the 200 m pixel steps (no new relief)
        k = np.exp(-0.5 * (np.arange(-6, 7) / 2.5) ** 2); k /= k.sum()
        for ax in (0, 1):
            z = np.apply_along_axis(lambda v: np.convolve(np.pad(v, 6, mode="edge"), k, mode="valid"), ax, z)
    lo, hi = float(z.min()), float(z.max())
    q = np.round((z - lo) / max(hi - lo, 1e-6) * 65535).astype("<u2")
    q.tofile(OUT / f"{rid}.bin")
    index[rid] = {"n": N, "size_m": sources.WINDOW_SIZE_M, "min": round(lo, 2), "max": round(hi, 2),
                  "valid_fraction": round(valid, 4), "source": url}
    print(rid, f"relief {hi - lo:.0f} m, valid {valid:.1%}", flush=True)
    hs_path = ROOT / "public" / "hillshade" / f"{rid}.webp"
    if not hs_path.exists():                      # card thumbnail for regions the analog finder has no hillshade for
        from PIL import Image
        gy, gx = np.gradient(z, 12000 / N)
        shade = np.clip(0.55 + (-gx + gy) * 0.35, 0, 1)
        Image.fromarray((shade * 255).astype("uint8")).resize((512, 512)).save(hs_path, quality=80)
    if rid in EXTRA:
        # wide backdrop: 120 km of the same global DEM around the walk, so distant walls and hills are there to see
        body, lat, lon, url, res = EXTRA[rid]
        keep = (sources.WINDOW_SIZE_M, sources.GRID_RES_M, sources.N_PX)
        sources.WINDOW_SIZE_M, sources.GRID_RES_M, sources.N_PX = 120_000.0, 400.0, 300
        try:
            far = sources.read_astrogeo_window(body, url, lat, lon, res).elevation
        finally:
            sources.WINDOW_SIZE_M, sources.GRID_RES_M, sources.N_PX = keep
        fz = resample(fill_nans(far), 200)
        flo, fhi = float(fz.min()), float(fz.max())
        np.round((fz - flo) / max(fhi - flo, 1e-6) * 65535).astype("<u2").tofile(OUT / f"{rid}.far.bin")
        index[rid]["far"] = {"n": 200, "size_m": 120_000.0, "min": round(flo, 2), "max": round(fhi, 2), "source": url}
        print(rid, f"backdrop relief {fhi - flo:.0f} m", flush=True)
(OUT / "index.json").write_text(json.dumps(index, indent=1))
