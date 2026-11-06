type Series = { label: string; color: string; values: (number | null)[] };

/** Radar of closeness (0–100) per axis. Null values are drawn hollow; ghost axes are "not measured yet". */
export default function Radar({ axes, ghost = [], series, size = 420, labels = (a: string) => a }: { axes: string[]; ghost?: string[]; series: Series[]; size?: number; labels?: (a: string) => string }) {
  const all = [...axes, ...ghost];
  const V = 400; // fixed drawing space; `size` only caps the rendered width so labels stay proportional
  const n = all.length, c = V / 2, R = V / 2 - 78;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [c + Math.cos(a) * R * (v / 100), c + Math.sin(a) * R * (v / 100)] as const;
  };
  return (
    <svg className="radar" viewBox={`0 0 ${V} ${V}`} style={{ maxWidth: size }} role="img" aria-label="Twin Score radar chart">
      {[25, 50, 75, 100].map((r) => (
        <polygon key={r} points={all.map((_, i) => pt(i, r).join(',')).join(' ')} className={`radar__ring${r === 50 ? ' radar__ring--mid' : ''}`} />
      ))}
      {all.map((a, i) => {
        const [x, y] = pt(i, 100);
        const [lx, ly] = pt(i, 116);
        const isGhost = i >= axes.length;
        return (
          <g key={a} className={isGhost ? 'radar__ghost' : ''}>
            <line x1={c} y1={c} x2={x} y2={y} className="radar__spoke" />
            <text x={lx} y={ly} textAnchor={Math.abs(lx - c) < 8 ? 'middle' : lx > c ? 'start' : 'end'} dominantBaseline="middle" className="radar__label">
              {labels(a)}{isGhost && <tspan x={lx} dy="1.2em" className="radar__sub">coming soon</tspan>}
            </text>
          </g>
        );
      })}
      {series.map((s) => (
        <g key={s.label}>
          <polygon points={s.values.map((v, i) => pt(i, v ?? 50).join(',')).join(' ')} fill={s.color} fillOpacity={0.16} stroke={s.color} strokeWidth={1.8} strokeLinejoin="round" />
          {s.values.map((v, i) => {
            const [x, y] = pt(i, v ?? 50);
            return <circle key={i} cx={x} cy={y} r={v == null ? 3.5 : 3.2} fill={v == null ? '#050507' : s.color} stroke={s.color} strokeWidth={1.5} />;
          })}
        </g>
      ))}
    </svg>
  );
}
