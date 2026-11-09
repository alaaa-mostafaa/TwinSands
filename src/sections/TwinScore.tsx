import { useEffect, useMemo, useState } from 'react';
import Radar from '../components/Radar';
import { plain, REGION_NAME, TARGET_NICK } from '../content';
import { useJSON, useTwins, type Ranked, type Site } from '../data';

type Views = { credits: Record<string, string>; have: string[]; dark?: string[] };

/** Places where NASA (or crews working with NASA) really test gear and train, and what they did there. */
const TESTS: Record<string, { name: string; for: 'Mars' | 'Moon'; what: string }> = {
  'earth-atacama-yungay': { name: 'Atacama (Yungay)', for: 'Mars', what: 'NASA’s ARADS project drove a rover with a 1 m drill here (2016–2019), practising the hunt for hidden life in the driest soil on Earth.' },
  'earth-haughton': { name: 'Haughton crater', for: 'Mars', what: 'Since 1997 the NASA Haughton-Mars Project has tested rovers, spacesuits and Mars field routines in this Arctic impact crater on Devon Island.' },
  'earth-death-valley': { name: 'Death Valley', for: 'Mars', what: 'Curiosity’s Earth twin “Scarecrow” practised driving on sand dunes next to Death Valley before the real rover landed in 2012.' },
  'earth-mdrs-hanksville': { name: 'MDRS, Utah', for: 'Mars', what: 'At the Mars Desert Research Station, crews live for weeks in a mock Mars base, wearing suits to go outside. It’s run by the Mars Society, often with NASA scientists.' },
  'earth-dry-valleys': { name: 'McMurdo Dry Valleys', for: 'Mars', what: 'Scientists from NASA’s Viking missions studied these soils in the 1970s; astrobiologists still test life-detection tools here.' },
  'earth-meteor-crater': { name: 'Meteor Crater', for: 'Moon', what: 'Apollo astronauts trained here in the 1960s, learning to read the rocks an impact throws out before reading them on the Moon.' },
  'earth-craters-of-the-moon': { name: 'Craters of the Moon', for: 'Moon', what: 'Apollo 14 astronauts trained on these lava fields in 1969; NASA’s FINESSE team has tested Moon field science here since 2014.' },
  'earth-mauna-kea': { name: 'Mauna Kea', for: 'Moon', what: 'NASA and partners tested robots here in 2008 and 2010 that dig volcanic soil and pull oxygen and water out of it, practice for living off the Moon.' },
};

export function earthLabel(s?: Site) {
  if (!s) return '';
  if (s.kind === 'earth_named') return s.name.replace(/\s*\(.*\)$/, '');
  const ns = s.lat >= 0 ? 'N' : 'S', ew = s.lon >= 0 ? 'E' : 'W';
  return `${REGION_NAME[s.region ?? ''] ?? s.region} · ${Math.abs(s.lat).toFixed(1)}°${ns} ${Math.abs(s.lon).toFixed(1)}°${ew}`;
}

function fmtFeature(k: string, v?: number) {
  if (v == null) return '—';
  if (k === 'local_relief_m') return `${Math.round(v)} m`;
  if (k.startsWith('slope')) return `${v.toFixed(1)}°`;
  if (k === 'roughness_rms_m') return `${v.toFixed(2)} m`;
  return v.toFixed(2);
}

const FEATS: [string, string][] = [['local_relief_m', 'Relief'], ['slope_median_deg', 'Typical slope'], ['slope_p90_deg', 'Steep slopes (90th pct)'], ['roughness_rms_m', 'Roughness'], ['hypsometric_integral', 'Hypsometry']];

/** One place: its real picture (orbiter or satellite), or the height map. Same 12 km square either way. */
function Hill({ site, label, tone, view, views }: { site?: Site; label: string; tone: string; view: 'photo' | 'height'; views?: Views | null }) {
  const has = !!site && !!views?.have.includes(site.id), dark = !!site && !!views?.dark?.includes(site.id);
  const photo = view === 'photo' && has && !dark;
  return (
    <div className={`hill hill--${tone}`}>
      {photo ? <img src={`views/${site!.id}.webp`} alt={`Picture of ${site!.name}`} />
        : site?.hillshade ? <img src={site.hillshade} alt={`Height map of ${site.name}`} /> : <div className="hill__none">No image</div>}
      <span className="hill__tag">{label}</span>
      {view === 'photo' && dark && <span className="hill__note">Real photos here are almost all black: this ground sits in permanent shadow. Showing its height map instead.</span>}
    </div>
  );
}

export default function TwinScore({ target, setTarget }: { target: string; setTarget: (t: string) => void }) {
  const d = useTwins();
  const [pick, setPick] = useState<string | null>(null);
  const [view, setView] = useState<'photo' | 'height'>('photo');
  const views = useJSON<Views>('data/views.json');
  useEffect(() => setPick(null), [target]);

  const earthById = useMemo(() => new Map((d?.earth ?? []).map((e) => [e.id, e])), [d]);
  if (!d) return <section className="score" id="score"><p className="loading">Loading measurements…</p></section>;

  const t = d.targets.find((x) => x.id === target) ?? d.targets[0];
  const r = d.rankings[t.id];
  const list = r.top.slice(0, 12);
  const allRanked: Ranked[] = [...r.top, ...(r.extra ?? [])];
  const chosen = allRanked.find((x) => x.id === pick) ?? list[0];
  const e = earthById.get(chosen.id);
  const rankOf = (id: string) => d.answer_key[t.id]?.[id];
  const mars = d.targets.filter((x) => x.body === 'mars'), moon = d.targets.filter((x) => x.body === 'moon');
  const col = t.body === 'mars' ? 'var(--mars)' : 'var(--moon)';
  const minerals = d.target_minerals[t.id];

  return (
    <section className="score" id="score">
      <header className="chapter-head">
        <h2>Twin Score</h2>
        <p>Pick a place on Mars or the Moon. We compared it with {r.pool} patches of Earth, each 12 km wide, and scored how alike they are out of 100.</p>
      </header>

      <div className="score__targets">
        <div><span className="kicker">1 · Pick a place on Mars</span>{mars.map((x) => <button key={x.id} className={`chip chip--mars${x.id === t.id ? ' is-on' : ''}`} onClick={() => setTarget(x.id)}>{TARGET_NICK[x.id] ?? x.name}</button>)}</div>
        <div><span className="kicker">or the Moon’s south pole</span>{moon.map((x) => <button key={x.id} className={`chip chip--moon${x.id === t.id ? ' is-on' : ''}`} onClick={() => setTarget(x.id)}>{TARGET_NICK[x.id] ?? x.name}</button>)}</div>
      </div>

      <div className="score__grid">
        <div className="score__pair">
          <div className="score__viewtoggle" role="tablist" aria-label="What to show">
            <button role="tab" aria-selected={view === 'photo'} className={view === 'photo' ? 'is-on' : ''} onClick={() => setView('photo')}>Real photos</button>
            <button role="tab" aria-selected={view === 'height'} className={view === 'height' ? 'is-on' : ''} onClick={() => setView('height')}>Height maps</button>
          </div>
          <Hill site={t} label={`${t.body === 'mars' ? 'Mars' : 'Moon'} · ${t.name.replace(/\s*\(.*\)$/, '')}`} tone={t.body} view={view} views={views} />
          <Hill site={e} label={`Earth · ${earthLabel(e)}`} tone="earth" view={view} views={views} />
          <p className="score__pairnote">{view === 'photo'
            ? <>The same 12 km square of each place, seen from orbit. {views && <span className="score__credit">{t.body === 'mars' ? views.credits.mars : views.credits.moon}; {views.credits.earth}.</span>}</>
            : 'Real 3D height maps of both places, same size, lit the same way. This is what the score compares.'}</p>
          <details className="feat__wrap"><summary>See the numbers</summary>
          <table className="feat">
            <thead><tr><th /><th style={{ color: col }}>{t.body}</th><th style={{ color: 'var(--earth)' }}>earth</th></tr></thead>
            <tbody>
              {FEATS.map(([k, l]) => <tr key={k}><td>{l}</td><td>{fmtFeature(k, t.features[k])}</td><td>{fmtFeature(k, e?.features[k])}</td></tr>)}
              <tr><td>Thermal inertia (percentile in its world)</td><td>{t.ti_percentile != null ? `${Math.round(t.ti_percentile)}th` : '—'}</td><td>{e?.ti_percentile != null ? `${Math.round(e.ti_percentile)}th` : '—'}</td></tr>
              {minerals && <tr><td>Key minerals</td><td>{Object.keys(minerals).join(', ')}</td><td>{e?.minerals ? Object.keys(e.minerals.present).map((m) => m.replace('_', ' ')).join(', ') || 'none identified' : 'no EMIT pass'}</td></tr>}
              {t.lunar && <tr><td>Ice-stable area (Diviner model)</td><td>{Math.round((t.lunar.lunar_ice_stable_area_fraction ?? 0) * 100)}%</td><td>n/a</td></tr>}
            </tbody>
          </table>
          <p className="score__pairnote">Height maps: {t.body === 'mars' ? 'MRO CTX' : 'LRO LOLA'} and Copernicus DEM, 30 m grid.</p>
          </details>
        <div className="flatmap"><span className="flatmap__title">Where the top 12 are on Earth</span>
          <img src="tex/earth_base.webp" alt="Earth map" />
          {d.earth_all.map(([id, la, lo]) => (
            <i key={id} className="flatmap__dot" style={{ left: `${((lo + 180) / 360) * 100}%`, top: `${((90 - la) / 180) * 100}%` }} />
          ))}
          {list.map((x, i) => {
            const s = earthById.get(x.id);
            if (!s) return null;
            return (
              <button key={x.id} className={`flatmap__pin${x.id === chosen.id ? ' is-on' : ''}`} style={{ left: `${((s.lon + 180) / 360) * 100}%`, top: `${((90 - s.lat) / 180) * 100}%` }} onClick={() => setPick(x.id)} title={earthLabel(s)}>
                {i + 1}
              </button>
            );
          })}
        </div>
        </div>

        <div className="score__radar">
          <div className="score__big">
            <span className="score__num">{chosen.score.toFixed(0)}</span>
            <span className="score__of">out of 100<br /><em>{earthLabel(e)}</em></span>
          </div>
          <Radar axes={d.axes} labels={plain} ghost={d.unmeasured_axes} series={[{ label: earthLabel(e), color: '#7ec8ff', values: d.axes.map((a) => chosen.axes[a]) }]} />
          <p className="score__explain">Each spoke is one thing we measured. <b>Further out = more alike.</b> A score of 90 on a spoke means this place is closer than 90% of Earth. Grey spokes are next on our list.</p>
        </div>

        <div className="score__listwrap">
        <p className="kicker">2 · Best matches on Earth</p>
        <ol className="score__list">
          {list.map((x, i) => {
            const s = earthById.get(x.id);
            return (
              <li key={x.id}>
                <button className={x.id === chosen.id ? 'is-on' : ''} onClick={() => setPick(x.id)}>
                  <span className="rank">{i + 1}</span>
                  <span className="who">{earthLabel(s)}{s?.kind === 'earth_named' && <sup>known</sup>}</span>
                  <span className="sc">{x.score.toFixed(0)}</span>

                </button>
              </li>
            );
          })}
        </ol>
        </div>
      </div>

      <div className="score__map">
        <div className="answer">
          <h4>Does it find the famous test sites?</h4>
          <p>NASA already trains and tests gear at these places. We never told the scorer, so where do they land out of {r.pool}? Further left = higher on the list. <b>Tap one</b> to see what NASA did there and compare it with your place.</p>
          <ul>
            {Object.entries(TESTS).map(([id, x]) => {
              const rk = rankOf(id), on = chosen.id === id;
              return (
                <li key={id} className={on ? 'is-on' : ''}>
                  <button onClick={() => rk && setPick(id)} disabled={!rk} aria-expanded={on}>
                    <span className="answer__name">{x.name}<small>{x.for} practice</small></span>
                    <span className="answer__bar"><i style={{ left: `${rk ? ((rk - 1) / (r.pool - 1)) * 100 : 0}%` }} /></span>
                    <b>{rk ? `#${rk}` : '—'}</b>
                    <span className="answer__chev" aria-hidden>›</span>
                  </button>
                  {on && <p className="answer__what">{x.what} <em>Our scorer ranks it #{rk} of {r.pool} for this place, and it’s now shown above.</em></p>}
                </li>
              );
            })}
          </ul>
          {t.body === 'moon' && <p className="answer__read">For the lunar south pole, the scorer independently puts Mauna Kea (where NASA tested lunar resource extraction) and the Dry Valleys region near the top.</p>}
        </div>
      </div>
      <details className="method">
        <summary>How the score works (for the curious)</summary>
        <pre>{d.method}</pre>
        <p>{d.source}.</p>
      </details>
    </section>
  );
}
