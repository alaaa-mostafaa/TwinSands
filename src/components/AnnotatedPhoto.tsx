import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { Mark } from '../content';

/** A photo that fills its box (like object-fit: cover) with rings, rulers and labels drawn on top.
 *  Marks use the photo's own pixel coordinates and are mapped through the same cover crop. */
export default function AnnotatedPhoto({ src, w, h, marks, line, credit, pad = 96, contain = false }: {
  src: string; w: number; h: number; marks: Mark[]; line?: string; credit?: React.ReactNode; pad?: number; contain?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ cw: 0, ch: 0 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ cw: e.contentRect.width, ch: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { cw, ch } = size;
  const s = contain ? Math.min(cw / w, ch / h) : Math.max(cw / w, ch / h);
  const ox = (cw - w * s) / 2, oy = (ch - h * s) / 2;
  const P = (x: number, y: number) => [ox + x * s, oy + y * s] as const;
  // Place each ring's label beside it, on whichever side has room, above the caption strip.
  const BOTTOM = pad;
  const labelAt = (m: Extract<Mark, { t: 'ring' }>) => {
    const [x, y] = P(m.x, m.y), r = m.r * s;
    const est = Math.max(m.label.length * 7.4, (m.sub ?? '').length * 7.2) + 24;
    let right = x < cw / 2;
    let lx = right ? x + r + 22 : x - r - 22;
    if (right && lx + est > cw - 8) { right = false; lx = x - r - 22; }
    if (!right && lx - est < 8) { right = true; lx = x + r + 22; }
    lx = right ? Math.min(lx, cw - est - 8) : Math.max(lx, est + 8);
    const ly = Math.min(ch - BOTTOM, Math.max(26, y - r * 0.55));
    return { x, y, r, lx, ly, right };
  };

  return (
    <div ref={box} className="aphoto">
      <img src={src} alt="" style={contain ? { objectFit: 'contain' } : undefined} />
      <div className="aphoto__shade" />
      {cw > 0 && (
        <>
          <svg className="aphoto__svg" width={cw} height={ch}>
            {marks.map((m, i) => {
              const d = 0.25 + i * 0.25;
              if (m.t === 'ruler') {
                const [x1, y1] = P(m.x1, m.y1), [x2, y2] = P(m.x2, m.y2);
                return (
                  <g key={i} className="aphoto__ruler">
                    <motion.line x1={x1} y1={y1} x2={x2} y2={y2} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: d }} />
                    {[[x1, y1], [x2, y2]].map(([x, y], k) => <motion.circle key={k} cx={x} cy={y} r={4} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: d + 0.4 }} />)}
                  </g>
                );
              }
              const { x, y, r, lx, ly } = labelAt(m);
              // leader line starts on the ring edge, heading to the label
              const ang = Math.atan2(ly - y, lx - x);
              return (
                <g key={i} className="aphoto__mark">
                  <motion.circle cx={x} cy={y} r={r} initial={{ pathLength: 0, rotate: -90 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: d }} />
                  <motion.line x1={x + Math.cos(ang) * r} y1={y + Math.sin(ang) * r} x2={lx} y2={ly} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35, delay: d + 0.45 }} />
                </g>
              );
            })}
          </svg>
          {marks.map((m, i) => {
            const d = 0.25 + i * 0.25;
            if (m.t === 'ruler') {
              const [x1, y1] = P(m.x1, m.y1), [x2] = P(m.x2, m.y2);
              return <motion.span key={i} className="aphoto__label aphoto__label--ruler" style={{ left: (x1 + x2) / 2, top: y1 }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: d + 0.5 }}>{m.label}</motion.span>;
            }
            const { lx, ly, right } = labelAt(m);
            return (
              <motion.span key={i} className={`aphoto__label ${right ? 'is-right' : 'is-left'}`} style={{ left: lx, top: ly }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: d + 0.75 }}>
                <b>{m.label}</b>{m.sub && <em>{m.sub}</em>}
              </motion.span>
            );
          })}
        </>
      )}
      {line && <motion.p className="aphoto__line" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>{line}</motion.p>}
      {credit && <span className="aphoto__credit">{credit}</span>}
    </div>
  );
}
