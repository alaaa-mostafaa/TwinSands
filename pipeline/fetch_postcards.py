"""Photos for the Neighborhoods "postcards": a real picture of each Earth twin next to its Mars/Moon place.

Earth photos come from Wikimedia Commons (licence and author recorded for each one; CC BY/BY-SA
need attribution, which the site shows on every postcard). Mars/Moon photos come from the NASA Image
and Video Library (public domain). Output: public/photos/pc_*.webp and public/data/postcards.json.

Run:  .venv/bin/python pipeline/fetch_postcards.py
"""
from __future__ import annotations

import io
import json
import re
import time
from pathlib import Path

import requests
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "photos"
DATA = ROOT / "public" / "data"
S = requests.Session()
S.headers["User-Agent"] = "TwinSands/0.1 (NASA Space Apps 2026 student project; one-off download)"

# key -> exact Commons file title (chosen by eye from search results)
COMMONS = {
    "pc_mauna_loa": "File:Mauna Loa Volcano.jpg",
    "pc_lava_tube": "File:Lanzarote 5 Luc Viatour.jpg",
    "pc_lava_tube_mouth": "File:Cueva de los Verdes - Lanzarote 02.jpg",
    "pc_lanzarote_plain": "File:Paisaje volcánica con el volcán de la Corona desde la Cueva de los Verdes - Lanzarote - CV05.jpg",
    "pc_grand_canyon": "File:Panorama Grand Canyon 2.jpg",
    "pc_moqui": "File:Moqui Marbles in GSENM.jpg",
    "pc_lake_qarun": "File:Lake Moeris 015.JPG",
    "pc_whale_valley": "File:Dorudon atrox fossil at Wadi El-Hitan, Egypt, March 2008.jpg",
    "pc_danakil": "File:Danakil Desert 08.jpg",
    "pc_dallol": "File:ET Afar asv2018-01 img36 Dallol.jpg",
    "pc_wright_valley": "File:Wright Valley 2013 02.jpg",
    "pc_white_desert": "File:White Desert, Rock formations in desert landscape, Egypt.jpg",
    "pc_sandstorm": "File:Sandstorm is coming (Unsplash).jpg",
    "pc_kamil": "File:Gebel Kamil - Aerodynamic Meteorite Flange (49796097546).png",
    "pc_greenland": "File:Helicopter is taking off Greenland ice sheet 1.jpg",
    "pc_transantarctic": "File:Transantarctic mountain hg.jpg",
    "pc_sudbury": "File:Melted Chaos from Sudbury Impact Crater .jpg",
    "pc_mistastin": "File:Mistastin crater L1C T20UMG T20VMH A026091 20200620T152632.jpg",
    "pc_pahoehoe": "File:Pāhoehoe Lava flow.JPG",
}
NASA = {
    "pc_procellarum": "PIA13245",
    "pc_imbrium": "PIA12931",
}


def save(img: Image.Image, key: str, maxw=1400):
    img = img.convert("RGB")
    img.thumbnail((maxw, maxw), Image.LANCZOS)
    img.save(OUT / f"{key}.webp", quality=80, method=6)
    return img.size


def strip(html: str | None) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html or "")).strip()


def commons(key: str, title: str):
    for attempt in range(6):
        r = S.get("https://commons.wikimedia.org/w/api.php", params=dict(
            action="query", titles=title, prop="imageinfo", iiprop="url|extmetadata", iiurlwidth=1600, format="json"), timeout=60)
        if r.status_code == 429:
            time.sleep(8 * (attempt + 1))
            continue
        p = next(iter(r.json()["query"]["pages"].values()))
        ii = p["imageinfo"][0]
        md = ii.get("extmetadata", {})
        for a2 in range(6):
            img_r = S.get(ii.get("thumburl") or ii["url"], timeout=120)
            if img_r.status_code == 429:
                time.sleep(8 * (a2 + 1))
                continue
            img_r.raise_for_status()
            break
        w, h = save(Image.open(io.BytesIO(img_r.content)), key)
        return {"source": "Wikimedia Commons", "title": title[5:], "author": strip(md.get("Artist", {}).get("value"))[:120] or "unknown",
                "license": md.get("LicenseShortName", {}).get("value"), "url": ii["descriptionurl"], "w": w, "h": h}
    raise RuntimeError("rate limited")


def nasa(key: str, nid: str):
    d = S.get("https://images-api.nasa.gov/search", params={"nasa_id": nid}, timeout=40).json()["collection"]["items"][0]["data"][0]
    assets = [i["href"] for i in S.get(f"https://images-api.nasa.gov/asset/{nid}", timeout=40).json()["collection"]["items"]]
    pick = next(a for suf in ("~large.jpg", "~medium.jpg", "~orig.jpg", "~orig.png", "~orig.tif") for a in assets if a.endswith(suf))
    w, h = save(Image.open(io.BytesIO(S.get(pick.replace("http://", "https://"), timeout=120).content)), key)
    return {"source": "NASA", "title": d.get("title"), "author": d.get("center") or "NASA", "license": "Public domain",
            "url": f"https://images.nasa.gov/details/{nid}", "w": w, "h": h}


def ortho_view(key: str, tex: str, lat0: float, lon0: float, zoom: float, credit: str, author: str, url: str):
    """Orthographic 'view from orbit' rendered from one of our global maps, centred on lat0/lon0.
    zoom = how much of the disc to show (1 = whole hemisphere). Used where no good photo exists."""
    import numpy as np
    src = np.asarray(Image.open(ROOT / "public" / "tex" / tex).convert("RGB"))
    H, W = src.shape[:2]
    ow, oh = 1200, 840
    ys, xs = np.mgrid[0:oh, 0:ow]
    x = (xs - ow / 2) / (ow / 2) / zoom
    y = -(ys - oh / 2) / (ow / 2) / zoom
    rho = np.sqrt(x * x + y * y)
    ok = rho <= 1
    c = np.arcsin(np.clip(rho, 0, 1))
    p0, l0 = np.radians(lat0), np.radians(lon0)
    with np.errstate(invalid="ignore", divide="ignore"):
        lat = np.arcsin(np.cos(c) * np.sin(p0) + np.where(rho > 0, y * np.sin(c) * np.cos(p0) / rho, 0))
        lon = l0 + np.arctan2(x * np.sin(c), rho * np.cos(c) * np.cos(p0) - y * np.sin(c) * np.sin(p0))
    u = ((np.degrees(lon) + 180) % 360) / 360 * (W - 1)
    v = (90 - np.degrees(lat)) / 180 * (H - 1)
    out = src[np.clip(v, 0, H - 1).astype(int), np.clip(u, 0, W - 1).astype(int)]
    out[~ok] = 0
    w, h = save(Image.fromarray(out), key)
    return {"source": "NASA", "title": credit, "author": author, "license": "Public domain", "url": url, "w": w, "h": h}


if __name__ == "__main__":
    meta_p = DATA / "postcards.json"
    meta = json.loads(meta_p.read_text()) if meta_p.exists() else {}
    for k, nid in NASA.items():
        if k not in meta:
            meta[k] = nasa(k, nid); print("nasa", k, flush=True)
    MT, MA = "https://trek.nasa.gov/mars/", "NASA / USGS, via Mars Trek"
    meta["pc_spa"] = ortho_view("pc_spa", "moon_lola.webp", -53, -169, 1.1, "South Pole–Aitken basin, LRO LOLA elevation (purple and blue are low)", "NASA / LRO, via Moon Trek", "https://trek.nasa.gov/moon/")
    meta["pc_hellas"] = ortho_view("pc_hellas", "mars_mola.webp", -42, 70, 1.5, "Hellas basin, MGS MOLA elevation (blue is low)", "NASA / GSFC, via Mars Trek", MT)
    meta["pc_noachis"] = ortho_view("pc_noachis", "mars_base_4k.webp", -45, -10, 2.4, "Noachis Terra, Viking colour mosaic", MA, MT)
    meta["pc_mars_north_cap"] = ortho_view("pc_mars_north_cap", "mars_base_4k.webp", 90, 0, 2.6, "Mars north polar cap seen from above, Viking colour mosaic", MA, MT)
    meta["pc_swiss_cheese"] = ortho_view("pc_swiss_cheese", "mars_base_4k.webp", -87, 0, 2.6, "Mars south polar cap seen from above, Viking colour mosaic", MA, MT)
    for k, t in COMMONS.items():
        if k in meta:
            continue
        try:
            meta[k] = commons(k, t); print("commons", k, meta[k]["license"], flush=True)
        except Exception as e:
            print("FAILED", k, e, flush=True)
        time.sleep(1.5)
    meta_p.write_text(json.dumps(meta, indent=1, ensure_ascii=False))
    print("done", len(meta))
