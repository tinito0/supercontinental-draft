import { useMemo } from 'react';
import { useLiveMatches } from './useLeagueData.js';
import { useNow } from './useNow.js';
import { buildFixtures } from '../utils/leagueFixtures.js';
import { estimateKickoffs } from '../utils/matchEta.js';

/**
 * Estimated kickoffs of the round in play (utils/matchEta.js), for views that render the tournament on their own:
 * the OBS overlay and the draft's match centre. The league site gets them from useLeagueFixtures.
 * @returns {Map<string, number>} fixture id (`league-<match id>`, cup ids) → estimated kickoff ms
 */
export function useMatchEtas(tournament, teamsById) {
  const { matches: liveMatches } = useLiveMatches();
  const now = useNow(30000);
  return useMemo(() => {
    if (!tournament) return new Map();
    const fixtures = buildFixtures({ tournament, liveMatches, teamsById: teamsById || {}, now });
    return estimateKickoffs(fixtures, liveMatches, { now });
  }, [tournament, liveMatches, teamsById, now]);
}
