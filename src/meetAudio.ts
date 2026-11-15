/// <reference types="vite/client" />
/** Meet Mars sounds, made live with Web Audio (no files):
 *  - scroll: while the continents squeeze into a ball and turn into Mars, a deep grinding rumble and a rising
 *    whoosh. Its loudness follows how fast you scroll, so it goes quiet as soon as you stop.
 *  - moons: once the moons appear, a soft looping orbit hum with an airy whoosh that sweeps left to right
 *    in time with the circling moons.
 *  Uses the same on/off switch as the landing page sound (the "Sound on/off" button there). */
import { heroSound } from './heroAudio';

let ac: AudioContext | null = null;
let scrollGain: GainNode | null = null, scrollBP: BiquadFilterNode | null = null, rumbleOsc: OscillatorNode | null = null;
let orbitGain: GainNode | null = null, orbitPan: StereoPannerNode | null = null;
let lastP = 0, lastT = 0, energy = 0, raf = 0, moonsOn = 0, inView = false;

function noise(c: AudioContext, s: number) {
  const b = c.createBuffer(1, c.sampleRate * s, c.sampleRate), d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { last = 0.97 * last + 0.03 * (Math.random() * 2 - 1); d[i] = last * 4 + (Math.random() * 2 - 1) * 0.15; }  // brownish
  return b;
}

function build() {
  const c = new AudioContext(); ac = c;
  const out = c.createDynamicsCompressor(); out.threshold.value = -10; out.ratio.value = 8; out.connect(c.destination);

  // scroll: rumble (low noise + slow detuned saw) + whoosh (band-passed noise whose pitch rises with progress)
  scrollGain = c.createGain(); scrollGain.gain.value = 0; scrollGain.connect(out);
  const n = c.createBufferSource(); n.buffer = noise(c, 3); n.loop = true;
  scrollBP = c.createBiquadFilter(); scrollBP.type = 'bandpass'; scrollBP.Q.value = 0.9; scrollBP.frequency.value = 300;
  const ng = c.createGain(); ng.gain.value = 1.4;
  n.connect(scrollBP).connect(ng).connect(scrollGain); n.start();
  const lowN = c.createBufferSource(); lowN.buffer = noise(c, 2.3); lowN.loop = true;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
  const lg = c.createGain(); lg.gain.value = 1.6;
  lowN.connect(lp).connect(lg).connect(scrollGain); lowN.start();
  rumbleOsc = c.createOscillator(); rumbleOsc.type = 'sawtooth'; rumbleOsc.frequency.value = 55;
  const rlp = c.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 400;
  const rg = c.createGain(); rg.gain.value = 0.12;
  rumbleOsc.connect(rlp).connect(rg).connect(scrollGain); rumbleOsc.start();

  // moons: soft hum chord + airy whoosh panned back and forth (one sweep every ~7 s, like an orbit)
  orbitGain = c.createGain(); orbitGain.gain.value = 0; orbitGain.connect(out);
  orbitPan = c.createStereoPanner(); orbitPan.connect(orbitGain);
  [196, 293.7, 392].forEach((f, i) => {
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.detune.value = i * 4 - 4;
    const g = c.createGain(); g.gain.value = [0.07, 0.045, 0.03][i];
    const trem = c.createOscillator(), tg = c.createGain(); trem.frequency.value = 0.15 + i * 0.07; tg.gain.value = g.gain.value * 0.5;
    trem.connect(tg).connect(g.gain); trem.start();
    o.connect(g).connect(orbitGain!); o.start();
  });
  const air = c.createBufferSource(); air.buffer = noise(c, 3.7); air.loop = true;
  const abp = c.createBiquadFilter(); abp.type = 'bandpass'; abp.Q.value = 2; abp.frequency.value = 1400;
  const swell = c.createGain(); swell.gain.value = 0.35;
  const sw = c.createOscillator(), swg = c.createGain(); sw.frequency.value = 1 / 7; swg.gain.value = 0.3;
  sw.connect(swg).connect(swell.gain); sw.start();
  const panL = c.createOscillator(), panG = c.createGain(); panL.frequency.value = 1 / 7; panG.gain.value = 0.85;
  panL.connect(panG).connect(orbitPan.pan); panL.start();
  air.connect(abp).connect(swell).connect(orbitPan); air.start();

  const tick = () => {
    if (!ac) return;
    const t = ac.currentTime, on = !heroSound.isMuted() && inView && document.visibilityState === 'visible';
    energy *= 0.9;                                                   // the scroll sound fades fast once you stop
    scrollGain!.gain.setTargetAtTime(on ? Math.min(0.3, energy * 0.55) : 0, t, 0.06);
    orbitGain!.gain.setTargetAtTime(on ? moonsOn * 1.6 : 0, t, 0.5);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

export const meetSound = {
  /** p: 0..1 scroll progress through Meet Mars; moons: 0..1 how far the moons have appeared */
  update(p: number, moons: number, visible: boolean) {
    inView = visible;
    moonsOn = moons;
    if (heroSound.isMuted()) return;
    if (!ac) { try { build(); } catch { return; } }
    if (ac!.state !== 'running') ac!.resume().catch(() => {});
    const now = performance.now(), dt = Math.max(16, now - lastT);
    const dp = Math.abs(p - lastP);
    lastP = p; lastT = now;
    // only while the ball is forming and becoming Mars (p 0.04-0.52)
    const active = p > 0.04 && p < 0.52 ? 1 : 0;
    energy = Math.min(1, energy + active * (dp / dt) * 900);
    const t = ac!.currentTime;
    scrollBP!.frequency.setTargetAtTime(250 + p * 2600, t, 0.08);   // rises as the ball closes up
    rumbleOsc!.frequency.setTargetAtTime(45 + p * 50, t, 0.1);
  },
};

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.hidden) ac?.suspend().catch(() => {}); else ac?.resume().catch(() => {}); });
  // wake the sound on any click, tap or key press if the browser left it paused
  const wake = () => { if (ac && !heroSound.isMuted() && ac.state !== 'running') ac.resume().catch(() => {}); };
  ['pointerdown', 'keydown', 'touchend', 'wheel'].forEach((g) => window.addEventListener(g, wake, { passive: true }));
}
if (import.meta.hot) import.meta.hot.dispose(() => { cancelAnimationFrame(raf); ac?.close(); ac = null; });
