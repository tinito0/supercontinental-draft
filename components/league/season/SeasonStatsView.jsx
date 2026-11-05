import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { Alert } from '../../ui/Alert.jsx';
import { EmptyState } from '../../ui/EmptyState.jsx';
import { useMarketCatalog, useSeasonStats } from '../../../hooks/useSeasonStats.js';
import { PlayerPhoto } from '../match/MatchDetailViews.jsx';
import { LeaderValue, SeasonLeaderRow, playerDisplayName } from './SeasonLeaderRow.jsx';
import { RoundXi, SeasonRecords } from './RoundAndRecords.jsx';
import { MIN_RATED_MATCHES, seasonLeaders } from '../../../utils/seasonStats.js';

/* /torneo?tab=estadisticas: líderes de la temporada con los datos del juego (match_lines de los partidos oficiales).
   Dos bloques grandes (goleador y mejor valoración), después las tablas cortas. Sin partidos, nada inventado. */

const SPOTLIGHTS = [
  { field: 'goals', title: 'Goleadores', unit: 'goles' },
  { field: 'rating', title: 'Mejor valoración', unit: `promedio, desde ${MIN_RATED_MATCHES} partidos` },
];
const TABLES = [
  { field: 'assists', title: 'Asistencias' },
  { field: 'shotsOnTarget', title: 'Tiros al arco' },
  { field: 'tacklesWon', title: 'Duelos ganados' },
  { field: 'interceptions', title: 'Intercepciones' },
  { field: 'cleanSheets', title: 'Vallas invictas' },
  { field: 'saves', title: 'Atajadas' },
];
const SPOTLIGHT_ROWS = 5;
const TABLE_ROWS = 5;

/** El primero grande, con foto; del segundo al quinto debajo, en filas. */
function Spotlight({ players, field, title, unit, catalog }) {
  const rows = seasonLeaders(players, field, { limit: SPOTLIGHT_ROWS });
  const [first, ...rest] = rows;
  return (
    <section className="panel p-5 sm:p-6" aria-labelledby={`season-${field}`}>
      <h2 id={`season-${field}`} className="section-title">{title}</h2>
      {first ? (
        <>
          <Link to={`/jugadores/${first.id}`} className="mt-4 flex items-center gap-4 rounded-xl py-1 transition-colors hover:bg-white/[0.03]">
            <PlayerPhoto id={first.id} size={72} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-2xl font-bold leading-tight text-ink">{playerDisplayName(first, catalog)}</span>
              {first.clubName && <span className="block truncate text-sm text-ink-2">{first.clubName}</span>}
              <span className="block text-xs text-ink-3">{unit}</span>
            </span>
            <LeaderValue field={field} value={first[field]} size="lg" />
          </Link>
          {rest.length > 0 && (
            <ol className="mt-3 divide-y divide-line/10 border-t border-line/10">
              {rest.map((player, index) => <SeasonLeaderRow key={player.id} player={player} rank={index + 2} field={field} catalog={catalog} />)}
            </ol>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm text-ink-3">Todavía no hay.</p>
      )}
    </section>
  );
}

function LeaderTable({ players, field, title, catalog }) {
  const rows = seasonLeaders(players, field, { limit: TABLE_ROWS });
  return (
    <section className="min-w-0" aria-labelledby={`season-${field}`}>
      <h3 id={`season-${field}`} className="eyebrow mb-1">{title}</h3>
      {rows.length ? (
        <ol className="divide-y divide-line/10">
          {rows.map((player, index) => <SeasonLeaderRow key={player.id} player={player} rank={index + 1} field={field} catalog={catalog} />)}
        </ol>
      ) : (
        <p className="py-2 text-sm text-ink-3">Todavía no hay.</p>
      )}
    </section>
  );
}

function StatsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="grid gap-4 lg:grid-cols-2">{[0, 1].map(i => <div key={i} className="skeleton h-64 rounded-2xl" />)}</div>
      <div className="skeleton h-72 rounded-2xl" />
    </div>
  );
}

/** La pestaña completa: trae los datos solo cuando está abierta. */
export function SeasonStatsPanel() {
  const { stats, docs, rounds, loading, error } = useSeasonStats();
  const catalog = useMarketCatalog();
  if (error) return <Alert tone="danger" title={error}>Recargá la página para intentar de nuevo.</Alert>;
  if (loading) return <StatsSkeleton />;
  return <SeasonStatsView stats={stats} catalog={catalog} docs={docs} rounds={rounds} />;
}

/**
 * @param {{ stats: object, catalog: object|null, docs?: object[], rounds?: object[] }} props stats = buildSeasonStats;
 *   docs y rounds (useSeasonStats) para el equipo de la fecha
 */
export function SeasonStatsView({ stats, catalog, docs = [], rounds = [] }) {
  if (!stats.matches) {
    return (
      <EmptyState icon={BarChart3} title="Todavía no hay partidos oficiales con datos del juego"
        description="Se llenan solas cuando un partido grabado en el PES se carga como resultado del torneo." />
    );
  }
  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-2">
        <span className="num font-semibold text-ink">{stats.matches}</span> {stats.matches === 1 ? 'partido oficial' : 'partidos oficiales'} con datos del juego.
        La valoración es la que da el PES; un partido sin datos del juego no suma acá.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {SPOTLIGHTS.map(spot => <Spotlight key={spot.field} players={stats.players} catalog={catalog} {...spot} />)}
      </div>
      <RoundXi docs={docs} rounds={rounds} catalog={catalog} />
      <div className="panel grid gap-x-8 gap-y-6 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
        {TABLES.map(table => <LeaderTable key={table.field} players={stats.players} catalog={catalog} {...table} />)}
      </div>
      <SeasonRecords records={stats.records} catalog={catalog} />
    </div>
  );
}
