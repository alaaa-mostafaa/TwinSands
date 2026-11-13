// Terrain shadows, precomputed once per walk on the CPU from the real height grids.
// For every grid point we march toward the Sun and keep the steepest angle up to the skyline (with the planet's
// curvature). The texture stores (skyline angle - Sun elevation) in radians: interpolating an angle and thresholding
// it per pixel gives crisp ridge shadows even from a 47 m grid, where interpolating "lit / not lit" would blur them.
import * as THREE from 'three';
import type { Terrain } from '../TerrainWalk';

export const PLANET_R = { mars: 3389500, moon: 1737400 } as const;

type Grid = { n: number; size: number; h: Float32Array; max: number };

function bilinear(g: Grid, x: number, z: number) {
  const k = (g.n - 1) / g.size;
  const c = (x + g.size / 2) * k, r = (z + g.size / 2) * k;
  if (c < 0 || r < 0 || c > g.n - 1 || r > g.n - 1) return NaN;
  const c0 = Math.min(g.n - 2, Math.floor(c)), r0 = Math.min(g.n - 2, Math.floor(r)), fc = c - c0, fr = r - r0, i = r0 * g.n + c0, h = g.h;
  return (h[i] * (1 - fc) + h[i + 1] * fc) * (1 - fr) + (h[i + g.n] * (1 - fc) + h[i + g.n + 1] * fc) * fr;
}

const gridOf = (t: Terrain): Grid => {
  let max = -Infinity;
  for (let i = 0; i < t.h.length; i++) if (t.h[i] > max) max = t.h[i];
  return { n: t.n, size: t.size, h: t.h, max };
};

/** Height anywhere: the detailed walk map inside its square, the wide backdrop beyond it. */
function heightField(t: Terrain) {
  const near = gridOf(t), far = t.far ? gridOf(t.far) : null, half = t.size / 2;
  const max = Math.max(near.max, far?.max ?? -Infinity);
  const at = (x: number, z: number) => (Math.abs(x) <= half && Math.abs(z) <= half ? bilinear(near, x, z) : far ? bilinear(far, x, z) : NaN);
  return { at, max, reach: far ? far.size / 2 : half };
}

/** Steepest skyline slope (tan) seen from (x, z, h0) looking along (dx, dz). Exact near the Sun's elevation;
 *  it stops early once the point is surely in deep shadow (best > hi) or nothing further away can rise above lo. */
function skyline(at: (x: number, z: number) => number, max: number, x: number, z: number, h0: number, dx: number, dz: number,
  step0: number, reach: number, invTwoR: number, lo: number, hi: number) {
  let best = -1e9;
  for (let d = step0; d < reach * 1.5; d += Math.max(step0, d * 0.03)) {
    if ((max - h0) / d < Math.max(best, lo)) break;
    const h = at(x + dx * d, z + dz * d);
    if (h !== h) break;                                             // left the data
    const s = (h - h0 - d * d * invTwoR) / d;
    if (s > best) { best = s; if (best > hi) break; }
  }
  return best;
}

function texture(data: Uint16Array, n: number) {
  const tex = new THREE.DataTexture(data, n, n, THREE.RedFormat, THREE.HalfFloatType);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** Horizon-margin textures for the walk map and (if present) the backdrop, for a given Sun direction. */
export function sunHorizon(t: Terrain, sun: THREE.Vector3, world: 'mars' | 'moon') {
  const s = sun.clone().normalize(), hz = Math.hypot(s.x, s.z) || 1e-6;
  const dx = s.x / hz, dz = s.z / hz, tanSun = s.y / hz, sunEl = Math.atan(tanSun);
  const invTwoR = 1 / (2 * PLANET_R[world]);
  const F = heightField(t);
  const one = (g: Terrain, lift: number) => {
    const n = g.n, cell = g.size / (n - 1), half = g.size / 2, out = new Uint16Array(n * n);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const x = -half + c * cell, z = -half + r * cell, h0 = g.h[r * n + c] + lift;
      const best = skyline(F.at, F.max, x, z, h0, dx, dz, cell * 0.7, F.reach, invTwoR, tanSun - 0.15, tanSun + 0.15);
      out[r * n + c] = THREE.DataUtils.toHalfFloat(Math.max(-1, Math.min(1, Math.atan(best) - sunEl)));
    }
    return texture(out, n);
  };
  const near = one(t, 1.5);
  const far = t.far ? one(t.far, 3) : null;
  return { near, far };
}

/** How sunlit the ground around a spot would be for a Sun at this azimuth/elevation (0..1), from a ring of samples. */
export function litFraction(t: Terrain, x0: number, z0: number, az: number, elev: number, world: 'mars' | 'moon') {
  const F = heightField(t), invTwoR = 1 / (2 * PLANET_R[world]), tanSun = Math.tan(elev);
  const dx = Math.sin(az), dz = Math.cos(az);
  let lit = 0, n = 0;
  for (const rad of [0, 40, 120, 300]) for (let k = 0; k < (rad ? 8 : 1); k++) {
    const a = (k / 8) * Math.PI * 2, x = x0 + Math.sin(a) * rad, z = z0 + Math.cos(a) * rad;
    const h0 = F.at(x, z); if (h0 !== h0) continue;
    const best = skyline(F.at, F.max, x, z, h0 + 1.5, dx, dz, 30, F.reach, invTwoR, tanSun - 0.02, tanSun + 0.02);
    lit += best < tanSun ? (rad ? 1 : 3) : 0; n += rad ? 1 : 3;
  }
  return n ? lit / n : 1;
}

/** Hollows (+) and crests (-) of the walk map, about -1..1: fine dust collects in the hollows. */
export function cavity(t: Terrain) {
  const n = t.n, h = t.h, out = new Float32Array(n * n), cell = t.size / (n - 1);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    let sum = 0, k = 0;
    for (let dr = -2; dr <= 2; dr += 2) for (let dc = -2; dc <= 2; dc += 2) {
      if (!dr && !dc) continue;
      const rr = Math.min(n - 1, Math.max(0, r + dr)), cc = Math.min(n - 1, Math.max(0, c + dc));
      sum += h[rr * n + cc]; k++;
    }
    out[r * n + c] = Math.max(-1, Math.min(1, (sum / k - h[r * n + c]) / (cell * 0.12)));
  }
  return out;
}
