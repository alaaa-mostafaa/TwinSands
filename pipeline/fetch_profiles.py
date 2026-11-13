"""Side view of every Twin Score place -> public/data/profiles.json

For each place we read the same 12 km x 12 km height window the score uses (Copernicus DEM GLO-30 on Earth,
MRO CTX DTMs on Mars, LOLA south-pole DTMs on the Moon, via the Terrestrial Analog Finder's window readers) and
keep one west-to-east slice through the middle: 100 heights, one every 120 m, each the average of a 300 m wide
strip so single pixels don't spike. Heights are stored relative to the slice's lowest point, in metres.
Run: .venv/bin/python pipeline/fetch_profiles.py [path/to/terrestrial-analog-finder]
"""
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import requests

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent
sys.path.insert(0, str(SRC / "backend"))
from pipeline import sources  # noqa: E402

tw = json.loads((ROOT / "public" / "data" / "twins.json").read_text())
locs = {l["id"]: l for l in json.loads((SRC / "data" / "processed" / "locations.json").read_text())["locations"]}
OUT = ROOT / "public" / "data" / "profiles.json"
prof = json.loads(OUT.read_text()) if OUT.exists() else {}

# every place a visitor can see in Twin Score: all targets, their top 12, and the NASA test sites
want = {t["id"] for t in tw["targets"]}
for r in tw["rankings"].values():
    want |= {x["id"] for x in r["top"][:12]}
want |= set(next(iter(tw["answer_key"].values())).keys())
sites = {s["id"]: s for s in tw["targets"] + tw["earth"]}


def window(s):
    if s["body"] == "earth":
        return sources.read_copernicus_window(s["lat"], s["lon"]).elevation
    l = locs[s["id"]]
    item = requests.get(l["source_item"]["stac_url"], timeout=60).json()
    return sources.read_astrogeo_window(s["body"], item["assets"]["dtm"]["href"], s["lat"], s["lon"], l["source_item"]["gsd_m"]).elevation


def one(sid):
    if sid in prof or sid not in sites:
        return
    try:
        e = window(sites[sid])
    except Exception as ex:  # noqa: BLE001
        print("skip", sid, str(ex)[:80], flush=True)
        return
    n = e.shape[0]
    band = e[n // 2 - 5:n // 2 + 5]                     # 300 m wide strip through the middle (30 m pixels)
    row = np.nanmean(band, axis=0)
    if np.isfinite(row).mean() < 0.6:
        print("too many gaps", sid, flush=True)
        return
    x = np.arange(row.size)
    ok = np.isfinite(row)
    row = np.interp(x, x[ok], row[ok])
    pts = row.reshape(100, -1).mean(axis=1)              # 100 points, 120 m apart
    pts = pts - pts.min()
    prof[sid] = [round(float(v), 1) for v in pts]
    print(sid, f"relief {pts.max():.0f} m", flush=True)


with ThreadPoolExecutor(6) as ex:
    list(ex.map(one, sorted(want)))
OUT.write_text(json.dumps(prof, separators=(",", ":")))
print("saved", len(prof), "of", len(want))
