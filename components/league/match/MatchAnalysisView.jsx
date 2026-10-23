import React from 'react';
import { MOMENTUM_DECAY, MOMENTUM_WEIGHTS, SOURCE_LABELS, bucketRows, dataSources, halfTotals, momentum } from '../../../utils/matchAnalysis.js';
import { MomentumChart } from './MomentumChart.jsx';

/* Pestaña Análisis: dominio con su método, los tramos de 15 minutos y los tiempos, y de dónde sale cada dato.
   Datos: utils/matchAnalysis.js. */

const WEIGHT_NAMES = { shots: 'tiro', shotsOnTarget: 'al arco (extra)', corners: 'córner', crosses: 'centro', throughPasses: 'pase filtrado' };
const dash = value => (value == null ? '—' : value);
const pct = value => (value == null ? '—' : `${value} %`);

function PeriodTable({ rows, match, caption }) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table min-w-[520px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="text-left sm:pl-5">Tramo</th>
            <th scope="col" className="text-right">Tiros</th>
            <th scope="col" className="text-right">Al arco</th>
            <th scope="col" className="text-right">Pases</th>
            <th scope="col" className="text-right">Precisión</th>
            <th scope="col" className="text-right">Toques</th>
          </tr>
        </thead>
        <tbody>
          {rows.flatMap(row => ['home', 'away'].map(side => (
            <tr key={`${row.label}:${side}`} className={row.empty ? 'opacity-60' : ''}>
              <th scope="row" className="px-3 py-2 text-left font-normal sm:px-5">
                {side === 'home' ? <span className="font-semibold text-ink">{row.label}</span> : <span className="sr-only">{row.label}</span>}
                <span className="flex items-center gap-1.5 text-xs text-ink-3">
                  <span className={`h-2 w-2 rounded-full ${side === 'home' ? 'bg-accent' : 'bg-ink-3'}`} aria-hidden="true" />{match[side].name}
                </span>
              </th>
              <td className="num text-right">{dash(row[side].shots)}</td>
              <td className="num text-right">{dash(row[side].shotsOnTarget)}</td>
              <td className="num text-right">{dash(row[side].passes)}</td>
              <td className="num text-right">{pct(row[side].passAccuracy)}</td>
              <td className="num text-right">{dash(row[side].touches)}</td>
            </tr>
          )))}
        </tbody>
      </table>
    </div>
  );
}

function Sources({ summary }) {
  return (
    <section className="panel p-4 sm:p-5" aria-labelledby="sources-title">
      <h3 id="sources-title" className="section-title mb-3">De dónde sale cada dato</h3>
      <ul className="divide-y divide-line/10">
        {dataSources(summary).map(item => (
          <li key={item.label} className="grid gap-1 py-2.5 sm:grid-cols-[minmax(0,1fr)_8rem] sm:gap-4">
            <div>
              <p className="text-sm text-ink">{item.label}</p>
              <p className="text-xs text-ink-3">{item.detail}</p>
            </div>
            <p className={`text-sm font-semibold sm:text-right ${item.source === 'unavailable' ? 'text-ink-3' : item.source === 'estimated' ? 'text-warning-soft' : 'text-ink-2'}`}>
              {SOURCE_LABELS[item.source]}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MatchAnalysisView({ summary, match }) {
  const buckets = bucketRows(summary);
  const halves = halfTotals(summary);
  const weights = Object.entries(MOMENTUM_WEIGHTS).map(([key, w]) => `${WEIGHT_NAMES[key]} ${String(w).replace('.', ',')}`).join(', ');
  return (
    <div className="space-y-4">
      <section className="panel p-4 sm:p-5" aria-labelledby="momentum-title">
        <h3 id="momentum-title" className="section-title mb-3">Dominio</h3>
        <MomentumChart data={momentum(summary)} match={match} />
        <p className="mt-3 text-xs text-ink-3">
          Modelo propio, no un dato del juego: cada minuto suma las acciones de ataque de cada equipo ({weights}) y resta las del
          rival; además arrastra el {Math.round(MOMENTUM_DECAY * 100)} % del minuto anterior y vuelve a cero en cada tiempo. Los
          pesos se eligieron a mano y no están calibrados.
        </p>
      </section>
      <section className="panel p-0" aria-labelledby="buckets-title">
        <h3 id="buckets-title" className="section-title px-4 pt-4 sm:px-5">Por tramos de 15 minutos</h3>
        {buckets.length ? (
          <PeriodTable rows={buckets} match={match} caption="Estadísticas por tramo de 15 minutos" />
        ) : (
          <p className="px-4 py-6 text-sm text-ink-3">Este partido se grabó antes de guardar los tramos.</p>
        )}
        {halves.length > 0 && (
          <>
            <h3 className="section-title px-4 pt-4 sm:px-5">Por tiempo</h3>
            <PeriodTable rows={halves.map(half => ({ ...half, empty: false }))} match={match} caption="Estadísticas por tiempo" />
          </>
        )}
        <p className="px-4 pb-4 pt-2 text-xs text-ink-3 sm:px-5">
          El juego ya cuenta cada acción en su tramo; el tiempo agregado cae en el último tramo de cada tiempo.
        </p>
      </section>
      <Sources summary={summary} />
    </div>
  );
}
