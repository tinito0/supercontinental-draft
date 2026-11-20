// Datos en vivo para las escenas del overlay de OBS (components/BroadcastOverlay.jsx): el partido que sube el bridge
// (overlay.liveMatchKey, lo escribe match-feed), la predicción del partido al aire, el manager de la fecha y la
// encuesta de la copa.
// Puro; tests/overlayLive.test.js. Lo que no llegó queda en null y la escena usa lo que cargó el admin.
import { buildTimeline, playerName } from './matchCenter.js';
import { bestRated, playerRating } from './matchStats.js';
import { managerRanking, pollResults, predictionShares } from './communityView.js';

const MANAGER_CARD_ROWS = 3;
const CUP_CARD_ROWS = 4;

/** La encuesta a mostrar: la primera abierta en el orden dado; si no hay abiertas, la primera con opciones. */
function featuredPoll(polls) {
  const withOptions = (polls || []).filter(poll => poll?.options?.length);
  return withOptions.find(poll => poll.open) || withOptions[0] || null;
}

/** Mejor valoración del juego en el partido: todos los que empatan arriba; null sin valoraciones. */
function topRatedOf(summary) {
  const ids = bestRated(summary);
  if (!ids.length) return null;
  return { names: ids.map(id => playerName(summary, id)), rating: playerRating(summary, ids[0]) };
}

function goalTag(event) {
  if (event.ownGoal) return 'e.c.';
  return event.penalty ? 'p.' : '';
}

/**
 * @param {{ match?: ReturnType<import('./matchCenter.js').parseMatchDoc>, prediction?: object,
 *   managerRound?: { title: string, open: boolean, votes?: object } | null, polls?: object[] }} input
 *   managerRound: la fecha cuyo manager se vota (hooks/useManagerRound.js) y su doc de votos; polls: encuestas de la
 *   copa en orden de preferencia
 */
export function buildOverlayLive({ match, prediction, managerRound = null, polls } = {}) {
  const scorers = { home: [], away: [] };
  buildTimeline(match?.summary)
    .filter(event => event.type === 'goal')
    .forEach((event, index) => {
      scorers[event.side]?.push({ key: `goal-${index}`, name: event.player, minute: event.minute, tag: goalTag(event) });
    });
  const shares = predictionShares(prediction?.votes);
  const managerTop = managerRanking(managerRound?.votes?.votes, MANAGER_CARD_ROWS);
  const poll = featuredPoll(polls);
  const results = poll ? pollResults(poll) : null;
  return {
    score: match ? { home: match.home.score, away: match.away.score } : null,
    scorers,
    prediction: shares.total ? shares : null,
    manager: managerRound && managerTop.length
      ? { title: managerRound.title, open: Boolean(managerRound.open), total: Number(managerRound.votes?.total) || 0, top: managerTop }
      : null,
    topRated: topRatedOf(match?.summary),
    cup: results ? { title: poll.title || '¿Quién gana la copa?', open: Boolean(poll.open), total: results.total, options: results.options.slice(0, CUP_CARD_ROWS) } : null,
  };
}

const votesLabel = total => `${total} ${total === 1 ? 'voto' : 'votos'}`;

/**
 * Si cada tarjeta de la comunidad se va a ver en OBS y, si no, por qué (CommunityCard no dibuja nada sin votos).
 * El admin lo muestra al lado de cada botón para no apretar a ciegas.
 * @param {ReturnType<typeof buildOverlayLive>} live
 * @param {{ matchId?: string, liveMatchKey?: string }} overlay
 * @param {{ title: string } | null} [managerRound] la fecha cuyo manager se vota, para avisar cuál es aunque no tenga votos
 * @returns {{ manager: { ready: boolean, note: string }, prediction: { ready: boolean, note: string }, cup: { ready: boolean, note: string } }}
 */
export function communityCardStatus(live, overlay, managerRound = null) {
  return {
    manager: live?.manager
      ? { ready: true, note: `${live.manager.title}: ${votesLabel(live.manager.total)} · lidera ${live.manager.top[0].club}` }
      : { ready: false, note: managerRound ? `${managerRound.title}: todavía nadie votó` : 'Ninguna fecha terminó todavía' },
    prediction: live?.prediction
      ? { ready: true, note: votesLabel(live.prediction.total) }
      : { ready: false, note: overlay?.matchId ? 'Todavía nadie votó la predicción' : 'No hay partido al aire' },
    cup: live?.cup?.total
      ? { ready: true, note: `${votesLabel(live.cup.total)} · ${live.cup.open ? 'abierta' : 'cerrada'}` }
      : { ready: false, note: live?.cup ? 'La encuesta todavía no tiene votos' : 'No hay encuesta de copa cargada' },
  };
}
