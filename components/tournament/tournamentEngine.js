import { advanceCups, hasScore } from '../../utils/bracketModel.js';
import { assignHomeAway, leagueMatchOutcome, rankStandings, swissPairings, teamKey } from '../../utils/competitionRules.js';

const ZERO_STATS = { pj: 0, pg: 0, gpen: 0, pp: 0, pts: 0, gf: 0, gc: 0 };

// Las filas calculadas desde partidos llevan autoStats: así se recalculan (o vuelven a cero)
// cuando un resultado se corrige o se revierte, sin pisar las estadísticas cargadas a mano.
export function buildAutomaticTournamentData(data) {
  return buildAutomaticTournamentReport(data).data;
}

/**
 * Lo mismo, más los clubes que no entran en la tabla de 12 (`overflow`). Un partido con un club que no está
 * en la tabla agrega una fila; antes la 13.ª se descartaba sin aviso al guardar.
 * Puntos del reglamento (utils/competitionRules.js): victoria en los 90' = 2 (PG), victoria por penales tras empate
 * = 1 (GPEN), derrota = 0 (PP). Un empate sin la tanda cargada suma partido y goles pero no puntos, y va a `issues`.
 * @returns {{ data: object, overflow: string[], issues: { matchId, label, reason }[] }}
 */
export function buildAutomaticTournamentReport(data) {
  const next = JSON.parse(JSON.stringify(data));
  const completedMatches = (next.matches || []).filter(match => match.status === 'completed');
  if (completedMatches.length === 0) {
    if (!next.autoStats) return { data: next, overflow: [], issues: [] };
    next.league = (next.league || []).map(team => (team.autoStats ? { ...team, ...ZERO_STATS, autoStats: false } : team));
    next.topScorers = Array.from({ length: 5 }, () => ({ name: '', team: '', goals: '' }));
    next.topAssisters = Array.from({ length: 5 }, () => ({ name: '', team: '', assists: '' }));
    next.autoStats = false;
    return { data: next, overflow: [], issues: [] };
  }

  const rows = new Map();
  (next.league || []).filter(team => team.name && team.name !== 'Club...').forEach(team => {
    rows.set(team.name.trim().toLowerCase(), { ...team });
  });
  // Un partido "finalizado" sin los dos marcadores no es un resultado: antes Number('') daba 0 y sumaba
  // un empate 0-0. Sus goleadores sí cuentan.
  const resultMatches = completedMatches.filter(match => hasScore(match.homeScore) && hasScore(match.awayScore));
  const teamsWithResults = new Set();
  resultMatches.forEach(match => {
    const homeKey = String(match.homeTeam || '').trim().toLowerCase();
    const awayKey = String(match.awayTeam || '').trim().toLowerCase();
    if (homeKey) teamsWithResults.add(homeKey);
    if (awayKey) teamsWithResults.add(awayKey);
  });
  rows.forEach((team, key) => {
    if (teamsWithResults.has(key)) Object.assign(team, ZERO_STATS, { autoStats: true });
    else if (team.autoStats) Object.assign(team, ZERO_STATS, { autoStats: false });
  });
  const scorers = new Map();
  const assisters = new Map();
  const addStatEntries = (value, team, target) => {
    String(value || '').split(/[,;]+/).map(item => item.trim()).filter(Boolean).forEach(entry => {
      const match = entry.match(/^(.*?)(?:\s*[xX]\s*(\d+))?$/);
      const name = String(match?.[1] || entry).trim();
      const amount = Number(match?.[2] || 1);
      if (!name || !Number.isFinite(amount)) return;
      const key = `${name.toLowerCase()}-${String(team || '').toLowerCase()}`;
      const current = target.get(key) || { name, team, value: 0 };
      current.value += amount;
      target.set(key, current);
    });
  };
  const issues = [];
  const ensureRow = (key, name) => {
    if (!key || !name || rows.has(key)) return;
    rows.set(key, { id: `team-${key.replace(/[^a-z0-9]/g, '-')}`, name, ...ZERO_STATS, autoStats: true });
  };

  completedMatches.forEach(match => {
    const homeKey = String(match.homeTeam || '').trim().toLowerCase();
    const awayKey = String(match.awayTeam || '').trim().toLowerCase();
    ensureRow(homeKey, match.homeTeam);
    ensureRow(awayKey, match.awayTeam);
    const home = rows.get(homeKey);
    const away = rows.get(awayKey);
    const homeScore = Number(match.homeScore);
    const awayScore = Number(match.awayScore);
    if (home && away && resultMatches.includes(match)) {
      home.pj += 1; away.pj += 1; home.gf += homeScore; home.gc += awayScore; away.gf += awayScore; away.gc += homeScore;
      const outcome = leagueMatchOutcome(match);
      if (!outcome.ok) {
        issues.push({ matchId: match.id, label: `${match.homeTeam} vs ${match.awayTeam}`, reason: outcome.reason });
      } else {
        const [winner, loser] = outcome.winner === 'home' ? [home, away] : [away, home];
        winner[outcome.decidedBy === 'regulation' ? 'pg' : 'gpen'] += 1;
        winner.pts += outcome.points[outcome.winner];
        loser.pp += 1;
      }
    }
    addStatEntries(match.homeGoals, match.homeTeam, scorers);
    addStatEntries(match.awayGoals, match.awayTeam, scorers);
    addStatEntries(match.homeAssists, match.homeTeam, assisters);
    addStatEntries(match.awayAssists, match.awayTeam, assisters);
  });

  const allRows = [...rows.values()];
  const overflow = allRows.slice(12).map(row => row.name).filter(Boolean);
  next.league = allRows.slice(0, 12);
  while (next.league.length < 12) {
    next.league.push({ id: crypto.randomUUID(), name: 'Club...', pj: 0, pg: 0, gpen: 0, pp: 0, pts: 0, gf: 0, gc: 0 });
  }
  next.topScorers = [...scorers.values()].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)).slice(0, 5).map(item => ({ name: item.name, team: item.team, goals: item.value }));
  next.topAssisters = [...assisters.values()].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)).slice(0, 5).map(item => ({ name: item.name, team: item.team, assists: item.value }));
  while (next.topScorers.length < 5) next.topScorers.push({ name: '', team: '', goals: '' });
  while (next.topAssisters.length < 5) next.topAssisters.push({ name: '', team: '', assists: '' });
  next.autoStats = true;
  return { data: next, overflow, issues };
}

const EMPTY_SLOT = 'Club...';

/**
 * Ordena la tabla con los desempates del reglamento (puntos, diferencia, victorias en los 90', victorias totales,
 * goles a favor; competitionRules.rankStandings). Los empates que nada resuelve no se inventan: si el admin fijó un
 * orden para ese grupo (`tieBreakOrder`, nombres de club) se usa; si no, van a `unresolvedTies`. Los lugares vacíos
 * quedan al final.
 * @param {object[]} league
 * @param {string[]} [tieBreakOrder] orden elegido por el admin; solo vale dentro de un empate sin resolver
 * @returns {{ league: object[], unresolvedTies: string[][] }}
 */
export function rankLeague(league, tieBreakOrder = []) {
  const teams = (league || []).filter(team => team?.name && team.name !== EMPTY_SLOT);
  const empty = (league || []).filter(team => !team?.name || team.name === EMPTY_SLOT);
  if (!teams.length) return { league: [...empty], unresolvedTies: [] };
  // Cada fila conserva su lugar aunque dos tengan el mismo nombre (antes una pisaba a la otra).
  const rows = teams.map((team, index) => ({
    key: index,
    name: team.name,
    points: Number(team.pts) || 0,
    goalsFor: Number(team.gf) || 0,
    goalsAgainst: Number(team.gc) || 0,
    regulationWins: Number(team.pg) || 0,
    shootoutWins: Number(team.gpen) || 0,
  }));
  const { ranking, unresolvedTies } = rankStandings(rows);
  const order = (Array.isArray(tieBreakOrder) ? tieBreakOrder : []).map(teamKey);
  const ordered = [...ranking];
  const stillTied = [];
  for (const group of unresolvedTies) {
    const keys = group.map(teamKey);
    if (!keys.every(key => order.includes(key))) {
      stillTied.push(group);
      continue;
    }
    const first = ordered.findIndex(row => keys.includes(teamKey(row.name)));
    const members = ordered.slice(first, first + group.length)
      .sort((a, b) => order.indexOf(teamKey(a.name)) - order.indexOf(teamKey(b.name)));
    ordered.splice(first, group.length, ...members);
  }
  return { league: [...ordered.map(row => teams[row.key]), ...empty], unresolvedTies: stillTied };
}

// La liga suiza se juega en 4 fechas (utils/competitionRules.js).
export const LEAGUE_ROUNDS = 4;
export const roundNumber = round => Number(/fecha\s*(\d+)/i.exec(String(round || ''))?.[1]) || 0;
const leagueTeamNames = league => (league || []).map(team => team?.name).filter(name => name && name !== EMPTY_SLOT);

/** Última fecha cargada en el fixture (0 si no hay ninguna). */
export function lastRound(matches) {
  return Math.max(0, ...(matches || []).map(match => roundNumber(match.round)));
}

/**
 * Si la fecha N está terminada: cada club de la tabla jugó exactamente una vez y todos los partidos están finalizados
 * con un resultado válido (un empate necesita la tanda). Una fecha con un partido postergado, sin marcador o con un
 * club que falta no está terminada, y se dice por qué.
 * @returns {{ complete: true } | { complete: false, reason: string }}
 */
export function roundStatus(data, n) {
  const matches = (data?.matches || []).filter(match => roundNumber(match.round) === n);
  if (!matches.length) return { complete: false, reason: `La Fecha ${n} no tiene partidos.` };
  const pending = matches.filter(match => match.status !== 'completed');
  if (pending.length) {
    const kind = pending.some(match => match.status === 'postponed') ? 'postergados o sin jugar' : 'sin jugar';
    return { complete: false, reason: `La Fecha ${n} tiene ${pending.length} ${pending.length === 1 ? 'partido' : 'partidos'} ${kind}.` };
  }
  const invalid = matches.map(match => ({ match, outcome: leagueMatchOutcome(match) })).find(({ outcome }) => !outcome.ok);
  if (invalid) return { complete: false, reason: `${invalid.match.homeTeam} vs ${invalid.match.awayTeam}: ${invalid.outcome.reason}` };
  const appearances = new Map();
  for (const match of matches) {
    for (const name of [match.homeTeam, match.awayTeam]) appearances.set(teamKey(name), (appearances.get(teamKey(name)) || 0) + 1);
  }
  const names = leagueTeamNames(data?.league);
  const repeated = names.filter(name => (appearances.get(teamKey(name)) || 0) > 1);
  if (repeated.length) return { complete: false, reason: `En la Fecha ${n} juegan dos veces: ${repeated.join(', ')}.` };
  const missing = names.filter(name => !appearances.has(teamKey(name)));
  if (missing.length) return { complete: false, reason: `En la Fecha ${n} no jugaron: ${missing.join(', ')}.` };
  return { complete: true };
}

/** Id fijo de un partido generado: así la misma fecha nunca se agrega dos veces. */
export const swissMatchId = (round, index) => `swiss-r${round}-${index + 1}`;

/**
 * Cruces de la próxima fecha suiza con la tabla actual, sin repetir rivales (competitionRules.swissPairings) y con la
 * localía repartida (assignHomeAway). La fecha 1 la carga el admin: el orden inicial no está definido.
 * @returns {{ ok: true, round: string, roundNumber: number, pairs: [string, string][], matches: object[] }
 *          | { ok: false, reason: string }}
 */
export function suggestSwissRound(data) {
  const matches = data?.matches || [];
  const last = lastRound(matches);
  if (last < 1) return { ok: false, reason: 'La fecha 1 la carga el admin: cargá sus partidos como «Fecha 1».' };
  if (last >= LEAGUE_ROUNDS) return { ok: false, reason: `Ya están las ${LEAGUE_ROUNDS} fechas de la liga.` };
  const status = roundStatus(data, last);
  if (!status.complete) return { ok: false, reason: `Terminá la Fecha ${last} antes de armar la siguiente. ${status.reason}` };
  const { league } = rankLeague(buildAutomaticTournamentReport(data).data.league, data?.tieBreakOrder);
  const ranking = league.filter(team => team.name && team.name !== EMPTY_SLOT).map(team => ({ name: team.name, points: Number(team.pts) || 0 }));
  const playedPairs = matches.filter(match => match.homeTeam && match.awayTeam).map(match => [match.homeTeam, match.awayTeam]);
  const pairing = swissPairings(ranking, playedPairs);
  if (!pairing.ok) return pairing;
  const homeCounts = new Map();
  for (const match of matches) {
    if (match.homeTeam) homeCounts.set(teamKey(match.homeTeam), (homeCounts.get(teamKey(match.homeTeam)) || 0) + 1);
  }
  const next = last + 1;
  const pairs = assignHomeAway(pairing.pairs, homeCounts);
  return {
    ok: true,
    round: `Fecha ${next}`,
    roundNumber: next,
    pairs,
    matches: pairs.map(([homeTeam, awayTeam], index) => ({
      id: swissMatchId(next, index), round: `Fecha ${next}`, homeTeam, awayTeam, homeScore: '', awayScore: '', date: '', time: '',
      mvp: '', homeGoals: '', awayGoals: '', homeAssists: '', awayAssists: '', homeConfirmed: false, awayConfirmed: false,
      status: 'scheduled', generated: true,
    })),
  };
}

/**
 * Fecha suiza automática (decisión del usuario, 2026-10-22): cuando la última fecha queda terminada, la próxima se
 * arma y se publica en el mismo guardado. Idempotente: con la fecha siguiente ya cargada no hace nada, y una fecha que
 * ya se generó una vez (`swissStatus.generatedRounds`) no se vuelve a generar aunque el admin la borre para cargarla
 * a mano. Si no se puede emparejar (revancha inevitable, número impar) se guarda el motivo en `swissStatus.blocked`.
 * @returns {{ data: object, generated: string | null, blocked: { round: number, reason: string } | null }}
 */
export function applyAutomaticSwiss(data) {
  const matches = data?.matches || [];
  const generatedRounds = Array.isArray(data?.swissStatus?.generatedRounds) ? data.swissStatus.generatedRounds : [];
  const last = lastRound(matches);
  const keep = blocked => ({ data: withSwissStatus(data, generatedRounds, blocked), generated: null, blocked });
  if (last < 1 || last >= LEAGUE_ROUNDS || generatedRounds.includes(last + 1)) return keep(null);
  if (!roundStatus(data, last).complete) return keep(null);
  const suggestion = suggestSwissRound(data);
  if (!suggestion.ok) return keep({ round: last + 1, reason: suggestion.reason });
  const existingIds = new Set(matches.map(match => match.id));
  const next = { ...data, matches: [...matches, ...suggestion.matches.filter(match => !existingIds.has(match.id))] };
  return { data: withSwissStatus(next, [...generatedRounds, suggestion.roundNumber], null), generated: suggestion.round, blocked: null };
}

function withSwissStatus(data, generatedRounds, blocked) {
  const current = data?.swissStatus;
  if (!current && !generatedRounds.length && !blocked) return data;
  const same = current
    && JSON.stringify(current.generatedRounds || []) === JSON.stringify(generatedRounds)
    && JSON.stringify(current.blocked || null) === JSON.stringify(blocked || null);
  return same ? data : { ...data, swissStatus: { generatedRounds, blocked: blocked || null } };
}

/**
 * Todo lo que se recalcula al guardar el torneo, en un solo lugar (gestor del torneo, importación del colector y
 * services/tournamentService.js dentro de la transacción): tabla y goleadores desde los partidos → orden con
 * desempates → fecha suiza automática → avance de las copas. Puro y determinista: guardar dos veces no suma nada.
 * @returns {{ ok: true, data: object, issues: string[], unresolvedTies: string[][], warnings: string[],
 *             generatedRound: string | null, cupChanges: string[] } | { ok: false, error: string }}
 */
export function finalizeTournament(input) {
  const { data: computed, overflow, issues } = buildAutomaticTournamentReport(input);
  if (overflow.length > 0) {
    return { ok: false, error: `La tabla tendría ${12 + overflow.length} clubes y la liga admite 12. No entran: ${overflow.join(', ')}. Revisá el nombre de esos clubes en los partidos o quitá un club de la tabla.` };
  }
  const ranked = rankLeague(computed.league, computed.tieBreakOrder);
  const swiss = applyAutomaticSwiss({ ...computed, league: ranked.league });
  let data = swiss.data;
  const leagueComplete = lastRound(data.matches) >= LEAGUE_ROUNDS && roundStatus(data, LEAGUE_ROUNDS).complete;
  const cups = advanceCups(data.bracket, ranked.league, { leagueComplete });
  if (cups.bracket !== data.bracket) data = { ...data, bracket: cups.bracket };
  return {
    ok: true,
    data,
    issues: issues.map(issue => `${issue.label}: ${issue.reason}`),
    unresolvedTies: ranked.unresolvedTies,
    warnings: [...(swiss.blocked ? [`Fecha ${swiss.blocked.round}: ${swiss.blocked.reason}`] : []), ...cups.warnings],
    generatedRound: swiss.generated,
    cupChanges: cups.changes,
  };
}

const RESULT_FIELDS = ['homeTeam', 'awayTeam', 'homeScore', 'awayScore', 'homePenalties', 'awayPenalties', 'mvp', 'round', 'status'];

/**
 * Partidos finalizados cuyo resultado es nuevo o cambió respecto de la versión guardada.
 * Guardar el torneo publicaba una noticia por CADA partido finalizado con publishedAt nuevo, así que los
 * resultados viejos volvían al tope del feed en cada guardado.
 */
export function getMatchesWithNewResults(previousMatches, nextMatches) {
  const previousById = new Map((previousMatches || []).filter(match => match?.id).map(match => [match.id, match]));
  return (nextMatches || []).filter(match => {
    if (!match?.id || match.status !== 'completed') return false;
    const previous = previousById.get(match.id);
    if (!previous) return true;
    return RESULT_FIELDS.some(field => String(previous[field] ?? '') !== String(match[field] ?? ''));
  });
}

/**
 * Partidos que tenían resultado publicado y ya no (volvieron a programado, se postergaron o se borraron): su noticia
 * `news/match-{id}` se borra. Antes quedaba publicada un resultado que ya no existía.
 * @returns {string[]} ids
 */
export function getRevertedResults(previousMatches, nextMatches) {
  const nextById = new Map((nextMatches || []).filter(match => match?.id).map(match => [match.id, match]));
  return (previousMatches || [])
    .filter(match => match?.id && match.status === 'completed' && nextById.get(match.id)?.status !== 'completed')
    .map(match => match.id);
}
