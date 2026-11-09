"""Real pictures of each Twin Score place, the same 12 km x 12 km square the score measured -> public/views/<id>.webp

- Mars targets: the MRO CTX orthoimage that comes with each DTM (USGS Astrogeology ARD), black and white.
- Moon targets: LRO LROC WAC global mosaic, 100 m/px (USGS Astrogeology).
- Earth sites (every site shown in a top-12 list or in the test-site list): Sentinel-2 cloudless 2016 by EOX
  (CC BY 4.0, contains modified Copernicus Sentinel data 2016), via its public WMS.
Run: .venv/bin/python pipeline/fetch_views.py [path/to/terrestrial-analog-finder]
"""
import io
import json
import math
import sys
from pathlib import Path

import numpy as np
import requests
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent
sys.path.insert(0, str(SRC / "backend"))
from pipeline import sources  # noqa: E402

OUT = ROOT / "public" / "views"
OUT.mkdir(parents=True, exist_ok=True)
WAC = "https://planetarymaps.usgs.gov/mosaic/Lunar_LRO_LROC-WAC_Mosaic_global_100m_June2013.tif"
EOX = "https://tiles.maps.eox.at/wms"
UA = {"User-Agent": "TwinSands/0.1 (NASA Space Apps 2026 student project)"}


def stretch(a):
    a = np.where(np.isfinite(a), a, np.nan)
    lo, hi = np.nanpercentile(a, 1), np.nanpercentile(a, 99)
    return (np.clip((np.nan_to_num(a, nan=lo) - lo) / max(hi - lo, 1e-6), 0, 1) * 255).astype("uint8")


tw = json.loads((ROOT / "public" / "data" / "twins.json").read_text())
locs = {l["id"]: l for l in json.loads((SRC / "data" / "processed" / "locations.json").read_text())["locations"]}
credits = {}

for t in tw["targets"]:
    out = OUT / f"{t['id']}.webp"
    if out.exists():
        continue
    if t["body"] == "mars":
        item = requests.get(locs[t["id"]]["source_item"]["stac_url"], timeout=60).json()
        url = item["assets"]["orthoimage"]["href"]
        a = sources.read_astrogeo_window("mars", url, t["lat"], t["lon"], 6.0).elevation
        credits[t["id"]] = "NASA/JPL/MSSS MRO CTX, via USGS Astrogeology"
    else:
        a = sources.read_astrogeo_window("moon", WAC, t["lat"], t["lon"], 100.0).elevation
        credits[t["id"]] = "NASA/GSFC/Arizona State University LRO LROC WAC, via USGS Astrogeology"
    Image.fromarray(stretch(a)).save(out, quality=82, method=6)
    print(t["id"], flush=True)

want = set(tw["answer_key"].get(tw["targets"][0]["id"], {}).keys())
for r in tw["rankings"].values():
    want |= {x["id"] for x in r["top"][:12]}
earth = {e["id"]: e for e in tw["earth"]}
for eid in sorted(want):
    e = earth.get(eid)
    out = OUT / f"{eid}.webp"
    if not e or out.exists():
        continue
    dlat = 6 / 111.32
    dlon = 6 / (111.32 * math.cos(math.radians(e["lat"])))
    r = requests.get(EOX, params=dict(service="WMS", request="GetMap", version="1.1.1", layers="s2cloudless", srs="EPSG:4326",
                                      bbox=f"{e['lon'] - dlon},{e['lat'] - dlat},{e['lon'] + dlon},{e['lat'] + dlat}",
                                      width=480, height=480, format="image/jpeg"), headers=UA, timeout=120)
    if r.headers.get("content-type", "").startswith("image/jpeg"):
        Image.open(io.BytesIO(r.content)).convert("RGB").save(out, quality=80, method=6)
        print(eid, flush=True)
    else:
        print("failed", eid, r.status_code)

meta = {"mars": "NASA/JPL/MSSS, MRO CTX (black and white), via USGS Astrogeology",
        "moon": "NASA/GSFC/Arizona State University, LRO LROC WAC mosaic, via USGS Astrogeology",
        "earth": "Sentinel-2 cloudless 2016 by EOX IT Services GmbH (CC BY 4.0), contains modified Copernicus Sentinel data 2016"}
(ROOT / "public" / "data" / "views.json").write_text(json.dumps({"credits": meta, "have": sorted(p.stem for p in OUT.glob("*.webp"))}))
print("done", len(list(OUT.glob("*.webp"))))
