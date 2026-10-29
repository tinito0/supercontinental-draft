// Reglas de la competencia Supercontinental (liga suiza de 12, 4 fechas, Copa de Oro), puras y testeadas
// (tests/competitionRules.test.js). Las usan components/tournament/tournamentEngine.js (tabla 2/1/0, desempates,
// fecha suiza sugerida) y utils/bracketModel.js (quién pasa en un cruce con penales). Hallazgos T1 y T3 de
// docs/TOURNAMENT_DATA_FLOW_AUDIT.md.
//
// Puntos de liga: victoria en los 90' = 2, victoria por penales tras empate = 1, derrota = 0. Los penales de la tanda
// no son goles: no cuentan para goles a favor/en contra, diferencia ni goleadores.

export const LEAGUE_POINTS = { REGULATION_WIN: 2, SHOOTOUT_WIN: 1, LOSS: 0 };

// Puestos 1-8 de la tabla: cuartos de la Copa de Oro; 9-12: Copa de Plata.
export const GOLD_CUP_PLACES = 8;
export const LEAGUE_SIZE = 12;

/** Un marcador válido: entero y no negativo (un vacío o un -1 no es un resultado). */
export const isScore = value => value !== '' && value != null && Number.isInteger(Number(value)) && Number(value) >= 0;

/**
 * Resultado de un partido de liga.
 * @param {{ homeScore, awayScore, homePenalties?, awayPenalties? }} match marcador de los 90' y, si empataron, la tanda
 * @returns {{ ok: true, winner: 'home'|'away', decidedBy: 'regulation'|'shootout', points: { home, away } }
 *          | { ok: false, reason: string }}
 */
export function leagueMatchOutcome({ homeScore, awayScore, homePenalties, awayPenalties }) {
  if (!isScore(homeScore) || !isScore(awayScore)) return { ok: false, reason: 'Falta el marcador de los 90 minutos.' };
  const home = Number(homeScore);
  const away = Number(awayScore);
  if (home !== away) {
    const winner = home > away ? 'home' : 'away';
    return { ok: true, winner, decidedBy: 'regulation', points: pointsFor(winner, LEAGUE_POINTS.REGULATION_WIN) };
  }
  if (!isScore(homePenalties) || !isScore(awayPenalties)) {
    return { ok: false, reason: 'Empate en los 90 minutos: falta el resultado de la tanda de penales.' };
  }
  if (Number(homePenalties) === Number(awayPenalties)) return { ok: false, reason: 'La tanda de penales no puede terminar empatada.' };
  const winner = Number(homePenalties) > Number(awayPenalties) ? 'home' : 'away';
  return { ok: true, winner, decidedBy: 'shootout', points: pointsFor(winner, LEAGUE_POINTS.SHOOTOUT_WIN) };
}

/**
 * Resultado de un partido de liga visto desde un club, para la forma reciente y las fichas (tabla, resumen, ficha
 * del club). null si el club no jugó ese partido o si no hay marcador válido (antes un marcador vacío contaba 0-0).
 * `result`: 'win' (en los 90'), 'shootoutWin', 'shootoutLoss', 'loss' o 'draw' (empate sin la tanda cargada).
 * @returns {{ result: string, scored: number, conceded: number, opponent: string, isHome: boolean } | null}
 */
export function teamMatchResult(name, match) {
  if (!match || match.status !== 'completed') return null;
  const key = teamKey(name);
  const isHome = teamKey(match.homeTeam) === key;
  if (!isHome && teamKey(match.awayTeam) !== key) return null;
  if (!isScore(match.homeScore) || !isScore(match.awayScore)) return null;
  const side = isHome ? 'home' : 'away';
  const scored = Number(isHome ? match.homeScore : match.awayScore);
  const conceded = Number(isHome ? match.awayScore : match.homeScore);
  const opponent = isHome ? match.awayTeam : match.homeTeam;
  const outcome = leagueMatchOutcome(match);
  let result = 'draw';
  if (outcome.ok) {
    const won = outcome.winner === side;
    result = outcome.decidedBy === 'regulation' ? (won ? 'win' : 'loss') : (won ? 'shootoutWin' : 'shootoutLoss');
  }
  return { result, scored, conceded, opponent, isHome };
}

function pointsFor(winner, value) {
  return winner === 'home' ? { home: value, away: LEAGUE_POINTS.LOSS } : { home: LEAGUE_POINTS.LOSS, away: value };
}

/**
 * Tabla de la liga desde los partidos finalizados. Equipos por nombre (como el resto del torneo hoy).
 * Partidos sin resultado válido van a `issues` y no suman.
 * @returns {{ rows: object[], issues: { matchId, reason }[] }}
 */
export function buildLeagueStandings(teams, matches) {
  const rows = new Map(teams.map(name => [name, { name, played: 0, regulationWins: 0, shootoutWins: 0, losses: 0, points: 0, goalsFor: 0, goalsAgainst: 0 }]));
  const issues = [];
  for (const match of matches) {
    if (match.status !== 'completed') continue;
    const home = rows.get(match.homeTeam);
    const away = rows.get(match.awayTeam);
    if (!home || !away) {
      issues.push({ matchId: match.id, reason: `Equipo fuera de la liga: ${!home ? match.homeTeam : match.awayTeam}.` });
      continue;
    }
    const outcome = leagueMatchOutcome(match);
    if (!outcome.ok) {
      issues.push({ matchId: match.id, reason: outcome.reason });
      continue;
    }
    const goals = { home: Number(match.homeScore), away: Number(match.awayScore) };
    for (const [side, row, other] of [['home', home, 'away'], ['away', away, 'home']]) {
      row.played += 1;
      row.goalsFor += goals[side];
      row.goalsAgainst += goals[other];
      row.points += outcome.points[side];
      if (outcome.winner !== side) row.losses += 1;
      else if (outcome.decidedBy === 'regulation') row.regulationWins += 1;
      else row.shootoutWins += 1;
    }
  }
  return { rows: [...rows.values()], issues };
}

// Desempates en este orden: puntos, diferencia de gol, victorias en los 90', victorias totales, goles a favor.
const TIE_BREAKERS = [
  row => row.points,
  row => row.goalsFor - row.goalsAgainst,
  row => row.regulationWins,
  row => row.regulationWins + row.shootoutWins,
  row => row.goalsFor,
];

function compareRows(a, b) {
  for (const key of TIE_BREAKERS) {
    const diff = key(b) - key(a);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Ordena la tabla. Los empates que ningún criterio resuelve no se deciden acá: van en `unresolvedTies` (grupos de
 * nombres) para que el admin decida; dentro de un grupo el orden es alfabético y no tiene valor deportivo.
 */
export function rankStandings(rows) {
  const sorted = [...rows].sort((a, b) => compareRows(a, b) || a.name.localeCompare(b.name));
  const unresolvedTies = [];
  let group = [sorted[0]];
  for (let i = 1; i <= sorted.length; i += 1) {
    if (i < sorted.length && compareRows(sorted[i - 1], sorted[i]) === 0) {
      group.push(sorted[i]);
      continue;
    }
    if (group.length > 1) unresolvedTies.push(group.map(row => row.name));
    group = [sorted[i]];
  }
  return { ranking: sorted.map((row, index) => ({ ...row, position: index + 1 })), unresolvedTies };
}

/** Identidad de un club en el torneo: el nombre sin mayúsculas ni espacios de más (la tabla ya lo comparaba así). */
export const teamKey = name => String(name || '').trim().toLowerCase();

// Por clave y no por el texto: «Boca» en la tabla y «boca» en un partido son el mismo club, y antes ese cruce no
// contaba como jugado y podía proponerse de nuevo.
const pairKey = (a, b) => [teamKey(a), teamKey(b)].sort().join('\u0000');

/**
 * Cruces de una fecha suiza: todos los equipos juegan, nadie repite rival (regla estricta) y se elige el emparejamiento
 * con menor diferencia de puntos (y después de posición) entre rivales. Con 12 equipos hay 10.395 emparejamientos
 * posibles, así que se recorren todos: el resultado es el óptimo, no una aproximación.
 * @param {{ name: string, points: number }[]} ranking tabla ordenada (la posición es el índice)
 * @param {[string, string][]} playedPairs cruces ya jugados
 * @returns {{ ok: true, pairs: [string, string][], cost } | { ok: false, reason: string }}
 */
export function swissPairings(ranking, playedPairs = []) {
  if (ranking.length % 2 !== 0) return { ok: false, reason: `Hace falta un número par de equipos (hay ${ranking.length}).` };
  const played = new Set(playedPairs.map(([a, b]) => pairKey(a, b)));
  const n = ranking.length;
  const cost = (i, j) => (ranking[i].points - ranking[j].points) ** 2 * 1000 + Math.abs(i - j);
  let best = null;
  const used = new Array(n).fill(false);
  const current = [];
  const search = total => {
    if (best && total >= best.cost) return;
    const first = used.indexOf(false);
    if (first === -1) {
      best = { cost: total, pairs: current.map(([i, j]) => [ranking[i].name, ranking[j].name]) };
      return;
    }
    used[first] = true;
    for (let j = first + 1; j < n; j += 1) {
      if (used[j] || played.has(pairKey(ranking[first].name, ranking[j].name))) continue;
      used[j] = true;
      current.push([first, j]);
      search(total + cost(first, j));
      current.pop();
      used[j] = false;
    }
    used[first] = false;
  };
  search(0);
  if (!best) return { ok: false, reason: 'No hay forma de emparejar a todos sin repetir un rival. Hace falta que el admin decida.' };
  return { ok: true, pairs: best.pairs, cost: best.cost };
}

/**
 * Localía de cada cruce: hace de local el que menos veces fue local hasta ahora; si van parejos, el mejor ubicado.
 * Antes el mejor ubicado era siempre local y el puntero podía jugar las 4 fechas en casa.
 * @param {[string, string][]} pairs cruces con el mejor ubicado primero
 * @param {Map<string, number>} homeCounts partidos de local por club (clave teamKey)
 * @returns {[string, string][]} [local, visitante]
 */
export function assignHomeAway(pairs, homeCounts = new Map()) {
  return pairs.map(([higher, lower]) => {
    const homes = name => homeCounts.get(teamKey(name)) || 0;
    return homes(lower) < homes(higher) ? [lower, higher] : [higher, lower];
  });
}

/** Cuartos de la Copa de Oro desde la tabla final: 1-8, 4-5, 2-7, 3-6 (el orden de bracketModel.js). */
export function goldCupQuarterFinals(ranking) {
  if (ranking.length < GOLD_CUP_PLACES) throw new Error(`La Copa de Oro necesita ${GOLD_CUP_PLACES} clasificados (hay ${ranking.length}).`);
  const seed = position => ranking[position - 1].name;
  return [[1, 8], [4, 5], [2, 7], [3, 6]].map(([a, b]) => ({ teamA: seed(a), teamB: seed(b), seedA: a, seedB: b }));
}

const sameName = (a, b) => teamKey(a) === teamKey(b);

/**
 * Ubica un partido terminado de la Konami Cup (resumen del colector, equipos ya traducidos a nombres del torneo) en
 * el cruce del bracket que enfrenta a esos dos equipos. No escribe nada: devuelve qué cambiar para que el admin lo
 * confirme. Los rounds son los de bracketModel.buildCupRounds (Oro y Plata).
 * @param {{ id, matches: { path, index, isFinal, match }[] }[]} rounds
 * @param {{ homeName, awayName, score: { home, away }, shootout: { home, away } | null }} result
 * @returns {{ ok: true, path, index, isFinal, roundId, update } | { ok: false, reason }}
 */
export function placeCupResult(rounds, { homeName, awayName, score, shootout }) {
  const slots = rounds.flatMap(round => round.matches.map(entry => ({ ...entry, roundId: round.id })))
    .filter(({ match }) => (sameName(match.teamA, homeName) && sameName(match.teamB, awayName))
      || (sameName(match.teamA, awayName) && sameName(match.teamB, homeName)));
  if (slots.length === 0) return { ok: false, reason: `Ningún cruce enfrenta a ${homeName} y ${awayName}.` };
  // Los cruces ya jugados no cuentan: dos equipos de cuartos de Oro pueden volver a cruzarse en la final de Plata.
  const open = slots.filter(({ match }) => match.scoreA === '' || match.scoreA == null);
  if (open.length === 0) {
    return { ok: false, reason: `El cruce ${slots[0].title || slots[0].roundId} ya tiene resultado: corregilo a mano si hace falta.` };
  }
  if (open.length > 1) return { ok: false, reason: `Hay ${open.length} cruces sin jugar entre ${homeName} y ${awayName}: elegí cuál a mano.` };
  const [slot] = open;
  const homeIsA = sameName(slot.match.teamA, homeName);
  const pick = (h, a) => (homeIsA ? [h, a] : [a, h]);
  const [scoreA, scoreB] = pick(score.home, score.away);
  const update = { scoreA, scoreB };
  if (shootout) [update.penaltiesA, update.penaltiesB] = pick(shootout.home, shootout.away);
  return { ok: true, path: slot.path, index: slot.index, isFinal: slot.isFinal, roundId: slot.roundId, update };
}

/**
 * Quién pasa en una eliminatoria: 90' (con alargue incluido en el marcador si lo hubo) y, si sigue empatado, la tanda.
 * @returns {'A'|'B'|null} null si falta información
 */
export function knockoutWinner({ scoreA, scoreB, penaltiesA, penaltiesB }) {
  if (!isScore(scoreA) || !isScore(scoreB)) return null;
  if (Number(scoreA) !== Number(scoreB)) return Number(scoreA) > Number(scoreB) ? 'A' : 'B';
  if (!isScore(penaltiesA) || !isScore(penaltiesB) || Number(penaltiesA) === Number(penaltiesB)) return null;
  return Number(penaltiesA) > Number(penaltiesB) ? 'A' : 'B';
}
