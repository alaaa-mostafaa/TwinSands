import { Html, useGLTF, useTexture } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import Safe3D from '../components/Safe3D';
import { cavity, litFraction, PLANET_R, sunHorizon } from './walk/horizon';
import { fbm3, makeRock, mulberry32, vnoise } from './walk/rocks';
import { makeDustSheetMaterial, makeSkyMaterial, patchMaterial, U } from './walk/shading';
import { QUESTS, QuestTarget, type QuestState } from './walk/Quest';

export type Terrain = { n: number; size: number; min: number; max: number; h: Float32Array; far?: Terrain };
export type Keys = { f: boolean; b: boolean; l: boolean; r: boolean; tl: boolean; tr: boolean; run: boolean };
type RGB = [number, number, number];

/** How the ground looks up close. The shape is real elevation data; the surface dressing is per region and
 *  follows what rovers and astronauts photographed there. Colours are linear albedos (how much light the surface
 *  reflects): Mars dust about 0.25, dark basalt sand about 0.1, Moon highland soil about 0.15. */
export type GroundStyle = {
  sand: RGB; dark: RGB; rock: RGB; slab: RGB; peb: RGB;
  pebbles: number;          // 0..1 pebble cover
  ripples: number;          // 0 = none, 1 = strong wind ripples
  plates: number;           // 0..1 flat bedrock plates, cracked, flush with the ground
  plateSize: number;        // metres across one plate
  darkAmt: number;          // dark sand patches
  streaks?: number;         // long dark wind streaks (Olympus)
  rockK: number;            // fraction of ground covered by rocks (Golombek & Rapp 1997 size model)
  rockCol: RGB;             // dust-free rock
  dust: number;             // 0..1 dust settled on the tops of rocks
  outcrops?: number;        // chance per 30 m cell of a low layered outcrop
  bands?: [string, string]; // its alternating layer colours
  clusters?: number;        // chance per cell of a cluster of blocks thrown out by a small impact
  storm?: boolean;          // dust storm: haze, a dim Sun, blowing dust, the rover puts its gear on
  high?: boolean;           // very high up: thin, clear air, darker sky
  sunHigh?: boolean;        // near the Moon's equator: Sun higher, Earth high overhead
  sunElev?: number;         // Moon poles: the Sun's height in degrees (it skims the horizon there)
  exposure?: number;
};
const MARS_SAND: GroundStyle = {
  sand: [0.3, 0.165, 0.085], dark: [0.13, 0.09, 0.06], rock: [0.16, 0.11, 0.08], slab: [0.24, 0.17, 0.11], peb: [0.1, 0.08, 0.065],
  pebbles: 0.4, ripples: 0.5, plates: 0, plateSize: 1, darkAmt: 0.3, rockK: 0.012, rockCol: [0.08, 0.068, 0.058], dust: 0.6,
};
const MOON_DUST: GroundStyle = {
  sand: [0.16, 0.15, 0.135], dark: [0.13, 0.12, 0.11], rock: [0.15, 0.14, 0.13], slab: [0.17, 0.16, 0.15], peb: [0.21, 0.2, 0.19],
  pebbles: 0.12, ripples: 0, plates: 0, plateSize: 1, darkAmt: 0.2, rockK: 0.003, rockCol: [0.17, 0.16, 0.15], dust: 0.35, clusters: 0.035,
};
export const STYLES: Record<string, GroundStyle> = {
  // Gale (Yellowknife Bay, the Kimberley, the Murray formation): exposed bedrock everywhere. Flat cracked mudstone
  // pavement, ledges of layered and cross-bedded sandstone with broken blocks at their feet, gravel and dark sand only
  // in the gaps.
  'mars-gale': { ...MARS_SAND, sand: [0.2, 0.105, 0.06], dark: [0.14, 0.08, 0.05], rock: [0.22, 0.16, 0.115], slab: [0.3, 0.19, 0.13], peb: [0.11, 0.09, 0.075],
    pebbles: 0.25, ripples: 0, plates: 0.88, plateSize: 1.1, darkAmt: 0.15, rockK: 0.02, rockCol: [0.1, 0.085, 0.072], dust: 0.5, clusters: 0.06,
    outcrops: 0.85, bands: ['#a87258', '#c08f72'] },
  // Jezero floor (Máaz): dusty soil and dark sand, flat light 'paver' rocks, clusters of blocky dark rocks on low rises.
  // The haze is a heavy dust storm (optical depth ~4), thicker than the one Perseverance watched in January 2022 (~2).
  'mars-jezero': { ...MARS_SAND, sand: [0.3, 0.17, 0.09], dark: [0.11, 0.08, 0.055], rock: [0.13, 0.09, 0.065], slab: [0.28, 0.21, 0.15], peb: [0.08, 0.07, 0.06],
    pebbles: 0.35, ripples: 0.6, plates: 0.3, plateSize: 1.6, darkAmt: 0.45, rockK: 0.022, rockCol: [0.06, 0.055, 0.045], dust: 0.55, clusters: 0.06, storm: true },
  // Olympus Mons summit: a thick blanket of bright fine dust (very low thermal inertia), dark wind streaks, few rocks.
  'mars-olympus': { ...MARS_SAND, sand: [0.34, 0.2, 0.11], dark: [0.17, 0.1, 0.06], rock: [0.12, 0.08, 0.06], peb: [0.12, 0.08, 0.06],
    pebbles: 0.08, ripples: 0.25, darkAmt: 0.2, streaks: 0.6, rockK: 0.004, rockCol: [0.07, 0.055, 0.045], dust: 0.8, high: true },
  // Lunar highlands (Apollo 16, Descartes): bright anorthosite soil, rocks mostly near small fresh craters, Sun ~30° up.
  'moon-highlands': { ...MOON_DUST, sand: [0.19, 0.175, 0.16], dark: [0.16, 0.15, 0.14], peb: [0.26, 0.25, 0.24], rockK: 0.005, rockCol: [0.22, 0.21, 0.2],
    pebbles: 0.15, sunHigh: true, exposure: 1.25 },
  // Lunar south pole: the Sun skims the horizon, so sunlit rims and slopes blaze and everything lower is in shadow.
  'moon-shackleton-rim': { ...MOON_DUST, sunElev: 3, exposure: 1.7 },
  'moon-malapert-massif': { ...MOON_DUST, sunElev: 5, exposure: 1.6 },
};
export const styleFor = (id: string, world: 'mars' | 'moon') => STYLES[id] ?? (world === 'mars' ? MARS_SAND : MOON_DUST);

/** The air: sky colours (linear radiance), dust optical depth, haze, sunlight. Mars values follow Curiosity and
 *  Perseverance sky measurements: butterscotch sky, dust optical depth ~0.6 on a normal day, much less on Olympus. */
type Atmos = { zen: RGB; hor: RGB; tau: number; aur: number; fogB: number; fogH: number; sunI: number; sunCol: string; env: number; exposure: number; shadow: number };
const ATMOS: Record<'mars' | 'high' | 'storm' | 'moon', Atmos> = {
  mars: { zen: [0.36, 0.215, 0.13], hor: [0.62, 0.37, 0.21], tau: 0.6, aur: 1, fogB: 4.5e-5, fogH: 11000, sunI: 4.4, sunCol: '#fff4e6', env: 1, exposure: 1.05, shadow: 1 },
  high: { zen: [0.075, 0.05, 0.045], hor: [0.4, 0.24, 0.14], tau: 0.12, aur: 0.3, fogB: 1.2e-5, fogH: 11000, sunI: 5.2, sunCol: '#fffaf2', env: 0.8, exposure: 1.0, shadow: 1 },
  storm: { zen: [0.34, 0.12, 0.035], hor: [0.52, 0.2, 0.055], tau: 4.0, aur: 0.9, fogB: 1.5e-3, fogH: 900, sunI: 0.75, sunCol: '#ffd2a0', env: 1.8, exposure: 1.3, shadow: 0.25 },
  moon: { zen: [0, 0, 0], hor: [0, 0, 0], tau: 0, aur: 0, fogB: 0, fogH: 1, sunI: 5, sunCol: '#ffffff', env: 1, exposure: 1.5, shadow: 1 },
};

const EYE = 2;            // metres above the ground
const WALK = 18, RUN = 70; // metres per second: sped up so a 12 km map is explorable

export async function loadTerrain(id: string): Promise<Terrain> {
  const [meta, buf] = await Promise.all([
    fetch('terrain/index.json').then((r) => r.json()),
    fetch(`terrain/${id}.bin`).then((r) => r.arrayBuffer()),
  ]);
  const m = meta[id];
  const decode = (b: ArrayBuffer, mm: { n: number; size_m: number; min: number; max: number }): Terrain => {
    const q = new Uint16Array(b), h = new Float32Array(q.length);
    for (let i = 0; i < q.length; i++) h[i] = mm.min + (q[i] / 65535) * (mm.max - mm.min);
    return { n: mm.n, size: mm.size_m, min: mm.min, max: mm.max, h };
  };
  const t = decode(buf, m);
  if (m.far) t.far = decode(await fetch(`terrain/${id}.far.bin`).then((r) => r.arrayBuffer()), m.far);   // wide low-detail backdrop
  return t;
}

/** Bilinear height at world (x, z); x east, z south, origin at the window centre. */
export function heightAt(t: Terrain, x: number, z: number) {
  const g = (t.n - 1) / t.size;
  const c = Math.min(t.n - 1.001, Math.max(0, (x + t.size / 2) * g));
  const r = Math.min(t.n - 1.001, Math.max(0, (z + t.size / 2) * g));
  const c0 = Math.floor(c), r0 = Math.floor(r), fc = c - c0, fr = r - r0;
  const H = (rr: number, cc: number) => t.h[rr * t.n + cc];
  return (H(r0, c0) * (1 - fc) + H(r0, c0 + 1) * fc) * (1 - fr) + (H(r0 + 1, c0) * (1 - fc) + H(r0 + 1, c0 + 1) * fc) * fr;
}

/** Height of the drawn ground mesh itself (its two triangles per cell), for things that must sit exactly on it. */
export function meshHeightAt(t: Terrain, x: number, z: number) {
  const g = (t.n - 1) / t.size;
  const c = Math.min(t.n - 1.001, Math.max(0, (x + t.size / 2) * g));
  const r = Math.min(t.n - 1.001, Math.max(0, (z + t.size / 2) * g));
  const c0 = Math.floor(c), r0 = Math.floor(r), fc = c - c0, fr = r - r0;
  const H = (rr: number, cc: number) => t.h[rr * t.n + cc];
  const A = H(r0, c0), B = H(r0 + 1, c0), C = H(r0 + 1, c0 + 1), D = H(r0, c0 + 1);
  return fc + fr <= 1 ? A + (D - A) * fc + (B - A) * fr : C + (B - C) * (1 - fc) + (D - C) * (1 - fr);
}

function Ground({ t, world, st }: { t: Terrain; world: 'mars' | 'moon'; st: GroundStyle }) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(t.size, t.size, t.n - 1, t.n - 1);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, t.h[i]);
    g.computeVertexNormals();
    g.setAttribute('cav', new THREE.BufferAttribute(cavity(t), 1));
    return g;
  }, [t]);
  const mat = useMemo(() => {
    const moon = world === 'moon';
    return patchMaterial(new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 }),
      { ground: true, moon, lunar: moon, aerial: !moon, curve: true, plates: st.plates > 0, streaks: !!st.streaks });
  }, [world, st]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  return <mesh geometry={geo} material={mat} receiveShadow />;
}

/** The wide backdrop (120 km, coarse) around the detailed map, so distant crater walls and mountains are there to see.
 *  Under the walkable square it is tucked a little below the detailed ground; past the edge it blends into the
 *  wide data over 1.8 km, so there is no step. Planet curvature is applied in the shader. */
function Backdrop({ t, world, st }: { t: Terrain; world: 'mars' | 'moon'; st: GroundStyle }) {
  const geo = useMemo(() => {
    const f = t.far!, g = new THREE.PlaneGeometry(f.size, f.size, f.n - 1, f.n - 1);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute, half = t.size / 2, band = 1800;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), e = Math.max(Math.abs(x), Math.abs(z));
      const w = THREE.MathUtils.smoothstep(e, half, half + band);
      const tuck = e < half ? THREE.MathUtils.lerp(40, 12, e / half) : 12 * (1 - w);
      pos.setY(i, (heightAt(t, x, z) - tuck) * (1 - w) + f.h[i] * w);
    }
    g.computeVertexNormals();
    g.setAttribute('cav', new THREE.BufferAttribute(new Float32Array(pos.count), 1));
    return g;
  }, [t]);
  const mat = useMemo(() => {
    const moon = world === 'moon';
    const m = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 });
    return patchMaterial(m, { ground: true, moon, lunar: moon, aerial: !moon, curve: true, far: true, streaks: !!st.streaks });
  }, [world, st]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  return <mesh geometry={geo} material={mat} />;
}

/** Rocks you can bump into (filled by the rock field around you). */
export const ROCKS: { x: number; z: number; r: number; h?: number }[] = [];

const CELL = 30, RING = 8;   // rocks are generated in 30 m cells, 8 cells around you (about 250 m)
const BINS = [0.13, 0.2, 0.32, 0.5, 0.8, 1.25, 2, 3.2];   // rock diameter classes, metres
const CULL = 0.0032;          // don't draw a rock smaller than this fraction of its distance (under ~2 pixels)
const LODS = [{ upTo: 0.5, detail: 2, cap: 2000 }, { upTo: 1.25, detail: 3, cap: 500 }, { upTo: 99, detail: 3, cap: 160 }];
const VARIANTS = 4;

/** Push every vertex in or out by noise (same position -> same push, so seams stay closed),
 *  then shade: dusty light tops, plain sides, dark undersides. */
function roughen(g: THREE.BufferGeometry, amt: number, freq: number, radialOnly = false) {
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = fbm3(x * freq + 7.3, y * freq * (radialOnly ? 3 : 1), z * freq - 2.1) * amt;
    if (radialOnly) {
      const r = Math.hypot(x, z) || 1;
      p.setXYZ(i, x + (x / r) * n, y + (Math.abs(y) > 0.49 ? n * 0.25 : 0), z + (z / r) * n);
    } else {
      const r = Math.hypot(x, y, z) || 1;
      p.setXYZ(i, x * (1 + n / r), y * (1 + n / r), z * (1 + n / r));
    }
  }
  g.computeVertexNormals();
  const nr = g.attributes.normal as THREE.BufferAttribute, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const up = nr.getY(i);
    const k = up > 0.55 ? 1.18 : up < -0.3 ? 0.6 : 0.95 + up * 0.15;
    col.set([k * (up > 0.55 ? 1.04 : 1), k, k * (up > 0.55 ? 0.94 : 1)], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** Rock surface: grain, fine horizontal bedding lines and a few cracks. Greyscale, tinted per rock. */
function useRockTexture() {
  const tex = useMemo(() => {
    const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d')!, img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) {
      const bed = 0.08 * Math.sin(y * 0.21 + Math.sin(y * 0.037) * 4) + 0.05 * vnoise(0, y * 0.09, 3);
      for (let x = 0; x < S; x++) {
        const n = fbm3(x * 0.018, y * 0.05, 1.7) * 0.18 + (Math.random() - 0.5) * 0.12;
        const k = Math.round(Math.max(0, Math.min(1, 0.9 + n + bed)) * 255);
        img.data.set([k, k, k, 255], (y * S + x) * 4);
      }
    }
    g.putImageData(img, 0, 0);
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.2;
    for (let i = 0; i < 14; i++) {                      // cracks: short wandering vertical lines
      let x = Math.random() * S, y = Math.random() * S;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 10; k++) { x += (Math.random() - 0.5) * 14; y += 6 + Math.random() * 10; g.lineTo(x, y); }
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1); t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

/** A broken-edged plate: notched outline, slightly undercut (top wider than bottom), rough faces. */
function useJaggedPlate() {
  const geo = useMemo(() => {
    const SEG = 18, g = new THREE.CylinderGeometry(0.52, 0.46, 1, SEG, 3);
    const jit = Array.from({ length: SEG + 1 }, (_, k) => 0.7 + ((Math.sin(k * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.5);
    jit[SEG] = jit[0];
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let v = 0; v < p.count; v++) {
      const x = p.getX(v), z = p.getZ(v), r = Math.hypot(x, z);
      if (r < 1e-4) continue;
      const a = Math.atan2(x, z), f = ((a + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * SEG, k = Math.floor(f), m = f - k;
      const j = jit[k] * (1 - m) + jit[(k + 1) % (SEG + 1)] * m;
      p.setX(v, x * j); p.setZ(v, z * j);
    }
    return roughen(g, 0.07, 4, true);
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  return geo;
}

/** Expected rocks per square metre in each size class, from the rock cover k (Golombek & Rapp 1997):
 *  the area covered by rocks wider than D is k * exp(-q D), with q = 1.79 + 0.152 / k. */
function rockDensity(k: number) {
  const q = 1.79 + 0.152 / k;
  return BINS.slice(0, -1).map((a, i) => {
    const b = BINS[i + 1], N = 8; let s = 0;
    for (let j = 0; j < N; j++) { const D = a + ((b - a) * (j + 0.5)) / N; s += (4 * k * q * Math.exp(-q * D)) / (Math.PI * D * D); }
    return (s * (b - a)) / N;
  });
}
const cellSeed = (cx: number, cz: number, salt: number) => (Math.imul(cx | 0, 73856093) ^ Math.imul(cz | 0, 19349663) ^ Math.imul(salt + 1, 83492791)) >>> 0;

/** Rocks and outcrops, generated cell by cell around you so the ground stays rocky wherever you walk.
 *  The same cell always gets the same rocks. Sizes follow the measured Mars/Moon rock size laws: many small
 *  stones, few big ones, in clusters. Stones smaller than 13 cm are drawn by the ground shader instead. */
function Rocks({ t, st, world, pos }: { t: Terrain; st: GroundStyle; world: 'mars' | 'moon'; pos: React.MutableRefObject<THREE.Vector3> }) {
  const moon = world === 'moon';
  const geos = useMemo(() => LODS.map((l, li) => Array.from({ length: VARIANTS }, (_, v) =>
    makeRock(li * 31 + v * 7 + (moon ? 100 : 0), l.detail, moon && v % 2 ? 'rounded' : 'angular'))), [moon]);
  // outcrops: 3 shapes, each in a detailed (near) and a coarse (far) version
  const rockMat = useMemo(() => patchMaterial(new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 }), { rock: true, aerial: !moon }), [moon]);
  const meshes = useMemo(() => LODS.map((l, li) => geos[li].map((g) => {
    const m = new THREE.InstancedMesh(g, rockMat, l.cap);
    m.castShadow = m.receiveShadow = true; m.frustumCulled = false; m.count = 0;
    m.setColorAt(0, new THREE.Color());
    return m;
  })), [geos, rockMat]);
  // the layered rock ledges ("layer cakes"): broad broken plates stacked like pages, as in the first version
  const jagged = useJaggedPlate(), rockTex = useRockTexture();
  const layerMat = useMemo(() => patchMaterial(new THREE.MeshStandardMaterial({ map: rockTex, vertexColors: true, roughness: 1, flatShading: true }), { aerial: !moon }), [rockTex, moon]);
  const layers = useMemo(() => {
    if (!st.outcrops) return null;
    const m = new THREE.InstancedMesh(jagged, layerMat, (RING * 2 + 1) ** 2 * 15);
    m.castShadow = m.receiveShadow = true; m.frustumCulled = false; m.count = 0;
    m.setColorAt(0, new THREE.Color());
    return m;
  }, [st, jagged, layerMat]);
  const bandA = useMemo(() => new THREE.Color(st.bands?.[0] ?? '#80543f'), [st]), bandB = useMemo(() => new THREE.Color(st.bands?.[1] ?? '#80543f'), [st]);
  useEffect(() => () => { geos.flat().forEach((g) => g.dispose()); rockMat.dispose(); layerMat.dispose(); meshes.flat().forEach((m) => m.dispose()); layers?.dispose(); },
    [geos, rockMat, layerMat, meshes, layers]);
  const dens = useMemo(() => rockDensity(st.rockK), [st]);
  const dClus = useMemo(() => rockDensity(0.15), []);
  const base = useMemo(() => new THREE.Color(...st.rockCol), [st]);
  const cur = useRef('');
  const o = useMemo(() => new THREE.Object3D(), []), c = useMemo(() => new THREE.Color(), []);
  useEffect(() => { cur.current = ''; }, [t, st]);
  useFrame(() => {
    const cx = Math.floor(pos.current.x / CELL), cz = Math.floor(pos.current.z / CELL), key = cx + ',' + cz;
    if (key === cur.current) return;
    cur.current = key;
    ROCKS.length = 0;
    const counts = meshes.map((l) => l.map(() => 0));
    let li = 0;
    const px = pos.current.x, pz = pos.current.z;
    const put = (x: number, z: number, D: number, rnd: () => number) => {
      const dist = Math.hypot(x - px, z - pz);
      if (D < dist * CULL) return;
      if (D > 0.45 && Math.hypot(x, z) < 10) return;                // keep the landing spot clear
      const li = D < LODS[0].upTo ? 0 : D < LODS[1].upTo ? 1 : 2, v = Math.floor(rnd() * VARIANTS), m = meshes[li][v];
      if (counts[li][v] >= LODS[li].cap) return;
      o.position.set(x, meshHeightAt(t, x, z) - D * (0.04 + rnd() * 0.08), z);
      o.rotation.set((rnd() - 0.5) * 0.3, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.3);
      o.scale.setScalar(D);
      o.updateMatrix(); m.setMatrixAt(counts[li][v], o.matrix);
      const r = rnd();
      // the Moon: white anorthosite, grey breccia and dark glass-coated rocks; Mars: shades of dark basalt
      const k = moon ? (r < 0.25 ? 1.6 : r < 0.85 ? 0.9 + rnd() * 0.3 : 0.45) : 0.7 + r * 0.6;
      m.setColorAt(counts[li][v]++, c.copy(base).multiplyScalar(k));
      if (D > 0.8) ROCKS.push({ x, z, r: D * 0.5 + 0.35 });
    };
    for (let i = -RING; i <= RING; i++) for (let j = -RING; j <= RING; j++) {
      const gx = cx + i, gz = cz + j;
      // nearest point of this cell to you: skip size classes too small to see from there
      const nx = Math.max(gx * CELL, Math.min(px, (gx + 1) * CELL)), nz = Math.max(gz * CELL, Math.min(pz, (gz + 1) * CELL));
      const near = Math.hypot(nx - px, nz - pz);
      const clump = 0.2 + 1.6 * THREE.MathUtils.smoothstep(vnoise(gx * 0.13, 1.3, gz * 0.13), -0.3, 0.55);   // rocky and bare patches
      for (let b = 0; b < dens.length; b++) {
        if (BINS[b + 1] < near * CULL) continue;
        const rnd = mulberry32(cellSeed(gx, gz, b));
        const lam = dens[b] * CELL * CELL * clump, n = Math.floor(lam + rnd());
        for (let k = 0; k < n; k++) {
          const x = (gx + rnd()) * CELL, z = (gz + rnd()) * CELL, D = BINS[b] + (BINS[b + 1] - BINS[b]) * rnd();
          put(x, z, D, rnd);
        }
      }
      // a clump of blocks thrown out by a small impact, densest at its centre
      const rc = mulberry32(cellSeed(gx, gz, 50));
      if (st.clusters && rc() < st.clusters) {
        const ccx = (gx + 0.2 + rc() * 0.6) * CELL, ccz = (gz + 0.2 + rc() * 0.6) * CELL, R = 4 + rc() * 8;
        for (let b = 0; b < dClus.length; b++) {
          const n = Math.floor(dClus[b] * Math.PI * R * R * 2 + rc());
          for (let k = 0; k < n; k++) {
            const a = rc() * Math.PI * 2, rr = -Math.log(1 - rc() * 0.95) * R * 0.5;
            put(ccx + Math.cos(a) * rr, ccz + Math.sin(a) * rr, BINS[b] + (BINS[b + 1] - BINS[b]) * rc(), rc);
          }
        }
      }
      // Layered rock ledge: broad broken plates stacked like pages. Each layer steps back the same way,
      // so one side is a cliff of exposed layers and the other a gentle slope (like tilted sediment).
      const rnd = mulberry32(cellSeed(gx, gz, 77));
      if (layers && rnd() < st.outcrops!) {
        const x = (gx + 0.2 + rnd() * 0.6) * CELL, z = (gz + 0.2 + rnd() * 0.6) * CELL;
        // three size classes: knee-high ledges, house-size blocks, and big mesas tens of metres across
        const cls = rnd(), w = cls < 0.4 ? 3 + rnd() * 6 : cls < 0.75 ? 9 + rnd() * 18 : 28 + Math.pow(rnd(), 0.8) * 45;
        const thick = w > 28 ? 1.4 + rnd() * 0.8 : w > 9 ? 1.1 + rnd() * 0.4 : 1;
        const n = Math.min(4 + Math.floor(rnd() * 11), 2 + Math.floor(w / 1.6)), rot = rnd() * Math.PI * 2;
        const sx = Math.cos(rot), sz = -Math.sin(rot), tilt = (rnd() - 0.5) * 0.14;
        if (Math.hypot(x, z) < w * 0.6 + 8) continue;   // keep the landing spot clear
        let y = heightAt(t, x, z) - 0.4, ww = w, d = w * (0.35 + rnd() * 0.45), off = 0;
        for (let k = 0; k < n; k++) {
          const th = (0.3 + rnd() * 0.7) * thick;
          o.position.set(x + sx * off, y + th / 2, z + sz * off);
          o.rotation.set(tilt, rot + (rnd() - 0.5) * 0.25, (rnd() - 0.5) * 0.06);
          o.scale.set(ww, th, d);
          o.updateMatrix(); layers.setMatrixAt(li, o.matrix);
          layers.setColorAt(li++, c.copy(k % 2 ? bandA : bandB).multiplyScalar(0.8 + rnd() * 0.35));
          y += th * 0.92; off += ww * (0.06 + rnd() * 0.1); ww *= 0.78 + rnd() * 0.2; d *= 0.85 + rnd() * 0.15;
        }
        ROCKS.push({ x, z, r: w * 0.4 + 0.6 });
      }
    }
    meshes.forEach((l, li) => l.forEach((m, v) => {
      m.count = counts[li][v]; m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }));
    if (layers) { layers.count = li; layers.instanceMatrix.needsUpdate = true; if (layers.instanceColor) layers.instanceColor.needsUpdate = true; }
  });
  return (
    <>
      {meshes.flat().map((m, i) => <primitive key={'r' + i} object={m} />)}
      {layers && <primitive object={layers} />}
    </>
  );
}

/** Give a loaded model shadows and the walk's lighting (terrain shadow, haze). Done once per material. */
function prepModel(root: THREE.Object3D, aerial: boolean) {
  root.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    m.castShadow = m.receiveShadow = true;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      const s = mat as THREE.MeshStandardMaterial;
      if (!s.isMeshStandardMaterial || s.userData.walk) continue;
      s.userData.walk = true;
      patchMaterial(s, { aerial });
    }
  });
}

/** Storm gear for the rover (a joke, not real hardware): goggles over its mast camera and a red-and-white
 *  checked khamaseen scarf around its neck, flapping in the wind. Placed at the model's camera head. */
function StormGear({ model }: { model: THREE.Object3D }) {
  // the camera head on top of the mast (mesh "Cube022" in this model), measured in the model's own space
  const head = useMemo(() => {
    model.updateMatrixWorld(true);
    const inv = model.matrixWorld.clone().invert();
    const m = (model.getObjectByName('Cube022') ?? model.getObjectByName('Mastcam_Z_cams')) as THREE.Mesh | undefined;
    const box = new THREE.Box3(new THREE.Vector3(-0.44, 1.13, 0.27), new THREE.Vector3(-0.12, 1.56, 0.7));
    if (m?.geometry) {
      m.geometry.computeBoundingBox();
      box.copy(m.geometry.boundingBox!).applyMatrix4(inv.multiply(m.matrixWorld));
    }
    const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    return { c, sz, front: box.max.z, bottom: box.min.y };
  }, [model]);
  const checks = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d')!;
    g.fillStyle = '#f3ede4'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#b3222b';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2 === 0) g.fillRect(x * 8, y * 8, 8, 8);
    const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(4, 1); tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
  const tails = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = tails.current; if (!g) return;
    const k = clock.elapsedTime;
    g.children.forEach((m, i) => { m.rotation.x = 1.2 + Math.sin(k * 9 + i) * 0.25; m.rotation.z = Math.sin(k * 6 + i * 2) * 0.2; });
  });
  const lens = Math.max(0.1, head.sz.x * 0.36);   // cartoonishly big, on purpose
  return (
    <group position={[head.c.x, 0, head.c.z]}>
      {/* goggles: two round lenses with orange rims over the camera eyes, and a strap round the head */}
      {[-1, 1].map((sx) => (
        <group key={sx} position={[sx * lens * 1.1, head.c.y + head.sz.y * 0.2, head.front - head.c.z + 0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh castShadow><cylinderGeometry args={[lens, lens, 0.09, 28]} /><meshStandardMaterial color="#ff7a1a" emissive="#5a2200" metalness={0.3} roughness={0.35} /></mesh>
          <mesh position={[0, 0.047, 0]}><cylinderGeometry args={[lens * 0.74, lens * 0.74, 0.01, 28]} /><meshStandardMaterial color="#14324a" metalness={0.9} roughness={0.05} /></mesh>
        </group>
      ))}
      <mesh position={[0, head.c.y + head.sz.y * 0.18, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[head.sz.x * 0.62 + 0.04, head.sz.z * 0.62 + 0.04, 1]}>
        <torusGeometry args={[1, 0.05, 8, 40]} /><meshStandardMaterial color="#3a2a22" roughness={0.9} />
      </mesh>
      {/* scarf: wrapped round the head just under the goggles, two tails blowing out behind */}
      <mesh castShadow position={[0, head.bottom + 0.04, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[head.sz.x * 0.7 + 0.06, head.sz.z * 0.7 + 0.06, 1.5]}>
        <torusGeometry args={[1, 0.09, 12, 40]} /><meshStandardMaterial map={checks} roughness={1} />
      </mesh>
      <group ref={tails} position={[0, head.bottom + 0.04, -(head.front - head.c.z) - 0.02]}>
        {[-0.09, 0.09].map((x, i) => (
          <group key={i} position={[x, 0, 0]}>
            <mesh position={[0, -0.5, 0]} castShadow>
              <planeGeometry args={[0.24, 1.0]} />
              <meshStandardMaterial map={checks} side={THREE.DoubleSide} roughness={1} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/** NASA's Perseverance model (public domain, NASA-3D-Resources), driving beside you and talking. */
const ROVER_URL = 'models/perseverance.glb';
function Rover({ t, pos, look, say, onTap, gear }: { gear?: boolean; t: Terrain; pos: React.MutableRefObject<THREE.Vector3>; look: React.MutableRefObject<{ yaw: number; pitch: number }>; say: string | null; onTap: () => void }) {
  const { scene } = useGLTF(ROVER_URL, 'draco/');
  useMemo(() => prepModel(scene, true), [scene]);
  const g = useRef<THREE.Group>(null);
  const yaw = useRef(look.current.yaw);
  const placed = useRef(false);
  useFrame((_, dtRaw) => {
    const r = g.current; if (!r) return;
    const dt = Math.min(dtRaw, 0.05), P = pos.current, L = look.current;
    const fx = -Math.sin(L.yaw), fz = -Math.cos(L.yaw), rx = Math.cos(L.yaw), rz = -Math.sin(L.yaw);
    const tx = P.x + rx * 4 + fx * 10, tz = P.z + rz * 4 + fz * 10;   // ahead and to your right, in view
    if (!placed.current) { r.position.set(tx, meshHeightAt(t, tx, tz), tz); placed.current = true; }
    const dx = tx - r.position.x, dz = tz - r.position.z, d = Math.hypot(dx, dz);
    if (d > 60) r.position.set(tx, 0, tz);                       // left far behind: catch up
    else if (d > 0.4) {
      const k = 1 - Math.exp(-dt * 4.5);
      r.position.x += dx * k; r.position.z += dz * k;
      if (d > 1.5) {
        const want = Math.atan2(dx, dz);
        let diff = ((want - yaw.current + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        yaw.current += diff * (1 - Math.exp(-dt * 3));
      }
    }
    if (d <= 1.5) {                                              // parked: turn to face you
      const want = Math.atan2(P.x - r.position.x, P.z - r.position.z);
      const diff = ((want - yaw.current + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      yaw.current += diff * (1 - Math.exp(-dt * 1.5));
    }
    for (const k of ROCKS) {                                     // drive around big rocks, not through them
      const ex = r.position.x - k.x, ez = r.position.z - k.z, e = Math.hypot(ex, ez), rr = k.r + 1.4;
      if (e < rr && e > 0.001) { r.position.x = k.x + (ex / e) * rr; r.position.z = k.z + (ez / e) * rr; }
    }
    const x = r.position.x, z = r.position.z;
    // stand on its four wheels: sample the ground under each one, tilt to match (front/back and side to side),
    // and sit on the highest so no wheel ever sinks below the surface on bumps or cross-slopes
    const ax = Math.sin(yaw.current), az = Math.cos(yaw.current), bx = Math.cos(yaw.current), bz = -Math.sin(yaw.current);
    const W = (f: number, s: number) => meshHeightAt(t, x + ax * f + bx * s, z + az * f + bz * s);
    const fl = W(1.5, -1.3), fr = W(1.5, 1.3), bl = W(-1.5, -1.3), br = W(-1.5, 1.3), mid = meshHeightAt(t, x, z);
    const pitch = Math.atan2((bl + br) / 2 - (fl + fr) / 2, 3);
    const roll = Math.atan2((fr + br) / 2 - (fl + bl) / 2, 2.6);
    r.position.y = Math.max(mid, (fl + fr + bl + br) / 4) + 0.03;
    r.rotation.set(0, 0, 0);
    r.rotateY(yaw.current); r.rotateX(pitch); r.rotateZ(roll);
  });
  return (
    <group ref={g}>
      <primitive object={scene} />
      {gear && <StormGear model={scene} />}
      {say && (
        <Html position={[0, 2.9, 0]} center zIndexRange={[20, 0]}>
          <div className="rover-say" onClick={onTap} key={say}>{say}</div>
        </Html>
      )}
    </group>
  );
}

/** A bootprint texture: an Apollo-style ribbed sole, drawn once on a canvas. */
function useBootprint() {
  return useMemo(() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 160;
    const g = c.getContext('2d')!;
    const sole = () => { g.beginPath(); g.ellipse(32, 44, 26, 40, 0, 0, Math.PI * 2); g.ellipse(32, 122, 22, 34, 0, 0, Math.PI * 2); g.rect(12, 44, 40, 80); };
    g.fillStyle = 'rgba(10,10,12,0.8)'; sole(); g.fill();                     // the pressed-in sole, in shadow
    g.save(); sole(); g.clip();
    g.fillStyle = 'rgba(235,235,235,0.55)';
    for (let y = 8; y < 156; y += 10) g.fillRect(0, y, 64, 4);               // the bright edges of the sole's ridges
    g.restore();
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

/** Bootprints pressed into the dust: one waiting where you land, then a trail behind the astronaut. */
export const PRINTS = { add: (_x: number, _z: number, _yaw: number) => {} };
function Footprints({ t, first }: { t: Terrain; first: { x: number; z: number; yaw: number } }) {
  const tex = useBootprint();
  const ref = useRef<THREE.InstancedMesh>(null);
  const N = 400, next = useRef(0);
  const o = useMemo(() => new THREE.Object3D(), []);
  const mat = useMemo(() => patchMaterial(new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, roughness: 1 }), {}), [tex]);
  useEffect(() => {
    const m = ref.current; if (!m) return;
    const put = (x: number, z: number, yaw: number, scale = 1) => {
      o.position.set(x, meshHeightAt(t, x, z) + 0.02, z);
      o.rotation.set(-Math.PI / 2, 0, yaw);
      o.scale.setScalar(scale); o.updateMatrix();
      m.setMatrixAt(next.current % N, o.matrix); next.current++;
      m.count = Math.min(N, next.current); m.instanceMatrix.needsUpdate = true;
    };
    put(first.x, first.z, first.yaw, 1.6);                      // the famous first print, a little bigger
    PRINTS.add = (x, z, yaw) => put(x, z, yaw);
    return () => { PRINTS.add = () => {}; };
  }, [t, first, o]);
  return (
    <instancedMesh ref={ref} args={[undefined, mat, N]} frustumCulled={false} receiveShadow>
      <planeGeometry args={[0.15, 0.36]} />
    </instancedMesh>
  );
}

/** NASA's astronaut model (public domain, NASA-3D-Resources). It comes in a T-pose with no skeleton,
 *  so we bend its arms down in code, then make it bunny-hop the way Apollo crews moved in low gravity. */
const ASTRO_URL = 'models/astronaut.glb';
function Astronaut({ t, pos, look, say, onTap }: { t: Terrain; pos: React.MutableRefObject<THREE.Vector3>; look: React.MutableRefObject<{ yaw: number; pitch: number }>; say: string | null; onTap: () => void }) {
  const { scene } = useGLTF(ASTRO_URL, 'draco/');
  const model = useMemo(() => {
    const root = scene.clone(true);
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3());
    const H = size.y, half = size.x / 2;
    const sx = half * 0.36, sy = box.min.y + H * 0.73;            // shoulder joints, as a share of the body
    root.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      m.geometry = m.geometry.clone();
      const p = m.geometry.attributes.position as THREE.BufferAttribute, v = new THREE.Vector3();
      const toRoot = m.matrixWorld.clone(), fromRoot = toRoot.clone().invert();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(toRoot);
        const ax = Math.abs(v.x), w = Math.min(1, Math.max(0, (ax - sx) / (half * 0.12)));
        if (w > 0 && v.y > sy - H * 0.2) {
          const side = Math.sign(v.x), a = -side * 1.22 * w;          // swing the arm down ~70°
          const dx = v.x - side * sx, dy = v.y - sy;
          v.x = side * sx + dx * Math.cos(a) - dy * Math.sin(a);
          v.y = sy + dx * Math.sin(a) + dy * Math.cos(a);
        }
        v.applyMatrix4(fromRoot); p.setXYZ(i, v.x, v.y, v.z);
      }
      m.geometry.computeVertexNormals();
    });
    prepModel(root, false);
    const k = 1.8 / H;                                             // 1.8 m tall, feet on the ground
    const g = new THREE.Group(); root.scale.setScalar(k); root.position.y = -box.min.y * k; g.add(root);
    return g;
  }, [scene]);
  const g = useRef<THREE.Group>(null), body = useRef<THREE.Group>(null);
  const yaw = useRef(look.current.yaw), placed = useRef(false), stride = useRef(0), lastPrint = useRef(new THREE.Vector3()), foot = useRef(1);
  useFrame((_, dtRaw) => {
    const r = g.current, b = body.current; if (!r || !b) return;
    const dt = Math.min(dtRaw, 0.05), P = pos.current, L = look.current;
    const fx = -Math.sin(L.yaw), fz = -Math.cos(L.yaw), rx = Math.cos(L.yaw), rz = -Math.sin(L.yaw);
    const tx = P.x + rx * 2.6 + fx * 6, tz = P.z + rz * 2.6 + fz * 6;
    if (!placed.current) { r.position.set(tx, meshHeightAt(t, tx, tz), tz); lastPrint.current.copy(r.position); placed.current = true; }
    const dx = tx - r.position.x, dz = tz - r.position.z, d = Math.hypot(dx, dz);
    let speed = 0;
    if (d > 60) { r.position.set(tx, 0, tz); lastPrint.current.set(tx, 0, tz); }
    else if (d > 0.3) {
      const k = 1 - Math.exp(-dt * 4.5), mx = dx * k, mz = dz * k;
      r.position.x += mx; r.position.z += mz; speed = Math.hypot(mx, mz) / dt;
      if (d > 1) {
        const want = Math.atan2(dx, dz), diff = ((want - yaw.current + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        yaw.current += diff * (1 - Math.exp(-dt * 4));
      }
    } else {                                                      // standing still: turn to face you
      const want = Math.atan2(P.x - r.position.x, P.z - r.position.z), diff = ((want - yaw.current + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      yaw.current += diff * (1 - Math.exp(-dt * 2));
    }
    for (const k of ROCKS) {                                     // walk around big rocks, not through them
      const ex = r.position.x - k.x, ez = r.position.z - k.z, e = Math.hypot(ex, ez), rr = k.r + 0.6;
      if (e < rr && e > 0.001) { r.position.x = k.x + (ex / e) * rr; r.position.z = k.z + (ez / e) * rr; }
    }
    // stand on the highest ground under the boots, so feet never sink into a bump or slope
    { const X = r.position.x, Z = r.position.z, q = 0.35;
      r.position.y = Math.max(meshHeightAt(t, X, Z), meshHeightAt(t, X + q, Z), meshHeightAt(t, X - q, Z), meshHeightAt(t, X, Z + q), meshHeightAt(t, X, Z - q)) + 0.02; }
    r.rotation.set(0, yaw.current, 0);
    // the bunny hop: a slow, floaty bounce while moving
    const moving = speed > 0.5;
    stride.current += dt * (moving ? 2.2 + Math.min(speed, 20) * 0.08 : 0);
    const hop = moving ? Math.abs(Math.sin(stride.current * Math.PI)) * 0.45 : b.position.y * 0.9;
    b.position.y = hop; b.rotation.x = moving ? 0.14 : b.rotation.x * 0.9;
    // a print each time the boots come down
    if (moving && r.position.distanceTo(lastPrint.current) > 1.1 && hop < 0.06) {
      const side = (foot.current = -foot.current) * 0.13;
      PRINTS.add(r.position.x + Math.cos(yaw.current) * side, r.position.z - Math.sin(yaw.current) * side, -yaw.current + Math.PI);
      lastPrint.current.copy(r.position);
    }
  });
  return (
    <group ref={g}>
      <group ref={body}><primitive object={model} /></group>
      {say && (
        <Html position={[0, 2.5, 0]} center zIndexRange={[20, 0]}>
          <div className="rover-say" onClick={onTap} key={say}>{say}</div>
        </Html>
      )}
    </group>
  );
}

/** First-person walker: keys move, drag to look, height follows the real terrain. Your own body is an invisible
 *  shape that still casts a shadow, so you see your shadow on the ground. */
function Walker({ t, keys, onMove, look, pos }: { pos: React.MutableRefObject<THREE.Vector3>; t: Terrain; keys: React.MutableRefObject<Keys>; onMove: (s: { elev: number; moving: boolean; x: number; z: number }) => void; look: React.MutableRefObject<{ yaw: number; pitch: number }> }) {
  const { camera } = useThree();
  const p = pos;
  const last = useRef(0);
  const me = useRef<THREE.Group>(null);
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05), k = keys.current, L = look.current;
    if (k.tl) L.yaw += dt * 1.6;
    if (k.tr) L.yaw -= dt * 1.6;
    const sp = (k.run ? RUN : WALK) * dt;
    const fx = -Math.sin(L.yaw), fz = -Math.cos(L.yaw);
    let mx = 0, mz = 0;
    if (k.f) { mx += fx; mz += fz; }
    if (k.b) { mx -= fx; mz -= fz; }
    if (k.l) { mx += fz; mz -= fx; }
    if (k.r) { mx -= fz; mz += fx; }
    const len = Math.hypot(mx, mz);
    const lim = t.size / 2 - 60;
    if (len > 0) {
      p.current.x = Math.max(-lim, Math.min(lim, p.current.x + (mx / len) * sp));
      p.current.z = Math.max(-lim, Math.min(lim, p.current.z + (mz / len) * sp));
    }
    for (const r of ROCKS) {
      const dx = p.current.x - r.x, dz = p.current.z - r.z, d = Math.hypot(dx, dz);
      if (d < r.r && d > 0.001) { p.current.x = r.x + (dx / d) * r.r; p.current.z = r.z + (dz / d) * r.r; }
    }
    const ground = meshHeightAt(t, p.current.x, p.current.z);
    camera.position.set(p.current.x, ground + EYE, p.current.z);
    camera.rotation.set(L.pitch, L.yaw, 0, 'YXZ');
    if (me.current) { me.current.position.set(p.current.x, ground, p.current.z); me.current.rotation.y = L.yaw; }
    last.current += dt;
    if (last.current > 0.1) { last.current = 0; onMove({ elev: ground, moving: len > 0, x: p.current.x, z: p.current.z }); }
  });
  const body = useMemo(() => new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }), []);
  return (
    <group ref={me}>
      {/* legs, torso, arms and head (with a suit helmet on the Moon), invisible to the camera but not to the Sun */}
      {[-0.12, 0.12].map((x) => <mesh key={x} castShadow material={body} position={[x, 0.45, 0]}><capsuleGeometry args={[0.085, 0.75, 3, 8]} /></mesh>)}
      <mesh castShadow material={body} position={[0, 1.18, 0]}><capsuleGeometry args={[0.2, 0.42, 3, 10]} /></mesh>
      {[-0.27, 0.27].map((x) => <mesh key={x} castShadow material={body} position={[x, 1.08, 0]} rotation={[0, 0, x > 0 ? 0.12 : -0.12]}><capsuleGeometry args={[0.055, 0.6, 3, 8]} /></mesh>)}
      <mesh castShadow material={body} position={[0, 1.66, 0]}><sphereGeometry args={[0.15, 12, 10]} /></mesh>
    </group>
  );
}

/** Blowing dust: grains streaming past you on the wind, wrapped around the camera so they never run out. */
function Dust() {
  const { camera } = useThree();
  const N = 9000, R = 40;
  const ref = useRef<THREE.Points>(null);
  const [geo, seeds] = useMemo(() => {
    const g = new THREE.BufferGeometry(), p = new Float32Array(N * 3), sd = new Float32Array(N);
    for (let i = 0; i < N; i++) { p.set([(Math.random() - 0.5) * 2 * R, Math.random() * 14, (Math.random() - 0.5) * 2 * R], i * 3); sd[i] = Math.random(); }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return [g, sd];
  }, []);
  const sprite = useMemo(() => {                // soft round grain instead of a square
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d')!, gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  }, []);
  const time = useRef(0);
  useFrame((_, dt) => {
    const pts = ref.current; if (!pts) return;
    time.current += dt;
    const gust = 1 + 0.6 * Math.sin(time.current * 0.7) + 0.3 * Math.sin(time.current * 2.3);
    const a = pts.geometry.attributes.position as THREE.BufferAttribute;
    const c = camera.position;
    for (let i = 0; i < N; i++) {
      let x = a.getX(i) + (14 + seeds[i] * 10) * gust * dt, y = a.getY(i) + Math.sin(time.current * 3 + i) * 0.4 * dt, z = a.getZ(i) + 3 * gust * dt;
      // keep each grain inside a box around you
      if (x - c.x > R) x -= 2 * R; else if (x - c.x < -R) x += 2 * R;
      if (z - c.z > R) z -= 2 * R; else if (z - c.z < -R) z += 2 * R;
      if (y - c.y > 12) y -= 15; else if (y - c.y < -3) y += 15;
      a.setXYZ(i, x, y, z);
    }
    a.needsUpdate = true;
  });
  return (
    <points ref={ref} geometry={geo} frustumCulled={false}>
      <pointsMaterial color="#e08a4a" map={sprite} size={0.11} transparent opacity={0.8} depthWrite={false} />
    </points>
  );
}

/** Gusts of dust sweeping past you in the storm (three see-through curtains at different distances). */
function DustSheets() {
  const g = useRef<THREE.Group>(null);
  const sheets = useMemo(() => [[15, 1, 0.8], [35, 1, 1.3], [80, 1, 2.2]].map(([r, sp, sc]) => ({ r, mat: makeDustSheetMaterial(sp, sc) })), []);
  useEffect(() => () => sheets.forEach((s) => s.mat.dispose()), [sheets]);
  useFrame(({ camera }) => { g.current?.position.set(camera.position.x, camera.position.y - 4, camera.position.z); });
  return (
    <group ref={g}>
      {sheets.map((s, i) => (
        <mesh key={i} material={s.mat} renderOrder={10 - i} frustumCulled={false}>
          <cylinderGeometry args={[s.r, s.r, 34, 64, 1, true]} />
        </mesh>
      ))}
    </group>
  );
}

/** Earth seen from the Moon: its true size (1.9°), lit only by the Sun, so its phase always matches the Sun's
 *  direction in your sky. */
function Earth({ dir }: { dir: THREE.Vector3 }) {
  const map = useTexture('tex/earth_base.webp');
  useEffect(() => { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8; map.needsUpdate = true; }, [map]);
  const D = 900, r = D * Math.tan(THREE.MathUtils.degToRad(0.95));
  // the map has no clouds, so it is darker than the real Earth (Bond albedo ~0.3): brighten it to match
  const bright = useMemo(() => new THREE.Color(2.6, 2.6, 2.6), []);
  const air = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uSun: U.uSun }, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform vec3 uSun; varying vec3 vN; varying vec3 vW;
      void main(){ vec3 V = normalize(cameraPosition - vW); float rim = pow(1.0 - abs(dot(vN, V)), 2.5);
        float lit = smoothstep(-0.25, 0.5, dot(vN, uSun));
        gl_FragColor = vec4(vec3(0.3, 0.55, 1.0) * rim * lit * 1.6, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }), []);
  useEffect(() => () => air.dispose(), [air]);
  const at = dir.clone().multiplyScalar(D);
  return (
    <group position={at}>
      <mesh scale={r} rotation={[0.4, 2.2, 0.41]} renderOrder={-999}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial map={map} color={bright} roughness={0.9} metalness={0} envMapIntensity={0} depthTest={false} depthWrite={false} />
      </mesh>
      <mesh scale={r * 1.035} material={air} renderOrder={-998}><sphereGeometry args={[1, 48, 48]} /></mesh>
    </group>
  );
}

/** A few hundred faint stars: from the sunlit Moon the glare of the ground hides almost all of them. */
function Stars() {
  const geo = useMemo(() => {
    const rnd = mulberry32(42), N = 900, p = new Float32Array(N * 3), c = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      p.set([Math.cos(a) * s * 950, u * 950, Math.sin(a) * s * 950], i * 3);
      const b = 0.015 + Math.pow(rnd(), 6) * 0.12;
      c.set([b, b, b * (0.9 + rnd() * 0.2)], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return g;
  }, []);
  return (
    <points geometry={geo} renderOrder={-999} frustumCulled={false}>
      <pointsMaterial size={1.6} sizeAttenuation={false} vertexColors depthTest={false} depthWrite={false} />
    </points>
  );
}

/** The sky, locked to the camera so it is infinitely far away: the analytic sky dome with the Sun's disk, and on
 *  the Moon the stars and the Earth. Drawn first, behind everything. */
function SkyDome({ world, earthDir }: { world: 'mars' | 'moon'; earthDir: THREE.Vector3 }) {
  const g = useRef<THREE.Group>(null);
  const mat = useMemo(() => makeSkyMaterial(true), []);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame(({ camera }) => { g.current?.position.copy(camera.position); });
  return (
    <group ref={g}>
      <mesh material={mat} renderOrder={-1000} frustumCulled={false}><sphereGeometry args={[1000, 64, 32]} /></mesh>
      {world === 'moon' && <><Stars /><Suspense fallback={null}><Earth dir={earthDir} /></Suspense></>}
    </group>
  );
}

/** Light from the sky and the sunlit ground, baked once into an environment map from the same sky function. On Mars
 *  it is the butterscotch sky above and warm ground below; on the Moon the sky is black, so the only fill light is
 *  sunlight bounced off the grey ground. */
function SkyLight({ groundRad, intensity }: { groundRad: RGB; intensity: number }) {
  const gl = useThree((s) => s.gl), scene = useThree((s) => s.scene);
  useEffect(() => {
    const env = new THREE.Scene();
    const skyMat = makeSkyMaterial(false);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(100, 48, 24), skyMat); sky.renderOrder = -1;
    const ground = new THREE.Mesh(new THREE.CircleGeometry(400, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(...groundRad) }));
    ground.position.y = -2;
    env.add(sky, ground);
    const pm = new THREE.PMREMGenerator(gl);
    const rt = pm.fromScene(env, 0.04, 0.1, 1000);
    pm.dispose();
    scene.environment = rt.texture;
    scene.environmentIntensity = intensity;
    return () => {
      scene.environment = null; rt.dispose(); skyMat.dispose();
      sky.geometry.dispose(); ground.geometry.dispose(); (ground.material as THREE.Material).dispose();
    };
  }, [gl, scene, groundRad, intensity]);
  return null;
}

/** The Sun, with a shadow map that travels with you: snapped to whole shadow texels so the shadows don't crawl. */
function SunLight({ sun, intensity, color, shadow }: { sun: THREE.Vector3; intensity: number; color: string; shadow: number }) {
  const L = useRef<THREE.DirectionalLight>(null);
  const HALF = 100, MAP = 4096, D = 400;   // 5 cm shadow texels around you
  const basis = useMemo(() => {
    const z = sun.clone().normalize(), x = new THREE.Vector3(0, 1, 0).cross(z).normalize();
    return { x, y: z.clone().cross(x), z };
  }, [sun]);
  const f = useMemo(() => new THREE.Vector3(), []), p = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    const l = L.current; if (!l) return;
    camera.getWorldDirection(f).setY(0);
    if (f.lengthSq() < 1e-6) f.set(0, 0, -1);
    f.normalize();
    p.copy(camera.position).addScaledVector(f, HALF * 0.35);
    const tx = (2 * HALF) / MAP;
    const u = Math.round(p.dot(basis.x) / tx) * tx, v = Math.round(p.dot(basis.y) / tx) * tx, w = p.dot(basis.z);
    p.copy(basis.x).multiplyScalar(u).addScaledVector(basis.y, v).addScaledVector(basis.z, w);
    l.target.position.copy(p); l.target.updateMatrixWorld();
    l.position.copy(p).addScaledVector(basis.z, D);
  });
  return (
    <directionalLight ref={L} castShadow intensity={intensity} color={color}
      shadow-mapSize={[MAP, MAP]} shadow-camera-left={-HALF} shadow-camera-right={HALF} shadow-camera-top={HALF} shadow-camera-bottom={-HALF}
      shadow-camera-near={1} shadow-camera-far={2 * D} shadow-bias={-0.0004} shadow-normalBias={0.12} shadow-intensity={shadow} />
  );
}

/** Tone mapping: the Khronos "neutral" curve keeps colours as they are and only rolls off the highlights, so the
 *  measured albedos and sky colours come out close to NASA's natural-colour photos. Also runs the shared clock. */
function Exposure({ world, exposure }: { world: 'mars' | 'moon'; exposure: number }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.toneMapping = THREE.NeutralToneMapping;
    gl.toneMappingExposure = exposure;
  }, [gl, world, exposure]);
  useFrame((_, dt) => { U.uTime.value += dt; });
  return null;
}

export default function TerrainWalk({ t, id, world, keys, onMove, say, onTap, onQuest, questAction = 0 }: { questAction?: number; onQuest?: (s: QuestState) => void; say?: string | null; onTap?: () => void; t: Terrain; id: string; world: 'mars' | 'moon'; keys: React.MutableRefObject<Keys>; onMove: (s: { elev: number; moving: boolean; x: number; z: number }) => void }) {
  const st = styleFor(id, world);
  const atm = ATMOS[world === 'moon' ? 'moon' : st.storm ? 'storm' : st.high ? 'high' : 'mars'];
  const exposure = st.exposure ?? atm.exposure;
  const start = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const look = useRef(useMemo(() => {
    const h0 = heightAt(t, start.x, start.z);
    let best = 0, yaw = 0;
    for (let a = 0; a < 64; a++) {
      const ang = (a / 64) * Math.PI * 2;
      for (const d of [2500, 4000, 5500]) {
        const x = start.x - Math.sin(ang) * d, z = start.z - Math.cos(ang) * d;
        const diff = Math.abs(heightAt(t, x, z) - h0) / Math.sqrt(d);
        if (diff > best) { best = diff; yaw = ang; }
      }
    }
    return { yaw, pitch: st.high ? 0.06 : world === 'moon' ? -0.12 : 0.02 };
  }, [t, start]));
  const pos = useRef(start.clone());
  const yaw0 = useMemo(() => look.current.yaw, []);   // the direction you face when you land
  const groundAt = useMemo(() => (x: number, z: number) => meshHeightAt(t, x, z), [t]);
  const quest = QUESTS[id];
  // the bootprint waiting in front of you when you land
  const firstPrint = useMemo(() => {
    const y = look.current.yaw, x = start.x - Math.sin(y) * 5.5 - Math.cos(y) * 0.4, z = start.z - Math.cos(y) * 5.5 + Math.sin(y) * 0.4;
    return { x, z, yaw: -y + 0.25 };
  }, [start]);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [grab, setGrab] = useState(false);
  if (import.meta.env.DEV) (window as unknown as { __walk?: unknown }).__walk = { look, pos, ROCKS };   // for screenshot scripts
  // The Sun behind your shoulder when you land, so the view is lit and your shadow points ahead.
  // Mars: mid-afternoon. Apollo 16: morning Sun ~30° up. Moon's south pole: the Sun skims the horizon, so we pick the
  // nearest direction from which the Sun actually clears the hills around the landing spot.
  const sun = useMemo(() => {
    const y0 = look.current.yaw;
    if (world === 'mars') return new THREE.Vector3(Math.sin(y0) * 0.7 + 0.3, 0.45, Math.cos(y0) * 0.7).normalize();
    if (st.sunHigh || !st.sunElev) return new THREE.Vector3(Math.sin(y0 + 0.5), 0.55, Math.cos(y0 + 0.5)).normalize();
    const el = THREE.MathUtils.degToRad(st.sunElev);
    let az = y0 + 0.5, best = -1;
    for (let k = 0; k < 24; k++) {
      const a = y0 + 0.5 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 12);
      const s = litFraction(t, start.x, start.z, a, el, world) - 0.012 * Math.ceil(k / 2);
      if (s > best) { best = s; az = a; }
      if (s > 0.85) break;
    }
    return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  }, [t, world, st, start]);
  const hz = useMemo(() => sunHorizon(t, sun, world), [t, sun, world]);
  useEffect(() => () => { hz.near.dispose(); hz.far?.dispose(); }, [hz]);
  // the shared shader settings for this place
  useMemo(() => {
    U.uSun.value.copy(sun);
    U.uMoon.value = world === 'moon' ? 1 : 0;
    U.uZen.value.setRGB(...atm.zen); U.uHor.value.setRGB(...atm.hor);
    U.uTau.value = atm.tau; U.uAur.value = atm.aur;
    U.uFogB.value = atm.fogB; U.uFogH.value = atm.fogH; U.uFogRefH.value = (t.min + t.max) / 2;
    U.uInvTwoR.value = 1 / (2 * PLANET_R[world]);
    U.uSand.value.setRGB(...st.sand); U.uDark.value.setRGB(...st.dark); U.uRock.value.setRGB(...st.rock);
    U.uSlab.value.setRGB(...st.slab); U.uPeb.value.setRGB(...st.peb);
    U.uPebDens.value = st.pebbles; U.uRipple.value = st.ripples; U.uPlates.value = st.plates; U.uPlateSize.value = st.plateSize;
    U.uDarkAmt.value = st.darkAmt; U.uStreaks.value = st.streaks ?? 0; U.uDust.value = st.dust;
    const soft = Math.max(world === 'moon' ? 0.0047 : 0.0031, 0.004);
    U.uHorizon.value = hz.near; U.uTerr.value.set(t.size, t.n, soft, 1);
    U.uHorizonFar.value = hz.far; U.uTerrFar.value.set(t.far?.size ?? 1, t.far?.n ?? 2, soft, hz.far ? 1 : 0);
  }, [sun, world, atm, st, t, hz]);
  // the light bounced off the sunlit ground (radiance), for the environment light
  const groundRad = useMemo<RGB>(() => {
    const s = Math.max(sun.y, 0.02);
    if (world === 'moon') return st.sand.map((a) => (a * atm.sunI * ((2 * s) / (s + 0.6)) * 0.6) / Math.PI) as RGB;   // lunar-Lambert, grazing view
    return st.sand.map((a, c) => (a * (atm.sunI * s + Math.PI * 0.5 * (atm.zen[c] + atm.hor[c]))) / Math.PI) as RGB;   // sun + sky on flat ground
  }, [sun, world, atm, st]);
  // Earth in the Moon's sky. At the south pole it hangs a few degrees over the horizon (toward the near side), here
  // placed so it is gibbous and just ahead of you when you land; at Apollo 16 it stands ~66° up, opposite the
  // morning Sun. Its phase comes from the real Sun direction, so it is always consistent.
  const earthDir = useMemo(() => {
    const az = Math.atan2(sun.x, sun.z) + (st.sunHigh ? Math.PI : Math.PI * 0.8), el = THREE.MathUtils.degToRad(st.sunHigh ? 66 : 5);
    return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  }, [sun, st]);
  if (import.meta.env.DEV) (window as unknown as { __walkSky?: unknown }).__walkSky = { sun, earthDir, U };
  return (
    <div className={`walk__canvas${grab ? ' is-grab' : ''}`}
      onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY }; setGrab(true); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        look.current.yaw -= (e.clientX - drag.current.x) * 0.004;
        look.current.pitch = Math.max(-1.2, Math.min(1.0, look.current.pitch - (e.clientY - drag.current.y) * 0.004));
        drag.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={() => { drag.current = null; setGrab(false); }}>
      <Safe3D fallback={<div className="no3d">3D view unavailable in this browser</div>}>
        <Canvas dpr={[1, 1.5]} shadows="soft" camera={{ fov: 70, near: 0.5, far: 160000 }}
          gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: exposure }}>
          <Exposure world={world} exposure={exposure} />
          <SkyLight groundRad={groundRad} intensity={atm.env} />
          <SunLight sun={sun} intensity={atm.sunI} color={atm.sunCol} shadow={atm.shadow} />
          <SkyDome world={world} earthDir={earthDir} />
          {st.storm && <><Dust /><DustSheets /></>}
          <Suspense fallback={null}>
            <Ground t={t} world={world} st={st} />
            {t.far && <Backdrop t={t} world={world} st={st} />}
            <Rocks t={t} st={st} world={world} pos={pos} />
          </Suspense>
          {world === 'moon' && <Footprints t={t} first={firstPrint} />}
          {world === 'moon' && <Suspense fallback={null}><Astronaut t={t} pos={pos} look={look} say={say ?? null} onTap={onTap ?? (() => {})} /></Suspense>}
          {world === 'mars' && <Suspense fallback={null}><Rover t={t} pos={pos} look={look} say={say ?? null} onTap={onTap ?? (() => {})} gear={!!st.storm} /></Suspense>}
          {quest && onQuest && <Suspense fallback={null}><QuestTarget quest={quest} start={start} yaw0={yaw0} pos={pos} look={look} height={groundAt} onUpdate={onQuest} action={questAction} /></Suspense>}
          <Walker t={t} keys={keys} onMove={onMove} look={look} pos={pos} />
        </Canvas>
      </Safe3D>
    </div>
  );
}
