import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { REGIONS, WORLDS, type Region } from '../content';
import { useJSON, type PhotoMeta } from '../data';
import TerrainWalk, { loadTerrain, type Keys, type Terrain } from '../three/TerrainWalk';

/** Ambient + footsteps through Web Audio. Mars: real Perseverance wind, crunchy steps.
 *  Moon: no air, so no wind; steps are muffled, as if felt through your suit. */
function useWalkSound(world: 'mars' | 'moon', on: boolean) {
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
        const wg = ac.createGain(); wg.gain.value = 0.55;
        w.connect(wg).connect(ac.destination); w.start(); nodes.push(w);
      }
    })().catch(() => {});
    return () => { nodes.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } }); ac.close(); ctx.current = null; steps.current = null; };
  }, [world, on]);
  return useCallback((moving: boolean, run: boolean) => {
    const g = steps.current, ac = ctx.current;
    if (!g || !ac) return;
    const target = moving ? (world === 'moon' ? 0.9 : 0.7) : 0;
    g.gain.setTargetAtTime(target * (run ? 1.15 : 1), ac.currentTime, 0.08);
  }, [world]);
}

function Walk({ region, onExit }: { region: Region; onExit: () => void }) {
  const [t, setT] = useState<Terrain | null>(null);
  const [hud, setHud] = useState({ elev: 0, x: 0, z: 0 });
  const [sound, setSound] = useState(true);
  const keys = useRef<Keys>({ f: false, b: false, l: false, r: false, tl: false, tr: false, run: false });
  const setStep = useWalkSound(region.world, sound);

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
    <div className="walk">
      {t ? (
        <TerrainWalk t={t} world={region.world} keys={keys}
          onMove={(s) => { setHud({ elev: s.elev, x: s.x, z: s.z }); setStep(s.moving, keys.current.run); }} />
      ) : <div className="walk__loading">Loading real terrain…</div>}
      <div className="walk__top">
        <div>
          <b>{WORLDS[region.world].name} · {region.name}</b>
          <span>Real NASA elevation data · 12 × 12 km</span>
        </div>
        <button className="walk__x" onClick={onExit} aria-label="Leave">✕</button>
      </div>
      {t && (
        <div className="walk__hud">
          <span>Elevation <b>{Math.round(hud.elev).toLocaleString()} m</b></span>
          <span>{Math.round(hud.x)} m E · {Math.round(-hud.z)} m N</span>
          <button className="walk__sound" onClick={() => setSound((v) => !v)}>{sound ? 'Sound on' : 'Sound off'}</button>
        </div>
      )}
      <div className="walk__help">
        <span><kbd>↑</kbd><kbd>↓</kbd> walk · <kbd>←</kbd><kbd>→</kbd> turn · <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> also work · <kbd>Shift</kbd> run · drag to look</span>
        <em>{region.world === 'moon' ? 'No air on the Moon: no wind, and you’d only feel your steps through your suit.' : 'Wind: real Perseverance recording. Steps: recorded on Earth.'}</em>
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

export default function Explore() {
  const [world, setWorld] = useState<'mars' | 'moon' | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [stage, setStage] = useState<'twin' | 'walk'>('twin');
  const credits = useJSON<Record<string, PhotoMeta>>('data/postcards.json');

  useEffect(() => {
    document.body.style.overflow = region ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [region]);

  const open = (r: Region) => { setRegion(r); setStage('twin'); };
  const exit = useCallback(() => setRegion(null), []);
  const regions = REGIONS.filter((r) => r.world === world);
  const c = region ? credits?.[region.twin.img] : undefined;

  return (
    <section className="explore" id="explore">
      <header className="chapter-head">
        <h2>Explore</h2>
        <p>Walk on real ground. Each place is built from NASA elevation data, 12 km across. Before you land, see its twin on Earth.</p>
      </header>

      <div className="explore__worlds">
        {(['mars', 'moon'] as const).map((w) => (
          <button key={w} className={`xworld xworld--${w}${world === w ? ' is-on' : ''}`} onClick={() => setWorld(w)}>
            <img src={w === 'mars' ? 'photos/meet_bg.webp' : 'photos/moon_south_pole.webp'} alt="" />
            <span>Explore {WORLDS[w].name}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {world && (
          <motion.div key={world} className="explore__regions" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {regions.map((r) => (
              <button key={r.id} className="xregion" onClick={() => open(r)}>
                <img src={`hillshade/${r.id}.webp`} alt="" />
                <b>{r.name}</b>
                <span>{r.line}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {region && (
          <motion.div className="xmodal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {stage === 'twin' ? (
              <div className="xtwin">
                <img src={`photos/${region.twin.img}.webp`} alt={region.twin.name} />
                <div className="xtwin__body">
                  <span className="kicker">Before you land · on Earth, this looks like</span>
                  <h3>{region.twin.name}</h3>
                  <p>{region.twin.line}</p>
                  <button className="xgo" onClick={() => setStage('walk')}>Step onto {region.name} →</button>
                  {c && <a className="xtwin__credit" href={c.url} target="_blank" rel="noreferrer">Photo: {c.author?.split(/[(,]/)[0]}{c.license && c.license !== 'Public domain' ? ` · ${c.license}` : ''}</a>}
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
