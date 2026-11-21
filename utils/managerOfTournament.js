// Manager del torneo (docs/COMMUNITY_PLATFORM.md, C4): suma las fechas que ganó cada manager en la votación del
// público (public/data/manager_votes/{fecha-n}). Una fecha con empate en el primer puesto no da ganador: no se inventa.
// Puro; tests/managerOfTournament.test.js.

/** El club más votado de una fecha, o null sin votos o con empate arriba. */
export function managerWinner(votesDoc) {
  const entries = Object.entries(votesDoc?.votes || {})
    .map(([club, count]) => ({ club, votes: Number(count) || 0 }))
    .filter(entry => entry.votes > 0)
    .sort((a, b) => b.votes - a.votes);
  if (!entries.length || entries[1]?.votes === entries[0].votes) return null;
  return entries[0];
}

/**
 * @param {Record<string, { votes?: Record<string, number> }>} byRoundId docs de manager_votes por fecha
 * @param {{ openRoundId?: string|null }} [options] la fecha que todavía se está votando: no cuenta hasta que cierre
 * @returns {{ club: string, awards: number, votes: number, rounds: string[] }[]} con al menos una fecha ganada
 */
export function rankManagerOfTournament(byRoundId, { openRoundId = null } = {}) {
  const byClub = new Map();
  const entryFor = club => byClub.get(club) || { club, awards: 0, votes: 0, rounds: [] };
  const roundNumber = id => Number(String(id).split('-')[1]) || 0;
  const closed = Object.entries(byRoundId || {}).filter(([roundId]) => roundId !== openRoundId);
  for (const [roundId, doc] of closed.sort((a, b) => roundNumber(a[0]) - roundNumber(b[0]))) {
    // Desempate: todos los votos que recibió en la temporada, ganara o no esa fecha.
    for (const [club, count] of Object.entries(doc?.votes || {})) {
      const entry = entryFor(club);
      byClub.set(club, { ...entry, votes: entry.votes + (Number(count) || 0) });
    }
    const winner = managerWinner(doc);
    if (winner) {
      const entry = byClub.get(winner.club);
      byClub.set(winner.club, { ...entry, awards: entry.awards + 1, rounds: [...entry.rounds, roundId] });
    }
  }
  return [...byClub.values()]
    .filter(entry => entry.awards > 0)
    .sort((a, b) => b.awards - a.awards || b.votes - a.votes || a.club.localeCompare(b.club));
}
