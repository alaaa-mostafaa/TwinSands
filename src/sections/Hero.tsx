import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { AnimatePresence, motion } from 'framer-motion';
import { Suspense, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { WORLDS, type WorldId } from '../content';
import { Atmosphere, Surface } from '../three/Globe';

const ORDER: WorldId[] = ['earth', 'mars', 'moon'];

type Slot = 'center' | 'left' | 'right';

function HeroPlanet({ id, slot }: { id: WorldId; slot: Slot }) {
  const g = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const { viewport } = useThree();
  const first = useRef(true);
  useFrame((_, dt) => {
    if (!g.current || !spin.current) return;
    const w = viewport.width, h = viewport.height;
    const narrow = w < h * 0.9;
    const R = narrow ? w * 0.62 : Math.min(w * 0.36, h * 0.62);
    const r = narrow ? w * 0.2 : h * 0.26;
    const target =
      slot === 'center' ? { x: 0, y: narrow ? -h / 2 + R * 0.2 : -h / 2 - R * 0.12, s: R }
      : slot === 'left' ? { x: -w / 2 - r * (narrow ? 0.25 : 0.05), y: narrow ? h * 0.2 : h * 0.06, s: r }
      : { x: w / 2 + r * (narrow ? 0.25 : 0.05), y: narrow ? h * 0.2 : h * 0.06, s: r };
    const k = first.current ? 1 : 1 - Math.exp(-dt * 3.2);
    first.current = false;
    g.current.position.x += (target.x - g.current.position.x) * k;
    g.current.position.y += (target.y - g.current.position.y) * k;
    const s = g.current.scale.x + (target.s - g.current.scale.x) * k;
    g.current.scale.setScalar(s);
    spin.current.rotation.y += dt * (slot === 'center' ? 0.035 : 0.06);
  });
  const w = WORLDS[id];
  return (
    <group ref={g}>
      <group rotation={[0.35, 0, 0.12]}>
        <group ref={spin}>
          <Surface tex={w.tex} shade={0.22} />
        </group>
      </group>
      <Atmosphere color={w.glow} scale={slot === 'center' ? 1.07 : 1.1} strength={slot === 'center' ? 1.1 : 0.8} power={3} />
    </group>
  );
}

export default function Hero({ onExplore }: { onExplore: (w: WorldId) => void }) {
  const [i, setI] = useState(1);
  const cur = ORDER[i];
  const prev = ORDER[(i + 2) % 3];
  const next = ORDER[(i + 1) % 3];
  const slotOf = (id: WorldId): Slot => (id === cur ? 'center' : id === prev ? 'left' : 'right');
  const go = (d: number) => setI((v) => (v + d + 3) % 3);
  const w = WORLDS[cur];

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (window.scrollY > window.innerHeight * 0.6) return;
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  return (
    <section className="hero" id="top">
      <div className="hero__canvas">
        <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 10], fov: 30 }} gl={{ antialias: true }}>
          <color attach="background" args={['#030305']} />
          <ambientLight intensity={0.18} />
          <directionalLight position={[-1.5, 6, 5]} intensity={2.2} />
          <Stars radius={60} depth={30} count={2500} factor={2.2} saturation={0} fade speed={0.4} />
          <Suspense fallback={null}>
            {ORDER.map((id) => <HeroPlanet key={id} id={id} slot={slotOf(id)} />)}
          </Suspense>
        </Canvas>
      </div>

      <button className="hero__side hero__side--left" onClick={() => go(-1)} aria-label={`Show ${WORLDS[prev].name}`}>
        {WORLDS[prev].name}
      </button>
      <button className="hero__side hero__side--right" onClick={() => go(1)} aria-label={`Show ${WORLDS[next].name}`}>
        {WORLDS[next].name}
      </button>

      <div className="hero__center">
        <div className="hero__eyebrow">
          <span>{w.index}</span><i /><span>World</span><i /><span>03</span>
        </div>
        <div className="hero__titlerow">
          <button className="arrow" onClick={() => go(-1)} aria-label="Previous world">◀</button>
          <AnimatePresence mode="wait">
            <motion.h1 key={cur} className="hero__title" data-text={w.name}
              initial={{ opacity: 0, y: 24, letterSpacing: '0.3em' }} animate={{ opacity: 1, y: 0, letterSpacing: '0.04em' }}
              exit={{ opacity: 0, y: -18 }} transition={{ duration: 0.55, ease: [0.2, 0.7, 0.2, 1] }}>
              {w.name}
            </motion.h1>
          </AnimatePresence>
          <button className="arrow" onClick={() => go(1)} aria-label="Next world">▶</button>
        </div>
        <AnimatePresence mode="wait">
          <motion.p key={cur} className="hero__tag" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
            {w.tagline}
          </motion.p>
        </AnimatePresence>
        <button className="pill" onClick={() => onExplore(cur)}>{cur === 'earth' ? 'Meet Mars' : `Explore ${w.name}`}</button>
      </div>

      <AnimatePresence mode="wait">
        <motion.dl key={cur} className="hero__facts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.45, delay: 0.1 }}>
          {w.facts.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              {f.value.map((v) => <dd key={v}>{v}</dd>)}
            </div>
          ))}
        </motion.dl>
      </AnimatePresence>
    </section>
  );
}
