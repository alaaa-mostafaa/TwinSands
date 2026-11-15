import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AnimatePresence, motion } from 'framer-motion';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
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
      <Atmosphere color={w.glow} scale={slot === 'center' ? 1.035 : 1.05} strength={slot === 'center' ? 0.35 : 0.28} power={4} />
    </group>
  );
}

/* Poster sky behind the planets, like an old classroom astronomy poster: navy paper, peach sparkle stars,
   dotted star dust, a little constellation, falling stars and thin orbit lines. Drawn once from a fixed seed. */
function rand(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const SPARK = 'M0 -1 C0.08 -0.25 0.25 -0.08 1 0 C0.25 0.08 0.08 0.25 0 1 C-0.08 0.25 -0.25 0.08 -1 0 C-0.25 -0.08 -0.08 -0.25 0 -1Z';
const CONSTELLATIONS: number[][][] = [
  [[1270, 120], [1318, 96], [1366, 112], [1402, 150], [1452, 140], [1470, 92]],
  [[300, 172], [350, 140], [398, 168], [446, 132], [500, 158]],
  [[1340, 760], [1386, 724], [1440, 738], [1476, 786], [1424, 812], [1386, 724]],
];
function PosterSky() {
  const art = useMemo(() => {
    const r = rand(7);
    const dots = Array.from({ length: 320 }, () => ({ x: r() * 1600, y: r() * 1000, s: 0.5 + r() ** 3 * 2.2, o: 0.25 + r() * 0.7 }));
    const dust: { x: number; y: number; s: number; o: number }[] = [];
    for (let c = 0; c < 9; c++) {
      const cx = r() * 1600, cy = r() * 760, n = 14 + Math.floor(r() * 18);
      for (let i = 0; i < n; i++) dust.push({ x: cx + (r() - 0.5) * 120, y: cy + (r() - 0.5) * 70, s: 0.6 + r() * 1.6, o: 0.3 + r() * 0.5 });
    }
    // keep stars off the logo, the menu and the title
    const clear = (x: number, y: number) => !(y < 110 && (x < 320 || x > 640)) && !(x > 420 && x < 1180 && y > 150 && y < 470);
    const sparks: { x: number; y: number; s: number; peach: boolean; d: number; t: number }[] = [];
    while (sparks.length < 22) { const x = 40 + r() * 1520, y = 30 + r() * 700; if (clear(x, y)) sparks.push({ x, y, s: 3 + r() ** 2 * 7, peach: sparks.length % 3 !== 0, d: r() * 5, t: 2.8 + r() * 4 }); }
    const flares = [[260, 300, 0], [1330, 520, 2.5], [1200, 140, 4.2], [150, 720, 1.2]].map(([x, y, d]) => ({ x, y, d }));
    return { dots, dust, sparks, flares };
  }, []);
  return (
    <svg className="hero__sky" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="meteor" x1="0" x2="1"><stop offset="0" stopColor="#f3e9d6" stopOpacity="0" /><stop offset="1" stopColor="#f3e9d6" stopOpacity=".85" /></linearGradient>
        <filter id="sparkGlow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="1.6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <radialGradient id="flareCore"><stop offset="0" stopColor="#fffaf0" /><stop offset=".25" stopColor="#ffe9c8" stopOpacity=".8" /><stop offset="1" stopColor="#ffd9a8" stopOpacity="0" /></radialGradient>
        <linearGradient id="ray" x1="0" x2="1"><stop offset="0" stopColor="#fff4e0" stopOpacity="0" /><stop offset=".5" stopColor="#fff4e0" stopOpacity=".9" /><stop offset="1" stopColor="#fff4e0" stopOpacity="0" /></linearGradient>
      </defs>
      {[620, 760, 930, 1120].map((rx, i) => (
        <ellipse key={rx} cx="800" cy="1180" rx={rx} ry={rx * 0.62} fill="none" stroke="#f3e9d6" strokeOpacity={0.16 - i * 0.025} strokeWidth="1.2" strokeDasharray={i % 2 ? '2 7' : undefined} />
      ))}
      <g className="hero__drift">
        {art.dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.s} fill="#f3e9d6" opacity={d.o} />)}
      </g>
      <g className="hero__drift hero__drift--slow">
        {art.dust.map((d, i) => <circle key={'d' + i} cx={d.x} cy={d.y} r={d.s} fill="#dfe6f2" opacity={d.o} />)}
      </g>
      {/* constellations: the lines draw themselves like a pen, the stars light up as the line reaches them */}
      {CONSTELLATIONS.map((c, ci) => (
        <g key={ci} className="hero__const" style={{ ['--cd' as string]: `${ci * 2.2}s` }}>
          <polyline className="hero__constLine" points={c.map((p) => p.join(',')).join(' ')} pathLength={1} fill="none" />
          {c.map(([x, y], i) => (
            <circle key={i} className="hero__constStar" cx={x} cy={y} r="2.4" style={{ animationDelay: `calc(var(--cd) + ${(i / (c.length - 1)) * 2.4}s)` }} />
          ))}
        </g>
      ))}
      {[[180, 120, 120], [1130, 330, 90], [520, 60, 70]].map(([x, y, l], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(-24)`}>
          <rect x={-l} y="-0.9" width={l} height="1.8" fill="url(#meteor)" />
          <circle r="2.4" fill="#f3e9d6" />
        </g>
      ))}
      <g filter="url(#sparkGlow)">
        {art.sparks.map((s, i) => (
          <g key={'s' + i} transform={`translate(${s.x} ${s.y}) scale(${s.s})`}>
            <path className="hero__spark" style={{ animationDelay: `${s.d}s`, animationDuration: `${s.t}s` }} d={SPARK} fill={s.peach ? '#e9b07f' : '#f3e9d6'} />
          </g>
        ))}
      </g>
      {/* a few bright stars with long rays, like 90s space art */}
      {art.flares.map((f, i) => (
        <g key={'f' + i} transform={`translate(${f.x} ${f.y})`}>
          <g className="hero__flare" style={{ animationDelay: `${f.d}s` }}>
            <circle r="5" fill="url(#flareCore)" />
            <rect x="-24" y="-0.45" width="48" height="0.9" fill="url(#ray)" />
            <rect x="-0.45" y="-16" width="0.9" height="32" fill="url(#ray)" />
          </g>
        </g>
      ))}
    </svg>
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
    <section className={`hero hero--poster hero--${cur}`} id="top">
      <div className="hero__glow" aria-hidden />
      <PosterSky />
      <div className="hero__meteors" aria-hidden>{[0, 1, 2, 3].map((i) => <i key={i} />)}</div>
      <div className="hero__shade" aria-hidden />
      <div className="hero__paper" aria-hidden />
      <div className="hero__canvas">
        <Safe3D>
        <Canvas key={recover.key} onCreated={recover.onCreated} dpr={[1, 2]} camera={{ position: [0, 0, 10], fov: 30 }} gl={{ antialias: true, alpha: true }}>
          <ambientLight intensity={0.18} />
          <directionalLight position={[-1.5, 6, 5]} intensity={2.2} />
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
