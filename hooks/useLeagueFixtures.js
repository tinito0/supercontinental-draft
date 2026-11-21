import { useMemo } from 'react';
import { useBroadcastOverlay, useLiveMatches, usePrediction, useTournament } from './useLeagueData.js';
import { useNow } from './useNow.js';
import { buildFixtures, groupFixtures, leagueStage } from '../utils/leagueFixtures.js';
import { estimateKickoffs } from '../utils/matchEta.js';

/**
 * Partidos de la liga con su estado real (utils/leagueFixtures.js): el torneo dice qué hay y qué resultado es oficial,
 * los partidos del juego dicen qué se juega ahora. Lo usan la portada y /partidos.
 * Un error en los partidos del juego no impide mostrar el fixture (`liveError` aparte).
 * @param {Record<string, { teamName: string }>} teamsById clubes del draft (useLeagueTeams), para vincular partidos del juego
 */
export function useLeagueFixtures(teamsById) {
  const { tournament, loading, error } = useTournament();
  const { matches: liveMatches, loading: liveLoading, error: liveError } = useLiveMatches();
  const { data: overlay } = useBroadcastOverlay();
  const { data: prediction } = usePrediction(overlay?.matchId || null);
  const now = useNow(30000);

  const fixtures = useMemo(() => {
    const built = buildFixtures({
      tournament,
      liveMatches,
      overlay,
      predictions: overlay?.matchId && prediction ? { [overlay.matchId]: prediction } : {},
      teamsById,
      now,
    });
    // Once the round is being played, the rest of it gets an estimated kickoff (utils/matchEta.js): `etaMs`.
    const eta = estimateKickoffs(built, liveMatches, { now });
    return eta.size ? built.map(fixture => (eta.has(fixture.id) ? { ...fixture, etaMs: eta.get(fixture.id) } : fixture)) : built;
  }, [tournament, liveMatches, overlay, prediction, teamsById, now]);

  const groups = useMemo(() => groupFixtures(fixtures), [fixtures]);
  const stage = useMemo(() => leagueStage(tournament), [tournament]);

  return { tournament, fixtures, groups, stage, overlay, prediction, liveMatches, loading, error, liveLoading, liveError };
}
