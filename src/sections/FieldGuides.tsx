import Radar from '../components/Radar';
import { GUIDES } from '../content';
import { usePhotos, useTwins } from '../data';

export default function FieldGuides({ onScore }: { onScore: (t: string) => void }) {
  const photos = usePhotos();
  const d = useTwins();
  return (
    <section className="guides" id="guides">
      <header className="chapter-head">
        <span className="chapter-num">05</span>
        <h2>Field Guides</h2>
        <p>For every twin: what matches, what doesn’t, and what a crew could practise there. Places marked <span className="badge">new</span> have little or no planetary-analog research yet.</p>
      </header>
      <div className="guides__grid">
        {GUIDES.map((g) => {
          const ranked = g.dataTarget && d ? [...d.rankings[g.dataTarget].top, ...(d.rankings[g.dataTarget].extra ?? [])].find((x) => x.id === g.dataEarth) : null;
          const target = g.dataTarget && d ? d.targets.find((x) => x.id === g.dataTarget) : null;
          const earth = g.dataEarth && d ? d.earth.find((x) => x.id === g.dataEarth) : null;
          return (
            <article key={g.place} className="guide">
              <header>
                <span className="guide__theme">{g.theme}</span>
                {g.isNew && <span className="badge">new</span>}
                <h3>{g.place}</h3>
                <p className="guide__where">{g.country} · {g.at[0].toFixed(2)}°, {g.at[1].toFixed(2)}°</p>
                <p className="guide__twin">Twin of <b>{g.twinOf}</b></p>
              </header>
              {g.photo && photos?.[g.photo] && <img className="guide__img" src={`photos/${g.photo}.jpg`} alt={photos[g.photo].title} loading="lazy" />}
              {ranked && target && earth && (
                <div className="guide__data">
                  <div className="guide__hills">
                    {target.hillshade && <img src={target.hillshade} alt="target hillshade" />}
                    {earth.hillshade && <img src={earth.hillshade} alt="earth hillshade" />}
                  </div>
                  <Radar size={300} axes={d!.axes} series={[{ label: g.place, color: '#7ec8ff', values: d!.axes.map((a) => ranked.axes[a]) }]} />
                  <button className="link" onClick={() => onScore(g.dataTarget!)}>Twin Score {ranked.score.toFixed(0)} · {ranked.n_axes}/7 axes →</button>
                </div>
              )}
              <div className="guide__cols">
                <div><h4 className="ok">Matches</h4><ul>{g.matches.map((m) => <li key={m}>{m}</li>)}</ul></div>
                <div><h4 className="no">Doesn’t</h4><ul>{g.differs.map((m) => <li key={m}>{m}</li>)}</ul></div>
                <div><h4 className="go">Practise here</h4><ul>{g.practise.map((m) => <li key={m}>{m}</li>)}</ul></div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
