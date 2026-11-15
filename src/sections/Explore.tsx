import { AnimatePresence, motion } from 'framer-motion';
import OrbitSky from '../components/OrbitSky';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { REGIONS, WORLDS, type Region } from '../content';
import { useJSON, type PhotoMeta } from '../data';
import TerrainWalk, { loadTerrain, styleFor, type Keys, type Terrain } from '../three/TerrainWalk';
import { BASE, QUESTS, type QuestState } from '../three/walk/Quest';

/** Ambient + footsteps through Web Audio. Mars: real Perseverance wind, crunchy steps.
 *  Moon: no air, so no wind; steps are muffled, as if felt through your suit. */
function useWalkSound(world: 'mars' | 'moon', on: boolean, storm = false) {
  const ctx = useRef<AudioContext | null>(null);
  const steps = useRef<GainNode | null>(null);
  useEffect(() => {
    if (!on) return;
    const ac = new AudioContext();
    ctx.current = ac;
    const nodes: AudioScheduledSourceNode[] = [];
    const load = (f: string) => fetch(`sounds/${f}.mp3`).then((r) => r.arrayBuffer()).then((b) => ac.decodeAudioData(b));
    (async () => {
      const stepBuf = await load('earth_gravel');
      const sg = ac.createGain(); sg.gain.value = 0;
      let out: AudioNode = sg;
      if (world === 'moon') {
        const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
        sg.connect(lp); out = lp;
      }
      out.connect(ac.destination);
      const s = ac.createBufferSource(); s.buffer = stepBuf; s.loop = true; s.connect(sg); s.start(); nodes.push(s);
      steps.current = sg;
      if (world === 'mars') {
        const windBuf = await load('mars_wind');
        const w = ac.createBufferSource(); w.buffer = windBuf; w.loop = true;
        const wg = ac.createGain(); wg.gain.value = storm ? 1.0 : 0.55;
        w.connect(wg).connect(ac.destination); w.start(); nodes.push(w);
        if (storm) {                                   // gusts: the wind swells and drops every few seconds
          const lfo = ac.createOscillator(), depth = ac.createGain();
          lfo.frequency.value = 0.18; depth.gain.value = 0.45;
          lfo.connect(depth).connect(wg.gain); lfo.start(); nodes.push(lfo);
        }
      }
    })().catch(() => {});
    return () => { nodes.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } }); ac.close(); ctx.current = null; steps.current = null; };
  }, [world, on, storm]);
  return useCallback((moving: boolean, run: boolean) => {
    const g = steps.current, ac = ctx.current;
    if (!g || !ac) return;
    const target = moving ? (world === 'moon' ? 0.9 : 0.7) : 0;
    g.gain.setTargetAtTime(target * (run ? 1.15 : 1), ac.currentTime, 0.08);
  }, [world]);
}

/** A tiny two-note chirp when the rover starts talking. On the Moon instead: Apollo's real "Quindar tones",
 *  the 250 ms radio beeps heard on every Apollo transmission (2525 Hz to start, 2475 Hz to end). */
let blipCtx: AudioContext | null = null;
function blip(end = false, moon = false) {
  try {
    blipCtx ??= new AudioContext();
    const ac = blipCtx, now = ac.currentTime;
    if (moon) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = end ? 2475 : 2525;
      g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.04, now + 0.01); g.gain.setValueAtTime(0.04, now + 0.24); g.gain.linearRampToValueAtTime(0, now + 0.25);
      o.connect(g).connect(ac.destination); o.start(now); o.stop(now + 0.26);
      return;
    }
    (end ? [1320, 990] : [880, 1320]).forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, now + i * 0.09); g.gain.linearRampToValueAtTime(0.06, now + i * 0.09 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + 0.12);
      o.connect(g).connect(ac.destination); o.start(now + i * 0.09); o.stop(now + i * 0.09 + 0.14);
    });
  } catch { /* no audio */ }
}

/** The rover's voice: the browser's built-in speech, pitched up to sound small and friendly.
 *  On a Mac it is "Junior", the kid computer voice; elsewhere another friendly English voice, pitched up. */
const CUTE_VOICES = ['Junior', 'Samantha', 'Google US English', 'Microsoft Zira', 'Microsoft Aria'];
/** The astronaut: a calm grown-up voice. */
const ASTRO_VOICES = ['Reed (English (US', 'Eddy (English (US', 'Daniel', 'Google US English', 'Microsoft Guy', 'Microsoft David'];
function pickVoice(moon = false) {
  const vs = typeof speechSynthesis !== 'undefined' ? speechSynthesis.getVoices() : [];
  for (const n of moon ? ASTRO_VOICES : CUTE_VOICES) { const v = vs.find((x) => x.name.startsWith(n) && x.lang.startsWith('en')); if (v) return v; }
  return vs.find((x) => x.lang.startsWith('en')) ?? null;
}
const speakable = (s: string) => s
  .replace(/−/g, 'minus ').replace(/\+(\d)/g, 'plus $1').replace(/°C/g, ' degrees').replace(/(\d) km/g, '$1 kilometres')
  .replace(/\b[A-Z]{2,}\b/g, (w) => w.toLowerCase());   // shouted words: say them, don't spell them
function robotSay(text: string, onEnd: () => void, moon = false) {
  if (typeof speechSynthesis === 'undefined') return onEnd();
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(speakable(text.replace(/[“”]/g, '')));
  const v = pickVoice(moon);
  if (v) u.voice = v;
  if (moon) { u.pitch = 0.95; u.rate = 0.98; }
  else { u.pitch = v?.name.startsWith('Junior') ? 1.35 : 1.6; u.rate = 1.08; }
  u.volume = 0.9;
  u.onend = () => { blip(true, moon); onEnd(); }; u.onerror = onEnd;
  speechSynthesis.speak(u);
}
/** A postcard of your current view: the 3D picture on cream card, a stamp and a postmark, saved as a PNG. */
function postcard(region: Region, found: string, secs: number) {
  const src = document.querySelector('.walk__canvas canvas') as HTMLCanvasElement | null;
  if (!src) return;
  shutter();
  const W = 1600, H = 1120, P = 56, PH = 820, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d')!;
  x.fillStyle = '#efe6d2'; x.fillRect(0, 0, W, H);
  // the view, cropped to fill the photo area
  const pw = W - P * 2, r = Math.max(pw / src.width, PH / src.height), sw = pw / r, sh = PH / r;
  x.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, P, P, pw, PH);
  x.strokeStyle = 'rgba(40,30,20,.35)'; x.lineWidth = 2; x.strokeRect(P, P, pw, PH);
  // text
  const world = region.world === 'mars' ? 'Mars' : 'the Moon';
  x.fillStyle = '#8a6b45'; x.font = '600 26px "TS Serif", Georgia, serif'; x.textBaseline = 'alphabetic';
  x.fillText('GREETINGS FROM', P, PH + P + 66);
  x.fillStyle = '#22190f'; x.font = '600 76px "TS Serif", Georgia, serif';
  x.fillText(`${region.name}, ${world}`, P, PH + P + 146);
  x.fillStyle = '#4a3b2a'; x.font = 'italic 32px "TS Serif", Georgia, serif';
  x.fillText(`Found ${found}${secs ? ` in ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : ''} · Twin Sands`, P, PH + P + 196);
  // stamp, top right of the photo
  const sx = W - P - 190, sy = P + 26, swd = 160, shd = 196;
  x.fillStyle = '#efe6d2'; x.fillRect(sx - 8, sy - 8, swd + 16, shd + 16);
  x.fillStyle = region.world === 'mars' ? '#b5532c' : '#5d6a80'; x.fillRect(sx, sy, swd, shd);
  x.fillStyle = '#efe6d2'; x.beginPath(); x.arc(sx + swd / 2, sy + 80, 46, 0, Math.PI * 2); x.fill();
  x.fillStyle = region.world === 'mars' ? '#b5532c' : '#5d6a80'; x.beginPath(); x.arc(sx + swd / 2 + 14, sy + 70, 40, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#efe6d2'; x.font = '600 26px "TS Serif", Georgia, serif'; x.textAlign = 'center';
  x.fillText(region.world === 'mars' ? 'MARS' : 'MOON', sx + swd / 2, sy + 160);
  x.font = '600 15px "TS Serif", Georgia, serif'; x.fillText('TWIN SANDS', sx + swd / 2, sy + 184);
  // postmark: two rings and a date, slightly over the stamp
  const mx = sx - 30, my = sy + 150;
  x.strokeStyle = 'rgba(30,25,40,.55)'; x.lineWidth = 3;
  x.beginPath(); x.arc(mx, my, 70, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.arc(mx, my, 54, 0, Math.PI * 2); x.stroke();
  x.fillStyle = 'rgba(30,25,40,.6)'; x.font = '600 17px "TS Serif", Georgia, serif';
  x.fillText(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(), mx, my + 6);
  for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(mx - 80, my - 24 + i * 16); x.bezierCurveTo(mx - 120, my - 40 + i * 16, mx - 150, my - 8 + i * 16, mx - 190, my - 24 + i * 16); x.stroke(); }
  x.textAlign = 'start';
  const a = document.createElement('a');
  a.href = c.toDataURL('image/png'); a.download = `twin-sands-postcard-${region.id}.png`; a.click();
}

/** camera shutter: two quick clicks of filtered noise */
function shutter() {
  try {
    const c = new AudioContext(), b = c.createBuffer(1, c.sampleRate * 0.25, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) { const t = i / c.sampleRate; d[i] = (Math.random() * 2 - 1) * (Math.exp(-t * 90) + (t > 0.09 ? Math.exp(-(t - 0.09) * 70) * 0.8 : 0)); }
    const s = c.createBufferSource(), f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 0.8;
    s.buffer = b; s.connect(f).connect(c.destination); s.start(); s.onended = () => c.close();
  } catch { /* no sound */ }
}
function stopTalking() { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); }
if (typeof speechSynthesis !== 'undefined') speechSynthesis.getVoices();   // voices load lazily in Chrome

function Walk({ region, onExit }: { region: Region; onExit: () => void }) {
  const [t, setT] = useState<Terrain | null>(null);
  const [hud, setHud] = useState({ elev: 0, x: 0, z: 0 });
  const [sound, setSound] = useState(true);
  const keys = useRef<Keys>({ f: false, b: false, l: false, r: false, tl: false, tr: false, run: false });
  const storm = !!styleFor(region.id, region.world).storm;
  const setStep = useWalkSound(region.world, sound, storm);

  // The rover talks: chirp, then reads the line aloud in a robot voice; the next line comes a few seconds
  // after it finishes. Tap the bubble to skip ahead. Without sound, lines advance on a timer.
  const lines = region.rover ?? [];
  const [li, setLi] = useState(-1);
  const [showing, setShowing] = useState(false);
  useEffect(() => {
    if (!t || !lines.length || showing) return;
    const id = setTimeout(() => { setLi((i) => (i + 1) % lines.length); setShowing(true); }, li < 0 ? 1500 : 3500);
    return () => clearTimeout(id);
  }, [t, showing, li, lines]);
  useEffect(() => {
    if (!showing || li < 0) return;
    const text = lines[li];
    let done = false, hide = 0;
    const finish = (pause: number) => { if (done) return; done = true; hide = window.setTimeout(() => setShowing(false), pause); };
    const fallback = window.setTimeout(() => finish(0), 4500 + text.length * (sound ? 90 : 45));   // timer, or safety net if speech stalls
    let start = 0;
    if (sound) {
      const moon = region.world === 'moon';
      blip(false, moon);
      start = window.setTimeout(() => robotSay(text, () => finish(1200), moon), moon ? 380 : 260);
    }
    return () => { clearTimeout(fallback); clearTimeout(start); clearTimeout(hide); stopTalking(); };
  }, [li, showing, sound, lines]);
  // the "find it" task: distance and direction from the 3D scene; when you reach it, a fact and a happy line
  const quest = QUESTS[region.id];
  const [qs, setQs] = useState<QuestState | null>(null);
  const [cheer, setCheer] = useState<string | null>(null);
  const [factOpen, setFactOpen] = useState(false);
  const wasFound = useRef(false);
  const t0 = useRef(0);
  const [took, setTook] = useState(0);
  useEffect(() => { if (t) t0.current = performance.now(); }, [t]);
  const onQuest = (s: QuestState) => {
    setQs(s);
    if (s.found && !wasFound.current && quest) {
      wasFound.current = true;
      setTook(Math.round((performance.now() - t0.current) / 1000));
      setFactOpen(true); setCheer(quest.say);
      stopTalking();
      if (sound) { const moon = region.world === 'moon'; blip(false, moon); window.setTimeout(() => robotSay(quest.say, () => {}, moon), moon ? 380 : 260); }
      window.setTimeout(() => setCheer(null), 7000);
    }
  };
  // the button that makes the found object do something (fly, launch, grow, call Earth, lights, photo)
  const [act, setAct] = useState(0);
  const doAct = () => {
    if (!quest || !qs?.found) return;
    setAct((n) => n + 1); setFactOpen(false);
    stopTalking(); setCheer(quest.actSay);
    if (quest.act === 'photo') shutter();
    if (sound) { const moon = region.world === 'moon'; blip(false, moon); window.setTimeout(() => robotSay(quest.actSay, () => {}, moon), moon ? 380 : 260); }
    window.clearTimeout(cheerT.current); cheerT.current = window.setTimeout(() => setCheer(null), 8000);
  };
  const cheerT = useRef(0);
  const doActRef = useRef(doAct); doActRef.current = doAct;
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.code === 'KeyE') doActRef.current(); };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, []);
  const say = cheer ?? (showing && li >= 0 ? lines[li] : null);

  useEffect(() => { loadTerrain(region.id).then(setT).catch(() => setT(null)); }, [region.id]);
  useEffect(() => {
    const map: Record<string, keyof Keys> = { ArrowUp: 'f', KeyW: 'f', ArrowDown: 'b', KeyS: 'b', KeyA: 'l', KeyD: 'r', ArrowLeft: 'tl', ArrowRight: 'tr', ShiftLeft: 'run', ShiftRight: 'run' };
    const down = (e: KeyboardEvent) => { if (e.code === 'Escape') onExit(); const k = map[e.code]; if (k) { keys.current[k] = true; e.preventDefault(); } };
    const up = (e: KeyboardEvent) => { const k = map[e.code]; if (k) keys.current[k] = false; };
    addEventListener('keydown', down); addEventListener('keyup', up);
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up); };
  }, [onExit]);

  const hold = (k: keyof Keys) => ({
    onPointerDown: (e: React.PointerEvent) => { e.stopPropagation(); keys.current[k] = true; },
    onPointerUp: () => { keys.current[k] = false; }, onPointerLeave: () => { keys.current[k] = false; },
  });

  return (
    <div className={`walk${storm ? ' walk--storm' : ''}`}>
      {t ? (
        <TerrainWalk t={t} id={region.id} world={region.world} keys={keys} say={say}
          onTap={() => { stopTalking(); setLi((i) => (i + 1) % lines.length); setShowing(true); }}
          onMove={(s) => { setHud({ elev: s.elev, x: s.x, z: s.z }); setStep(s.moving, keys.current.run); }}
          onQuest={quest ? onQuest : undefined} questAction={act} />
      ) : <div className="walk__loading">Loading real terrain…</div>}
      <div className="walk__top">
        <div>
          <b>{WORLDS[region.world].name} · {region.name}</b>
          <span>{t?.far ? `Real ${region.world === 'mars' ? 'NASA + ESA' : 'NASA'} elevation data · 12 km to walk, 120 km in view` : 'Real NASA elevation data · 12 × 12 km'}</span>
          {BASE[region.id] && (
            <span className="base">
              <span className="base__meters">{BASE[region.id].meters.map(([k, v]) => (
                <span key={k} className="base__m">{k} <i aria-label={`${v} of 3`}>{[0, 1, 2].map((n) => <em key={n} className={n < v ? 'on' : ''} />)}</i></span>
              ))}</span>
              <span className="base__v"><b>Base site?</b> {BASE[region.id].verdict}</span>
            </span>
          )}
        </div>
        <button className="walk__x" onClick={onExit} aria-label="Leave">✕</button>
      </div>
      {t && quest && qs && (
        <div className={`quest${qs.found ? ' is-found' : ''}`}>
          <span className="quest__tag">{qs.found && took ? `Field task · found in ${Math.floor(took / 60)}:${String(took % 60).padStart(2, '0')}` : 'Field task'}</span>
          <b>{quest.task}</b>
          {!qs.found ? (
            <span className="quest__nav">
              <svg className="quest__arrow" viewBox="0 0 24 24" style={{ transform: `rotate(${qs.rel}rad)` }} aria-hidden><path d="M12 20V5M6 10l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              {qs.dist >= 1000 ? `${(qs.dist / 1000).toFixed(1)} km` : `${Math.round(qs.dist)} m`} away. Follow the beam of light.
            </span>
          ) : (
            <>
              <span className="quest__stamp" aria-label="Found">Found</span>
              <button className={`quest__fact${factOpen ? " is-open" : ""}`} onClick={() => setFactOpen((v) => !v)}>{factOpen ? quest.found : 'Read the note'}</button>
              <span className="quest__btns">
                <button className="quest__act" onClick={doAct}>{quest.actLabel} <kbd>E</kbd></button>
                <button className="quest__act quest__act--card" onClick={() => postcard(region, quest.task.replace(/^Find (the )?/, ''), took)}>Send a postcard</button>
              </span>
            </>
          )}
        </div>
      )}
      {quest?.act === 'photo' && act > 0 && <div className="walk__flash" key={act} aria-hidden />}
      {t && (
        <div className="walk__hud">
          <span>Elevation <b>{Math.round(hud.elev).toLocaleString()} m</b></span>
          <span>{Math.round(hud.x)} m E · {Math.round(-hud.z)} m N</span>
          <button className="walk__sound" onClick={() => setSound((v) => !v)}>{sound ? 'Sound on' : 'Sound off'}</button>
        </div>
      )}
      <div className="walk__help">
        <span><kbd>↑</kbd><kbd>↓</kbd> walk · <kbd>←</kbd><kbd>→</kbd> turn · <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> also work · <kbd>Shift</kbd> run · drag to look</span>
        <em>{region.world === 'moon' ? 'No air on the Moon: no wind, and you’d only feel your steps through your suit.' : storm ? 'A heavy dust storm, thicker than the one Perseverance watched here in January 2022. Wind: real Perseverance recording, louder. Steps: recorded on Earth.' : 'Wind: real Perseverance recording. Steps: recorded on Earth.'}</em>
      </div>
      <div className="walk__pad" aria-hidden>
        <button {...hold('f')} className="pad-up">▲</button>
        <button {...hold('tl')} className="pad-l">◀</button>
        <button {...hold('b')} className="pad-down">▼</button>
        <button {...hold('tr')} className="pad-r">▶</button>
      </div>
    </div>
  );
}

/** "Then ↔ now": the real photo of the place (now), and the same photo with an imagined eruption painted on (then).
 *  Starts in the past and slides to today; drag the slider to travel back and forth. */
function ThenNow({ region, meta, onNext, onClose }: { region: Region; meta?: PhotoMeta; onNext: () => void; onClose: () => void }) {
  const it = region.intro!;
  const w = meta?.w ?? 1600, h = meta?.h ?? 1492, { cx, cy, r } = it.fire;
  const [v, setV] = useState(0);            // 0 = long ago, 1 = today
  const touched = useRef(false);
  useEffect(() => {                         // auto-play: hold on the eruption, then cool down to today
    let raf = 0; const t0 = performance.now() + 1800;
    const step = (t: number) => {
      if (touched.current) return;
      const k = Math.min(1, Math.max(0, (t - t0) / 4200));
      setV(k * k * (3 - 2 * k));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  // lava rivers: wiggly lines running from the caldera down the flanks (deterministic, drawn in image pixels)
  const rivers = useMemo(() => {
    let seed = 5; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: 22 }, (_, i) => {
      let a = (i / 22) * Math.PI * 2 + rnd() * 0.25, d = 70 + rnd() * 30;
      const len = r * (0.55 + rnd() * 0.45), pts: string[] = [];
      while (d < len) { pts.push(`${(cx + Math.cos(a) * d).toFixed(0)},${(cy + Math.sin(a) * d).toFixed(0)}`); a += (rnd() - 0.5) * 0.16; d += 18 + rnd() * 14; }
      return { d: 'M' + pts.join(' L'), w: 5 + rnd() * 9, delay: rnd() * 3 };
    });
  }, [cx, cy, r]);
  const past = 1 - v;
  return (
    <div className="xintro">
      <svg className="xintro__img" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid slice" aria-label={it.title}>
        <defs>
          <filter id="tn-hot"><feColorMatrix type="matrix" values="0.9 0.35 0.1 0 0  0.25 0.2 0.05 0 0  0.05 0.05 0.05 0 0  0 0 0 1 0" /></filter>
          <filter id="tn-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9" /></filter>
          <radialGradient id="tn-pit"><stop offset="0" stopColor="#fff3b0" /><stop offset=".35" stopColor="#ffb02e" /><stop offset=".7" stopColor="#ff4d0a" stopOpacity=".7" /><stop offset="1" stopColor="#ff2a00" stopOpacity="0" /></radialGradient>
          <radialGradient id="tn-heat"><stop offset="0" stopColor="#ff6a00" stopOpacity=".55" /><stop offset="1" stopColor="#ff3000" stopOpacity="0" /></radialGradient>
        </defs>
        <image href={`photos/${it.img}.webp`} width={w} height={h} />
        <g opacity={past} style={{ pointerEvents: 'none' }}>
          <image href={`photos/${it.img}.webp`} width={w} height={h} filter="url(#tn-hot)" />
          <circle cx={cx} cy={cy} r={r * 1.1} fill="url(#tn-heat)" />
          <g filter="url(#tn-glow)">{rivers.map((x, i) => <path key={i} d={x.d} stroke="#ff4a00" strokeWidth={x.w * 2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}</g>
          {rivers.map((x, i) => <path key={i} d={x.d} stroke="#ff8a1e" strokeWidth={x.w} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
          {rivers.map((x, i) => <path key={i} className="xintro__lava" d={x.d} stroke="#ffe08a" strokeWidth={x.w * 0.35} fill="none" strokeLinecap="round" style={{ animationDelay: `-${x.delay}s` }} />)}
          <circle className="xintro__pit" cx={cx} cy={cy} r={120} fill="url(#tn-pit)" />
          {[0, 1, 2, 3].map((k) => <circle key={k} className="xintro__smoke" cx={cx + (k - 1.5) * 30} cy={cy - 40} r={90 + k * 30} fill="rgba(70,55,50,.55)" style={{ animationDelay: `${-k * 2.2}s` }} filter="url(#tn-glow)" />)}
        </g>
      </svg>
      <div className="xtwin__body xintro__body">
        <span className="kicker">{it.kicker}</span>
        <h3>{it.title}</h3>
        {it.facts.map((f) => <p key={f}>{f}</p>)}
        <button className="xgo" onClick={onNext}>See its twin on Earth →</button>
        {meta && <a className="xtwin__credit" href={meta.url} target="_blank" rel="noreferrer">Photo: NASA Viking orbiter mosaic{past > 0.02 ? ' · eruption effect added by us' : ''}</a>}
      </div>
      <div className="xintro__time">
        <span className={past > 0.5 ? 'is-on' : ''}>{it.then}</span>
        <input type="range" min={0} max={1000} value={Math.round(v * 1000)} aria-label="Travel in time"
          onChange={(e) => { touched.current = true; setV(Number(e.target.value) / 1000); }} />
        <span className={past <= 0.5 ? 'is-on' : ''}>{it.now}</span>
      </div>
      <button className="walk__x xtwin__x" onClick={onClose} aria-label="Close">✕</button>
    </div>
  );
}

export default function Explore() {
  const [world, setWorld] = useState<'mars' | 'moon' | null>('mars');
  const [region, setRegion] = useState<Region | null>(null);
  const [stage, setStage] = useState<'intro' | 'twin' | 'walk'>('twin');
  const credits = useJSON<Record<string, PhotoMeta>>('data/postcards.json');

  useEffect(() => {
    document.body.style.overflow = region ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [region]);

  const open = (r: Region) => { setRegion(r); setStage(r.intro ? 'intro' : 'twin'); };
  const exit = useCallback(() => setRegion(null), []);
  const regions = REGIONS.filter((r) => r.world === world);
  const c = region ? credits?.[region.twin.img] : undefined;

  return (
    <section className="explore" id="explore">
      <OrbitSky />
      <header className="chapter-head">
        <h2>Explore</h2>
        <p>Walk on real ground. Each place is built from NASA elevation data, 12 km across. Before you land, see its twin on Earth.</p>
      </header>

      <div className={`explore__worlds${world ? ' has-pick' : ''}`}>
        {(['mars', 'moon'] as const).map((w) => (
          <button key={w} className={`xworld xworld--${w}${world === w ? ' is-on' : ''}`} onClick={() => setWorld(w)} aria-pressed={world === w}>
            {/* the globe: the real NASA surface map, scrolling behind a round window, shaded like a sphere */}
            <i className="xworld__globe" style={{ backgroundImage: `url(tex/${w}_base.webp)` }} />
            <span>Explore {WORLDS[w].name}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {world && (
          <motion.div key={world} className={`explore__regions explore__regions--${world}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {regions.map((r, k) => (
              <button key={r.id} className="xregion" onClick={() => open(r)} style={{ ['--k' as string]: k }} aria-label={`Walk on ${r.name}`}>
                <span className="xregion__img"><img src={`hillshade/${r.id}.webp`} alt="" /></span>
                <b>{r.name}</b>
                <span>{r.line}</span>
                <em className="xregion__go">Walk here <i aria-hidden>→</i></em>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {region && (
          <motion.div className="xmodal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {stage === 'intro' && region.intro ? (
              <ThenNow region={region} meta={credits?.[region.intro.img]} onNext={() => setStage('twin')} onClose={exit} />
            ) : stage === 'twin' ? (
              <div className="xtwin">
                <img src={`photos/${region.twin.img}.webp`} alt={region.twin.name} />
                <div className="xtwin__body">
                  <span className="kicker">Before you land · on Earth, this looks like</span>
                  <h3>{region.twin.name}</h3>
                  <p>{region.twin.line}</p>
                  <button className="xgo" onClick={() => setStage('walk')}>Step onto {region.name} →</button>
                  {c && <a className="xtwin__credit" href={c.url} target="_blank" rel="noreferrer">Photo: {c.author?.split(/[(,]/)[0]}{c.license && c.license !== 'Public domain' ? ` · ${c.license}` : ''}</a>}
                  {region.twin.inset && (
                    <figure className={`xinset${region.twin.inset.glow ? ' xinset--glow' : ''}`}>
                      <img src={`photos/${region.twin.inset.img}.webp`} alt="" />
                      <figcaption>{region.twin.inset.caption}
                        {credits?.[region.twin.inset.img] && <a href={credits[region.twin.inset.img].url} target="_blank" rel="noreferrer">Photo: {credits[region.twin.inset.img].author} · {credits[region.twin.inset.img].license}</a>}
                      </figcaption>
                    </figure>
                  )}
                </div>
                <button className="walk__x xtwin__x" onClick={exit} aria-label="Close">✕</button>
              </div>
            ) : (
              <Walk region={region} onExit={exit} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
