"""Images for the Twin Trails "senses": smell objects and a few extra "see" photos.

Smell objects (public/senses/*.webp, with transparency) are made from Wikimedia Commons photos:
  cut    -> background removed with rembg (isnet-general-use), cropped to the object
  screen -> bright thing on a dark photo (sparks, sneeze); kept as is and drawn with CSS screen blending
  round  -> soft round vignette, for things that cannot be cut out (a water drop)
See photos (public/photos/*.webp): NASA Apollo images and a Commons photo of Río Tinto.
Credits go to public/data/senses.json and are shown on screen.

Run:  .venv/bin/python pipeline/fetch_senses.py
"""
import io
import json
import re
import time
from pathlib import Path

import numpy as np
import requests
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SEN = ROOT / "public" / "senses"
PHO = ROOT / "public" / "photos"
SEN.mkdir(parents=True, exist_ok=True)
CACHE = Path(__file__).resolve().parent / ".cache"
CACHE.mkdir(exist_ok=True)
S = requests.Session()
S.headers["User-Agent"] = "TwinSands/0.1 (NASA Space Apps 2026 student project; one-off download) python-requests"

OBJECTS = {
    "coins": ("Few old coins from a numismatic collection.jpg", "cut"),
    "egg": ("Egg upright.jpg", "cut"),
    "match": ("A match burning out.jpg", "cut"),
    "ice": ("Ice cubes openphoto.jpg", "cut"),
    "snow": ("Снежок1.jpg", "cut"),
    "steak": ("Steak auf Grill.jpg", "cut"),
    "chalk": ("Chalkboard eraser, Waldorf School, East Lexington MA.jpg", "cut"),
    "soda": ("Sparkling Water with Mint in Glass Cup.jpg", "cut"),
    "cleaner": ("Chemicals 02.jpg", "cut"),
    "sparkler": ("Sparkler.JPG", "screen"),
    "weld": ("Manual Metal Arc welding (MMAW) (4791858983).jpg", "screen"),
    "sneeze": ("Sneeze.JPG", "screen"),
    "rain": ("Water drop 001.jpg", "round"),
    "sandpile": ("Pile of sand by the soccer fields at Brastad Arena.jpg", "cut"),
    # feel
    "lemon": ("Lemon-Whole-Split.jpg", "cut"),
    "sand": ("Handful of Black Sand.jpg", "cut"),
    "glass": ("Glass shards.jpg", "cut"),
    "feather": ("Ostrich Feather Duster.jpg", "cut"),
    "velcro": ("2023 Opaski rzepowe.jpg", "cut"),
    "windsock": ("Windsock Hodenhagen Aerodrome 2013.jpg", "cut"),
}
NASA_SEE = {"moon_orange_soil": "as17-137-20990", "moon_flag": "as11-40-5875"}
RIO_TINTO_QUERY = "Río Tinto river Huelva red water"


def get(url, **kw):
    for a in range(6):
        r = S.get(url, timeout=120, **kw)
        if r.status_code == 429:
            time.sleep(15 * (a + 1))
            continue
        r.raise_for_status()
        return r
    raise RuntimeError(url)


def strip(h):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", h or "")).strip()


def commons(title, width=1000):
    info = get("https://commons.wikimedia.org/w/api.php", params=dict(
        action="query", titles="File:" + title, prop="imageinfo", iiprop="url|extmetadata", iiurlwidth=width, format="json")).json()
    ii = next(iter(info["query"]["pages"].values()))["imageinfo"][0]
    c = CACHE / f"img_{abs(hash(title))}_{width}"
    if not c.exists():
        c.write_bytes(get(ii.get("thumburl") or ii["url"]).content)
    md = ii["extmetadata"]
    return Image.open(c).convert("RGB"), {"title": title.rsplit(".", 1)[0], "author": strip(md.get("Artist", {}).get("value"))[:100],
                                          "license": md.get("LicenseShortName", {}).get("value"), "url": ii["descriptionurl"]}


_session = None


def cut(img):
    global _session
    from rembg import new_session, remove
    if _session is None:
        _session = new_session("isnet-general-use")
    out = remove(img, session=_session)
    bbox = out.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox()
    return out.crop(bbox) if bbox else out


def round_vignette(img):
    w, h = img.size
    s = min(w, h)
    img = img.crop(((w - s) // 2, (h - s) // 2, (w + s) // 2, (h + s) // 2)).convert("RGBA")
    yy, xx = np.mgrid[0:s, 0:s]
    r = np.sqrt((xx - s / 2) ** 2 + (yy - s / 2) ** 2) / (s / 2)
    a = np.clip((1 - r) / 0.25, 0, 1) * 255
    img.putalpha(Image.fromarray(a.astype(np.uint8)))
    return img


if __name__ == "__main__":
    meta_p = ROOT / "public" / "data" / "senses.json"
    meta = json.loads(meta_p.read_text()) if meta_p.exists() else {}
    for key, (title, mode) in OBJECTS.items():
        if key in meta and (SEN / f"{key}.webp").exists():
            continue
        img, m = commons(title)
        if mode == "cut":
            img = cut(img)
        elif mode == "round":
            img = round_vignette(img)
        img.thumbnail((640, 640), Image.LANCZOS)
        img.save(SEN / f"{key}.webp", quality=82, method=6)
        meta[key] = m | {"mode": mode}
        print("object", key, mode, img.size, m["license"], flush=True)
        time.sleep(1)
    for key, nid in NASA_SEE.items():
        if (PHO / f"{key}.webp").exists():
            continue
        assets = [i["href"] for i in get(f"https://images-api.nasa.gov/asset/{nid}").json()["collection"]["items"]]
        pick = next(a for suf in ("~large.jpg", "~medium.jpg", "~orig.jpg") for a in assets if a.endswith(suf))
        im = Image.open(io.BytesIO(get(pick.replace("http://", "https://")).content)).convert("RGB")
        im.thumbnail((1400, 1400))
        im.save(PHO / f"{key}.webp", quality=78, method=6)
        d = get("https://images-api.nasa.gov/search", params={"nasa_id": nid}).json()["collection"]["items"][0]["data"][0]
        meta[key] = {"title": d["title"][:90], "author": "NASA", "license": "Public domain", "url": f"https://images.nasa.gov/details/{nid}"}
        print("nasa", key, flush=True)
    if not (PHO / "earth_rio_tinto.webp").exists():
        r = get("https://commons.wikimedia.org/w/api.php", params=dict(action="query", list="search", srsearch=f"filetype:bitmap {RIO_TINTO_QUERY}", srnamespace=6, srlimit=5, format="json")).json()
        titles = [x["title"][5:] for x in r["query"]["search"]]
        print("rio tinto candidates", titles)
        img, m = commons(titles[0], 1400)
        img.save(PHO / "earth_rio_tinto.webp", quality=78, method=6)
        meta["earth_rio_tinto"] = m
    meta_p.write_text(json.dumps(meta, indent=1, ensure_ascii=False))
    print("done", len(meta))
