import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls, useTexture } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import type { LatLon, Pin } from '../content';
import Safe3D from '../components/Safe3D';

const D2R = Math.PI / 180;

/** Position on a unit sphere matching three's SphereGeometry UV layout (u=0 at lon −180). */
export function latLonToVec3([lat, lon]: LatLon, r = 1): THREE.Vector3 {
  const phi = (lon + 180) * D2R;
  const theta = (90 - lat) * D2R;
  return new THREE.Vector3(-Math.cos(phi) * Math.sin(theta) * r, Math.cos(theta) * r, Math.sin(phi) * Math.sin(theta) * r);
}

const atmoVert = /* glsl */ `
varying vec3 vN; varying vec3 vP;
void main(){ vN = normalize(normalMatrix * normal); vec4 p = modelViewMatrix * vec4(position,1.0); vP = p.xyz; gl_Position = projectionMatrix * p; }`;
// Outer halo (drawn on the back faces of a larger sphere): brightest at the planet's limb, fading to 0 outward.
const haloFrag = /* glsl */ `
uniform vec3 uColor; uniform float uStrength; uniform float uLimb;
varying vec3 vN; varying vec3 vP;
void main(){ float d = -dot(normalize(vN), normalize(-vP)); float f = pow(clamp(d / uLimb, 0.0, 1.0), 2.2); gl_FragColor = vec4(uColor, f * uStrength); }`;
// Inner rim (front faces): thin fresnel haze on the disc edge.
const rimFrag = /* glsl */ `
uniform vec3 uColor; uniform float uPower; uniform float uStrength;
varying vec3 vN; varying vec3 vP;
void main(){ float f = pow(1.0 - max(dot(normalize(vN), normalize(-vP)), 0.0), uPower); gl_FragColor = vec4(uColor, f * uStrength); }`;

export function Atmosphere({ color, scale = 1.1, strength = 0.6, power = 3.5 }: { color: string; scale?: number; strength?: number; power?: number }) {
  const halo = useMemo(() => ({ uColor: { value: new THREE.Color(color) }, uStrength: { value: strength }, uLimb: { value: Math.sqrt(1 - 1 / (scale * scale)) } }), [color, strength, scale]);
  const rim = useMemo(() => ({ uColor: { value: new THREE.Color(color) }, uPower: { value: power }, uStrength: { value: strength * 0.75 } }), [color, power, strength]);
  return (
    <>
      <mesh scale={scale}>
        <sphereGeometry args={[1, 64, 64]} />
        <shaderMaterial vertexShader={atmoVert} fragmentShader={haloFrag} uniforms={halo} transparent depthWrite={false}
          blending={THREE.AdditiveBlending} side={THREE.BackSide} />
      </mesh>
      <mesh scale={1.002}>
        <sphereGeometry args={[1, 64, 64]} />
        <shaderMaterial vertexShader={atmoVert} fragmentShader={rimFrag} uniforms={rim} transparent depthWrite={false}
          blending={THREE.AdditiveBlending} side={THREE.FrontSide} />
      </mesh>
    </>
  );
}

export function Surface({ tex, shade = 0.55, hiTex, segments = 96 }: { tex: string; shade?: number; hiTex?: string; segments?: number }) {
  const map = useTexture(tex);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useEffect(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    map.needsUpdate = true;
  }, [map]);
  // Progressive: show the 2K map at once, swap in the 4K one when it has downloaded.
  useEffect(() => {
    if (!hiTex) return;
    let live = true;
    let hi: THREE.Texture | null = null;
    new THREE.TextureLoader().load(hiTex, (t) => {
      if (!live || !mat.current) return t.dispose();
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      hi = t;
      mat.current.map = t;
      mat.current.emissiveMap = t;
      mat.current.needsUpdate = true;
    });
    return () => {
      live = false;
      if (mat.current) { mat.current.map = map; mat.current.emissiveMap = map; mat.current.needsUpdate = true; }
      hi?.dispose();
    };
  }, [hiTex, map]);
  return (
    <mesh>
      <sphereGeometry args={[1, segments, segments]} />
      {/* emissive keeps data colours readable on the night side; the light adds the 3D terminator */}
      <meshStandardMaterial ref={mat} map={map} emissiveMap={map} emissive="#ffffff" emissiveIntensity={shade} roughness={1} metalness={0} />
    </mesh>
  );
}

function PinMarker({ pin, onClick, active, compact }: { pin: Pin; onClick?: () => void; active?: boolean; compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const pos = useMemo(() => latLonToVec3(pin.at, 1.005), [pin.at]);
  const world = useMemo(() => new THREE.Vector3(), []);
  const { camera } = useThree();
  const anchor = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!anchor.current || !ref.current) return;
    anchor.current.getWorldPosition(world);
    const facing = world.clone().normalize().dot(camera.position.clone().normalize());
    const vis = THREE.MathUtils.clamp((facing - 0.08) * 5, 0, 1);
    ref.current.style.opacity = String(vis);
    ref.current.style.pointerEvents = vis > 0.4 ? 'auto' : 'none';
  });
  return (
    <group ref={anchor} position={pos}>
      <Html center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={ref} className={`pin pin--${pin.tone ?? 'twin'}${active ? ' is-active' : ''}`} onClick={onClick}>
          <span className="pin__dot" />
          {(!compact || active) && <span className="pin__label">{pin.name}{pin.note && <em>{pin.note}</em>}</span>}
        </div>
      </Html>
    </group>
  );
}

export type PointCloud = { pts: [number, number, number][]; color: string; size?: number };

function Points({ cloud }: { cloud: PointCloud }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    cloud.pts.forEach(([lat, lon, w], i) => {
      o.position.copy(latLonToVec3([lat, lon], 1.004));
      o.lookAt(0, 0, 0);
      const s = (cloud.size ?? 0.012) * (0.55 + 0.9 * Math.min(1, Math.max(0, w)));
      o.scale.setScalar(s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [cloud]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, cloud.pts.length]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color={cloud.color} toneMapped={false} transparent opacity={0.9} />
    </instancedMesh>
  );
}

function shortest(from: number, to: number) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return from + d;
}

/** Spinning planet that can turn to face a lat/lon. */
export function Planet({ tex, glow, pins = [], cloud, focus, spin = 0.05, tilt = 0.18, onPin, activePin, children, shade, compact }: {
  tex: string; glow: string; pins?: Pin[]; cloud?: PointCloud; focus?: LatLon | null; spin?: number; tilt?: number;
  onPin?: (i: number) => void; activePin?: number | null; children?: ReactNode; shade?: number; compact?: boolean;
}) {
  const outer = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!outer.current || !inner.current) return;
    const k = 1 - Math.exp(-dt * 2.6);
    if (focus) {
      const ty = Math.PI / 2 - (focus[1] + 180) * D2R;
      inner.current.rotation.y += (shortest(inner.current.rotation.y, ty) - inner.current.rotation.y) * k;
      outer.current.rotation.x += (focus[0] * D2R - outer.current.rotation.x) * k;
    } else {
      inner.current.rotation.y += dt * spin;
      outer.current.rotation.x += (tilt - outer.current.rotation.x) * k;
    }
  });
  return (
    <group ref={outer}>
      <group ref={inner}>
        <Surface tex={tex} shade={shade} />
        {cloud && <Points cloud={cloud} />}
        {pins.map((p, i) => <PinMarker key={p.name + i} pin={p} compact={compact} active={activePin === i} onClick={onPin ? () => onPin(i) : undefined} />)}
        {children}
      </group>
      <Atmosphere color={glow} />
    </group>
  );
}

/** Mounts a WebGL canvas only while on screen, so a page of globes stays light. */
export function GlobeCanvas({ children, camZ = 3.3, controls = true, className = '', fov = 35 }: {
  children: ReactNode; camZ?: number; controls?: boolean; className?: string; fov?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  // (R3F frees each canvas's GPU context itself when it unmounts.)
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={box} className={`globe ${className}`}>
      {on && (
        <Safe3D fallback={<div className="no3d">3D view unavailable in this browser</div>}>
        <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, camZ], fov }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}>
          <ambientLight intensity={0.35} />
          <directionalLight position={[-3, 2, 4]} intensity={1.6} />
          <Suspense fallback={null}>{children}</Suspense>
          {controls && <OrbitControls enablePan={false} enableZoom={false} rotateSpeed={0.5} />}
        </Canvas>
        </Safe3D>
      )}
    </div>
  );
}
