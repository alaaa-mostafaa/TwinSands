// Rock shapes for the walk, built once at load. Real rocks are broken along fractures: flat facets meeting at
// sharp edges, chunky not round, with a flat buried base. Layered outcrops erode unevenly: soft beds recess and
// hard beds stick out as ledges.
import * as THREE from 'three';
import { mergeVertices, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth 3D value noise, -1..1 (deterministic). */
export function vnoise(x: number, y: number, z: number) {
  const h = (i: number, j: number, k: number) => { const n = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453; return n - Math.floor(n); };
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const L = (a: number, b: number, t: number) => a + (b - a) * t;
  return L(L(L(h(xi, yi, zi), h(xi + 1, yi, zi), u), L(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
    L(L(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), L(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v), w) * 2 - 1;
}
export const fbm3 = (x: number, y: number, z: number) => vnoise(x, y, z) * 0.6 + vnoise(x * 2.3, y * 2.3, z * 2.3) * 0.3 + vnoise(x * 5.1, y * 5.1, z * 5.1) * 0.1;

/** A broken rock about 1 m across, resting on y = 0 (its base buried to y = -0.3 h). detail 1 = small/far, 3 = big/near. */
export function makeRock(seed: number, detail: number, shape: 'angular' | 'rounded' = 'angular') {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(0.5, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const rnd = mulberry32(seed * 7919 + 13), p = g.attributes.position as THREE.BufferAttribute, v = new THREE.Vector3();
  const sx = 0.8 + rnd() * 0.45, sy = 0.6 + rnd() * 0.4, sz = 0.7 + rnd() * 0.4;
  const nPlanes = shape === 'angular' ? 7 + Math.floor(rnd() * 5) : 2 + Math.floor(rnd() * 2);
  const planes = Array.from({ length: nPlanes }, () => {
    const n = new THREE.Vector3(rnd() - 0.5, (rnd() - 0.35) * 0.9, rnd() - 0.5).normalize();
    return { n, d: (shape === 'angular' ? 0.2 : 0.33) + rnd() * 0.14 };
  });
  const o = seed * 3.7;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const r = 1 + 0.18 * fbm3(v.x * 2.2 + o, v.y * 2.2, v.z * 2.2 - o) + 0.035 * vnoise(v.x * 9 + o, v.y * 9, v.z * 9);
    v.multiplyScalar(r);
    v.set(v.x * sx, v.y * sy, v.z * sz);
    for (const pl of planes) { const e = v.dot(pl.n) - pl.d * (pl.n.y > 0.5 ? sy * 1.6 : 1); if (e > 0) v.addScaledVector(pl.n, -e * 0.92); }
    v.y = Math.max(v.y, -0.32 * sy);                 // flat base, sunk in the ground
    v.y += 0.12 * sy;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  return toCreasedNormals(g, shape === 'angular' ? 0.38 : 0.9);
}

/** A low layered outcrop about 1 x 1 m in plan and 1 m tall (scaled per instance): an irregular outline, beds that
 *  recess or jut, a stepped and tilted top. Its local y (0..1) gives the layer colours in the shader. */
export function makeOutcrop(seed: number) {
  const SEG = 28, ROWS = 12;
  let g: THREE.BufferGeometry = new THREE.BoxGeometry(1, 1, 1, SEG, ROWS, SEG);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const rnd = mulberry32(seed * 104729 + 7), p = g.attributes.position as THREE.BufferAttribute;
  const nL = 5 + Math.floor(rnd() * 5);
  const soft = Array.from({ length: nL + 1 }, () => rnd());
  const o = seed * 5.3;
  const outline = (a: number) => 0.78 + 0.22 * vnoise(Math.cos(a) * 1.3 + o, Math.sin(a) * 1.3, 0.5) + 0.07 * vnoise(Math.cos(a) * 5 + o, Math.sin(a) * 5, 2.5);
  const tilt = 0.25 + rnd() * 0.5;                 // one side higher: the top is a dipping bed
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i) + 0.5, z = p.getZ(i);
    // square -> disc, then the noisy outline
    const m = Math.max(Math.abs(x), Math.abs(z)), r = Math.hypot(x, z);
    if (r > 1e-6) { const k = (m / r); x *= k; z *= k; }
    const a = Math.atan2(z, x), R = Math.hypot(x, z) * 2;           // 0..1 from centre to edge
    const L = Math.min(nL, Math.floor(y * nL));
    const recess = 1 - 0.09 * soft[L] - 0.05 * vnoise(a * 3 + o, y * 6, 1.7);
    const taper = 1 - 0.32 * Math.pow(y, 1.4);
    const rr = 0.5 * outline(a) * recess * taper * R;
    x = Math.cos(a) * rr; z = Math.sin(a) * rr;
    // dip: the top surface (and the beds) slope up toward +x, in steps
    let yy = y * (0.75 + tilt * (x + 0.5) * 0.6);
    if (y > 0.97) yy = Math.floor(yy * nL * 0.999) / nL + 0.04 + 0.03 * vnoise(x * 6 + o, 0, z * 6);
    p.setXYZ(i, x, yy - 0.18, z);
  }
  return toCreasedNormals(g, 0.6);
}
