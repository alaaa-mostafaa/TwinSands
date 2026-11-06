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
| 01 | Meet Mars | Scroll story: drain Earth's oceans, spread the land over Mars (148.9 vs 144.4 million km²) |
| — | What Earth can't copy | Gravity, air pressure, radiation, day length on all three worlds |
| 02 | Twin Trails | Rust, Soil, Fire, Wind, Ice, South Pole: the same question on three globes, each with a real data layer |
| 03 | Twin Score | Ranks 469 measured Earth windows against 12 Mars/Moon sites on 7 axes, with radar, hillshades and the USGS answer key |
| 04 | Neighborhoods | 13 Mars and 10 Moon nicknames on a globe, each paired with an Earth twin globe |
| 05 | Field Guides | What matches, what doesn't, what to practise; data-backed cards show their radar |
| 06 | Boots on the Ground | Your Egypt field photos next to rover photos |

## Adding your field photos

Save photos as `public/field/<slot>.jpg`. The slots are `fayoum`, `pavement`, `concretion`, `wind`, `dustdevil` and `shadow` (prompts are in `src/content.ts`, `FIELD_PAIRS`).
Until a photo exists, the slot shows a drop zone; dropping a photo there only previews it in your browser.

## Data pipeline (Python, run once; outputs are committed in `public/`)

```bash
uv venv --python 3.12 .venv && uv pip install --python .venv/bin/python pillow numpy requests
.venv/bin/python pipeline/fetch_textures.py   # globe textures: NASA GIBS (Earth), Mars Trek, Moon Trek
.venv/bin/python pipeline/fetch_extras.py     # NASA photos, Smithsonian volcanoes, GIBS legends, land mask
.venv/bin/python pipeline/build_twins.py ../terrestrial-analog-finder-main   # Twin Score
```

**Twin Score method** (full text in `pipeline/build_twins.py` and on the site under "How the score works"):
for each axis, closeness = the share of Earth windows that are farther from the target.
The axes are relief, typical slope, steep slopes, roughness, hypsometry, thermal inertia (percentile within its own world) and key minerals (EMIT vs. published rover minerals).
An axis we could not measure counts as 50. It is a ranking aid, not a probability.

Findings worth putting in the proposal:
- **Moon south pole:** without being told, the scorer ranks Mauna Kea (site of NASA ISRU tests) 2nd–7th of 469 for most rim sites. The Transantarctic cells next to the McMurdo Dry Valleys are the top twin for 7 of 8 Artemis-region sites.
- **Mars:** the classic analogs (Atacama, Haughton, Death Valley) land mid-pack on terrain. Their value is chemistry and climate, which is the case for scoring more than landform.
  The best fully measured (7/7) twins are lesser-known places: an Afar/Danakil cell about 200 km from Dallol for Gale, and the Namib for Meridiani.

## Credits and sources

- **Measured terrain, thermal and mineral windows:** the Terrestrial Analog Finder project (Space Apps 2026). We reuse its published processed measurements (Copernicus DEM GLO-30, LOLA and CTX DTMs, ECOSTRESS, VIIRS, EMIT, TES, Diviner); the scoring code is ours. *Add their repository URL in `src/content.ts` (`SOURCES`) and in the proposal's literature review.*
- **Earth layers:** NASA GIBS (Blue Marble, MODIS LST and snow cover, MERRA-2 dust, ASTER GDEM), OSM land mask.
- **Mars layers:** Viking MDIM 2.1, MGS MOLA, MGS TES thermal inertia (Putzig et al. 2005) and dust cover index (Ruff & Christensen 2002), via NASA Mars Trek.
- **Moon layers:** LRO LROC WAC, LRO LOLA, Clementine FeO, Lunar Prospector hydrogen, LRO Diviner, via NASA Moon Trek.
- **Volcanoes:** Smithsonian Global Volcanism Program, Volcanoes of the World.
- **Photos:** NASA Image and Video Library (public domain). The title, date and link for each photo are in `public/data/photos.json`.

Earth-twin coordinates written by hand in `src/content.ts` are approximate, and the site says so. Nothing here identifies a safe landing or habitat site.
This is an independent student project, not affiliated with or endorsed by NASA, ESA or USGS.
