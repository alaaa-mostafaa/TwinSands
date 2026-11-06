"""Fetch real NASA global maps for Earth, Mars and the Moon and save them as
equirectangular globe textures in public/tex/.

Sources
- Earth: NASA GIBS WMS (EPSG:4326), https://gibs.earthdata.nasa.gov
- Mars and Moon: NASA Solar System Treks WMTS tiles, https://trek.nasa.gov

Data layers are blended over a dimmed grey copy of each world's base map so the
colour reads as a heat map while the geography stays recognisable. The raw layer


Run:  .venv/bin/python pipeline/fetch_textures.py
"""
from __future__ import annotations

import io
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests
from PIL import Image, ImageEnhance, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "tex"
OUT.mkdir(parents=True, exist_ok=True)
S = requests.Session()
S.headers["User-Agent"] = "TwinSands/0.1 (NASA Space Apps 2026 student project)"

GIBS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
TREK = "https://trek.nasa.gov/tiles/{body}/EQ/{layer}/1.0.0/default/default028mm/{z}/{r}/{c}.{ext}"


def gibs(layer: str, w: int, time: str | None = None, fmt: str = "image/png") -> Image.Image:
    params = dict(SERVICE="WMS", REQUEST="GetMap", VERSION="1.3.0", LAYERS=layer, CRS="EPSG:4326",
                  BBOX="-90,-180,90,180", WIDTH=w, HEIGHT=w // 2, FORMAT=fmt, TRANSPARENT="TRUE")
    if time:
        params["TIME"] = time
    r = S.get(GIBS, params=params, timeout=180)
    r.raise_for_status()
    if not r.headers.get("content-type", "").startswith("image"):
        raise RuntimeError(f"GIBS {layer}: {r.text[:300]}")
    return Image.open(io.BytesIO(r.content)).convert("RGBA")


def trek_tile(body, layer, z, r, c):
    for ext in ("png", "jpg"):
        resp = S.get(TREK.format(body=body, layer=layer, z=z, r=r, c=c, ext=ext), timeout=60)
        if resp.ok and resp.headers.get("content-type", "").startswith("image"):
            return Image.open(io.BytesIO(resp.content)).convert("RGBA")
    return None


def trek(body: str, layer: str, z: int) -> Image.Image:
    """Stitch level z, falling back to coarser levels for low-resolution products."""
    for level in range(z, -1, -1):
        try:
            return _trek(body, layer, level)
        except RuntimeError:
            if level == 0:
                raise
    raise RuntimeError("unreachable")


def _trek(body: str, layer: str, z: int) -> Image.Image:
    cols, rows = 2 ** (z + 1), 2 ** z
    canvas = Image.new("RGBA", (cols * 256, rows * 256), (0, 0, 0, 0))
    jobs = [(r, c) for r in range(rows) for c in range(cols)]
    with ThreadPoolExecutor(8) as ex:
        tiles = list(ex.map(lambda rc: trek_tile(body, layer, z, *rc), jobs))
    missing = 0
    for (r, c), t in zip(jobs, tiles):
        if t is None:
            missing += 1
            continue
        canvas.paste(t.resize((256, 256)), (c * 256, r * 256))
    if missing == len(jobs):
        raise RuntimeError(f"Trek {body}/{layer}: no tiles at level {z}")
    return canvas


def dim_base(base: Image.Image, size, level=0.42) -> Image.Image:
    g = ImageOps.grayscale(base.convert("RGB").resize(size, Image.LANCZOS))
    g = ImageEnhance.Brightness(g).enhance(level)
    return g.convert("RGBA")


def blend(base: Image.Image, layer: Image.Image, alpha=0.82) -> Image.Image:
    size = base.size
    lay = layer.resize(size, Image.LANCZOS)
    a = lay.getchannel("A").point(lambda v: int(v * alpha))
    lay.putalpha(a)
    return Image.alpha_composite(base, lay)


def save(img: Image.Image, name: str, size=(2048, 1024), q=86):
    img.convert("RGB").resize(size, Image.LANCZOS).save(OUT / f"{name}.jpg", quality=q, optimize=True, progressive=True)
    print(f"  saved {name}.jpg", flush=True)


# Each entry: name, fetcher, blend-over-base?, credit
EARTH = [
    ("earth_base", lambda: gibs("BlueMarble_NextGeneration", 4096, fmt="image/jpeg"), None,
     "NASA Blue Marble Next Generation (GIBS)"),
    ("earth_relief", lambda: gibs("ASTER_GDEM_Color_Shaded_Relief", 2048), "base",
     "NASA/METI ASTER GDEM colour shaded relief (GIBS)"),
    ("earth_lst_day", lambda: gibs("MODIS_Terra_L3_Land_Surface_Temp_Monthly_Day", 2048, "2024-07-01"), "base",
     "MODIS Terra land surface temperature, monthly day, July 2024 (GIBS)"),
    ("earth_lst_night", lambda: gibs("MODIS_Terra_L3_Land_Surface_Temp_Monthly_Night", 2048, "2024-07-01"), "base",
     "MODIS Terra land surface temperature, monthly night, July 2024 (GIBS)"),
    ("earth_dust", lambda: gibs("MERRA2_Dust_Surface_Mass_Concentration_Monthly", 2048, "2024-06-01"), "base",
     "MERRA-2 dust surface mass concentration, monthly, June 2024 (GIBS)"),
    ("earth_snow", lambda: gibs("MODIS_Terra_L3_Snow_Cover_Monthly_Average_Pct", 2048, "2024-01-01"), "base",
     "MODIS Terra snow cover, monthly average, January 2024 (GIBS)"),
    ("earth_volcano", lambda: gibs("NDH_Volcano_Hazard_Frequency_Distribution_1979-2000", 2048), "base",
     "NASA SEDAC volcano hazard frequency 1979-2000 (GIBS)"),
    ("earth_land", lambda: gibs("OSM_Land_Mask", 2048), None, "OpenStreetMap land mask (GIBS)"),
]
MARS = [
    ("mars_base", lambda: trek("Mars", "Mars_Viking_MDIM21_ClrMosaic_global_232m", 3), None,
     "Viking MDIM 2.1 colour mosaic (NASA/USGS, Mars Trek)"),
    ("mars_mola", lambda: trek("Mars", "Mars_MGS_MOLA_ClrShade_merge_global_463m", 2), None,
     "MGS MOLA colour hillshade (NASA/GSFC, Mars Trek)"),
    ("mars_ti", lambda: trek("Mars", "TES_Thermal_Inertia", 2), "base",
     "MGS TES thermal inertia, Putzig et al. 2005 (Mars Trek)"),
    ("mars_dust", lambda: trek("Mars", "TES_Dust", 2), "base",
     "MGS TES dust cover index, Ruff & Christensen 2002 (Mars Trek)"),
    ("mars_rough", lambda: trek("Mars", "mola_roughness", 2), "base",
     "MOLA kilometre-scale roughness, Kreslavsky & Head 2000 (Mars Trek)"),
    ("mars_albedo", lambda: trek("Mars", "Mars_MGS_TES_Albedo_mosaic_global_7410m", 2), None,
     "MGS TES albedo (Mars Trek)"),
]
MOON = [
    ("moon_base", lambda: trek("Moon", "LRO_WAC_Mosaic_Global_303ppd_v02", 3), None,
     "LRO LROC WAC global mosaic (NASA/GSFC/ASU, Moon Trek)"),
    ("moon_lola", lambda: trek("Moon", "LRO_LOLA_ClrShade_Global_128ppd_v04", 2), None,
     "LRO LOLA colour hillshade (Moon Trek)"),
    ("moon_fe", lambda: trek("Moon", "LP_GRS_Fe_Clr_Global_2ppd", 1), "base",
     "Lunar Prospector GRS iron abundance (Moon Trek)"),
    ("moon_feo", lambda: trek("Moon", "Clem_UVVIS_FeO_Clr_Global_152ppd", 2), "base",
     "Clementine UVVIS FeO weight percent (Moon Trek)"),
    ("moon_h", lambda: trek("Moon", "LP_NS_H_Clr_Global_2ppd", 1), "base",
     "Lunar Prospector neutron spectrometer hydrogen (Moon Trek)"),
    ("moon_temp", lambda: trek("Moon", "LRO_Diviner_ST_Avg_Clr_Global_32ppd", 2), "base",
     "LRO Diviner average surface temperature (Moon Trek)"),
    ("moon_rock", lambda: trek("Moon", "Diviner_avg_RockAbundance", 2), "base",
     "LRO Diviner rock abundance, Bandfield et al. (Moon Trek)"),
]


def run(group, base_name):
    credits = {}
    base = None
    for name, fetch, mode, credit in group:
        if only and name not in only and not (mode == "base" and base is None and name == base_name):
            if name != base_name:
                continue
        print(name, flush=True)
        try:
            img = fetch()
        except Exception as e:  # keep going; report at the end
            print(f"  FAILED: {e}", flush=True)
            credits[name] = {"credit": credit, "error": str(e)[:200]}
            continue
        if name == base_name:
            base = img
            save(img, name, (4096, 2048) if img.width >= 4096 else (2048, 1024), q=84)
        elif name == "earth_land":
            img.save(OUT / "earth_land.png", optimize=True)
            print("  saved earth_land.png")
        elif mode == "base" and base is not None:
            save(blend(dim_base(base, (2048, 1024)), img), name)
        else:
            save(img, name)
        credits[name] = {"credit": credit}
    return credits


only = set(sys.argv[1:])
if __name__ == "__main__":
    credits = {}
    credits |= run(EARTH, "earth_base")
    credits |= run(MARS, "mars_base")
    credits |= run(MOON, "moon_base")
    p = OUT / "credits.json"
    old = json.loads(p.read_text()) if p.exists() else {}
    p.write_text(json.dumps(old | credits, indent=1))
    print("done")
