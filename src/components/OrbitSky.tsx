import { useMemo } from 'react';

/* Twin Score background, drawn in code: dotted orbit paths around a warm glowing sun, a few long sweeping
   orbits coming in from off-screen, small planets slowly travelling along them, and a fine star field.
   Same cream and peach as the poster landing. It sits behind the content and stays in view while you scroll. */

function rand(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const ellipse = (rx: number, ry: number) => `M ${-rx} 0 a ${rx} ${ry} 0 1 0 ${2 * rx} 0 a ${rx} ${ry} 0 1 0 ${-2 * rx} 0`;

const SUN = { x: 1330, y: 190 };

export default function OrbitSky() {
  const art = useMemo(() => {
    const r = rand(42);
    const stars = Array.from({ length: 380 }, () => ({ x: r() * 1600, y: r() * 1000, s: 0.4 + r() ** 4 * 1.8, o: 0.2 + r() * 0.6 }));
    // orbits around the sun: close ones nearly round, far ones tilted and stretched
    const orbits = [70, 115, 165, 230, 310, 410, 530, 680].map((rx, i) => ({
      rx, ry: rx * (0.62 + r() * 0.2), rot: -28 + r() * 40, dx: (r() - 0.5) * rx * 0.12, dy: (r() - 0.5) * rx * 0.1,
      o: 0.75 - i * 0.05, planet: i !== 2 && i !== 6, size: 2.6 + r() * 3.4, dur: 14 * Math.pow(rx / 100, 1.5), start: r(),
    }));
    // long sweeping orbits that enter from outside the frame, like comets
    const sweeps = [
      { cx: 1280, cy: 1080, rx: 1150, ry: 700, rot: -18 },
      { cx: 1500, cy: 900, rx: 1300, ry: 520, rot: -32 },
      { cx: 700, cy: 1200, rx: 1400, ry: 900, rot: -8 },
      { cx: 1650, cy: 300, rx: 900, ry: 980, rot: 12 },
    ].map((s, i) => ({ ...s, o: 0.32 - i * 0.04, dur: 120 + i * 40, start: r() }));
    return { stars, orbits, sweeps };
  }, []);

  return (
    <div className="orbits" aria-hidden>
      <div className="orbits__pin">
        <svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
          <defs>
            <radialGradient id="orbSun"><stop offset="0" stopColor="#fff8ea" /><stop offset=".18" stopColor="#ffe2b8" /><stop offset=".45" stopColor="#f0a868" stopOpacity=".35" /><stop offset="1" stopColor="#e08a50" stopOpacity="0" /></radialGradient>
            <radialGradient id="orbPlanet"><stop offset="0" stopColor="#fffaf0" /><stop offset=".5" stopColor="#ffe6c4" /><stop offset="1" stopColor="#f0b07a" stopOpacity="0" /></radialGradient>
          </defs>
          {art.stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#f3ead8" opacity={s.o} />)}

          {art.sweeps.map((s, i) => {
            const d = ellipse(s.rx, s.ry);
            return (
              <g key={'w' + i} transform={`translate(${s.cx} ${s.cy}) rotate(${s.rot})`}>
                <path d={d} className="orbits__path" style={{ opacity: s.o }} />
                <circle r="3.2" fill="url(#orbPlanet)" className="orbits__planet">
                  <animateMotion dur={`${s.dur}s`} repeatCount="indefinite" path={d} begin={`-${s.start * s.dur}s`} />
                </circle>
              </g>
            );
          })}

          <g transform={`translate(${SUN.x} ${SUN.y})`}>
            {art.orbits.map((o, i) => {
              const d = ellipse(o.rx, o.ry);
              return (
                <g key={'o' + i} transform={`translate(${o.dx} ${o.dy}) rotate(${o.rot})`}>
                  <path d={d} className="orbits__path" style={{ opacity: o.o }} />
                  {o.planet && (
                    <circle r={o.size * 2.2} fill="url(#orbPlanet)" className="orbits__planet">
                      <animateMotion dur={`${o.dur}s`} repeatCount="indefinite" path={d} begin={`-${o.start * o.dur}s`} />
                    </circle>
                  )}
                </g>
              );
            })}
            <circle r="70" fill="url(#orbSun)" className="orbits__sun" />
            <circle r="9" fill="#fff8ea" />
          </g>
        </svg>
      </div>
    </div>
  );
}
