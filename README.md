# Twin Sands

Earth's twins for places on Mars and the Moon, matched on what they are made of and what shapes them, not just how they look.
Team Phobos & Deimos · NASA Space Apps Cairo 2026 · Challenge: *Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars*.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # static site in dist/ (works on GitHub Pages or Vercel as-is)
```

Everything the site shows is already in `public/`, so no backend and no API keys are needed.

## Chapters

| # | Chapter | What it shows |
|---|---|---|
| — | Hero | Earth / Mars / Moon carousel with real NASA textures and key facts |
| 01 | Meet Mars | Scroll story: Earth's continents squeeze into one ball and become Mars (148.9 vs 144.4 million km²), then true sizes with the Moon, Phobos and Deimos |
| 02 | Twin Trails | Rust, Soil, Fire, Wind, Water, South Pole: compare worlds with real data layers; each story has step-by-step narration |
| 03 | Neighborhoods | 23 postcards: a real Mars/Moon photo next to a real photo of its Earth twin, with a short story and what is the same and what is different |
| 04 | Twin Score | Scores 469 measured patches of Earth against 12 Mars/Moon sites, out of 100, and checks it against famous test sites |
| 05 | Field Guides | What matches, what doesn't, what to practice there |
| 06 | We Had to See It for Ourselves | Our field photos from Egypt and Saudi Arabia, alongside places and features from other worlds |

**Percy**, the little Perseverance hanging on a cable at the right edge, rides down the page as you scroll and says something in every chapter. Tap it for a guided tour: it leads you to the next chapter (and through each stage of Meet Mars). Its lines are in `src/components/roverLines.ts`.

## Adding your field photos

The Fayoum album in `public/photos/fayoum/` is paired with the Curiosity panorama; the Dahab album in `public/photos/dahab/` appears in the next card, paired with Curiosity at Rocknest. The Al Madinah Al Munawwarah, Saudi Arabia album in `public/photos/madina/` is paired with the Mars dust-devil image. The White Desert album in `public/photos/white-desert/` is paired with the wind-carved terrain comparison. Use the arrows to browse the albums; videos have playback controls. The Egyptian deserts album is in `public/photos/deserts/`, and the team-shadow photo is `public/field/shadow.jpg` (paired with Opportunity's shadow). Every slot has photos; a single-photo slot that is missing is simply not shown.

## Data pipeline (Python, run once; outputs are committed in `public/`)

```bash
uv venv --python 3.12 .venv && uv pip install --python .venv/bin/python pillow numpy requests
.venv/bin/python pipeline/fetch_textures.py   # globe textures: NASA GIBS (Earth), Mars Trek, Moon Trek
.venv/bin/python pipeline/fetch_extras.py     # NASA photos, Smithsonian volcanoes, GIBS legends, land mask
.venv/bin/python pipeline/build_twins.py ..        # Twin Score (path to the project root with the measurements)
.venv/bin/python pipeline/optimize_assets.py       # convert everything to WebP (fast loading)
.venv/bin/python pipeline/fetch_postcards.py       # Neighborhood postcard photos (Wikimedia Commons + NASA)
.venv/bin/python pipeline/land_distance.py         # distance-to-coast map for the Meet Mars ball animation
uv pip install --python .venv/bin/python imageio-ffmpeg && .venv/bin/python pipeline/fetch_sounds.py   # Twin Trails sounds
uv pip install --python .venv/bin/python "rembg[cpu]" && .venv/bin/python pipeline/fetch_senses.py   # smell cut-outs + extra photos
uv pip install --python .venv/bin/python playwright && .venv/bin/playwright install chromium && .venv/bin/python pipeline/render_rover_sprite.py   # frames for the rover that rides down the page
uv pip install --python .venv/bin/python rasterio==1.4.3 && .venv/bin/python pipeline/fetch_far_terrain.py --cache pipeline/.cache/far   # 120 km horizon around each Explore walk
```

Postcard photos of Earth twins come from Wikimedia Commons. Each one's author and licence are in `public/data/postcards.json` and shown on its card; CC BY / BY-SA photos require that credit, so keep it.

**Twin Score method** (full text in `pipeline/build_twins.py` and on the site under "How the score works"):
for each axis, closeness = the share of Earth windows that are farther from the target.
The axes are relief, typical slope, steep slopes, roughness, hypsometry, thermal inertia (percentile within its own world) and key minerals (EMIT vs. published rover minerals).
An axis we could not measure counts as 50. It is a ranking aid, not a probability.

Findings worth putting in the proposal:
- **Moon south pole:** without being told, the scorer ranks Mauna Kea (site of NASA ISRU tests) 2nd–7th of 469 for most rim sites. The Transantarctic cells next to the McMurdo Dry Valleys are the top twin for 7 of 8 Artemis-region sites.
- **Mars:** the classic analogs (Atacama, Haughton, Death Valley) land mid-pack on terrain. Their value is chemistry and climate, which is the case for scoring more than landform.
  The best fully measured (7/7) twins are lesser-known places: an Afar/Danakil cell about 200 km from Dallol for Gale, and the Namib for Meridiani.

## Space Apps challenge resources used

| Resource (from the challenge page) | Where it is used in Twin Sands |
|---|---|
| NASA Earthdata Search (CMR) | Measurement backend: finds EMIT mineral, ECOSTRESS temperature and MODIS albedo granules for every Earth window (`backend/pipeline/earthdata.py`) → Twin Score "minerals" spoke, Rust trail map |
| NASA Worldview (GIBS) | Twin Trails Earth maps: dust (Wind), snow, land temperature, relief (`pipeline/fetch_textures.py`) |
| NASA Planetary Data System | TES thermal inertia (Mars) and Diviner (Moon) in the score; CTX / LOLA DEMs via USGS Astrogeology (PDS-derived) for height maps, Explore terrain and Twin Score photos |
| NASA LRO (LROC, LOLA) | LOLA heights for Moon twins and the Explore walks; LROC WAC photos in Twin Score (`pipeline/fetch_views.py`); LRO south-pole mosaic in the South Pole story |
| NASA LRO Diviner | Polar Resource Product → ice-stable area and temperatures for every Moon site; shown in Twin Score's "NASA LRO Diviner" panel |
| CSA RADARSAT-1 | Radar image of Haughton crater taken in polar night (3 Jan 2001), Water story (`pipeline/fetch_radar.py`) |
| CSA SAR Python tutorial | Followed for reading and displaying the RADARSAT scene (GCP reprojection, dB stretch) |
| CSA RADARSAT Constellation Mission | The one resource not used: RCM open data is limited to a few sample scenes, none over our sites |
| ESA Copernicus | Copernicus DEM GLO-30 = all Earth heights in the score; Sentinel-2 cloudless (EOX) = Earth photos in Twin Score |
| ESA Open Science Catalog | Found ESA CCI Permafrost there → Water trail Earth map (`pipeline/fetch_permafrost.py`) |
| JAXA G-Portal | GCOM-C SGLI land surface temperature (day and night) → Soil trail "day-to-night swing" map (`pipeline/fetch_jaxa_lst.py`); AMSR2 soil moisture tested, not shown (see script) |

## Credits and sources

- **Measured terrain, thermal and mineral windows:** the measurement pipeline in `backend/` (parent folder), which measures terrain, thermal and mineral windows from Copernicus DEM GLO-30, LOLA and CTX DTMs, ECOSTRESS, MODIS/VIIRS albedo, EMIT, TES and Diviner. The Twin Score ranks those measurements.
- **Earth layers:** NASA GIBS (Blue Marble, MODIS LST and snow cover, MERRA-2 dust, ASTER GDEM), OSM land mask.
- **Mars layers:** Viking MDIM 2.1, MGS MOLA, MGS TES thermal inertia (Putzig et al. 2005) and dust cover index (Ruff & Christensen 2002), via NASA Mars Trek.
- **Moon layers:** LRO LROC WAC, LRO LOLA, Clementine FeO, Lunar Prospector hydrogen, LRO Diviner, via NASA Moon Trek.
- **Volcanoes:** Smithsonian Global Volcanism Program, Volcanoes of the World.
- **Sounds:** Perseverance microphone recordings (NASA/JPL-Caltech/LANL/CNES) and Apollo surface audio (NASA), public domain; Earth field recordings from Wikimedia Commons, with authors and licences in `public/data/sounds.json` and on screen. Silent Moon panels are silent on purpose: there is no air to carry sound.
- **Explore walks:** each 12 km walk is real elevation data (CTX DTMs for Gale and Jezero, LOLA for the Moon); the 120 km horizon around it comes from the NASA MOLA + ESA HRSC blended Mars DEM (200 m) and NASA LRO LOLA (`LDEM_75S` near the south pole, global LDEM elsewhere), fetched by `pipeline/fetch_far_terrain.py`. The look of the ground, sky and light follows published measurements: Curiosity and Perseverance sky colours and dust optical depth (Lemmon et al.), the Golombek and Rapp rock size model, lunar photometry (McEwen's lunar-Lambert law, opposition surge), Sun angles from the Apollo 16 surface journal and the south-pole illumination studies, and, for Jezero's storm, the January 2022 dust storm Perseverance watched (Lemmon et al. 2022), made about twice as thick. Pebbles, ripples, cracks and small craters are drawn by a shader; the shape of the land is the data.
- **Rover companion:** the little Perseverance hanging on a cable at the right edge is drawn from NASA's Perseverance 3D model (NASA-3D-Resources, public domain), with the model's own mast and arm animations, rendered by `pipeline/render_rover_sprite.py`.
- **Photos:** NASA Image and Video Library (public domain). The title, date and link for each photo are in `public/data/photos.json`. The Fayoum comparison also shows Curiosity's hill Bolívar and sand-ridges panorama, credited to NASA/JPL-Caltech/MSSS and sourced from [Phys.org](https://phys.org/news/2022-10-nasa-curiosity-mars-rover-long-awaited.html).

Earth-twin coordinates written by hand in `src/content.ts` are approximate, and the site says so. Nothing here identifies a safe landing or habitat site.
This is an independent student project, not affiliated with or endorsed by NASA, ESA or USGS.
