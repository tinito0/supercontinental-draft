import React from 'react';
import { BallIcon } from './BallIcon.jsx';

/* Dominio minuto a minuto (modelo de utils/matchAnalysis.js momentum): barras hacia arriba = local, hacia abajo =
   visitante; un corte entre tiempos y los goles marcados en su minuto. */

const BAR = 6;
const GAP = 1;
const PERIOD_GAP = 10;
const HEIGHT = 120;
const HALF = HEIGHT / 2;
const PERIOD_NAME = { 1: 'PT', 2: 'ST', 3: 'A1', 4: 'A2' };
const MIN_LABEL_GAP = 0.2;

/** Posición x de cada punto, con un espacio entre tiempos. */
function layout(points) {
  let x = 0;
  let previous = null;
  return points.map(point => {
    if (previous != null && point.period !== previous) x += PERIOD_GAP;
    previous = point.period;
    const at = x;
    x += BAR + GAP;
    return { ...point, x: at };
  });
}

function describe(points, match) {
  const top = side => points.reduce((best, p) => ((side === 'home' ? p.value > (best?.value ?? 0) : p.value < (best?.value ?? 0)) ? p : best), null);
  const home = top('home');
  const away = top('away');
  const part = (team, p) => (p ? `${team} dominó más en el minuto ${p.minute + 1}` : `${team} no tuvo un tramo de dominio`);
  return `Dominio por minuto. ${part(match.home.name, home)}; ${part(match.away.name, away)}.`;
}

export function MomentumChart({ data, match, compact = false }) {
  if (!data) {
    return <p className="py-6 text-center text-sm text-ink-3">Este partido se grabó antes de medir las acciones por minuto.</p>;
  }
  const placed = layout(data.points);
  const width = (placed.at(-1)?.x ?? 0) + BAR;
  const scale = (HALF - 6) / data.max;
  const xOf = (period, minute) => placed.find(p => p.period === period && p.minute === minute)?.x;
  // One label per period start; the two short extra-time periods sit close together, so a label that would
  // overlap the previous one is left out (the bars still show the gap between periods).
  const starts = placed.filter((p, i) => i === 0 || p.period !== placed[i - 1].period)
    .filter((p, i, all) => i === 0 || (p.x - all[i - 1].x) / width > MIN_LABEL_GAP);
  return (
    <figure className="m-0">
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${HEIGHT}`} preserveAspectRatio="none" className={`block w-full ${compact ? 'h-24' : 'h-36'}`}
          role="img" aria-label={describe(data.points, match)}>
          <line x1="0" x2={width} y1={HALF} y2={HALF} className="stroke-line/20" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          {placed.map(p => {
            if (!p.value) return null;
            const h = Math.max(1, Math.abs(p.value) * scale);
            const home = p.value > 0;
            return <rect key={`${p.period}:${p.minute}`} x={p.x} width={BAR} y={home ? HALF - h : HALF} height={h} rx="1"
              className={home ? 'fill-accent' : 'fill-ink-3'} />;
          })}
        </svg>
        {data.goals.map((goal, i) => {
          const x = xOf(goal.period, goal.minute);
          if (x == null) return null;
          return (
            <span key={i} className={`absolute -translate-x-1/2 ${goal.side === 'home' ? 'top-0' : 'bottom-0'}`}
              style={{ left: `${((x + BAR / 2) / width) * 100}%` }}>
              <span role="img" className="inline-flex" aria-label={`Gol ${goal.side === 'home' ? match.home.name : match.away.name}, minuto ${goal.minute + 1}`}><BallIcon className="h-4 w-4" /></span>
            </span>
          );
        })}
      </div>
      <div className="relative mt-1 h-4 text-xs text-ink-3" aria-hidden="true">
        {starts.map(p => {
          const left = (p.x / width) * 100;
          // Near the right edge the label is anchored by its end so it never wraps or overflows.
          return (
            <span key={p.period} className={`num absolute whitespace-nowrap ${left > 80 ? '-translate-x-full' : ''}`} style={{ left: `${left}%` }}>
              {PERIOD_NAME[p.period]} {p.minute}'
            </span>
          );
        })}
      </div>
      {!compact && (
        <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-accent" aria-hidden="true" />{match.home.name}</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-ink-3" aria-hidden="true" />{match.away.name}</span>
          {data.from && <span>La grabación empezó en el minuto {data.from.minute + 1}: antes no hay datos.</span>}
        </figcaption>
      )}
    </figure>
  );
}
