// All editorial content in one place. Facts carry a source; coordinates of Earth twins are
// approximate unless marked otherwise (we say so on screen).

export type WorldId = 'earth' | 'mars' | 'moon';
export type LatLon = [number, number];

export const WORLDS: Record<WorldId, {
  name: string; tagline: string; index: string; tex: string; glow: string; radiusKm: number;
  facts: { label: string; value: string[] }[];
}> = {
  earth: {
    name: 'Earth', tagline: 'The test bench', index: '01', tex: 'tex/earth_base.webp', glow: '#6fb6ff', radiusKm: 6371,
    facts: [
      { label: 'Atmosphere', value: ['78% N₂', '21% O₂'] },
      { label: 'Climate', value: ['Average surface', 'about 15 °C'] },
      { label: 'Gravity', value: ['9.81 m/s²'] },
      { label: 'Moons', value: ['The Moon'] },
      { label: 'Radius', value: ['6,371 km'] },
      { label: 'Orbit', value: ['365.25 days'] },
    ],
  },
  mars: {
    name: 'Mars', tagline: 'Red planet', index: '02', tex: 'tex/mars_base.webp', glow: '#ff9a6a', radiusKm: 3389.5,
    facts: [
      { label: 'Atmosphere', value: ['95% CO₂', '2.6% N₂ · 1.9% Ar'] },
      { label: 'Climate', value: ['Average surface', 'about −63 °C'] },
      { label: 'Gravity', value: ['3.71 m/s²'] },
      { label: 'Moons', value: ['Phobos', 'Deimos'] },
      { label: 'Radius', value: ['3,390 km'] },
      { label: 'Orbit', value: ['687 days'] },
    ],
  },
  moon: {
    name: 'Moon', tagline: 'Next door', index: '03', tex: 'tex/moon_base.webp', glow: '#c9d4ff', radiusKm: 1737.4,
    facts: [
      { label: 'Atmosphere', value: ['Almost none', 'a thin exosphere'] },
      { label: 'Climate', value: ['+120 °C day', '−130 °C night'] },
      { label: 'Gravity', value: ['1.62 m/s²'] },
      { label: 'Day', value: ['29.5 Earth days', 'sunrise to sunrise'] },
      { label: 'Radius', value: ['1,737 km'] },
      { label: 'Orbit', value: ['27.3 days', 'around Earth'] },
    ],
  },
};

// ---------------------------------------------------------------- Twin Trails
export type Layer = { tex: string; title: string; source: string; legend?: { svg?: string; low: string; high: string; colors?: string } };
export type Pin = { name: string; at: LatLon; note?: string; tone?: 'target' | 'twin' | 'new' };
export type Trail = {
  id: string; title: string; kicker: string; question: string; summary: string;
  earth: Layer & { pins: Pin[]; points?: 'volcanoes' | 'iron' };
  mars: (Layer & { pins: Pin[] }) | null;
  moon: (Layer & { pins: Pin[] }) | null;
  emptyMoon?: string; emptyMars?: string;
  photos: string[];
  evidence: { label: string; url: string }[];
  breaks: string;
  scoreTarget?: string;
};

const SPECTRUM = 'linear-gradient(90deg,#3b0fa8,#1d4fd8,#1fb7c9,#3bd16f,#e6e33a,#f08a24,#d7261e)';

export const TRAILS: Trail[] = [
  {
    id: 'rust', title: 'Rust', kicker: 'Iron and minerals',
    question: 'Where does iron turn red, and what did water have to do with it?',
    summary: 'Opportunity landed on plains strewn with hematite "blueberries", grey iron-oxide balls that grew in groundwater. On Earth, acid, iron-rich water still builds the same minerals today.',
    earth: { tex: 'tex/earth_base.webp', title: 'Iron oxides seen by EMIT', source: 'NASA EMIT mineral classes per 12 km window (via Terrestrial Analog Finder) on Blue Marble', pins: [
      { name: 'Río Tinto, Spain', at: [37.69, -6.59], tone: 'twin', note: 'acid iron river' },
      { name: 'Bahariya Oasis, Egypt', at: [28.35, 28.86], tone: 'new', note: 'ferricretes, little studied' },
      { name: 'Dallol, Ethiopia', at: [14.24, 40.3], tone: 'twin' },
      { name: 'Moqui marbles, Utah', at: [37.4, -111.6], tone: 'twin' },
    ], points: 'iron' },
    mars: { tex: 'tex/mars_base.webp', title: 'Viking colour mosaic', source: 'Viking MDIM 2.1 colour mosaic, NASA/USGS via Mars Trek', pins: [
      { name: 'Meridiani Planum', at: [-1.95, -5.53], tone: 'target', note: 'Opportunity, hematite' },
      { name: 'Gale crater', at: [-5.4, 137.8], tone: 'target', note: 'hematite on Vera Rubin ridge' },
    ] },
    moon: { tex: 'tex/moon_feo.webp', title: 'Iron oxide (FeO) weight percent', source: 'Clementine UVVIS FeO, via Moon Trek', legend: { low: 'less iron', high: 'more iron', colors: SPECTRUM }, pins: [
      { name: 'Mare Imbrium', at: [32.8, -15.6], tone: 'target' },
    ] },
    photos: ['mars_berries', 'mars_opportunity_shadow'],
    evidence: [
      { label: 'NASA Earth Observatory: Spain’s Stained River (Río Tinto)', url: 'https://earthobservatory.nasa.gov/images/147459/spains-stained-river' },
      { label: 'LPSC 2018: Ferricretes of the Bahariya Oasis (Salvatore, Tanner, Edwards)', url: 'https://ui.adsabs.harvard.edu/abs/2018LPI....49.1266S/abstract' },
      { label: 'Cavalazzi et al. 2019: Dallol, an exceptional planetary field analog (Astrobiology)', url: 'https://doi.org/10.1089/ast.2018.1926' },
    ],
    breaks: 'Mars’s liquid water is long gone and its air has almost no oxygen. On Earth, life helps make and break iron minerals; on Mars, chemistry did it alone.',
    scoreTarget: 'mars-meridiani',
  },
  {
    id: 'soil', title: 'Soil', kicker: 'What the ground is made of',
    question: 'Is the ground dust, sand or bare rock? Heat tells us.',
    summary: 'Fine dust heats fast by day and cools fast at night. Rock holds its heat. Measuring that day–night swing (thermal inertia) tells rovers where the ground is soft and where it is solid, on any world.',
    earth: { tex: 'tex/earth_tswing.webp', title: 'Day-to-night temperature swing, July 2025', source: 'JAXA GCOM-C SGLI land surface temperature (G-Portal product, via JAXA Earth API)', legend: { low: 'small swing', high: '30+ °C swing', colors: 'linear-gradient(90deg,#1f4d8c,#598c8c,#e6b366,#d96126,#a61f14)' }, pins: [
      { name: 'Mojave basalt (MMS simulant)', at: [35.0, -117.8], tone: 'twin' },
      { name: 'Mauna Kea saddle (JSC Mars-1)', at: [19.75, -155.45], tone: 'twin' },
    ] },
    mars: { tex: 'tex/mars_ti.webp', title: 'Thermal inertia', source: 'MGS TES, Putzig et al. 2005, via Mars Trek', legend: { low: 'fine dust', high: 'rock, crust', colors: SPECTRUM }, pins: [
      { name: 'Gale crater (Rocknest)', at: [-4.59, 137.44], tone: 'target' },
    ] },
    moon: { tex: 'tex/moon_rock.webp', title: 'Rock abundance', source: 'LRO Diviner, Bandfield et al., via Moon Trek', legend: { low: 'fine regolith', high: 'more rocks' }, pins: [
      { name: 'Tycho', at: [-43.3, -11.2], tone: 'target', note: 'young, rocky' },
    ] },
    photos: ['mars_rocknest', 'mars_phoenix_soil'],
    evidence: [
      { label: 'Martian regolith simulants (overview)', url: 'https://en.wikipedia.org/wiki/Martian_regolith_simulant' },
      { label: 'Putzig et al. 2005, global thermal inertia of Mars', url: 'https://doi.org/10.1016/j.icarus.2004.08.017' },
    ],
    breaks: 'Mars soil holds perchlorate salts that are toxic to people; Earth soil does not. Earth soil is full of life and organics, which Mars soil lacks.',
  },
  {
    id: 'fire', title: 'Fire', kicker: 'Volcanoes and lava tubes',
    question: 'Where could astronauts shelter underground?',
    summary: 'Lava tubes are tunnels left when molten rock drains away. Orbiters have spotted dark "skylights" on Mars and the Moon that may open into them. Earth has walkable ones.',
    earth: { tex: 'tex/earth_relief.webp', title: 'Elevation and 1,214 Holocene volcanoes', source: 'ASTER GDEM via GIBS; Smithsonian Global Volcanism Program', legend: { svg: 'legends/earth_relief.png', low: 'low', high: 'high' }, pins: [
      { name: 'Lanzarote, Spain', at: [29.16, -13.44], tone: 'twin', note: 'ESA cave training' },
      { name: 'Umm Jirsan, Saudi Arabia', at: [25.59, 39.67], tone: 'new', note: 'lava tube, 1.48 km' },
      { name: 'Hawaiʻi shield volcanoes', at: [19.48, -155.6], tone: 'twin' },
    ], points: 'volcanoes' },
    mars: { tex: 'tex/mars_mola.webp', title: 'Elevation', source: 'MGS MOLA colour hillshade, via Mars Trek', legend: { low: 'low', high: 'high', colors: 'linear-gradient(90deg,#1b2a8a,#2c7fd6,#3fc7a5,#c6e04a,#f0a43a,#c4573a,#ffffff)' }, pins: [
      { name: 'Olympus Mons', at: [18.65, -133.8], tone: 'target' },
      { name: 'Arsia Mons skylights', at: [-8.26, -120.09], tone: 'target' },
    ] },
    moon: { tex: 'tex/moon_base.webp', title: 'LROC global mosaic', source: 'LRO LROC WAC, via Moon Trek', pins: [
      { name: 'Marius Hills pit', at: [14.09, -56.78], tone: 'target' },
      { name: 'Mare Tranquillitatis pit', at: [8.34, 33.22], tone: 'target' },
      { name: 'Mare Ingenii pit', at: [-35.95, 166.06], tone: 'target' },
    ] },
    photos: ['mars_skylights', 'moon_marius_pit', 'earth_lanzarote'],
    evidence: [
      { label: 'NASA: Seven possible cave skylights on Mars', url: 'https://photojournal.jpl.nasa.gov/catalog/PIA09929' },
      { label: 'Universe Today: Moon and Mars lava tubes big enough for a base (Sauro et al. 2020)', url: 'https://www.universetoday.com/147360/lava-tubes-on-the-moon-and-mars-are-really-really-big-big-enough-to-fit-an-entire-planetary-base' },
      { label: 'Live Science: people lived in the Umm Jirsan lava tube 7,000 years ago', url: 'https://www.livescience.com/archaeology/humans-were-living-in-a-lava-tube-7000-years-ago-on-the-arabian-peninsula' },
    ],
    breaks: 'Lower gravity lets lava tubes on Mars and the Moon grow far wider than any on Earth, possibly hundreds of metres across.',
  },
  {
    id: 'wind', title: 'Wind', kicker: 'Dust storms and dust devils',
    question: 'Where does dust rule the sky, and what does it do to machines?',
    summary: 'Dust ended Opportunity’s mission in 2018 by blotting out the Sun. Spirit was kept alive by dust devils that wiped its solar panels clean. The Sahara and Egypt’s Khamsin winds move dust the same way, just faster.',
    earth: { tex: 'tex/earth_dust.webp', title: 'Surface dust, June 2024', source: 'MERRA-2 dust surface mass concentration via NASA GIBS', legend: { svg: 'legends/earth_dust.png', low: 'clear', high: 'dusty' }, pins: [
      { name: 'White Desert, Egypt', at: [27.36, 28.17], tone: 'new', note: 'wind-carved chalk' },
      { name: 'Turpan Depression, China', at: [42.7, 89.2], tone: 'twin' },
      { name: 'Qaidam yardangs, China', at: [38.3, 92.3], tone: 'twin' },
    ] },
    mars: { tex: 'tex/mars_dust.webp', title: 'Dust cover index', source: 'MGS TES, Ruff & Christensen 2002, via Mars Trek', legend: { low: 'dust-free', high: 'dusty', colors: 'linear-gradient(90deg,#3b0fa8,#1d4fd8,#1fb7c9,#3bd16f,#e6e33a,#f08a24,#d7261e)' }, pins: [
      { name: 'Medusae Fossae', at: [-5, -147], tone: 'target', note: 'yardangs' },
      { name: 'Arabia Terra', at: [22.8, 5], tone: 'target', note: 'thick dust' },
    ] },
    moon: null,
    emptyMoon: 'No air, no wind. Moon dust is moved by meteorite impacts and static charge, and stays sharp-edged because nothing weathers it.',
    photos: ['mars_dust_devil_hirise', 'mars_yardangs', 'mars_dust_storm'],
    evidence: [
      { label: 'Astronomy: a Mars dust devil whisks Spirit clean (2005)', url: 'https://www.astronomy.com/space-exploration/mars-dust-devil-whisks-spirit-clean/' },
      { label: 'Ruff & Christensen 2002: the TES dust cover index', url: 'https://www.mars.asu.edu/~ruff/DCI/dci.html' },
    ],
    breaks: 'Mars air is about 1% as dense as Earth’s, so even fast wind pushes weakly; yet fine dust can still circle the whole planet in a global storm.',
  },
  {
    id: 'ice', title: 'Water', kicker: 'Water and ice',
    question: 'Where is the water astronauts will need?',
    summary: 'Under Mars’s mid-latitudes lies ice, sometimes just centimetres down. Phoenix scraped it up in 2008 and watched it vanish into the thin air. At the lunar poles, hydrogen hints at ice hiding in the cold.',
    earth: { tex: 'tex/earth_permafrost.webp', title: 'Permanently frozen ground (permafrost), 2019', source: 'ESA CCI Permafrost, found via the ESA Open Science Catalog', legend: { low: 'none', high: '100% frozen', colors: 'linear-gradient(90deg,#8cc7f2,#4a8ce6,#1a40bf)' }, pins: [
      { name: 'McMurdo Dry Valleys', at: [-77.52, 161.85], tone: 'twin', note: 'cold, dry, ground ice' },
      { name: 'Qaidam Basin, China', at: [37.5, 94.0], tone: 'twin' },
    ] },
    mars: { tex: 'tex/mars_water.webp', title: 'Water in the top metre of soil', source: 'NASA Mars Odyssey Gamma Ray Spectrometer, H₂O weight %, NASA Planetary Data System (grey: not measured, under seasonal frost)', legend: { low: '2% water', high: '8%', colors: 'linear-gradient(90deg,#8c331a,#cc7a40,#59a6c7,#1f66e0,#0d26b3)' }, pins: [
      { name: 'Arcadia Planitia', at: [46.7, -170], tone: 'target', note: 'shallow buried ice' },
      { name: 'Phoenix landing site', at: [68.22, -125.75], tone: 'target' },
    ] },
    moon: { tex: 'tex/moon_h.webp', title: 'Hydrogen in the top metre', source: 'Lunar Prospector neutron spectrometer, via Moon Trek', legend: { low: 'less', high: 'more hydrogen' }, pins: [
      { name: 'Shackleton', at: [-89.67, 129.78], tone: 'target' },
    ] },
    photos: ['mars_ice_scarp', 'mars_phoenix_ice', 'earth_dry_valleys'],
    evidence: [
      { label: 'PSI: SWIM project maps buried ice', url: 'https://swim.psi.edu/' },
      { label: 'JPL: NASA’s treasure map for water ice on Mars', url: 'https://www.jpl.nasa.gov/news/nasas-treasure-map-for-water-ice-on-mars' },
    ],
    breaks: 'Mars ice sits in near-vacuum and deeper cold, so exposed ice turns straight to vapour instead of melting.',
  },
  {
    id: 'pole', title: 'South Pole', kicker: 'Ice in shadow, ridges in sunlight',
    question: 'Where will Artemis astronauts walk?',
    summary: 'At the lunar south pole the Sun never rises far above the horizon. Some ridges stay lit for most of the year, while crater floors beside them have not seen sunlight in billions of years and trap ice. Our scorer finds Earth terrain shaped like those ridges.',
    earth: { tex: 'tex/earth_base.webp', title: 'High-latitude terrain twins', source: 'Blue Marble; twins from our Twin Score on Copernicus DEM', pins: [
      { name: 'Transantarctic Mts (near the Dry Valleys)', at: [-77.5, 163.5], tone: 'twin', note: 'top twin for 7 of 8 Artemis-region sites' },
      { name: 'Mauna Kea, Hawaiʻi', at: [19.82, -155.47], tone: 'twin', note: 'NASA ISRU tests 2008, 2010' },
      { name: 'Devon Island (Haughton)', at: [75.38, -89.68], tone: 'twin', note: 'sun skims the horizon' },
    ] },
    mars: null,
    emptyMars: 'This chapter is all Moon.',
    moon: { tex: 'tex/moon_lola.webp', title: 'Elevation around the pole', source: 'LRO LOLA colour hillshade, via Moon Trek', legend: { low: 'low', high: 'high', colors: 'linear-gradient(90deg,#3a2a8f,#2c7fd6,#3fc7a5,#c6e04a,#f0a43a,#c4573a,#ffffff)' }, pins: [] },
    photos: ['moon_south_pole', 'moon_apollo17'],
    evidence: [
      { label: 'Space.com: NASA’s 9 candidate Artemis III landing regions', url: 'https://www.space.com/space-exploration/artemis/nasa-announces-9-possible-moon-landing-sites-for-artemis-3-lunar-mission' },
      { label: 'Supercluster: Artemis astronauts find a lunar analog in Mistastin crater', url: 'https://supercluster.com/editorial/artemis-astronauts-find-lunar-analog-in-meteorite-impact-crater' },
    ],
    breaks: 'No air, one-sixth gravity, and shadows colder than anywhere on Earth: shadowed craters dip below −230 °C.',
    scoreTarget: 'moon-shackleton-rim',
  },
];

// ---------------------------------------------------------------- Target nicknames for Twin Score
export const TARGET_NICK: Record<string, string> = {
  'mars-gale': 'Gale crater', 'mars-jezero': 'Jezero crater', 'mars-meridiani': 'Meridiani Planum',
  'mars-utopia-zhurong': 'Utopia Planitia', 'moon-connecting-ridge': 'Connecting ridge',
  'moon-de-gerlache-rim': 'de Gerlache rim', 'moon-haworth': 'Haworth',
  'moon-leibnitz-beta-plateau': 'Leibnitz β plateau', 'moon-malapert-massif': 'Malapert massif',
  'moon-nobile-rim-1': 'Nobile rim', 'moon-peak-near-shackleton': 'Peak near Shackleton',
  'moon-shackleton-rim': 'Shackleton rim',
};

export const REGION_NAME: Record<string, string> = {
  afar: 'Afar / Danakil, Ethiopia', namib: 'Namib, Namibia', sahara: 'Sahara', 'us-southwest': 'US Southwest',
  'tibet-qaidam': 'Tibet / Qaidam, China', 'canadian-arctic': 'Canadian Arctic', transantarctic: 'Transantarctic Mts, Antarctica',
  'atacama-altiplano': 'Atacama / Altiplano', 'australia-interior': 'Australian interior', gobi: 'Gobi, Mongolia',
  iceland: 'Iceland', arabia: 'Arabian Peninsula',
};

// ---------------------------------------------------------------- Boots on the ground
export const FIELD_PAIRS: { slot: string; prompt: string; rover: string; caption: string }[] = [
  { slot: 'fayoum', prompt: 'Fayoum: old lake shoreline or layered lake sediment', rover: 'mars_jezero_delta', caption: 'Perseverance: Jezero delta' },
  { slot: 'pavement', prompt: 'Desert pavement or a scoop of sand', rover: 'mars_rocknest', caption: 'Curiosity at Rocknest' },
  { slot: 'deserts', prompt: 'Egyptian deserts', rover: 'mars_namib_dune', caption: 'Curiosity at Namib Dune, a Mars desert' },
  { slot: 'wind', prompt: 'Wind-carved rock or ripples', rover: 'mars_yardangs', caption: 'HiRISE: yardangs' },
  { slot: 'dustdevil', prompt: 'A dust devil or dust plume', rover: 'mars_dust_devil', caption: 'Spirit: dust devil, sol 446' },
  { slot: 'shadow', prompt: 'Your team’s shadow on the ground', rover: 'mars_opportunity_shadow', caption: 'Opportunity’s shadow, sol 180' },
];

export const SOURCES: { group: string; items: { label: string; url: string }[] }[] = [
  { group: 'Earth', items: [
    { label: 'NASA GIBS: Blue Marble, MODIS LST and snow cover, MERRA-2 dust, ASTER GDEM', url: 'https://nasa-gibs.github.io/gibs-api-docs/' },
    { label: 'Smithsonian Global Volcanism Program, Volcanoes of the World', url: 'https://volcano.si.edu/' },
    { label: 'NASA EMIT minerals, ECOSTRESS LST, VIIRS albedo (processed by Terrestrial Analog Finder)', url: 'https://earth.jpl.nasa.gov/emit/' },
    { label: 'Copernicus DEM GLO-30 (ESA), terrain windows', url: 'https://registry.opendata.aws/copernicus-dem/' },
  ] },
  { group: 'Mars', items: [
    { label: 'NASA Mars Trek: Viking MDIM 2.1, MOLA, TES thermal inertia & dust', url: 'https://trek.nasa.gov/mars/' },
    { label: 'USGS Astrogeology CTX DTMs (analysis-ready data)', url: 'https://stac.astrogeology.usgs.gov/' },
  ] },
  { group: 'Moon', items: [
    { label: 'NASA Moon Trek: LROC WAC, LOLA, Clementine FeO, Lunar Prospector H, Diviner', url: 'https://trek.nasa.gov/moon/' },
    { label: 'Barker et al. LOLA south-polar DTMs (USGS analysis-ready data)', url: 'https://stac.astrogeology.usgs.gov/' },
  ] },
  { group: 'Images and prior work', items: [
    { label: 'NASA Image and Video Library (public domain)', url: 'https://images.nasa.gov/' },
    { label: 'Terrestrial Analog Finder (Space Apps 2026): the measured terrain, thermal and mineral windows our Twin Score ranks', url: '' },
    { label: 'USGS: Known Terrestrial Analog Sites for Planetary Science (Hunter 2020)', url: 'https://www.usgs.gov/data/known-terrestrial-analog-sites-planetary-science' },
  ] },
];

// Everyday names for the Twin Score axes (the data keeps the technical ones).
export const PLAIN: Record<string, string> = {
  Relief: 'Height range', 'Typical slope': 'Slopes', 'Steep slopes': 'Steep parts', Roughness: 'Bumpiness',
  Hypsometry: 'Hills or plains', 'Thermal inertia': 'Sand or rock', Minerals: 'Minerals', Dust: 'Dust', Ice: 'Ice', Sunlight: 'Sunlight',
};
export const plain = (a: string) => PLAIN[a] ?? a;

// ---------------------------------------------------------------- Sounds for Twin Trails
// file = public/sounds/<file>.mp3 (credits in public/data/sounds.json). No file = silence, on purpose.
export type Snd = { file?: string; what: string };
export const SOUNDS: Record<string, Partial<Record<WorldId, Snd>>> = {
  rust: {
    earth: { file: 'earth_stream', what: 'A mountain stream. Río Tinto flows just like this, only blood-red and acid.' },
    mars: { file: 'mars_laser', what: 'Perseverance’s laser zapping a rock to read its minerals, March 2021. A real Mars microphone.' },
  },
  soil: {
    earth: { file: 'earth_gravel', what: 'Footsteps on gravel.' },
    mars: { file: 'mars_drive', what: 'Perseverance’s wheels crunching across Jezero crater, 2021.' },
    moon: { file: 'moon_small_step', what: 'Neil Armstrong’s first step into lunar soil, 1969.' },
  },
  fire: {
    earth: { file: 'earth_st_helens', what: 'Mount St. Helens erupting in 1980, heard 225 km away (amplified).' },
    mars: { file: 'mars_moxie', what: 'MOXIE heating Mars air to about 800 °C to make oxygen, a first on another planet.' },
    moon: { what: 'Silence. The Moon’s volcanoes went quiet long ago, and there is no air to carry sound.' },
  },
  wind: {
    earth: { file: 'earth_storm_wind', what: 'A 25 m/s storm wind in a Swedish forest.' },
    mars: { file: 'mars_dustdevil', what: 'A real dust devil passing over Perseverance, 2021: the first ever heard on Mars.' },
  },
  ice: {
    earth: { file: 'earth_ice_crack', what: 'Ice cracking on a frozen lake.' },
    mars: { file: 'mars_wind', what: 'Wind at Jezero crater. No microphone has reached Mars’s icy plains yet.' },
    moon: { what: 'Silence. The ice hides in craters colder than −230 °C, where no sound can travel.' },
  },
  pole: {
    earth: { file: 'earth_arctic_night', what: 'Polar night in Arctic Sweden: wind and snow.' },
    moon: { what: 'Silence. With no air, astronauts at the south pole will only hear each other by radio.' },
  },
};

// ---------------------------------------------------------------- Senses for Twin Trails
// see: photo keys (public/photos) · smell: object cut-outs (public/senses) + one line · feel: one big word or number.
// Smell sources: Apollo crews on moon dust (spent gunpowder; Schmitt's "lunar hay fever"); Curiosity's SAM found
// hydrogen sulfide from heated Mars rock; "sunbaked sulfur and chalk" (Scientific American / Space.com, 2016);
// LCROSS (2009) found ammonia and hydrogen sulfide with the ice in Cabeus; astronauts describe spacewalk suits as
// smelling of seared steak, hot metal and welding fumes. Feel: lunar pit ~17 °C (Horvath et al. 2022).
export type Sense = { see: string[]; smell: { items: string[]; text: string }; feel: { big: string; small: string; img?: string; then?: number; now?: number } };
export const SENSES: Record<string, Partial<Record<WorldId, Sense>>> = {
  rust: {
    earth: { see: ['earth_rio_tinto', 'pc_moqui'], smell: { items: ['coins', 'match'], text: 'Old coins and a whiff of sulfur' }, feel: { big: 'pH 2', small: 'acid water that stings like lemon juice', img: 'lemon' } },
    mars: { see: ['mars_berries', 'mars_opportunity_shadow'], smell: { items: ['egg'], text: 'Rotten eggs: heated Mars rock gave off hydrogen sulfide' }, feel: { big: 'Magnetic', small: 'the red dust sticks to magnets: rovers carried some to catch it', img: 'magnet' } },
  },
  soil: {
    earth: { see: ['pc_lanzarote_plain', 'earth_salar_atacama'], smell: { items: ['rain'], text: 'Rain on dry dirt' }, feel: { big: 'Soft', small: 'black volcanic sand that shifts underfoot', img: 'sand' } },
    mars: { see: ['mars_rocknest', 'mars_phoenix_soil'], smell: { items: ['match', 'chalk'], text: 'Sunbaked sulfur and chalk' }, feel: { big: 'Sticky', small: 'fine dust clings to wheels and suits', img: 'velcro' } },
    moon: { see: ['moon_bootprint', 'moon_apollo17'], smell: { items: ['sneeze'], text: 'Moon dust gave Harrison Schmitt hay fever' }, feel: { big: 'Sharp', small: 'dust edged like broken glass', img: 'glass' } },
  },
  fire: {
    earth: { see: ['pc_pahoehoe', 'pc_lava_tube'], smell: { items: ['match'], text: 'A just-struck match: sulfur dioxide from the hot lava' }, feel: { big: '1,150 °C', small: 'fresh Hawaiian lava' } },
    mars: { see: ['mars_olympus', 'mars_skylights'], smell: { items: ['soda'], text: 'Nothing: the air is 95% CO₂, the fizz in soda' }, feel: { big: '', small: 'Its lava, long ago, vs the cold rock today', then: 1200, now: -63 } },
    moon: { see: ['moon_marius_pit', 'pc_procellarum'], smell: { items: ['weld'], text: 'Hot metal and welding fumes: what astronauts smell on their suits after a spacewalk' }, feel: { big: '', small: 'Its lava, 3+ billion years ago, vs a lunar night today', then: 1200, now: -130 } },
  },
  wind: {
    earth: { see: ['pc_white_desert', 'pc_sandstorm'], smell: { items: ['sandpile'], text: 'Hot, dry, earthy dust in the air' }, feel: { big: '100 km/h', small: 'a desert storm that stings your face', img: 'windsock' } },
    mars: { see: ['mars_dust_devil_hirise', 'mars_yardangs'], smell: { items: ['chalk'], text: 'A clapped chalkboard eraser' }, feel: { big: 'Gentle', small: 'even 100 km/h feels like a breeze in air this thin', img: 'feather' } },
  },
  ice: {
    earth: { see: ['pc_wright_valley', 'earth_dry_valleys'], smell: { items: ['ice'], text: 'Almost nothing: air this cold and dry barely smells' }, feel: { big: '−20 °C', small: 'yearly average in the Dry Valleys' } },
    mars: { see: ['mars_ice_scarp', 'mars_phoenix_ice'], smell: { items: ['cleaner'], text: 'Bleach-like salt: Phoenix found perchlorate in icy soil' }, feel: { big: '−60 °C', small: 'ice a few centimetres under the dust' } },
    moon: { see: ['moon_south_pole'], smell: { items: ['egg', 'cleaner'], text: 'Rotten eggs and ammonia: LCROSS found both with the ice' }, feel: { big: '−230 °C', small: 'shadowed crater floors' } },
  },
  pole: {
    earth: { see: ['pc_transantarctic', 'earth_dry_valleys'], smell: { items: ['snow'], text: 'Cold, clean nothing' }, feel: { big: '−50 °C', small: 'Antarctic winter wind' } },
    moon: { see: ['moon_south_pole', 'pc_spa'], smell: { items: ['sparkler'], text: 'Spent gunpowder: the Moon dust astronauts carry back inside' }, feel: { big: '−133 °C', small: 'sunny ridge, yearly average (Diviner model)' } },
  },
};

// ---------------------------------------------------------------- "See": one annotated photo per world
// Coordinates are in the photo's own pixels (w × h), so marks land on the right spot however the photo is cropped.
export type Mark =
  | { t: 'ring'; x: number; y: number; r: number; label: string; sub?: string }
  | { t: 'ruler'; x1: number; y1: number; x2: number; y2: number; label: string };
export type Shot = { img: string; w: number; h: number; marks: Mark[]; line: string };
export const SEE: Record<string, Partial<Record<WorldId, Shot>>> = {
  rust: {
    // Moqui marble cracked open: iron-oxide shell around plain sandstone (photo: Steve Jurvetson, CC BY 2.0)
    earth: { img: 'earth_moqui_inside', w: 1600, h: 1154, line: 'Rust only coats the outside.', marks: [
      { t: 'ring', x: 470, y: 470, r: 140, label: 'Plain sand inside' },
      { t: 'ring', x: 520, y: 860, r: 62, label: 'Iron-oxide shell', sub: 'hematite + goethite' },
    ] },
    // Curiosity's first drill hole, John Klein, Gale crater, 2013. NASA: the hole is 1.6 cm wide.
    mars: { img: 'mars_drill', w: 1563, h: 1143, line: 'Red on the surface, grey inside.', marks: [
      { t: 'ring', x: 430, y: 300, r: 90, label: 'Rusty red skin', sub: 'iron-oxide dust' },
      { t: 'ring', x: 1110, y: 760, r: 85, label: 'Grey rock inside' },
      { t: 'ruler', x1: 730, y1: 585, x2: 893, y2: 585, label: '1.6 cm' },
    ] },
    // Apollo 11 bootprint, 1969
    moon: { img: 'moon_bootprint', w: 1400, h: 1400, line: 'No water, no air: Moon iron never rusts.', marks: [
      { t: 'ring', x: 744, y: 905, r: 270, label: 'Grey all the way', sub: 'no rust anywhere' },
    ] },
  },
};

// ---------------------------------------------------------------- Trail stories ("See" for a trail with a story)
// Sources: Río Tinto pH ≈ 2.3 and dissolved iron up to ~20 g/L (NASA Astrobiology; Amaral-Zettler et al. 2002, Nature);
// NASA MARTE drilling at Río Tinto 2003–2005 (Stoker et al.; Cannon et al. 2008, Astrobiology);
// Gusev soil ~16 wt% iron oxide (Spirit APXS); Earth's continental crust ~7 wt% FeO (Rudnick & Gao 2003);
// red dust as ferrihydrite (Valantinas et al. 2025, Nature Communications).
export type MeterSpec = { title: string; value: string; level: number; tick?: number; tickLabel?: string };
export type StoryPhoto = { img: string; w: number; h: number; place: string; contain?: boolean };
/** One photo in a story step. `then` shows first, then dissolves into the photo (with a time badge). */
export type Pane = { world: WorldId; photo: StoryPhoto; marks: Mark[]; meter?: MeterSpec; globe?: 'earth-winds' | 'mars-winds';
  then?: { photo: StoryPhoto; when: string; note: string }; now?: string };
export type StoryStep = {
  title: string; line: string; earth: Mark[]; mars: Mark[]; moon?: boolean;
  earthPhoto?: StoryPhoto;                                  // swap the Earth photo for this step
  panes?: Pane[];                                           // full control: any two worlds, then→now dissolves
  meters?: Partial<Record<'earth' | 'mars', MeterSpec>>;    // vertical meter rising on a photo
};
// Río Tinto iron on a log scale 0.0001–100 g/L, so 20 g/L and a normal river (~0.001 g/L) both fit.
const logPos = (v: number) => (Math.log10(v) + 4) / 6;
export type Story = {
  earth: StoryPhoto;
  mars: StoryPhoto;
  steps: StoryStep[];
  narration?: string[];
};

// ---------------------------------------------------------------- Plain-language map guide (Twin Trails, Map mode)
// One line under each globe: what the colours or dots mean. Plus one line per trail: why the three maps differ.
export const MAP_READ: Record<string, Partial<Record<WorldId, string>>> = {
  rust: {
    earth: 'Orange dots: places where NASA’s EMIT instrument on the space station found iron-rust minerals in the ground.',
    mars: 'Real colours from the Viking orbiters. The whole planet is orange-red because its dust is rusted iron.',
    moon: 'Red = more iron in the soil. The dark “seas” you see from Earth are the iron-rich parts. None of it rusts: no water, no air.',
  },
  soil: {
    earth: 'Red = ground that heats up a lot by day and cools a lot by night (dry, bare deserts). Blue = it barely changes (wet or green land).',
    mars: 'Purple and blue = soft fine dust, red = hard rock and crust. Rovers want to avoid the deep dust.',
    moon: 'Blue = smooth fine powder, brighter = more rocks lying on the surface.',
  },
  fire: {
    earth: 'Red dots: the 1,214 volcanoes that erupted in the last ~12,000 years. Colours show land height: green low, brown and white high.',
    mars: 'Colours show height: blue = low, red and white = high. The white peaks on the left are giant volcanoes, Olympus Mons the tallest.',
    moon: 'A real photo mosaic. The dark patches are old lava that flooded giant craters 3–4 billion years ago.',
  },
  wind: {
    earth: 'Brighter yellow-red = more dust in the air near the ground. The big blob over Africa is dust blowing off the Sahara.',
    mars: 'Red = ground covered in fine dust, blue = dust-free rock. On Mars, dust storms can hide the whole planet.',
  },
  ice: {
    earth: 'Blue = ground that stays frozen all year (permafrost). Darker blue = more of the land is frozen.',
    mars: 'Blue = more water hidden in the top metre of soil (as ice or wet minerals), orange = drier. Grey = not measured, near the poles.',
    moon: 'Bright = more hydrogen in the soil. Hydrogen is the clue: where it collects at the poles, there may be ice.',
  },
  pole: {
    earth: 'The pins are the Earth places our Twin Score found most like the lunar south pole: icy, rocky mountains near the poles.',
    moon: 'Colours show height around the south pole: blue low, red and white high. The pins are possible Artemis landing areas.',
  },
};
export const MAP_COMPARE: Record<string, string> = {
  rust: 'Each world was measured with a different tool, so the colours aren’t one shared scale. Compare where iron shows up, not the exact shade.',
  soil: 'Different instruments on each world, so no shared scale. The idea is the same though: soft dust vs hard rock.',
  fire: 'Earth shows its young volcanoes, Mars its height, the Moon a photo of its old lava. Each one shows where fire shaped the ground.',
  wind: 'The Moon has no air, so no wind and no map. Earth shows dust in the air, Mars dust lying on the ground.',
  ice: 'Water is measured differently on each world: frozen ground on Earth, water in the soil on Mars, hydrogen on the Moon. Look for where it gathers.',
  pole: 'This trail is all about the Moon’s south pole and its closest Earth twins. Mars isn’t part of it.',
};

export const STORIES: Record<string, Story> = {
  // Sources: Phoenix found shallow ground ice in 2008; bright chunks in the Dodo-Goldilocks trench sublimated within ~4 sols
  // (NASA/JPL/UA). Ice-exposing scarps: Dundas et al. 2018, Science; NASA PIA22077 (ice from 1–2 m down, 100+ m thick).
  // Mars north polar layered deposits up to ~3 km thick, spiral troughs shaped by katabatic winds; Greenland ice sheet up to
  // ~3 km thick. Dry Valleys: ice-cemented ground under dry soil; their lakes keep liquid water under year-round ice.
  // Lunar polar ice in permanently shadowed craters: LRO, LCROSS (2009), Chandrayaan-1 M3 (Li et al. 2018, PNAS).
  ice: {
    earth: { img: 'earth_dry_valleys', w: 1260, h: 1400, place: 'Dry Valleys, Antarctica' },
    mars: { img: 'mars_phoenix_ice', w: 512, h: 1024, place: 'Phoenix trench, Mars 2008' },
    narration: [
      'sounds/water/s1.opus',
      'sounds/water/s2.opus',
      'sounds/water/s_radar.opus',   // step 3, Seeing in the dark (RADARSAT-1 at Haughton)
      'sounds/water/s3.opus',
      'sounds/water/s4.opus',
      'sounds/water/s5.opus',
    ],
    steps: [
      { title: 'Ice under the dust', line: 'In 2008 NASA’s Phoenix lander scraped a few centimetres into the Martian soil and hit bright white ice. In Antarctica’s Dry Valleys, frozen ground hides under dry soil the same way.', earth: [], mars: [],
        panes: [
          { world: 'mars', photo: { img: 'mars_phoenix_ice', w: 512, h: 1024, place: 'Phoenix trench, Mars 2008' }, marks: [{ t: 'ring', x: 265, y: 410, r: 95, label: 'Ice!', sub: 'a few cm down' }] },
          { world: 'earth', photo: { img: 'earth_dry_valleys', w: 1260, h: 1400, place: 'Dry Valleys, Antarctica' }, marks: [{ t: 'ring', x: 650, y: 700, r: 170, label: 'Dry soil, frozen ground below' }] },
        ] },
      { title: 'Cliffs of buried ice', line: 'Where Martian ground has slumped away, NASA’s HiRISE camera found cliffs showing layers of nearly pure ice more than 100 m thick, starting just 1–2 m under the surface. Astronauts could dig it out with a shovel.', earth: [], mars: [],
        panes: [
          { world: 'mars', photo: { img: 'mars_ice_scarp', w: 1001, h: 801, place: 'Ice cliff, Mars (HiRISE)' }, marks: [{ t: 'ring', x: 500, y: 350, r: 120, label: 'Blue = ice', sub: 'starts 1–2 m down' }, { t: 'ring', x: 500, y: 120, r: 70, label: 'Dusty ground on top' }] },
        ] },
      { title: 'Seeing in the dark', line: 'Canada’s RADARSAT-1 photographed NASA’s Arctic Mars test site, Haughton crater, on 3 January 2001, in the middle of polar night. Radar brings its own light, the same trick Mars and Moon orbiters use to find buried ice.', earth: [], mars: [],
        panes: [
          { world: 'earth', photo: { img: 'story_haughton_radar', w: 900, h: 900, place: 'Haughton crater, RADARSAT-1 radar (CSA), 2001' },
            marks: [{ t: 'ring', x: 480, y: 465, r: 200, label: 'Haughton crater, 23 km wide', sub: 'imaged in total darkness' }, { t: 'ring', x: 470, y: 60, r: 60, label: 'Frozen sea', sub: 'smooth = dark to radar' }] },
        ] },
      { title: 'Ice caps 3 km deep', line: 'Mars has a polar ice cap about as thick as Greenland’s ice sheet: up to around 3 km of frozen water. The dark spirals are valleys carved by wind pouring off the cap.', earth: [], mars: [],
        panes: [
          { world: 'mars', photo: { img: 'pc_mars_north_cap', w: 1200, h: 840, place: 'Mars north polar cap' }, meter: { title: 'Thickness', value: '~3 km', level: 0.95 }, marks: [{ t: 'ring', x: 600, y: 533, r: 250, label: 'Water ice, ~1,000 km wide', sub: 'spirals carved by wind' }] },
          { world: 'earth', photo: { img: 'pc_greenland', w: 1400, h: 855, place: 'Greenland ice sheet' }, meter: { title: 'Thickness', value: '~3 km', level: 1 }, marks: [{ t: 'ring', x: 700, y: 700, r: 150, label: 'Ice sheet', sub: 'up to ~3 km thick' }] },
        ] },
      { title: 'Where the twin breaks', line: 'On Earth, ice melts into water. Mars air is so thin that ice skips the liquid and turns straight into vapour, like dry ice. Four days after Phoenix dug them up, some ice chunks had simply vanished.', earth: [], mars: [],
        panes: [
          { world: 'mars', photo: { img: 'mars_phoenix_ice', w: 512, h: 1024, place: 'Phoenix trench, Mars 2008' }, marks: [{ t: 'ring', x: 265, y: 410, r: 95, label: 'Gone in 4 days', sub: 'ice → vapour' }] },
          { world: 'earth', photo: { img: 'earth_dry_valleys', w: 1260, h: 1400, place: 'Dry Valleys, Antarctica' }, marks: [{ t: 'ring', x: 730, y: 855, r: 70, label: 'Liquid water', sub: 'under the lake ice' }] },
        ] },
      { title: 'The Moon keeps ice in the dark', line: 'The Moon has ice too, hiding in craters at its poles that haven’t seen sunlight in billions of years. That’s the next trail: the South Pole.', earth: [], mars: [],
        panes: [
          { world: 'moon', photo: { img: 'moon_south_pole', w: 1280, h: 1280, place: 'Moon south pole (LRO)' }, marks: [{ t: 'ring', x: 740, y: 470, r: 95, label: 'Never sees the Sun', sub: 'ice can hide here' }] },
        ] },
    ],
  },
  // Sources: lunar axial tilt ~1.5°, so at the pole the Sun stays within ~1.5° of the horizon. Shackleton crater ~21 km wide,
  // ~4 km deep, near the pole (LRO). Permanently shadowed regions colder than −200 °C (LRO Diviner). Artemis III candidate
  // regions all within 6° latitude of the south pole (NASA, Aug 2022). NASA ISRU field tests on Mauna Kea 2008 and 2010
  // (with PISCES). Transantarctic Mountains: our Twin Score's top Earth twin for most Artemis-region sites.
  pole: {
    earth: { img: 'pc_transantarctic', w: 1400, h: 903, place: 'Transantarctic Mountains' },
    mars: { img: 'moon_south_pole', w: 1280, h: 1280, place: 'Moon south pole (LRO)' },
    narration: [
      'sounds/pole/s1.opus',
      'sounds/pole/s2.opus',
      'sounds/pole/s3.opus',
      'sounds/pole/s4.opus',
      'sounds/pole/s5.opus',
    ],
    steps: [
      { title: 'A Sun that never climbs', line: 'The Moon barely tilts, so at its south pole the Sun just circles along the horizon, never more than about 1.5° up. Every shadow stretches for kilometres.', earth: [], mars: [],
        panes: [
          { world: 'moon', photo: { img: 'moon_south_pole', w: 1280, h: 1280, place: 'Moon south pole (LRO)' }, marks: [{ t: 'ring', x: 657, y: 651, r: 40, label: 'South pole', sub: 'Sun stays on the horizon' }] },
        ] },
      { title: 'Light on the ridges, ice in the dark', line: 'Some ridges near the pole are lit most of the year, perfect for solar panels. Right beside them, crater floors stay dark and frozen. Antarctica’s Transantarctic Mountains, our scorer’s top twin, mix sunlit rock and ice the same way.', earth: [], mars: [],
        panes: [
          { world: 'moon', photo: { img: 'moon_south_pole', w: 1280, h: 1280, place: 'Moon south pole (LRO)' }, marks: [{ t: 'ring', x: 657, y: 651, r: 45, label: 'Shackleton crater', sub: '4 km deep, always dark' }, { t: 'ring', x: 740, y: 470, r: 90, label: 'Permanent shadow', sub: 'colder than −200 °C' }] },
          { world: 'earth', photo: { img: 'pc_transantarctic', w: 1400, h: 903, place: 'Transantarctic Mountains' }, marks: [{ t: 'ring', x: 1213, y: 435, r: 140, label: 'Sunlit rock ridge' }, { t: 'ring', x: 467, y: 700, r: 150, label: 'Ice in the valley' }] },
        ] },
      { title: 'Practicing on Earth', line: 'In 2008 and 2010 NASA and partners took robots up Mauna Kea in Hawaiʻi to dig volcanic soil and pull oxygen and water out of it: practice for living off Moon dirt instead of shipping everything from Earth.', earth: [], mars: [],
        panes: [
          { world: 'earth', photo: { img: 'pc_mauna_kea', w: 1400, h: 933, place: 'Mauna Kea, Hawaiʻi' }, marks: [{ t: 'ring', x: 825, y: 513, r: 140, label: 'Cinder cones' }, { t: 'ring', x: 467, y: 747, r: 150, label: 'Loose volcanic soil', sub: 'a stand-in for Moon dirt' }] },
        ] },
      { title: 'Where Artemis will walk', line: 'NASA has picked nine candidate landing regions for Artemis III, all within 6° of the south pole. You can walk two of them, Shackleton rim and Malapert, in Explore.', earth: [], mars: [],
        panes: [
          { world: 'moon', photo: { img: 'moon_south_pole', w: 1280, h: 1280, place: 'Moon south pole (LRO)' }, marks: [{ t: 'ring', x: 640, y: 640, r: 455, label: 'All 9 landing regions are inside this ring' }] },
        ] },
      { title: 'Where the twin breaks', line: 'Antarctica has air, wind and snow, and it’s mild next to the Moon: in the shadowed craters it’s colder than −200 °C, and there’s no air at all to breathe or to soften the sunlight.', earth: [], mars: [],
        panes: [
          { world: 'earth', photo: { img: 'pc_transantarctic', w: 1400, h: 903, place: 'Transantarctic Mountains' }, marks: [{ t: 'ring', x: 700, y: 220, r: 150, label: 'Air, wind and snow' }] },
          { world: 'moon', photo: { img: 'moon_south_pole', w: 1280, h: 1280, place: 'Moon south pole (LRO)' }, marks: [{ t: 'ring', x: 740, y: 470, r: 90, label: 'No air, −200 °C' }] },
        ] },
    ],
  },
  // Sources: Earth's wind belts (Hadley/Ferrel/polar cells, NOAA). Mars winds: Mars Climate Database v6, diurnal mean, Ls 270, 10 km above surface (northern jet ≈68 m/s). MAVEN wind map of Mars' upper atmosphere,
  // winds rippled by terrain below (Benna et al. 2019, Science; NASA release 19-26). Khamsin: hot dusty spring wind
  // in Egypt, March–May, Arabic for "fifty", gusts up to ~140 km/h, temperature can jump ~20 °C. Mars air at the
  // surface is ~1% as dense as Earth's (pressure ~0.6%), so 100 km/h pushes like ~12 km/h here. 2018 global dust
  // storm blocked the Sun and ended Opportunity's mission.
  wind: {
    earth: { img: 'story_khamsin', w: 1600, h: 900, place: 'Khamsin, Egypt' },
    mars: { img: 'story_mars_storm_art', w: 640, h: 384, place: 'Dust storm, artist’s illustration' },
    narration: [
      'sounds/wind/s1.opus',
      'sounds/wind/s2.opus',
      'sounds/wind/s3.opus',
      'sounds/wind/s4.opus',
      'sounds/wind/s5.opus',
    ],
    steps: [
      { title: 'Air on the move', line: 'The Sun heats the equator more than the poles, so Earth’s air flows in belts. Mars has belts too, and in its northern winter a jet stream races around the north at about 245 km/h.', earth: [], mars: [],
        panes: [
          { world: 'earth', photo: { img: 'story_maven_globe', w: 1800, h: 1013, place: 'Wind belts (drag to spin)' }, globe: 'earth-winds', marks: [] },
          { world: 'mars', photo: { img: 'story_maven_globe', w: 1800, h: 1013, place: 'Real winds (drag to spin)' }, globe: 'mars-winds', marks: [] },
        ] },
      { title: 'Wind that feels mountains', line: 'NASA’s MAVEN measured Mars winds from orbit and found something surprising: winds 150 km up still ripple over the mountains below, like water over rocks.', earth: [], mars: [],
        panes: [
          { world: 'mars', photo: { img: 'story_maven_mountains', w: 1800, h: 1013, place: 'Mars winds over mountains' },
            marks: [{ t: 'ring', x: 1170, y: 420, r: 130, label: 'Wind bends over peaks' }] },
        ] },
      { title: 'Egypt’s Khamsin', line: 'Every spring a hot wind blows out of the Sahara for days. The sky turns orange, palms bend, and it can get 20 °C hotter in a few hours. Its name means “fifty” in Arabic.', earth: [], mars: [],
        panes: [
          { world: 'earth', photo: { img: 'story_khamsin', w: 1600, h: 900, place: 'Khamsin, Egypt' }, meter: { title: 'Gusts', value: '140 km/h', level: 0.7 },
            marks: [{ t: 'ring', x: 1250, y: 230, r: 150, label: 'Palms bent flat' }, { t: 'ring', x: 330, y: 160, r: 100, label: 'Sky full of dust' }] },
        ] },
      { title: 'Mars does it bigger', line: 'In 2018 a dust storm wrapped all of Mars for months. It blocked the Sun so long that the solar-powered rover Opportunity ran out of power and fell silent.', earth: [], mars: [],
        panes: [
          { world: 'earth', photo: { img: 'story_khamsin', w: 1600, h: 900, place: 'Khamsin, Egypt' },
            marks: [{ t: 'ring', x: 800, y: 600, r: 150, label: 'Lasts a few days' }] },
          { world: 'mars', photo: { img: 'story_mars_storm_art', w: 640, h: 384, place: 'Dust storm, artist’s illustration' },
            marks: [{ t: 'ring', x: 300, y: 285, r: 60, label: 'A rover (illustration)' }] },
        ] },
      { title: 'Where the twin breaks', line: 'Mars air is about 100 times thinner, so a 100 km/h Mars wind pushes like a 12 km/h breeze. Its storms are high, thin haze, not walls like this picture.', earth: [], mars: [],
        panes: [
          { world: 'earth', photo: { img: 'story_khamsin', w: 1600, h: 900, place: 'Khamsin, Egypt' }, meter: { title: 'Air', value: '100%', level: 1 },
            marks: [{ t: 'ring', x: 1250, y: 230, r: 150, label: 'Thick air hits hard' }] },
          { world: 'mars', photo: { img: 'story_mars_storm_art', w: 640, h: 384, place: 'Dust storm, artist’s illustration' }, meter: { title: 'Air', value: '~1%', level: 0.02, tick: 1, tickLabel: 'Earth 100%' },
            marks: [{ t: 'ring', x: 330, y: 150, r: 90, label: 'Real storms: thin haze', sub: 'not a wall' }] },
        ] },
    ],
  },
  // Sources: Hawaiian basalt lava erupts at ~1,150 °C (USGS HVO); lunar and Martian basalts erupted at similar
  // temperatures, ~1,200 °C. Lunar mare lava mostly 3–3.8 billion years old (Chang'e-5 found ~2 billion-year-old lava);
  // Mars' youngest lava (Cerberus Fossae) is only a few million years old. Sinuous rilles are lava channels and collapsed
  // tubes (Hadley Rille, Apollo 15). Pavonis Mons skylight ~35 m wide, 20+ m deep (HiRISE, NASA PIA15012).
  // Low gravity: Mars tubes may be ~100x and Moon tubes ~1,000x wider than Earth's (Sauro et al. 2020, Earth-Science Reviews).
  // Marius Hills pit ~65 m wide (Haruyama et al. 2009, Kaguya). Lunar pits stay ~17 °C (Horvath et al. 2022, GRL).
  fire: {
    earth: { img: 'story_lava_flow', w: 547, h: 365, place: 'Flowing lava' },
    mars: { img: 'story_pavonis_skylight', w: 1920, h: 1920, place: 'Pavonis Mons' },
    narration: [
      'sounds/fire/s1.opus',
      'sounds/fire/s2.opus',
      'sounds/fire/s3.opus',
      'sounds/fire/s4.opus',
      'sounds/fire/s5.opus',
    ],
    steps: [
      { title: 'Earth is still burning', line: 'Lava still pours out on Earth today, hot enough to melt copper. When its top cools into a crust, the river keeps flowing underneath in a lava tube.', earth: [], mars: [],
        panes: [
          { world: 'earth', photo: { img: 'story_lava_flow', w: 547, h: 365, place: 'Lava, today' }, meter: { title: 'Lava', value: '1,150 °C', level: 1150 / 1300 },
            marks: [{ t: 'ring', x: 290, y: 175, r: 60, label: 'Liquid rock', sub: '1,150 °C' }] },
        ] },
      { title: 'Mars has lava tubes too', line: 'Left: a hole into a lava tube in Hawaiʻi, lava still glowing inside. Right: the same kind of hole on a Mars volcano. Its lava drained away long ago.', earth: [], mars: [],
        panes: [
          { world: 'earth', photo: { img: 'story_fire_skylight', w: 800, h: 600, place: 'Kīlauea, Hawaiʻi' },
            marks: [{ t: 'ring', x: 410, y: 355, r: 105, label: 'Lava flowing inside', sub: 'still hot' }] },
          { world: 'mars', photo: { img: 'story_pavonis_skylight', w: 1920, h: 1920, place: 'Pavonis Mons' },
            marks: [{ t: 'ring', x: 800, y: 930, r: 150, label: 'Same kind of hole', sub: '≈35 m wide, cold' }] },
        ] },
      { title: 'The Moon had lava rivers', line: 'Over 3 billion years ago, lava ran across the Moon the way it runs on Earth today. Its channels froze, and some roofs caved in.', earth: [], mars: [],
        panes: [
          { world: 'earth', photo: { img: 'story_lava_river', w: 720, h: 1280, place: 'A lava river, today' },
            marks: [{ t: 'ring', x: 355, y: 700, r: 95, label: 'Lava river', sub: 'crusting over' }] },
          { world: 'moon', photo: { img: 'story_moon_rille', w: 1100, h: 1100, place: 'A lunar lava channel' },
            marks: [{ t: 'ring', x: 830, y: 410, r: 95, label: 'What’s left on the Moon', sub: 'roof caved in' }] },
        ] },
      { title: 'Giant tunnels', line: 'Weak gravity lets lava tubes grow huge. Mars tubes may be about 100 times wider than Earth’s, and the Moon’s about 1,000 times.', earth: [], mars: [],
        panes: [
          { world: 'mars', photo: { img: 'story_pavonis_skylight', w: 1920, h: 1920, place: 'Pavonis Mons' },
            meter: { title: 'Tube width', value: '~100×', level: 2 / 3, tick: 0, tickLabel: 'Earth 1×' },
            marks: [{ t: 'ring', x: 800, y: 930, r: 150, label: 'Gravity 38% of Earth’s' }] },
          { world: 'moon', photo: { img: 'moon_marius_pit', w: 1000, h: 1000, place: 'Marius Hills pit' },
            meter: { title: 'Tube width', value: '~1,000×', level: 1, tick: 0, tickLabel: 'Earth 1×' },
            marks: [{ t: 'ring', x: 502, y: 500, r: 70, label: 'Gravity 17% of Earth’s' }] },
        ] },
      { title: 'A ready-made shelter', line: 'Inside a lunar pit it stays about 17 °C, day and night, with rock overhead to block radiation. NASA has designed a robot to rappel in and look, and astronauts already train in Lanzarote’s tubes.', earth: [], mars: [],
        panes: [
          { world: 'earth', photo: { img: 'pc_lava_tube', w: 1400, h: 930, place: 'Lanzarote, Spain' },
            marks: [{ t: 'ring', x: 700, y: 430, r: 120, label: 'Astronaut cave training', sub: 'ESA PANGAEA' }] },
          { world: 'moon', photo: { img: 'story_moon_diver', w: 1000, h: 900, place: 'Moon Diver, artist’s concept', contain: true },
            meter: { title: 'Inside a pit', value: '17 °C', level: 0.55, tick: 0.05, tickLabel: 'outside −170 °C' },
            marks: [{ t: 'ring', x: 600, y: 770, r: 65, label: 'Robot lowered on a cable', sub: 'NASA concept' }, { t: 'ring', x: 394, y: 140, r: 50, label: 'Earth, seen from the pit' }] },
        ] },
    ],
  },
  // Sources: healthy topsoil ~45% minerals, 25% water, 25% air, ~5% organic matter (USDA NRCS);
  // a teaspoon of soil holds more microbes than there are people on Earth (USDA NRCS);
  // Phoenix found ~0.5% perchlorate in Mars soil (Hecht et al. 2009, Science);
    // Hawaii's red soils (oxisols) are basalt weathered into iron oxides, low in nutrients but farmed; plants grown in Mars soil simulant (Wamelink et al. 2014, PLOS ONE).
  soil: {
    earth: { img: 'story_soil', w: 659, h: 466, place: 'Garden soil' },
    mars: { img: 'story_mars_soil', w: 600, h: 600, place: 'Gusev crater, Mars' },
    narration: [
      'sounds/soil/s1.opus',
      'sounds/soil/s2.opus',
      'sounds/soil/s3.opus',
      'sounds/soil/s4.opus',
      'sounds/soil/s5.opus',
    ],
    steps: [
      { title: 'Earth’s soil is alive', line: 'One spoon of garden soil holds more microbes than there are people on Earth. That’s why things grow in it.',
        earth: [{ t: 'ring', x: 272, y: 210, r: 78, label: 'Living soil', sub: 'microbes, roots, rotted leaves' }],
        mars: [{ t: 'ring', x: 300, y: 380, r: 70, label: 'Crushed rock', sub: 'nothing living' }] },
      { title: 'Mars dirt isn’t soil', line: 'Mars has no worms and no rotting leaves. Phoenix also found perchlorate: a salt that’s toxic to people.',
        meters: {
          earth: { title: 'Organic matter', value: '≈5%', level: 0.5 },
          mars: { title: 'Organic matter', value: '≈0%', level: 0.015 },
        },
        earth: [{ t: 'ring', x: 440, y: 110, r: 55, label: 'Roots + microbes' }],
        mars: [{ t: 'ring', x: 220, y: 330, r: 60, label: 'Perchlorate salt', sub: 'toxic' }] },
      { title: 'But Earth has a red twin', line: 'In Hawaiʻi, lava rock crumbles and rusts into red dirt. Mars dust is made the same way: broken-down lava, coated in rust.',
        earthPhoto: { img: 'story_hawaii', w: 1800, h: 1350, place: 'Waimea, Hawaiʻi' },
        earth: [{ t: 'ring', x: 1000, y: 1000, r: 170, label: 'Crumbled lava', sub: 'rusted red' }],
        mars: [{ t: 'ring', x: 300, y: 380, r: 70, label: 'Crumbled lava', sub: 'rusted red' }] },
      { title: 'Can you grow food in it?', line: 'Hawaiʻi’s red dirt is old and low in nutrients, but rain, roots and microbes keep it farmable. Mars dirt has the same rust and none of the life.',
        earthPhoto: { img: 'story_hawaii', w: 1800, h: 1350, place: 'Waimea, Hawaiʻi' },
        earth: [{ t: 'ring', x: 1560, y: 210, r: 110, label: 'Grass and trees grow', sub: 'with rain and microbes' }],
        mars: [{ t: 'ring', x: 450, y: 200, r: 70, label: 'Nothing grows', sub: 'no life, toxic salt' }] },
      { title: 'Can we farm Mars?', line: 'In lab tests, tomatoes, peas and radishes grew in fake Mars soil. Real Mars dirt needs its toxic salt washed out first.',
        earth: [{ t: 'ring', x: 470, y: 120, r: 60, label: 'Food grows here' }],
        mars: [{ t: 'ring', x: 300, y: 380, r: 70, label: 'Wash out the salt first' }] },
    ],
  },
  rust: {
    earth: { img: 'story_rio_tinto', w: 1800, h: 1350, place: 'Río Tinto, Spain' },
    mars: { img: 'story_mars_gusev', w: 616, h: 445, place: 'Gusev crater, Mars' },
    narration: [
      'sounds/rust/s1.opus',
      'sounds/rust/s2.opus',
      'sounds/rust/s3.opus',
      'sounds/rust/s4.opus',
      'sounds/rust/s5.opus',
    ],
    steps: [
      { title: 'Two red worlds', line: 'A river in Spain and a desert on Mars. They are red for the same reason.', earth: [], mars: [] },
      { title: 'It’s rust', line: 'Iron + oxygen + water = rust. Both places are packed with iron.',
        meters: {
          earth: { title: 'Iron in the water', value: '20 g/L', level: logPos(20), tick: logPos(0.001), tickLabel: 'normal river' },
          mars: { title: 'Iron oxide in the soil', value: '16%', level: 16 / 20, tick: 7 / 20, tickLabel: 'Earth’s crust 7%' },
        },
        earth: [{ t: 'ring', x: 900, y: 560, r: 120, label: 'Iron dissolved in the water' }],
        mars: [{ t: 'ring', x: 300, y: 370, r: 48, label: 'Iron-oxide dust' }] },
      { title: 'Is anything alive?', line: 'Río Tinto is full of microbes that live off iron. NASA drilled here in 2003–05 to practice finding life on Mars.',
        earth: [{ t: 'ring', x: 900, y: 1000, r: 120, label: 'Microbes thrive here', sub: 'eating iron' }],
        mars: [{ t: 'ring', x: 330, y: 330, r: 70, label: 'No life found', sub: 'yet' }] },
      { title: 'Only skin-deep', line: 'Mars is red only on top: a thin coat of dust on grey rock. A 2025 study says that dust formed with water.',
        earth: [{ t: 'ring', x: 150, y: 820, r: 110, label: 'Pale rock under the stain' }],
        mars: [{ t: 'ring', x: 410, y: 405, r: 26, label: 'Grey basalt rock' }, { t: 'ring', x: 300, y: 40, r: 30, label: 'Dust tints the sky' }] },
      { title: 'Where the twin breaks', line: 'Río Tinto still flows. Mars dried up billions of years ago and its air has almost no oxygen. And the Moon? No water, no air, no rust.', moon: true,
        earth: [{ t: 'ring', x: 1250, y: 330, r: 110, label: 'Water flows today' }],
        mars: [{ t: 'ring', x: 330, y: 300, r: 80, label: 'Dry for 3 billion years' }] },
    ],
  },
};

// ---------------------------------------------------------------- Explore: walk real terrain
// Terrain: 12 x 12 km windows from MRO CTX DTMs (Mars) and Barker et al. LOLA south-pole DEMs (Moon), via
// USGS Astrogeology analysis-ready data (pipeline/fetch_terrain.py). Earth twins: Twin Score top matches where
// we have a photo, otherwise the story twin (marked "looks like").
export type Region = {
  id: string; world: 'mars' | 'moon'; name: string; line: string;
  twin: { img: string; name: string; line: string; inset?: { img: string; caption: string; glow?: boolean } };
  /** What the rover beside you says while you walk: about this place, and how it compares to its Earth twin. */
  rover?: string[];
  /** Optional first screen: a real photo of the place itself, with a "then ↔ now" slider.
   *  fire: where to draw the imagined eruption, in image pixels (caldera centre, flank radius). */
  intro?: { img: string; kicker: string; title: string; facts: string[]; fire: { cx: number; cy: number; r: number }; then: string; now: string };
};
export const REGIONS: Region[] = [
  { id: 'mars-gale', world: 'mars', name: 'Gale crater', line: 'Curiosity’s landing plain. Mount Sharp’s layers rise to the south.',
    twin: { img: 'pc_danakil', name: 'Danakil desert, Ethiopia', line: 'Our Twin Score’s best match: the same slopes, and the same rusty and salty minerals.' },
    rover: [
      'Hi! I’m built just like Curiosity, who has been rolling around this crater since August 2012.',
      'Oh! We’re surrounded by LAYER CAKE MOUNTAINS. That makes me hungry.',
      'That mountain ahead is Mount Sharp: 5 km of stacked rock layers. Every layer is a page of Mars history.',
      'See these flat, layered slabs? Mudstone. A lake filled this crater more than 3 billion years ago.',
      'Danakil in Ethiopia makes the same kind of rock today: salty water dries out and leaves layer after layer behind.',
      'Higher up Mount Sharp the layers turn salty: sulfates, the same minerals that crust over Danakil’s pools.',
      'In 2024 Curiosity cracked a rock open and found pure yellow sulfur inside. Danakil’s Dallol springs are covered in it.',
      'Big difference: Danakil reaches +45 °C. Tonight it will drop to about −70 °C here.',
      'Curiosity found organic molecules in these lake rocks. In Danakil, scientists look for the point where life gives up: the most acidic, salty pools are empty.',
      'Keep walking. Every hill around you is real, measured from orbit.',
    ] },
  { id: 'mars-jezero', world: 'mars', name: 'Jezero crater', line: 'An old lake bed where Perseverance hunts for signs of ancient life.',
    twin: { img: 'pc_wadi_hitan', name: 'Wadi El Hitan, Fayoum, Egypt', line: 'The Valley of the Whales: a sea floor turned desert, with whale skeletons 40 million years old lying in the sand.' },
    rover: [
      'Welcome to Jezero! This one is my real home. I landed here on 18 February 2021.',
      'Whoa, a dust storm! In Egypt this is khamaseen season: the hot, dusty spring wind. Its name comes from the Arabic for fifty, as in fifty days.',
      'Good news: Mars air is so thin that even a strong gust pushes on you like a light breeze on Earth. The dust is the real problem.',
      'In 2018 a storm like this wrapped the whole planet. My cousin Opportunity ran on solar panels. The dust hid the Sun, and she never woke up.',
      'People turned her last message into: my battery is low and it’s getting dark.',
      'But this time I came prepared: goggles, a khamaseen scarf, and a nuclear battery that doesn’t need the Sun. This time, I survive!',
      'Under the dust, this crater held a lake 45 km wide, about 3.5 billion years ago. A river poured in mud and sand and built a delta.',
      'Your twin, Wadi El Hitan in Fayoum, was a sea floor too. Now it’s desert, with whale skeletons 40 million years old lying in the sand.',
      'That’s what I hunt here: traces of old life in old lake mud. In 2024 I found a rock with strange leopard spots, called Cheyava Falls. Maybe a clue!',
      'Every rock I drill goes into a sealed tube, waiting for a ride to Earth.',
    ] },
  { id: 'mars-olympus', world: 'mars', name: 'Olympus Mons', line: 'Stand inside the crater on top of the biggest volcano in the solar system.',
    intro: {
      img: 'pc_olympus_mons', kicker: 'Mars · seen from orbit', title: 'Olympus Mons',
      facts: ['The biggest volcano in the solar system: about 2.5 times as tall as Everest.', 'Its base would cover about a third of Egypt.'],
      fire: { cx: 862, cy: 775, r: 470 },
      then: 'Long ago · imagined', now: 'Today · real photo',
    },
    twin: { img: 'pc_mauna_loa_2022', name: 'Mauna Loa, Hawaiʻi', line: 'The same kind of volcano, still alive: rivers of lava in its 2022 eruption. Olympus Mons once looked like this.' },
    rover: [
      'We made it to Olympus Mons, the biggest volcano in the solar system! We’re standing inside the crater on its summit, 18 km up.',
      'That wall in front of you climbs about 3 km to the rim. This whole pit collapsed when the lava underneath drained away.',
      'It’s so wide that its base would cover about a third of Egypt. From up here, its edges are hidden below the horizon.',
      'Your twin, Mauna Loa in Hawaiʻi, is the same kind of volcano: a shield, built from runny lava flowing out, layer after layer.',
      'Mauna Loa erupted in 2022, and rivers of lava ran down its sides for two weeks. Olympus Mons once looked just like that.',
      'So why is this one so much bigger? Mars has no moving plates. The hot spot stayed in one place, so the lava kept piling up on the same spot.',
      'On Earth, the plate slides over the hot spot, so instead of one giant you get a chain of islands: Hawaiʻi.',
      'And the weaker gravity here lets a mountain grow taller without sinking under its own weight.',
      'Some of its lava flows may be only a few million years old. For a planet, that’s yesterday. Is it really asleep? Maybe.',
      'Notice how soft the ground is? The summit is buried under a thick blanket of fine dust that settled out of the sky. The dark patches are old lava peeking through.',
      'The air up here is about a tenth as thick as down on the plains, and it sits above most of the dust. That’s why the sky looks darker.',
    ] },
  { id: 'moon-shackleton-rim', world: 'moon', name: 'Shackleton rim', line: 'Stand on the edge of a crater 4 km deep whose floor never sees the Sun.',
    twin: { img: 'pc_transantarctic', name: 'Transantarctic Mountains', line: 'Our Twin Score’s best match for the lunar south pole: steep, icy polar ridges.' },
    rover: [
      'See that bootprint? That’s mine. With no wind and no rain up here, a footprint can stay sharp for millions of years.',
      'Hi, I’m Neil Armstrong. On 20 July 1969 I became the first person to walk on the Moon: “That’s one small step for man, one giant leap for mankind.”',
      'We landed near the equator, in the Sea of Tranquility. You’ve brought me somewhere I never got to go: the south pole.',
      'This is the rim of Shackleton crater: about 21 km wide and more than 4 km deep.',
      'Here the Sun only skims the horizon, so the crater floor has sat in shadow for billions of years. It’s colder than −200 °C down there.',
      'Scientists think that darkness holds ice. Ice means water to drink, air to breathe, and even rocket fuel. That’s why Artemis wants to land near here.',
      'On Earth, the closest match for this rim is in Antarctica: bare rock, deep cold, and a Sun that stays low.',
      'Try hopping! You weigh one sixth of what you weigh on Earth. On Apollo we found hopping easier than walking.',
      'Look up. That’s Earth, hanging just above the horizon. From the pole it never climbs high in the sky.',
    ] },
  { id: 'moon-malapert-massif', world: 'moon', name: 'Malapert massif', line: 'A 5 km mountain and a candidate Artemis landing region.',
    twin: { img: 'pc_mauna_kea', name: 'Mauna Kea, Hawaiʻi', line: 'Ranked #2 of 469 places on Earth for this site. NASA tested Moon mining gear here.' },
    rover: [
      'This is Malapert massif, a mountain about 5 km tall near the south pole.',
      'From up here you can see Earth most of the time, so it’s a great place for a radio to call home.',
      'Some ridges around here get sunlight for most of the year. Solar panels would almost never go dark.',
      'Your twin is Mauna Kea in Hawaiʻi. NASA tested tools there for turning Moon dirt into oxygen and water.',
      'In my suit I couldn’t bend down very far. To pick up rocks we used long-handled tongs and scoops.',
      'This backpack kept me alive out here: oxygen to breathe, water to keep me cool, and a radio.',
    ] },
  { id: 'moon-highlands', world: 'moon', name: 'Lunar highlands', line: 'The bright old country: the light parts of the Moon, made of some of its oldest rock.',
    twin: { img: 'pc_mistastin', name: 'Mistastin crater, Labrador, Canada', line: 'One of the few places on Earth where an asteroid hit anorthosite, the same pale rock as the Moon’s highlands. The Artemis II crew trained here in 2023.',
      inset: { img: 'pc_anorthosite', caption: 'Labrador’s anorthosite flashes blue in the light', glow: true } },
    rover: [
      'Welcome to the bright old country: the lunar highlands. Every light-grey patch you see on the Moon from Earth is highland.',
      'It’s made of anorthosite, a pale rock that floated to the top of a sea of molten rock when the Moon was young, more than 4 billion years ago.',
      'Apollo 16 landed right here in 1972, the only Apollo landing in the central highlands. John Young and Charlie Duke drove their rover over these hills.',
      'Your twin is Mistastin crater in Labrador, Canada. An asteroid made it about 36 million years ago.',
      'It’s one of very few craters on Earth punched into anorthosite, the same kind of rock as these hills. That makes it a perfect classroom.',
      'In 2023 the Artemis II crew trained there, learning to read rocks like these before flying around the Moon.',
      'And Labrador’s anorthosite has a trick: turn it in the light and it flashes blue. Geologists call that labradorescence.',
      'Moon anorthosite doesn’t flash like that. It just glows bright grey in the sunlight. But it’s the same family of stone.',
    ] },
];
