import React from 'react';
import { Link } from 'react-router-dom';
import { useTournament } from '../../../hooks/useLeagueData.js';

/* Goleadores y asistidores del torneo arriba de /partidos. Misma fuente que /torneo y la escena «goleadores» del
   overlay: los resultados cargados, que traen goles y asistencias del juego cuando el admin importa el partido
   (utils/collectorImport.js → tournamentEngine). Sin datos no se muestra nada. */

const TOP = 3;

const leaders = (list, field) => (list || [])
  .filter(item => String(item?.name || '').trim() && Number(item[field]) > 0)
  .slice(0, TOP);

function LeaderList({ title, rows, field }) {
  return (
    <section aria-label={title} className="min-w-0">
      <h2 className="eyebrow mb-1">{title}</h2>
      {rows.length ? (
        <ol className="divide-y divide-line/10">
          {rows.map((row, index) => (
            <li key={`${row.name}-${index}`} className="flex items-baseline gap-3 py-2">
              <span className="num w-4 shrink-0 text-sm text-ink-3">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate text-base text-ink">
                {row.name}
                {row.team && <span className="ml-2 text-sm text-ink-3">{row.team}</span>}
              </span>
              <span className="num font-display text-xl font-bold leading-none text-ink">{Number(row[field])}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="py-2 text-sm text-ink-3">Todavía no hay.</p>
      )}
    </section>
  );
}

export function LeagueLeaders() {
  const { tournament } = useTournament();
  const scorers = leaders(tournament?.topScorers, 'goals');
  const assisters = leaders(tournament?.topAssisters, 'assists');
  if (!scorers.length && !assisters.length) return null;
  return (
    <div className="panel mb-8 p-4 sm:p-5">
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <LeaderList title="Goleadores" rows={scorers} field="goals" />
        <LeaderList title="Asistencias" rows={assisters} field="assists" />
      </div>
      <Link to="/torneo?tab=goleadores" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-accent-soft hover:text-ink">
        Tabla completa en Torneo
      </Link>
    </div>
  );
}
