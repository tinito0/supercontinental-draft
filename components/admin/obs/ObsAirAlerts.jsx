import React from 'react';
import { Alert } from '../../ui/Alert.jsx';
import { hasLinkedMatch } from '../../BroadcastOverlay.jsx';
import { MATCH_SCENES, sceneLabel } from '../../../utils/obsScenes.js';
import { useOverlayDoc } from '../../../hooks/useOverlayDoc.js';
import { useLiveMatch } from '../../../hooks/useLeagueData.js';

/** Tables and scorer lists the air shows as «Sin datos cargados» when the tournament has no rows yet. */
function emptyTournamentAlerts(scene, tournament) {
  if (!tournament) return [];
  if (scene === 'tabla' && !(tournament.league || []).some(team => team?.name && team.name !== 'Club...')) {
    return [{
      key: 'table',
      tone: 'warning',
      title: '«Tabla» está al aire sin datos',
      text: 'El stream muestra «Sin datos cargados». Cargá los partidos en Administración → Torneo para que salga la tabla.',
    }];
  }
  if (scene === 'goleadores' && !(tournament.topScorers || []).some(player => player?.name && Number(player.goals) > 0)) {
    return [{
      key: 'scorers',
      tone: 'warning',
      title: '«Goleadores» está al aire sin goles',
      text: 'El stream muestra «Todavía no hay goles cargados». Cargá los goles en Administración → Torneo, en la tarjeta de cada partido.',
    }];
  }
  return [];
}

/**
 * What the operator must know before looking at the stream: the match scenes have no match linked (the strip airs
 * «Próximo partido a confirmar»), the table or scorers are still empty, or this browser cannot read the overlay doc
 * (the OBS sources use the same document and retry with backoff; the air keeps its last data).
 * @param {{ overlay: object, readError?: boolean, tournament?: object|null, liveMatch?: object|null }} props overlay: the
 *   merged doc that is on air; liveMatch: the bridge match of overlay.liveMatchKey, which the air also counts as linked
 */
export function airAlerts({ overlay, readError = false, tournament = null, liveMatch = null }) {
  const alerts = [];
  if (readError) {
    alerts.push({
      key: 'read',
      tone: 'danger',
      title: 'No se puede leer el overlay',
      text: 'Si las fuentes de OBS tienen el mismo problema, el aire queda con los últimos datos y reintentan solas. Revisá la conexión y que la sesión de admin siga abierta.',
    });
  }
  const scene = overlay?.scene || 'live';
  if (MATCH_SCENES.has(scene) && !hasLinkedMatch({ ...overlay, scene }, null, liveMatch)) {
    alerts.push({
      key: 'match',
      tone: 'warning',
      title: `«${sceneLabel(scene)}» está al aire sin partido vinculado`,
      text: 'El stream muestra «Próximo partido a confirmar». Elegí un partido en la escena para que salgan los clubes y los escudos.',
    });
  }
  return [...alerts, ...emptyTournamentAlerts(scene, tournament)];
}

export function ObsAirAlerts({ overlay, tournament }) {
  const { error } = useOverlayDoc();
  const liveMatchKey = overlay?.liveMatchKey || null;
  const { match } = useLiveMatch(liveMatchKey);
  const alerts = airAlerts({ overlay, readError: Boolean(error), tournament, liveMatch: liveMatchKey ? match : null });
  if (!alerts.length) return null;
  return (
    <div className="space-y-3">
      {alerts.map(alert => <Alert key={alert.key} tone={alert.tone} title={alert.title}>{alert.text}</Alert>)}
    </div>
  );
}

export default ObsAirAlerts;
