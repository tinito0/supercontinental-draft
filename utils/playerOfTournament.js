// Jugador del Torneo (docs/COMMUNITY_PLATFORM.md, C4): suma los MVP de la comunidad de los partidos terminados que
// registró el colector (live_matches + mvp_votes). Un partido con empate en el primer puesto no da MVP: no se inventa
// un ganador. Puro; tests/playerOfTournament.test.js.
import { playerName } from './matchCenter.js';

/** El más votado de un partido, o null sin votos o con empate arriba. */
export function mvpWinner(mvpDoc) {
  const entries = Object.entries(mvpDoc?.votes || {})
    .map(([id, count]) => ({ playerId: Number(id), votes: Number(count) || 0 }))
    .filter(entry => entry.votes > 0)
    .sort((a, b) => b.votes - a.votes);
  if (!entries.length || entries[1]?.votes === entries[0].votes) return null;
  return entries[0];
}

function sideOf(summary, playerId) {
  const played = side => (summary?.lineups?.[side]?.starting || []).includes(playerId)
    || (summary?.substitutions || []).some(sub => sub.side === side && sub.onId === playerId);
  if (played('home')) return 'home';
  return played('away') ? 'away' : null;
}

/**
 * @param {ReturnType<import('./matchCenter.js').parseMatchDoc>[]} matches
 * @param {Record<string, { votes?: Record<string, number> }>} mvpByMatchKey
 * @returns {{ playerId: number, name: string, team: string, awards: number, votes: number }[]}
 */
export function rankPlayerOfTournament(matches, mvpByMatchKey) {
  const byPlayer = new Map();
  const entryFor = (match, playerId) => {
    const side = sideOf(match.summary, playerId);
    return byPlayer.get(playerId) || {
      playerId,
      name: playerName(match.summary, playerId),
      team: side ? match.summary?.names?.teams?.[side] || '' : '',
      awards: 0,
      votes: 0,
    };
  };
  for (const match of matches || []) {
    if (match?.status?.kind !== 'finished') continue;
    const mvpDoc = mvpByMatchKey?.[match.key];
    // Desempate: todos los votos que recibió en la temporada, ganara o no ese partido.
    for (const [id, count] of Object.entries(mvpDoc?.votes || {})) {
      const playerId = Number(id);
      const entry = entryFor(match, playerId);
      byPlayer.set(playerId, { ...entry, votes: entry.votes + (Number(count) || 0) });
    }
    const winner = mvpWinner(mvpDoc);
    if (winner) {
      const entry = byPlayer.get(winner.playerId);
      byPlayer.set(winner.playerId, { ...entry, awards: entry.awards + 1 });
    }
  }
  return [...byPlayer.values()]
    .filter(entry => entry.awards > 0)
    .sort((a, b) => b.awards - a.awards || b.votes - a.votes || a.playerId - b.playerId);
}
