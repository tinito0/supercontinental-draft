import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { MatchHeader, MatchTimeline } from './MatchSummaryView.jsx';
import { buildTimeline } from '../../../utils/matchCenter.js';

/* El partido que se está jugando, arriba de /en-vivo: marcador (destella con cada gol) y minuto a minuto, con link a
   la ficha completa. Sin partido en juego no se muestra: la página sigue siendo la de los votos. */

/** El partido en vivo más reciente de la lista (useLiveMatches, los más nuevos primero), o null. */
export function pickLiveMatch(matches) {
  return (matches || []).find(match => match?.status?.kind === 'live') || null;
}

/**
 * @param {{ matches: object[], teamsById: Record<string, object> }} props matches = useLiveMatches (parseMatchDoc)
 */
export function LiveNowPanel({ matches, teamsById }) {
  const match = pickLiveMatch(matches);
  const timeline = useMemo(() => (match ? buildTimeline(match.summary) : []), [match]);
  if (!match) return null;
  return (
    <section aria-label="Partido en juego" className="space-y-3">
      {/* key: otro partido en vivo es otro marcador, no un gol. */}
      <MatchHeader key={match.key} match={match} timeline={timeline} teamsById={teamsById} />
      <MatchTimeline timeline={timeline} match={match} />
      <Link to={`/partidos/${match.key}`} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent-soft hover:text-ink">
        Estadísticas, alineaciones y táctica del partido <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
