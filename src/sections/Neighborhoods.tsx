import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { MARS_HOODS, MOON_HOODS, WORLDS, type Hood, type Pin } from '../content';
import { useAllPhotos, useTwins, type PhotoMeta } from '../data';
import { GlobeCanvas, Planet } from '../three/Globe';

/** The Mars/Moon photo and its Earth twin, side by side. */
function Pair({ there, here, thereLabel, hereLabel, stamp }: { there: string; here?: string; thereLabel: string; hereLabel: string; stamp?: string }) {
  return (
    <div className={`pair${here ? '' : ' pair--single'}`}>
      <figure className="pair__img">
        <img src={`photos/${there}.webp`} alt={thereLabel} />
        <figcaption className="pair__tag pair__tag--there">{thereLabel}</figcaption>
        {stamp && <span className="pair__stamp">{stamp}</span>}
      </figure>
      {here && (
        <figure className="pair__img">
          <img src={`photos/${here}.webp`} alt={hereLabel} />
          <figcaption className="pair__tag pair__tag--here">{hereLabel}</figcaption>
        </figure>
      )}
    </div>
  );
}

function credit(m?: PhotoMeta) {
  if (!m) return null;
  const who = m.author && m.author !== 'NASA' ? m.author : m.source === 'NASA' || !m.source ? 'NASA' : m.author;
  return <a href={m.url} target="_blank" rel="noreferrer">{m.title} · {who}{m.license && m.license !== 'Public domain' ? ` · ${m.license}` : ''}</a>;
}

export default function Neighborhoods({ world, setWorld, onScore }: { world: 'mars' | 'moon'; setWorld: (w: 'mars' | 'moon') => void; onScore: (t: string) => void }) {
  const hoods = world === 'mars' ? MARS_HOODS : MOON_HOODS;
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [world]);
  const h: Hood = hoods[Math.min(i, hoods.length - 1)];
  const photos = useAllPhotos();
  const twins = useTwins();
  const W = WORLDS[world];

  const score = useMemo(() => {
    if (!h.dataTarget || !twins) return null;
    const top = twins.rankings[h.dataTarget]?.top[0];
    return top ? top.score : null;
  }, [h, twins]);

  const pins: Pin[] = hoods.map((x) => ({ name: x.nick, at: x.at, tone: 'target' }));
  const go = (d: number) => setI((v) => (v + d + hoods.length) % hoods.length);

  return (
    <section className="hoods" id="hoods">
      <header className="chapter-head">
        <h2>Neighborhoods</h2>
        <p>Places on Mars and the Moon, each next to its real twin on Earth.</p>
      </header>

      <div className="hoods__bar">
        <div className="hoods__switch">
          {(['mars', 'moon'] as const).map((w) => (
            <button key={w} className={`seg${world === w ? ' is-on' : ''}`} onClick={() => setWorld(w)}>{WORLDS[w].name}</button>
          ))}
        </div>
        <div className="hoods__chips" role="tablist">
          {hoods.map((x, k) => (
            <button key={x.nick} role="tab" aria-selected={k === i} className={`hchip${k === i ? ' is-on' : ''}`} onClick={() => setI(k)}>
              {x.nick}
            </button>
          ))}
        </div>
      </div>

      <div className="hoods__grid">
        <AnimatePresence mode="wait">
          <motion.article key={world + i} className="postcard" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
            <Pair there={h.there} here={h.here}
              thereLabel={`${W.name} · ${h.official.split(' (')[0]}`}
              hereLabel={`Earth · ${h.twin}${h.twinPlace ? `, ${h.twinPlace}` : ''}`}
              stamp={h.noTwin ? 'No twin on Earth' : !h.here ? 'Still to find' : undefined} />
            <div className="postcard__body">
              <div className="postcard__head">
                <div>
                  <h3>{h.nick}</h3>
                  <p className="postcard__official">{h.official}</p>
                </div>
              </div>
              <p className="postcard__story">{h.story}</p>
              <div className="postcard__vs">
                <p><b className="ok">Same</b>{h.same}</p>
                <p><b className="no">Different</b>{h.diff}</p>
              </div>
              {h.dataTarget && score != null && (
                <button className="postcard__score" onClick={() => onScore(h.dataTarget!)}>
                  <span>{score.toFixed(0)}</span>Twin Score of the best Earth match. See why →
                </button>
              )}
              <p className="postcard__credits">Photos: {credit(photos?.[h.there])}{h.here && <> · {credit(photos?.[h.here])}</>}</p>
            </div>
          </motion.article>
        </AnimatePresence>

        <aside className="hoods__side">
          <GlobeCanvas camZ={4.2}>
            <Planet tex={world === 'mars' ? 'tex/mars_base.webp' : 'tex/moon_base.webp'} glow={W.glow} pins={pins} focus={h.at} activePin={i} onPin={setI} compact />
          </GlobeCanvas>
          <p className="hoods__where">{h.nick} is here · {Math.abs(h.at[0]).toFixed(0)}°{h.at[0] >= 0 ? 'N' : 'S'} {Math.abs(h.at[1]).toFixed(0)}°{h.at[1] >= 0 ? 'E' : 'W'}</p>
          <div className="hood__nav">
            <button className="arrow" onClick={() => go(-1)} aria-label="Previous place">◀</button>
            <span>{String(i + 1).padStart(2, '0')} / {hoods.length}</span>
            <button className="arrow" onClick={() => go(1)} aria-label="Next place">▶</button>
          </div>
        </aside>
      </div>
    </section>
  );
}
