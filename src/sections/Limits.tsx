// "What Earth can't copy": the honest frame for every twin on this site.
// Sources: NASA planetary fact sheets (gravity, pressure, day length);
// Hassler et al. 2014, Science (Curiosity RAD: ~0.67 mSv/day on Mars' surface);
// Zhang et al. 2020, Science Advances (Chang'e 4 LND: ~1.37 mSv/day on the lunar surface);
// UNSCEAR (world-average natural background ~2.4 mSv/year ≈ 0.0066 mSv/day).
const ROWS = [
  { k: 'Gravity', unit: 'of Earth’s', earth: 1, mars: 0.38, moon: 0.165, fmt: (v: number) => `${Math.round(v * 100)}%`, note: 'A 70 kg astronaut weighs like 27 kg on Mars and 12 kg on the Moon.' },
  { k: 'Air pressure', unit: 'of Earth’s', earth: 1, mars: 0.006, moon: 0, fmt: (v: number) => (v === 0 ? '≈ 0' : v < 0.01 ? `${(v * 100).toFixed(1)}%` : `${Math.round(v * 100)}%`), note: 'Water boils away on Mars at body temperature. On the Moon there is no air at all.' },
  { k: 'Surface radiation', unit: '× Earth’s', earth: 1, mars: 100, moon: 200, fmt: (v: number) => (v === 1 ? '1×' : `~${v}×`), note: 'Mars ≈ 0.67 mSv a day (Curiosity), Moon ≈ 1.37 mSv a day (Chang’e 4), Earth ≈ 0.007.' },
  { k: 'Length of day', unit: '', earth: 1, mars: 1.03, moon: 29.5, fmt: (v: number) => (v === 1 ? '24 h' : v < 2 ? '24 h 40 min' : '29.5 days'), note: 'A Moon “day” is two weeks of sunlight, then two weeks of night (except on the polar ridges).' },
];

export default function Limits() {
  return (
    <section className="limits" id="limits">
      <div className="limits__intro">
        <p className="kicker">Before we pick twins</p>
        <h2>What Earth can’t copy</h2>
        <p>No place on Earth is a perfect stand-in. Every twin on this site lists where the analogy breaks, and these four always break.</p>
      </div>
      <div className="limits__grid">
        {ROWS.map((r) => {
          const max = Math.max(r.earth, r.mars, r.moon);
          const scale = (v: number) => (r.k === 'Surface radiation' || r.k === 'Length of day' ? Math.log10(1 + v * 9) / Math.log10(1 + max * 9) : v / max);
          return (
            <div className="limit" key={r.k}>
              <h4>{r.k}</h4>
              {(['earth', 'mars', 'moon'] as const).map((w) => (
                <div className={`limit__row limit__row--${w}`} key={w}>
                  <span>{w}</span>
                  <span className="limit__bar"><i style={{ width: `${Math.max(1.5, scale(r[w]) * 100)}%` }} /></span>
                  <b>{r.fmt(r[w])}</b>
                </div>
              ))}
              <p>{r.note}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
