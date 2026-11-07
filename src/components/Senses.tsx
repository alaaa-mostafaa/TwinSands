import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { Sense, Shot, Snd } from '../content';
import AnnotatedPhoto from './AnnotatedPhoto';
import { useAllPhotos, useJSON, type PhotoMeta } from '../data';

export type Mode = 'map' | 'see' | 'hear' | 'smell' | 'feel';

// ---------------------------------------------------------------- one sound at a time, page-wide
let current: { id: string; audio?: HTMLAudioElement; timer?: number } | null = null;
const listeners = new Set<(id: string | null) => void>();
const announce = (id: string | null) => listeners.forEach((f) => f(id));
export function stopSound() {
  if (!current) return;
  current.audio?.pause();
  if (current.timer) clearTimeout(current.timer);
  current = null;
  announce(null);
}
function playSound(id: string, snd: Snd) {
  stopSound();
  if (!snd.file) current = { id, timer: window.setTimeout(stopSound, 5000) };   // silence, on purpose
  else {
    const audio = new Audio(`sounds/${snd.file}.mp3`);
    audio.addEventListener('ended', stopSound);
    current = { id, audio };
    audio.play().catch(stopSound);
  }
  announce(id);
}
function usePlaying() {
  const [p, setP] = useState<string | null>(current?.id ?? null);
  useEffect(() => { listeners.add(setP); return () => { listeners.delete(setP); }; }, []);
  return p;
}

// ---------------------------------------------------------------- the switch above the globes
const Icon: Record<Mode, JSX.Element> = {
  map: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" /></svg>,
  see: <svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3.2" /></svg>,
  hear: <svg viewBox="0 0 24 24"><path d="M7 15.5c0 2.5 1.6 4.5 4 4.5 1.8 0 2.6-1.2 3.2-2.6.7-1.6 1.6-2.2 2.8-3.4A6.6 6.6 0 0 0 19 9.5 6.5 6.5 0 0 0 12.5 3 6.5 6.5 0 0 0 6 9.5" /><path d="M10 9.6a2.6 2.6 0 1 1 4.2 2c-.9.7-1.2 1.4-1.2 2.4" /></svg>,
  smell: <svg viewBox="0 0 24 24"><path d="M7 20c-2-2.5 2-4.5 0-7s2-4.5 0-7" /><path d="M12 20c-2-2.5 2-4.5 0-7s2-4.5 0-7" /><path d="M17 20c-2-2.5 2-4.5 0-7s2-4.5 0-7" /></svg>,
  feel: <svg viewBox="0 0 24 24"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5V4.5a1.5 1.5 0 0 1 3 0V11m0-4.5a1.5 1.5 0 0 1 3 0V12m0-3.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.6a6 6 0 0 1-4.6-2.2L4 15.5a1.6 1.6 0 0 1 2.3-2.2L8 15" /></svg>,
};
const LABEL: Record<Mode, string> = { map: 'Map', see: 'See', hear: 'Hear', smell: 'Smell', feel: 'Feel' };

export function SenseBar({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <div className="sensebar" role="tablist" aria-label="Explore with your senses">
      {(Object.keys(LABEL) as Mode[]).map((m) => (
        <button key={m} role="tab" aria-selected={mode === m} className={`sensebar__btn${mode === m ? ' is-on' : ''}`} onClick={() => { if (m !== 'hear') stopSound(); setMode(m); }}>
          {Icon[m]}<span>{LABEL[m]}</span>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- per-panel overlay
function credit(m?: PhotoMeta) {
  if (!m) return null;
  return <a href={m.url} target="_blank" rel="noreferrer">{m.author && m.author !== 'NASA' ? m.author.split(/[,(]/)[0] : 'NASA'}{m.license && m.license !== 'Public domain' ? ` · ${m.license}` : ''}</a>;
}

/** Temperatures on one shared scale (−250 to +1,200 °C, square-root spaced) so panels compare at a glance. */
function Thermometer({ c }: { c: number }) {
  const f = (t: number) => Math.sign(t) * Math.sqrt(Math.abs(t));
  const lo = f(-250), hi = f(1200);
  const level = (f(c) - lo) / (hi - lo);
  const zero = (f(0) - lo) / (hi - lo);
  const hot = c > 0;
  return (
    <svg className="thermo" viewBox="0 0 40 200" aria-hidden>
      <rect x="14" y="8" width="12" height="160" rx="6" className="thermo__tube" />
      <line x1="10" x2="30" y1={168 - zero * 160} y2={168 - zero * 160} className="thermo__zero" />
      <text x="33" y={171 - zero * 160} className="thermo__lbl">0°</text>
      <motion.rect x="17" width="6" rx="3" className={hot ? 'thermo__hot' : 'thermo__cold'}
        initial={{ y: 168, height: 0 }} animate={{ y: 168 - level * 160, height: level * 160 }} transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }} />
      <circle cx="20" cy="180" r="12" className={hot ? 'thermo__hot' : 'thermo__cold'} />
    </svg>
  );
}

export default function Senses({ id, mode, sense, snd, shot }: { id: string; mode: Mode; sense?: Sense; snd?: Snd; shot?: Shot }) {
  const playing = usePlaying();
  const photos = useAllPhotos();
  const objects = useJSON<Record<string, PhotoMeta & { mode: string }>>('data/senses.json');
  const sounds = useJSON<Record<string, PhotoMeta>>('data/sounds.json');
  const all = { ...(photos ?? {}), ...(objects ?? {}) };
  useEffect(() => () => { if (current?.id === id) stopSound(); }, [id]);
  const on = playing === id;
  const temp = sense ? /(−|-|\+)?[\d,]+\s*°C/.exec(sense.feel.big) : null;
  const celsius = temp ? parseFloat(temp[0].replace('−', '-').replace(/[,+\s°C]/g, '')) : null;

  return (
    <AnimatePresence mode="wait">
      {mode === 'see' && (shot || sense) && (
        <motion.div key="see" className="sense-layer sense-layer--see" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
          {shot ? (
            <AnnotatedPhoto src={`photos/${shot.img}.webp`} w={shot.w} h={shot.h} marks={shot.marks} line={shot.line} credit={credit(all[shot.img])} />
          ) : (
            <AnnotatedPhoto src={`photos/${sense!.see[0]}.webp`} w={1} h={1} marks={[]} credit={credit(all[sense!.see[0]])} />
          )}
        </motion.div>
      )}

      {mode === 'smell' && sense && (
        <motion.div key="smell" className="sense-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="sense-objs">
            {sense.smell.items.length === 0 && <span className="sense-none">∅</span>}
            {sense.smell.items.map((k, i) => (
              <motion.img key={k} src={`senses/${k}.webp`} alt="" className={`sense-obj${objects?.[k]?.mode === 'screen' ? ' sense-obj--screen' : ''}`}
                initial={{ y: 30, opacity: 0, rotate: i ? 8 : -8 }} animate={{ y: [0, -8, 0], opacity: 1, rotate: i ? 6 : -6 }}
                transition={{ y: { duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.5 }, opacity: { duration: 0.4 } }} />
            ))}
          </div>
          <p className="sense-line">{sense.smell.text}</p>
          <p className="sense-credit">{sense.smell.items.map((k) => <span key={k}>{credit(objects?.[k])} </span>)}</p>
        </motion.div>
      )}

      {mode === 'feel' && sense && (
        <motion.div key="feel" className="sense-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {sense.feel.then != null && sense.feel.now != null ? (
            <div className="sense-objs sense-objs--feel thermo-pair">
              {([['Then', sense.feel.then], ['Now', sense.feel.now]] as const).map(([k, v]) => (
                <div key={k} className="thermo-col">
                  <Thermometer c={v} />
                  <div><span className="thermo-k">{k}</span><p className="feel-big feel-big--pair">{v.toLocaleString('en-US').replace('-', '−')} °C</p></div>
                </div>
              ))}
            </div>
          ) : (
          <div className="sense-objs sense-objs--feel">
            {celsius != null ? <Thermometer c={celsius} /> : sense.feel.img ? (
              <motion.img src={`senses/${sense.feel.img}.webp`} alt="" className="sense-obj" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1, rotate: -4 }} />
            ) : <span className="sense-none">∅</span>}
            <p className="feel-big" style={sense.feel.big.length > 6 ? { fontSize: 'clamp(24px, 2.6vw, 38px)' } : undefined}>{sense.feel.big}</p>
          </div>
          )}
          <p className="sense-line sense-line--small">{sense.feel.small}</p>
          {sense.feel.img && celsius == null && <p className="sense-credit">{credit(objects?.[sense.feel.img])}</p>}
        </motion.div>
      )}

      {mode === 'hear' && snd && (
        <motion.div key="hear" className="sense-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button className={`hear-play${on ? ' is-on' : ''}`} onClick={() => (on ? stopSound() : playSound(id, snd))} aria-label={on ? 'Stop' : 'Play'}>
            <span className="hear-play__icon" />
          </button>
          <div className={`hear-viz${on ? ' is-on' : ''}${snd.file ? '' : ' hear-viz--silent'}`}>{Array.from({ length: 22 }, (_, i) => <i key={i} style={{ animationDelay: `${-(i * 0.13) % 1}s` }} />)}</div>
          <p className="sense-line sense-line--small">{snd.what}</p>
          {snd.file && on && <p className="sense-credit">{credit(sounds?.[snd.file])}</p>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
