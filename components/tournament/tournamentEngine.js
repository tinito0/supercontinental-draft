import { hasScore } from '../../utils/bracketModel.js';

const ZERO_STATS = { pj: 0, pg: 0, gpen: 0, pp: 0, pts: 0, gf: 0, gc: 0 };

// Las filas calculadas desde partidos llevan autoStats: así se recalculan (o vuelven a cero)
// cuando un resultado se corrige o se revierte, sin pisar las estadísticas cargadas a mano.
export function buildAutomaticTournamentData(data) {
  return buildAutomaticTournamentReport(data).data;
}

/**
 * Lo mismo, más los clubes que no entran en la tabla de 12 (`overflow`). Un partido con un club que no está
 * en la tabla agrega una fila; antes la 13.ª se descartaba sin aviso al guardar.
 * @returns {{ data: object, overflow: string[] }}
 */
export function buildAutomaticTournamentReport(data) {
  const next = JSON.parse(JSON.stringify(data));
  const completedMatches = (next.matches || []).filter(match => match.status === 'completed');
  if (completedMatches.length === 0) {
    if (!next.autoStats) return { data: next, overflow: [] };
    next.league = (next.league || []).map(team => (team.autoStats ? { ...team, ...ZERO_STATS, autoStats: false } : team));
    next.topScorers = Array.from({ length: 5 }, () => ({ name: '', team: '', goals: '' }));
    next.topAssisters = Array.from({ length: 5 }, () => ({ name: '', team: '', assists: '' }));
    next.autoStats = false;
    return { data: next, overflow: [] };
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
      if (homeScore > awayScore) { home.pg += 1; home.pts += 2; away.pp += 1; }
      else if (awayScore > homeScore) { away.pg += 1; away.pts += 2; home.pp += 1; }
      else { home.gpen += 1; away.gpen += 1; home.pts += 1; away.pts += 1; }
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
  return { data: next, overflow };
}

const RESULT_FIELDS = ['homeTeam', 'awayTeam', 'homeScore', 'awayScore', 'mvp', 'round', 'status'];

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
