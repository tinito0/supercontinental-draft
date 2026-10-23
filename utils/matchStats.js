// Estadísticas del registro de partidos (/partidos/:matchKey): secciones de equipo, lista de tiros y fichas de
// jugador, desde el resumen que sube el bridge (pes-collector/collector/matchSummary.js). Puro;
// tests/matchStats.test.js. Reglas: un valor que el colector no midió es null y su fila no aparece (nunca 0); un
// porcentaje sin denominador es null; cada fila dice cómo se calcula (docs/MATCH_ANALYTICS.md).
import { minuteLabel, playerName } from './matchCenter.js';

const SIDES = ['home', 'away'];
const isCount = value => Number.isFinite(value);

/** Porcentaje entero de made/total; null sin denominador o con datos faltantes. */
export function percent(made, total) {
  if (!isCount(made) || !isCount(total) || total <= 0) return null;
  return Math.round((made / total) * 100);
}

const ratio = (made, total) => (isCount(made) && isCount(total) ? { made, total, pct: percent(made, total) } : null);
const count = value => (isCount(value) ? value : null);

// Goles con un tiro propio (kind 0 de los jugadores): no incluye los goles en contra del rival.
function shotGoals(summary, side) {
  const players = summary?.players?.[side];
  if (!Array.isArray(players) || !players.length) return null;
  return players.reduce((sum, player) => sum + (player.stats?.goals || 0), 0);
}

/** Filas de estadísticas: get(ctx) devuelve un número, { made, total, pct } o null (no medido). */
export const STAT_ROWS = {
  shots: { label: 'Tiros', help: 'Remates del equipo (penales en juego incluidos, la tanda no).', get: c => count(c.stats.shots) },
  shotsOnTarget: { label: 'Tiros al arco', help: 'Remates que iban al arco, goles incluidos.', get: c => count(c.stats.shotsOnTarget) },
  shotsOffTarget: {
    label: 'Desviados o bloqueados',
    help: 'Tiros − tiros al arco. El juego no separa los desviados de los bloqueados.',
    get: c => (isCount(c.stats.shots) && isCount(c.stats.shotsOnTarget) ? c.stats.shots - c.stats.shotsOnTarget : null),
  },
  shotGoals: { label: 'Goles de tiro', help: 'Goles de jugadores del equipo; los goles en contra del rival no cuentan.', get: c => c.shotGoals },
  onTargetRate: { label: 'Precisión de tiro', help: 'Tiros al arco ÷ tiros.', get: c => ratio(c.stats.shotsOnTarget, c.stats.shots) },
  conversion: { label: 'Conversión', help: 'Goles de tiro ÷ tiros.', get: c => ratio(c.shotGoals, c.stats.shots) },
  penaltyShots: { label: 'Penales en juego', help: 'Penales pateados durante el partido (no la tanda).', get: c => count(c.stats.penaltyShots) },
  passes: { label: 'Pases', help: 'Pases intentados de todo tipo.', get: c => count(c.stats.passes) },
  passAccuracy: { label: 'Pases precisos', help: 'Pases completados ÷ pases.', get: c => ratio(c.stats.passesCompleted, c.stats.passes) },
  shortPasses: { label: 'Pases cortos', help: 'Completados ÷ intentados.', get: c => ratio(c.stats.shortPassesCompleted, c.stats.shortPasses) },
  throughPasses: { label: 'Pases filtrados', help: 'Completados ÷ intentados.', get: c => ratio(c.stats.throughPassesCompleted, c.stats.throughPasses) },
  longPasses: { label: 'Pases largos', help: 'Completados ÷ intentados.', get: c => ratio(c.stats.longPassesCompleted, c.stats.longPasses) },
  crosses: {
    label: 'Centros',
    help: 'Completados ÷ intentados (solo la cantidad en partidos grabados antes de medirlos).',
    get: c => ratio(c.stats.crossesCompleted, c.stats.crosses) ?? count(c.stats.crosses),
  },
  freeKicks: { label: 'Tiros libres', help: 'Tiros libres a favor.', get: c => count(c.stats.freeKicks) },
  corners: { label: 'Córners', help: 'Tiros de esquina a favor.', get: c => count(c.stats.corners) },
  touches: { label: 'Toques', help: 'Toques de pelota de todos los jugadores.', get: c => count(c.stats.touches) },
  interceptions: { label: 'Intercepciones', help: 'Pases rivales cortados.', get: c => count(c.stats.interceptions) },
  tacklesWon: { label: 'Entradas ganadas', help: 'La fila «Entradas» de la pantalla del juego.', get: c => count(c.stats.tacklesWon) },
  clearances: { label: 'Despejes', help: 'Despejes de la defensa.', get: c => count(c.stats.clearances) },
  saves: { label: 'Atajadas', help: 'Tiros al arco atajados por el arquero.', get: c => count(c.stats.saves) },
  duels: {
    label: 'Duelos ganados',
    help: 'Entradas ganadas ÷ duelos defensivos disputados (la fila «Duelos» de cada jugador en el juego).',
    get: c => ratio(c.stats.tacklesWon, c.stats.tackles),
  },
  dribbles: { label: 'Gambetas logradas', help: 'Gambetas completadas ÷ intentadas.', get: c => ratio(c.stats.dribblesCompleted, c.stats.dribbles) },
  fouls: { label: 'Faltas', help: 'Faltas cometidas.', get: c => count(c.stats.fouls) },
  offsides: { label: 'Fueras de juego', help: 'Posiciones adelantadas cobradas.', get: c => count(c.stats.offsides) },
  yellowCards: { label: 'Tarjetas amarillas', help: 'Amarillas recibidas (la segunda también cuenta).', get: c => count(c.stats.yellowCards) },
  redCards: { label: 'Tarjetas rojas', help: 'Rojas recibidas, directas o por doble amarilla.', get: c => count(c.stats.redCards) },
};

export const STAT_SECTIONS = [
  { id: 'principales', title: 'Estadísticas principales', rows: ['shots', 'shotsOnTarget', 'passes', 'passAccuracy', 'corners', 'fouls', 'saves', 'yellowCards'] },
  { id: 'tiros', title: 'Tiros', rows: ['shots', 'shotsOnTarget', 'shotsOffTarget', 'shotGoals', 'onTargetRate', 'conversion', 'penaltyShots'] },
  { id: 'pases', title: 'Pases', rows: ['passes', 'passAccuracy', 'shortPasses', 'throughPasses', 'longPasses', 'crosses', 'freeKicks', 'corners'] },
  { id: 'defensa', title: 'Defensa', rows: ['interceptions', 'tacklesWon', 'clearances', 'saves'] },
  { id: 'duelos', title: 'Duelos y pelota', rows: ['duels', 'dribbles', 'touches'] },
  { id: 'disciplina', title: 'Disciplina', rows: ['fouls', 'offsides', 'yellowCards', 'redCards'] },
];

const numeric = value => (value && typeof value === 'object' ? value.pct : value);

/** «44/54 (81 %)», «81 %» sin intentos conocidos, o el número. */
export function formatStat(value) {
  if (value == null) return '—';
  if (typeof value === 'object') return value.pct == null ? `${value.made}/${value.total}` : `${value.made}/${value.total} (${value.pct} %)`;
  return String(value);
}

/** Una fila lista para dibujar, o null si ningún lado la midió. */
function buildRow(key, contexts) {
  const spec = STAT_ROWS[key];
  const home = spec.get(contexts.home);
  const away = spec.get(contexts.away);
  if (home == null && away == null) return null;
  const isRatio = [home, away].some(v => v && typeof v === 'object');
  const h = numeric(home) ?? 0;
  const a = numeric(away) ?? 0;
  // Barras: un porcentaje se dibuja contra 100; una cantidad, contra la suma de los dos lados.
  const scale = isRatio ? 100 : (h + a) || 1;
  return {
    key, label: spec.label, help: spec.help, home, away,
    display: { home: formatStat(home), away: formatStat(away) },
    share: { home: (h / scale) * 100, away: (a / scale) * 100 },
    leader: h > a ? 'home' : a > h ? 'away' : null,
  };
}

/** Secciones con sus filas medidas; vacío sin estadísticas de equipo. */
export function statSections(summary) {
  if (!summary?.teamStats?.home || !summary?.teamStats?.away) return [];
  const contexts = Object.fromEntries(SIDES.map(side => [side, { stats: summary.teamStats[side], shotGoals: shotGoals(summary, side) }]));
  const sections = STAT_SECTIONS.map(section => ({
    id: section.id, title: section.title, rows: section.rows.map(key => buildRow(key, contexts)).filter(Boolean),
  }));
  const possession = summary.possession;
  if (possession && Number.isFinite(possession.home) && Number.isFinite(possession.away)) {
    sections[0].rows.unshift({
      key: 'possession', label: 'Posesión', help: 'Tiempo con la pelota, contado por el juego. Puede diferir en 1 punto de su pantalla.',
      home: possession.home, away: possession.away,
      display: { home: `${possession.home} %`, away: `${possession.away} %` },
      share: { home: possession.home, away: possession.away }, leader: null,
    });
  }
  return sections.filter(section => section.rows.length);
}

export const SHOT_OUTCOMES = {
  goal: 'Gol',
  on_target: 'Al arco, sin gol',
  off_target: 'Desviado o bloqueado',
};

/** Tiros del partido en orden; [] en partidos grabados antes de medirlos (summary.shots ausente). */
export function shotRows(summary) {
  const shots = Array.isArray(summary?.shots) ? summary.shots : [];
  return shots.map((shot, index) => ({
    index,
    side: shot.side,
    playerId: shot.playerId,
    name: playerName(summary, shot.playerId),
    clock: shot.clock,
    minute: shot.clock ? minuteLabel(shot.clock) : '—',
    period: shot.clock?.period ?? null,
    outcome: shot.outcome,
    outcomeLabel: SHOT_OUTCOMES[shot.outcome] || shot.outcome,
    penalty: Boolean(shot.penalty),
  }));
}

/** Minuto final de lo jugado: el reloj del resumen (90 o 120 al terminar). */
function endMinute(summary) {
  return summary?.clock?.minute ?? null;
}

/**
 * Minutos jugados: desde el inicio o el minuto en que entró hasta el final, el cambio o la roja.
 * Calculado (no lo da el juego); null si no se sabe el minuto final.
 */
export function minutesPlayed(summary, side, id) {
  const end = endMinute(summary);
  if (end == null) return null;
  const subs = (summary.substitutions || []).filter(sub => sub.side === side);
  const cameOn = subs.find(sub => sub.onId === id);
  const started = (summary.lineups?.[side]?.starting || []).includes(id);
  if (!started && !cameOn) return null;
  const from = started ? 0 : cameOn.clock?.minute ?? null;
  const wentOff = subs.find(sub => sub.offId === id)?.clock?.minute;
  const sentOff = (summary.cards || []).find(card => card.playerId === id && card.type === 'red')?.clock?.minute;
  const until = Math.min(end, wentOff ?? end, sentOff ?? end);
  return from == null ? null : Math.max(0, until - from);
}

const PLAYER_GROUPS = [
  { title: 'Ataque', rows: [
    ['Goles', s => count(s.goals)], ['Asistencias', s => count(s.assists)], ['Tiros', s => count(s.shots)],
    ['Tiros al arco', s => count(s.shotsOnTarget)], ['Goles de tiro libre', s => count(s.freeKickGoals)],
    ['Goles de penal', s => count(s.penaltyGoals)], ['Gambetas logradas', s => ratio(s.dribblesCompleted, s.dribbles)],
    ['Toques', s => count(s.touches)],
  ] },
  { title: 'Pases', rows: [
    ['Pases precisos', s => ratio(s.passesCompleted, s.passes)], ['Pases cortos', s => ratio(s.shortPassesCompleted, s.shortPasses)],
    ['Pases filtrados', s => ratio(s.throughPassesCompleted, s.throughPasses)], ['Pases largos', s => ratio(s.longPassesCompleted, s.longPasses)],
    ['Centros', s => ratio(s.crossesCompleted, s.crosses) ?? count(s.crosses)],
  ] },
  { title: 'Defensa', rows: [
    ['Duelos ganados', s => ratio(s.tacklesWon, s.tackles)], ['Intercepciones', s => count(s.interceptions)],
    ['Despejes', s => count(s.clearances)], ['Faltas', s => count(s.fouls)], ['Fueras de juego', s => count(s.offsides)],
  ] },
  { title: 'Arquero', rows: [
    ['Tiros recibidos', s => count(s.shotsFaced)], ['Tiros al arco recibidos', s => count(s.shotsOnTargetFaced)],
    ['Atajadas', s => count(s.saves)],
  ] },
];

/** Ficha de un jugador que jugó: grupos de estadísticas (solo las medidas) y sus tiros. */
export function playerProfile(summary, side, id) {
  const entry = (summary?.players?.[side] || []).find(player => player.id === id);
  const stats = entry?.stats || {};
  const groups = PLAYER_GROUPS.map(group => ({
    title: group.title,
    rows: group.rows.map(([label, get]) => ({ label, value: get(stats) }))
      .filter(row => row.value != null && (row.value?.total ?? row.value) !== 0),
  })).filter(group => group.rows.length);
  return {
    id, side,
    name: playerName(summary, id),
    number: summary?.teamPlans?.[side]?.numbers?.[id] ?? null,
    position: summary?.names?.positions?.[id] ?? null,
    minutes: minutesPlayed(summary, side, id),
    hasStats: Boolean(entry),
    groups,
    shots: shotRows(summary).filter(shot => shot.playerId === id && shot.side === side),
  };
}

const LEADER_STATS = [
  { key: 'shots', label: 'Tiros' },
  { key: 'passesCompleted', label: 'Pases completados' },
  { key: 'touches', label: 'Toques' },
  { key: 'dribblesCompleted', label: 'Gambetas logradas' },
  { key: 'interceptions', label: 'Intercepciones' },
  { key: 'tacklesWon', label: 'Entradas ganadas' },
];

/** Los tres mejores de cada estadística entre los dos equipos (solo valores > 0). */
export function playerLeaders(summary, limit = 3) {
  const everyone = SIDES.flatMap(side => (summary?.players?.[side] || []).map(player => ({ side, player })));
  return LEADER_STATS.map(stat => ({
    ...stat,
    players: everyone
      .filter(({ player }) => (player.stats?.[stat.key] || 0) > 0)
      .sort((a, b) => b.player.stats[stat.key] - a.player.stats[stat.key])
      .slice(0, limit)
      .map(({ side, player }) => ({ side, id: player.id, name: playerName(summary, player.id), value: player.stats[stat.key] })),
  })).filter(stat => stat.players.length);
}
