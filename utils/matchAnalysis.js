// Análisis del partido (/partidos/:matchKey, pestañas Resumen, Alineaciones, Táctica y Análisis): dominio por minuto,
// tramos de 15 minutos, la formación en la cancha, el plan de juego y de dónde sale cada dato. Puro;
// tests/matchAnalysis.test.js; métodos y límites en docs/MATCH_ANALYTICS.md.
import { instructionByCode } from './advancedInstructions.js';
import { PES_POSITION_MAP } from './formationStates.js';
import { minuteLabel, playerName } from './matchCenter.js';
import { percent } from './matchStats.js';

const SIDES = ['home', 'away'];

/** Siglas de los roles del juego en orden de código (0 PT … 12 DC). */
export const ROLE_LABELS = Object.keys(PES_POSITION_MAP).sort((a, b) => PES_POSITION_MAP[a] - PES_POSITION_MAP[b]);
export const roleLabel = role => ROLE_LABELS[role] ?? null;

// --- Dominio (modelo, no lo da el juego) --------------------------------------------------------------------------

/**
 * Peso de cada acción en el dominio. Un tiro al arco suma 2 (tiro + al arco); córners, centros y pases filtrados
 * suman medio punto: llegar al área sin rematar pesa menos que rematar. Pesos elegidos a mano, no calibrados.
 */
export const MOMENTUM_WEIGHTS = { shots: 1, shotsOnTarget: 1, corners: 0.5, crosses: 0.5, throughPasses: 0.5 };
/** Lo que queda del dominio de un minuto en el siguiente (memoria corta: la mitad). Se reinicia en cada tiempo. */
export const MOMENTUM_DECAY = 0.5;
const PERIOD_START = { 1: 0, 2: 45, 3: 90, 4: 105 };
const PERIOD_LAST = { 1: 44, 2: 89, 3: 104, 4: 119 };

function seriesColumns(series) {
  const n = series.kinds.length;
  return Object.fromEntries(series.kinds.map((name, i) => [name, { home: 2 + i, away: 2 + n + i }]));
}

/**
 * Tiempo de juego de un reloj: un penal en juego informa el tiempo 5 (se deduce por el minuto) y, sin alargue,
 * el tiempo 3 cerca del 90' es descuento del segundo.
 */
export function playPeriod(clock, extraTime) {
  let period = clock?.period;
  if (!(period >= 1 && period <= 4)) {
    const minute = clock?.minute ?? 0;
    period = minute >= 105 ? 4 : minute >= 90 ? 3 : minute >= 45 ? 2 : 1;
  }
  return extraTime ? period : Math.min(period, 2);
}

/** Último tiempo jugado: el mayor de la serie o del reloj (3–4 solo con alargue). */
function lastPeriod(summary, rows) {
  const fromRows = Math.max(0, ...rows.map(row => row[0]));
  const fromClock = summary.clock ? playPeriod(summary.clock, Boolean(summary.match?.extraTime)) : 0;
  return Math.max(fromRows, fromClock, 1);
}

/**
 * Dominio minuto a minuto: Σ peso × (local − visitante) de las acciones de ese minuto, más MOMENTUM_DECAY del minuto
 * anterior. Positivo = domina el local. null si el partido no tiene serie por minuto (grabado antes de medirla).
 * @returns {null | { points: {period, minute, value, home, away}[], max, from, goals: {period, minute, side}[] }}
 */
export function momentum(summary) {
  const series = summary?.series;
  if (!series?.kinds || !Array.isArray(series.rows) || !series.rows.length) return null;
  const columns = seriesColumns(series);
  const byMinute = new Map(series.rows.map(row => [`${row[0]}:${row[1]}`, row]));
  const weightOf = (row, side) => Object.entries(MOMENTUM_WEIGHTS)
    .reduce((sum, [name, weight]) => sum + (columns[name] ? (row[columns[name][side]] || 0) * weight : 0), 0);
  const last = lastPeriod(summary, series.rows);
  const isLive = summary.status === 'live';
  const points = [];
  for (let period = 1; period <= last; period += 1) {
    const seen = series.rows.filter(row => row[0] === period).map(row => row[1]);
    let end = Math.max(PERIOD_LAST[period], ...seen);
    if (isLive && period === last && summary.clock?.minute != null) end = Math.min(end, Math.max(summary.clock.minute, ...seen));
    let carried = 0;
    for (let minute = PERIOD_START[period]; minute <= end; minute += 1) {
      const row = byMinute.get(`${period}:${minute}`);
      const home = row ? weightOf(row, 'home') : 0;
      const away = row ? weightOf(row, 'away') : 0;
      carried = home - away + MOMENTUM_DECAY * carried;
      points.push({ period, minute, value: Math.round(carried * 100) / 100, home, away });
    }
  }
  const extraTime = Boolean(summary.match?.extraTime);
  const goals = (summary.goals || [])
    .filter(goal => goal.clock)
    .map(goal => ({ period: Math.min(playPeriod(goal.clock, extraTime), last), minute: goal.clock.minute, side: goal.side }));
  return { points, max: Math.max(1, ...points.map(p => Math.abs(p.value))), from: series.from || null, goals };
}

// --- Tramos de 15 minutos (contadores del juego) ------------------------------------------------------------------

const BUCKET_LABELS = ["0'–15'", "15'–30'", "30'–45'", "45'–60'", "60'–75'", "75'–90'", 'Alargue 1', 'Alargue 2'];

const bucketValue = (buckets, side, name, i) => buckets?.[side]?.[name]?.[i];

/**
 * Filas por tramo: tiros, tiros al arco, pases (precisión), toques, córners y centros de cada lado. El tiempo
 * agregado cae en el último tramo de su tiempo. Los tramos de alargue solo aparecen si hubo alargue o tienen datos.
 */
export function bucketRows(summary) {
  const buckets = summary?.buckets;
  if (!buckets?.home || !buckets?.away) return [];
  const rows = [];
  for (let i = 0; i < BUCKET_LABELS.length; i += 1) {
    const value = (side, name) => bucketValue(buckets, side, name, i) ?? null;
    const any = SIDES.some(side => Object.keys(buckets[side]).some(name => value(side, name) > 0));
    if (i >= 6 && !summary.match?.extraTime && !any) continue;
    const side = s => ({
      shots: value(s, 'shots'), shotsOnTarget: value(s, 'shotsOnTarget'), passes: value(s, 'passes'),
      passAccuracy: percent(value(s, 'passesCompleted'), value(s, 'passes')), touches: value(s, 'touches'),
      corners: value(s, 'corners'), crosses: value(s, 'crosses'),
    });
    rows.push({ index: i, label: BUCKET_LABELS[i], home: side('home'), away: side('away'), empty: !any });
  }
  return rows;
}

/** Primer tiempo, segundo y alargue sumando los tramos. */
export function halfTotals(summary) {
  const buckets = summary?.buckets;
  if (!buckets?.home || !buckets?.away) return [];
  const halves = [['Primer tiempo', [0, 1, 2]], ['Segundo tiempo', [3, 4, 5]], ['Alargue', [6, 7]]];
  return halves.map(([label, words]) => {
    const sum = (side, name) => words.reduce((total, i) => total + (bucketValue(buckets, side, name, i) || 0), 0);
    const side = s => ({ shots: sum(s, 'shots'), shotsOnTarget: sum(s, 'shotsOnTarget'), passes: sum(s, 'passes'),
      passAccuracy: percent(sum(s, 'passesCompleted'), sum(s, 'passes')), touches: sum(s, 'touches') });
    return { label, home: side('home'), away: side('away') };
  }).filter((half, i) => i < 2 || summary.match?.extraTime || half.home.passes + half.away.passes > 0);
}

// --- Formación en la cancha -------------------------------------------------------------------------------------

/**
 * Formación del saque inicial de un lado y de dónde sale: 'live' = la que leyó el probe en el juego (evento
 * `formation`, siempre gana); 'matches' = el plan guardado, porque coincide puesto por puesto con el XI inicial;
 * cualquier otro estado = no hay formación confiable.
 */
function kickoffFormation(summary, side) {
  const live = summary?.formations?.[side]?.[0];
  if (live?.variants?.[0] && Array.isArray(live.ids) && live.ids.length === 11 && live.ids.every(id => id != null)) {
    return { status: 'live', roles: live.variants[0].roles, pos: live.variants[0].pos, xi: live.ids };
  }
  const plan = summary?.teamPlans?.[side];
  const starting = summary?.lineups?.[side]?.starting || [];
  if (plan?.status === 'matches' && Array.isArray(plan.pos) && starting.length === 11) {
    return { status: 'matches', roles: plan.roles, pos: plan.pos, xi: starting };
  }
  return { status: plan?.status || 'missing' };
}

/**
 * Las dos formaciones en una cancha horizontal: el local ataca hacia la derecha. Coordenadas del juego
 * [profundidad 3–48 desde el arco propio, lateral 8 izquierda … 92 derecha] → % de la cancha:
 * local x = profundidad, y = lateral; visitante x = 100 − profundidad, y = 100 − lateral (su izquierda queda abajo).
 * Un lado sin formación confiable no tiene jugadores: nunca se ubican a ojo. Los dorsales salen del archivo de
 * guardado y solo cuando su plan coincide con el XI.
 */
export function pitchLayout(summary) {
  const result = {};
  for (const side of SIDES) {
    const formation = kickoffFormation(summary, side);
    if (!formation.xi) {
      result[side] = { status: formation.status, players: [] };
      continue;
    }
    const subs = (summary.substitutions || []).filter(sub => sub.side === side);
    const numbers = summary?.teamPlans?.[side]?.numbers || {};
    const plan = { ...formation, numbers };
    result[side] = {
      status: formation.status,
      players: formation.xi.map((id, slot) => {
        const [depth, lateral] = plan.pos[slot] || [];
        const off = subs.find(sub => sub.offId === id);
        return {
          slot, id, name: playerName(summary, id), number: plan.numbers?.[id] ?? null,
          role: roleLabel(plan.roles?.[slot]),
          x: side === 'home' ? depth : 100 - depth,
          y: side === 'home' ? lateral : 100 - lateral,
          subbedOff: off ? minuteLabel(off.clock) : null,
          // Goles (sin contar en contra) y tarjetas del partido: la cancha los marca sobre la foto del jugador.
          goals: (summary.goals || []).filter(goal => goal.playerId === id && !goal.ownGoal).length,
          cards: (summary.cards || []).filter(card => card.playerId === id).map(card => card.type),
        };
      }),
    };
  }
  return result;
}

/** «DFC ×3 · MCD ×2 · MD · MI · MO · SD · DC»: los roles de campo de una variante, en orden del juego. */
export function rolesSummary(roles) {
  const counts = new Map();
  for (const role of (roles || []).slice(1)) counts.set(role, (counts.get(role) || 0) + 1);
  return [...counts].sort((a, b) => a[0] - b[0]).map(([role, n]) => `${roleLabel(role) ?? role}${n > 1 ? ` ×${n}` : ''}`).join(' · ');
}

/**
 * Cambios de formación o de puestos durante el partido (los que leyó el probe después del saque inicial):
 * [{ side, minute, roles, formationChanged, positionsChanged }]. Vacío sin eventos `formation`.
 */
export function formationChanges(summary) {
  const changes = [];
  for (const side of SIDES) {
    const states = summary?.formations?.[side] || [];
    states.slice(1).forEach((state, i) => {
      const previous = states[i];
      changes.push({
        side,
        order: state.clock ? state.clock.period * 10000 + state.clock.minute * 60 + state.clock.second : Infinity,
        minute: state.clock ? minuteLabel(state.clock) : '—',
        roles: rolesSummary(state.variants?.[0]?.roles),
        formationChanged: JSON.stringify(state.variants) !== JSON.stringify(previous.variants),
        positionsChanged: state.xi.join(',') !== previous.xi.join(','),
      });
    });
  }
  return changes.sort((a, b) => a.order - b.order);
}

// --- Plan de juego ------------------------------------------------------------------------------------------------

const CHOICES = {
  attackingStyles: ['Estilo de ataque', { 0: 'Contraataque', 1: 'Posesión' }],
  buildUp: ['Construcción', { 0: 'Pase largo', 1: 'Pase corto' }],
  attackingArea: ['Área de ataque', { 0: 'Bandas', 1: 'Centro' }],
  positioning: ['Posicionamiento', { 0: 'Mantener formación', 1: 'Flexible' }],
  numbersInAttack: ['Efectivos en ataque', { 1: 'Pocos', 2: 'Medio', 3: 'Muchos' }],
  defensiveStyles: ['Estilo defensivo', { 0: 'Presión en la frontal', 1: 'Defensa total' }],
  containmentArea: ['Área de contención', { 0: 'Centro', 1: 'Bandas' }],
  // En el save 0 = agresiva (al revés que en la app, pes/draftTransfer.js).
  pressuring: ['Presión', { 0: 'Agresiva', 1: 'Conservadora' }],
  numbersInDefense: ['Efectivos en defensa', { 1: 'Pocos', 2: 'Medio', 3: 'Muchos' }],
};
const SCALES = { supportRange: 'Rango de apoyo', defensiveLine: 'Línea defensiva', compactness: 'Compactibilidad' };
const ATTACK_KEYS = ['attackingStyles', 'buildUp', 'attackingArea', 'positioning', 'supportRange', 'numbersInAttack'];
const DEFENSE_KEYS = ['defensiveStyles', 'containmentArea', 'pressuring', 'defensiveLine', 'compactness', 'numbersInDefense'];

function strategyRow(strategy, key) {
  const value = strategy?.[key];
  if (!Number.isInteger(value)) return null;
  if (SCALES[key]) return { key, label: SCALES[key], value: `${value} / 10` };
  const [label, options] = CHOICES[key];
  return options[value] ? { key, label, value: options[value] } : null;
}

/** Plan de juego de un lado (estrategia e instrucciones avanzadas), o null si no está confirmado. */
export function teamPlanView(summary, side) {
  const plan = summary?.teamPlans?.[side];
  if (plan?.status !== 'matches') return null;
  const names = codes => codes.filter(code => code > 0).map(code => instructionByCode(code)?.name || `Instrucción ${code}`);
  const advanced = Array.isArray(plan.advanced) ? plan.advanced : [];
  return {
    attack: ATTACK_KEYS.map(key => strategyRow(plan.strategy, key)).filter(Boolean),
    defense: DEFENSE_KEYS.map(key => strategyRow(plan.strategy, key)).filter(Boolean),
    instructions: { attack: names(advanced.slice(0, 2)), defense: names(advanced.slice(2, 4)) },
  };
}

/** Reparto de los pases por tipo (% de los pases del equipo); null si el partido no midió los tipos. */
export function passMix(summary) {
  const result = {};
  for (const side of SIDES) {
    const s = summary?.teamStats?.[side];
    if (!s || ![s.shortPasses, s.throughPasses, s.longPasses, s.crosses].every(Number.isFinite)) return null;
    result[side] = {
      short: percent(s.shortPasses, s.passes), through: percent(s.throughPasses, s.passes),
      long: percent(s.longPasses, s.passes), cross: percent(s.crosses, s.passes),
    };
  }
  return result;
}

// --- De dónde sale cada dato ---------------------------------------------------------------------------------------

export const SOURCE_LABELS = {
  extracted: 'Del juego', calculated: 'Calculado', estimated: 'Modelo', unavailable: 'No disponible',
};

const PLAN_REASON = {
  differs: 'el plan guardado no coincide con el XI que salió a la cancha',
  unknown: 'todavía no se leyó el XI inicial',
  missing: 'el equipo no tiene plan en el archivo de guardado',
};

/** Cada dato de la página con su fuente y, si falta, por qué. */
export function dataSources(summary) {
  const hasShots = Array.isArray(summary?.shots);
  const hasSeries = Boolean(summary?.series?.rows?.length);
  const planStatus = SIDES.map(side => kickoffFormation(summary, side).status);
  const sideReason = status => (status === 'live' ? 'leída del juego'
    : status === 'matches' ? 'plan guardado, coincide con el XI' : PLAN_REASON[status] || PLAN_REASON.missing);
  const planDetail = planStatus.every(s => s === 'live')
    ? 'Leída del juego al pitazo inicial, con cada cambio que se confirmó en el menú durante el partido.'
    : `Del juego cuando el probe la leyó; si no, del plan guardado solo si coincide con el XI inicial (${SIDES.map((side, i) => `${side === 'home' ? 'local' : 'visitante'}: ${sideReason(planStatus[i])}`).join('; ')}).`;
  return [
    { label: 'Marcador, goles, asistencias, tarjetas y cambios', source: 'extracted', detail: 'Eventos y contadores del juego en vivo.' },
    { label: 'Estadísticas de equipo y de jugador', source: 'extracted', detail: 'Contadores del juego; los de equipo son la suma de sus jugadores.' },
    { label: 'Tipos de pase (cortos, filtrados, largos, centros)', source: 'extracted', detail: 'Contadores del juego sin pantalla propia: suman exactamente los pases totales.' },
    { label: 'Lista de tiros y su resultado', source: hasShots ? 'calculated' : 'unavailable',
      detail: hasShots ? 'Cada tiro con su minuto, leído de los contadores que suben juntos.' : 'Partido grabado antes de medirla.' },
    { label: 'Tramos de 15 minutos', source: summary?.buckets ? 'extracted' : 'unavailable', detail: 'Los contadores del juego ya vienen por tramo.' },
    { label: 'Dominio', source: hasSeries ? 'estimated' : 'unavailable',
      detail: hasSeries ? 'Modelo propio sobre las acciones de cada minuto (ver Análisis).' : 'Partido grabado antes de medir las acciones por minuto.' },
    { label: 'Minutos jugados', source: 'calculated', detail: 'Desde el inicio o el cambio hasta el final, el cambio o la roja.' },
    { label: 'Formación', source: planStatus.some(s => s === 'live' || s === 'matches') ? 'extracted' : 'unavailable', detail: planDetail },
    { label: 'Dorsales, estrategia e instrucciones', source: SIDES.some(side => summary?.teamPlans?.[side]?.status === 'matches') ? 'extracted' : 'unavailable',
      detail: 'Del archivo de guardado, solo si su plan coincide con el XI inicial (el juego todavía no se lee para esto).' },
    summary?.possession
      ? { label: 'Posesión', source: 'calculated',
        detail: 'Porcentaje de los dos contadores de tiempo con la pelota del juego. Coincide con su pantalla o difiere en 1 punto.' }
      : { label: 'Posesión', source: 'unavailable',
        detail: 'En este partido el juego no llenó su contador de posesión (pasa en algunos partidos), o se grabó antes de medirla.' },
    summary?.xg
      ? { label: 'Goles esperados (xG) y mapa de tiros', source: 'estimated',
        detail: 'Modelo propio de distancia y ángulo sobre la última posición del pateador que registró el juego (unos metros de error); penal 0,76.' }
      : { label: 'Goles esperados (xG) y mapa de tiros', source: 'unavailable', detail: 'Partido grabado antes de leer las posiciones de los jugadores.' },
    summary?.ratings
      ? { label: 'Valoraciones de los jugadores', source: 'extracted', detail: 'La nota de cada jugador que calcula el juego, la misma de su pantalla final.' }
      : { label: 'Valoraciones de los jugadores', source: 'unavailable', detail: 'Partido grabado antes de leerlas.' },
    summary?.heatmaps
      ? { label: 'Mapas de calor', source: 'extracted', detail: 'Posiciones del juego, que actualiza a cada jugador cada 2 o 3 segundos: muestran zonas, no recorridos.' }
      : { label: 'Mapas de calor', source: 'unavailable', detail: 'Partido grabado antes de leer las posiciones.' },
    { label: 'Distancia recorrida y velocidad', source: 'unavailable', detail: 'Las posiciones no se actualizan en cada cuadro: no alcanzan para medir recorridos.' },
  ];
}
