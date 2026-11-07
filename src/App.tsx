import { useEffect, useState } from 'react';
import type { WorldId } from './content';
import { Boots, Footer } from './sections/Boots';
import FieldGuides from './sections/FieldGuides';
import Hero from './sections/Hero';
import MeetMars from './sections/MeetMars';
import Neighborhoods from './sections/Neighborhoods';
import Trails from './sections/Trails';
import TwinScore from './sections/TwinScore';

const NAV = [
  ['meet', 'Meet Mars'], ['trails', 'Twin Trails'], ['hoods', 'Neighborhoods'], ['score', 'Twin Score'], ['guides', 'Field Guides'], ['boots', 'Our Trip'],
] as const;

const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

export default function App() {
  const [target, setTarget] = useState('mars-gale');
  const [hoodWorld, setHoodWorld] = useState<'mars' | 'moon'>('mars');
  const [active, setActive] = useState('top');
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const on = () => {
      setScrolled(window.scrollY > 40);
      let cur = 'top';
      for (const [id] of NAV) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.4) cur = id;
      }
      setActive(cur);
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  const score = (t: string) => { setTarget(t); go('score'); };
  const explore = (w: WorldId) => {
    if (w === 'earth') return go('meet');
    setHoodWorld(w);
    go('hoods');
  };

  return (
    <>
      <nav className={`nav${scrolled ? ' is-solid' : ''}${menu ? ' is-open' : ''}`}>
        <button className="brand" onClick={() => { go('top'); setMenu(false); }} aria-label="Twin Sands, back to top">
          <span className="brand__dot" /><span>Twin<br />Sands</span>
        </button>
        <ul className="nav__links">
          {NAV.map(([id, label]) => (
            <li key={id}><button className={active === id ? 'is-on' : ''} onClick={() => { go(id); setMenu(false); }}>{label}</button></li>
          ))}
        </ul>
        <button className="nav__menu" onClick={() => setMenu((m) => !m)} aria-label="Menu"><i /><i /><i /></button>
      </nav>
      <main>
        <Hero onExplore={explore} />
        <MeetMars />
        <Trails onScore={score} />
        <Neighborhoods world={hoodWorld} setWorld={setHoodWorld} onScore={score} />
        <TwinScore target={target} setTarget={setTarget} />
        <FieldGuides onScore={score} />
        <Boots />
      </main>
      <Footer />
    </>
  );
}
