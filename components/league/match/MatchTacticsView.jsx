import React from 'react';
import { formationChanges, passMix, teamPlanView } from '../../../utils/matchAnalysis.js';

/* Pestaña Táctica: el plan de juego guardado de cada equipo (solo si coincide con el XI que jugó) y el estilo que
   muestran los números del partido. Datos: utils/matchAnalysis.js. */

const MIX = [
  { key: 'short', label: 'Cortos', className: 'bg-accent' },
  { key: 'through', label: 'Filtrados', className: 'bg-accent-soft' },
  { key: 'long', label: 'Largos', className: 'bg-ink-2' },
  { key: 'cross', label: 'Centros', className: 'bg-ink-3' },
];

function PlanPanel({ title, view }) {
  return (
    <section className="panel p-4 sm:p-5" aria-label={title}>
      <h3 className="section-title mb-3 truncate">{title}</h3>
      {!view ? (
        <p className="text-sm text-ink-3">
          Sin plan confirmado: el guardado no coincide con el XI que jugó, o el equipo no tiene plan. No se muestra uno a ojo.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {[['Ataque', view.attack, view.instructions.attack], ['Defensa', view.defense, view.instructions.defense]].map(([label, rows, instructions]) => (
            <div key={label}>
              <h4 className="eyebrow mb-1">{label}</h4>
              <dl className="divide-y divide-line/10 text-sm">
                {rows.map(row => (
                  <div key={row.key} className="flex items-baseline justify-between gap-3 py-1.5">
                    <dt className="text-ink-3">{row.label}</dt>
                    <dd className="text-right font-semibold text-ink">{row.value}</dd>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-3 py-1.5">
                  <dt className="text-ink-3">Instrucciones</dt>
                  <dd className="text-right font-semibold text-ink">{instructions.length ? instructions.join(', ') : 'Ninguna'}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PassMixBar({ name, mix }) {
  return (
    <div>
      <p className="mb-1 truncate text-sm font-semibold text-ink">{name}</p>
      <div className="flex h-3 overflow-hidden rounded-full bg-raised" role="img"
        aria-label={`${name}: ${MIX.map(part => `${part.label.toLowerCase()} ${mix[part.key]} %`).join(', ')}`}>
        {MIX.map(part => <span key={part.key} className={part.className} style={{ width: `${mix[part.key] || 0}%` }} />)}
      </div>
      <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-ink-3">
        {MIX.map(part => <span key={part.key} className="num">{part.label} {mix[part.key]} %</span>)}
      </p>
    </div>
  );
}

function FormationChanges({ summary, match }) {
  const changes = formationChanges(summary);
  // Recorded before probe v4 (no formation events): unknown, not "no changes".
  if (!['home', 'away'].some(side => summary?.formations?.[side]?.length)) return null;
  return (
    <section className="panel p-4 sm:p-5" aria-labelledby="formation-changes-title">
      <h3 id="formation-changes-title" className="section-title mb-3">Cambios tácticos durante el partido</h3>
      {changes.length === 0 ? (
        <p className="text-sm text-ink-3">Ningún equipo cambió el dibujo ni los puestos después del saque inicial.</p>
      ) : (
        <ol className="divide-y divide-line/10">
          {changes.map((change, i) => (
            <li key={i} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 py-2 text-sm">
              <span className="num font-display font-semibold text-ink-2">{change.minute}</span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 font-semibold text-ink">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${change.side === 'home' ? 'bg-accent' : 'bg-ink-3'}`} aria-hidden="true" />
                  {match[change.side].name}: {[change.formationChanged && 'cambió el dibujo', change.positionsChanged && 'cambió jugadores de puesto'].filter(Boolean).join(' y ')}
                </span>
                <span className="block text-xs text-ink-3">{change.roles}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function MatchTacticsView({ summary, match }) {
  const mix = passMix(summary);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <PlanPanel title={`Plan · ${match.home.name}`} view={teamPlanView(summary, 'home')} />
        <PlanPanel title={`Plan · ${match.away.name}`} view={teamPlanView(summary, 'away')} />
      </div>
      <FormationChanges summary={summary} match={match} />
      <section className="panel p-4 sm:p-5" aria-labelledby="pass-mix-title">
        <h3 id="pass-mix-title" className="section-title mb-3">Cómo pasó la pelota cada equipo</h3>
        {mix ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <PassMixBar name={match.home.name} mix={mix.home} />
            <PassMixBar name={match.away.name} mix={mix.away} />
          </div>
        ) : (
          <p className="text-sm text-ink-3">Este partido se grabó antes de medir los tipos de pase.</p>
        )}
        <p className="mt-3 text-xs text-ink-3">
          Porcentaje de los pases de cada tipo, contados por el juego. Bloque defensivo, presión (PPDA), líneas y mapas de calor
          necesitan la posición de cada jugador en la cancha, que todavía no se lee.
        </p>
      </section>
    </div>
  );
}
