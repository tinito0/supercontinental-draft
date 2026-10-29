import { useMemo } from 'react';
import { useBroadcastOverlay, useLiveMatches, usePrediction, useTournament } from './useLeagueData.js';
import { useNow } from './useNow.js';
import { buildFixtures, groupFixtures, leagueStage } from '../utils/leagueFixtures.js';

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

  const fixtures = useMemo(() => buildFixtures({
    tournament,
    liveMatches,
    overlay,
    predictions: overlay?.matchId && prediction ? { [overlay.matchId]: prediction } : {},
    teamsById,
    now,
  }), [tournament, liveMatches, overlay, prediction, teamsById, now]);

  const groups = useMemo(() => groupFixtures(fixtures), [fixtures]);
  const stage = useMemo(() => leagueStage(tournament), [tournament]);

  return { tournament, fixtures, groups, stage, overlay, prediction, loading, error, liveLoading, liveError };
}
