import { useEffect, useMemo, useState } from 'react';
import Radar from '../components/Radar';
import { REGION_NAME, TARGET_NICK } from '../content';
import { useTwins, type Ranked, type Site } from '../data';

const ANSWER_NAMES: Record<string, string> = {
  'earth-atacama-yungay': 'Atacama (Yungay)', 'earth-haughton': 'Haughton crater', 'earth-death-valley': 'Death Valley',
  'earth-mdrs-hanksville': 'MDRS, Utah', 'earth-dry-valleys': 'McMurdo Dry Valleys', 'earth-meteor-crater': 'Meteor Crater',
  'earth-craters-of-the-moon': 'Craters of the Moon', 'earth-mauna-kea': 'Mauna Kea',
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

function Hill({ site, label, tone }: { site?: Site; label: string; tone: string }) {
  return (
    <div className={`hill hill--${tone}`}>
      {site?.hillshade ? <img src={site.hillshade} alt={`Hillshade of ${site.name}`} /> : <div className="hill__none">No hillshade</div>}
      <span className="hill__tag">{label}</span>
    </div>
  );
}

export default function TwinScore({ target, setTarget }: { target: string; setTarget: (t: string) => void }) {
  const d = useTwins();
  const [pick, setPick] = useState<string | null>(null);
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
        <span className="chapter-num">03</span>
        <h2>Twin Score</h2>
        <p>We measured {r.pool} windows of Earth, each 12 km across on the same 30 m grid as the Mars and Moon sites, and asked which ones come closest on every axis we can measure.</p>
      </header>

      <div className="score__targets">
        <div><span className="kicker">Mars</span>{mars.map((x) => <button key={x.id} className={`chip chip--mars${x.id === t.id ? ' is-on' : ''}`} onClick={() => setTarget(x.id)}>{TARGET_NICK[x.id] ?? x.name}</button>)}</div>
        <div><span className="kicker">Moon south pole</span>{moon.map((x) => <button key={x.id} className={`chip chip--moon${x.id === t.id ? ' is-on' : ''}`} onClick={() => setTarget(x.id)}>{TARGET_NICK[x.id] ?? x.name}</button>)}</div>
      </div>

      <div className="score__grid">
        <div className="score__pair">
          <Hill site={t} label={`${t.body === 'mars' ? 'Mars' : 'Moon'} · ${t.name.replace(/\s*\(.*\)$/, '')}`} tone={t.body} />
          <Hill site={e} label={`Earth · ${earthLabel(e)}`} tone="earth" />
          <p className="score__pairnote">Same 12 × 12 km window, same 30 m grid, light from the same direction. Real elevation models: {t.body === 'mars' ? 'MRO CTX' : 'LRO LOLA'} and Copernicus DEM.</p>
          <table className="feat">
            <thead><tr><th /><th style={{ color: col }}>{t.body}</th><th style={{ color: 'var(--earth)' }}>earth</th></tr></thead>
            <tbody>
              {FEATS.map(([k, l]) => <tr key={k}><td>{l}</td><td>{fmtFeature(k, t.features[k])}</td><td>{fmtFeature(k, e?.features[k])}</td></tr>)}
              <tr><td>Thermal inertia (percentile in its world)</td><td>{t.ti_percentile != null ? `${Math.round(t.ti_percentile)}th` : '—'}</td><td>{e?.ti_percentile != null ? `${Math.round(e.ti_percentile)}th` : '—'}</td></tr>
              {minerals && <tr><td>Key minerals</td><td>{Object.keys(minerals).join(', ')}</td><td>{e?.minerals ? Object.keys(e.minerals.present).map((m) => m.replace('_', ' ')).join(', ') || 'none identified' : 'no EMIT pass'}</td></tr>}
              {t.lunar && <tr><td>Ice-stable area (Diviner model)</td><td>{Math.round((t.lunar.lunar_ice_stable_area_fraction ?? 0) * 100)}%</td><td>n/a</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="score__radar">
          <div className="score__big">
            <span className="score__num">{chosen.score.toFixed(0)}</span>
            <span className="score__of">Twin Score<br /><em>{chosen.n_axes} of {d.axes.length} axes measured</em></span>
          </div>
          <Radar axes={d.axes} ghost={d.unmeasured_axes} series={[{ label: earthLabel(e), color: '#7ec8ff', values: d.axes.map((a) => chosen.axes[a]) }]} />
          <p className="score__explain">Each axis: how many Earth windows this one beats. <b>96</b> on Relief means its relief is closer to the target’s than 96% of all {r.pool} windows. Hollow dots were not measured for this pair and count as 50 (the middle). Dust, ice and sunlight are next.</p>
        </div>

        <ol className="score__list">
          {list.map((x, i) => {
            const s = earthById.get(x.id);
            return (
              <li key={x.id}>
                <button className={x.id === chosen.id ? 'is-on' : ''} onClick={() => setPick(x.id)}>
                  <span className="rank">{i + 1}</span>
                  <span className="who">{earthLabel(s)}{s?.kind === 'earth_named' && <sup>known</sup>}</span>
                  <span className="sc">{x.score.toFixed(0)}</span>
                  <span className="ax">{x.n_axes}/7</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="score__map">
        <div className="flatmap">
          <img src="tex/earth_base.jpg" alt="Earth map" />
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
        <div className="answer">
          <h4>Answer key: does it find the famous analogs?</h4>
          <p>Known analog sites are ranked like any other window, out of {r.pool}. A good method should not need to be told where they are.</p>
          <ul>
            {Object.keys(ANSWER_NAMES).map((id) => {
              const rk = rankOf(id);
              return (
                <li key={id}>
                  <button onClick={() => rk && setPick(id)} disabled={!rk}>
                    <span>{ANSWER_NAMES[id]}</span>
                    <span className="answer__bar"><i style={{ left: `${rk ? ((rk - 1) / (r.pool - 1)) * 100 : 0}%` }} /></span>
                    <b>{rk ? `#${rk}` : '—'}</b>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="answer__read">{t.body === 'moon'
            ? 'For the lunar south pole, the scorer independently puts Mauna Kea (where NASA tested lunar resource extraction) and the Dry Valleys region near the top.'
            : 'For Mars, the classic analogs land mid-pack: they earned their fame through chemistry, climate and life, not 12 km landform shape. That is why we score more than terrain.'}</p>
        </div>
      </div>
      <details className="method">
        <summary>How the score works, exactly</summary>
        <pre>{d.method}</pre>
        <p>{d.source}.</p>
      </details>
    </section>
  );
}
