// Totales de temporada a partir de los documentos match_lines (supabase/functions/_shared/matchLines.js): jugadores
// por id del juego, clubes por equipo del draft y récords. Solo cuentan partidos terminados y, si hay lista oficial,
// los importados al torneo (utils/collectorImport.js importedMatchKeys). Puro; tests/seasonStats.test.js.

import { roleLabel } from './matchAnalysis.js';
import { getPosCategory } from './helpers.js';

export const MIN_RATED_MATCHES = 2;
const FULL_MATCH_MINUTES = 90;
const HAT_TRICK = 3;
const FORM_LENGTH = 5;
// Campos de la línea que se suman tal cual.
const SUMMED = [
  'goals', 'ownGoals', 'assists', 'yellow', 'red', 'shots', 'shotsOnTarget', 'passes', 'passesCompleted',
  'tackles', 'tacklesWon', 'interceptions', 'clearances', 'dribblesCompleted', 'saves',
];

const round2 = n => Math.round(n * 100) / 100;
const clubKeyOf = team => team?.draftTeamId || `game-${team?.gameTeamId}`;
const SIDES = ['home', 'away'];

/**
 * Partidos subidos antes de cargar la asignación Draft → PES llegan sin equipo del draft. Si otro partido del mismo
 * equipo del juego sí lo trae (el último gana), se completa, así el club no queda partido en dos.
 */
function withKnownClubs(matches) {
  const known = new Map();
  for (const doc of matches) {
    for (const side of SIDES) {
      if (doc[side]?.draftTeamId) known.set(doc[side].gameTeamId, { draftTeamId: doc[side].draftTeamId, name: doc[side].name });
    }
  }
  const complete = team => (team?.draftTeamId || !known.has(team?.gameTeamId) ? team : { ...team, ...known.get(team.gameTeamId) });
  return matches.map(doc => ({ ...doc, home: complete(doc.home), away: complete(doc.away) }));
}

function countedMatches(docs, officialKeys) {
  return (docs || [])
    .filter(doc => doc?.status === 'finished' && Array.isArray(doc.players))
    .filter(doc => !officialKeys || officialKeys.has(doc.matchKey))
    .sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)));
}

function emptyPlayer(line) {
  return {
    id: line.id, name: null, position: null, clubKey: null, clubName: null,
    apps: 0, starts: 0, minutes: 0, cleanSheets: 0, rated: 0, ratingSum: 0, xg: 0, xgKnown: true,
    ...Object.fromEntries(SUMMED.map(field => [field, 0])),
  };
}

function addLine(total, line, doc) {
  const own = doc[line.side];
  const conceded = doc[line.side === 'home' ? 'away' : 'home'].score;
  const keepsCleanSheet = line.position === 0 && conceded === 0 && (line.minutes ?? 0) >= FULL_MATCH_MINUTES;
  const hasRating = typeof line.rating === 'number';
  return {
    ...total,
    ...Object.fromEntries(SUMMED.map(field => [field, total[field] + (Number(line[field]) || 0)])),
    name: line.name ?? total.name,
    position: line.position ?? total.position,
    clubKey: clubKeyOf(own),
    clubName: own.name ?? total.clubName,
    apps: total.apps + 1,
    starts: total.starts + (line.started ? 1 : 0),
    minutes: total.minutes + (line.minutes ?? 0),
    cleanSheets: total.cleanSheets + (keepsCleanSheet ? 1 : 0),
    rated: total.rated + (hasRating ? 1 : 0),
    ratingSum: total.ratingSum + (hasRating ? line.rating : 0),
    xg: total.xg + (typeof line.xg === 'number' ? line.xg : 0),
    xgKnown: total.xgKnown && typeof line.xg === 'number',
  };
}

function finishPlayer({ ratingSum, xgKnown, ...total }) {
  return {
    ...total,
    rating: total.rated ? round2(ratingSum / total.rated) : null,
    // Un partido sin estimación deja el total sin sentido: mejor no mostrarlo que mostrarlo bajo.
    xg: xgKnown ? round2(total.xg) : null,
  };
}

function seasonPlayers(matches) {
  const totals = new Map();
  for (const doc of matches) {
    for (const line of doc.players) {
      totals.set(line.id, addLine(totals.get(line.id) || emptyPlayer(line), line, doc));
    }
  }
  return [...totals.values()].map(finishPlayer);
}

function resultFor(goalsFor, goalsAgainst) {
  if (goalsFor > goalsAgainst) return 'W';
  return goalsFor < goalsAgainst ? 'L' : 'D';
}

function seasonClubs(matches) {
  const clubs = new Map();
  for (const doc of matches) {
    for (const side of ['home', 'away']) {
      const own = doc[side];
      const other = doc[side === 'home' ? 'away' : 'home'];
      const key = clubKeyOf(own);
      const club = clubs.get(key) || { key, name: null, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, results: [] };
      const result = resultFor(own.score, other.score);
      clubs.set(key, {
        ...club,
        name: own.name ?? club.name,
        played: club.played + 1,
        won: club.won + (result === 'W' ? 1 : 0),
        drawn: club.drawn + (result === 'D' ? 1 : 0),
        lost: club.lost + (result === 'L' ? 1 : 0),
        goalsFor: club.goalsFor + own.score,
        goalsAgainst: club.goalsAgainst + other.score,
        results: [...club.results, { matchKey: doc.matchKey, result }],
      });
    }
  }
  return [...clubs.values()].map(({ results, ...club }) => {
    const newestFirst = [...results].reverse();
    return { ...club, form: newestFirst.slice(0, FORM_LENGTH).map(r => r.result), matchKeys: newestFirst.map(r => r.matchKey) };
  });
}

function seasonRecords(matches) {
  const biggestWin = matches.reduce((best, doc) => {
    const margin = Math.abs(doc.home.score - doc.away.score);
    return margin > 0 && (!best || margin > best.margin) ? { matchKey: doc.matchKey, margin, home: doc.home, away: doc.away } : best;
  }, null);
  const mostGoals = matches.reduce((best, doc) => {
    const goals = doc.home.score + doc.away.score;
    return goals > 0 && (!best || goals > best.goals) ? { matchKey: doc.matchKey, goals, home: doc.home, away: doc.away } : best;
  }, null);
  const hatTricks = matches.flatMap(doc => doc.players
    .filter(line => line.goals >= HAT_TRICK)
    .map(line => ({ matchKey: doc.matchKey, playerId: line.id, name: line.name, goals: line.goals })));
  return { biggestWin, mostGoals, hatTricks };
}

// Equipo de la fecha: un 4-3-3 por línea de la posición registrada (código del juego → sigla → línea).
const ROUND_XI = { keeper: 1, defense: 4, midfield: 3, forward: 3 };

/**
 * Los mejores de una fecha por valoración del juego, en un 4-3-3. Sin valoración o sin posición registrada no entran.
 * @param {object[]} docs documentos match_lines
 * @param {string[]} matchKeys los partidos de la fecha
 * @returns {{ keeper, defense, midfield, forward }|null} null si la fecha no tiene partidos terminados
 */
export function teamOfTheRound(docs, matchKeys) {
  const matches = withKnownClubs(countedMatches(docs, new Set(matchKeys)));
  if (!matches.length) return null;
  const candidates = matches.flatMap(doc => doc.players
    .filter(line => typeof line.rating === 'number' && line.position != null)
    .map(line => ({ ...line, clubName: doc[line.side].name, matchKey: doc.matchKey, line: getPosCategory(roleLabel(line.position)) })));
  const best = (a, b) => b.rating - a.rating || b.goals - a.goals || b.assists - a.assists;
  return Object.fromEntries(Object.entries(ROUND_XI).map(([line, size]) => [
    line, candidates.filter(c => c.line === line).sort(best).slice(0, size),
  ]));
}

/**
 * @param {object[]} docs documentos match_lines
 * @param {{ officialKeys?: Set<string> }} [options] sin lista oficial cuenta todo partido terminado (pretemporada)
 */
export function buildSeasonStats(docs, { officialKeys } = {}) {
  const matches = withKnownClubs(countedMatches(docs, officialKeys));
  return {
    matches: matches.length,
    players: seasonPlayers(matches),
    clubs: seasonClubs(matches),
    records: seasonRecords(matches),
  };
}

/**
 * Partidos oficiales de un jugador, el más nuevo primero: su equipo, el rival, el resultado (W/D/L) y su línea.
 * @param {object[]} docs documentos match_lines
 * @param {number} playerId id del juego
 */
export function playerMatchLog(docs, playerId, { officialKeys } = {}) {
  return withKnownClubs(countedMatches(docs, officialKeys))
    .map(doc => ({ doc, line: doc.players.find(p => p.id === playerId) }))
    .filter(({ line }) => line)
    .map(({ doc, line }) => {
      const own = doc[line.side];
      const rival = doc[line.side === 'home' ? 'away' : 'home'];
      return { matchKey: doc.matchKey, startedAt: doc.startedAt, own, rival, shootout: doc.shootout, result: resultFor(own.score, rival.score), line };
    })
    .reverse();
}

/** Un partido visto desde un club: su lado, el rival y el resultado. */
function fromClubSide(doc, clubKey) {
  const side = clubKeyOf(doc.home) === clubKey ? 'home' : 'away';
  const own = doc[side];
  const rival = doc[side === 'home' ? 'away' : 'home'];
  return { matchKey: doc.matchKey, startedAt: doc.startedAt, side, own, rival, shootout: doc.shootout, result: resultFor(own.score, rival.score) };
}

/** Partidos oficiales de un club, el más nuevo primero. `clubKey` = id del equipo del draft. */
export function clubMatchLog(docs, clubKey, { officialKeys } = {}) {
  return withKnownClubs(countedMatches(docs, officialKeys))
    .filter(doc => clubKeyOf(doc.home) === clubKey || clubKeyOf(doc.away) === clubKey)
    .map(doc => fromClubSide(doc, clubKey))
    .reverse();
}

/** Cara a cara entre dos clubes, contado desde el primero: partidos, resultados, goles y la lista (nuevo primero). */
export function headToHead(docs, clubKey, rivalKey, { officialKeys } = {}) {
  const matches = clubMatchLog(docs, clubKey, { officialKeys }).filter(entry => clubKeyOf(entry.rival) === rivalKey);
  const count = result => matches.filter(entry => entry.result === result).length;
  return {
    played: matches.length,
    won: count('W'),
    drawn: count('D'),
    lost: count('L'),
    goalsFor: matches.reduce((sum, entry) => sum + entry.own.score, 0),
    goalsAgainst: matches.reduce((sum, entry) => sum + entry.rival.score, 0),
    matches,
  };
}

/**
 * Lo que la previa del overlay muestra de un cruce: la forma de cada club (últimos cinco, nuevo primero) y el cara a
 * cara contado desde el local. null si falta un club o ninguno jugó todavía un partido oficial.
 */
export function matchupFacts(docs, homeKey, awayKey, { officialKeys } = {}) {
  if (!homeKey || !awayKey) return null;
  const form = key => clubMatchLog(docs, key, { officialKeys }).slice(0, 5).map(entry => entry.result);
  const homeForm = form(homeKey);
  const awayForm = form(awayKey);
  if (!homeForm.length && !awayForm.length) return null;
  const { played, won, drawn, lost } = headToHead(docs, homeKey, awayKey, { officialKeys });
  return { homeForm, awayForm, h2h: { played, won, drawn, lost } };
}

/**
 * Tabla de líderes de un campo. El promedio de valoración pide MIN_RATED_MATCHES partidos valorados; el resto
 * deja afuera los ceros. Empate: el que jugó menos minutos va arriba.
 */
export function seasonLeaders(players, field, { limit = 10 } = {}) {
  const eligible = field === 'rating'
    ? players.filter(p => p.rating != null && p.rated >= MIN_RATED_MATCHES)
    : players.filter(p => typeof p[field] === 'number' && p[field] > 0);
  return [...eligible].sort((a, b) => b[field] - a[field] || a.minutes - b.minutes).slice(0, limit);
}
