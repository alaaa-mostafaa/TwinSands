"""Real Mars wind field for the Wind story's 3D Mars globe -> public/data/mars_winds.json

Source: Mars Climate Database v6 (LMD / Open University / IAA / ESA / CNES), web interface
https://www-mars.lmd.jussieu.fr/mcd_python/ ("intended for moderate use": this script makes 2 requests).
We ask for the east-west (u) and north-south (v) wind on a global grid, averaged over a full Mars day,
in the climatology (average dust, average solar) scenario.

Run:  .venv/bin/python pipeline/fetch_mars_winds.py [ls] [altitude_m]
"""
import json
import re
import sys
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://www-mars.lmd.jussieu.fr/mcd_python/"
LS = sys.argv[1] if len(sys.argv) > 1 else "270"        # Ls 270: northern winter, dusty season
ALT = sys.argv[2] if len(sys.argv) > 2 else "10"         # metres above the surface
S = requests.Session()
S.headers["User-Agent"] = "TwinSands/0.1 (NASA Space Apps 2026 student project; one-off download)"


def grid(var):
    q = dict(var1=var, var2="none", var3="none", var4="none", datekeyhtml="1", ls=LS, localtime="12",
             latitude="all", longitude="all", altitude=ALT, zkey="3", spacecraft="none", isfixedlt="off",
             dust="1", hrkey="1", averaging="off", dpi="80", islog="off", colorm="jet", proj="cyl",
             iswind="off", zonmean="off", diumean="on")
    html = S.get(BASE + "cgi-bin/mcdcgi.py", params=q, timeout=300).text
    txt = re.search(r"href='\.\./(txt/[0-9a-f]+\.txt)'", html).group(1)
    lines = S.get(BASE + txt, timeout=120).text.splitlines()
    lats, rows, lons = None, [], []
    for ln in lines:
        if ln.startswith("----") and "||" in ln:
            lats = [float(x) for x in ln.split("||")[1].split()]
        elif "||" in ln and not ln.startswith("#"):
            a, b = ln.split("||")
            lons.append(float(a)); rows.append([round(float(x), 2) for x in b.split()])
    return lats, lons, rows   # rows[lon][lat]


lats, lons, u = grid("u")
_, _, v = grid("v")
out = {"source": "Mars Climate Database v6 (LMD/OU/IAA/ESA/CNES), climatology scenario",
       "ls": float(LS), "altitude_m": float(ALT), "diurnal_mean": True,
       "lats": lats, "lons": lons, "u": u, "v": v}
(ROOT / "public" / "data" / "mars_winds.json").write_text(json.dumps(out, separators=(",", ":")))
speeds = [abs(x) for r in u for x in r]
print("grid", len(lons), "x", len(lats), "max |u|", max(speeds), "m/s")
