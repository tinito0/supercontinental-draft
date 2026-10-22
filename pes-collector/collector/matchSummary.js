// Turns scl_probe events (pes-collector/sider/scl_probe.lua, events.ndjson) into one versioned summary per
// match. Pure: no I/O, so every rule is testable; summarize.mjs reads the files.
//
// Rules (docs/PES_MATCH_DATA_RESEARCH.md):
// - A goal is a rise of a side's score in `state` (authoritative). Its scorer comes from the goal_scored event
//   just before; an own goal is a scorer from the other side (L3). Shootout kicks are not goals.
// - Penalty / free-kick flags and the assist come from the per-player stat that rose with the goal (S1–S7).
//   An assist is only given when exactly one team-mate's assist count rose; otherwise it stays empty.
// - A substitution is a pitch slot taken by a player who was not on the pitch (S6–S7); swaps are ignored.
import { KIND, KIND_NAME, TEAM_STATS, kindTotal } from './statKinds.js';

export const SCHEMA = 'scl.match/1';

// The goal_scored event comes before the score change: 6 s on most goals, 18 s once (celebration and replay
// with the clock stopped). The event also carries the score before the goal, which must match.
const GOAL_EVENT_WINDOW_MS = 60000;
// Stats that rise with a goal (assist, penalty goal…) show up in the next pstats samples.
const GOAL_STAT_BEFORE_MS = 3000;
const GOAL_STAT_AFTER_MS = 10000;
const FULL_TIME_MINUTE = 90;
// After the final whistle the clock shows 90:00 (120:00 after extra time) and stays there. In stoppage time the
// period flips 2↔3 with the clock still running, so a held clock is required, not just period 3.
const FINAL_CLOCKS = ['3:90:0', '4:120:0'];
const FINAL_CLOCK_HELD_MS = 30000;
const SIDES = ['home', 'away'];
// Sider's tournament_id: 48 in the Konami Cup (the editable cup, absent from Competition.bin), 17 and 65535 in
// exhibition friendlies (docs/PES_MATCH_DATA_RESEARCH.md). Anything else is reported as 'other'.
const KONAMI_CUP_ID = 48;
const FRIENDLY_IDS = [17, 65535];

/** 'konami_cup' | 'friendly' | 'other' | null (unknown). */
export function competitionOf(tournamentId) {
  if (tournamentId == null) return null;
  if (tournamentId === KONAMI_CUP_ID) return 'konami_cup';
  return FRIENDLY_IDS.includes(tournamentId) ? 'friendly' : 'other';
}

/** Parses events.ndjson. A last line that does not parse is still being written and is skipped. */
export function parseEventLines(text) {
  const lines = text.split(/\r?\n/);
  const events = [];
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    try {
      events.push(JSON.parse(line));
    } catch {
      const isLast = lines.slice(index + 1).every(rest => !rest.trim());
      if (!isLast) throw new Error(`events.ndjson line ${index + 1} is not valid JSON`);
    }
  });
  return events;
}

/** One entry per match: a new match starts at every stats_appeared; session settings carry over. */
export function splitMatches(events) {
  const matches = [];
  let session = null;
  for (const event of events) {
    if (event.t === 'session') session = event;
    if (event.t === 'stats_appeared') matches.push({ session, events: [] });
    if (matches.length) matches[matches.length - 1].events.push(event);
  }
  return matches;
}

function clockOf(event) {
  if (Array.isArray(event?.c)) return { period: event.c[0], minute: event.c[1], second: event.c[2] };
  if (event?.clock_m != null) return { period: event.period ?? null, minute: event.clock_m, second: event.clock_s };
  return null;
}

function sideName(side) {
  return SIDES[side] ?? null;
}

// Replays pstats diffs: final kinds per player plus every rise of a match total, with its time.
function replayPlayerStats(events) {
  const players = new Map();
  const rises = [];
  for (const event of events.filter(e => e.t === 'pstats')) {
    for (const [idx, change] of Object.entries(event.p || {})) {
      const key = `${event.side}:${idx}`;
      const player = players.get(key) || { side: event.side, squadIndex: Number(idx), id: change.id, kinds: {} };
      for (const [kind, values] of Object.entries(change.k || {})) {
        const delta = kindTotal(values) - kindTotal(player.kinds[kind]);
        if (delta > 0) {
          rises.push({ ms: event.ms, clock: clockOf(event), side: event.side, id: change.id, kind: Number(kind), delta });
        }
        player.kinds = { ...player.kinds, [kind]: values };
      }
      players.set(key, player);
    }
  }
  return { players: [...players.values()], rises };
}

function risesNear(rises, kind, side, ms) {
  return rises.filter(r => r.kind === kind && r.side === side
    && r.ms >= ms - GOAL_STAT_BEFORE_MS && r.ms <= ms + GOAL_STAT_AFTER_MS);
}

function scoreRises(events) {
  const rises = [];
  let previous = { home: 0, away: 0 };
  for (const event of events.filter(e => e.t === 'state')) {
    for (const side of SIDES) {
      for (let n = previous[side]; n < (event[side] ?? previous[side]); n += 1) {
        const before = { ...previous, [side]: n };
        rises.push({ side, ms: event.ms, clock: clockOf(event), before });
      }
    }
    previous = { home: event.home ?? previous.home, away: event.away ?? previous.away };
  }
  return rises;
}

// Probe v1 goal events have no score; v2+ carry the score before the goal.
function scoreMatches(goalEvent, before) {
  if (goalEvent.home == null || goalEvent.away == null) return true;
  return goalEvent.home === before.home && goalEvent.away === before.away;
}

function findScorerEvent(goalEvents, used, rise) {
  return goalEvents.find(e => !used.has(e) && e.ms <= rise.ms && rise.ms - e.ms <= GOAL_EVENT_WINDOW_MS
    && scoreMatches(e, rise.before)) || null;
}

function assistFor(rises, side, scorerId, ms, warnings, label) {
  const candidates = risesNear(rises, KIND.assists, side, ms).filter(r => r.id !== scorerId);
  const ids = [...new Set(candidates.map(r => r.id))];
  if (ids.length > 1) warnings.push(`${label}: assist left empty, ${ids.length} players gained an assist (${ids.join(', ')})`);
  return ids.length === 1 ? ids[0] : null;
}

function buildGoals(events, statRises, warnings) {
  const goalEvents = events.filter(e => e.t === 'goal_scored');
  const used = new Set();
  return scoreRises(events).map(rise => {
    const label = `goal ${rise.side} ${rise.clock ? `${rise.clock.minute}'` : ''}`.trim();
    const scorerEvent = findScorerEvent(goalEvents, used, rise);
    if (!scorerEvent) {
      warnings.push(`${label}: no goal_scored event, scorer unknown`);
      return { side: rise.side, playerId: null, ownGoal: false, penalty: false, freeKick: false, assistPlayerId: null, clock: rise.clock };
    }
    used.add(scorerEvent);
    const scorerSide = scorerEvent.home_or_away;
    const ownGoal = sideName(scorerSide) !== rise.side;
    const scorerRises = kind => risesNear(statRises, kind, scorerSide, scorerEvent.ms).some(r => r.id === scorerEvent.player_id);
    const creditedSide = SIDES.indexOf(rise.side);
    return {
      side: rise.side,
      playerId: scorerEvent.player_id,
      ownGoal,
      penalty: !ownGoal && scorerRises(KIND.penaltyGoals),
      freeKick: !ownGoal && scorerRises(KIND.freeKickGoals),
      assistPlayerId: ownGoal ? null : assistFor(statRises, creditedSide, scorerEvent.player_id, scorerEvent.ms, warnings, label),
      clock: clockOf(scorerEvent) || rise.clock,
    };
  });
}

function buildCards(statRises) {
  const types = [[KIND.yellowCards, 'yellow'], [KIND.redCards, 'red']];
  return statRises
    .filter(r => types.some(([kind]) => kind === r.kind))
    .sort((a, b) => a.ms - b.ms || a.kind - b.kind)
    .flatMap(r => Array.from({ length: r.delta }, () => ({
      side: sideName(r.side), playerId: r.id, type: types.find(([kind]) => kind === r.kind)[1], clock: r.clock,
    })));
}

function buildLineups(events) {
  const lineups = { home: null, away: null };
  const substitutions = [];
  for (const event of events.filter(e => e.t === 'lineup')) {
    const side = sideName(event.side);
    const previous = lineups[side];
    if (previous) {
      const onPitch = new Set(previous.slots);
      for (const change of event.slot_changes || []) {
        if (onPitch.has(change.to_idx)) continue;
        substitutions.push({ side, offId: change.from_id, onId: change.to_id, slot: change.slot, clock: clockOf(event) });
      }
    }
    lineups[side] = { starting: previous ? previous.starting : event.ids, final: event.ids, slots: event.slots };
  }
  const strip = lineup => (lineup ? { starting: lineup.starting, final: lineup.final } : null);
  return { lineups: { home: strip(lineups.home), away: strip(lineups.away) }, substitutions };
}

function namedStats(kinds) {
  const stats = {};
  for (const [kind, values] of Object.entries(kinds)) {
    const name = KIND_NAME[kind];
    if (name) stats[name] = kindTotal(values);
  }
  return stats;
}

function buildPlayers(players) {
  const bySide = { home: [], away: [] };
  for (const player of players) {
    bySide[sideName(player.side)].push({ id: player.id, squadIndex: player.squadIndex, stats: namedStats(player.kinds) });
  }
  for (const side of SIDES) bySide[side].sort((a, b) => a.squadIndex - b.squadIndex);
  return bySide;
}

function buildTeamStats(playersBySide) {
  const totals = {};
  for (const side of SIDES) {
    totals[side] = Object.fromEntries(TEAM_STATS.map(name => [name, 0]));
    for (const player of playersBySide[side]) {
      for (const name of TEAM_STATS) totals[side][name] += player.stats[name] || 0;
    }
  }
  return totals;
}

function lastState(events) {
  const states = events.filter(e => e.t === 'state');
  return states[states.length - 1] || null;
}

// `state` is only emitted on score/period changes; every probe v2+ event carries the clock.
function latestClock(events) {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const clock = clockOf(events[i]);
    if (clock) return clock;
  }
  return null;
}

function clockKey(clock) {
  return clock ? `${clock.period}:${clock.minute}:${clock.second}` : null;
}

// True when the last events all show a final clock and span at least FINAL_CLOCK_HELD_MS.
function finalClockHeld(events) {
  const timed = events.filter(e => clockOf(e) && e.ms != null);
  const last = timed[timed.length - 1];
  if (!last || !FINAL_CLOCKS.includes(clockKey(clockOf(last)))) return false;
  let start = last;
  for (let i = timed.length - 1; i >= 0 && clockKey(clockOf(timed[i])) === clockKey(clockOf(last)); i -= 1) {
    start = timed[i];
  }
  return last.ms - start.ms >= FINAL_CLOCK_HELD_MS;
}

function matchStatus(events, state) {
  if (finalClockHeld(events)) return 'finished';
  if (!events.some(e => e.t === 'stats_gone')) return 'live';
  const minute = clockOf(state)?.minute ?? 0;
  return minute >= FULL_TIME_MINUTE ? 'finished' : 'abandoned';
}

/** Summary of one match from splitMatches(). */
export function summarizeMatch({ session, events }) {
  const warnings = [];
  const state = lastState(events);
  const { players, rises } = replayPlayerStats(events);
  const playersBySide = buildPlayers(players);
  const { lineups, substitutions } = buildLineups(events);
  const shootoutScored = (state?.pk_home ?? 0) + (state?.pk_away ?? 0) > 0;
  if (!events.some(e => e.t === 'pstats')) warnings.push('no per-player stats in this recording (probe v1?)');
  return {
    schema: SCHEMA,
    source: { probeVersion: session?.probe_version ?? 1, startedAt: events[0]?.ts ?? null },
    match: {
      homeTeamId: session?.home_team ?? null,
      awayTeamId: session?.away_team ?? null,
      tournamentId: session?.tournament_id ?? null,
      competition: competitionOf(session?.tournament_id),
      extraTime: Boolean(session?.extra_time),
      penalties: Boolean(session?.penalties),
    },
    status: matchStatus(events, state),
    clock: latestClock(events),
    score: { home: state?.home ?? 0, away: state?.away ?? 0 },
    shootout: shootoutScored ? { home: state.pk_home, away: state.pk_away } : null,
    goals: buildGoals(events, rises, warnings),
    cards: buildCards(rises),
    substitutions,
    lineups,
    players: playersBySide,
    teamStats: buildTeamStats(playersBySide),
    possession: null, // not in memory yet (S9); read it from the result screen
    warnings,
  };
}

function formatNames(ids, playerName) {
  const counts = new Map();
  for (const id of ids) counts.set(id, (counts.get(id) || 0) + 1);
  return [...counts].map(([id, n]) => {
    const name = playerName(id) || `#${id}`;
    return n > 1 ? `${name} x${n}` : name;
  }).join(', ');
}

/**
 * Fields of a tournament match (components/tournament/tournamentEngine.js reads "Name x2, Name").
 * Own goals are left out of the scorer lists; unknown scorers are left out too.
 */
export function toTournamentFields(summary, { playerName, homeTeam, awayTeam }) {
  if (summary.status !== 'finished') throw new Error(`Only a finished match can be written (status: ${summary.status})`);
  const goalsOf = side => summary.goals.filter(g => g.side === side && !g.ownGoal && g.playerId != null);
  const listFor = side => ({
    goals: formatNames(goalsOf(side).map(g => g.playerId), playerName),
    assists: formatNames(goalsOf(side).map(g => g.assistPlayerId).filter(id => id != null), playerName),
  });
  const home = listFor('home');
  const away = listFor('away');
  return {
    homeTeam, awayTeam, homeScore: summary.score.home, awayScore: summary.score.away,
    homeGoals: home.goals, awayGoals: away.goals, homeAssists: home.assists, awayAssists: away.assists,
    status: 'completed',
  };
}
