import React, { useMemo } from 'react';
import { BroadcastOverlay } from '../BroadcastOverlay.jsx';
import { useLiveMatch, usePoll, usePrediction } from '../../hooks/useLeagueData.js';
import { useManagerRound } from '../../hooks/useManagerRound.js';
import { buildOverlayLive } from '../../utils/overlayLive.js';
import { CUP_POLLS } from '../../utils/communityView.js';
import { useSeasonStats } from '../../hooks/useSeasonStats.js';
import { matchupFacts } from '../../utils/seasonStats.js';
import { useMatchEtas } from '../../hooks/useMatchEtas.js';

/**
 * El overlay de OBS con los datos en vivo: el partido que sube el bridge (overlay.liveMatchKey, escrito por match-feed),
 * la predicción del partido al aire, el manager de la fecha y las encuestas de la copa. Mismas props que BroadcastOverlay.
 */
export function BroadcastOverlayLive(props) {
  const liveMatchKey = props.overlayData?.liveMatchKey || null;
  const { match } = useLiveMatch(liveMatchKey);
  const { data: prediction } = usePrediction(props.overlayData?.matchId || null);
  const { round: managerRound } = useManagerRound(props.tournamentData);
  const { data: oroPoll } = usePoll(CUP_POLLS[0].id);
  const { data: plataPoll } = usePoll(CUP_POLLS[1].id);
  const live = useMemo(
    () => buildOverlayLive({ match: liveMatchKey ? match : null, prediction, managerRound, polls: [oroPoll, plataPoll] }),
    [liveMatchKey, match, prediction, managerRound, oroPoll, plataPoll],
  );
  // Previa: forma y cara a cara de los dos clubes al aire (ids del draft del overlay), con los datos del juego.
  const { docs, officialKeys } = useSeasonStats();
  const homeId = props.overlayData?.homeTeamId || null;
  const awayId = props.overlayData?.awayTeamId || null;
  const season = useMemo(() => matchupFacts(docs, homeId, awayId, { officialKeys }), [docs, homeId, awayId, officialKeys]);
  const etaById = useMatchEtas(props.tournamentData, props.allTeams);
  return <BroadcastOverlay {...props} live={live} liveMatch={liveMatchKey ? match : null} season={season} etaById={etaById} />;
}

export default BroadcastOverlayLive;
