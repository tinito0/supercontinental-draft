// Página /en-vivo (screens/league/LeagueLiveScreen.jsx): porcentajes de la predicción, la fecha cuyo manager se vota y
// su ranking. Las reglas de las ventanas son las mismas que aplica el servidor (supabase/functions/_shared/communityVote.js).
import { managerWindow, roundFixtures, roundIdOf } from '../supabase/functions/_shared/communityVote.js';

/** Si el partido al aire se puede predecir (está en el torneo con los dos clubes): la misma regla que el servidor. */
export { fixtureIsPredictable } from '../supabase/functions/_shared/communityVote.js';

/** Encuestas «¿quién gana la copa?» (public/data/polls/{id}); en este orden se elige la que muestra el overlay. */
export const CUP_POLLS = [
  { id: 'copa-oro', label: 'Copa de Oro', title: '¿Quién gana la Copa de Oro?' },
  { id: 'copa-plata', label: 'Copa de Plata', title: '¿Quién gana la Copa de Plata?' },
];

const toMillis = value => (value instanceof Date ? value.getTime() : typeof value?.toMillis === 'function' ? value.toMillis() : NaN);

/**
 * La fecha cuyo manager se vota: la última fecha de liga con todos sus resultados cargados. Con su ventana, calculada
 * igual que en el servidor (managerWindow): 24 h desde el final del último partido, o desde el primer voto si algún
 * resultado se cargó a mano. Null si ninguna fecha terminó todavía.
 * @param {object} tournament public/data/tournament/official
 * @param {object[]} liveMatches parseMatchDoc de live_matches (para el finishedAt de cada partido importado)
 * @param {(roundId: string) => object|null} votesOf el doc de manager_votes de una fecha (o null)
 * @returns {null | { roundId: string, title: string, fixtures: object[], window: ReturnType<typeof managerWindow> }}
 */
export function pickManagerRound(tournament, liveMatches, votesOf, now) {
  const ids = [...new Set((tournament?.matches || []).filter(m => /fecha/i.test(String(m?.round || ''))).map(m => roundIdOf(m.round)).filter(Boolean))];
  const finished = ids
    .map(roundId => ({ roundId, fixtures: roundFixtures(tournament, roundId) }))
    .filter(round => round.fixtures.length && round.fixtures.every(fixture => fixture.completed))
    .sort((a, b) => Number(b.roundId.split('-')[1]) - Number(a.roundId.split('-')[1]));
  const round = finished[0];
  if (!round) return null;
  const byKey = new Map((liveMatches || []).map(match => [match.key, match]));
  const finishedAtMs = round.fixtures.filter(f => f.importedFrom).map(f => byKey.get(f.importedFrom)?.finishedAtMs ?? NaN);
  const votes = votesOf?.(round.roundId) || null;
  const window = managerWindow({ fixtures: round.fixtures, finishedAtMs, openedAtMs: toMillis(votes?.openedAt), now });
  const closedByAdmin = Boolean(votes?.closedAt);
  return {
    roundId: round.roundId,
    title: `Fecha ${round.roundId.split('-')[1]}`,
    fixtures: round.fixtures,
    window: closedByAdmin ? { open: false, reason: 'La votación de esta fecha está cerrada.', closesAtMs: window.closesAtMs } : window,
  };
}

/** Ranking del manager de la fecha: más votados primero, con porcentaje entero que suma 100. */
export function managerRanking(votes, limit = 12) {
  const entries = Object.entries(votes || {}).map(([club, count]) => ({ club, votes: Number(count) || 0 })).filter(e => e.votes > 0);
  const pcts = wholePercents(entries.map(entry => entry.votes));
  return entries
    .map((entry, index) => ({ ...entry, pct: pcts[index] }))
    .sort((a, b) => b.votes - a.votes || a.club.localeCompare(b.club))
    .slice(0, limit);
}

/** Porcentajes enteros que suman 100 (resto mayor); 0 sin votos. */
function wholePercents(counts) {
  const total = counts.reduce((sum, n) => sum + n, 0);
  if (!total) return counts.map(() => 0);
  const exact = counts.map(n => (n / total) * 100);
  const pcts = exact.map(Math.floor);
  let missing = 100 - pcts.reduce((sum, n) => sum + n, 0);
  const byRemainder = exact.map((value, index) => ({ index, rest: value - pcts[index] })).sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (const { index } of byRemainder) {
    if (missing <= 0) break;
    pcts[index] += 1;
    missing -= 1;
  }
  return pcts;
}

/** Predicción local / empate / visitante en porcentajes; `leader` es null sin votos o con empate en el primer puesto. */
export function predictionShares(votes) {
  const sides = ['home', 'draw', 'away'];
  const counts = sides.map(side => Number(votes?.[side]) || 0);
  const pcts = wholePercents(counts);
  const total = counts.reduce((sum, n) => sum + n, 0);
  const top = Math.max(...counts);
  const leaders = sides.filter((_, index) => counts[index] === top);
  return { home: pcts[0], draw: pcts[1], away: pcts[2], total, leader: total && leaders.length === 1 ? leaders[0] : null };
}

/** Encuesta de la copa: todas las opciones con su porcentaje, la más votada primero. */
export function pollResults(poll) {
  const options = (poll?.options || []).map(option => ({ id: option.id, name: option.name, votes: Number(poll.votes?.[option.id]) || 0 }));
  const pcts = wholePercents(options.map(option => option.votes));
  return {
    total: options.reduce((sum, option) => sum + option.votes, 0),
    options: options.map((option, index) => ({ ...option, pct: pcts[index] })).sort((a, b) => b.votes - a.votes),
  };
}

/**
 * Cómo terminó la predicción del partido al aire: el resultado de los 90 minutos del partido del juego vinculado
 * (prediction.liveMatchKey, lo escribe match-feed al cerrarla) y qué parte del público acertó. Null mientras ese
 * partido no terminó o si no hay partido vinculado. Empate = igualdad en los 90 (los penales no cambian la predicción).
 * @returns {null | { match: object, result: 'home'|'draw'|'away', correctPct: number, total: number }}
 */
export function predictionOutcome(prediction, matches) {
  const key = prediction?.liveMatchKey;
  const match = key ? (matches || []).find(item => item.key === key) : null;
  if (!match || match.status?.kind !== 'finished') return null;
  const home = Number(match.home.score) || 0;
  const away = Number(match.away.score) || 0;
  const result = home === away ? 'draw' : home > away ? 'home' : 'away';
  const shares = predictionShares(prediction.votes);
  return { match, result, correctPct: shares[result], total: shares.total };
}
