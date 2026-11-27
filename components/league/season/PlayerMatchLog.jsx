import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { BallIcon } from '../match/BallIcon.jsx';
import { CardMark, RatingChip, TeamMark } from '../match/MatchParts.jsx';
import { EmptyState } from '../../ui/EmptyState.jsx';

/* Partidos oficiales de un jugador en /jugadores/:id (utils/seasonStats.js playerMatchLog), el más nuevo arriba. */

// Resultado desde el lado del jugador: letra y color de significado, con el texto completo para lectores de pantalla.
export const RESULT = {
  W: { letter: 'G', label: 'Ganó', className: 'text-success-soft' },
  D: { letter: 'E', label: 'Empató', className: 'text-ink-2' },
  L: { letter: 'P', label: 'Perdió', className: 'text-danger-soft' },
};

/** «20261104T162412Z» → «4/11». */
export function shortDate(startedAt) {
  const match = /^(\d{4})(\d{2})(\d{2})T/.exec(String(startedAt || ''));
  return match ? `${Number(match[3])}/${Number(match[2])}` : '';
}

function Contribution({ line }) {
  return (
    <span className="flex shrink-0 items-center gap-1 text-xs text-ink-3">
      {Array.from({ length: line.goals }, (_, i) => <span key={`g${i}`} role="img" aria-label="Gol" className="inline-flex"><BallIcon className="h-4 w-4" /></span>)}
      {line.assists > 0 && <span className="num">A{line.assists > 1 ? line.assists : ''}<span className="sr-only"> asistencias</span></span>}
      {line.yellow > 0 && <CardMark type="yellow" />}
      {line.red > 0 && <CardMark type="red" />}
    </span>
  );
}

function LogRow({ entry, teamsById }) {
  const result = RESULT[entry.result];
  const { line } = entry;
  return (
    <li>
      {/* Phones: the contributions drop to a second line under the rival; from sm they share the row. */}
      <Link to={`/partidos/${entry.matchKey}`} className="grid min-h-11 grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-2.5 transition-colors hover:bg-white/[0.03] sm:grid-cols-[2.75rem_minmax(0,1fr)_auto_auto]">
        <span className="num text-sm text-ink-3">{shortDate(entry.startedAt)}</span>
        <span className="flex min-w-0 items-center gap-2">
          <TeamMark team={entry.rival} teamsById={teamsById} size="sm" />
          <span className="min-w-0 truncate text-sm text-ink" title={entry.rival.name || undefined}>
            <span className="text-ink-3">vs </span>{entry.rival.name || 'Rival'}
          </span>
          <span className={`num shrink-0 text-sm font-semibold ${result.className}`}>
            <span aria-hidden="true">{result.letter} </span><span className="sr-only">{result.label} </span>{entry.own.score}-{entry.rival.score}
          </span>
        </span>
        <span className="col-start-2 row-start-2 flex items-center gap-2 sm:col-start-auto sm:row-start-auto">
          <Contribution line={line} />
          {line.minutes != null && <span className="num hidden text-xs text-ink-3 sm:inline">{line.minutes}'</span>}
          <RatingChip value={line.rating} />
        </span>
        <ChevronRight className="h-4 w-4 text-ink-3" aria-hidden="true" />
      </Link>
    </li>
  );
}

/**
 * @param {{ log: object[], teamsById: Record<string, object> }} props
 */
export function PlayerMatchLog({ log, teamsById }) {
  return (
    <section className="panel overflow-hidden" aria-labelledby="player-matches">
      <h2 id="player-matches" className="section-title px-4 pt-4 sm:px-5">Partidos oficiales</h2>
      {log.length ? (
        <ol className="mt-2 divide-y divide-line/10">
          {log.map(entry => <LogRow key={entry.matchKey} entry={entry} teamsById={teamsById} />)}
        </ol>
      ) : (
        <div className="px-4 pb-4 sm:px-5">
          <EmptyState title="Todavía no jugó partidos oficiales registrados por el juego." />
        </div>
      )}
    </section>
  );
}
