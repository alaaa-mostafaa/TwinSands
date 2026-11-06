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
    earth: { tex: 'tex/earth_lst_day.webp', title: 'Land surface temperature, July 2024, day', source: 'MODIS Terra monthly LST via NASA GIBS', legend: { svg: 'legends/earth_lst.png', low: 'cold', high: 'hot' }, pins: [
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
    scoreTarget: 'mars-gale',
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
    id: 'ice', title: 'Ice', kicker: 'Buried water ice',
    question: 'Where is the water astronauts will need?',
    summary: 'Under Mars’s mid-latitudes lies ice, sometimes just centimetres down. Phoenix scraped it up in 2008 and watched it vanish into the thin air. At the lunar poles, hydrogen hints at ice hiding in the cold.',
    earth: { tex: 'tex/earth_snow.webp', title: 'Snow cover, January 2024', source: 'MODIS Terra monthly snow cover via NASA GIBS', legend: { svg: 'legends/earth_snow.png', low: 'none', high: 'full' }, pins: [
      { name: 'McMurdo Dry Valleys', at: [-77.52, 161.85], tone: 'twin', note: 'cold, dry, ground ice' },
      { name: 'Qaidam Basin, China', at: [37.5, 94.0], tone: 'twin' },
    ] },
    mars: { tex: 'tex/mars_base.webp', title: 'Polar caps and ice targets', source: 'Viking MDIM 2.1 colour mosaic, via Mars Trek', pins: [
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

// ---------------------------------------------------------------- Neighborhoods (postcards)
// there = photo of the Mars/Moon place, here = real photo of its Earth twin (keys in public/photos).
export type Hood = {
  nick: string; official: string; at: LatLon;
  story: string; same: string; diff: string;
  there: string; here?: string; twin: string; twinPlace?: string; twinAt?: LatLon;
  dataTarget?: string; noTwin?: boolean;
};

export const MARS_HOODS: Hood[] = [
  { nick: 'Mount Everything', official: 'Olympus Mons', at: [18.65, -133.8],
    story: 'Dear Earth, I’m standing on a volcano so wide its edges sink below the horizon. Olympus Mons is about 22 km tall, nearly three Everests, and about 600 km across. Your Mauna Loa was built the same way: runny lava, layer on layer, gentle slopes.',
    same: 'Both are shield volcanoes: gentle slopes made of thin, runny lava.',
    diff: 'Mars has no moving plates, so its volcano sat over one hot spot and kept growing, dozens of times bigger.',
    there: 'mars_olympus', here: 'pc_mauna_loa', twin: 'Mauna Loa', twinPlace: 'Hawaiʻi, USA', twinAt: [19.48, -155.6] },
  { nick: 'Volcano Row', official: 'Tharsis Montes', at: [-8.26, -120.09],
    story: 'Three giant volcanoes stand in a line, and on Arsia Mons orbiters spotted black holes in the ground: skylights that may drop into caves. In Lanzarote you can walk inside one of these tunnels, left behind when a river of lava drained away.',
    same: 'Lava tubes: tunnels made by flowing lava, natural shelters.',
    diff: 'With weaker gravity, Mars tubes could be about 100 times wider than Earth’s.',
    there: 'mars_skylights', here: 'pc_lava_tube', twin: 'Cueva de los Verdes lava tube', twinPlace: 'Lanzarote, Spain', twinAt: [29.16, -13.44] },
  { nick: 'The Grand Grand Canyon', official: 'Valles Marineris', at: [-13.9, -59.2],
    story: 'Valles Marineris would stretch from New York to Los Angeles: about 4,000 km long and up to 7 km deep. The Grand Canyon is 446 km long and about 1.8 km deep. Put it inside Valles Marineris and you might not find it.',
    same: 'Layered canyon walls that show deep time, rock by rock.',
    diff: 'A river carved the Grand Canyon. Valles Marineris mostly cracked open as the crust pulled apart.',
    there: 'mars_valles', here: 'pc_grand_canyon', twin: 'Grand Canyon', twinPlace: 'Arizona, USA', twinAt: [36.1, -112.1] },
  { nick: 'Blueberry Fields', official: 'Meridiani Planum', at: [-1.95, -5.53],
    story: 'In 2004 the rover Opportunity rolled onto plains scattered with tiny grey balls. Scientists called them blueberries. They are hematite, an iron mineral that grew inside wet rock. In Utah, groundwater made the same kind of iron balls: moqui marbles.',
    same: 'Iron balls grown by water moving through rock.',
    diff: 'Mars berries are a few millimetres wide; moqui marbles can reach golf-ball size.',
    there: 'mars_berries', here: 'pc_moqui', twin: 'Moqui marbles', twinPlace: 'Utah, USA', twinAt: [37.4, -111.6], dataTarget: 'mars-meridiani' },
  { nick: 'Mars’s Fayoum', official: 'Jezero Crater', at: [18.43, 77.44],
    story: 'About 3.5 billion years ago Jezero was a lake, and a river dropped mud and sand into it as a fan-shaped delta. Perseverance is collecting rocks there to look for signs of ancient life. Egypt’s Fayoum holds Lake Qarun, the shrunken leftover of a much bigger ancient lake.',
    same: 'A desert basin that once held a big lake fed by a river.',
    diff: 'Fayoum still has water and life. Jezero dried up billions of years ago.',
    there: 'mars_jezero_delta', here: 'pc_lake_qarun', twin: 'Lake Qarun', twinPlace: 'Fayoum, Egypt', twinAt: [29.47, 30.62], dataTarget: 'mars-jezero' },
  { nick: 'Layer Cake Mountain', official: 'Mount Sharp, Gale Crater', at: [-5.08, 137.85],
    story: 'Mount Sharp is a 5 km pile of rock layers, each one a page in Mars’s climate diary. Curiosity has been climbing it since 2014. We didn’t pick this twin by hand: our Twin Score scanned 469 places on Earth, and the Danakil desert in Ethiopia came out on top.',
    same: 'Slopes, ground type and minerals (hematite and sulfates) all match closely.',
    diff: 'Danakil is hot and volcanically alive; Gale is freezing and quiet.',
    there: 'mars_murray_buttes', here: 'pc_danakil', twin: 'Danakil desert', twinPlace: 'Afar, Ethiopia', dataTarget: 'mars-gale' },
  { nick: 'The Ice Cellar', official: 'Arcadia Planitia', at: [46.7, -170],
    story: 'Under Arcadia Planitia there is water ice, in places only a few centimetres down. NASA scientists say you could dig it with a shovel. In Antarctica’s Dry Valleys almost no snow falls, the wind is bone-dry, and ice hides under the gravel too.',
    same: 'A cold desert with ice under the ground.',
    diff: 'On Mars, ice left in the open turns straight into vapour; it never melts.',
    there: 'mars_ice_scarp', here: 'pc_wright_valley', twin: 'McMurdo Dry Valleys', twinPlace: 'Antarctica', twinAt: [-77.52, 161.85] },
  { nick: 'The Deep End', official: 'Hellas Planitia', at: [-42.4, 70.5],
    story: 'Hellas is a crater punched by an asteroid: about 2,300 km wide and more than 7 km deep. The Danakil Depression sits over 100 m below sea level and is one of the hottest places on Earth, with bright yellow salt springs at Dallol.',
    same: 'Both are deep, low basins far below their surroundings.',
    diff: 'An asteroid made Hellas; Danakil is Earth slowly tearing apart. This is a story pick our data doesn’t back yet.',
    there: 'pc_hellas', here: 'pc_dallol', twin: 'Dallol', twinPlace: 'Danakil, Ethiopia', twinAt: [14.24, 40.3] },
  { nick: 'Wind Sculpture Park', official: 'Medusae Fossae', at: [-5, -147],
    story: 'Here the wind is the artist. Sand blown for millions of years has carved soft rock into long ridges called yardangs, all lined up with the wind. In Egypt’s White Desert the wind has carved chalk into mushrooms and ice-cream cones.',
    same: 'Rock carved by wind and blowing sand.',
    diff: 'Mars air is about 100 times thinner, so the carving took far longer.',
    there: 'mars_yardangs', here: 'pc_white_desert', twin: 'White Desert', twinPlace: 'Farafra, Egypt', twinAt: [27.36, 28.17] },
  { nick: 'The Dust Bowl', official: 'Arabia Terra', at: [22.8, 5],
    story: 'Arabia Terra lies under thick dust. Sometimes a storm lifts dust around the whole planet; in 2018 one blocked the Sun and ended Opportunity’s mission. Every spring, Egypt’s Khamsin wind blows hot dust across the country for days.',
    same: 'Dust that gets into everything: air, solar panels, joints.',
    diff: 'Mars dust is finer than flour, and a single storm can wrap the whole planet.',
    there: 'mars_dust_storm', here: 'pc_sandstorm', twin: 'A Khamsin sandstorm', twinPlace: 'Egypt' },
  { nick: 'Old Town', official: 'Noachis Terra', at: [-45, -10],
    story: 'Noachis Terra is some of the oldest ground on Mars, about 4 billion years old and covered in craters. Egypt’s Kamil crater is the opposite: 45 m wide and only a few thousand years old, so fresh it shows exactly what an impact does. The photo is a piece of the iron meteorite that dug it. Nobody has shared an open photo of the crater yet, so that could be your job!',
    same: 'Ground shaped by space rocks hitting it.',
    diff: 'Old Town’s craters are huge and worn; Kamil is tiny and brand new.',
    there: 'pc_noachis', here: 'pc_kamil', twin: 'Kamil crater meteorite', twinPlace: 'Egypt', twinAt: [22.02, 26.09] },
  { nick: 'Frosty Top', official: 'Planum Boreum', at: [86, 15],
    story: 'Mars’s north pole wears a cap of water ice about 1,000 km wide and 3 km thick, with spiral valleys cut by the wind and a ring of dark dunes. Greenland’s ice sheet is a similar dome of layered water ice.',
    same: 'Layer after layer of water ice that records past climate.',
    diff: 'Every Martian winter the cap gets a coat of frozen carbon dioxide.',
    there: 'pc_mars_north_cap', here: 'pc_greenland', twin: 'Greenland ice sheet', twinPlace: 'Greenland', twinAt: [72.6, -38.5] },
  { nick: 'The Dry Ice Rink', official: 'Planum Australe', at: [-86.5, 0],
    story: 'The south pole is topped with frozen carbon dioxide, which is dry ice. Each summer pits sink into it, making a pattern scientists call Swiss cheese. Earth has no twin: even our coldest place, about −89 °C, is too warm for the tiny trace of CO₂ in our air to freeze.',
    same: 'Nothing on Earth.',
    diff: 'Mars’s pole drops to about −125 °C, cold enough to freeze its own air.',
    there: 'pc_swiss_cheese', twin: 'No twin on Earth', noTwin: true },
];

export const MOON_HOODS: Hood[] = [
  { nick: 'Sunny Ridges', official: 'Artemis III candidate rims (Malapert, de Gerlache, Shackleton)', at: [-85.99, -0.24],
    story: 'At the Moon’s south pole the Sun just skims the horizon. Some ridge tops stay lit most of the year, which is great for solar power, and ice sits in the shadows nearby. That’s why all nine Artemis III landing regions are here. Our Twin Score’s best Earth match is in Antarctica.',
    same: 'Steep, rugged polar ridges with a low Sun.',
    diff: 'No air, one-sixth gravity, and shadows far colder than Antarctica.',
    there: 'moon_south_pole', here: 'pc_transantarctic', twin: 'Transantarctic Mountains', twinPlace: 'Antarctica', dataTarget: 'moon-malapert-massif' },
  { nick: 'The Ice Cellars', official: 'Permanently shadowed craters (Shackleton, Haworth, Faustini)', at: [-89.67, 129.78],
    story: 'Some crater floors here have not seen sunlight in billions of years. They are among the coldest places ever measured in the solar system, below −230 °C, cold enough to trap water ice. That ice could become drinking water, air to breathe and rocket fuel.',
    same: 'Nothing on Earth.',
    diff: 'Earth’s coldest spot is about −89 °C, nowhere near this cold.',
    there: 'moon_south_pole', twin: 'No twin on Earth', noTwin: true },
  { nick: 'The Giant Bowl', official: 'South Pole–Aitken basin', at: [-53, -169],
    story: 'About 2,500 km across, this is one of the biggest impact craters in the solar system. Sudbury in Canada is one of Earth’s largest. Apollo 16 and 17 astronauts trained there to recognise rock that a giant impact had smashed and melted, like the rock in this photo.',
    same: 'Rock smashed and melted by a giant impact.',
    diff: 'Sudbury is worn down and covered by forest and lakes; the lunar basin is untouched.',
    there: 'pc_spa', here: 'pc_sudbury', twin: 'Sudbury impact rock', twinPlace: 'Ontario, Canada', twinAt: [46.6, -81.18] },
  { nick: 'The Bright Old Country', official: 'Lunar highlands', at: [-8.97, 15.5],
    story: 'The bright parts of the Moon are made of anorthosite, a very old, light-coloured rock. Mistastin crater in Labrador is one of the few places on Earth where an asteroid hit anorthosite, and Artemis astronauts have trained there.',
    same: 'The same light rock, broken up by an impact.',
    diff: 'Mistastin has a lake, trees and weather.',
    there: 'moon_apollo17', here: 'pc_mistastin', twin: 'Mistastin crater', twinPlace: 'Labrador, Canada', twinAt: [55.88, -63.31] },
  { nick: 'First Footprints', official: 'Mare Tranquillitatis', at: [0.67, 23.47],
    story: 'On 20 July 1969, Apollo 11 landed on this flat lava plain. The Moon’s dark “seas” are old basalt lava. Lanzarote’s lava fields are young basalt, black and bare, and the European Space Agency trains astronauts there.',
    same: 'Flat, dark plains of basalt lava.',
    diff: 'Moon lava cooled more than 3 billion years ago; Lanzarote’s about 300 years ago.',
    there: 'moon_bootprint', here: 'pc_lanzarote_plain', twin: 'Lanzarote lava fields', twinPlace: 'Canary Islands, Spain', twinAt: [29.0, -13.75] },
  { nick: 'The Lava Ocean', official: 'Oceanus Procellarum', at: [18.4, -57.4],
    story: 'The Ocean of Storms is the Moon’s biggest dark lava plain, about 2,500 km across. It is not water, it is frozen lava. In Hawaiʻi you can watch the same kind of runny basalt lava flow today.',
    same: 'Runny basalt lava spreading into wide sheets.',
    diff: 'Hawaiian lava is still hot; the Moon’s went quiet billions of years ago.',
    there: 'pc_procellarum', here: 'pc_pahoehoe', twin: 'Pāhoehoe lava', twinPlace: 'Hawaiʻi, USA', twinAt: [19.41, -155.28] },
  { nick: 'Splash Sea', official: 'Mare Imbrium', at: [32.8, -15.6],
    story: 'A giant impact blasted out this basin, about 1,100 km wide, and later lava flooded it. We haven’t found its Earth twin yet. Earth’s big impact basins have mostly been worn away by weather or buried. Could you find one?',
    same: 'Still searching.',
    diff: 'On Earth, weather and moving plates erase old basins.',
    there: 'pc_imbrium', twin: 'Still to find' },
  { nick: 'Cave Hills', official: 'Marius Hills', at: [14.09, -56.78],
    story: 'In 2009 a Japanese orbiter found a hole about 65 m wide here. It may be a skylight into a lava tube, a ready-made shelter from radiation and wild temperature swings. Earth has tubes like it in Lanzarote and in Saudi Arabia’s Umm Jirsan, where people sheltered thousands of years ago.',
    same: 'A hole into a tunnel left by flowing lava.',
    diff: 'Moon tubes may be about 1,000 times wider than Earth’s, thanks to low gravity.',
    there: 'moon_marius_pit', here: 'pc_lava_tube_mouth', twin: 'Lava tube entrance', twinPlace: 'Lanzarote, Spain', twinAt: [29.16, -13.44] },
  { nick: 'Starburst', official: 'Tycho Crater', at: [-43.31, -11.36],
    story: 'Tycho is about 85 km wide and young for the Moon, roughly 108 million years old. Its bright rays of splashed rock stretch across the Moon; you can see them with binoculars at full Moon. Egypt’s Kamil crater is a tiny version, with its bright rays still intact. Here is a chunk of the iron meteorite that made it.',
    same: 'A fresh crater with bright rays of thrown-out rock.',
    diff: 'Kamil is 45 m wide, about 2,000 times smaller than Tycho.',
    there: 'moon_tycho', here: 'pc_kamil', twin: 'Kamil crater meteorite', twinPlace: 'Egypt', twinAt: [22.02, 26.09] },
  { nick: 'The Hidden Side', official: 'Far side', at: [0, 180],
    story: 'We always see the same face of the Moon. The far side isn’t dark; it gets just as much sunshine. But radio signals from Earth can’t reach it, so when China’s Chang’e 4 landed there in 2019 it needed a relay satellite to call home.',
    same: 'Nothing on Earth.',
    diff: 'No place on Earth is cut off from radio like this.',
    there: 'moon_far_side', twin: 'No twin on Earth', noTwin: true },
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
    moon: { file: 'moon_orange_soil', what: 'Apollo 17, 1972: geologist Harrison Schmitt finds orange soil on the Moon.' },
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
    moon: { file: 'moon_hammer_feather', what: 'No air, no wind. Apollo 15, 1971: a hammer and a feather dropped together land together.' },
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
export type Sense = { see: string[]; smell: { items: string[]; text: string }; feel: { big: string; small: string; img?: string } };
export const SENSES: Record<string, Partial<Record<WorldId, Sense>>> = {
  rust: {
    earth: { see: ['earth_rio_tinto', 'pc_moqui'], smell: { items: ['coins', 'match'], text: 'Old coins and a whiff of sulfur' }, feel: { big: 'pH 2', small: 'acid water that stings like lemon juice', img: 'lemon' } },
    mars: { see: ['mars_berries', 'mars_opportunity_shadow'], smell: { items: ['egg'], text: 'Rotten eggs: heated Mars rock gave off hydrogen sulfide' }, feel: { big: '−63 °C', small: 'average day on Mars' } },
    moon: { see: ['moon_orange_soil', 'moon_apollo17'], smell: { items: ['sparkler'], text: 'Spent gunpowder, said every Apollo crew' }, feel: { big: '+120 °C', small: 'in sunlight, then −130 °C at night' } },
  },
  soil: {
    earth: { see: ['pc_lanzarote_plain', 'earth_salar_atacama'], smell: { items: ['rain'], text: 'Rain on dry dirt' }, feel: { big: 'Soft', small: 'black volcanic sand that shifts underfoot', img: 'sand' } },
    mars: { see: ['mars_rocknest', 'mars_phoenix_soil'], smell: { items: ['match', 'chalk'], text: 'Sunbaked sulfur and chalk' }, feel: { big: 'Sticky', small: 'fine dust clings to wheels and suits', img: 'velcro' } },
    moon: { see: ['moon_bootprint', 'moon_apollo17'], smell: { items: ['sneeze'], text: 'Moon dust gave Harrison Schmitt hay fever' }, feel: { big: 'Sharp', small: 'dust edged like broken glass', img: 'glass' } },
  },
  fire: {
    earth: { see: ['pc_pahoehoe', 'pc_lava_tube'], smell: { items: ['match'], text: 'A just-struck match: sulfur dioxide from the hot lava' }, feel: { big: '1,150 °C', small: 'fresh Hawaiian lava' } },
    mars: { see: ['mars_olympus', 'mars_skylights'], smell: { items: ['soda'], text: 'Nothing: the air is 95% CO₂, the fizz in soda' }, feel: { big: '−63 °C', small: 'old lava, cold for millions of years' } },
    moon: { see: ['moon_marius_pit', 'pc_procellarum'], smell: { items: ['weld'], text: 'Hot metal and welding fumes: what astronauts smell on their suits after a spacewalk' }, feel: { big: '17 °C', small: 'steady inside a lunar pit, day and night' } },
  },
  wind: {
    earth: { see: ['pc_white_desert', 'pc_sandstorm'], smell: { items: ['sandpile'], text: 'Hot, dry, earthy dust in the air' }, feel: { big: '100 km/h', small: 'a desert storm that stings your face', img: 'windsock' } },
    mars: { see: ['mars_dust_devil_hirise', 'mars_yardangs'], smell: { items: ['chalk'], text: 'A clapped chalkboard eraser' }, feel: { big: 'Gentle', small: 'even 100 km/h feels like a breeze in air this thin', img: 'feather' } },
    moon: { see: ['moon_flag', 'moon_bootprint'], smell: { items: [], text: 'Nothing. No air to carry a smell.' }, feel: { big: 'Still', small: 'no wind, ever: footprints stay for ages' } },
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
