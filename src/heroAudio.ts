/// <reference types="vite/client" />
/** Landing-page sound:
 *  - the team's space track, looped seamlessly, fading to silence as you scroll down past the landing screen
 *  - a whoosh (made live with Web Audio) when the planets swap, panned in the direction they move.
 *  Browsers only allow sound after the visitor clicks or presses a key, so start() is called on the first one. */

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let drone: GainNode | null = null;
let shimmerTimer = 0;
let level = 1;          // 0..1, set from the scroll position so the drone fades away below the hero
let muted = false;
try { muted = localStorage.getItem('hero-sound') === 'off'; } catch { /* storage blocked */ }

function noiseBuffer(c: AudioContext, seconds: number) {
  const b = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

const TRACK = 'sounds/hero_space.mp3';   // the team's chosen space sound ("Conexión extraterrestre", flechex)
const XFADE = 1.5;                         // seconds of overlap when the clip loops, so there's no seam
const LOOP_END = 15.8;                     // the file has ~8 s of silence after 16 s: loop only the part with sound
const LEVEL = 2.0;                         // the track peaks at only ~0.42, so lift it to a normal loudness

function build() {
  const c = new AudioContext();
  ac = c;
  master = c.createGain(); master.gain.value = 0;
  const lim = c.createDynamicsCompressor(); lim.threshold.value = -6; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.25;
  master.connect(lim).connect(c.destination);
  drone = c.createGain(); drone.gain.value = LEVEL; drone.connect(master);
  // play the clip on a loop: each copy fades in while the last one fades out
  fetch(TRACK).then((r) => r.arrayBuffer()).then((b) => c.decodeAudioData(b)).then((buf) => {
    const play = (at: number) => {
      if (ac !== c) return;
      const src = c.createBufferSource(), g = c.createGain();
      const len = Math.min(buf.duration, LOOP_END);
      src.buffer = buf; src.connect(g).connect(drone!);
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(1, at + XFADE);
      g.gain.setValueAtTime(1, at + len - XFADE); g.gain.linearRampToValueAtTime(0, at + len);
      src.start(at, 0, len); src.stop(at + len + 0.05);
      const next = at + len - XFADE;
      shimmerTimer = window.setTimeout(() => play(next), Math.max(0, (next - c.currentTime - 1) * 1000));
    };
    play(c.currentTime + 0.05);
  }).catch(() => {});
}

function apply(fade = 1.5) {
  if (!ac || !master) return;
  const target = muted ? 0 : 0.9 * level;
  master.gain.cancelScheduledValues(ac.currentTime);
  master.gain.setTargetAtTime(target, ac.currentTime, fade / 3);
}

export const heroSound = {
  /** call on a user gesture */
  start() {
    if (!ac) build();
    if (ac!.state !== 'running') ac!.resume().catch(() => {});
    apply(3);
  },
  started: () => !!ac,
  /** true only when the browser is really playing our audio */
  running: () => !!ac && ac.state === 'running',
  onChange(fn: () => void) { if (ac) ac.onstatechange = fn; },
  isMuted: () => muted,
  setMuted(m: boolean) {
    muted = m;
    try { localStorage.setItem('hero-sound', m ? 'off' : 'on'); } catch { /* storage blocked */ }
    if (!m) this.start(); else apply(0.4);
  },
  /** 1 while the hero fills the screen, fading to 0 as you scroll away */
  setLevel(v: number) { level = Math.max(0, Math.min(1, v)); apply(0.6); },
  /** whoosh: dir +1 = planets move left (next), -1 = they move right (previous) */
  whoosh(dir: number) {
    if (!ac || !master || muted) return;
    const c = ac, t = c.currentTime, L = 1.6;
    // duck the drone so the swoosh stands out, then bring it back
    if (drone) { drone.gain.cancelScheduledValues(t); drone.gain.setTargetAtTime(LEVEL * 0.4, t, 0.05); drone.gain.setTargetAtTime(LEVEL, t + 0.9, 0.4); }
    const pan = c.createStereoPanner(), out = c.createGain(); out.gain.value = 1;
    pan.pan.setValueAtTime(dir > 0 ? 0.9 : -0.9, t); pan.pan.linearRampToValueAtTime(dir > 0 ? -0.9 : 0.9, t + L * 0.85);
    pan.connect(out).connect(c.destination);
    // two layers of rushing air: a broad body and a bright edge, both sweeping up then down (the doppler feel)
    for (const [f0, f1, f2, q, peak] of [[300, 2200, 350, 0.7, 1.2], [1500, 7000, 1800, 1.2, 0.55]] as const) {
      const src = c.createBufferSource(); src.buffer = noiseBuffer(c, L + 0.1);
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
      bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + L * 0.4); bp.frequency.exponentialRampToValueAtTime(f2, t + L);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + L * 0.38); g.gain.exponentialRampToValueAtTime(0.0001, t + L);
      src.connect(bp).connect(g).connect(pan); src.start(t); src.stop(t + L + 0.1);
    }
    // a tonal "vvvoom" underneath, so it feels like something big passing by
    const o = c.createOscillator(), og = c.createGain(); o.type = 'sawtooth';
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(240, t + L * 0.4); o.frequency.exponentialRampToValueAtTime(90, t + L);
    og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.18, t + L * 0.38); og.gain.exponentialRampToValueAtTime(0.0001, t + L);
    o.connect(lp).connect(og).connect(pan); o.start(t); o.stop(t + L + 0.05);
  },
};

export function stopHeroSound() {
  window.clearTimeout(shimmerTimer);
  ac?.close(); ac = null; master = null; drone = null;
}

// Silence when the page isn't being looked at (another tab, minimised window, locked screen), resume when it is.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) ac.suspend().catch(() => {});
    else if (!muted) ac.resume().catch(() => {});
  });
  window.addEventListener('pagehide', () => { ac?.suspend().catch(() => {}); });
  // Browsers sometimes leave the sound paused (after a tab switch, sleep, or a reload while developing).
  // Any click, tap or key press wakes it up again, so the sound never silently stays off.
  const wake = () => { if (ac && !muted && ac.state !== 'running') ac.resume().catch(() => {}); };
  ['pointerdown', 'keydown', 'touchend'].forEach((g) => window.addEventListener(g, wake, { passive: true }));
}

// While developing: when this file is hot-reloaded, shut down the old sound instead of leaving it playing.
if (import.meta.hot) import.meta.hot.dispose(() => stopHeroSound());
