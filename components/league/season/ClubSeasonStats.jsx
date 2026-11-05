import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, ChevronRight } from 'lucide-react';
import { Alert } from '../../ui/Alert.jsx';
import { EmptyState } from '../../ui/EmptyState.jsx';
import { Stat } from '../../ui/Stat.jsx';
import { TeamMark } from '../match/MatchParts.jsx';
import { RESULT, shortDate } from './PlayerMatchLog.jsx';
import { SeasonLeaderRow } from './SeasonLeaderRow.jsx';
import { useMarketCatalog, useSeasonStats } from '../../../hooks/useSeasonStats.js';
import { clubMatchLog, seasonLeaders } from '../../../utils/seasonStats.js';

/* /equipos/:userId?tab=temporada: la temporada del club con los datos del juego. Récord, forma, goleadores del club
   y sus resultados, cada uno con link al partido. */

const TOP_SCORERS = 5;

/** Últimos cinco resultados, el más nuevo a la izquierda: letra con su color y el texto para lectores de pantalla. */
export function FormStrip({ form }) {
  if (!form?.length) return null;
  return (
    <ol className="flex gap-1.5" aria-label="Últimos resultados, el más nuevo primero">
      {form.map((result, index) => (
        <li key={index} className={`num grid h-8 w-8 place-items-center rounded-md border border-line/15 bg-raised font-display text-base font-bold ${RESULT[result].className}`}>
          <span aria-hidden="true">{RESULT[result].letter}</span><span className="sr-only">{RESULT[result].label}</span>
        </li>
      ))}
    </ol>
  );
}

function ResultRow({ entry, teamsById }) {
  const result = RESULT[entry.result];
  return (
    <li>
      <Link to={`/partidos/${entry.matchKey}`} className="grid min-h-11 grid-cols-[2.75rem_minmax(0,1fr)_auto_1rem] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.03]">
        <span className="num text-sm text-ink-3">{shortDate(entry.startedAt)}</span>
        <span className="flex min-w-0 items-center gap-2">
          <TeamMark team={entry.rival} teamsById={teamsById} size="sm" />
          <span className="min-w-0 truncate text-sm text-ink" title={entry.rival.name || undefined}>
            <span className="text-ink-3">{entry.side === 'home' ? 'vs ' : 'en '}</span>{entry.rival.name || 'Rival'}
          </span>
        </span>
        <span className={`num font-display text-lg font-bold ${result.className}`}>
          <span className="sr-only">{result.label} </span>{entry.own.score}-{entry.rival.score}
        </span>
        <ChevronRight className="h-4 w-4 text-ink-3" aria-hidden="true" />
      </Link>
    </li>
  );
}

/**
 * @param {{ clubId: string, teamsById: Record<string, object> }} props clubId = id del equipo del draft
 */
export function ClubSeasonStats({ clubId, teamsById }) {
  const { stats, docs, officialKeys, loading, error } = useSeasonStats();
  const catalog = useMarketCatalog();
  const club = stats.clubs.find(entry => entry.key === clubId) || null;
  const log = useMemo(() => clubMatchLog(docs, clubId, { officialKeys }), [docs, clubId, officialKeys]);
  const scorers = seasonLeaders(stats.players.filter(p => p.clubKey === clubId), 'goals', { limit: TOP_SCORERS });

  if (error) return <Alert tone="danger" title={error}>Recargá la página para intentar de nuevo.</Alert>;
  if (loading) return <div className="skeleton h-72 rounded-2xl" aria-busy="true" />;
  if (!club) {
    return <EmptyState icon={BarChart3} title="Este club todavía no jugó partidos oficiales con datos del juego" description="Se llena sola cuando un partido grabado en el PES se carga como resultado del torneo." />;
  }
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <section className="panel p-5 sm:p-6" aria-labelledby="club-season-record">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="club-season-record" className="section-title">Temporada</h2>
            <FormStrip form={club.form} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-x-6 gap-y-5 sm:grid-cols-5">
            <Stat label="Jugados" value={club.played} />
            <Stat label="Ganados" value={club.won} tone="success" />
            <Stat label="Empates" value={club.drawn} />
            <Stat label="Perdidos" value={club.lost} tone="danger" />
            <Stat label="Goles" value={`${club.goalsFor}-${club.goalsAgainst}`} hint="a favor y en contra" />
          </div>
        </section>
        <section className="panel overflow-hidden" aria-labelledby="club-results">
          <h2 id="club-results" className="section-title px-4 pt-4 sm:px-5">Resultados</h2>
          <ol className="mt-2 divide-y divide-line/10">
            {log.map(entry => <ResultRow key={entry.matchKey} entry={entry} teamsById={teamsById} />)}
          </ol>
        </section>
      </div>
      <section className="panel h-fit p-5" aria-labelledby="club-scorers">
        <h2 id="club-scorers" className="section-title">Goleadores del club</h2>
        {scorers.length ? (
          <ol className="mt-2 divide-y divide-line/10">
            {scorers.map((player, index) => <SeasonLeaderRow key={player.id} player={player} rank={index + 1} field="goals" catalog={catalog} />)}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-ink-3">Todavía no hizo goles.</p>
        )}
      </section>
    </div>
  );
}
