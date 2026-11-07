import { Stars } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import Safe3D from '../components/Safe3D';
import { Surface } from './Globe';

export type Terrain = { n: number; size: number; min: number; max: number; h: Float32Array };
export type Keys = { f: boolean; b: boolean; l: boolean; r: boolean; tl: boolean; tr: boolean; run: boolean };

const EYE = 2;            // metres above the ground
const WALK = 18, RUN = 70; // metres per second: sped up so a 12 km map is explorable

export async function loadTerrain(id: string): Promise<Terrain> {
  const [meta, buf] = await Promise.all([
    fetch('terrain/index.json').then((r) => r.json()),
    fetch(`terrain/${id}.bin`).then((r) => r.arrayBuffer()),
  ]);
  const m = meta[id];
  const q = new Uint16Array(buf);
  const h = new Float32Array(q.length);
  for (let i = 0; i < q.length; i++) h[i] = m.min + (q[i] / 65535) * (m.max - m.min);
  return { n: m.n, size: m.size_m, min: m.min, max: m.max, h };
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

/** A tiling grain texture (pebbles, ripples) so the ground has detail up close. Purely visual. */
function useGrain(world: 'mars' | 'moon') {
  return useMemo(() => {
    const S = 256, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d')!;
    const img = g.createImageData(S, S);
    let seed = world === 'mars' ? 11 : 23;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < S * S; i++) {
      const x = i % S, y = Math.floor(i / S);
      const ripple = world === 'mars' ? 0.06 * Math.sin((x + y * 0.35) * 0.25) : 0;
      const v = 0.82 + rnd() * 0.22 + ripple;
      const k = Math.round(Math.min(1, v) * 255);
      img.data.set([k, k, k, 255], i * 4);
    }
    g.putImageData(img, 0, 0);
    // scattered pebbles
    for (let i = 0; i < 260; i++) {
      const r = 0.6 + rnd() * 2.4;
      g.fillStyle = `rgba(0,0,0,${0.12 + rnd() * 0.25})`;
      g.beginPath(); g.arc(rnd() * S, rnd() * S, r, 0, Math.PI * 2); g.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1600, 1600);   // ~7.5 m per tile on a 12 km map
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [world]);
}

function Ground({ t, world }: { t: Terrain; world: 'mars' | 'moon' }) {
  const grain = useGrain(world);
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(t.size, t.size, t.n - 1, t.n - 1);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, t.h[i]);
    g.computeVertexNormals();
    // colour: base tone, varied by slope and a little noise (the shape is real data, the colour is not)
    const nrm = g.attributes.normal as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    const base = world === 'mars' ? [0.72, 0.4, 0.24] : [0.55, 0.55, 0.56];
    const rock = world === 'mars' ? [0.42, 0.26, 0.18] : [0.33, 0.33, 0.35];
    for (let i = 0; i < pos.count; i++) {
      const steep = 1 - nrm.getY(i);
      const k = Math.min(1, steep * 3.2);
      const nz = 0.9 + 0.2 * Math.sin(pos.getX(i) * 0.013 + Math.cos(pos.getZ(i) * 0.011) * 3) * Math.cos(pos.getZ(i) * 0.017);
      for (let c = 0; c < 3; c++) col[i * 3 + c] = (base[c] * (1 - k) + rock[c] * k) * nz;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }, [t, world]);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial vertexColors map={grain} roughness={1} metalness={0} />
    </mesh>
  );
}

/** Small rocks scattered near the start, so the ground has human scale up close. */
export const ROCKS: { x: number; z: number; r: number }[] = [];

function Rocks({ t, world }: { t: Terrain; world: 'mars' | 'moon' }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const COUNT = 2200;
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    let seed = 7;
    ROCKS.length = 0;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < COUNT; i++) {
      const a = rnd() * Math.PI * 2, d = 25 + Math.pow(rnd(), 0.6) * 1400;
      const x = Math.cos(a) * d, z = Math.sin(a) * d - 40;
      const s = 0.12 + Math.pow(rnd(), 4) * 1.1;
      o.position.set(x, heightAt(t, x, z) + s * 0.25, z);
      o.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      o.scale.set(s * (0.8 + rnd() * 0.6), s * (0.5 + rnd() * 0.4), s);
      if (s > 0.35) ROCKS.push({ x, z, r: s * 1.2 + 0.5 });
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [t]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, COUNT]}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color={world === 'mars' ? '#6e3a22' : '#59595c'} roughness={1} flatShading />
    </instancedMesh>
  );
}

/** First-person walker: keys move, drag to look, height follows the real terrain. */
function Walker({ t, keys, onMove, look }: { t: Terrain; keys: React.MutableRefObject<Keys>; onMove: (s: { elev: number; moving: boolean; x: number; z: number }) => void; look: React.MutableRefObject<{ yaw: number; pitch: number }> }) {
  const { camera } = useThree();
  const p = useRef(new THREE.Vector3(0, 0, 0));
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

function Sky({ world }: { world: 'mars' | 'moon' }) {
  const { scene } = useThree();
  useEffect(() => {
    if (world === 'mars') {
      scene.background = new THREE.Color('#c9946c');
      scene.fog = new THREE.Fog('#c9946c', 2500, 14000);   // dusty air
    } else {
      scene.background = new THREE.Color('#000000');
      scene.fog = null;                                    // no air, no haze: far ridges stay razor sharp
    }
    return () => { scene.background = null; scene.fog = null; };
  }, [scene, world]);
  return world === 'mars' ? (
    <mesh>
      <sphereGeometry args={[20000, 32, 16]} />
      <shaderMaterial side={THREE.BackSide} depthWrite={false} fog={false}
        vertexShader={'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }'}
        fragmentShader={'varying vec3 vP; void main(){ float h = clamp(vP.y*1.6+0.05,0.0,1.0); vec3 c = mix(vec3(0.82,0.6,0.43), vec3(0.55,0.36,0.27), h); gl_FragColor = vec4(c,1.0); }'} />
    </mesh>
  ) : (
    <>
      <Stars radius={15000} depth={2000} count={4000} factor={60} saturation={0} fade={false} speed={0} />
      {/* From the lunar south pole, Earth hangs just above the horizon */}
      <group position={[-9000, 2200, -14000]} scale={620}>
        <Surface tex="tex/earth_base.webp" shade={1.1} />
      </group>
    </>
  );
}

export default function TerrainWalk({ t, world, keys, onMove }: { t: Terrain; world: 'mars' | 'moon'; keys: React.MutableRefObject<Keys>; onMove: (s: { elev: number; moving: boolean; x: number; z: number }) => void }) {
  const look = useRef(useMemo(() => {
    const h0 = heightAt(t, 0, 0);
    let best = 0, yaw = 0;
    for (let a = 0; a < 64; a++) {
      const ang = (a / 64) * Math.PI * 2;
      for (const d of [2500, 4000, 5500]) {
        const x = -Math.sin(ang) * d, z = -Math.cos(ang) * d;
        const diff = Math.abs(heightAt(t, x, z) - h0) / Math.sqrt(d);
        if (diff > best) { best = diff; yaw = ang; }
      }
    }
    return { yaw, pitch: 0.02 };
  }, [t]));
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [grab, setGrab] = useState(false);
  // Sun behind your shoulder when you land, so the view is lit. Mars: mid-afternoon. Moon pole: very low, long shadows.
  const y0 = look.current.yaw;
  const sun = world === 'mars'
    ? new THREE.Vector3(Math.sin(y0) * 0.7 + 0.3, 0.45, Math.cos(y0) * 0.7)
    : new THREE.Vector3(Math.sin(y0 + 0.5), 0.16, Math.cos(y0 + 0.5));
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
        <Canvas dpr={[1, 1.5]} camera={{ fov: 70, near: 0.5, far: 40000 }} gl={{ antialias: true }}>
          <hemisphereLight args={[world === 'mars' ? '#f2c9a5' : '#3a3a48', world === 'mars' ? '#3a1e12' : '#050507', world === 'mars' ? 0.42 : 0.18]} />
          <directionalLight position={sun.multiplyScalar(10000)} intensity={world === 'mars' ? 2.6 : 3.4} color={world === 'mars' ? '#ffe2c4' : '#ffffff'} />
          <Suspense fallback={null}>
            <Sky world={world} />
            <Ground t={t} world={world} />
            <Rocks t={t} world={world} />
          </Suspense>
          <Walker t={t} keys={keys} onMove={onMove} look={look} />
        </Canvas>
      </Safe3D>
    </div>
  );
}
