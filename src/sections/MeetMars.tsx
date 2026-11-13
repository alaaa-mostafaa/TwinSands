import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, useTexture } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Atmosphere } from '../three/Globe';
import { meetSound } from '../meetAudio';
import Safe3D, { useContextRecovery } from '../components/Safe3D';

// Earth's land: 148.9 million km² (NASA Earth fact sheet). Mars' whole surface: 144.4 million km²
// (mean radius 3,389.5 km). So Earth's continents, gathered into one ball, are about the size of Mars.
//
// Scroll timeline (p = 0..1 through the section):
//   0.00-0.34  Earth's continents as a flat map curl into one ball, closing the gaps
//   0.36-0.48  the white ball becomes Mars
//   0.52-0.74  Mars moves aside at true size next to Earth, radius rulers
//   0.76-1.00  the Moon orbits Earth (to scale); Phobos and Deimos orbit Mars (enlarged)

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const ease = (t: number) => t * t * (3 - 2 * t);

const globeVert = /* glsl */ `varying vec2 vUv; varying vec3 vN;
void main(){ vUv = uv; vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const globeFrag = /* glsl */ `uniform sampler2D uMap; uniform float uAlpha; varying vec2 vUv; varying vec3 vN;
void main(){ vec3 c = texture2D(uMap, vUv).rgb; float l = 0.35 + 0.75*max(dot(vN, normalize(vec3(-0.4,0.5,0.8))),0.0);
  gl_FragColor = vec4(c*l*1.35, uAlpha); }`;

// One mesh does steps 2-4: a sphere whose vertices start laid out flat (an equirectangular map)
// and are blended back onto the sphere by uWrap.
const ballVert = /* glsl */ `uniform float uWrap; uniform float uW; uniform float uH; uniform float uR;
varying vec2 vUv; varying vec3 vN;
void main(){
  vUv = uv;
  float lon = (uv.x - 0.5) * 6.2831853, lat = (uv.y - 0.5) * 3.1415927;
  vec3 sph = uR * vec3(cos(lat)*sin(lon), sin(lat), cos(lat)*cos(lon));
  vec3 fp = vec3((uv.x - 0.5) * uW, (uv.y - 0.5) * uH, 0.0);
  vec3 p = mix(fp, sph, uWrap);
  vN = normalize(normalMatrix * mix(vec3(0.0,0.0,1.0), normalize(sph), uWrap));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const ballFrag = /* glsl */ `uniform sampler2D uEarth; uniform sampler2D uMask; uniform sampler2D uDist; uniform sampler2D uMarsMap;
uniform float uWrap; uniform float uGrow; uniform float uMars; uniform float uAlpha;
varying vec2 vUv; varying vec3 vN;
void main(){
  float land = texture2D(uMask, vUv).r;
  float d = texture2D(uDist, vUv).r;                    // 0 at the coast, 1 far out to sea
  float grown = max(land, 1.0 - smoothstep(uGrow - 0.02, uGrow, d));
  vec3 sea = (texture2D(uEarth, vUv).rgb * vec3(0.9, 1.2, 1.9) + vec3(0.02, 0.05, 0.14)) * (1.0 - 0.55*uWrap);
  vec3 col = mix(sea, vec3(0.94, 0.95, 0.97), grown);
  col = mix(col, texture2D(uMarsMap, vUv).rgb * 1.3, uMars);
  float light = mix(1.0, 0.5 + 0.75*max(dot(normalize(vN), normalize(vec3(-0.4,0.5,0.8))), 0.0), uWrap);
  gl_FragColor = vec4(col * light, uAlpha);
}`;

/** A white line from the planet's centre to its edge, with the radius written on it. */
function Ruler({ opacity, thickness, label, note }: { opacity: number; thickness: number; label: string; note?: string }) {
  if (opacity <= 0.01) return null;
  return (
    <group renderOrder={10}>
      <mesh position={[0.5, 0, 0]} renderOrder={10}>
        <planeGeometry args={[1, thickness]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={opacity} depthTest={false} />
      </mesh>
      {[0, 1].map((x) => (
        <mesh key={x} position={[x, 0, 0]} renderOrder={10}>
          <circleGeometry args={[thickness * 2.4, 24]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={opacity} depthTest={false} />
        </mesh>
      ))}
      <Html position={[0.5, 0, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div className="ruler" style={{ opacity }}>
          <b>{label}</b>
          {note && <span>{note}</span>}
        </div>
      </Html>
    </group>
  );
}

/** A moon on a tilted orbit ring, with its name and radius. Our Moon is textured; Phobos and Deimos are lumpy rocks. */
function Moon({ r, tilt, speed, phase, size, name, km, tex, alpha }: {
  r: number; tilt: number; speed: number; phase: number; size: number; name: string; km: string; tex?: THREE.Texture; alpha: number;
}) {
  const body = useRef<THREE.Group>(null);
  const a = useRef(phase);
  const potato = useMemo(() => {
    if (tex) return null;
    const g = new THREE.IcosahedronGeometry(1, 3);
    const v = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < v.count; i++) {
      const x = v.getX(i), y = v.getY(i), z = v.getZ(i);
      const k = 1 + 0.12 * Math.sin(x * 4.1 + y * 2.3) * Math.cos(z * 3.7) + 0.06 * Math.sin(z * 9 + x * 5);
      v.setXYZ(i, x * k * 1.3, y * k, z * k * 0.85);
    }
    g.computeVertexNormals();
    return g;
  }, [tex]);
  useFrame((_, dt) => {
    a.current += dt * speed;
    if (body.current) body.current.position.set(Math.cos(a.current) * r, Math.sin(a.current) * r, 0);
  });
  return (
    <group rotation={[tilt, 0, 0.18]}>
      <mesh>
        <ringGeometry args={[r - 0.004, r + 0.004, 160]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.22 * alpha} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <group ref={body}>
        <group rotation={[-tilt, 0, 0]}>
          <mesh scale={size * alpha} geometry={potato ?? undefined}>
            {tex ? <sphereGeometry args={[1, 48, 48]} /> : null}
            <meshStandardMaterial map={tex ?? null} color={tex ? '#ffffff' : '#9a8774'} roughness={1} emissive={tex ? '#ffffff' : '#2a2018'} emissiveMap={tex ?? null} emissiveIntensity={tex ? 0.35 : 1} />
          </mesh>
          <Html position={[0, size + 0.08, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
            <div className="moonlabel" style={{ opacity: alpha }}><b>{name}</b><span>{km}</span></div>
          </Html>
        </group>
      </group>
    </group>
  );
}

function Stage({ p }: { p: number }) {
  const [earthMap, mask, dist, marsMap, moonMap] = useTexture(['tex/earth_base.webp', 'tex/earth_land_mask.png', 'tex/earth_land_dist.png', 'tex/mars_base.webp', 'tex/moon_base.webp']);
  useEffect(() => { [earthMap, marsMap, moonMap].forEach((t) => { t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; }); }, [earthMap, marsMap, moonMap]);
  const { viewport } = useThree();

  // 1-3: continents -> ball -> Mars
  const wrap = ease(seg(p, 0.06, 0.3));
  const grow = seg(p, 0.1, 0.34);
  const closeAll = seg(p, 0.33, 0.4);   // land (148.9) is a bit more than Mars (144.4): the gaps fully close
  const toMars = ease(seg(p, 0.38, 0.5));
  // 4: Mars moves right at true size next to Earth, radius rulers
  const side = ease(seg(p, 0.52, 0.64));
  const ruler = seg(p, 0.6, 0.66) * (1 - seg(p, 0.74, 0.78));
  // 5: the moons
  const moons = ease(seg(p, 0.76, 0.86));

  const eu = useMemo(() => ({ uMap: { value: earthMap }, uAlpha: { value: 0 } }), [earthMap]);
  const bu = useMemo(() => ({
    uEarth: { value: earthMap }, uMask: { value: mask }, uDist: { value: dist }, uMarsMap: { value: marsMap },
    uWrap: { value: 0 }, uGrow: { value: 0 }, uMars: { value: 0 }, uAlpha: { value: 1 },
    uW: { value: 4.8 }, uH: { value: 2.4 }, uR: { value: 1 },
  }), [earthMap, mask, dist, marsMap]);

  const es = useRef<THREE.Mesh>(null), ball = useRef<THREE.Mesh>(null);
  const spin = useRef(0);
  const fit = Math.min(1, viewport.width / 7.4);
  const EX = -1.45, MX = 1.35;
  useFrame((_, dt) => {
    eu.uAlpha.value = side;
    // The flat map fills the screen width (2:1); undo the scene fit so it stays full width.
    const W = Math.min(viewport.width * 0.92, viewport.height * 1.7) / fit / 1.05;
    bu.uW.value = W; bu.uH.value = W / 2;
    bu.uWrap.value = wrap;
    bu.uGrow.value = Math.pow(grow, 2.2) * 0.92 + closeAll * 0.3;
    bu.uMars.value = toMars;
    if (es.current) es.current.rotation.y += dt * 0.08;
    if (ball.current) {
      spin.current += dt * 0.25 * wrap;
      ball.current.rotation.y = spin.current * wrap;
    }
  });
  const marsScale = 1.05 + (0.532 - 1.05) * side;

  return (
    <group scale={fit}>
      <group position={[MX * side, 0, 0]} scale={marsScale}>
        <mesh ref={ball}>
          <sphereGeometry args={[1, 160, 80]} />
          <shaderMaterial vertexShader={ballVert} fragmentShader={ballFrag} uniforms={bu} transparent side={wrap > 0.98 ? THREE.FrontSide : THREE.DoubleSide} />
        </mesh>
        {toMars > 0.6 && <Atmosphere color="#ff9a6a" strength={0.6} />}
        <Ruler opacity={ruler} thickness={0.014 / 0.532} label="3,390 km" note="about half of Earth" />
      </group>
      {moons > 0.01 && (
        <group position={[MX, 0, 0]}>
          <Moon r={0.8} tilt={1.2} speed={0.9} phase={0.5} size={0.035} name="Phobos" km="11 km" alpha={moons} />
          <Moon r={1.12} tilt={1.2} speed={0.45} phase={3.6} size={0.026} name="Deimos" km="6 km" alpha={moons} />
        </group>
      )}
      {side > 0.01 && (
        <group position={[EX, 0, 0]} scale={side}>
          <mesh ref={es}>
            <sphereGeometry args={[1, 96, 96]} />
            <shaderMaterial vertexShader={globeVert} fragmentShader={globeFrag} uniforms={eu} transparent />
          </mesh>
          {side > 0.6 && <Atmosphere color="#6fb6ff" strength={0.6} />}
          <Ruler opacity={ruler} thickness={0.014} label="6,371 km" note="radius" />
          {moons > 0.01 && <Moon r={1.5} tilt={1.25} speed={0.3} phase={2.2} size={0.273} name="Moon" km="1,737 km" tex={moonMap} alpha={moons} />}
        </group>
      )}
    </group>
  );
}

const STEPS = [
  { at: 0.0, h: 'Take every continent on Earth', n: '148.9 million km² of land', s: '' },
  { at: 0.08, h: 'Squeeze them into one ball', n: '', s: '' },
  { at: 0.36, h: 'You get Mars', n: '144.4 million km² of ground', s: '' },
  { at: 0.54, h: 'Mars is half as wide as Earth', n: '', s: '' },
  { at: 0.76, h: 'One big Moon. Two tiny ones.', n: '', s: 'Sizes to scale, except Phobos and Deimos: drawn bigger so you can see them' },
];

export default function MeetMars() {
  const recover = useContextRecovery();
  const wrap = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    const on = () => {
      const el = wrap.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const pp = clamp(-r.top / (r.height - window.innerHeight));
      setP(pp);
      meetSound.update(pp, ease(seg(pp, 0.76, 0.86)), r.top < window.innerHeight && r.bottom > 0);
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); };
  }, []);
  const step = [...STEPS].reverse().find((s) => p >= s.at) ?? STEPS[0];

  return (
    <section className="meet" id="meet" ref={wrap}>
      <div className="meet__sticky">
        <div className="meet__bg" aria-hidden style={{ ['--meet-img' as string]: 'url(photos/meet_bg.webp)' }}>
          <div className="meet__dust" />
        </div>
        <header className="chapter-head">
          <h2>Meet Mars</h2>
        </header>
        <div className="meet__stage">
          <Safe3D>
          <Canvas key={recover.key} onCreated={recover.onCreated} dpr={[1, 2]} camera={{ position: [0, 0, 5.2], fov: 35 }} gl={{ antialias: true, alpha: true }}>
            <ambientLight intensity={0.6} />
            <directionalLight position={[-3, 2, 4]} intensity={1.6} />
            <Suspense fallback={null}><Stage p={p} /></Suspense>
          </Canvas>
          </Safe3D>
        </div>
        <div className="meet__caption" key={step.h}>
          <h3>{step.h}</h3>
          {step.n && <p>{step.n}</p>}
          {step.s && <small>{step.s}</small>}
        </div>
      </div>
    </section>
  );
}
