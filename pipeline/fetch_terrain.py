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
REGIONS = ["mars-gale", "mars-jezero", "mars-meridiani", "mars-utopia-zhurong",
           "moon-shackleton-rim", "moon-malapert-massif", "moon-haworth", "moon-de-gerlache-rim"]
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
    l = locs[rid]
    item = requests.get(l["source_item"]["stac_url"], timeout=60).json()
    url = item["assets"]["dtm"]["href"]
    w = sources.read_astrogeo_window(l["body"], url, l["lat"], l["lon"], l["source_item"]["gsd_m"])
    valid = float(np.isfinite(w.elevation).mean())
    z = resample(fill_nans(w.elevation), N)
    lo, hi = float(z.min()), float(z.max())
    q = np.round((z - lo) / max(hi - lo, 1e-6) * 65535).astype("<u2")
    q.tofile(OUT / f"{rid}.bin")
    index[rid] = {"n": N, "size_m": sources.WINDOW_SIZE_M, "min": round(lo, 2), "max": round(hi, 2),
                  "valid_fraction": round(valid, 4), "source": url}
    print(rid, f"relief {hi - lo:.0f} m, valid {valid:.1%}", flush=True)
(OUT / "index.json").write_text(json.dumps(index, indent=1))
