"""Real sounds for the Twin Trails "Listen" buttons -> public/sounds/*.mp3 + public/data/sounds.json

Mars: Perseverance rover microphone recordings (NASA/JPL-Caltech, public domain).
Moon: Apollo surface audio (NASA, public domain). The Moon has no air, so some panels are silent on purpose.
Earth: field recordings from Wikimedia Commons (licence and author kept for the credit line).
Each clip is trimmed, loudness-normalised and saved as a small mono MP3.

Run:  .venv/bin/python pipeline/fetch_sounds.py
"""
import json
import re
import subprocess
import tempfile
import time
from pathlib import Path

import imageio_ffmpeg
import requests

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "sounds"
OUT.mkdir(parents=True, exist_ok=True)
CACHE = Path(__file__).resolve().parent / ".cache"   # raw downloads, so re-runs don't hit Commons again
CACHE.mkdir(exist_ok=True)
FF = imageio_ffmpeg.get_ffmpeg_exe()
S = requests.Session()
S.headers["User-Agent"] = "TwinSands/0.1 (NASA Space Apps 2026 student project; one-off download) python-requests"

# key: (Commons file title, start s, length s, loops)
CLIPS = {
    "mars_laser": ("First acoustic recording of laser shots on Mars.oga", 0, 11, 0),
    "mars_drive": ("Sounds of Perseverance Mars rover driving highlights.oga", 0, 20, 0),
    "mars_moxie": ("The Sound of MOXIE at Work on Mars.oga", 0, 20, 0),
    "mars_dustdevil": ("NASA's Perseverance Records a Martian Dust Devil.oga", 7, 16, 0),   # silent before 7 s and after 23 s
    "mars_wind": ("Perseverance rover's SuperCam records wind on Mars.oga", 3, 20, 0),
    "moon_orange_soil": ("A17-soil.ogg", 0, 24, 0),
    "moon_small_step": ("Armstrong Small Step.ogg", 0, 24, 0),
    "moon_hammer_feather": ("A15-test.ogg", 0, 44, 0),
    "earth_stream": ("Hemlock stream.ogg", 0, 20, 0),
    "earth_gravel": ("Footstep on Gravel (Gravity Sound).mp3", 0, 1, 9),
    "earth_st_helens": ("Eruption of Mount St. Helens, heard from 140 miles away (filtered and amplified).wav", 0, 25, 0),
    "earth_storm_wind": ("Wind in Swedish pine forest at 25 mps.ogg", 5, 20, 0),
    "earth_ice_crack": ("Sound of cracking ice.ogg", 0, 3, 2),
    "earth_arctic_night": ("20221229 - Abisko Turiststation at night - Wind and snow.wav", 5, 20, 0),
}


def get(url, **kw):
    for a in range(6):
        r = S.get(url, timeout=300, **kw)
        if r.status_code == 429 or (r.ok and r.headers.get("content-type", "").startswith("text/html") and "upload.wikimedia" in url):
            time.sleep(20 * (a + 1))
            continue
        r.raise_for_status()
        return r
    raise RuntimeError(f"gave up on {url}")


def strip(h):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", h or "")).strip()


meta_p = ROOT / "public" / "data" / "sounds.json"
meta = json.loads(meta_p.read_text()) if meta_p.exists() else {}
for key, (title, start, length, loops) in CLIPS.items():
    if key in meta and (OUT / f"{key}.mp3").exists():
        continue
    info = get("https://commons.wikimedia.org/w/api.php", params=dict(
        action="query", titles="File:" + title, prop="imageinfo", iiprop="url|extmetadata", format="json")).json()
    ii = next(iter(info["query"]["pages"].values()))["imageinfo"][0]
    md = ii["extmetadata"]
    cached = CACHE / title
    if cached.exists():
        raw = cached.read_bytes()
    else:
        raw = get(ii["url"]).content
        cached.write_bytes(raw)
    with tempfile.NamedTemporaryFile(suffix="." + title.rsplit(".", 1)[1]) as f:
        f.write(raw)
        f.flush()
        cmd = [FF, "-y", "-loglevel", "error"]
        if loops:
            cmd += ["-stream_loop", str(loops)]
        cmd += ["-ss", str(start), "-i", f.name]
        total = length * (loops + 1) if loops else length
        cmd += ["-t", str(total), "-ac", "1", "-ar", "44100",
                "-af", f"loudnorm=I=-18:TP=-2,afade=t=in:d=0.3,afade=t=out:st={max(0, total - 1.2)}:d=1.2",
                "-b:a", "96k", str(OUT / f"{key}.mp3")]
        subprocess.run(cmd, check=True)
    meta[key] = {"title": title.rsplit(".", 1)[0], "author": strip(md.get("Artist", {}).get("value"))[:120],
                 "license": md.get("LicenseShortName", {}).get("value"), "url": ii["descriptionurl"]}
    print(key, meta[key]["license"], flush=True)
    time.sleep(3)
meta_p.write_text(json.dumps(meta, indent=1, ensure_ascii=False))
print("done", len(meta))
