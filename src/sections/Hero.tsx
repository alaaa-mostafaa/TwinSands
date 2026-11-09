import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { AnimatePresence, motion } from 'framer-motion';
import { Suspense, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { WORLDS, type WorldId } from '../content';
import { Atmosphere, Surface } from '../three/Globe';
import Safe3D, { useContextRecovery } from '../components/Safe3D';
import { heroSound } from '../heroAudio';

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
          <Surface tex={w.tex} hiTex={slot === 'center' ? w.tex.replace('.webp', '_4k.webp') : undefined} shade={0.22} segments={128} />
        </group>
      </group>
      <Atmosphere color={w.glow} scale={slot === 'center' ? 1.07 : 1.1} strength={slot === 'center' ? 1.1 : 0.8} power={3} />
    </group>
  );
}

export default function Hero() {
  const recover = useContextRecovery();
  const [i, setI] = useState(1);
  const cur = ORDER[i];
  const prev = ORDER[(i + 2) % 3];
  const next = ORDER[(i + 1) % 3];
  const slotOf = (id: WorldId): Slot => (id === cur ? 'center' : id === prev ? 'left' : 'right');
  const go = (d: number) => { heroSound.start(); heroSound.whoosh(d); setI((v) => (v + d + 3) % 3); };
  const [muted, setMuted] = useState(heroSound.isMuted());
  const [playing, setPlaying] = useState(false);

  // space sound: we try to start right away; most browsers block sound until the visitor clicks, taps or
  // presses a key, so we keep trying on every such gesture until the browser says audio is really running.
  // It fades out as you scroll down past the landing screen.
  useEffect(() => {
    const sync = () => setPlaying(heroSound.running());
    const gestures = ['pointerdown', 'mousedown', 'click', 'keydown', 'touchend'];
    const tryStart = (e?: Event) => {
      if (e && (e.target as Element | null)?.closest?.('.hero__sound')) return;
      if (heroSound.isMuted()) return;
      heroSound.start(); heroSound.onChange(sync); sync();
      setTimeout(sync, 300);
      if (heroSound.running()) gestures.forEach((g) => window.removeEventListener(g, tryStart));
    };
    gestures.forEach((g) => window.addEventListener(g, tryStart, { passive: true }));
    heroSound.setLevel(1 - window.scrollY / (window.innerHeight * 0.85));
    tryStart();
    const onScroll = () => heroSound.setLevel(1 - window.scrollY / (window.innerHeight * 0.85));
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { gestures.forEach((g) => window.removeEventListener(g, tryStart)); window.removeEventListener('scroll', onScroll); };
  }, []);
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
        <Safe3D>
        <Canvas key={recover.key} onCreated={recover.onCreated} dpr={[1, 2]} camera={{ position: [0, 0, 10], fov: 30 }} gl={{ antialias: true, alpha: true }}>
          <ambientLight intensity={0.18} />
          <directionalLight position={[-1.5, 6, 5]} intensity={2.2} />
          {/* three star layers: many faint, some tinted, a few bright */}
          <Stars radius={70} depth={40} count={6000} factor={1.6} saturation={0} fade speed={0.3} />
          <Stars radius={55} depth={25} count={1200} factor={2.6} saturation={0.6} fade speed={0.5} />
          <Stars radius={40} depth={10} count={180} factor={4.5} saturation={0.2} fade speed={0.8} />
          <Suspense fallback={null}>
            {ORDER.map((id) => <HeroPlanet key={id} id={id} slot={slotOf(id)} />)}
          </Suspense>
        </Canvas>
        </Safe3D>
      </div>

      <button className="hero__side hero__side--left" onClick={() => go(-1)} aria-label={`Show ${WORLDS[prev].name}`}>
        {WORLDS[prev].name}
      </button>
      <button className="hero__side hero__side--right" onClick={() => go(1)} aria-label={`Show ${WORLDS[next].name}`}>
        {WORLDS[next].name}
      </button>

      <div className="hero__center">
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
      </div>

      <button className={`hero__sound${muted ? '' : ' is-on'}${playing || muted ? '' : ' is-waiting'}`}
        onClick={(e) => { e.stopPropagation(); if (!muted && !playing) { heroSound.start(); heroSound.onChange(() => setPlaying(heroSound.running())); setTimeout(() => setPlaying(heroSound.running()), 300); return; } const m = !muted; setMuted(m); heroSound.setMuted(m); setTimeout(() => setPlaying(!m && heroSound.running()), 300); }}
        aria-label={muted ? 'Turn space sound on' : 'Turn space sound off'}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
          {muted ? <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            : <><path className="hero__wave" d="M16 8.5a5 5 0 0 1 0 7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /><path className="hero__wave hero__wave--2" d="M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></>}
        </svg>
        <span>{muted ? 'Sound off' : playing ? 'Sound on' : 'Click for sound'}</span>
      </button>

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
