import { useEffect, useMemo, useState } from 'react';
import { useManagerVotes } from './useLeagueData.js';
import { pickManagerRound } from '../utils/communityView.js';

/**
 * La fecha cuyo manager se vota (utils/communityView.js pickManagerRound) con su doc de votos, y todos los docs para el
 * manager del torneo. Se recalcula cada minuto para que la votación se cierre sola a las 24 h.
 * @param {object} tournament public/data/tournament/official
 * @param {object[]} [liveMatches] parseMatchDoc de live_matches (hora de final de cada partido importado)
 * @returns {{ round: null | { roundId, title, fixtures, window, votes, open: boolean }, byRoundId: object, loading: boolean, error: string }}
 */
const NO_MATCHES = [];

export function useManagerRound(tournament, liveMatches = NO_MATCHES) {
  const { byRoundId, loading, error } = useManagerVotes();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const round = useMemo(() => {
    const picked = pickManagerRound(tournament, liveMatches, roundId => byRoundId[roundId] || null, now);
    return picked ? { ...picked, votes: byRoundId[picked.roundId] || null, open: picked.window.open } : null;
  }, [tournament, liveMatches, byRoundId, now]);
  return { round, byRoundId, loading, error };
}
