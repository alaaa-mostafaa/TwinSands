import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { WORLDS, type MeterSpec, type Pane, type Story } from '../content';
import { useJSON, type PhotoMeta } from '../data';
import AnnotatedPhoto from './AnnotatedPhoto';
import WindGlobe from '../three/WindGlobe';

const STEP_MS = 7000;

/** A slim, flat meter in a column beside a photo. `level` and `tick` are 0–1 along the meter. */
function Meter({ title, value, level, tick, tickLabel }: MeterSpec) {
  return (
    <div className="meter">
      <span className="meter__title">{title}</span>
      <motion.b className="meter__value" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>{value}</motion.b>
      <div className="meter__track">
        <motion.i className="meter__fill" initial={{ height: 0 }} animate={{ height: `${level * 100}%` }} transition={{ duration: 1.1, delay: 0.2, ease: [0.2, 0.7, 0.2, 1] }} />
        {tick != null && <i className="meter__tick" style={{ bottom: `${tick * 100}%` }} />}
      </div>
      {tickLabel && <span className="meter__legend"><i />{tickLabel}</span>}
    </div>
  );
}

const DISSOLVE_MS = 2200;

/** One story photo. With `then`, the old scene shows first and dissolves into today, under a time badge. */
function PaneView({ pane, credit }: { pane: Pane; credit: (k: string) => React.ReactNode }) {
  const [now, setNow] = useState(!pane.then);
  useEffect(() => {
    if (!pane.then) return;
    const t = setTimeout(() => setNow(true), DISSOLVE_MS);
    return () => clearTimeout(t);
  }, [pane]);
  const ph = pane.photo;
  return (
    <figure className={`story__photo story__photo--${pane.world}`}>
      {pane.globe ? <WindGlobe world={pane.globe === 'mars-winds' ? 'mars' : 'earth'} /> : <AnnotatedPhoto key={now ? 'now' : 'then'} src={`photos/${ph.img}.webp`} w={ph.w} h={ph.h} marks={now ? pane.marks : []} pad={18} credit={credit(ph.img)} contain={ph.contain} />}
      {pane.then && (
        <motion.div className="story__then" initial={{ opacity: 1 }} animate={{ opacity: now ? 0 : 1 }} transition={{ duration: 1.2 }}>
          <img src={`photos/${pane.then.photo.img}.webp`} alt="" />
          <span className="story__thennote">{pane.then.note}</span>
        </motion.div>
      )}
      {pane.then && (
        <div className="story__when">
          <AnimatePresence mode="wait">
            <motion.span key={now ? 'n' : 't'} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={{ duration: 0.35 }}>
              {now ? pane.now ?? 'Today' : pane.then.when}
            </motion.span>
          </AnimatePresence>
        </div>
      )}
      <figcaption><b>{WORLDS[pane.world].name}</b>{ph.place}</figcaption>
    </figure>
  );
}

export default function TrailStory({ story }: { story: Story }) {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(false);
  const credits = useJSON<Record<string, PhotoMeta>>('data/senses.json');
  const n = story.steps.length;
  const step = story.steps[i];
  const panes: Pane[] = step.panes ?? (['earth', 'mars'] as const).map((w) => ({
    world: w, photo: w === 'earth' && step.earthPhoto ? step.earthPhoto : story[w], marks: step[w], meter: step.meters?.[w],
  }));
  const go = (d: number) => setI((v) => Math.min(n - 1, Math.max(0, v + d)));
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!auto) return;
    if (i >= n - 1) { setAuto(false); return; }
    const t = setTimeout(() => setI((v) => v + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [auto, i, n]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const r = box.current?.getBoundingClientRect();
      if (!r || r.bottom < 0 || r.top > innerHeight) return;
      if (e.key === 'ArrowRight') { setAuto(false); go(1); }
      if (e.key === 'ArrowLeft') { setAuto(false); go(-1); }
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);

  const credit = (k: string) => {
    const c = credits?.[k];
    return c ? <a href={c.url} target="_blank" rel="noreferrer">{c.author?.split(/[(,]/)[0].trim()}</a> : null;
  };

  return (
    <div className="story" ref={box}>
      <div className="story__top">
        <div className="story__dots">
          {story.steps.map((s, k) => (
            <button key={s.title} className={`story__dot${k === i ? ' is-on' : ''}${k < i ? ' is-done' : ''}`} onClick={() => { setAuto(false); setI(k); }} aria-label={s.title}>
              {k === i && auto && <motion.i key={i} initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: STEP_MS / 1000, ease: 'linear' }} />}
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.h4 key={i} className="story__title" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            {step.title}
          </motion.h4>
        </AnimatePresence>
      </div>

      <div className={`story__photos${panes.length === 1 ? ' story__photos--one' : ''}`}>
        {panes.map((pn, k) => (
          <div key={k} className={`story__col${k === 1 ? ' story__col--right' : ''}`}>
            <div className="story__meter">{pn.meter && <Meter key={`m-${k}-${i}`} {...pn.meter} />}</div>
            <PaneView key={`${k}-${i}-${pn.photo.img}`} pane={pn} credit={credit} />
          </div>
        ))}
        <AnimatePresence>
          {step.moon && (
            <motion.div className="story__moon" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 16, delay: 0.6 }}>
              <img src="photos/moon_bootprint.webp" alt="Apollo 11 bootprint" />
              <span>Moon: grey,<br />no rust</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={i} className="story__body" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <p className="story__line">{step.line}</p>
        </motion.div>
      </AnimatePresence>

      <div className="story__nav">
        <button className="story__arrow" onClick={() => { setAuto(false); go(-1); }} disabled={i === 0} aria-label="Previous">←</button>
        <button className={`story__play${auto ? ' is-on' : ''}`} onClick={() => { if (i >= n - 1) setI(0); setAuto((a) => !a); }}>
          {auto ? 'Pause' : i >= n - 1 ? 'Replay' : 'Play story'}
        </button>
        <button className="story__arrow story__arrow--next" onClick={() => { setAuto(false); go(1); }} disabled={i === n - 1} aria-label="Next">→</button>
      </div>
    </div>
  );
}
