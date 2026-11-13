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

/** A layered outcrop about 1 x 1 m in plan and 1 m tall (scaled per instance): an angular, jointed outline (a
 *  polygon with V-shaped joints cut into it), beds that recess or jut out as ledges, broken corners from fracture
 *  planes, and a flat, stepped top. Its local y (0..1) gives the layer colours in the shader. seg/rows set the detail. */
export function makeOutcrop(seed: number, seg = 22, rows = 18) {
  let g: THREE.BufferGeometry = new THREE.BoxGeometry(1, 1, 1, seg, rows, seg);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const rnd = mulberry32(seed * 104729 + 7), p = g.attributes.position as THREE.BufferAttribute;
  const nL = Math.max(4, Math.round(rows / 2));
  const soft = Array.from({ length: nL + 1 }, () => rnd());
  const off = Array.from({ length: nL + 1 }, () => [(rnd() - 0.5) * 0.06, (rnd() - 0.5) * 0.06]);
  // planform: an irregular polygon, plus a few vertical joints (narrow V notches)
  const K = 5 + Math.floor(rnd() * 4), ang = Array.from({ length: K }, (_, k) => ((k + 0.2 + rnd() * 0.6) / K) * Math.PI * 2), rad = ang.map(() => 0.7 + rnd() * 0.3);
  const joints = Array.from({ length: 2 + Math.floor(rnd() * 3) }, () => ({ a: rnd() * Math.PI * 2, w: 0.05 + rnd() * 0.08, d: 0.12 + rnd() * 0.2 }));
  const outline = (a: number) => {
    a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    let k = K - 1; while (k > 0 && ang[k] > a) k--;
    if (a < ang[0]) k = K - 1;
    const a0 = ang[k], a1 = k === K - 1 ? ang[0] + Math.PI * 2 : ang[k + 1], aa = a < a0 ? a + Math.PI * 2 : a;
    const tt = (aa - a0) / (a1 - a0);
    // straight edge between the two corners (in polar form, so the side is a line, not an arc)
    const c0 = [Math.cos(a0) * rad[k], Math.sin(a0) * rad[k]], c1 = [Math.cos(a1) * rad[(k + 1) % K], Math.sin(a1) * rad[(k + 1) % K]];
    const ex = c1[0] - c0[0], ez = c1[1] - c0[1], dx = Math.cos(aa), dz = Math.sin(aa);
    const den = dx * ez - dz * ex, r = Math.abs(den) > 1e-6 ? (c0[0] * ez - c0[1] * ex) / den : rad[k] * (1 - tt) + rad[(k + 1) % K] * tt;
    let jr = 1;
    for (const j of joints) { const da = Math.abs(((a - j.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI); if (da < j.w) jr = Math.min(jr, 1 - j.d * (1 - da / j.w)); }
    return Math.max(0.3, r) * jr;
  };
  const planes = Array.from({ length: 3 + Math.floor(rnd() * 3) }, () => ({ n: new THREE.Vector3(rnd() - 0.5, rnd() * 0.6 + 0.2, rnd() - 0.5).normalize(), d: 0.42 + rnd() * 0.12 }));
  const o = seed * 5.3, tilt = 0.15 + rnd() * 0.35, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), z = p.getZ(i);
    const y = p.getY(i) + 0.5;
    const m = Math.max(Math.abs(x), Math.abs(z)), r = Math.hypot(x, z);   // square -> disc
    if (r > 1e-6) { const k = m / r; x *= k; z *= k; }
    const a = Math.atan2(z, x), R = Math.hypot(x, z) * 2;
    const L = Math.min(nL - 1, Math.floor(y * nL));
    const recess = soft[L] > 0.55 ? 1 - 0.18 * (soft[L] - 0.55) / 0.45 : 1 + 0.03 * soft[L];   // soft beds weather back
    const taper = 1 - 0.18 * Math.pow(y, 1.5);
    const rr = 0.5 * outline(a) * recess * taper * R * (1 + 0.025 * vnoise(a * 5 + o, y * 7, 1.3));
    x = Math.cos(a) * rr + off[L][0] * R; z = Math.sin(a) * rr + off[L][1] * R;
    let yy = y * (0.8 + tilt * (x + 0.5) * 0.5);
    if (y > 0.97) yy = Math.floor(yy * nL * 0.999) / nL + 0.03 + 0.02 * vnoise(x * 6 + o, 0, z * 6);
    v.set(x, yy - 0.5, z);
    for (const pl of planes) { const e = v.dot(pl.n) - pl.d; if (e > 0) v.addScaledVector(pl.n, -e * 0.9); }   // broken corners
    p.setXYZ(i, v.x, v.y + 0.5 - 0.18, v.z);
  }
  return toCreasedNormals(g, 0.45);
}
