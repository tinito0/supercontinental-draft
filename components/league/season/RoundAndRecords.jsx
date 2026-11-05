import React from 'react';
import { Link } from 'react-router-dom';
import { PlayerPhoto } from '../match/MatchDetailViews.jsx';
import { RatingChip } from '../match/MatchParts.jsx';
import { playerDisplayName } from './SeasonLeaderRow.jsx';
import { teamOfTheRound } from '../../../utils/seasonStats.js';

/* Equipo de la fecha y récords de la temporada, debajo de los líderes en /torneo?tab=estadisticas. */

const LINES = [
  { id: 'forward', label: 'Delanteros' },
  { id: 'midfield', label: 'Mediocampistas' },
  { id: 'defense', label: 'Defensores' },
  { id: 'keeper', label: 'Arquero' },
];

/** La última fecha con partidos terminados y su equipo, o null. */
export function latestRoundXi(docs, rounds) {
  for (const round of [...rounds].reverse()) {
    const xi = teamOfTheRound(docs, round.keys);
    if (xi) return { round: round.round, xi };
  }
  return null;
}

function RoundPlayer({ player, catalog }) {
  return (
    <li>
      <Link to={`/jugadores/${player.id}`} className="flex min-h-11 w-40 items-center gap-2 rounded-lg bg-raised px-2 py-1.5 transition-colors hover:bg-overlay sm:w-44">
        <PlayerPhoto id={player.id} size={32} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{playerDisplayName(player, catalog)}</span>
          {player.clubName && <span className="block truncate text-xs text-ink-3">{player.clubName}</span>}
        </span>
        <RatingChip value={player.rating} />
      </Link>
    </li>
  );
}

/** El 4-3-3 de la fecha, de adelante hacia atrás como se lee una cancha de arriba hacia abajo. */
export function RoundXi({ docs, rounds, catalog }) {
  const latest = latestRoundXi(docs, rounds);
  if (!latest) return null;
  return (
    <section className="panel p-5 sm:p-6" aria-labelledby="round-xi">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="round-xi" className="section-title">Equipo de la fecha</h2>
        <p className="text-sm text-ink-2">{latest.round} · por valoración del juego</p>
      </div>
      <div className="mt-4 space-y-4">
        {LINES.map(line => latest.xi[line.id].length > 0 && (
          <div key={line.id}>
            <h3 className="eyebrow mb-2">{line.label}</h3>
            <ol className="flex flex-wrap gap-2">
              {latest.xi[line.id].map(player => <RoundPlayer key={`${player.matchKey}-${player.id}`} player={player} catalog={catalog} />)}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}

const MAX_COMEBACKS = 3;

function matchLabel(record) {
  return `${record.home.name || 'Local'} ${record.home.score}-${record.away.score} ${record.away.name || 'Visitante'}`;
}

/** Récords con link a su partido; sin récords no se muestra. */
export function SeasonRecords({ records, catalog }) {
  const rows = [
    records.biggestWin && { label: 'Goleada más amplia', value: matchLabel(records.biggestWin), to: `/partidos/${records.biggestWin.matchKey}` },
    records.mostGoals && { label: 'Partido con más goles', value: matchLabel(records.mostGoals), to: `/partidos/${records.mostGoals.matchKey}` },
    records.fastestGoal && {
      label: `Gol más rápido · ${records.fastestGoal.minute}'`,
      value: playerDisplayName({ id: records.fastestGoal.playerId, name: records.fastestGoal.name }, catalog),
      to: `/partidos/${records.fastestGoal.matchKey}`,
    },
    ...(records.comebacks || []).slice(0, MAX_COMEBACKS).map(back => ({
      label: back.deficit > 1 ? `Remontada de ${back.deficit} goles` : 'Remontada',
      value: matchLabel(back),
      to: `/partidos/${back.matchKey}`,
    })),
    ...records.hatTricks.map(hat => ({
      label: hat.goals > 3 ? `${hat.goals} goles en un partido` : 'Hat-trick',
      value: playerDisplayName({ id: hat.playerId, name: hat.name }, catalog),
      to: `/partidos/${hat.matchKey}`,
    })),
  ].filter(Boolean);
  if (!rows.length) return null;
  return (
    <section className="panel p-5 sm:p-6" aria-labelledby="season-records">
      <h2 id="season-records" className="section-title">Récords</h2>
      <ul className="mt-2 divide-y divide-line/10">
        {rows.map(row => (
          <li key={`${row.label}-${row.to}-${row.value}`}>
            <Link to={row.to} className="flex min-h-11 flex-wrap items-baseline justify-between gap-x-4 py-2 transition-colors hover:bg-white/[0.03]">
              <span className="text-sm text-ink-2">{row.label}</span>
              <span className="font-display text-lg font-bold text-ink">{row.value}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
