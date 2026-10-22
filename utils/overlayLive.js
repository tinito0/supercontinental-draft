// Datos en vivo para las escenas del overlay de OBS (components/BroadcastOverlay.jsx): el partido que sube el bridge
// (overlay.liveMatchKey, lo escribe match-feed), la predicción del partido al aire y el MVP de la comunidad.
// Puro; tests/overlayLive.test.js. Lo que no llegó queda en null y la escena usa lo que cargó el admin.
import { buildTimeline } from './matchCenter.js';
import { mvpRanking, pollResults, predictionShares } from './communityView.js';

const MVP_CARD_ROWS = 3;
const CUP_CARD_ROWS = 4;

/** La encuesta a mostrar: la primera abierta en el orden dado; si no hay abiertas, la primera con opciones. */
function featuredPoll(polls) {
  const withOptions = (polls || []).filter(poll => poll?.options?.length);
  return withOptions.find(poll => poll.open) || withOptions[0] || null;
}

function goalTag(event) {
  if (event.ownGoal) return 'e.c.';
  return event.penalty ? 'p.' : '';
}

/**
 * @param {{ match?: ReturnType<import('./matchCenter.js').parseMatchDoc>, prediction?: object, mvpVotes?: object,
 *   polls?: object[] }} input polls: encuestas de la copa en orden de preferencia
 */
export function buildOverlayLive({ match, prediction, mvpVotes, polls } = {}) {
  const scorers = { home: [], away: [] };
  buildTimeline(match?.summary)
    .filter(event => event.type === 'goal')
    .forEach((event, index) => {
      scorers[event.side]?.push({ key: `goal-${index}`, name: event.player, minute: event.minute, tag: goalTag(event) });
    });
  const shares = predictionShares(prediction?.votes);
  const mvpTop = mvpRanking(mvpVotes?.votes, match?.summary, MVP_CARD_ROWS).filter(entry => entry.votes);
  const poll = featuredPoll(polls);
  const results = poll ? pollResults(poll) : null;
  return {
    score: match ? { home: match.home.score, away: match.away.score } : null,
    scorers,
    prediction: shares.total ? shares : null,
    mvp: mvpTop[0] || null,
    mvpTop,
    cup: results ? { title: poll.title || '¿Quién gana la copa?', open: Boolean(poll.open), total: results.total, options: results.options.slice(0, CUP_CARD_ROWS) } : null,
  };
}
