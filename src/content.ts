// All editorial content in one place. Facts carry a source; coordinates of Earth twins are
// approximate unless marked otherwise (we say so on screen).

export type WorldId = 'earth' | 'mars' | 'moon';
export type LatLon = [number, number];

export const WORLDS: Record<WorldId, {
  name: string; tagline: string; index: string; tex: string; glow: string; radiusKm: number;
  facts: { label: string; value: string[] }[];
}> = {
  earth: {
    name: 'Earth', tagline: 'The test bench', index: '01', tex: 'tex/earth_base.jpg', glow: '#6fb6ff', radiusKm: 6371,
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
    name: 'Mars', tagline: 'Red planet', index: '02', tex: 'tex/mars_base.jpg', glow: '#ff9a6a', radiusKm: 3389.5,
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
    name: 'Moon', tagline: 'Next door', index: '03', tex: 'tex/moon_base.jpg', glow: '#c9d4ff', radiusKm: 1737.4,
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
    earth: { tex: 'tex/earth_base.jpg', title: 'Iron oxides seen by EMIT', source: 'NASA EMIT mineral classes per 12 km window (via Terrestrial Analog Finder) on Blue Marble', pins: [
      { name: 'Río Tinto, Spain', at: [37.69, -6.59], tone: 'twin', note: 'acid iron river' },
      { name: 'Bahariya Oasis, Egypt', at: [28.35, 28.86], tone: 'new', note: 'ferricretes, little studied' },
      { name: 'Dallol, Ethiopia', at: [14.24, 40.3], tone: 'twin' },
      { name: 'Moqui marbles, Utah', at: [37.4, -111.6], tone: 'twin' },
    ], points: 'iron' },
    mars: { tex: 'tex/mars_base.jpg', title: 'Viking colour mosaic', source: 'Viking MDIM 2.1 colour mosaic, NASA/USGS via Mars Trek', pins: [
      { name: 'Meridiani Planum', at: [-1.95, -5.53], tone: 'target', note: 'Opportunity, hematite' },
      { name: 'Gale crater', at: [-5.4, 137.8], tone: 'target', note: 'hematite on Vera Rubin ridge' },
    ] },
    moon: { tex: 'tex/moon_feo.jpg', title: 'Iron oxide (FeO) weight percent', source: 'Clementine UVVIS FeO, via Moon Trek', legend: { low: 'less iron', high: 'more iron', colors: SPECTRUM }, pins: [
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
    earth: { tex: 'tex/earth_lst_day.jpg', title: 'Land surface temperature, July 2024, day', source: 'MODIS Terra monthly LST via NASA GIBS', legend: { svg: 'legends/earth_lst.svg', low: 'cold', high: 'hot' }, pins: [
      { name: 'Mojave basalt (MMS simulant)', at: [35.0, -117.8], tone: 'twin' },
      { name: 'Mauna Kea saddle (JSC Mars-1)', at: [19.75, -155.45], tone: 'twin' },
    ] },
    mars: { tex: 'tex/mars_ti.jpg', title: 'Thermal inertia', source: 'MGS TES, Putzig et al. 2005, via Mars Trek', legend: { low: 'fine dust', high: 'rock, crust', colors: SPECTRUM }, pins: [
      { name: 'Gale crater (Rocknest)', at: [-4.59, 137.44], tone: 'target' },
    ] },
    moon: { tex: 'tex/moon_rock.jpg', title: 'Rock abundance', source: 'LRO Diviner, Bandfield et al., via Moon Trek', legend: { low: 'fine regolith', high: 'more rocks' }, pins: [
      { name: 'Tycho', at: [-43.3, -11.2], tone: 'target', note: 'young, rocky' },
    ] },
    photos: ['mars_rocknest', 'mars_phoenix_soil'],
    evidence: [
      { label: 'Martian regolith simulants (overview)', url: 'https://en.wikipedia.org/wiki/Martian_regolith_simulant' },
      { label: 'Putzig et al. 2005, global thermal inertia of Mars', url: 'https://doi.org/10.1016/j.icarus.2004.08.017' },
    ],
    breaks: 'Mars soil holds perchlorate salts that are toxic to people; Earth soil does not. Earth soil is full of life and organics, which Mars soil lacks.',
    scoreTarget: 'mars-gale',
  },
  {
    id: 'fire', title: 'Fire', kicker: 'Volcanoes and lava tubes',
    question: 'Where could astronauts shelter underground?',
    summary: 'Lava tubes are tunnels left when molten rock drains away. Orbiters have spotted dark "skylights" on Mars and the Moon that may open into them. Earth has walkable ones.',
    earth: { tex: 'tex/earth_relief.jpg', title: 'Elevation and 1,214 Holocene volcanoes', source: 'ASTER GDEM via GIBS; Smithsonian Global Volcanism Program', legend: { svg: 'legends/earth_relief.svg', low: 'low', high: 'high' }, pins: [
      { name: 'Lanzarote, Spain', at: [29.16, -13.44], tone: 'twin', note: 'ESA cave training' },
      { name: 'Umm Jirsan, Saudi Arabia', at: [25.59, 39.67], tone: 'new', note: 'lava tube, 1.48 km' },
      { name: 'Hawaiʻi shield volcanoes', at: [19.48, -155.6], tone: 'twin' },
    ], points: 'volcanoes' },
    mars: { tex: 'tex/mars_mola.jpg', title: 'Elevation', source: 'MGS MOLA colour hillshade, via Mars Trek', legend: { low: 'low', high: 'high', colors: 'linear-gradient(90deg,#1b2a8a,#2c7fd6,#3fc7a5,#c6e04a,#f0a43a,#c4573a,#ffffff)' }, pins: [
      { name: 'Olympus Mons', at: [18.65, -133.8], tone: 'target' },
      { name: 'Arsia Mons skylights', at: [-8.26, -120.09], tone: 'target' },
    ] },
    moon: { tex: 'tex/moon_base.jpg', title: 'LROC global mosaic', source: 'LRO LROC WAC, via Moon Trek', pins: [
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
    earth: { tex: 'tex/earth_dust.jpg', title: 'Surface dust, June 2024', source: 'MERRA-2 dust surface mass concentration via NASA GIBS', legend: { svg: 'legends/earth_dust.svg', low: 'clear', high: 'dusty' }, pins: [
      { name: 'White Desert, Egypt', at: [27.36, 28.17], tone: 'new', note: 'wind-carved chalk' },
      { name: 'Turpan Depression, China', at: [42.7, 89.2], tone: 'twin' },
      { name: 'Qaidam yardangs, China', at: [38.3, 92.3], tone: 'twin' },
    ] },
    mars: { tex: 'tex/mars_dust.jpg', title: 'Dust cover index', source: 'MGS TES, Ruff & Christensen 2002, via Mars Trek', legend: { low: 'dust-free', high: 'dusty', colors: 'linear-gradient(90deg,#3b0fa8,#1d4fd8,#1fb7c9,#3bd16f,#e6e33a,#f08a24,#d7261e)' }, pins: [
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
    id: 'ice', title: 'Ice', kicker: 'Buried water ice',
    question: 'Where is the water astronauts will need?',
    summary: 'Under Mars’s mid-latitudes lies ice, sometimes just centimetres down. Phoenix scraped it up in 2008 and watched it vanish into the thin air. At the lunar poles, hydrogen hints at ice hiding in the cold.',
    earth: { tex: 'tex/earth_snow.jpg', title: 'Snow cover, January 2024', source: 'MODIS Terra monthly snow cover via NASA GIBS', legend: { svg: 'legends/earth_snow.svg', low: 'none', high: 'full' }, pins: [
      { name: 'McMurdo Dry Valleys', at: [-77.52, 161.85], tone: 'twin', note: 'cold, dry, ground ice' },
      { name: 'Qaidam Basin, China', at: [37.5, 94.0], tone: 'twin' },
    ] },
    mars: { tex: 'tex/mars_base.jpg', title: 'Polar caps and ice targets', source: 'Viking MDIM 2.1 colour mosaic, via Mars Trek', pins: [
      { name: 'Arcadia Planitia', at: [46.7, -170], tone: 'target', note: 'shallow buried ice' },
      { name: 'Phoenix landing site', at: [68.22, -125.75], tone: 'target' },
    ] },
    moon: { tex: 'tex/moon_h.jpg', title: 'Hydrogen in the top metre', source: 'Lunar Prospector neutron spectrometer, via Moon Trek', legend: { low: 'less', high: 'more hydrogen' }, pins: [
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
    earth: { tex: 'tex/earth_base.jpg', title: 'High-latitude terrain twins', source: 'Blue Marble; twins from our Twin Score on Copernicus DEM', pins: [
      { name: 'Transantarctic Mts (near the Dry Valleys)', at: [-77.5, 163.5], tone: 'twin', note: 'top twin for 7 of 8 Artemis-region sites' },
      { name: 'Mauna Kea, Hawaiʻi', at: [19.82, -155.47], tone: 'twin', note: 'NASA ISRU tests 2008, 2010' },
      { name: 'Devon Island (Haughton)', at: [75.38, -89.68], tone: 'twin', note: 'sun skims the horizon' },
    ] },
    mars: null,
    emptyMars: 'This chapter is all Moon.',
    moon: { tex: 'tex/moon_lola.jpg', title: 'Elevation around the pole', source: 'LRO LOLA colour hillshade, via Moon Trek', legend: { low: 'low', high: 'high', colors: 'linear-gradient(90deg,#3a2a8f,#2c7fd6,#3fc7a5,#c6e04a,#f0a43a,#c4573a,#ffffff)' }, pins: [] },
    photos: ['moon_south_pole', 'moon_apollo17'],
    evidence: [
      { label: 'Space.com: NASA’s 9 candidate Artemis III landing regions', url: 'https://www.space.com/space-exploration/artemis/nasa-announces-9-possible-moon-landing-sites-for-artemis-3-lunar-mission' },
      { label: 'Supercluster: Artemis astronauts find a lunar analog in Mistastin crater', url: 'https://supercluster.com/editorial/artemis-astronauts-find-lunar-analog-in-meteorite-impact-crater' },
    ],
    breaks: 'No air, one-sixth gravity, and shadows colder than anywhere on Earth: shadowed craters dip below −230 °C.',
    scoreTarget: 'moon-shackleton-rim',
  },
];

// ---------------------------------------------------------------- Neighborhoods
export type Hood = {
  nick: string; official: string; at: LatLon; why: string;
  twin: string; twinAt?: LatLon; photo?: string; dataTarget?: string; noTwin?: boolean;
};

export const MARS_HOODS: Hood[] = [
  { nick: 'Mount Everything', official: 'Olympus Mons', at: [18.65, -133.8], why: 'Tallest volcano in the solar system, about 22 km high.', twin: 'Hawaiʻi’s shield volcanoes', twinAt: [19.48, -155.6], photo: 'mars_olympus' },
  { nick: 'Volcano Row', official: 'Tharsis Montes', at: [1.48, -112.96], why: 'Three giant volcanoes in a line; cave skylights near Arsia Mons.', twin: 'Lanzarote; Harrat Khaybar, Saudi Arabia', twinAt: [29.16, -13.44], photo: 'mars_skylights' },
  { nick: 'The Grand Grand Canyon', official: 'Valles Marineris', at: [-13.9, -59.2], why: 'Canyon system about 4,000 km long.', twin: 'Grand Canyon, far smaller', twinAt: [36.1, -112.1], photo: 'mars_valles' },
  { nick: 'Blueberry Fields', official: 'Meridiani Planum', at: [-1.95, -5.53], why: 'Hematite “blueberries” found by Opportunity.', twin: 'Utah moqui marbles; Bahariya, Egypt', twinAt: [28.35, 28.86], photo: 'mars_berries', dataTarget: 'mars-meridiani' },
  { nick: 'Mars’s Fayoum', official: 'Jezero Crater', at: [18.43, 77.44], why: 'Ancient lake with a river delta.', twin: 'Fayoum, Egypt, an ancient lake basin', twinAt: [29.45, 30.6], photo: 'mars_jezero_orbit', dataTarget: 'mars-jezero' },
  { nick: 'Layer Cake Mountain', official: 'Mount Sharp, Gale Crater', at: [-5.08, 137.85], why: 'Rock layers that record Mars’s changing climate.', twin: 'Found by our Twin Score', photo: 'mars_murray_buttes', dataTarget: 'mars-gale' },
  { nick: 'The Ice Cellar', official: 'Arcadia Planitia', at: [46.7, -170], why: 'Water ice buried close to the surface.', twin: 'Antarctic Dry Valleys; Qaidam Basin, China', twinAt: [-77.52, 161.85], photo: 'mars_ice_scarp' },
  { nick: 'The Deep End', official: 'Hellas Planitia', at: [-42.4, 70.5], why: 'Deepest basin on Mars, about 7 km below its surroundings.', twin: 'Danakil Depression, Ethiopia (story pick, unproven)', twinAt: [14.24, 40.3], photo: 'earth_afrera' },
  { nick: 'Wind Sculpture Park', official: 'Medusae Fossae', at: [-5, -147], why: 'Soft rock carved by wind into long ridges (yardangs).', twin: 'White Desert, Egypt; Qaidam yardangs', twinAt: [27.36, 28.17], photo: 'mars_yardangs' },
  { nick: 'The Dust Bowl', official: 'Arabia Terra', at: [22.8, 5], why: 'Thick dust cover.', twin: 'Sahara during the Khamsin', twinAt: [26.0, 30.0], photo: 'mars_dust_storm' },
  { nick: 'Old Town', official: 'Noachis Terra', at: [-45, -10], why: 'Oldest land, packed with craters.', twin: 'Kamil Crater, Egypt', twinAt: [22.02, 26.09] },
  { nick: 'Frosty Top', official: 'Planum Boreum', at: [86, 15], why: 'Water-ice cap ringed by dunes.', twin: 'Greenland and Antarctic ice', twinAt: [72.6, -38.5] },
  { nick: 'The Dry Ice Rink', official: 'Planum Australe', at: [-84, 160], why: 'Covered in frozen carbon dioxide.', twin: 'None: Earth is never cold enough', noTwin: true },
];

export const MOON_HOODS: Hood[] = [
  { nick: 'Sunny Ridges', official: 'Artemis III candidate rims (Malapert, de Gerlache, Shackleton)', at: [-85.99, -0.24], why: 'Long sunlight close to the ice.', twin: 'Found by our Twin Score', photo: 'moon_south_pole', dataTarget: 'moon-malapert-massif' },
  { nick: 'The Ice Cellars', official: 'Permanently shadowed craters (Shackleton, Haworth, Faustini)', at: [-89.67, 129.78], why: 'Never see sunlight; water ice trapped in the cold.', twin: 'None: far colder than anywhere on Earth', noTwin: true },
  { nick: 'The Giant Bowl', official: 'South Pole–Aitken basin', at: [-53, -169], why: 'Biggest, oldest impact basin on the Moon.', twin: 'Sudbury, Canada, where Apollo 16 and 17 crews trained', twinAt: [46.6, -81.18] },
  { nick: 'The Bright Old Country', official: 'Lunar highlands (Descartes)', at: [-8.97, 15.5], why: 'Old, bright crust made of anorthosite.', twin: 'Mistastin (Kamestastin) Crater, Canada', twinAt: [55.88, -63.31], photo: 'moon_apollo17' },
  { nick: 'First Footprints', official: 'Mare Tranquillitatis', at: [0.67, 23.47], why: 'Apollo 11 landing site, 1969.', twin: 'Hawaiʻi and Lanzarote lava plains', twinAt: [19.41, -155.28], photo: 'moon_bootprint' },
  { nick: 'The Lava Ocean', official: 'Oceanus Procellarum', at: [18.4, -57.4], why: 'The largest dark lava plain.', twin: 'Iceland and Hawaiʻi lava fields', twinAt: [64.87, -16.83] },
  { nick: 'Splash Sea', official: 'Mare Imbrium', at: [32.8, -15.6], why: 'Giant impact basin later filled with lava.', twin: 'Still to find' },
  { nick: 'Cave Hills', official: 'Marius Hills', at: [14.09, -56.78], why: 'Volcanic domes with a pit that may open into a lava tube.', twin: 'Umm Jirsan, Saudi Arabia; Lanzarote', twinAt: [25.59, 39.67], photo: 'moon_marius_pit' },
  { nick: 'Starburst', official: 'Tycho Crater', at: [-43.31, -11.36], why: 'Young crater with bright rays across the Moon.', twin: 'Kamil Crater, Egypt (tiny, fresh, rayed)', twinAt: [22.02, 26.09], photo: 'moon_tycho' },
  { nick: 'The Hidden Side', official: 'Far side', at: [0, 180], why: 'Always faces away from Earth, so no direct radio contact. It gets as much sunlight as the near side.', twin: 'None', noTwin: true, photo: 'moon_far_side' },
];

// ---------------------------------------------------------------- Target nicknames for Twin Score
export const TARGET_NICK: Record<string, string> = {
  'mars-gale': 'Layer Cake Mountain', 'mars-jezero': 'Mars’s Fayoum', 'mars-meridiani': 'Blueberry Fields',
  'mars-utopia-zhurong': 'Zhurong’s Plain', 'moon-connecting-ridge': 'Sunny Ridges · Connecting ridge',
  'moon-de-gerlache-rim': 'Sunny Ridges · de Gerlache', 'moon-haworth': 'Ice Cellar rim · Haworth',
  'moon-leibnitz-beta-plateau': 'Sunny Ridges · Leibnitz β', 'moon-malapert-massif': 'Sunny Ridges · Malapert',
  'moon-nobile-rim-1': 'Sunny Ridges · Nobile', 'moon-peak-near-shackleton': 'Sunny Ridges · Shackleton peak',
  'moon-shackleton-rim': 'Ice Cellar rim · Shackleton',
};

export const REGION_NAME: Record<string, string> = {
  afar: 'Afar / Danakil, Ethiopia', namib: 'Namib, Namibia', sahara: 'Sahara', 'us-southwest': 'US Southwest',
  'tibet-qaidam': 'Tibet / Qaidam, China', 'canadian-arctic': 'Canadian Arctic', transantarctic: 'Transantarctic Mts, Antarctica',
  'atacama-altiplano': 'Atacama / Altiplano', 'australia-interior': 'Australian interior', gobi: 'Gobi, Mongolia',
  iceland: 'Iceland', arabia: 'Arabian Peninsula',
};

// ---------------------------------------------------------------- Field guides
export type Guide = {
  place: string; country: string; at: LatLon; twinOf: string; theme: string; isNew?: boolean; photo?: string;
  matches: string[]; differs: string[]; practise: string[]; dataTarget?: string; dataEarth?: string;
};

export const GUIDES: Guide[] = [
  { place: 'Bahariya Oasis', country: 'Egypt', at: [28.35, 28.86], twinOf: 'Blueberry Fields · Meridiani Planum', theme: 'Rust', isNew: true,
    matches: ['Iron-rich crusts (ferricretes) formed when groundwater moved through rock', 'Desert pavement and wind-polished surfaces'],
    differs: ['Earth air is oxygen-rich, so iron rusts in different ways', 'Less studied: the analogy rests mainly on one 2018 conference abstract'],
    practise: ['Spotting iron concretions from a rover camera', 'Sampling crusts without breaking them'] },
  { place: 'Río Tinto', country: 'Spain', at: [37.69, -6.59], twinOf: 'Blueberry Fields · Meridiani Planum', theme: 'Rust',
    matches: ['Acid, iron-rich water that deposits hematite and jarosite, minerals Opportunity found', 'Life surviving in extreme acid'],
    differs: ['Liquid water flows today; on Mars it dried up billions of years ago', 'Earth’s biosphere makes the chemistry easier to read'],
    practise: ['Drilling for subsurface life (NASA’s MARTE tests ran here)', 'Telling biological from non-biological iron minerals'] },
  { place: 'Afar / Danakil cell 12.5°N 40.5°E', country: 'Ethiopia', at: [12.5, 40.5], twinOf: 'Layer Cake Mountain · Gale Crater', theme: 'Data-found', isNew: true,
    dataTarget: 'mars-gale', dataEarth: 'survey-afar-12p5N-40p5E',
    matches: ['Terrain slopes and shape close to the Gale window', 'Thermal inertia close to Gale’s, each ranked within its own world', 'EMIT sees hematite and sulfate, two of Gale’s three key mineral groups'],
    differs: ['Rift volcanism and heat, unlike Gale’s cold sedimentary basin', 'Its overall relief is lower than Gale’s'],
    practise: ['Reading layered sediments and salts from orbit and on foot', 'Operating in extreme heat and dust'] },
  { place: 'Lanzarote', country: 'Spain', at: [29.16, -13.44], twinOf: 'Volcano Row · Tharsis, and Cave Hills · Marius Hills', theme: 'Fire', photo: 'earth_lanzarote',
    matches: ['Young basalt lava fields with little plant cover', 'Walkable lava tubes (Cueva de los Verdes)'],
    differs: ['Its tubes are metres wide; low gravity may make Mars and Moon tubes hundreds of metres wide', 'Ocean air and occasional rain'],
    practise: ['Cave mapping and navigation without GPS (ESA PANGAEA and CAVES)', 'Geology fieldwork in spacesuit-like conditions'] },
  { place: 'Umm Jirsan', country: 'Saudi Arabia', at: [25.59, 39.67], twinOf: 'Cave Hills · Marius Hills', theme: 'Fire', isNew: true,
    matches: ['Longest known lava tube in Arabia, 1,481 m, in the dry Harrat Khaybar basalt field', 'Hot desert and a dusty cave floor'],
    differs: ['Tube far smaller than predicted lunar ones', 'People and animals have used it for thousands of years'],
    practise: ['Robot entry through collapse pits', 'Shelter design inside natural tunnels'] },
  { place: 'White Desert', country: 'Egypt', at: [27.36, 28.17], twinOf: 'Wind Sculpture Park · Medusae Fossae', theme: 'Wind', isNew: true,
    matches: ['Soft rock carved by wind into ridges and mushroom shapes', 'Seasonal dust storms (the Khamsin)'],
    differs: ['Chalk here, not the soft volcanic deposits of Medusae Fossae', 'Air about 100 times thicker, so wind erodes faster'],
    practise: ['Driving rovers across wind-cut terrain', 'Protecting solar panels and seals from dust'] },
  { place: 'McMurdo Dry Valleys', country: 'Antarctica', at: [-77.52, 161.85], twinOf: 'The Ice Cellar · Arcadia Planitia', theme: 'Ice', photo: 'earth_dry_valleys',
    matches: ['Cold, dry, nearly lifeless ground with buried ice', 'Our scorer also picks the nearby Transantarctic cells as terrain twins for lunar south-pole ridges'],
    differs: ['Air pressure about 100 times Mars’s, so ice can melt into brief streams', 'Mars is colder still'],
    practise: ['Drilling and sampling ground ice', 'Running long operations in polar cold and isolation'] },
  { place: 'Mauna Kea', country: 'Hawaiʻi, USA', at: [19.82, -155.47], twinOf: 'Sunny Ridges · lunar south pole', theme: 'Moon', dataTarget: 'moon-malapert-massif', dataEarth: 'earth-mauna-kea',
    matches: ['Terrain ranks 2nd of 469 Earth windows against the Malapert massif in our Twin Score', 'Volcanic ash and cinders, used for lunar soil tests'],
    differs: ['Air, weather and a sky that is not black', 'Basalt, while the lunar highlands are anorthosite'],
    practise: ['Making oxygen and water from soil (NASA ISRU field tests, 2008 and 2010)', 'Rover driving on loose slopes'] },
  { place: 'Kamil Crater', country: 'Egypt', at: [22.02, 26.09], twinOf: 'Starburst · Tycho', theme: 'Moon', isNew: true,
    matches: ['A fresh crater with bright ejecta rays still preserved', 'Remote, dry and wind-swept'],
    differs: ['45 m across, about 2,000 times smaller than Tycho', 'Made by an iron meteorite thousands of years ago, not a large asteroid'],
    practise: ['Mapping ejecta and finding meteorite fragments', 'Planning sampling traverses across rays'] },
];

// ---------------------------------------------------------------- Boots on the ground
export const FIELD_PAIRS: { slot: string; prompt: string; rover: string; caption: string }[] = [
  { slot: 'fayoum', prompt: 'Fayoum: old lake shoreline or layered lake sediment', rover: 'mars_jezero_delta', caption: 'Perseverance: Jezero delta' },
  { slot: 'pavement', prompt: 'Desert pavement or a scoop of sand', rover: 'mars_rocknest', caption: 'Curiosity at Rocknest' },
  { slot: 'concretion', prompt: 'Iron concretions or a red crust', rover: 'mars_berries', caption: 'Opportunity: hematite spherules' },
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
