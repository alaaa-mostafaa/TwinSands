import { Canvas, useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Atmosphere } from '../three/Globe';

// Areas: Earth total 510.1 M km², land 148.9 M km² (NASA Earth fact sheet / CIA World Factbook);
// Mars 144.4 M km² (from mean radius 3,389.5 km).
const EARTH_TOTAL = 510.1, EARTH_LAND = 148.9, MARS_AREA = 144.4;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const ease = (t: number) => t * t * (3 - 2 * t);

const vert = /* glsl */ `varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main(){ vUv = uv; vN = normalize(normalMatrix*normal); vW = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;

const earthFrag = /* glsl */ `uniform sampler2D uMap; uniform sampler2D uMask; uniform float uDrain;
varying vec2 vUv; varying vec3 vN;
void main(){
  vec3 c = texture2D(uMap, vUv).rgb; float land = texture2D(uMask, vUv).r;
  float light = 0.35 + 0.75*max(dot(vN, normalize(vec3(-0.4,0.5,0.8))),0.0);
  float a = mix(1.0, land, uDrain);
  vec3 grid = vec3(0.10,0.12,0.16);
  gl_FragColor = vec4(mix(grid, c*light, a), mix(1.0, max(land, 0.18), uDrain));
}`;

const marsFrag = /* glsl */ `uniform sampler2D uMap; uniform float uFill; uniform float uTime;
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main(){
  vec3 c = texture2D(uMap, vUv).rgb;
  float light = 0.35 + 0.75*max(dot(vN, normalize(vec3(-0.4,0.5,0.8))),0.0);
  // "Earth land" paint sweeps from the north pole: covered when 1 - (y+1)/2 < fill
  float t = 1.0 - (vW.y*0.5+0.5);
  float edge = smoothstep(uFill, uFill-0.015, t);
  // Earth-land tint: Mars' own relief shows through, recoloured in Earth's greens and tans,
  // with a faint 10-degree graticule so it reads as "mapped ground".
  float lum = dot(c, vec3(0.3,0.59,0.11));
  vec3 earthy = mix(vec3(0.20,0.36,0.18), vec3(0.78,0.70,0.48), smoothstep(0.25,0.6,lum)) * (0.7 + lum);
  float lat = (0.5 - vUv.y) * 180.0, lon = vUv.x * 360.0;
  float grid = max(1.0 - smoothstep(0.0,0.35,abs(fract(lat/10.0+0.5)-0.5)*10.0), 1.0 - smoothstep(0.0,0.35,abs(fract(lon/10.0+0.5)-0.5)*10.0));
  earthy += grid * 0.08;
  float glow = smoothstep(0.02,0.0,abs(t-uFill)) * step(0.001,uFill) * step(uFill,0.999);
  vec3 col = mix(c, earthy, edge*0.9) * light + glow*vec3(1.0,0.85,0.5);
  gl_FragColor = vec4(col,1.0);
}`;

function Stage({ p }: { p: number }) {
  const [earthMap, mask, marsMap] = useTexture(['tex/earth_base.jpg', 'tex/earth_land_mask.png', 'tex/mars_base.jpg']);
  useEffect(() => { [earthMap, marsMap].forEach((t) => { t.colorSpace = THREE.SRGBColorSpace; }); }, [earthMap, marsMap]);
  const eu = useMemo(() => ({ uMap: { value: earthMap }, uMask: { value: mask }, uDrain: { value: 0 } }), [earthMap, mask]);
  const mu = useMemo(() => ({ uMap: { value: marsMap }, uFill: { value: 0 }, uTime: { value: 0 } }), [marsMap]);
  const e = useRef<THREE.Group>(null), m = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const drain = ease(seg(p, 0.22, 0.42));
    const fill = ease(seg(p, 0.55, 0.85)); // 1 = whole planet covered (uses 144.4 of the 148.9 M km² of land)
    eu.uDrain.value = drain;
    mu.uFill.value = fill;
    if (e.current && m.current) {
      e.current.rotation.y += dt * 0.08;
      m.current.rotation.y += dt * 0.08;
      // Earth slides out as Mars takes the stage
      const out = ease(seg(p, 0.48, 0.62));
      e.current.position.x = -1.1 - out * 0.95;
      e.current.scale.setScalar(1 - out * 0.5);
      m.current.position.x = 1.0 - out * 0.45;
      m.current.scale.setScalar(0.532 * (1 + out * 0.7));
    }
  });
  return (
    <>
      <group ref={e} position={[-1.1, 0, 0]}>
        <mesh>
          <sphereGeometry args={[1, 96, 96]} />
          <shaderMaterial vertexShader={vert} fragmentShader={earthFrag} uniforms={eu} transparent />
        </mesh>
        <Atmosphere color="#6fb6ff" />
      </group>
      <group ref={m} position={[1.0, 0, 0]} scale={0.532}>
        <mesh>
          <sphereGeometry args={[1, 96, 96]} />
          <shaderMaterial vertexShader={vert} fragmentShader={marsFrag} uniforms={mu} />
        </mesh>
        <Atmosphere color="#ff9a6a" />
      </group>
    </>
  );
}

function Counter({ value, digits = 1 }: { value: number; digits?: number }) {
  return <>{value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}</>;
}

const STEPS = [
  { at: 0.0, h: 'Mars is half as wide as Earth', p: 'Its radius is 3,390 km, Earth’s is 6,371 km. So Mars has to be small and far away, right?' },
  { at: 0.22, h: 'Now drain Earth’s oceans', p: 'Seven tenths of our planet is water. What is left, all the dry land people can stand on, is 148.9 million km².' },
  { at: 0.52, h: 'Spread that land over Mars', p: 'Mars has no oceans. Its whole surface is 144.4 million km².' },
  { at: 0.86, h: 'It almost exactly fits', p: 'Mars has about as much ground to explore as all of Earth’s continents together. Every desert, ice field and volcano on Earth is a clue to some part of it.' },
];

export default function MeetMars() {
  const wrap = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    const on = () => {
      const el = wrap.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setP(clamp(-r.top / (r.height - window.innerHeight)));
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); };
  }, []);
  const step = [...STEPS].reverse().find((s) => p >= s.at) ?? STEPS[0];
  const drain = ease(seg(p, 0.22, 0.42));
  const fill = ease(seg(p, 0.55, 0.85));
  const earthShown = EARTH_TOTAL - (EARTH_TOTAL - EARTH_LAND) * drain;

  return (
    <section className="meet" id="meet" ref={wrap}>
      <div className="meet__sticky">
        <header className="chapter-head">
          <span className="chapter-num">01</span>
          <h2>Meet Mars</h2>
        </header>
        <div className="meet__stage">
          <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 5.2], fov: 35 }} gl={{ antialias: true, alpha: true }}>
            <Suspense fallback={null}><Stage p={p} /></Suspense>
          </Canvas>
        </div>
        <div className="meet__row">
        <div className="meet__copy" key={step.h}>
          <h3>{step.h}</h3>
          <p>{step.p}</p>
        </div>
        <div className="meet__bars">
          <div className="bar bar--earth">
            <span className="bar__label">Earth {drain > 0.5 ? 'land' : 'surface'}</span>
            <span className="bar__track"><span style={{ width: `${(earthShown / EARTH_TOTAL) * 100}%` }} /></span>
            <span className="bar__num"><Counter value={earthShown} /> M km²</span>
          </div>
          <div className="bar bar--mars">
            <span className="bar__label">Mars surface{fill > 0 ? ' covered' : ''}</span>
            <span className="bar__track"><span style={{ width: `${(MARS_AREA / EARTH_TOTAL) * 100}%` }} /><b style={{ width: `${(MARS_AREA / EARTH_TOTAL) * 100 * fill}%` }} /></span>
            <span className="bar__num"><Counter value={MARS_AREA * (fill || 1)} /> M km²</span>
          </div>
        </div>
        </div>
        <div className="meet__progress"><span style={{ transform: `scaleX(${p})` }} /></div>
      </div>
    </section>
  );
}
