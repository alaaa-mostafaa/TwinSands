import { useEffect, useRef, useState } from 'react';
import * as L from './roverLines';
import type { AreaKey } from './roverLines';

// Percy, a small Perseverance that rides along with the page, hanging from a cable like it did under its sky
// crane. Its height on screen follows how far you have scrolled: it climbs down as you scroll down and back up
// as you scroll up, swaying on the cable and turning its wheels.
//  - It says a line every time you arrive in a new part of the page (Meet Mars has one per story stage).
//  - Tap it and it becomes a guide: "Follow me!", it revs, drives ahead, and the page follows it to the next
//    stop. At the end, a tap takes you back to the top. Hovering shows where it will take you.
//  - Between times it does real rover things (spin, wave its arm, look around with its camera head, take a
//    selfie, dance), reacts to what you click, cheers when you scroll fast, tells facts, and naps (mast down).
//
// The pictures are frames rendered from NASA's public-domain Perseverance model (the same one Explore uses),
// using the model's own mast and arm animations: public/rover/perseverance_sprite.webp, made by
// pipeline/render_rover_sprite.py. Per-frame work is written straight to the DOM (no React re-render).
// All the text is in roverLines.ts.

const SPRITE = 'rover/perseverance_sprite.webp';
// Sprite sheet layout (must match pipeline/render_rover_sprite.py): 8 columns of 288x162 frames.
const CELL_W = 288, CELL_H = 162, COLS = 8, SHEET_W = 2304, SHEET_H = 1296;
const HOOK_X = 164.9, HOOK_Y = 60.2;                   // the cable's hook point (deck centre) inside every frame
const BOX = { x0: 69, y0: 17, x1: 250, y1: 154 };      // the rover itself inside a frame (tap target, edges)
const CAMERA = { x: 66, y: 50 };                       // the arm's camera turret when the arm is raised (selfie flash)
const F = { spin: 0, drive: 24, mast: 30, arm: 38, pan: 48 } as const;
const N = { spin: 24, drive: 6, mast: 8, arm: 10, pan: 9 } as const;
// mast frames go stowed -> up; arm frames stowed -> raised; pan frames -60°..+60° in 15° steps (+60° faces you)

type Act = '' | 'twirl' | 'wave' | 'look' | 'hop' | 'wiggle' | 'dance' | 'selfie' | 'rev';
type Trick = Exclude<Act, ''>;
const ACT_MS: Record<Trick, number> = { twirl: 1300, wave: 2400, look: 2600, hop: 900, wiggle: 900, dance: 2000, selfie: 2600, rev: 550 };
const IDLE_ACTS: Trick[] = ['twirl', 'wave', 'look', 'dance', 'selfie', 'hop', 'wiggle', 'look', 'wave', 'dance'];

// Tour stops. Meet Mars is one long scroll story, so it gets a stop per stage (p = progress through it):
// [key, p to scroll to, p where the stage starts]. Stage timings follow MeetMars.tsx.
const MEET_STOPS: [AreaKey, number, number][] = [['meet0', 0, 0], ['meet1', 0.5, 0.35], ['meet2', 0.74, 0.51], ['meet3', 0.96, 0.76]];
const SECTION_STOPS: AreaKey[] = ['trails', 'explore', 'score', 'boots'];
type Stop = { key: AreaKey; go: number; enter: number };

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const px = (n: number) => `calc(${n}px * var(--s))`;

/** Arm frame (0 = stowed, 9 = raised) during a wave: raise, wave twice, lower. */
const waveFrame = (u: number) => {
  if (u < 0.3) return ease(u / 0.3) * 9;
  if (u < 0.75) return 9 - 3 * (0.5 - 0.5 * Math.cos(((u - 0.3) / 0.45) * Math.PI * 4));
  return (1 - ease((u - 0.75) / 0.25)) * 9;
};
/** Arm frame during a selfie: raise, hold still for the photo, lower. */
const selfieFrame = (u: number) => (u < 0.3 ? ease(u / 0.3) * 9 : u < 0.75 ? 9 : (1 - ease((u - 0.75) / 0.25)) * 9);
/** Head pan in degrees during a look-around: ahead, hold, round to you, hold, back. */
const lookPan = (u: number) => {
  if (u < 0.2) return lerp(0, -60, ease(u / 0.2));
  if (u < 0.4) return -60;
  if (u < 0.65) return lerp(-60, 60, ease((u - 0.4) / 0.25));
  if (u < 0.85) return 60;
  return lerp(60, 0, ease((u - 0.85) / 0.15));
};
/** Turn (degrees) during a dance: wiggling left and right. */
const danceYaw = (u: number) => 45 * Math.sin(u * Math.PI * 6) * (1 - u * 0.3);

/** Hands out lines from a list in turn, starting at a random spot, so they never repeat back to back. */
function cycler() {
  const at = new Map<string[], number>();
  return (list: string[]) => {
    const i = at.get(list) ?? Math.floor(Math.random() * list.length);
    at.set(list, i + 1);
    return list[i % list.length];
  };
}

/** Where each stop is right now (page heights change as things load, so this is measured when needed). */
function measureStops(): Stop[] {
  const H = window.innerHeight, y0 = window.scrollY;
  const top = (id: string) => { const el = document.getElementById(id); return el ? el.getBoundingClientRect().top + y0 : null; };
  const out: Stop[] = [{ key: 'top', go: 0, enter: -Infinity }];
  const meet = document.getElementById('meet');
  const mt = top('meet');
  if (meet && mt !== null) {
    const span = meet.offsetHeight - H;
    for (const [key, goP, enterP] of MEET_STOPS) out.push({ key, go: mt + goP * span, enter: key === 'meet0' ? mt - H * 0.4 : mt + enterP * span });
  }
  for (const key of SECTION_STOPS) { const t = top(key); if (t !== null) out.push({ key, go: t, enter: t - H * 0.4 }); }
  return out;
}

type Bit = { id: number; x: number; y: number; dx: number; ch: string; cls: string };

export default function ScrollRover() {
  const [ready, setReady] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const swing = useRef<HTMLDivElement>(null);
  const cable = useRef<HTMLDivElement>(null);
  const sprite = useRef<HTMLDivElement>(null);

  const [act, setAct] = useState<Act>('');
  const [say, setSay] = useState<string | null>(null);
  const [sayOut, setSayOut] = useState(false);          // the bubble is fading away
  const [sleep, setSleep] = useState(false);
  const [tag, setTag] = useState<string | null>(null);
  const [bits, setBits] = useState<Bit[]>([]);

  // shared with the animation loop and event handlers
  const st = useRef({
    act: '' as Act, actStart: 0, actTimer: 0,
    sleep: false, hover: false,
    talking: false, sayTimer: 0, lastTalk: 0,
    tapped: false, hints: 0, bitId: 0,
    guide: null as null | { target: number; dir: 1 | -1; key: AreaKey; start: number; scrolled: boolean },
    spoken: '' as AreaKey | '',
    next: cycler(),
  });

  // Load the frames once the page itself is up, so the rover never competes with the hero.
  useEffect(() => {
    let alive = true;
    const go = () => { const img = new Image(); img.onload = () => alive && setReady(true); img.src = SPRITE; };
    const t = window.setTimeout(go, document.readyState === 'complete' ? 600 : 1500);
    return () => { alive = false; window.clearTimeout(t); };
  }, []);

  const play = (a: Trick, force = false) => {
    const s = st.current;
    if (s.act && !force) return;
    window.clearTimeout(s.actTimer);
    s.act = a; s.actStart = performance.now(); setAct(a);
    s.actTimer = window.setTimeout(() => { s.act = ''; setAct(''); }, ACT_MS[a]);
  };
  /** Say something. Chit-chat ("low") waits its turn; important lines (arrivals, the tour) always speak. */
  const talk = (text: string, low = false) => {
    const s = st.current, now = performance.now();
    if (low && (s.talking || now - s.lastTalk < 2500)) return false;
    window.clearTimeout(s.sayTimer);
    setSay(text); setSayOut(false); s.talking = true; s.lastTalk = now;
    s.sayTimer = window.setTimeout(() => {
      setSayOut(true); s.talking = false;                  // fade out first, then remove
      s.sayTimer = window.setTimeout(() => setSay(null), 450);
    }, clamp(1800 + text.length * 55, 2800, 5600));
    return true;
  };
  /** Little hearts or sparkles popping off the rover. */
  const pop = (n: number, kind: 'heart' | 'spark') => {
    const s = st.current;
    const add: Bit[] = Array.from({ length: n }, () => ({
      id: ++s.bitId, x: -55 + Math.random() * 60, y: -30 + Math.random() * 20, dx: -20 + Math.random() * 30,
      ch: kind === 'heart' ? '♥' : '✦', cls: kind,
    }));
    setBits((b) => [...b, ...add]);
    window.setTimeout(() => setBits((b) => b.filter((x) => !add.includes(x))), 1300);
  };

  /** Where a tap would take you right now. */
  const nextStop = () => {
    const stops = measureStops();
    const maxY = document.documentElement.scrollHeight - window.innerHeight;
    const nxt = stops.find((x) => x.go > window.scrollY + 40 && x.go <= maxY + 40);
    return nxt ? { ...nxt, go: Math.min(nxt.go, maxY) } : null;
  };

  const onTap = () => {
    const s = st.current;
    s.tapped = true;
    if (s.sleep) { s.sleep = false; setSleep(false); }
    pop(4, 'heart');
    if (s.guide) return;                                   // already on the way
    const nxt = nextStop();
    if (nxt) {
      talk(s.next(L.FOLLOW).replace('{next}', L.AREA_LABEL[nxt.key]));
      s.guide = { target: nxt.go, dir: 1, key: nxt.key, start: performance.now(), scrolled: false };
    } else {
      talk(s.next(L.BACK_TO_TOP));
      s.guide = { target: 0, dir: -1, key: 'top', start: performance.now(), scrolled: false };
    }
    play('rev', true);
    setTag(null);
  };
  const onEnter = () => {
    const s = st.current;
    s.hover = true;
    const nxt = nextStop();
    setTag(nxt ? `Follow me → ${L.AREA_LABEL[nxt.key]}` : 'Back to the top ↑');
    if (!s.guide && Math.random() < 0.35 && talk(s.next(L.HELLO), true)) { pop(2, 'heart'); play('hop'); }
  };
  const onLeave = () => { st.current.hover = false; setTag(null); };

  useEffect(() => {
    if (!ready) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const s = st.current;
    let raf = 0;
    let last = performance.now();
    let y = -160;                   // drops in from above the screen...
    let mast = reduce ? 1 : 0;      // ...with its mast still stowed, like a real landing (0 = stowed, 1 = up)
    let ang = 0, angV = 0, wheel = 0, pan = 0, lead = 0;
    let mouseX: number | null = null;
    let lastMove = performance.now(), lastFact = performance.now();
    let nextIdle = performance.now() + 4000;
    let scale = 0.5, max = 1, frame = -1;
    let vw = window.innerWidth, vh = window.innerHeight;
    let lastScrollY = window.scrollY, pageVel = 0, fastCool = 0, reactCool = 0;
    let area: AreaKey | '' = '', areaSince = 0, areaCheck = 0;
    const born = performance.now();

    const show = (i: number) => {
      if (i === frame || !sprite.current) return;
      frame = i;
      const c = i % COLS, r = Math.floor(i / COLS);
      sprite.current.style.backgroundPosition = `${-c * CELL_W * scale}px ${-r * CELL_H * scale}px`;
    };
    const measure = () => {
      // Lay out from the visible screen size, not innerWidth/innerHeight or 100vh: on phones, content that
      // overflows sideways makes the browser zoom out a little, and those grow past what is on screen.
      vw = document.documentElement.clientWidth;
      vh = document.documentElement.clientHeight;
      const next = vw < 760 ? 0.36 : 0.52;
      if (next !== scale) { scale = next; frame = -1; }
      root.current?.style.setProperty('--s', String(scale));
      if (root.current) root.current.style.left = `${vw - ((BOX.x1 - HOOK_X) * scale + 10)}px`;
      if (cable.current) cable.current.style.height = `${vh}px`;
      max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    };
    const wake = () => {
      lastMove = performance.now();
      nextIdle = Math.max(nextIdle, lastMove + 2000);
      if (s.sleep) { s.sleep = false; setSleep(false); talk(s.next(L.WAKE)); play('hop', true); }
    };
    const onScroll = () => { max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight); wake(); };
    const onPointer = (e: PointerEvent) => { mouseX = e.clientX; };
    const cancelGuide = () => { if (s.guide?.scrolled) s.guide = null; }; // you took the wheel
    const onKey = () => { wake(); cancelGuide(); };

    // React to what you click on the page.
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (!t || t.closest('.rv')) return;
      const now = performance.now();
      if (now < reactCool) return;
      let line: string | null = null;
      const trail = t.closest('.trailbtn');
      if (trail) line = L.TRAIL[(trail.querySelector('.trailbtn__txt')?.textContent ?? '').trim().toLowerCase()] ?? null;
      else if (t.closest('.chip--mars')) line = s.next(L.PICK_MARS);
      else if (t.closest('.chip--moon')) line = s.next(L.PICK_MOON);
      else if (t.closest('.hero__side, .hero .arrow')) line = s.next(L.SPIN_WORLD);
      else if (t.closest('.field__arrow')) line = s.next(L.PHOTO);
      else if (t.closest('.sensebar__btn')) line = s.next(L.SENSES);
      else if (t.closest('.xworld')) line = s.next(L.WORLD_PICK);
      if (line) { reactCool = now + 3000; talk(line); play(Math.random() < 0.5 ? 'hop' : 'wiggle'); pop(2, 'spark'); }
    };

    measure();
    const remeasure = window.setInterval(measure, 1500); // content (images, 3D) keeps loading and changes the page height
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('wheel', cancelGuide, { passive: true });
    window.addEventListener('touchstart', cancelGuide, { passive: true });
    window.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);

    const tick = (now: number) => {
      const realDt = Math.min(0.5, (now - last) / 1000); // position catches up even on slow frames
      const dt = Math.min(0.05, realDt);                   // physics stays stable
      last = now;
      const H = vh;
      const p = clamp(window.scrollY / max);
      const g = s.guide;

      // the guided tour: rev for a moment, then the page scrolls after the rover; announce the stop on arrival
      if (g) {
        if (!g.scrolled && now - g.start > ACT_MS.rev) {
          g.scrolled = true;
          window.scrollTo({ top: g.target, behavior: reduce ? 'auto' : 'smooth' });
        }
        if (g.scrolled && (Math.abs(window.scrollY - g.target) < 3 || now - g.start > 3500)) {
          s.guide = null;
          s.spoken = g.key; area = g.key;
          talk(s.next(L.AREA[g.key]));
          play('hop', true); pop(3, 'spark');
        }
      }

      // keep clear of the nav and the hero's sound button at the top; wheels stay above the bottom edge
      const yMin = scale < 0.45 ? 135 : 150;
      const yMax = Math.max(yMin, H - (BOX.y1 - HOOK_Y) * scale - 16);
      lead += ((s.guide ? s.guide.dir * 80 : 0) - lead) * (1 - Math.exp(-realDt * 5)); // drives ahead to lead you
      const target = clamp(yMin + p * (yMax - yMin) + lead, yMin - 30, yMax);

      const prev = y;
      y = reduce ? target : y + (target - y) * (1 - Math.exp(-realDt * 7));
      const v = realDt > 0 ? (y - prev) / realDt : 0;
      const moving = Math.abs(target - y) > 0.5;
      if (moving) lastMove = now;

      // how fast the page itself scrolls (for "Wheee!")
      const sv = realDt > 0 ? (window.scrollY - lastScrollY) / realDt : 0;
      lastScrollY = window.scrollY;
      pageVel += (sv - pageVel) * (1 - Math.exp(-dt * 8));
      if (!s.guide && Math.abs(pageVel) > 4500 && now > fastCool && now - born > 3000) {
        fastCool = now + 12000;
        talk(s.next(L.FAST)); pop(2, 'spark');
      }

      // sway: nose dips going down, lifts climbing up, then wobbles to rest; a slow breathing sway on top
      const tgt = reduce ? 0 : clamp(-v * 0.05, -16, 16);
      angV += ((tgt - ang) * 70 - angV * 6.5) * dt;
      ang += angV * dt;
      const breathe = reduce ? 0 : Math.sin(now / 950) * 1.4;

      // mast: deploys after the drop-in, folds down for a nap
      const mastWant = s.sleep || now - born < 1100 ? 0 : 1;
      mast = reduce ? 1 : mast + clamp(mastWant - mast, -dt / 1.1, dt / 0.9);

      // head: looks at you when you hover or it talks; otherwise ahead into the page, turning toward the pointer
      let panWant = -15;
      if (s.hover || s.talking) panWant = 45;
      else if (mouseX !== null) {
        const hx = vw - ((BOX.x1 - HOOK_X) * scale + 10);
        panWant = lerp(45, -30, clamp((hx - mouseX) / 700));
      }
      pan += (panWant - pan) * (1 - Math.exp(-dt * 5));

      // pick the frame: trick > mast moving or stowed > wheels turning > head pan
      const a = s.act, u = a ? clamp((now - s.actStart) / ACT_MS[a]) : 0;
      const spinFrame = (deg: number) => F.spin + ((((Math.round(deg / 15)) % N.spin) + N.spin) % N.spin);
      if (a === 'twirl' && !reduce) show(spinFrame(ease(u) * 360));
      else if (a === 'dance' && !reduce) show(spinFrame(danceYaw(u)));
      else if (a === 'wave' && mast >= 1) show(F.arm + Math.round(waveFrame(u)));
      else if (a === 'selfie' && mast >= 1) show(F.arm + Math.round(selfieFrame(u)));
      else if (a === 'look' && mast >= 1) show(F.pan + Math.round((lookPan(u) + 60) / 15));
      else if (mast < 1) show(F.mast + Math.round(mast * (N.mast - 1)));
      else if (s.guide || (moving && Math.abs(v) > 6 && !reduce)) {
        const rate = s.guide ? 14 * s.guide.dir : clamp(v * 0.06, -14, 14);  // wheel frames per second
        wheel += rate * dt;
        show(F.drive + (((Math.floor(wheel) % N.drive) + N.drive) % N.drive));
      } else show(F.pan + clamp(Math.round((pan + 60) / 15), 0, N.pan - 1));

      if (body.current) body.current.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
      if (cable.current) cable.current.style.transform = `translate3d(0, ${(y - H).toFixed(1)}px, 0)`;
      if (swing.current) swing.current.style.transform = `rotate(${(ang + breathe).toFixed(2)}deg)`;

      // a line every time you arrive somewhere new (once you've stayed a moment, so fast scrolling doesn't spam)
      if (now - born > 2200 && now > areaCheck && !s.guide) {
        areaCheck = now + 200;
        let cur: AreaKey = 'top';
        if (p > 0.995) cur = 'end';
        else for (const x of measureStops()) if (x.enter <= window.scrollY) cur = x.key;
        if (cur !== area) { area = cur; areaSince = now; }
        else if (cur !== s.spoken && now - areaSince > 450) {
          s.spoken = cur;
          talk(s.next(L.AREA[cur]));
          if (cur === 'end') { play('hop', true); pop(4, 'spark'); }
          else if (Math.random() < 0.5) play(Math.random() < 0.5 ? 'wiggle' : 'hop');
        }
      }

      // idle: tricks every few seconds, a hint or a fact now and then, and a nap after a long while
      if (!reduce && !s.guide) {
        const still = now - lastMove;
        if (still > 40000 && !s.sleep && !s.act) { s.sleep = true; setSleep(true); talk('Zzz... charging my batteries.', true); }
        else if (still > 2000 && now > nextIdle && !s.act && !s.sleep && mast >= 1) {
          const trick = IDLE_ACTS[Math.floor(Math.random() * IDLE_ACTS.length)];
          play(trick);
          if (trick === 'selfie') talk(s.next(L.SELFIE), true);
          if (trick === 'dance' && Math.random() < 0.5) talk(s.next(L.DANCE), true);
          nextIdle = now + 3500 + Math.random() * 3500;
        }
        if (!s.sleep && still > 7000 && now - lastFact > 12000) {
          const said = !s.tapped && s.hints < 3 ? talk(s.next(L.HINT), true) : talk(s.next(L.FACTS), true);
          if (said) { lastFact = now; if (!s.tapped) s.hints++; }
        }
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(remeasure);
      window.clearTimeout(s.actTimer);
      window.clearTimeout(s.sayTimer);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('wheel', cancelGuide);
      window.removeEventListener('touchstart', cancelGuide);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
    };
  }, [ready]);

  if (!ready) return null;
  return (
    <div className="rv" ref={root}>
      <div className="rv__cable" ref={cable} />
      <div className="rv__body" ref={body}>
        {say && (
          <div className={`rv__say${sayOut ? ' is-out' : ''}`} key={say} aria-hidden="true" style={{ right: `calc(${HOOK_X - BOX.x0}px * var(--s) + 6px)`, top: px(-48) }}>
            {/* words drift in one after another */}
            {say.split(' ').map((w, i) => <span key={i} className="rv__w" style={{ animationDelay: `${120 + i * 45}ms` }}>{w} </span>)}
          </div>
        )}
        {tag && <div className="rv__tag" style={{ right: px(HOOK_X - BOX.x1), top: `calc(${BOX.y1 - HOOK_Y}px * var(--s) + 8px)` }}>{tag}</div>}
        {bits.map((b) => (
          <i key={b.id} className={`rv__bit rv__bit--${b.cls}`} style={{ left: b.x, top: b.y, ['--dx' as string]: `${b.dx}px` }}>{b.ch}</i>
        ))}
        <div className="rv__swing" ref={swing}>
          <div className={`rv__act${act ? ` is-${act}` : ''}${sleep ? ' is-sleep' : ''}`}>
            <div
              className="rv__sprite"
              ref={sprite}
              style={{
                left: px(-HOOK_X), top: px(-HOOK_Y), width: px(CELL_W), height: px(CELL_H),
                backgroundImage: `url(${SPRITE})`, backgroundSize: `${px(SHEET_W)} ${px(SHEET_H)}`,
              }}
            />
            <i className="rv__flash" style={{ left: px(CAMERA.x - HOOK_X), top: px(CAMERA.y - HOOK_Y) }} />
            <button
              className="rv__btn"
              onClick={onTap}
              onPointerEnter={onEnter}
              onPointerLeave={onLeave}
              aria-label="Percy the rover: take me to the next part"
              style={{ left: px(BOX.x0 - HOOK_X), top: px(BOX.y0 - HOOK_Y), width: px(BOX.x1 - BOX.x0), height: px(BOX.y1 - BOX.y0) }}
            />
            <span className="rv__z" aria-hidden="true" style={{ left: px(-60), top: px(-30) }}><i>z</i><i>z</i><i>z</i></span>
          </div>
        </div>
      </div>
    </div>
  );
}
