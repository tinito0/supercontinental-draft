import React from 'react';

/* Estadísticas por secciones del partido (pestañas Resumen y Estadísticas). Datos: utils/matchStats.js. */

/** Un valor: el porcentaje grande y «hechos/intentos» chico al lado, o el número. */
function StatValue({ value, display, isLeader, align }) {
  const weight = isLeader ? 'font-bold text-ink' : 'text-ink-2';
  if (!value || typeof value !== 'object') {
    return <span className={`num font-display text-base ${weight} ${align}`}>{display}</span>;
  }
  return (
    <span className={`num leading-tight ${align}`}>
      <span className={`font-display text-base ${weight}`}>{value.pct == null ? '—' : `${value.pct} %`}</span>
      <span className="ml-1 whitespace-nowrap text-xs text-ink-3">{value.made}/{value.total}</span>
    </span>
  );
}

/** Una fila: valor local, nombre, valor visitante y las dos barras enfrentadas; el lado que gana va en azul. */
export function StatCompareRow({ row }) {
  const lead = side => row.leader === side;
  return (
    <li title={row.help}>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] items-baseline gap-2 text-sm">
        <StatValue value={row.home} display={row.display.home} isLeader={lead('home')} align="" />
        <span className="text-center text-xs text-ink-3">{row.label}</span>
        <StatValue value={row.away} display={row.display.away} isLeader={lead('away')} align="text-right" />
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5" aria-hidden="true">
        <div className="flex h-1.5 justify-end overflow-hidden rounded-full bg-raised">
          <div className={`h-full rounded-full ${lead('home') ? 'bg-accent' : 'bg-ink-3/60'}`} style={{ width: `${Math.min(100, row.share.home)}%` }} />
        </div>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-raised">
          <div className={`h-full rounded-full ${lead('away') ? 'bg-accent' : 'bg-ink-3/60'}`} style={{ width: `${Math.min(100, row.share.away)}%` }} />
        </div>
      </div>
    </li>
  );
}

function SectionPanel({ section, match }) {
  return (
    <section className="panel p-4 sm:p-5" aria-labelledby={`stats-${section.id}`}>
      <h3 id={`stats-${section.id}`} className="section-title mb-3 text-center">{section.title}</h3>
      <div className="mb-3 grid grid-cols-2 text-xs font-semibold text-ink-3">
        <span className="truncate">{match.home.name}</span>
        <span className="truncate text-right">{match.away.name}</span>
      </div>
      <ul className="space-y-3.5">
        {section.rows.map(row => <StatCompareRow key={row.key} row={row} />)}
      </ul>
    </section>
  );
}

const EMPTY = 'Las estadísticas aparecen cuando arranca el partido.';

/** Solo «Estadísticas principales», para el Resumen. */
export function TopStats({ sections, match }) {
  const top = sections.find(section => section.id === 'principales');
  if (!top) return <p className="panel px-4 py-8 text-center text-sm text-ink-3">{EMPTY}</p>;
  return <SectionPanel section={top} match={match} />;
}

/** Todas las secciones en dos columnas, con la definición de cada fila al final. */
export function StatSections({ sections, match }) {
  if (!sections.length) return <p className="panel px-4 py-8 text-center text-sm text-ink-3">{EMPTY}</p>;
  const detail = sections.filter(section => section.id !== 'principales');
  const definitions = new Map(detail.flatMap(section => section.rows).map(row => [row.label, row.help]));
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {detail.map(section => <SectionPanel key={section.id} section={section} match={match} />)}
      </div>
      <details className="panel-flat px-4 py-3 text-sm">
        <summary className="min-h-11 cursor-pointer content-center font-semibold text-ink-2">Cómo se calcula cada estadística</summary>
        <dl className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {[...definitions].map(([label, help]) => (
            <div key={label}>
              <dt className="text-ink-2">{label}</dt>
              <dd className="text-xs text-ink-3">{help}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-ink-3">
          Los porcentajes se redondean al entero; sin intentos no hay porcentaje («—»). La posesión no aparece porque todavía no se mide.
        </p>
      </details>
    </div>
  );
}
