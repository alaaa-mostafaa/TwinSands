import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useMemo, useRef } from 'react';
import * as THREE from 'three';
import Safe3D from '../components/Safe3D';
import { useJSON } from '../data';
import { Atmosphere, latLonToVec3, Surface } from './Globe';

// Earth's three wind belts in each hemisphere (Hadley, Ferrel and polar cells):
//   0–30°  trade winds blow toward the west (and toward the equator)
//   30–60° westerlies blow toward the east (and toward the poles)
//   60–90° polar easterlies blow toward the west
// Speeds are illustrative, not measured.
const N = 1400;
const D2R = Math.PI / 180;

function band(lat: number) {
  const a = Math.abs(lat), s = Math.sign(lat) || 1;
  if (a < 30) return { u: -16, v: -s * 4, c: [0.45, 0.85, 1] };       // trade winds
  if (a < 60) return { u: 20, v: s * 3, c: [1, 1, 1] };               // westerlies
  return { u: -12, v: -s * 2, c: [0.7, 0.75, 1] };                    // polar easterlies
}

type Field = { lats: number[]; lons: number[]; u: number[][]; v: number[][] };

/** Bilinear sample of the Mars Climate Database grid (rows indexed [lon][lat]), m/s. */
function sample(f: Field, lat: number, lon: number) {
  const { lats, lons } = f;
  const dLon = lons[1] - lons[0], dLat = lats[1] - lats[0];
  let x = (lon - lons[0]) / dLon; x = ((x % lons.length) + lons.length) % lons.length;
  const y = Math.min(lats.length - 1.001, Math.max(0, (lat - lats[0]) / dLat));
  const x0 = Math.floor(x), x1 = (x0 + 1) % lons.length, y0 = Math.floor(y), y1 = y0 + 1, fx = x - x0, fy = y - y0;
  const bl = (g: number[][]) => (g[x0][y0] * (1 - fx) + g[x1][y0] * fx) * (1 - fy) + (g[x0][y1] * (1 - fx) + g[x1][y1] * fx) * fy;
  return { u: bl(f.u), v: bl(f.v) };
}

const MARS_GAIN = 0.4;   // degrees per second of animation per m/s of real wind

function Streaks({ field }: { field?: Field }) {
  const geo = useMemo(() => new THREE.BufferGeometry(), []);
  const st = useMemo(() => {
    const lat = new Float32Array(N), lon = new Float32Array(N), age = new Float32Array(N), life = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      lat[i] = Math.asin(Math.random() * 2 - 1) / D2R; lon[i] = Math.random() * 360 - 180;
      life[i] = 2 + Math.random() * 3; age[i] = Math.random() * life[i];
    }
    const pos = new Float32Array(N * 6), col = new Float32Array(N * 6);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return { lat, lon, age, life, pos, col };
  }, [geo]);
  const v = new THREE.Vector3();
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const { lat, lon, age, life, pos, col } = st;
    for (let i = 0; i < N; i++) {
      age[i] += dt;
      if (age[i] > life[i] || Math.abs(lat[i]) > 88) {
        lat[i] = Math.asin(Math.random() * 2 - 1) / D2R; lon[i] = Math.random() * 360 - 180; age[i] = 0;
      }
      let b = band(lat[i]);
      if (field) {
        const w = sample(field, lat[i], lon[i]);
        const sp = Math.hypot(w.u, w.v), t = Math.min(1, sp / 60);
        b = { u: w.u * MARS_GAIN, v: w.v * MARS_GAIN, c: [1, 0.55 + 0.4 * t, 0.3 + 0.5 * t] };
      }
      const cosl = Math.max(Math.cos(lat[i] * D2R), 0.2);
      lon[i] += (b.u * dt) / cosl;
      lat[i] += b.v * dt;
      // head and a tail 2.2 s behind, so each streak shows its direction
      v.copy(latLonToVec3([lat[i], lon[i]], 1.012));
      pos.set([v.x, v.y, v.z], i * 6);
      v.copy(latLonToVec3([lat[i] - b.v * 0.9, lon[i] - (b.u * 0.9) / cosl], 1.012));
      pos.set([v.x, v.y, v.z], i * 6 + 3);
      const fade = Math.sin((age[i] / life[i]) * Math.PI);
      col.set([b.c[0] * fade, b.c[1] * fade, b.c[2] * fade], i * 6);
      col.set([0, 0, 0], i * 6 + 3);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  });
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial vertexColors transparent blending={THREE.AdditiveBlending} depthWrite={false} />
    </lineSegments>
  );
}

function Scene({ world, field }: { world: 'earth' | 'mars'; field?: Field }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (g.current) g.current.rotation.y += dt * 0.05; });
  return (
    <group rotation={[0.25, 0, 0]}>
      <group ref={g} rotation={[0, -0.6, 0]}>
        <Surface tex={world === 'mars' ? 'tex/mars_base.webp' : 'tex/earth_base.webp'} shade={0.4} />
        {(world === 'earth' || field) && <Streaks field={field} />}
      </group>
      <Atmosphere color={world === 'mars' ? '#ff9a6a' : '#6fb6ff'} />
    </group>
  );
}

export default function WindGlobe({ world = 'earth' }: { world?: 'earth' | 'mars' }) {
  const field = useJSON<Field>(world === 'mars' ? 'data/mars_winds.json' : '');
  return (
    <div className="windglobe">
      <Safe3D fallback={<div className="no3d">3D view unavailable in this browser</div>}>
        <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 3.2], fov: 35 }} gl={{ antialias: true, alpha: true }}>
          <ambientLight intensity={0.4} />
          <directionalLight position={[-3, 2, 4]} intensity={1.4} />
          <Suspense fallback={null}><Scene world={world} field={world === 'mars' ? field ?? undefined : undefined} /></Suspense>
          <OrbitControls enablePan={false} enableZoom={false} rotateSpeed={0.5} />
        </Canvas>
      </Safe3D>
      {world === 'mars' ? (
        <ul className="windlegend">
          <li><i style={{ background: '#ffd27a' }} />Real model winds</li>
          <li><span>10 km up · Mars Climate Database</span></li>
        </ul>
      ) : <ul className="windlegend">
        <li><i style={{ background: '#b3b8ff' }} />Polar easterlies <span>←</span></li>
        <li><i style={{ background: '#fff' }} />Westerlies <span>→</span></li>
        <li><i style={{ background: '#73d9ff' }} />Trade winds <span>←</span></li>
      </ul>}
    </div>
  );
}
