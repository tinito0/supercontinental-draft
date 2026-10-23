// Página /en-vivo (screens/league/LeagueLiveScreen.jsx): qué partido mostrar, porcentajes de la predicción y ranking
// del MVP. Las reglas de las ventanas son las mismas que aplica el servidor (supabase/functions/_shared/communityVote.js).
import { mvpCandidates, mvpWindow } from '../supabase/functions/_shared/communityVote.js';
import { playerName } from './matchCenter.js';

/** Encuestas «¿quién gana la copa?» (public/data/polls/{id}); en este orden se elige la que muestra el overlay. */
export const CUP_POLLS = [
  { id: 'copa-oro', label: 'Copa de Oro', title: '¿Quién gana la Copa de Oro?' },
  { id: 'copa-plata', label: 'Copa de Plata', title: '¿Quién gana la Copa de Plata?' },
];

/** El partido del juego para votar el MVP: el que está en vivo, o el último terminado hace menos de 15 minutos. */
export function pickMvpMatch(matches, now) {
  // La misma ventana que aplica el servidor (mvpWindow): en vivo con señal, o terminado hace menos de 15 min desde finishedAt.
  const isOpen = match => mvpWindow({ status: match.status.kind, updatedAtMs: match.updatedAtMs, finishedAtMs: match.finishedAtMs }, now).open;
  const live = matches.find(match => match.status.kind === 'live' && isOpen(match));
  if (live) return { match: live, open: true };
  const recent = matches.find(match => match.status.kind === 'finished' && isOpen(match));
  return recent ? { match: recent, open: true } : { match: null, open: false };
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

/** Candidatos del MVP agrupados por equipo, con nombre (titulares y los que entraron). */
export function mvpOptions(summary) {
  const ids = mvpCandidates(summary);
  const sideOf = id => (summary?.lineups?.away?.starting?.includes(id)
    || (summary?.substitutions || []).some(sub => sub.side === 'away' && sub.onId === id) ? 'away' : 'home');
  const options = { home: [], away: [] };
  for (const id of ids) options[sideOf(id)].push({ id, name: playerName(summary, id) });
  return options;
}

/** Ranking del MVP: más votados primero, con porcentaje. */
export function mvpRanking(votes, summary, limit = 5) {
  const entries = Object.entries(votes || {}).map(([id, count]) => ({ id: Number(id), votes: Number(count) || 0 }));
  const total = entries.reduce((sum, entry) => sum + entry.votes, 0);
  return entries
    .sort((a, b) => b.votes - a.votes || a.id - b.id)
    .slice(0, limit)
    .map(entry => ({ ...entry, name: playerName(summary, entry.id), pct: total ? Math.round((entry.votes / total) * 100) : 0 }));
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
