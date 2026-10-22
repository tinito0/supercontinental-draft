import React, { useEffect } from 'react';
import { BroadcastStage } from '../components/broadcast/BroadcastStage.jsx';
import { BroadcastOverlayLive } from '../components/broadcast/BroadcastOverlayLive.jsx';
import { useBroadcastOverlay, useLeagueTeams, useTournament } from '../hooks/useLeagueData.js';

/**
 * Fuente de OBS (/draft/overlay y las URLs ?mode=obs de antes; utils/obsScenes.resolveObsRequest). main.jsx la monta
 * sin el draft: no hay login, mercado ni service de perfiles, solo los datos públicos que muestra la transmisión.
 * Todo vive en el lienzo de 1920×1080 de BroadcastStage, transparente para OBS.
 * @param {{ request: { scene: string | null, transparent: boolean } }} props
 */
export default function ObsScreen({ request }) {
  const { teamsById } = useLeagueTeams();
  const { tournament } = useTournament();
  const { data: overlay } = useBroadcastOverlay();

  useEffect(() => {
    document.title = 'SCL · OBS';
  }, []);

  return (
    <BroadcastStage transparent={request.transparent} label="Overlay de la Supercontinental">
      <BroadcastOverlayLive
        overlayData={overlay || {}}
        allTeams={teamsById}
        tournamentData={tournament}
        forcedScene={request.scene}
      />
    </BroadcastStage>
  );
}
