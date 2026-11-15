import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { patchMaterial } from './shading';

/* A small "find it" task in every walk: a big object waits a few hundred metres away, marked by a beam of light.
   Walk to it and you get a real fact. Models: NASA 3D Resources (public domain), github.com/nasa/NASA-3D-Resources.
   The greenhouse is drawn here in code. Objects are scaled up a little so they are easy to spot. */

export type Quest = {
  kind: 'model' | 'greenhouse';
  urls?: string[];
  size: number;            // metres across (largest side) after scaling
  lift?: number;           // metres to raise above the ground (e.g. a hovering helicopter)
  lamps?: boolean;         // floodlights, for places in permanent shadow
  act: 'fly' | 'launch' | 'grow' | 'call' | 'lights' | 'photo';   // what the button does once you find it
  actLabel: string;        // the button
  actSay: string;          // what the rover / astronaut says when you press it
  angle: number;           // radians from your first view direction (+ = to the right)
  dist: number;            // metres from where you land
  task: string;            // the task card
  found: string;           // the fact when you reach it
  say: string;             // what the rover / astronaut says when you reach it
};

export const QUESTS: Record<string, Quest> = {
  'mars-gale': {
    kind: 'greenhouse', size: 34, angle: 0.32, dist: 170, act: 'grow', actLabel: 'Water the plants', actSay: 'Look at them grow! Mars soil plus a little water and light.',
    task: 'Find the greenhouse dome',
    found: 'Gale Crater was once a lake, and its old mud is full of clay minerals that hold water. One day, food could grow on Mars under glass like this.',
    say: 'A greenhouse on Mars! I would water it, but all I have is dust.',
  },
  'mars-jezero': {
    kind: 'model', urls: ['models/quest/ingenuity.glb'], size: 10, lift: 5, angle: -0.3, dist: 140, act: 'fly', actLabel: 'Fly Ingenuity', actSay: 'Up, up and away! Flying on Mars is hard: the air is a hundred times thinner than on Earth.',
    task: 'Find Ingenuity, the Mars helicopter',
    found: 'Ingenuity made the first powered flight on another world, right here in Jezero, in April 2021. It flew 72 times before it retired.',
    say: 'Ingenuity, my little buddy! It flew 72 times over this crater.',
  },
  'mars-olympus': {
    kind: 'model', urls: ['models/quest/viking.glb'], size: 14, angle: 0.28, dist: 160, act: 'photo', actLabel: 'Take a photo', actSay: 'Say cheese! Viking sent home the very first colour photos from the surface of Mars.',
    task: 'Find the Viking lander',
    found: 'In 1976 the two Viking landers were the first US spacecraft to work on the surface of Mars. They landed far from here, on the plains of Chryse and Utopia.',
    say: 'Viking! The grandparent of every Mars lander, me included.',
  },
  'moon-shackleton-rim': {
    kind: 'model', urls: ['models/quest/habitat1.glb', 'models/quest/habitat2.glb'], size: 24, angle: 0.3, dist: 160, lamps: true, act: 'lights', actLabel: 'Switch the lights on', actSay: 'Power on! Here the Sun only skims the horizon, so a base needs its own light.',
    task: 'Find the base camp habitat',
    found: 'NASA tested this Habitat Demonstration Unit in the Arizona desert, an Earth analog for the Moon. Artemis plans a base camp near Shackleton’s rim.',
    say: 'Home sweet habitat. Tested in Arizona, ready for the Moon.',
  },
  'moon-malapert-massif': {
    kind: 'model', urls: ['models/quest/dish.glb'], size: 50, angle: -0.3, dist: 220, act: 'call', actLabel: 'Call Earth', actSay: 'Message sent! It takes about 1.3 seconds to reach Earth.',
    task: 'Find the giant radio dish',
    found: 'Malapert Mountain can see Earth almost all the time, so it is a top pick for a radio station to talk home. This is NASA’s 70-metre Deep Space Network dish.',
    say: 'Calling Earth! From up here, home is almost always in view.',
  },
  'moon-highlands': {
    kind: 'model', urls: ['models/quest/apollo_lm.glb'], size: 14, angle: 0.3, dist: 160, act: 'launch', actLabel: 'Launch it', actSay: 'Liftoff! With one sixth of Earth\u2019s gravity, a small engine is enough to leave the Moon.',
    task: 'Find the Apollo lunar module',
    found: 'Apollo 16 landed in the lunar highlands in April 1972. Its astronauts trained for the trip at Sudbury crater in Canada, an Earth twin of these old rocks.',
    say: 'Orion, Apollo 16’s lander! John Young and Charlie Duke lived here for three days.',
  },
};

export type QuestState = { dist: number; rel: number; found: boolean };

/** Make older NASA models (Phong / Lambert materials) react to the sun like everything else, and add the haze. */
function prepQuestModel(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    m.castShadow = m.receiveShadow = true;
    const mats = (Array.isArray(m.material) ? m.material : [m.material]).map((mat) => {
      let s = mat as THREE.MeshStandardMaterial;
      if (!s.isMeshStandardMaterial) {
        const old = mat as THREE.MeshPhongMaterial;
        s = new THREE.MeshStandardMaterial({ color: old.color ?? new THREE.Color('#ccc'), map: old.map ?? null, roughness: 0.6, metalness: 0.3, transparent: old.transparent, opacity: old.opacity, side: old.side });
      }
      if (!s.userData.walk) { s.userData.walk = true; patchMaterial(s, { aerial: true }); }
      return s;
    });
    m.material = Array.isArray(m.material) ? mats : mats[0];
  });
}

function NasaModel({ urls, size }: { urls: string[]; size: number }) {
  const gltfs = useGLTF(urls, 'draco/') as unknown as { scene: THREE.Object3D }[];
  const obj = useMemo(() => {
    const g = new THREE.Group();
    gltfs.forEach((x) => g.add(x.scene.clone(true)));
    prepQuestModel(g);
    // scale to the wanted size and stand it on the ground, centred
    const box = new THREE.Box3().setFromObject(g), s = new THREE.Vector3();
    box.getSize(s);
    const k = size / Math.max(s.x, s.y, s.z);
    g.scale.setScalar(k);
    const b2 = new THREE.Box3().setFromObject(g), c = new THREE.Vector3();
    b2.getCenter(c);
    g.position.set(-c.x, -b2.min.y, -c.z);
    const wrap = new THREE.Group(); wrap.add(g);
    return wrap;
  }, [gltfs, size]);
  return <primitive object={obj} />;
}

/** A glass greenhouse: geodesic frame, faint glass, glowing green plants inside, warm light. */
function Greenhouse({ size, grow }: { size: number; grow: React.MutableRefObject<number> }) {
  const r = size / 2;
  const parts = useMemo(() => {
    const frame = new THREE.WireframeGeometry(new THREE.SphereGeometry(r, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2));
    const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    const plants = Array.from({ length: 34 }, () => {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r * 0.78;
      return { x: Math.cos(a) * d, z: Math.sin(a) * d, h: 1 + rnd() * 3.2, w: 0.5 + rnd() * 0.9, c: rnd() };
    });
    return { frame, plants };
  }, [r]);
  const plantsG = useRef<THREE.Group>(null), light = useRef<THREE.PointLight>(null);
  useFrame(() => {
    if (plantsG.current) plantsG.current.scale.set(0.6 + 0.4 * grow.current, grow.current, 0.6 + 0.4 * grow.current);
    if (light.current) light.current.intensity = 40 + 160 * grow.current;
  });
  return (
    <group>
      <mesh position={[0, 0.15, 0]} receiveShadow><cylinderGeometry args={[r * 1.04, r * 1.08, 0.5, 48]} /><meshStandardMaterial color="#8d8478" roughness={0.9} /></mesh>
      <mesh position={[0, 0.42, 0]}><cylinderGeometry args={[r * 0.98, r * 0.98, 0.06, 48]} /><meshStandardMaterial color="#3b2a1c" roughness={1} /></mesh>
      <lineSegments geometry={parts.frame}><lineBasicMaterial color="#e8e2d6" transparent opacity={0.75} /></lineSegments>
      <mesh><sphereGeometry args={[r * 0.995, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#cfe8ff" transparent opacity={0.16} roughness={0.05} metalness={0.4} side={THREE.DoubleSide} depthWrite={false} /></mesh>
      <group ref={plantsG} position={[0, 0.45, 0]}>
      {parts.plants.map((p, i) => (
        <mesh key={i} position={[p.x, p.h / 2, p.z]} castShadow>
          {i % 3 ? <coneGeometry args={[p.w, p.h, 6]} /> : <icosahedronGeometry args={[p.w * 0.9, 1]} />}
          <meshStandardMaterial color={p.c > 0.66 ? '#3d6e2e' : p.c > 0.33 ? '#557f36' : '#6c8f3a'} emissive="#1f4a18" emissiveIntensity={0.12} roughness={0.9} flatShading />
        </mesh>
      ))}
      </group>
      <pointLight ref={light} position={[0, r * 0.5, 0]} color="#d8ffb8" intensity={60} distance={r * 3} decay={1.6} />
    </group>
  );
}

/** A soft vertical beam of light so you can find the object from far away. Fades out once found. */
function Beam({ color, fade }: { color: string; fade: React.MutableRefObject<number> }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uFade: { value: 1 }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uColor; uniform float uFade; uniform float uTime; varying vec2 vUv;
      void main(){ float edge = pow(sin(vUv.x * 3.14159), 2.0); float up = pow(1.0 - vUv.y, 1.6);
        float pulse = 0.8 + 0.2 * sin(uTime * 2.0 - vUv.y * 12.0);
        gl_FragColor = vec4(uColor, edge * up * pulse * 0.55 * uFade); }`,
  }), [color]);
  useFrame((_, dt) => { mat.uniforms.uTime.value += dt; mat.uniforms.uFade.value = fade.current; });
  return <mesh material={mat} position={[0, 220, 0]}><cylinderGeometry args={[3, 3, 440, 24, 1, true]} /></mesh>;
}

/** Glowing ring on the ground around the object, pulsing. */
function Ring({ r, color, fade }: { r: number; color: string; fade: React.MutableRefObject<number> }) {
  const m = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!m.current) return;
    const k = (clock.elapsedTime * 0.5) % 1;
    m.current.scale.setScalar(1 + k * 0.6);
    (m.current.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.7 * Math.max(fade.current, 0.15);
  });
  return <mesh ref={m} rotation-x={-Math.PI / 2} position={[0, 0.3, 0]}><ringGeometry args={[r, r + 0.8, 64]} /><meshBasicMaterial color={color} transparent depthWrite={false} blending={THREE.AdditiveBlending} /></mesh>;
}

export function QuestTarget({ quest, start, yaw0, pos, look, height, onUpdate, action }: {
  action: number; quest: Quest; start: THREE.Vector3; yaw0: number; height: (x: number, z: number) => number;
  pos: React.MutableRefObject<THREE.Vector3>; look: React.MutableRefObject<{ yaw: number; pitch: number }>;
  onUpdate: (s: QuestState) => void;
}) {
  // where it stands: a set distance from the landing spot, a little off your first view direction
  const at = useMemo(() => {
    const a = yaw0 - quest.angle;
    const x = start.x - Math.sin(a) * quest.dist, z = start.z - Math.cos(a) * quest.dist;
    return new THREE.Vector3(x, height(x, z), z);
  }, [quest, start, yaw0, height]);
  if (import.meta.env.DEV) (window as unknown as { __quest?: unknown }).__quest = at;   // for screenshot scripts
  const found = useRef(false), fade = useRef(1), last = useRef(0);
  const color = quest.kind === 'greenhouse' ? '#b8ffb0' : '#ffd9a0';
  const g = useRef<THREE.Group>(null), flame = useRef<THREE.Group>(null), waves = useRef<THREE.Group>(null);
  const lamps = useRef<(THREE.PointLight | null)[]>([]);
  const grow = useRef(0.3), nowT = useRef(0), actT = useRef(-1);
  useEffect(() => { if (action > 0) actT.current = nowT.current; }, [action]);
  const S = quest.size;
  useFrame(({ clock }, dt) => {
    nowT.current = clock.elapsedTime;
    const e = actT.current < 0 ? -1 : clock.elapsedTime - actT.current;   // seconds since the button was pressed
    const G = g.current;
    if (G) {
      const hover = quest.lift ? quest.lift + Math.sin(clock.elapsedTime * 1.3) * 0.6 : 0;
      let x = 0, y = hover, z = 0, ry = G.rotation.y;
      if (quest.act === 'fly' && e >= 0 && e < 10) {           // climb, fly a loop, come back down
        const k = Math.sin(Math.PI * e / 10);
        y += 30 * k; x = 18 * Math.sin(e * 0.9) * k; z = 18 * (Math.cos(e * 0.9) - 1) * k; ry += dt * 2 * k;
      }
      if (quest.act === 'launch' && e >= 0 && e < 9) y += 32 * Math.pow(Math.sin(Math.PI * e / 9), 1.4);   // lift off and settle back
      if (quest.act === 'photo' && e >= 0 && e < 1.4) y += 1.6 * Math.abs(Math.sin(e * 7)) * (1 - e / 1.4);   // a happy hop
      if (quest.act === 'call' && e >= 0) ry = Math.min(1, e / 4) * 1.4;                                     // turn toward Earth
      G.position.set(x, y, z); G.rotation.y = ry;
    }
    if (flame.current) {
      const on = quest.act === 'launch' && e >= 0 && e < 9;
      flame.current.visible = on;
      if (on) { flame.current.position.y = (G?.position.y ?? 0) - 0.4; flame.current.scale.set(1, 0.8 + Math.random() * 0.5, 1); }
    }
    if (waves.current) {
      waves.current.children.forEach((m, i) => {
        const ph = e < 0 || e > 14 ? -1 : ((e - i * 0.9) % 2.7) / 2.7;
        m.visible = ph >= 0 && e - i * 0.9 > 0;
        m.position.y = S * 0.8 + ph * S * 1.6; m.scale.setScalar(1 + ph * 5);
        ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (1 - ph) * 0.8;
      });
    }
    if (quest.act === 'grow') grow.current = e < 0 ? 0.3 : 0.3 + 0.7 * Math.min(1, e / 3.5);
    if (quest.lamps) {
      const I = e < 0 ? 900 : e < 1.6 ? (Math.random() > 0.5 ? 2400 : 0) : 2400;   // flicker, then full power
      lamps.current.forEach((l) => { if (l) l.intensity = I; });
    }
    const P = pos.current, L = look.current;
    const dx = at.x - P.x, dz = at.z - P.z, dist = Math.hypot(dx, dz);
    if (!found.current && dist < Math.max(28, quest.size * 1.2)) found.current = true;
    if (found.current) fade.current = Math.max(0, fade.current - dt * 0.6);
    const now = clock.elapsedTime;
    if (now - last.current > 0.15) {
      last.current = now;
      const fx = -Math.sin(L.yaw), fz = -Math.cos(L.yaw), rx = Math.cos(L.yaw), rz = -Math.sin(L.yaw);
      onUpdate({ dist, rel: Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz), found: found.current });
    }
  });
  return (
    <group position={at}>
      <group ref={g}>
        {quest.kind === 'greenhouse' ? <Greenhouse size={quest.size} grow={grow} /> : <NasaModel urls={quest.urls!} size={quest.size} />}
      </group>
      {quest.act === 'launch' && (
        <group ref={flame} visible={false}>
          <mesh position={[0, -3, 0]} rotation-x={Math.PI}><coneGeometry args={[1.6, 6, 16, 1, true]} /><meshBasicMaterial color="#ffb050" transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
          <mesh position={[0, -1.8, 0]} rotation-x={Math.PI}><coneGeometry args={[0.8, 3.5, 12, 1, true]} /><meshBasicMaterial color="#fff2c0" transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
          <pointLight color="#ffb060" intensity={3000} distance={80} decay={1.5} position={[0, -2, 0]} />
        </group>
      )}
      {quest.act === 'call' && (
        <group ref={waves}>
          {[0, 1, 2].map((i) => <mesh key={i} rotation-x={-Math.PI / 2} visible={false}><ringGeometry args={[S * 0.3, S * 0.3 + 1.2, 64]} /><meshBasicMaterial color="#bfe0ff" transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} /></mesh>)}
        </group>
      )}
      {quest.lamps && (
        <>
          {/* base-camp floodlights on two masts: warm light so the habitat shows up in the polar shadow */}
          {[[-1, 1], [1, -1]].map(([sx, sz], i) => (
            <group key={i} position={[sx * quest.size * 0.9, 0, sz * quest.size * 0.9]}>
              <mesh position={[0, 3, 0]}><cylinderGeometry args={[0.12, 0.15, 6, 8]} /><meshStandardMaterial color="#9a9a9a" /></mesh>
              <mesh position={[0, 6.2, 0]}><sphereGeometry args={[0.45, 12, 8]} /><meshBasicMaterial color="#fff1d6" /></mesh>
              <pointLight ref={(l) => { lamps.current[i] = l; }} position={[0, 6.2, 0]} color="#ffe6c0" intensity={900} distance={120} decay={1.6} />
            </group>
          ))}
        </>
      )}
      <Beam color={color} fade={fade} />
      <Ring r={quest.size * 0.7} color={color} fade={fade} />
    </group>
  );
}

/* Base-site check for each walk: three rough 0-3 ratings and a one-line verdict, so every place answers
   "would a base work here?". Ratings are our simple reading of the sources:
   sunlight from latitude and, at the lunar pole, LRO LOLA illumination maps; water ice from Mars Odyssey GRS
   and LRO (Diviner / LOLA) polar ice studies; air shield from height (thicker air above you = less radiation;
   Curiosity's RAD measured about 0.7 mSv a day at Gale); Earth in view from where the place faces Earth. */
export type BaseCheck = { meters: [string, number][]; verdict: string };
export const BASE: Record<string, BaseCheck> = {
  'mars-gale': { meters: [['Sunlight', 3], ['Water ice', 1], ['Air shield', 2]], verdict: 'Sunny and low, so the air blocks some radiation. But there is little ice to drink: water would have to come from the clays.' },
  'mars-jezero': { meters: [['Sunlight', 2], ['Water ice', 1], ['Air shield', 2]], verdict: 'An old lake with rich science, fair sunlight and fair shielding. Ice is scarce this close to the equator.' },
  'mars-olympus': { meters: [['Sunlight', 3], ['Water ice', 0], ['Air shield', 0]], verdict: 'Above most of the dust, so the sky is clear. But up here almost no air shields you from radiation, and there is no ice. A poor base.' },
  'moon-shackleton-rim': { meters: [['Sunlight', 3], ['Water ice', 3], ['Earth in view', 1]], verdict: 'One of the best: the rim gets sunlight most of the year, and ice sits in the dark crater next door. Earth is often below the horizon.' },
  'moon-malapert-massif': { meters: [['Sunlight', 2], ['Water ice', 2], ['Earth in view', 3]], verdict: 'Earth is almost always in view, perfect for talking home, with good sunlight and polar ice within reach.' },
  'moon-highlands': { meters: [['Sunlight', 1], ['Water ice', 0], ['Earth in view', 3]], verdict: 'Earth hangs in the sky, but two weeks of daylight follow two weeks of night, and there is no ice. Fine for a visit, hard for a base.' },
};
