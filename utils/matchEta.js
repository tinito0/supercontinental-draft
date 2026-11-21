// Estimated kickoff of the round's next matches, from how long games really take. Matches are played one at a time,
// so once the first one of a round started, each following one starts when the previous ends plus the usual break.
// Durations come from the game's own records (live_matches: start from the match key, end in finishedAt); until
// there are enough, 15 minutes per match and 5 between matches. Pure; tests/matchEta.test.js.

import { fixtureDay, fixtureTime } from './leagueFixtures.js';

export const DEFAULT_MATCH_MINUTES = 15;
export const DEFAULT_BREAK_MINUTES = 5;
const MIN_SAMPLES = 3;
const MINUTE = 60_000;
// Outside these bounds a record is a test, an abandoned game or a bridge left running, not a real duration.
const DURATION_RANGE = [5 * MINUTE, 60 * MINUTE];
const BREAK_RANGE = [0, 45 * MINUTE];
// An estimate only shows when it moves the time by at least this much: «aprox.» for a minute is noise.
const MIN_SHIFT = 5 * MINUTE;
// A round in play: its first match started within this window. Older anchors belong to another night.
const SESSION_WINDOW = 8 * 60 * MINUTE;

const startOf = match => (match?.startedAt instanceof Date ? match.startedAt.getTime() : Number(match?.startedAtMs) || null);
const endOf = match => Number(match?.finishedAtMs) || null;

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Typical match length and break between matches, from finished game matches.
 * @returns {{ matchMs: number, breakMs: number, samples: number, fromHistory: boolean }}
 */
export function matchTimingModel(liveMatches = []) {
  const finished = (liveMatches || [])
    .map(match => ({ start: startOf(match), end: endOf(match) }))
    .filter(({ start, end }) => start && end && end - start >= DURATION_RANGE[0] && end - start <= DURATION_RANGE[1])
    .sort((a, b) => a.start - b.start);
  const durations = finished.map(({ start, end }) => end - start);
  const breaks = [];
  for (let i = 1; i < finished.length; i += 1) {
    const gap = finished[i].start - finished[i - 1].end;
    if (gap >= BREAK_RANGE[0] && gap <= BREAK_RANGE[1]) breaks.push(gap);
  }
  const fromHistory = durations.length >= MIN_SAMPLES;
  return {
    matchMs: fromHistory ? median(durations) : DEFAULT_MATCH_MINUTES * MINUTE,
    breakMs: breaks.length >= MIN_SAMPLES ? median(breaks) : DEFAULT_BREAK_MINUTES * MINUTE,
    samples: durations.length,
    fromHistory,
  };
}

/** Scheduled kickoff of a fixture in ms (local day + 'HH:mm'), or null without both. */
export function scheduledMs(fixture) {
  const day = fixtureDay(fixture);
  const time = fixtureTime(fixture);
  if (!day || !time) return null;
  const [hours, minutes] = time.split(':').map(Number);
  day.setHours(hours, minutes, 0, 0);
  return day.getTime();
}

const PLAYED = new Set(['live', 'nosignal', 'finished', 'played', 'abandoned']);

/**
 * Estimated kickoff for the unplayed fixtures of the round in play.
 * @param {object[]} fixtures  utils/leagueFixtures.js buildFixtures (one round, or all: only the round in play counts)
 * @param {object[]} liveMatches  game matches (useLiveMatches / useLeagueFixtures liveMatches)
 * @returns {Map<string, number>}  fixture id → estimated kickoff ms, only where it differs from the scheduled time
 */
export function estimateKickoffs(fixtures = [], liveMatches = [], { now = Date.now(), model = matchTimingModel(liveMatches) } = {}) {
  const byKey = new Map((liveMatches || []).map(match => [match.key, match]));
  const started = fixtures
    .filter(fixture => PLAYED.has(fixture.status) && byKey.has(fixture.liveMatchKey))
    .map(fixture => ({ fixture, match: byKey.get(fixture.liveMatchKey) }))
    .filter(({ match }) => startOf(match) && now - startOf(match) <= SESSION_WINDOW)
    .sort((a, b) => startOf(a.match) - startOf(b.match));
  const estimates = new Map();
  if (!started.length) return estimates;

  // The round of the latest game started tonight; its pending fixtures go one after another, in schedule order.
  const last = started[started.length - 1];
  const roundKey = fixture => `${fixture.competition}|${fixture.roundLabel}`;
  const pending = fixtures
    .filter(fixture => roundKey(fixture) === roundKey(last.fixture) && fixture.status === 'scheduled')
    .sort((a, b) => (scheduledMs(a) ?? Infinity) - (scheduledMs(b) ?? Infinity) || (a.order ?? 0) - (b.order ?? 0));
  if (!pending.length) return estimates;

  // When the last started game ends: its real end, or its start plus the usual length (never before now).
  const lastStart = startOf(last.match);
  let freeAt = endOf(last.match) || Math.max(lastStart + model.matchMs, now);
  for (const fixture of pending) {
    const kickoff = Math.max(freeAt + model.breakMs, now);
    const scheduled = scheduledMs(fixture);
    if (scheduled == null || Math.abs(kickoff - scheduled) >= MIN_SHIFT) estimates.set(fixture.id, kickoff);
    freeAt = kickoff + model.matchMs;
  }
  return estimates;
}

const clock = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

/** «aprox. 21:48» */
export function formatEta(ms) {
  return `aprox. ${clock.format(new Date(ms))}`;
}
