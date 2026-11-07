import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import Senses, { SenseBar, stopSound, type Mode } from '../components/Senses';
import TrailStory from '../components/TrailStory';
import { SEE, SENSES, SOUNDS, STORIES, TRAILS, WORLDS, type Layer, type Pin, type Sense, type Shot, type Snd, type Trail, type WorldId } from '../content';
import { useJSON, useTwins, type Volcanoes } from '../data';
import { GlobeCanvas, Planet, type PointCloud } from '../three/Globe';

function Legend({ layer }: { layer: Layer }) {
  if (!layer.legend) return null;
  const { svg, low, high, colors } = layer.legend;
  return (
    <div className="legend">
      {svg ? <img src={svg} alt={`Legend: ${layer.title}`} className="legend__svg" /> : (
        <>
          <span className="legend__ramp" style={{ background: colors ?? 'linear-gradient(90deg,#1a1a40,#5a5ad6,#c8c8ff)' }} />
          <span className="legend__ends"><span>{low}</span><span>{high}</span></span>
        </>
      )}
    </div>
  );
}

function WorldPanel({ world, layer, pins, cloud, empty, swap, home, sound, soundId, sense, mode, shot }: {
  world: WorldId; layer: (Layer & { pins: Pin[] }) | null; pins: Pin[]; cloud?: PointCloud; empty?: string; home?: [number, number];
  sound?: Snd; soundId: string; sense?: Sense; mode: Mode; shot?: Shot;
  swap?: { label: string; on: boolean; toggle: () => void };
}) {
  const [focus, setFocus] = useState<number | null>(null);
  useEffect(() => setFocus(null), [layer?.tex]);
  const w = WORLDS[world];
  const focusAt = focus != null ? pins[focus]?.at : mode === 'see' && pins.length ? pins[0].at : home ?? null;
  const sensing = mode !== 'map';
  return (
    <figure className={`panel panel--${world}${sensing ? ' is-sensing' : ''}`}>
      <figcaption className="panel__head">
        <span className="panel__world">{w.name}</span>
        {layer && !sensing && <span className="panel__layer" title={layer.source}>{layer.title}</span>}
      </figcaption>
      <div className="panel__stage">
        {layer ? (
          <GlobeCanvas camZ={4.1}>
            <Planet tex={layer.tex} glow={w.glow} pins={sensing ? [] : pins} cloud={cloud} focus={focusAt}
              onPin={(i) => setFocus((f) => (f === i ? null : i))} activePin={focus} spin={0.04} compact={!!home} />
          </GlobeCanvas>
        ) : (
          <div className="panel__empty">{!sensing && <p>{empty}</p>}</div>
        )}
        <Senses id={soundId} mode={mode} snd={sound} sense={sense} shot={shot} />
      </div>
      {layer && !sensing && (layer.legend || swap) && (
        <div className="panel__foot">
          <Legend layer={layer} />
          {swap && <button className="chip" onClick={swap.toggle}>{swap.label}</button>}
        </div>
      )}
    </figure>
  );
}

// Each trail gets its own colour and icon so the six choices read as buttons at a glance.
const TRAIL_LOOK: Record<string, { color: string; icon: JSX.Element }> = {
  rust: { color: '#e8743f', icon: <svg viewBox="0 0 24 24"><path d="M12 2.5 20 7v10l-8 4.5L4 17V7z" /><path d="M12 2.5V12m0 0 8-5m-8 5-8-5m8 5v9.5" /></svg> },
  soil: { color: '#d8b07a', icon: <svg viewBox="0 0 24 24"><path d="M3 8c3-2 6 2 9 0s6-2 9 0M3 13c3-2 6 2 9 0s6-2 9 0M3 18c3-2 6 2 9 0s6-2 9 0" /></svg> },
  fire: { color: '#ff4f3a', icon: <svg viewBox="0 0 24 24"><path d="M12 21.5c-4 0-7-2.8-7-6.6 0-3.4 2.3-5.6 4.1-7.6.4 1.8 1.4 3 2.6 3.6C11.7 7 13.3 4.5 15.6 2.5c.2 3.4 3.4 5.9 3.4 10.6 0 4.9-3 8.4-7 8.4Z" /><path d="M12 21.5c-1.7 0-3-1.3-3-3 0-2 1.6-3.1 3-4.6 1.4 1.5 3 2.6 3 4.6 0 1.7-1.3 3-3 3Z" /></svg> },
  wind: { color: '#b39cff', icon: <svg viewBox="0 0 24 24"><path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8" /></svg> },
  ice: { color: '#6fb8ff', icon: <svg viewBox="0 0 24 24"><path d="M12 2.8c3.4 4.3 6.5 8.2 6.5 11.6a6.5 6.5 0 0 1-13 0c0-3.4 3.1-7.3 6.5-11.6Z" /><path d="M9 15a3 3 0 0 0 3 3" /></svg> },
  pole: { color: '#ffd27a', icon: <svg viewBox="0 0 24 24"><path d="M2 18h20M5 21h14" /><path d="M7 18a5 5 0 0 1 10 0" /><path d="M12 6v3M4.9 9.9l2.1 2.1M19.1 9.9 17 12" /></svg> },
};

export default function Trails({ onScore }: { onScore: (target: string) => void }) {
  const [id, setId] = useState(TRAILS[0].id);
  const [night, setNight] = useState(false);
  const [mode, setMode] = useState<Mode>('map');
  useEffect(() => { setMode('map'); stopSound(); }, [id]);
  const t = TRAILS.find((x) => x.id === id) as Trail;
  // In a sense mode, only show worlds that have something for that sense.
  const has = (w: WorldId) => t.id === 'pole' && w === 'mars' ? false
    : mode === 'map' || mode === 'see' ? true
    : mode === 'hear' ? !!SOUNDS[t.id]?.[w] : !!SENSES[t.id]?.[w];
  const shown = (['earth', 'mars', 'moon'] as WorldId[]).filter(has);
  const twins = useTwins();
  const volc = useJSON<Volcanoes>('data/volcanoes.json');

  const earthCloud = useMemo<PointCloud | undefined>(() => {
    if (t.earth.points === 'volcanoes' && volc) return { pts: volc.volcanoes.map(([la, lo]) => [la, lo, 0.4]), color: '#ff5a3c', size: 0.009 };
    if (t.earth.points === 'iron' && twins) return { pts: twins.earth_iron.filter((x) => x[2] > 0).map(([la, lo, s]) => [la, lo, s]), color: '#ff8a3d', size: 0.0085 };
    return undefined;
  }, [t, volc, twins]);

  const moonPins = useMemo(() => {
    if (t.id !== 'pole' || !twins) return t.moon?.pins ?? [];
    return twins.targets.filter((x) => x.body === 'moon').map<Pin>((x) => ({ name: x.name, at: [x.lat, x.lon], tone: 'target' }));
  }, [t, twins]);

  const earthLayer = t.id === 'soil' && night
    ? { ...t.earth, tex: 'tex/earth_lst_night.webp', title: 'Land surface temperature, July 2024, night' }
    : t.earth;

  return (
    <section className="trails" id="trails">
      <header className="chapter-head">
        <span className="chapter-num">02</span>
        <h2>Twin Trails</h2>
        <p>Six big questions, asked of Earth, Mars and the Moon. Look at the maps, then see, hear, smell and feel each world.</p>
      </header>

      <nav className="trailbar" role="tablist" aria-label="Pick a trail">
        {TRAILS.map((x) => {
          const look = TRAIL_LOOK[x.id];
          return (
            <button key={x.id} role="tab" aria-selected={x.id === id} className={`trailbtn${x.id === id ? ' is-on' : ''}`}
              style={{ ['--c' as string]: look.color }} onClick={() => setId(x.id)}>
              <span className="trailbtn__icon">{look.icon}</span>
              <span className="trailbtn__txt">{x.title}</span>
            </button>
          );
        })}
      </nav>

      {/* Only the words animate between trails; the globes stay mounted so no new 3D contexts are created. */}
      <div>
          <div className="trail__intro">
            <AnimatePresence mode="wait">
              <motion.h3 key={t.id} className="trail__q" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>{t.question}</motion.h3>
            </AnimatePresence>
            <SenseBar mode={mode} setMode={setMode} />
          </div>

          {mode === 'see' && STORIES[t.id] ? <TrailStory key={t.id} story={STORIES[t.id]} /> : (
          <div className="panels" style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}>
            {shown.includes('earth') && (
            <WorldPanel world="earth" layer={earthLayer} pins={t.earth.pins} cloud={earthCloud} sound={SOUNDS[t.id]?.earth} soundId={t.id + '-earth'} sense={SENSES[t.id]?.earth} mode={mode} shot={SEE[t.id]?.earth}
              swap={t.id === 'soil' ? { label: night ? 'Show day' : 'Show night', on: night, toggle: () => setNight((v) => !v) } : undefined} />
            )}
            {shown.includes('mars') && (
            <WorldPanel world="mars" layer={t.mars} pins={t.mars?.pins ?? []} empty={t.emptyMars} sound={SOUNDS[t.id]?.mars} soundId={t.id + '-mars'} sense={SENSES[t.id]?.mars} mode={mode} shot={SEE[t.id]?.mars} />
            )}
            {shown.includes('moon') && (
            <WorldPanel world="moon" layer={t.moon} pins={moonPins} empty={t.emptyMoon} home={t.id === 'pole' ? [-84, 0] : undefined} sound={SOUNDS[t.id]?.moon} soundId={t.id + '-moon'} sense={SENSES[t.id]?.moon} mode={mode} shot={SEE[t.id]?.moon} />
            )}
          </div>
          )}

          {t.id === 'pole' && mode === 'map' && <p className="trail__note">Mars isn’t part of this trail: the lunar south pole has no Martian twin here.</p>}
          <div className="trail__bottom">
            <div className="evidence">
              {t.scoreTarget && <button className="pill pill--small" onClick={() => onScore(t.scoreTarget!)}>Score these twins →</button>}
            </div>
          </div>
      </div>
    </section>
  );
}
