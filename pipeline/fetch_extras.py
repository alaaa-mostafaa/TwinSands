"""Fetch everything that is not a globe texture:

- NASA image library photos (public domain) for each chapter  -> public/photos/
- Smithsonian Global Volcanism Program Holocene volcanoes      -> public/data/volcanoes.json
- GIBS colour legends for the Earth layers                     -> public/legends/
- Earth relief + dust textures re-made for the heat-map look   -> public/tex/

Run:  .venv/bin/python pipeline/fetch_extras.py
"""
from __future__ import annotations

import io
import json
import re
from pathlib import Path

import numpy as np
import requests
from PIL import Image

from fetch_textures import OUT as TEX, S, dim_base, gibs, save

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "public" / "photos"
DATA = ROOT / "public" / "data"
LEG = ROOT / "public" / "legends"
for p in (PHOTOS, DATA, LEG):
    p.mkdir(parents=True, exist_ok=True)

# nasa_id -> short key used by the site. Chosen by hand after searching images.nasa.gov.
PHOTO_IDS = {
    "PIA18885": "mars_berries",          # Opportunity: hematite-rich spherules, Meridiani
    "PIA16918": "mars_rocknest",         # Curiosity at Rocknest, Gale
    "PIA24485": "mars_jezero_delta",     # Perseverance: Jezero delta
    "PIA07925": "mars_dust_devil",       # Spirit: dust devil, Gusev
    "PIA10910": "mars_phoenix_ice",      # Phoenix: ice in trench sublimating
    "PIA10919": "mars_phoenix_soil",     # Phoenix scoop soil
    "PIA21043": "mars_murray_buttes",    # Curiosity: layered buttes, Mount Sharp
    "PIA02982": "mars_olympus",          # Viking colour mosaic of Olympus Mons
    "PIA06926": "mars_valles",           # Valles Marineris mosaic
    "PIA09929": "mars_skylights",        # Seven possible cave skylights, Arsia Mons
    "PIA19457": "mars_yardangs",         # HiRISE yardangs
    "PIA22077": "mars_ice_scarp",        # HiRISE: buried ice exposed in a scarp
    "PIA25412": "mars_dust_storm",       # Dust storm
    "PIA24096": "mars_jezero_orbit",     # Jezero from ESA Mars Express
    "PIA15545": "mars_dust_devil_hirise",# HiRISE whirling dust devil
    "PIA06739": "mars_opportunity_shadow",
    "PIA12954": "moon_marius_pit",       # Marius Hills pit, LROC
    "PIA13523": "moon_south_pole",       # Lunar south pole
    "GSFC_20171208_Archive_e001873": "moon_tycho",
    "PIA15515": "moon_far_side",         # Far side, GRAIL MoonKAM
    "as17-140-21497": "moon_apollo17",   # Apollo 17 Station 6 boulder
    "as11-40-5877": "moon_bootprint",    # Apollo 11 bootprint
    "PIA23526": "earth_lanzarote",       # Lanzarote from orbit
    "PIA12461": "earth_dry_valleys",     # McMurdo Dry Valleys
    "PIA18515": "earth_afrera",          # Lake Afrera, Danakil
    "PIA23420": "earth_salar_atacama",   # Salar de Atacama
}


def photos():
    meta = {}
    for nid, key in PHOTO_IDS.items():
        try:
            info = S.get("https://images-api.nasa.gov/search", params={"nasa_id": nid}, timeout=40).json()
            d = info["collection"]["items"][0]["data"][0]
            assets = [i["href"] for i in S.get(f"https://images-api.nasa.gov/asset/{nid}", timeout=40).json()["collection"]["items"]]
            pick = next((a for suf in ("~large.jpg", "~medium.jpg", "~orig.jpg", "~orig.png", "~orig.tif") for a in assets if a.endswith(suf)), None)
            if not pick:
                raise RuntimeError("no jpg asset")
            img = Image.open(io.BytesIO(S.get(pick.replace("http://", "https://"), timeout=120).content)).convert("RGB")
            img.thumbnail((1600, 1600), Image.LANCZOS)
            img.save(PHOTOS / f"{key}.jpg", quality=84, optimize=True, progressive=True)
            desc = re.sub(r"<[^>]+>", "", d.get("description", "")).strip()
            meta[key] = {"nasa_id": nid, "title": d.get("title"), "center": d.get("center"),
                         "date": (d.get("date_created") or "")[:10], "credit": d.get("photographer") or d.get("secondary_creator") or "NASA",
                         "description": desc[:420], "url": f"https://images.nasa.gov/details/{nid}",
                         "w": img.width, "h": img.height}
            print("photo", key, img.size, flush=True)
        except Exception as e:
            print("photo FAILED", nid, e, flush=True)
    (DATA / "photos.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))


def volcanoes():
    url = ("https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?service=WFS&version=1.0.0&request=GetFeature"
           "&typeName=GVP-VOTW:Smithsonian_VOTW_Holocene_Volcanoes&outputFormat=application/json")
    fc = S.get(url, timeout=180).json()
    out = []
    for f in fc["features"]:
        p, (lon, lat) = f["properties"], f["geometry"]["coordinates"]
        out.append([round(lat, 3), round(lon, 3), p.get("Volcano_Name"), p.get("Primary_Volcano_Type"),
                    p.get("Last_Eruption_Year"), p.get("Country")])
    (DATA / "volcanoes.json").write_text(json.dumps({
        "source": "Smithsonian Institution Global Volcanism Program, Volcanoes of the World (Holocene), via GVP GeoServer WFS",
        "fields": ["lat", "lon", "name", "type", "last_eruption_year", "country"], "volcanoes": out}))
    print("volcanoes", len(out))


def legends():
    caps = S.get("https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/1.0.0/WMTSCapabilities.xml", timeout=180).text
    for key, layer in {"earth_lst": "MODIS_Terra_L3_Land_Surface_Temp_Monthly_Day",
                       "earth_dust": "MERRA2_Dust_Surface_Mass_Concentration_Monthly",
                       "earth_snow": "MODIS_Terra_L3_Snow_Cover_Monthly_Average_Pct",
                       "earth_relief": "ASTER_GDEM_Color_Index"}.items():
        i = caps.find(f"<ows:Identifier>{layer}</ows:Identifier>")
        m = re.search(r"legend-type/horizontal'[^>]*xlink:href='([^']+)'", caps[i:i + 8000])
        if not m:
            print("legend missing", layer)
            continue
        svg = S.get(m.group(1), timeout=60).text
        (LEG / f"{key}.svg").write_text(svg)
        print("legend", key)


def earth_fixes():
    base = Image.open(TEX / "earth_base.jpg")
    dark = dim_base(base, (2048, 1024), 0.5)
    # Elevation: colour index over a dim base (the shaded-relief variant reads as a plain map)
    rel = gibs("ASTER_GDEM_Color_Index", 2048)
    save(Image.alpha_composite(dark, rel), "earth_relief")
    # Dust: GIBS paints "almost no dust" in opaque beige; key it out so only real dust glows.
    dust = gibs("MERRA2_Dust_Surface_Mass_Concentration_Monthly", 2048, "2024-06-01")
    a = np.asarray(dust).astype(np.float32)
    low = np.median(a[900:1000, :, :3].reshape(-1, 3), axis=0)  # Southern Ocean: background colour
    dist = np.linalg.norm(a[..., :3] - low, axis=-1)
    alpha = np.clip(dist / 90.0, 0, 1) * (a[..., 3] / 255.0)
    a[..., 3] = alpha * 255
    keyed = Image.fromarray(a.astype(np.uint8), "RGBA")
    save(Image.alpha_composite(dark, keyed), "earth_dust")


def land_mask():
    """White land / black ocean, from GIBS OSM_Land_Mask (land is drawn, water is transparent)."""
    m = Image.open(TEX / "earth_land.png").convert("RGBA")
    a = np.asarray(m)
    land = (a[..., 3] > 128) & (a[..., :3].sum(-1) > 30)
    Image.fromarray((land * 255).astype(np.uint8), "L").save(TEX / "earth_land_mask.png", optimize=True)
    print("land mask: land fraction of pixels", round(float(land.mean()), 3))


if __name__ == "__main__":
    import sys
    if sys.argv[1:] == ["landmask"]:
        land_mask(); raise SystemExit
    if sys.argv[1:] == ["photos"]:
        photos(); raise SystemExit
    earth_fixes()
    land_mask()
    legends()
    volcanoes()
    photos()
