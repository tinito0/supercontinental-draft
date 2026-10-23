// Registro de partidos (estilo SofaScore) desde los docs public/data/live_matches que sube el bridge del PES
// (pes-collector/bridge → match-feed). Convierte un doc en lo que muestran /partidos y /partidos/:matchKey.
// Puro; tests/matchCenter.test.js. Nunca inventa datos: lo que el colector no midió (p. ej. la posesión) no aparece.

const PERIOD_END = { 1: 45, 2: 90, 3: 105, 4: 120 };

/** Minuto al estilo del fútbol: 14:29 → 15'; 45:30 del primer tiempo → 45+1'. */
export function minuteLabel(clock) {
  if (!clock || !Number.isInteger(clock.minute)) return '';
  const shown = clock.minute + 1;
  const end = PERIOD_END[clock.period];
  if (end && shown > end) return `${end}+${shown - end}'`;
  return `${shown}'`;
}

const clockValue = clock => ((clock?.period ?? 0) * 10000) + ((clock?.minute ?? 0) * 60) + (clock?.second ?? 0);

/** Fecha del partido desde el matchKey (20261021T232728Z_101-1230). */
export function matchStartDate(matchKey) {
  const found = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/.exec(String(matchKey || ''));
  if (!found) return null;
  const [, y, mo, d, h, mi, s] = found.map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi, s));
}

function competitionLabel(match) {
  const competition = match?.competition
    ?? (match?.tournamentId === 48 ? 'konami_cup' : [17, 65535].includes(match?.tournamentId) ? 'friendly' : null);
  if (competition === 'konami_cup') return 'Copa';
  if (competition === 'friendly') return 'Liga';
  return 'Partido';
}

function parseSummary(doc) {
  try {
    return doc?.summaryJson ? JSON.parse(doc.summaryJson) : null;
  } catch {
    return null;
  }
}

function teamName(summary, doc, side) {
  return summary?.teams?.[side]?.name
    || doc?.[`${side}Name`]
    || summary?.names?.teams?.[side]
    || `Equipo ${summary?.match?.[`${side}TeamId`] ?? doc?.[`${side}GameTeamId`] ?? '?'}`;
}

/** Estado para el encabezado y la lista. */
function statusOf(summary, doc) {
  const status = summary?.status || doc?.status;
  const clock = summary?.clock || doc?.clock;
  if (status === 'live') return { kind: 'live', label: minuteLabel(clock) || 'En vivo' };
  if (status === 'abandoned') return { kind: 'abandoned', label: 'Suspendido' };
  if (summary?.shootout) return { kind: 'finished', label: 'Final (pen.)' };
  if (summary?.match?.extraTime || (clock?.period ?? 0) >= 3) return { kind: 'finished', label: 'Final (alargue)' };
  return { kind: 'finished', label: 'Final' };
}

// Las estadísticas de equipo por secciones están en utils/matchStats.js (statSections).

/** Minuto a minuto: goles (con el marcador de ese momento), tarjetas y cambios, en orden. */
export function buildTimeline(summary) {
  if (!summary) return [];
  const name = id => playerName(summary, id);
  const events = [];
  for (const goal of summary.goals || []) {
    events.push({
      type: 'goal', side: goal.side, clock: goal.clock,
      player: name(goal.playerId), playerId: goal.playerId,
      assist: goal.assistPlayerId ? name(goal.assistPlayerId) : null,
      ownGoal: Boolean(goal.ownGoal), penalty: Boolean(goal.penalty), freeKick: Boolean(goal.freeKick),
    });
  }
  for (const card of summary.cards || []) {
    events.push({ type: 'card', side: card.side, clock: card.clock, card: card.type, player: name(card.playerId), playerId: card.playerId });
  }
  for (const sub of summary.substitutions || []) {
    events.push({ type: 'sub', side: sub.side, clock: sub.clock, playerIn: name(sub.onId), playerOut: name(sub.offId) });
  }
  const order = { goal: 0, card: 1, sub: 2 };
  events.sort((a, b) => clockValue(a.clock) - clockValue(b.clock) || order[a.type] - order[b.type]);
  const score = { home: 0, away: 0 };
  for (const event of events) {
    event.minute = minuteLabel(event.clock);
    if (event.type === 'goal') {
      score[event.side] += 1;
      event.score = `${score.home}-${score.away}`;
    }
  }
  return events;
}

export function playerName(summary, id) {
  return summary?.names?.players?.[id] || (id != null ? `Jugador ${id}` : '');
}

/** Alineaciones: los 11 iniciales con el minuto en que salieron, y los suplentes que entraron. */
export function buildLineups(summary) {
  const result = {};
  for (const side of ['home', 'away']) {
    const starting = summary?.lineups?.[side]?.starting || [];
    const subs = (summary?.substitutions || []).filter(sub => sub.side === side);
    const goals = id => (summary?.goals || []).filter(goal => goal.playerId === id && !goal.ownGoal).length;
    const ownGoals = id => (summary?.goals || []).filter(goal => goal.playerId === id && goal.ownGoal).length;
    const assists = id => (summary?.goals || []).filter(goal => goal.assistPlayerId === id).length;
    const cards = id => (summary?.cards || []).filter(card => card.playerId === id).map(card => card.type);
    const player = (id, extra) => ({ id, name: playerName(summary, id), goals: goals(id), ownGoals: ownGoals(id), assists: assists(id), cards: cards(id), ...extra });
    result[side] = {
      starting: starting.map(id => {
        const off = subs.find(sub => sub.offId === id);
        return player(id, { subbedOff: off ? minuteLabel(off.clock) : null });
      }),
      substitutes: subs.map(sub => player(sub.onId, { subbedOn: minuteLabel(sub.clock), replaced: playerName(summary, sub.offId) })),
    };
  }
  return result;
}

/** Estadísticas de cada jugador que jugó (titulares y los que entraron). */
export function playerStatRows(summary) {
  const rows = [];
  for (const side of ['home', 'away']) {
    const played = new Set([
      ...(summary?.lineups?.[side]?.starting || []),
      ...(summary?.substitutions || []).filter(sub => sub.side === side).map(sub => sub.onId),
    ]);
    for (const entry of summary?.players?.[side] || []) {
      if (!played.has(entry.id)) continue;
      const s = entry.stats || {};
      rows.push({
        side, id: entry.id, name: playerName(summary, entry.id),
        goals: s.goals ?? 0, assists: s.assists ?? 0, shots: s.shots ?? 0, shotsOnTarget: s.shotsOnTarget ?? 0,
        passes: s.passes ?? 0, passesCompleted: s.passesCompleted ?? 0,
        dribbles: s.dribbles ?? 0, dribblesCompleted: s.dribblesCompleted ?? 0,
        tacklesWon: s.tacklesWon ?? 0, interceptions: s.interceptions ?? 0, saves: s.saves ?? 0,
      });
    }
  }
  return rows;
}

/**
 * Vista de un partido (doc de live_matches).
 * @returns {null | { key, startedAt, status, competition, home, away, shootout, summary }}
 */
const timeMs = value => (typeof value?.toMillis === 'function' ? value.toMillis() : value instanceof Date ? value.getTime() : null);

export function parseMatchDoc(doc) {
  if (!doc?.matchKey) return null;
  const summary = parseSummary(doc);
  const score = summary?.score || doc.score || { home: 0, away: 0 };
  return {
    key: doc.matchKey,
    startedAt: matchStartDate(doc.matchKey),
    // Última subida del bridge (Timestamp de Firestore o Date): cierra la votación del MVP 15 min después del final.
    updatedAtMs: timeMs(doc.updatedAt),
    // Primera subida con el partido terminado (match-feed la escribe una vez): desde ahí cuentan los 15 min del MVP.
    finishedAtMs: timeMs(doc.finishedAt),
    status: statusOf(summary, doc),
    competition: competitionLabel(summary?.match),
    home: { name: teamName(summary, doc, 'home'), score: score.home, draftTeamId: summary?.teams?.home?.draftTeamId ?? doc.homeDraftTeamId ?? null },
    away: { name: teamName(summary, doc, 'away'), score: score.away, draftTeamId: summary?.teams?.away?.draftTeamId ?? doc.awayDraftTeamId ?? null },
    shootout: summary?.shootout || null,
    summary,
  };
}

/** Lista para /partidos: en vivo primero, después del más nuevo al más viejo, agrupada por día. */
export function groupMatchesByDay(matches, locale = 'es-AR', timeZone = undefined) {
  const sorted = [...matches].sort((a, b) => {
      if ((a.status.kind === 'live') !== (b.status.kind === 'live')) return a.status.kind === 'live' ? -1 : 1;
      return (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0);
    });
  const groups = [];
  for (const match of sorted) {
    const label = match.status.kind === 'live'
      ? 'En vivo'
      : match.startedAt
        ? new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone }).format(match.startedAt)
        : 'Sin fecha';
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.matches.push(match);
    else groups.push({ label, matches: [match] });
  }
  return groups;
}
