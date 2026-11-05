import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSeasonStats } from '../../../hooks/useSeasonStats.js';
import { headToHead } from '../../../utils/seasonStats.js';
import { shortDate } from './PlayerMatchLog.jsx';

/* Cara a cara en la ficha del partido: los cruces oficiales anteriores entre los dos clubes (datos del juego).
   Solo con los dos clubes del draft asignados; sin cruces anteriores lo dice en una línea. */

const LAST_MEETINGS = 3;

/**
 * @param {{ match: object }} props match = parseMatchDoc (home/away con draftTeamId y name)
 */
export function HeadToHead({ match }) {
  const { docs, officialKeys, loading, error } = useSeasonStats();
  const homeId = match.home.draftTeamId;
  const awayId = match.away.draftTeamId;
  const h2h = useMemo(() => {
    if (!homeId || !awayId) return null;
    return headToHead(docs.filter(doc => doc.matchKey !== match.key), homeId, awayId, { officialKeys });
  }, [docs, officialKeys, homeId, awayId, match.key]);
  if (!h2h || loading || error) return null;

  return (
    <section className="panel p-4 sm:p-5" aria-labelledby="h2h-title">
      <h3 id="h2h-title" className="section-title mb-3 text-center">Cara a cara</h3>
      {h2h.played === 0 ? (
        <p className="text-center text-sm text-ink-2">Primer cruce oficial entre los dos con datos del juego.</p>
      ) : (
        <>
          <dl className="grid grid-cols-3 text-center">
            <div><dt className="truncate text-xs text-ink-3">{match.home.name}</dt><dd className="num font-display text-3xl font-bold text-ink">{h2h.won}</dd></div>
            <div><dt className="text-xs text-ink-3">Empates</dt><dd className="num font-display text-3xl font-bold text-ink-2">{h2h.drawn}</dd></div>
            <div><dt className="truncate text-xs text-ink-3">{match.away.name}</dt><dd className="num font-display text-3xl font-bold text-ink">{h2h.lost}</dd></div>
          </dl>
          <ol className="mt-3 divide-y divide-line/10 border-t border-line/10">
            {h2h.matches.slice(0, LAST_MEETINGS).map(entry => (
              <li key={entry.matchKey}>
                <Link to={`/partidos/${entry.matchKey}`} className="flex min-h-11 items-center justify-between gap-3 text-sm transition-colors hover:bg-white/[0.03]">
                  <span className="num text-ink-3">{shortDate(entry.startedAt)}</span>
                  <span className="min-w-0 flex-1 truncate text-ink">
                    {entry.side === 'home' ? `${entry.own.name} ${entry.own.score}-${entry.rival.score} ${entry.rival.name}` : `${entry.rival.name} ${entry.rival.score}-${entry.own.score} ${entry.own.name}`}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
