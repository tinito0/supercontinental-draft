import { hasScore } from '../../utils/bracketModel.js';
import { leagueMatchOutcome, rankStandings, swissPairings } from '../../utils/competitionRules.js';

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
 * goles a favor; competitionRules.rankStandings). Los empates que nada resuelve no se deciden: van a
 * `unresolvedTies` para que el admin lo vea. Los lugares vacíos quedan al final.
 * @returns {{ league: object[], unresolvedTies: string[][] }}
 */
export function rankLeague(league) {
  const teams = (league || []).filter(team => team?.name && team.name !== EMPTY_SLOT);
  const empty = (league || []).filter(team => !team?.name || team.name === EMPTY_SLOT);
  if (!teams.length) return { league: [...empty], unresolvedTies: [] };
  const byName = new Map(teams.map(team => [team.name, team]));
  const { ranking, unresolvedTies } = rankStandings(teams.map(team => ({
    name: team.name,
    points: Number(team.pts) || 0,
    goalsFor: Number(team.gf) || 0,
    goalsAgainst: Number(team.gc) || 0,
    regulationWins: Number(team.pg) || 0,
    shootoutWins: Number(team.gpen) || 0,
  })));
  return { league: [...ranking.map(row => byName.get(row.name)), ...empty], unresolvedTies };
}

// La liga suiza se juega en 4 fechas (utils/competitionRules.js).
const LEAGUE_ROUNDS = 4;
const roundNumber = round => Number(/fecha\s*(\d+)/i.exec(String(round || ''))?.[1]) || 0;

/**
 * «Sugerir fecha N»: cruces de la próxima fecha suiza con la tabla actual y sin repetir rivales
 * (competitionRules.swissPairings). La fecha 1 la carga el admin: el orden inicial no está definido.
 * @returns {{ ok: true, round: string, pairs: [string, string][] } | { ok: false, reason: string }}
 */
export function suggestSwissRound(data) {
  const matches = data?.matches || [];
  const last = Math.max(0, ...matches.map(match => roundNumber(match.round)));
  if (last < 1) return { ok: false, reason: 'La fecha 1 la carga el admin: cargá sus partidos como «Fecha 1».' };
  if (last >= LEAGUE_ROUNDS) return { ok: false, reason: `Ya están las ${LEAGUE_ROUNDS} fechas de la liga.` };
  if (matches.some(match => roundNumber(match.round) === last && match.status !== 'completed')) {
    return { ok: false, reason: `Terminá la Fecha ${last} antes de sugerir la siguiente.` };
  }
  const { league } = rankLeague(buildAutomaticTournamentReport(data).data.league);
  const ranking = league.filter(team => team.name && team.name !== EMPTY_SLOT).map(team => ({ name: team.name, points: Number(team.pts) || 0 }));
  const playedPairs = matches.filter(match => match.homeTeam && match.awayTeam).map(match => [match.homeTeam, match.awayTeam]);
  const pairing = swissPairings(ranking, playedPairs);
  return pairing.ok ? { ok: true, round: `Fecha ${last + 1}`, pairs: pairing.pairs } : pairing;
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
