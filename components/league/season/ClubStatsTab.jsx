import React, { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { Alert } from '../../ui/Alert.jsx';
import { EmptyState } from '../../ui/EmptyState.jsx';
import { useMarketCatalog, useSeasonStats } from '../../../hooks/useSeasonStats.js';
import { clubTeamStats } from '../../../utils/seasonStats.js';
import { GROUPS, LeaderTable } from './SeasonStatsView.jsx';

/* /equipos/:userId?tab=estadisticas: los números del equipo por partido contra el promedio de la liga (con su puesto
   entre los clubes) y los mejores del club en cada estadística, con los datos del juego de los partidos oficiales. */

const CLUB_LEADERS = 3;
const decimal = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });
const show = (value, unit) => (value == null ? '–' : `${decimal.format(value)}${unit ? ` ${unit}` : ''}`);

function TeamRow({ row }) {
  const top = row.rank === 1;
  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{row.label}</span>
        <span className="block text-xs text-ink-2">
          Liga {show(row.league, row.unit)}
          {row.rank != null && <> · <span className={top ? 'font-semibold text-accent-soft' : ''}>{row.rank}.º de {row.of}</span></>}
        </span>
      </span>
      <span className="num shrink-0 font-display text-2xl font-bold leading-none text-ink">{show(row.value, row.unit)}</span>
    </li>
  );
}

export function ClubStatsTab({ clubId }) {
  const { stats, docs, officialKeys, loading, error } = useSeasonStats();
  const catalog = useMarketCatalog();
  const team = useMemo(() => clubTeamStats(docs, clubId, { officialKeys }), [docs, clubId, officialKeys]);
  const players = useMemo(() => stats.players.filter(player => player.clubKey === clubId), [stats.players, clubId]);

  if (error) return <Alert tone="danger" title={error}>Recargá la página para intentar de nuevo.</Alert>;
  if (loading) return <div className="skeleton h-72 rounded-2xl" aria-busy="true" />;
  if (!team) {
    return <EmptyState icon={BarChart3} title="Este club todavía no jugó partidos oficiales con datos del juego" description="Se llena sola cuando un partido grabado en el PES se carga como resultado del torneo." />;
  }
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
      <section className="panel p-5 sm:p-6 lg:sticky lg:top-20" aria-labelledby="club-team-stats">
        <h2 id="club-team-stats" className="section-title">El equipo por partido</h2>
        <p className="mt-1 text-sm text-ink-2">
          Promedio en <span className="num font-semibold text-ink">{team.matches}</span> {team.matches === 1 ? 'partido oficial' : 'partidos oficiales'},
          contra el promedio de la liga y su puesto entre los clubes.
        </p>
        <ul className="mt-2 divide-y divide-line/10">
          {team.rows.map(row => <TeamRow key={row.key} row={row} />)}
        </ul>
      </section>
      <div className="space-y-6">
        {GROUPS.map(group => (
          <section key={group.id} className="panel p-5 sm:p-6" aria-labelledby={`club-group-${group.id}`}>
            <h2 id={`club-group-${group.id}`} className="section-title">Los mejores del club: {group.title.toLowerCase()}</h2>
            <div className="mt-4 grid gap-x-8 gap-y-6 sm:grid-cols-2">
              {group.tables.map(table => (
                <LeaderTable key={table.field} players={players} catalog={catalog} limit={CLUB_LEADERS} hideClub {...table} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
