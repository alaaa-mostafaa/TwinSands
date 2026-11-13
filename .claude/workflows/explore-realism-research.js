export const meta = {
  name: 'explore-realism-research',
  description: 'Research how to make the Explore Mars/Moon walk environments realistic: planetary reference, three.js techniques, far-terrain data',
  phases: [
    { title: 'Research', detail: 'Mars reference, Moon reference, three.js techniques, far-terrain data feasibility' },
  ],
}

const CONTEXT = `
Project: /Users/mohamedrashad/Desktop/NASA/twin — a React 18 + Vite + TypeScript site (NASA Space Apps). Its "Explore" section lets you walk in first person on real terrain of Mars and Moon sites. The 3D scene is ONE file: src/three/TerrainWalk.tsx (~770 lines); the section/UI is src/sections/Explore.tsx; site data/text in src/content.ts (REGIONS near line 693). Libraries (exact, do not assume newer APIs): three 0.169.0, @react-three/fiber 8.17.10, @react-three/drei 9.114.0. No postprocessing package is installed (three/examples/jsm is available). Terrain: public/terrain/<id>.bin = 256x256 uint16 heights over a 12 km x 12 km window (so ~47 m between height samples); index.json gives min/max/source; mars-olympus and moon-highlands also have a 200x200 "far" grid over 120 km. Pipeline scripts in pipeline/ (Python) made these (pipeline/fetch_terrain.py).
The six walkable regions (ids): mars-gale (Gale crater floor, Curiosity's plain, Aeolis Palus), mars-jezero (Jezero crater, Perseverance; shown in a made-up dust storm), mars-olympus (inside the summit caldera of Olympus Mons, ~18 km up), moon-shackleton-rim (rim of Shackleton crater at the lunar south pole), moon-malapert-massif (Malapert massif near the south pole), moon-highlands (Apollo 16 Descartes highlands, near-side central highlands).
Current look (what is wrong): no shadows at all (objects float); ground is a vertex-coloured mesh at 47 m resolution with a tiled 256px canvas "grain" texture whose pebbles are flat dark dots (reads like leopard spots); rocks are flat-shaded noisy icosahedra, bedrock "slabs" are octagonal cylinders that look like manhole covers, Gale "layered outcrops" are stacked flat plates that look like pancakes; Mars sky is a flat 2-colour vertical gradient sphere with linear fog, no sun disk/halo; Moon uses Lambert-ish MeshStandardMaterial ground + hemisphere light, black sky with many bright drei <Stars>, Earth sphere in sky; sun direction is set relative to the landing view; no environment map so the NASA Perseverance GLB looks flat; dust storm (Jezero) = FogExp2 + 5000 points.
Goal from the user: "make the walk more realistic, I mean the environments". Mobile is out of scope. Target: desktop browsers with a normal laptop GPU at 60 fps.
`

const MARS_SCHEMA = { type: 'object', required: ['sites', 'general'], properties: {
  general: { type: 'array', items: { type: 'string' }, description: 'Facts that apply to all Mars surface scenes (sky colour by time of day and angle from sun, haze/aerial perspective, shadow colour/softness, dust, colour of light), each with a number where possible and a source' },
  sites: { type: 'array', items: { type: 'object', required: ['id', 'facts'], properties: {
    id: { type: 'string' }, facts: { type: 'array', items: { type: 'string' } },
    visual_targets: { type: 'array', items: { type: 'string' }, description: 'concrete things a viewer should see, e.g. ground colour hex, rock types/sizes/density, what is on the horizon and how far/tall' },
  } } },
  sources: { type: 'array', items: { type: 'string' } },
} }
const MOON_SCHEMA = MARS_SCHEMA
const TECH_SCHEMA = { type: 'object', required: ['techniques', 'perf_notes'], properties: {
  techniques: { type: 'array', items: { type: 'object', required: ['name', 'impact', 'cost', 'how'], properties: {
    name: { type: 'string' }, impact: { type: 'string', description: 'realism gain, high/med/low + why' },
    cost: { type: 'string', description: 'GPU/CPU/bundle cost and complexity' },
    how: { type: 'string', description: 'concrete implementation plan for THIS code with three 0.169 / r3f 8 / drei 9.114: which components/functions to change, APIs (verify they exist in node_modules), shader snippets where useful' },
    risks: { type: 'string' },
  } } },
  perf_notes: { type: 'array', items: { type: 'string' } },
  api_checks: { type: 'array', items: { type: 'string' }, description: 'APIs you verified exist in node_modules, with file paths' },
} }
const DATA_SCHEMA = { type: 'object', required: ['feasible', 'summary'], properties: {
  feasible: { type: 'boolean' }, summary: { type: 'string' },
  per_region: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, plan: { type: 'string' }, source_dataset: { type: 'string' }, what_appears_on_horizon: { type: 'string' } } } },
  commands: { type: 'array', items: { type: 'string' } },
  code_changes: { type: 'array', items: { type: 'string' } },
  risks: { type: 'array', items: { type: 'string' } },
} }

phase('Research')
const [mars, moon, tech, data] = await parallel([
  () => agent(`${CONTEXT}
TASK: Be the planetary-science reference for making the THREE MARS scenes look like real Mars surface photos (Curiosity/Perseverance Mastcam, Navcam, HiRISE context). Use web search. For each site (mars-gale, mars-jezero, mars-olympus) and in general, collect concrete, sourced, numeric visual facts that a 3D artist can implement:
- Sky: colour (hex or RGB) near horizon vs zenith, at midday vs near the sun (the bluish forward-scattering halo around the sun), the Sun's apparent size from Mars (~0.35 deg, ~2/3 of Earth's), how dusty/tau typical at each site/season, how far you can see (visibility / horizon haze), blue sunsets (only relevant if we did sunset).
- Light: colour of direct sunlight on Mars, shadow darkness/colour (shadows are lit by the reddish sky so they are not black), contrast in rover photos.
- Ground: soil colour (dusty reddish-brown) vs darker basaltic sand vs grey fresh rock; typical rock size distribution and density on each plain (e.g. Gale Aeolis Palus / Bradbury landing pebbly ground, Jezero crater floor (Máaz/Séítah) with rocks and ripples, Olympus summit caldera dusty low-thermal-inertia); bedrock textures (Gale mudstone slabs cracked into polygons, Jezero layered rocks), ripples/megaripples spacing and height.
- Horizon: what a person at each site would see in the distance and how big (e.g. Mount Sharp/Aeolis Mons ~5.5 km above the floor about 15-20 km south of the landing site; Jezero crater rim ~ 45 km diameter, rim height; Olympus caldera walls up to ~3 km).
- The dust storm look for Jezero (visibility, colour, sun as a dim disk or invisible).
Return precise numbers and colours with sources. Prefer NASA/JPL, USGS, peer-reviewed. Do NOT edit any files.`, { label: 'mars-reference', phase: 'Research', schema: MARS_SCHEMA }),

  () => agent(`${CONTEXT}
TASK: Be the planetary-science reference for making the THREE MOON scenes look like real Apollo / LRO-based imagery. Use web search. For each site (moon-shackleton-rim, moon-malapert-massif, moon-highlands = Apollo 16 Descartes) and in general, collect concrete, sourced, numeric visual facts a 3D artist can implement:
- Sun elevation range at the south pole (it never rises more than ~1.5-2 deg above the horizon; illumination from the side; extremely long shadows), and at Apollo 16 site during the mission (sun elevation ~ 10-45 deg over the 3 EVAs).
- Photometry: lunar regolith is NOT Lambertian; it follows roughly Lommel-Seeliger/Hapke: no limb darkening, strong opposition surge (brightening toward zero phase / heiligenschein around the observer's shadow), backscattering. Give a practical shading formula usable in a fragment shader (e.g. Lommel-Seeliger mu0/(mu0+mu) with a phase function / opposition term, or the McEwen lunar-Lambert blend with L(phase)). Albedo numbers: mare ~0.07, highlands ~0.12-0.18 (normal albedo); colours (very slightly warm grey/brownish).
- Shadows: almost black except light from sunlit terrain nearby and earthshine; how dark in Apollo photos.
- Sky: black; stars are NOT visible in sunlit daytime photos (camera exposure) — recommend what to show; Earth's apparent size from the Moon (~1.9 deg, ~4x Moon from Earth) and where it is from the south pole (near the horizon) and from Apollo 16 (high in the sky); earthshine.
- Ground details: regolith texture, small craters at all scales (size-frequency: many small craters, fresh ones bright with rays/ejecta blocks), boulders around fresh craters, rocks, "elephant hide" texture on slopes, Apollo 16 rocks (breccia, anorthosite), how much of the ground is rock-free.
- Horizon at the pole: what is visible (e.g. from Shackleton rim, the crater interior is in permanent shadow; distant massifs like Malapert/Mons Mouton lit; horizon distance ~2.4 km for a person on flat ground (moon radius 1737 km)).
Return precise numbers with sources (NASA, LROC, USGS, LPI, peer-reviewed). Do NOT edit any files.`, { label: 'moon-reference', phase: 'Research', schema: MOON_SCHEMA }),

  () => agent(`${CONTEXT}
TASK: Read src/three/TerrainWalk.tsx and src/sections/Explore.tsx fully, then produce a ranked list of concrete rendering techniques that would make these environments look most realistic for the cost, implementable with three 0.169 / @react-three/fiber 8.17 / drei 9.114 WITHOUT new npm packages (three/examples/jsm is allowed). Verify every API you recommend actually exists in /Users/mohamedrashad/Desktop/NASA/twin/node_modules (grep the source) and list those checks. Cover at least:
1. Shadows: a directional-light shadow map that follows the walker (tight frustum ~150-300 m around the camera, texel snapping to avoid shimmer, PCFSoft/VSM choice, bias/normalBias for terrain), which meshes cast/receive (instanced rocks, rover GLB, astronaut, ground). Moon needs very long low-sun shadows; consider also casting terrain self-shadows on far hills (cheap horizon/height-field shadowing in the ground shader, e.g. precomputed per-vertex sun-visibility by marching the heightmap toward the sun on the CPU at load — 256x256 grid is small).
2. Ground material: replace the vertex colour + canvas grain with a shader (MeshStandardMaterial.onBeforeCompile to keep lights/shadows/fog) doing multi-scale procedural detail: world-space fbm albedo variation at 3+ scales with distance-based blending (no visible tiling), procedural detail NORMALS (bumps, pebbles, ripples for Mars, small craters for the Moon) computed from noise derivatives, slope/curvature-based rock exposure, dust in hollows. Give GLSL.
3. Near-field geometric detail: the 47 m grid is smooth at your feet. Options: a second high-res ground patch (e.g. 256x256 verts over ~200 m) following the camera with procedural displacement added on top of bilinear terrain height (and matching heightAt() so walker/rover/rocks sit on it), or tessellation via vertex displacement in shader. Recommend one, with seam handling against the coarse mesh (skirt/blend/push coarse down) and how heightAt for gameplay must include the same displacement.
4. Lunar photometry: Lommel-Seeliger / lunar-Lambert + opposition surge in the ground shader for moon only.
5. Mars sky + aerial perspective: physically-inspired analytic Mars sky shader (butterscotch with bluish forward scattering around the sun, sun disk + glow), height-and-distance fog that matches the sky colour toward the view direction (sun-side warmer/bluer), applied to terrain via onBeforeCompile fog chunk replacement or custom fog uniform.
6. Image-based lighting: PMREM environment from the sky (e.g. render the sky scene into a PMREMGenerator.fromScene once) so the PBR rover/astronaut look grounded; per-world envMapIntensity.
7. Rocks: better procedural rock geometry (several variants; e.g. displaced icospheres with ridged noise + flattening + sharp facets, half-buried with a dusty skirt), size-frequency (many small, few big; power law), clustering, partial burial; Gale mudstone as cracked polygonal plates flush with the ground (not cylinders); outcrop layers that look eroded. Instanced, with per-instance colour variation, casting shadows.
8. Tone mapping/exposure/colour: ACES vs AgX availability in 0.169 (check), exposure per world, sRGB; optional cheap postprocessing from three/examples/jsm (EffectComposer + SSAO/GTAO? check availability & cost) — or a cheap fake AO (contact darkening under rocks via decals). Recommend whether worth it.
9. Moon sky: what to do with stars and Earth (lit Earth with terminator/earthshine phase consistent with sun direction).
10. Performance budget and the order to implement for maximum visual gain. Note the headless test environment is SwiftShader (slow), but the target is real GPUs.
Do NOT edit any files.`, { label: 'three-techniques', phase: 'Research', schema: TECH_SCHEMA }),

  () => agent(`${CONTEXT}
TASK: Determine whether we can add a real "far" backdrop terrain (wide, coarse elevation grid like mars-olympus and moon-highlands already have: 200x200 over 120 km, file public/terrain/<id>.far.bin + "far" entry in public/terrain/index.json) for the regions that lack one: mars-gale, mars-jezero, moon-shackleton-rim, moon-malapert-massif. Why: today Gale/Jezero end at a 6 km edge hidden by fog, so you can't see Mount Sharp (Aeolis Mons) on the horizon or Jezero's rim; Moon pole sites lack distant massifs.
Steps: read pipeline/fetch_terrain.py fully (how windows are cut, which datasets, how 'far' is produced for olympus/highlands, how .bin is written (uint16 normalised min..max), the window centre/coordinates used for each region, and projection handling). Read public/terrain/index.json. Then work out, for each of the four regions: the window centre lat/lon used; which global/regional DEM can supply a 120 km window (Mars: the HRSC+MOLA blended global DEM 200 m/px COG already used for Olympus; Moon south pole: an equirectangular global DEM is badly distorted at -89.5 deg, so find a polar-stereographic LOLA product, e.g. the LOLA 'LDEM_80S' / 'LOLA south pole 20m/40m/80m/120m polar stereographic' mosaics on planetarymaps.usgs.gov or pgda.gsfc.nasa.gov, ideally a cloud-optimised GeoTIFF readable with rasterio windowed reads over HTTP); how to reproject/sample it into the same local x/y frame and orientation as the existing 12 km window (north up? check how existing near windows are oriented, especially for polar stereographic Barker DEMs vs equirectangular) so the near and far grids line up; and the elevation reference (near windows may be relative to a different datum/areoid than the far DEM — check the existing olympus/highlands case and how the code tucks the near map 40 m under (Backdrop in src/three/TerrainWalk.tsx)). Check whether the network is reachable from this machine (e.g. curl -I one of the URLs with a short timeout) and whether python deps exist (try: python3 -c 'import rasterio, numpy'; also check for a .venv in the repo). You MAY run read-only network probes (HEAD requests, small range reads) but do NOT write into the repo and do NOT run the full pipeline. Report: feasible or not, per-region plan with dataset URLs, exact commands that would run it, code changes needed in fetch_terrain.py and TerrainWalk.tsx (e.g. Backdrop must handle a vertical datum offset), and risks (alignment, seams, datum).`, { label: 'far-terrain-data', phase: 'Research', schema: DATA_SCHEMA }),
])

return { mars, moon, tech, data }
