// Validation for the match-feed Edge Function: the local bridge (pes-collector/bridge) posts a match summary
// (schema scl.match/1, pes-collector/collector/matchSummary.js) and this turns it into the Firestore document
// artifacts/{APP_ID}/public/data/live_matches/{matchKey}. Pure, so it is unit-tested (tests/matchFeed.test.js).

export const MATCH_SCHEMA = 'scl.match/1';
export const MAX_SUMMARY_BYTES = 256 * 1024;
export const MIN_TOKEN_LENGTH = 32;
const STATUSES = ['live', 'finished', 'abandoned'];
const MATCH_KEY = /^(\d{8}T\d{6}Z)_(\d{1,6})-(\d{1,6})$/;
const MAX_NAME = 60;
const MAX_SCORE = 99;

export class MatchFeedError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'MatchFeedError';
    this.status = status;
  }
}

/** Constant-time comparison with the configured bridge token; refuses when the secret is unset or short. */
export function isBridgeToken(given, expected) {
  if (typeof expected !== 'string' || expected.length < MIN_TOKEN_LENGTH) return false;
  if (typeof given !== 'string' || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

const isScore = n => Number.isInteger(n) && n >= 0 && n <= MAX_SCORE;
const isClockPart = n => n == null || (Number.isInteger(n) && n >= 0 && n <= 200);

function cleanName(name) {
  return typeof name === 'string' && name.trim() ? name.trim().slice(0, MAX_NAME) : null;
}

function cleanId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id) ? id : null;
}

function team(summary, side) {
  const entry = summary.teams?.[side] || {};
  return { name: cleanName(entry.name), draftTeamId: cleanId(entry.draftTeamId) };
}

/** Firestore fields for one match; throws MatchFeedError on anything malformed. */
export function buildLiveMatchDoc(body) {
  const { matchKey, summary } = body || {};
  const key = typeof matchKey === 'string' ? matchKey.match(MATCH_KEY) : null;
  if (!key) throw new MatchFeedError('matchKey inválido.');
  if (!summary || typeof summary !== 'object') throw new MatchFeedError('Falta el resumen del partido.');
  const json = JSON.stringify(summary);
  if (json.length > MAX_SUMMARY_BYTES) throw new MatchFeedError('Resumen demasiado grande (too large).', 413);
  if (summary.schema !== MATCH_SCHEMA) throw new MatchFeedError(`Esquema no soportado: ${summary.schema}.`);
  if (!STATUSES.includes(summary.status)) throw new MatchFeedError(`Estado inválido: ${summary.status}.`);
  const home = Number(key[2]);
  const away = Number(key[3]);
  if (summary.match?.homeTeamId !== home || summary.match?.awayTeamId !== away) {
    throw new MatchFeedError('Los equipos del matchKey no coinciden con el resumen.');
  }
  if (!isScore(summary.score?.home) || !isScore(summary.score?.away)) throw new MatchFeedError('Marcador inválido.');
  const clock = summary.clock || {};
  if (![clock.period, clock.minute, clock.second].every(isClockPart)) throw new MatchFeedError('Reloj inválido.');
  const homeTeam = team(summary, 'home');
  const awayTeam = team(summary, 'away');
  return {
    schema: MATCH_SCHEMA,
    matchKey,
    status: summary.status,
    startedAt: key[1],
    homeGameTeamId: home,
    awayGameTeamId: away,
    homeName: homeTeam.name,
    awayName: awayTeam.name,
    homeDraftTeamId: homeTeam.draftTeamId,
    awayDraftTeamId: awayTeam.draftTeamId,
    score: { home: summary.score.home, away: summary.score.away },
    clock: { period: clock.period ?? null, minute: clock.minute ?? null, second: clock.second ?? null },
    // The whole summary as a string: Firestore needs no schema for it and the page parses it.
    summaryJson: json,
  };
}
