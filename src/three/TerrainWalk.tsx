import { Html, Stars, useGLTF } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import Safe3D from '../components/Safe3D';
import { Surface } from './Globe';

export type Terrain = { n: number; size: number; min: number; max: number; h: Float32Array; far?: Terrain };
export type Keys = { f: boolean; b: boolean; l: boolean; r: boolean; tl: boolean; tr: boolean; run: boolean };

/** How the ground looks up close. The shape is real data; the surface dressing is per region. */
export type GroundStyle = {
  sand: [number, number, number]; rock: [number, number, number]; stone: string; slab?: string;
  ripples: number;          // 0 = none, 1 = strong wind ripples
  gravel: number;           // pebble dots per texture tile
  rocks: number;            // rocks per 30 m cell around you
  big: number;              // 0..1, how many of those are boulders
  slabs: number;            // flat bedrock plates per cell
  outcrops?: number;        // chance per cell of a big layered rock ledge
  storm?: boolean;          // dust storm: thick haze, blowing dust, the rover puts its gear on
  high?: boolean;           // very high up: thin, clear air, darker sky
  sunHigh?: boolean;        // near the Moon's equator: Sun higher, Earth high overhead
  patches?: [number, number, number]; // colour of bare rock showing through the dust in big patches
  slabSize?: number;        // scale of the flat plates (1 = default)
  bands?: [string, string]; // its alternating layer colours
};
const MARS_SAND: GroundStyle = { sand: [0.72, 0.4, 0.24], rock: [0.42, 0.26, 0.18], stone: '#6e3a22', ripples: 1, gravel: 260, rocks: 1, big: 0.2, slabs: 0 };
const MOON_DUST: GroundStyle = { sand: [0.55, 0.55, 0.56], rock: [0.33, 0.33, 0.35], stone: '#59595c', ripples: 0, gravel: 260, rocks: 1, big: 0.2, slabs: 0 };
export const STYLES: Record<string, GroundStyle> = {
  // Gale floor (Aeolis Palus): Curiosity drives over dusty brown ground strewn with dark angular rocks,
  // gravel and cracked slabs of lake-bed bedrock.
  'mars-gale': { sand: [0.88, 0.32, 0.12], rock: [0.58, 0.22, 0.1], stone: '#80543f', slab: '#b4826a', ripples: 0, gravel: 900, rocks: 45, big: 0.4, slabs: 3,
    outcrops: 0.85, bands: ['#a87258', '#c08f72'] },
};
STYLES['mars-jezero'] = {
  // Jezero: dusty crater floor with sand, scattered rocks and low layered delta outcrops, in a dust storm
  sand: [0.78, 0.46, 0.27], rock: [0.55, 0.32, 0.2], stone: '#7c5642', slab: '#b08a6c', ripples: 0.6, gravel: 520,
  rocks: 26, big: 0.3, slabs: 2, outcrops: 0, storm: true,
};
STYLES['mars-olympus'] = {
  // Olympus Mons summit: orbiters measure very low thermal inertia here, meaning a thick blanket of fine dust.
  // So: smooth dusty ground, dark lava (basalt) showing through in patches and flat plates, few rocks.
  sand: [0.84, 0.6, 0.44], rock: [0.66, 0.46, 0.34], stone: '#5a4038', slab: '#4a3530', ripples: 0.25, gravel: 140,
  rocks: 5, big: 0.12, slabs: 3, slabSize: 2.6, outcrops: 0, high: true, patches: [0.3, 0.2, 0.17],
};
STYLES['moon-highlands'] = {
  // Lunar highlands (Apollo 16, Descartes): bright anorthosite soil and pale boulders under a higher Sun
  sand: [0.74, 0.73, 0.71], rock: [0.52, 0.52, 0.52], stone: '#9c9893', slab: '#8a8681', ripples: 0, gravel: 380,
  rocks: 14, big: 0.3, slabs: 0, outcrops: 0, sunHigh: true,
};
export const styleFor = (id: string, world: 'mars' | 'moon') => STYLES[id] ?? (world === 'mars' ? MARS_SAND : MOON_DUST);

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

/** A tiling grain texture (pebbles, ripples) so the ground has detail up close. Purely visual. */
function useGrain(world: 'mars' | 'moon', st: GroundStyle) {
  return useMemo(() => {
    const S = 256, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d')!;
    const img = g.createImageData(S, S);
    let seed = world === 'mars' ? 11 : 23;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < S * S; i++) {
      const x = i % S, y = Math.floor(i / S);
      const ripple = st.ripples * 0.06 * Math.sin((x + y * 0.35) * 0.25);
      const v = 0.82 + rnd() * 0.22 + ripple;
      const k = Math.round(Math.min(1, v) * 255);
      img.data.set([k, k, k, 255], i * 4);
    }
    g.putImageData(img, 0, 0);
    // scattered pebbles
    for (let i = 0; i < st.gravel; i++) {
      const r = 0.6 + rnd() * 2.4;
      g.fillStyle = rnd() < 0.2 ? `rgba(255,235,210,${0.1 + rnd() * 0.15})` : `rgba(0,0,0,${0.12 + rnd() * 0.3})`;
      g.beginPath(); g.arc(rnd() * S, rnd() * S, r, 0, Math.PI * 2); g.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1600, 1600);   // ~7.5 m per tile on a 12 km map
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [world, st]);
}

function Ground({ t, world, st }: { t: Terrain; world: 'mars' | 'moon'; st: GroundStyle }) {
  const grain = useGrain(world, st);
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(t.size, t.size, t.n - 1, t.n - 1);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, t.h[i]);
    g.computeVertexNormals();
    // colour: base tone, varied by slope and a little noise (the shape is real data, the colour is not)
    const nrm = g.attributes.normal as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    const base = st.sand, rock = st.rock;
    for (let i = 0; i < pos.count; i++) {
      const steep = 1 - nrm.getY(i);
      const k = Math.min(1, steep * 3.2);
      const nz = 0.9 + 0.2 * Math.sin(pos.getX(i) * 0.013 + Math.cos(pos.getZ(i) * 0.011) * 3) * Math.cos(pos.getZ(i) * 0.017);
      let pk = 0;                                   // bare lava patches: smooth noise, sharp-ish edges
      if (st.patches) { const n = fbm(pos.getX(i) * 0.0055 + 3.1, 0.5, pos.getZ(i) * 0.0055 - 1.7); pk = Math.min(0.85, Math.max(0, (n - 0.08) * 4)); }
      for (let c = 0; c < 3; c++) col[i * 3 + c] = ((base[c] * (1 - k) + rock[c] * k) * (1 - pk) + (st.patches?.[c] ?? 0) * pk) * nz;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }, [t, st]);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial vertexColors map={grain} roughness={1} metalness={0} />
    </mesh>
  );
}

/** The wide backdrop (120 km, coarse) under the detailed map, so distant walls and floors are there to see.
 *  Inside the walkable square it is tucked 40 m under the detailed ground so the two never fight. */
function Backdrop({ t, st }: { t: Terrain; st: GroundStyle }) {
  const geo = useMemo(() => {
    const f = t.far!, g = new THREE.PlaneGeometry(f.size, f.size, f.n - 1, f.n - 1);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute, half = t.size / 2;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, Math.abs(x) < half && Math.abs(z) < half ? heightAt(t, x, z) - 40 : f.h[i]);
    }
    g.computeVertexNormals();
    const nrm = g.attributes.normal as THREE.BufferAttribute, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const k = Math.min(1, (1 - nrm.getY(i)) * 4);
      for (let c = 0; c < 3; c++) col[i * 3 + c] = st.sand[c] * (1 - k) + st.rock[c] * k;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }, [t, st]);
  return <mesh geometry={geo}><meshStandardMaterial vertexColors roughness={1} /></mesh>;
}

/** Rocks you can bump into (filled by the rock field around you). */
export const ROCKS: { x: number; z: number; r: number }[] = [];

const CELL = 30, RING = 8;   // rocks are generated in 30 m cells, 8 cells around you (about 250 m)
function hash(a: number, b: number) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822519) + 0x9e3779b9 | 0; return ((h >>> 0) % 100000) / 100000; };
}

/** Smooth 3D value noise (deterministic), used to roughen rock shapes. */
function vnoise(x: number, y: number, z: number) {
  const h = (i: number, j: number, k: number) => { const n = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453; return n - Math.floor(n); };
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const L = (a: number, b: number, t: number) => a + (b - a) * t;
  return L(L(L(h(xi, yi, zi), h(xi + 1, yi, zi), u), L(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
           L(L(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), L(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v), w) * 2 - 1;
}
const fbm = (x: number, y: number, z: number) => vnoise(x, y, z) * 0.6 + vnoise(x * 2.3, y * 2.3, z * 2.3) * 0.3 + vnoise(x * 5.1, y * 5.1, z * 5.1) * 0.1;

/** Push every vertex in or out by noise (same position -> same push, so seams stay closed),
 *  then shade: dusty light tops, plain sides, dark undersides. */
function roughen(g: THREE.BufferGeometry, amt: number, freq: number, radialOnly = false) {
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = fbm(x * freq + 7.3, y * freq * (radialOnly ? 3 : 1), z * freq - 2.1) * amt;
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
  return useMemo(() => {
    const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d')!, img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) {
      const bed = 0.08 * Math.sin(y * 0.21 + Math.sin(y * 0.037) * 4) + 0.05 * vnoise(0, y * 0.09, 3);
      for (let x = 0; x < S; x++) {
        const n = fbm(x * 0.018, y * 0.05, 1.7) * 0.18 + (Math.random() - 0.5) * 0.12;
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
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(3, 1); tex.anisotropy = 8; tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

/** Rocks and bedrock slabs, generated cell by cell around you, so the ground stays rocky wherever you walk.
 *  The same cell always gets the same rocks. */
function Rocks({ t, st, pos }: { t: Terrain; st: GroundStyle; pos: React.MutableRefObject<THREE.Vector3> }) {
  const rocks = useRef<THREE.InstancedMesh>(null), slabs = useRef<THREE.InstancedMesh>(null), layers = useRef<THREE.InstancedMesh>(null);
  const side = RING * 2 + 1;
  const RC = side * side * st.rocks, SC = Math.max(1, side * side * st.slabs), LC = st.outcrops ? side * side * 15 : 1;
  const bandA = useMemo(() => new THREE.Color(st.bands?.[0] ?? st.stone), [st]), bandB = useMemo(() => new THREE.Color(st.bands?.[1] ?? st.stone), [st]);
  const cur = useRef('');
  const tex = useRockTexture();
  // a broken-edged plate: notched outline, slightly undercut (top wider than bottom), rough faces
  const jagged = useMemo(() => {
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
  const boulder = useMemo(() => roughen(new THREE.IcosahedronGeometry(1, 1), 0.32, 1.6), []);
  const slabGeo = useMemo(() => roughen(new THREE.CylinderGeometry(0.5, 0.55, 1, 10, 1), 0.08, 3, true), []);
  const stone = useMemo(() => new THREE.Color(st.stone), [st]);
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const cx = Math.floor(pos.current.x / CELL), cz = Math.floor(pos.current.z / CELL), key = cx + ',' + cz;
    if (key === cur.current || !rocks.current || !slabs.current || !layers.current) return;
    cur.current = key;
    ROCKS.length = 0;
    let ri = 0, si = 0, li = 0;
    for (let i = -RING; i <= RING; i++) for (let j = -RING; j <= RING; j++) {
      const rnd = hash(cx + i, cz + j);
      for (let k = 0; k < st.rocks; k++) {
        const x = (cx + i + rnd()) * CELL, z = (cz + j + rnd()) * CELL;
        const boulder = rnd() < st.big && Math.hypot(x, z) > 12;
        const s = boulder ? 0.25 + Math.pow(rnd(), 2.5) * 1.3 : 0.05 + rnd() * 0.16;
        o.position.set(x, heightAt(t, x, z) + s * 0.15, z);
        o.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
        o.scale.set(s * (0.7 + rnd() * 0.8), s * (0.4 + rnd() * 0.5), s * (0.7 + rnd() * 0.6));
        o.updateMatrix(); rocks.current.setMatrixAt(ri, o.matrix);
        rocks.current.setColorAt(ri++, stone.clone().multiplyScalar(0.75 + rnd() * 0.5));
        if (s > 0.45) ROCKS.push({ x, z, r: s + 0.4 });
      }
      for (let k = 0; k < st.slabs; k++) {
        const x = (cx + i + rnd()) * CELL, z = (cz + j + rnd()) * CELL;
        const w = (1.5 + rnd() * 4) * (st.slabSize ?? 1);
        const grade = Math.hypot(heightAt(t, x + 3, z) - heightAt(t, x - 3, z), heightAt(t, x, z + 3) - heightAt(t, x, z - 3)) / 6;
        if (grade > 0.07) { rnd(); rnd(); rnd(); rnd(); continue; }   // a flat plate would stick out of a slope
        o.position.set(x, heightAt(t, x, z) + (st.slabSize ? 0.04 : -0.03), z);
        o.rotation.set((rnd() - 0.5) * 0.04, rnd() * 3, (rnd() - 0.5) * 0.04);
        o.scale.set(w, (0.12 + rnd() * 0.18) * (st.slabSize ? 0.5 : 1), w * (0.5 + rnd() * 0.6));
        o.updateMatrix(); slabs.current.setMatrixAt(si++, o.matrix);
      }
      // Layered rock ledge: broad broken plates stacked like pages. Each layer steps back the same way,
      // so one side is a cliff of exposed layers and the other a gentle slope (like tilted sediment).
      if (st.outcrops && rnd() < st.outcrops) {
        const x = (cx + i + 0.2 + rnd() * 0.6) * CELL, z = (cz + j + 0.2 + rnd() * 0.6) * CELL;
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
          o.updateMatrix(); layers.current.setMatrixAt(li, o.matrix);
          layers.current.setColorAt(li++, (k % 2 ? bandA : bandB).clone().multiplyScalar(0.8 + rnd() * 0.35));
          y += th * 0.92; off += ww * (0.06 + rnd() * 0.1); ww *= 0.78 + rnd() * 0.2; d *= 0.85 + rnd() * 0.15;
        }
        ROCKS.push({ x, z, r: w * 0.4 + 0.6 });
      }
    }
    rocks.current.count = ri; slabs.current.count = si; layers.current.count = li;
    rocks.current.instanceMatrix.needsUpdate = true; slabs.current.instanceMatrix.needsUpdate = true; layers.current.instanceMatrix.needsUpdate = true;
    if (layers.current.instanceColor) layers.current.instanceColor.needsUpdate = true;
    if (rocks.current.instanceColor) rocks.current.instanceColor.needsUpdate = true;
  });
  useEffect(() => { cur.current = ''; }, [t, st]);
  return (
    <>
      <instancedMesh ref={rocks} args={[undefined, undefined, RC]} frustumCulled={false}>
        <primitive object={boulder} attach="geometry" />
        <meshStandardMaterial map={tex} vertexColors roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={slabs} args={[undefined, undefined, SC]} frustumCulled={false}>
        <primitive object={st.slabSize ? jagged : slabGeo} attach="geometry" />
        <meshStandardMaterial map={tex} vertexColors color={st.slab ?? st.stone} roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={layers} args={[undefined, undefined, LC]} frustumCulled={false}>
        <primitive object={jagged} attach="geometry" />
        <meshStandardMaterial map={tex} vertexColors roughness={1} flatShading />
      </instancedMesh>
    </>
  );
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
          <mesh><cylinderGeometry args={[lens, lens, 0.09, 28]} /><meshStandardMaterial color="#ff7a1a" emissive="#5a2200" metalness={0.3} roughness={0.35} /></mesh>
          <mesh position={[0, 0.047, 0]}><cylinderGeometry args={[lens * 0.74, lens * 0.74, 0.01, 28]} /><meshStandardMaterial color="#14324a" metalness={0.9} roughness={0.05} /></mesh>
        </group>
      ))}
      <mesh position={[0, head.c.y + head.sz.y * 0.18, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[head.sz.x * 0.62 + 0.04, head.sz.z * 0.62 + 0.04, 1]}>
        <torusGeometry args={[1, 0.05, 8, 40]} /><meshStandardMaterial color="#3a2a22" roughness={0.9} />
      </mesh>
      {/* scarf: wrapped round the head just under the goggles, two tails blowing out behind */}
      <mesh position={[0, head.bottom + 0.04, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[head.sz.x * 0.7 + 0.06, head.sz.z * 0.7 + 0.06, 1.5]}>
        <torusGeometry args={[1, 0.09, 12, 40]} /><meshStandardMaterial map={checks} roughness={1} />
      </mesh>
      <group ref={tails} position={[0, head.bottom + 0.04, -(head.front - head.c.z) - 0.02]}>
        {[-0.09, 0.09].map((x, i) => (
          <group key={i} position={[x, 0, 0]}>
            <mesh position={[0, -0.5, 0]}>
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
  const g = useRef<THREE.Group>(null);
  const yaw = useRef(look.current.yaw);
  const placed = useRef(false);
  useFrame((_, dtRaw) => {
    const r = g.current; if (!r) return;
    const dt = Math.min(dtRaw, 0.05), P = pos.current, L = look.current;
    const fx = -Math.sin(L.yaw), fz = -Math.cos(L.yaw), rx = Math.cos(L.yaw), rz = -Math.sin(L.yaw);
    const tx = P.x + rx * 4 + fx * 10, tz = P.z + rz * 4 + fz * 10;   // ahead and to your right, in view
    if (!placed.current) { r.position.set(tx, heightAt(t, tx, tz), tz); placed.current = true; }
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
    r.position.y = heightAt(t, x, z);
    // tilt with the ground under its wheels
    const ax = Math.sin(yaw.current), az = Math.cos(yaw.current);
    const pitch = Math.atan2(heightAt(t, x - ax * 1.5, z - az * 1.5) - heightAt(t, x + ax * 1.5, z + az * 1.5), 3);
    r.rotation.set(0, 0, 0);
    r.rotateY(yaw.current); r.rotateX(pitch);
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
    <instancedMesh ref={ref} args={[undefined, undefined, N]} frustumCulled={false}>
      <planeGeometry args={[0.15, 0.36]} />
      <meshStandardMaterial map={tex} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-2} roughness={1} />
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
    if (!placed.current) { r.position.set(tx, heightAt(t, tx, tz), tz); lastPrint.current.copy(r.position); placed.current = true; }
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
    r.position.y = heightAt(t, r.position.x, r.position.z);
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

/** First-person walker: keys move, drag to look, height follows the real terrain. */
function Walker({ t, keys, onMove, look, pos }: { pos: React.MutableRefObject<THREE.Vector3>; t: Terrain; keys: React.MutableRefObject<Keys>; onMove: (s: { elev: number; moving: boolean; x: number; z: number }) => void; look: React.MutableRefObject<{ yaw: number; pitch: number }> }) {
  const { camera } = useThree();
  const p = pos;
  const last = useRef(0);
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
    const ground = heightAt(t, p.current.x, p.current.z);
    camera.position.set(p.current.x, ground + EYE, p.current.z);
    camera.rotation.set(L.pitch, L.yaw, 0, 'YXZ');
    last.current += dt;
    if (last.current > 0.1) { last.current = 0; onMove({ elev: ground, moving: len > 0, x: p.current.x, z: p.current.z }); }
  });
  return null;
}

/** Blowing dust: grains streaming past you on the wind, wrapped around the camera so they never run out. */
function Dust() {
  const { camera } = useThree();
  const N = 5000, R = 40;
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
      <pointsMaterial color="#e2b48a" map={sprite} size={0.09} transparent opacity={0.75} depthWrite={false} />
    </points>
  );
}

function Sky({ world, storm, high, earthHigh }: { world: 'mars' | 'moon'; storm?: boolean; high?: boolean; earthHigh?: boolean }) {
  const { scene } = useThree();
  useEffect(() => {
    if (storm) {
      scene.background = new THREE.Color('#b8875e');
      scene.fog = new THREE.FogExp2('#b8875e', 0.0105);    // dust storm: you see a couple of hundred metres
    } else if (high) {
      scene.background = new THREE.Color('#a4806c');
      scene.fog = new THREE.Fog('#a98571', 9000, 75000);   // 21 km up: thin, clear air, you see far
    } else if (world === 'mars') {
      scene.background = new THREE.Color('#c9946c');
      scene.fog = new THREE.Fog('#c9946c', 2500, 14000);   // dusty air
    } else {
      scene.background = new THREE.Color('#000000');
      scene.fog = null;                                    // no air, no haze: far ridges stay razor sharp
    }
    return () => { scene.background = null; scene.fog = null; };
  }, [scene, world, storm, high]);
  if (storm) return <Dust />;
  return world === 'mars' ? (
    <mesh>
      <sphereGeometry args={[100000, 32, 16]} />
      <shaderMaterial side={THREE.BackSide} depthWrite={false} fog={false}
        vertexShader={'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }'}
        fragmentShader={high
          ? 'varying vec3 vP; void main(){ float h = clamp(vP.y*1.4+0.05,0.0,1.0); vec3 c = mix(vec3(0.66,0.52,0.45), vec3(0.24,0.2,0.24), h); gl_FragColor = vec4(c,1.0); }'
          : 'varying vec3 vP; void main(){ float h = clamp(vP.y*1.6+0.05,0.0,1.0); vec3 c = mix(vec3(0.82,0.6,0.43), vec3(0.55,0.36,0.27), h); gl_FragColor = vec4(c,1.0); }'} />
    </mesh>
  ) : (
    <>
      <Stars radius={15000} depth={2000} count={4000} factor={60} saturation={0} fade={false} speed={0} />
      {/* From the lunar south pole, Earth hangs just above the horizon */}
      {/* Near the equator on the near side (Apollo 16) Earth stands high in the sky instead */}
      <group position={earthHigh ? [-3000, 15500, -6000] : [-9000, 2200, -14000]} scale={620}>
        <Surface tex="tex/earth_base.webp" shade={1.1} />
      </group>
    </>
  );
}

export default function TerrainWalk({ t, id, world, keys, onMove, say, onTap }: { say?: string | null; onTap?: () => void; t: Terrain; id: string; world: 'mars' | 'moon'; keys: React.MutableRefObject<Keys>; onMove: (s: { elev: number; moving: boolean; x: number; z: number }) => void }) {
  const st = styleFor(id, world);
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
  // the bootprint waiting in front of you when you land
  const firstPrint = useMemo(() => {
    const y = look.current.yaw, x = start.x - Math.sin(y) * 5.5 - Math.cos(y) * 0.4, z = start.z - Math.cos(y) * 5.5 + Math.sin(y) * 0.4;
    return { x, z, yaw: -y + 0.25 };
  }, [start]);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [grab, setGrab] = useState(false);
  // Sun behind your shoulder when you land, so the view is lit. Mars: mid-afternoon. Moon pole: very low, long shadows.
  const y0 = look.current.yaw;
  const sun = world === 'mars'
    ? new THREE.Vector3(Math.sin(y0) * 0.7 + 0.3, 0.45, Math.cos(y0) * 0.7)
    : new THREE.Vector3(Math.sin(y0 + 0.5), st.sunHigh ? 0.55 : 0.16, Math.cos(y0 + 0.5));
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
        <Canvas dpr={[1, 1.5]} camera={{ fov: 70, near: 0.5, far: 160000 }} gl={{ antialias: true }}>
          <hemisphereLight args={[world === 'mars' ? '#f2c9a5' : '#3a3a48', world === 'mars' ? '#7a4a32' : '#050507', st.storm ? 1.25 : world === 'mars' ? 0.75 : 0.18]} />
          <directionalLight position={sun.multiplyScalar(10000)} intensity={st.storm ? 1.3 : world === 'mars' ? 2.6 : 3.4} color={world === 'mars' ? '#ffe2c4' : '#ffffff'} />
          <Suspense fallback={null}>
            <Sky world={world} storm={st.storm} high={st.high} earthHigh={st.sunHigh} />
            <Ground t={t} world={world} st={st} />
            {t.far && <Backdrop t={t} st={st} />}
            <Rocks t={t} st={st} pos={pos} />
          </Suspense>
          {world === 'moon' && <Footprints t={t} first={firstPrint} />}
          {world === 'moon' && <Suspense fallback={null}><Astronaut t={t} pos={pos} look={look} say={say ?? null} onTap={onTap ?? (() => {})} /></Suspense>}
          {world === 'mars' && <Suspense fallback={null}><Rover t={t} pos={pos} look={look} say={say ?? null} onTap={onTap ?? (() => {})} gear={!!st.storm} /></Suspense>}
          <Walker t={t} keys={keys} onMove={onMove} look={look} pos={pos} />
        </Canvas>
      </Safe3D>
    </div>
  );
}
