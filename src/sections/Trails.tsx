import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { TRAILS, WORLDS, type Layer, type Pin, type Trail, type WorldId } from '../content';
import { useJSON, usePhotos, useTwins, type Volcanoes } from '../data';
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

function WorldPanel({ world, layer, pins, cloud, empty, swap, home }: {
  world: WorldId; layer: (Layer & { pins: Pin[] }) | null; pins: Pin[]; cloud?: PointCloud; empty?: string; home?: [number, number];
  swap?: { label: string; on: boolean; toggle: () => void };
}) {
  const [focus, setFocus] = useState<number | null>(null);
  const w = WORLDS[world];
  const focusAt = focus != null ? pins[focus]?.at : home ?? null;
  return (
    <figure className={`panel panel--${world}`}>
      <figcaption className="panel__head">
        <span className="panel__world">{w.name}</span>
        {layer && <span className="panel__layer">{layer.title}</span>}
      </figcaption>
      {layer ? (
        <>
          <GlobeCanvas camZ={4.1}>
            <Planet tex={layer.tex} glow={w.glow} pins={pins} cloud={cloud} focus={focusAt}
              onPin={(i) => setFocus((f) => (f === i ? null : i))} activePin={focus} spin={0.04} compact={!!home} />
          </GlobeCanvas>
          <div className="panel__foot">
            <Legend layer={layer} />
            {swap && <button className="chip" onClick={swap.toggle}>{swap.label}</button>}
            <div className="panel__pins">
              {pins.map((p, i) => (
                <button key={p.name} className={`chip chip--${p.tone ?? 'twin'}${focus === i ? ' is-on' : ''}`} onClick={() => setFocus((f) => (f === i ? null : i))}>
                  {p.name}{p.tone === 'new' && <sup>new</sup>}
                </button>
              ))}
            </div>
            <p className="panel__src">{layer.source}</p>
          </div>
        </>
      ) : (
        <div className="panel__empty"><p>{empty}</p></div>
      )}
    </figure>
  );
}

function PhotoStrip({ keys }: { keys: string[] }) {
  const photos = usePhotos();
  if (!photos) return null;
  return (
    <div className="photostrip">
      {keys.filter((k) => photos[k]).map((k) => (
        <a key={k} className="photo" href={photos[k].url} target="_blank" rel="noreferrer">
          <img src={`photos/${k}.jpg`} alt={photos[k].title} loading="lazy" />
          <span className="photo__cap"><b>{photos[k].title}</b><em>{photos[k].center ?? 'NASA'} · {photos[k].date?.slice(0, 4)}</em></span>
        </a>
      ))}
    </div>
  );
}

export default function Trails({ onScore }: { onScore: (target: string) => void }) {
  const [id, setId] = useState(TRAILS[0].id);
  const [night, setNight] = useState(false);
  const t = TRAILS.find((x) => x.id === id) as Trail;
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
    ? { ...t.earth, tex: 'tex/earth_lst_night.jpg', title: 'Land surface temperature, July 2024, night' }
    : t.earth;

  return (
    <section className="trails" id="trails">
      <header className="chapter-head">
        <span className="chapter-num">02</span>
        <h2>Twin Trails</h2>
        <p>Six ideas, three worlds, the same question asked of each. Every map is real orbital data. Drag a globe to turn it, tap a name to fly there.</p>
      </header>

      <nav className="tabs" role="tablist">
        {TRAILS.map((x, i) => (
          <button key={x.id} role="tab" aria-selected={x.id === id} className={`tab${x.id === id ? ' is-on' : ''}`} onClick={() => setId(x.id)}>
            <span className="tab__n">{String(i + 1).padStart(2, '0')}</span>
            <span className="tab__t">{x.title}</span>
            <span className="tab__k">{x.kicker}</span>
          </button>
        ))}
      </nav>

      <AnimatePresence mode="wait">
        <motion.div key={t.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35 }}>
          <div className="trail__intro">
            <h3 className="trail__q">{t.question}</h3>
            <p className="trail__sum">{t.summary}</p>
          </div>

          <div className="panels">
            <WorldPanel key={t.id + '-earth'} world="earth" layer={earthLayer} pins={t.earth.pins} cloud={earthCloud}
              swap={t.id === 'soil' ? { label: night ? 'Show day' : 'Show night', on: night, toggle: () => setNight((v) => !v) } : undefined} />
            <WorldPanel world="mars" layer={t.mars} pins={t.mars?.pins ?? []} empty={t.emptyMars} />
            <WorldPanel world="moon" layer={t.moon} pins={moonPins} empty={t.emptyMoon} home={t.id === 'pole' ? [-84, 0] : undefined} />
          </div>
          {t.earth.points === 'iron' && <p className="note">Orange dots: 12 km windows where NASA’s EMIT spectrometer identified hematite or goethite; bigger dots mean a larger share of the minerals it could identify there.</p>}
          {t.earth.points === 'volcanoes' && <p className="note">Red dots: all {volc?.volcanoes.length.toLocaleString() ?? '…'} volcanoes active in the last ~12,000 years (Smithsonian Global Volcanism Program).</p>}
          {t.id === 'soil' && <p className="note">On Earth we use the day–night temperature swing as a stand-in for thermal inertia: sand and dust swing hard, rock barely moves. Flip day and night to see the deserts change most.</p>}

          <PhotoStrip keys={t.photos} />

          <div className="trail__bottom">
            <div className="breaks">
              <h4>Where the analogy breaks</h4>
              <p>{t.breaks}</p>
            </div>
            <div className="evidence">
              <h4>Evidence</h4>
              <ul>{t.evidence.map((e) => <li key={e.url}><a href={e.url} target="_blank" rel="noreferrer">{e.label} ↗</a></li>)}</ul>
              {t.scoreTarget && <button className="pill pill--small" onClick={() => onScore(t.scoreTarget!)}>Score these twins →</button>}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
