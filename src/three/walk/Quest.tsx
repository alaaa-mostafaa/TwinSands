import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
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
  angle: number;           // radians from your first view direction (+ = to the right)
  dist: number;            // metres from where you land
  task: string;            // the task card
  found: string;           // the fact when you reach it
  say: string;             // what the rover / astronaut says when you reach it
};

export const QUESTS: Record<string, Quest> = {
  'mars-gale': {
    kind: 'greenhouse', size: 22, angle: 0.32, dist: 380,
    task: 'Find the greenhouse dome',
    found: 'Gale Crater was once a lake, and its old mud is full of clay minerals that hold water. One day, food could grow on Mars under glass like this.',
    say: 'A greenhouse on Mars! I would water it, but all I have is dust.',
  },
  'mars-jezero': {
    kind: 'model', urls: ['models/quest/ingenuity.glb'], size: 6, lift: 4, angle: -0.3, dist: 360,
    task: 'Find Ingenuity, the Mars helicopter',
    found: 'Ingenuity made the first powered flight on another world, right here in Jezero, in April 2021. It flew 72 times before it retired.',
    say: 'Ingenuity, my little buddy! It flew 72 times over this crater.',
  },
  'mars-olympus': {
    kind: 'model', urls: ['models/quest/viking.glb'], size: 9, angle: 0.28, dist: 420,
    task: 'Find the Viking lander',
    found: 'In 1976 the two Viking landers were the first US spacecraft to work on the surface of Mars. They landed far from here, on the plains of Chryse and Utopia.',
    say: 'Viking! The grandparent of every Mars lander, me included.',
  },
  'moon-shackleton-rim': {
    kind: 'model', urls: ['models/quest/habitat1.glb', 'models/quest/habitat2.glb'], size: 16, angle: 0.3, dist: 360, lamps: true,
    task: 'Find the base camp habitat',
    found: 'NASA tested this Habitat Demonstration Unit in the Arizona desert, an Earth analog for the Moon. Artemis plans a base camp near Shackleton’s rim.',
    say: 'Home sweet habitat. Tested in Arizona, ready for the Moon.',
  },
  'moon-malapert-massif': {
    kind: 'model', urls: ['models/quest/dish.glb'], size: 34, angle: -0.3, dist: 480,
    task: 'Find the giant radio dish',
    found: 'Malapert Mountain can see Earth almost all the time, so it is a top pick for a radio station to talk home. This is NASA’s 70-metre Deep Space Network dish.',
    say: 'Calling Earth! From up here, home is almost always in view.',
  },
  'moon-highlands': {
    kind: 'model', urls: ['models/quest/apollo_lm.glb'], size: 9, angle: 0.3, dist: 380,
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
function Greenhouse({ size }: { size: number }) {
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
  return (
    <group>
      <mesh position={[0, 0.15, 0]} receiveShadow><cylinderGeometry args={[r * 1.04, r * 1.08, 0.5, 48]} /><meshStandardMaterial color="#8d8478" roughness={0.9} /></mesh>
      <mesh position={[0, 0.42, 0]}><cylinderGeometry args={[r * 0.98, r * 0.98, 0.06, 48]} /><meshStandardMaterial color="#3b2a1c" roughness={1} /></mesh>
      <lineSegments geometry={parts.frame}><lineBasicMaterial color="#e8e2d6" transparent opacity={0.75} /></lineSegments>
      <mesh><sphereGeometry args={[r * 0.995, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#cfe8ff" transparent opacity={0.16} roughness={0.05} metalness={0.4} side={THREE.DoubleSide} depthWrite={false} /></mesh>
      {parts.plants.map((p, i) => (
        <mesh key={i} position={[p.x, 0.45 + p.h / 2, p.z]} castShadow>
          {i % 3 ? <coneGeometry args={[p.w, p.h, 6]} /> : <icosahedronGeometry args={[p.w * 0.9, 1]} />}
          <meshStandardMaterial color={p.c > 0.66 ? '#3d6e2e' : p.c > 0.33 ? '#557f36' : '#6c8f3a'} emissive="#1f4a18" emissiveIntensity={0.12} roughness={0.9} flatShading />
        </mesh>
      ))}
      <pointLight position={[0, r * 0.5, 0]} color="#d8ffb8" intensity={60} distance={r * 3} decay={1.6} />
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

export function QuestTarget({ quest, start, yaw0, pos, look, height, onUpdate }: {
  quest: Quest; start: THREE.Vector3; yaw0: number; height: (x: number, z: number) => number;
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
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }, dt) => {
    const P = pos.current, L = look.current;
    const dx = at.x - P.x, dz = at.z - P.z, dist = Math.hypot(dx, dz);
    if (!found.current && dist < Math.max(28, quest.size * 1.2)) found.current = true;
    if (found.current) fade.current = Math.max(0, fade.current - dt * 0.6);
    if (quest.lift && g.current) g.current.position.y = quest.lift + Math.sin(clock.elapsedTime * 1.3) * 0.6;   // hovering
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
        {quest.kind === 'greenhouse' ? <Greenhouse size={quest.size} /> : <NasaModel urls={quest.urls!} size={quest.size} />}
      </group>
      {quest.lamps && (
        <>
          {/* base-camp floodlights on two masts: warm light so the habitat shows up in the polar shadow */}
          {[[-1, 1], [1, -1]].map(([sx, sz], i) => (
            <group key={i} position={[sx * quest.size * 0.9, 0, sz * quest.size * 0.9]}>
              <mesh position={[0, 3, 0]}><cylinderGeometry args={[0.12, 0.15, 6, 8]} /><meshStandardMaterial color="#9a9a9a" /></mesh>
              <mesh position={[0, 6.2, 0]}><sphereGeometry args={[0.45, 12, 8]} /><meshBasicMaterial color="#fff1d6" /></mesh>
              <pointLight position={[0, 6.2, 0]} color="#ffe6c0" intensity={900} distance={90} decay={1.6} />
            </group>
          ))}
        </>
      )}
      <Beam color={color} fade={fade} />
      <Ring r={quest.size * 0.7} color={color} fade={fade} />
    </group>
  );
}
