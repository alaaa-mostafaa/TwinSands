import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { MARS_HOODS, MOON_HOODS, WORLDS, type Hood, type Pin } from '../content';
import { usePhotos, useTwins } from '../data';
import { GlobeCanvas, Planet } from '../three/Globe';
import { earthLabel } from './TwinScore';

export default function Neighborhoods({ world, setWorld, onScore }: { world: 'mars' | 'moon'; setWorld: (w: 'mars' | 'moon') => void; onScore: (t: string) => void }) {
  const hoods = world === 'mars' ? MARS_HOODS : MOON_HOODS;
  const [i, setI] = useState(0);
  const [relief, setRelief] = useState(false);
  useEffect(() => setI(0), [world]);
  const h: Hood = hoods[Math.min(i, hoods.length - 1)];
  const photos = usePhotos();
  const twins = useTwins();

  // "Found by our Twin Score": take the best-ranked Earth window for that target.
  const found = useMemo(() => {
    if (!h.dataTarget || !twins) return null;
    const top = twins.rankings[h.dataTarget]?.top[0];
    const s = twins.earth.find((e) => e.id === top?.id);
    return s && top ? { site: s, score: top.score, n: top.n_axes } : null;
  }, [h, twins]);
  const twinAt = h.twinAt ?? (found ? ([found.site.lat, found.site.lon] as [number, number]) : null);

  const pins: Pin[] = hoods.map((x) => ({ name: x.nick, at: x.at, tone: 'target' }));
  const tex = world === 'mars' ? (relief ? 'tex/mars_mola.jpg' : 'tex/mars_base.jpg') : (relief ? 'tex/moon_lola.jpg' : 'tex/moon_base.jpg');

  return (
    <section className="hoods" id="hoods">
      <header className="chapter-head">
        <span className="chapter-num">04</span>
        <h2>Neighborhoods</h2>
        <p>Nicknames make a planet easy to learn. The official name always comes along, so astronauts learn both.</p>
      </header>
      <div className="hoods__switch">
        {(['mars', 'moon'] as const).map((w) => (
          <button key={w} className={`seg${world === w ? ' is-on' : ''}`} onClick={() => setWorld(w)}>{WORLDS[w].name}</button>
        ))}
        <button className={`seg seg--ghost${relief ? ' is-on' : ''}`} onClick={() => setRelief((v) => !v)}>{relief ? 'Elevation map' : 'Photo map'}</button>
      </div>

      <div className="hoods__grid">
        <div className="hoods__globe">
          <GlobeCanvas camZ={3.9}>
            <Planet tex={tex} glow={WORLDS[world].glow} pins={pins} focus={h.at} activePin={i} onPin={setI} />
          </GlobeCanvas>
        </div>

        <AnimatePresence mode="wait">
          <motion.article key={world + i} className="hood" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.3 }}>
            <p className="kicker">{String(i + 1).padStart(2, '0')} / {hoods.length}</p>
            <h3 className="hood__nick">{h.nick}</h3>
            <p className="hood__official">{h.official} · {Math.abs(h.at[0]).toFixed(1)}°{h.at[0] >= 0 ? 'N' : 'S'} {Math.abs(h.at[1]).toFixed(1)}°{h.at[1] >= 0 ? 'E' : 'W'}</p>
            <p className="hood__why">{h.why}</p>
            {h.photo && photos?.[h.photo] && (
              <a className="hood__photo" href={photos[h.photo].url} target="_blank" rel="noreferrer">
                <img src={`photos/${h.photo}.jpg`} alt={photos[h.photo].title} />
                <span>{photos[h.photo].title}</span>
              </a>
            )}
            <div className={`hood__twin${h.noTwin ? ' hood__twin--none' : ''}`}>
              <div className="hood__twintext">
                <span className="kicker">Earth twin</span>
                <b>{found && h.twin.startsWith('Found') ? earthLabel(found.site) : h.twin}</b>
                {found && <span className="hood__found">{h.twin.startsWith('Found')
                  ? <>Found by our Twin Score: {found.score.toFixed(0)} on {found.n} of 7 measured axes</>
                  : <>Twin Score’s own top pick: {earthLabel(found.site)} ({found.score.toFixed(0)})</>}{' '}
                  <button className="link" onClick={() => onScore(h.dataTarget!)}>see why →</button></span>}
                {h.twinAt && <span className="hood__approx">Location approximate</span>}
              </div>
              {twinAt && !h.noTwin && (
                <div className="hood__earth">
                  <GlobeCanvas camZ={4.2} controls={false}>
                    <Planet tex="tex/earth_base.jpg" glow={WORLDS.earth.glow} focus={twinAt} pins={[{ name: '', at: twinAt, tone: 'twin' }]} />
                  </GlobeCanvas>
                </div>
              )}
            </div>
            <div className="hood__nav">
              <button className="arrow" onClick={() => setI((v) => (v - 1 + hoods.length) % hoods.length)} aria-label="Previous">◀</button>
              <div className="hood__dots">{hoods.map((x, k) => <button key={x.nick} className={k === i ? 'is-on' : ''} onClick={() => setI(k)} aria-label={x.nick} />)}</div>
              <button className="arrow" onClick={() => setI((v) => (v + 1) % hoods.length)} aria-label="Next">▶</button>
            </div>
          </motion.article>
        </AnimatePresence>
      </div>
    </section>
  );
}
