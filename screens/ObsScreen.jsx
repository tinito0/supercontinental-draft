import React, { useEffect, useMemo } from 'react';
import { BroadcastStage } from '../components/broadcast/BroadcastStage.jsx';
import { BroadcastOverlayLive } from '../components/broadcast/BroadcastOverlayLive.jsx';
import { OverlayErrorBoundary } from '../components/broadcast/OverlayErrorBoundary.jsx';
import { useLeagueTeams, useTournament } from '../hooks/useLeagueData.js';
import { useOverlayDoc } from '../hooks/useOverlayDoc.js';
import { useNow } from '../hooks/useNow.js';
import { useObsSceneControl } from '../hooks/useObsSceneControl.js';
import { useObsDirector } from '../hooks/useObsDirector.js';
import { sceneForSource } from '../utils/obsScenes.js';
import { effectiveOverlay, obsSceneName } from '../utils/obsAutoScene.js';
import { SITE_URL } from '../utils/sharePages.js';

const CONTROL_STATUS = {
  'no-obs': 'Esta página cambia las escenas cuando está como fuente «Navegador» dentro de OBS.',
  'no-permission': 'Falta el permiso: en las propiedades de esta fuente, «Permisos de página» → «Acceso avanzado a OBS».',
  ready: 'Conectado. Cambia la escena de OBS cuando cambia la del overlay.',
  switched: 'Conectado. Cambia la escena de OBS cuando cambia la del overlay.',
};

const READ_ERROR_TEXT = 'No se puede leer el overlay: la fuente sigue con los últimos datos y reintenta sola.';

/**
 * ?control=obs: draws nothing on air; switches the real OBS scene with the overlay, plus the Final camera tour
 * (hooks/useObsDirector.js).
 */
function ObsSceneControl({ overlay, readError }) {
  const shot = useObsDirector(overlay?.scene || 'live');
  const status = useObsSceneControl(obsSceneName(shot, overlay?.obsScenes));
  // Connected inside OBS the source stays empty on air, even on a read error (the studio warns the operator and the
  // air keeps its last data). Text only outside OBS or while the permission is missing; the plate keeps it legible.
  if (status === 'ready' || status === 'switched') return null;
  const lines = [readError && READ_ERROR_TEXT, CONTROL_STATUS[status]].filter(Boolean);
  return (
    <div role="alert" style={{ position: 'absolute', top: 40, left: 40, right: 40, padding: '16px 24px', background: '#04173a', color: '#fff', font: '600 28px system-ui' }}>
      {lines.map(text => <p key={text} style={{ margin: 0 }}>{text}</p>)}
    </div>
  );
}

/**
 * Fuente de OBS (/draft/overlay y las URLs ?mode=obs de antes; utils/obsScenes.resolveObsRequest). main.jsx la monta
 * sin el draft: no hay login, mercado ni service de perfiles, solo los datos públicos que muestra la transmisión.
 * Todo vive en el lienzo de 1920×1080 de BroadcastStage, transparente para OBS. Si algo falla no sale una página de
 * error al aire: la fuente queda transparente y se reintenta sola (OverlayErrorBoundary).
 * @param {{ request: { scene: string | null, follow: string | null, transparent: boolean, control?: boolean } }} props
 */
export default function ObsScreen({ request }) {
  const { teamsById } = useLeagueTeams();
  const { tournament } = useTournament();
  const { data: overlay, loading: overlayLoading, error: overlayError } = useOverlayDoc();
  const now = useNow(5000);
  // Two minutes after an automatic «Final» every source moves to the table on its own (no write needed).
  const shown = useMemo(() => effectiveOverlay(overlay, now, SITE_URL), [overlay, now]);

  useEffect(() => {
    document.title = 'SCL · OBS';
  }, []);

  if (request.control) return <ObsSceneControl overlay={shown} readError={Boolean(overlayError)} />;

  return (
    <BroadcastStage transparent={request.transparent} label="Overlay de la SuperContinental">
      <OverlayErrorBoundary name="overlay" resetKey={overlay}>
        <BroadcastOverlayLive
          overlayData={shown || {}}
          allTeams={teamsById}
          tournamentData={tournament}
          forcedScene={sceneForSource(request, shown?.scene)}
          overlayLoaded={!overlayLoading}
        />
      </OverlayErrorBoundary>
    </BroadcastStage>
  );
}
