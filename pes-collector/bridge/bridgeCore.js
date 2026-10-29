// Pure rules of the local bridge (bridge.mjs): which matches it keeps and how it names them.
//
// Team assignment = the Draft → PES tool's `draftMap` (components/pes/PesDraftPanel.jsx): draft team id → game
// team id. Game team ids are the Team.bin ids, the same ones Sider reports as home_team / away_team (checked on
// 101 Arsenal, 103 Liverpool, 127 Bayern, 109 Real Madrid, 4219 Como, 5010 Leipzig).

/**
 * @param {{ draftMap: Record<string, string|number>, names?: Record<string, string> }} input
 * @returns {Map<number, { draftTeamId: string, name: string|null }>}
 */
export function parseTeamMap({ draftMap, names = {} }) {
  const byGameTeam = new Map();
  for (const [draftTeamId, value] of Object.entries(draftMap || {})) {
    const gameTeamId = Number(value);
    if (!Number.isInteger(gameTeamId) || gameTeamId <= 0) {
      throw new Error(`Draft team ${draftTeamId}: "${value}" is not a game team id`);
    }
    if (byGameTeam.has(gameTeamId)) {
      throw new Error(`Game team ${gameTeamId} is assigned to ${byGameTeam.get(gameTeamId).draftTeamId} and ${draftTeamId}`);
    }
    byGameTeam.set(gameTeamId, { draftTeamId, name: names[draftTeamId] ?? null });
  }
  return byGameTeam;
}

function teamEntry(gameTeamId, teamMap) {
  const assigned = teamMap?.get(gameTeamId);
  return { gameTeamId, draftTeamId: assigned?.draftTeamId ?? null, name: assigned?.name ?? null };
}

/**
 * The summary with its draft teams, or null when a team is outside the assignment.
 * Without an assignment (teamMap null) every match is kept and marked unassigned.
 */
export function selectMatch(summary, teamMap) {
  const { homeTeamId, awayTeamId } = summary.match;
  if (teamMap && !(teamMap.has(homeTeamId) && teamMap.has(awayTeamId))) return null;
  return { ...summary, teams: { home: teamEntry(homeTeamId, teamMap), away: teamEntry(awayTeamId, teamMap) } };
}

/** File name for a match: start time (UTC, compact) and both game team ids. */
export function matchFileName(summary) {
  const started = String(summary.source?.startedAt || 'unknown').replace(/[-:]/g, '');
  return `${started}_${summary.match.homeTeamId}-${summary.match.awayTeamId}.json`;
}

/** Key of a match on the server (live_matches/{matchKey}): the file name without .json. */
export function matchKeyOf(summary) {
  return matchFileName(summary).replace(/\.json$/, '');
}

/** FNV-1a (32 bit, hex) of a string: enough to tell whether a summary changed since it was uploaded. */
export function hashText(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export const hashSummary = summary => hashText(JSON.stringify(summary));

/** Saved matches whose current content was never uploaded (outbox: matchKey → hash of the uploaded summary). */
export function pendingUploads(summaries, outbox) {
  return summaries.filter(s => outbox[matchKeyOf(s)] !== hashSummary(s));
}

const BACKOFF_FIRST_MS = 3000;
const BACKOFF_MAX_MS = 60000;

/** Wait before retry number `failures` (1 = first failure): 3 s, 6 s, 12 s … capped at 60 s. */
export function backoffMs(failures) {
  return Math.min(BACKOFF_FIRST_MS * 2 ** Math.max(0, failures - 1), BACKOFF_MAX_MS);
}

function matchLabel(match) {
  if (!match) return null;
  const name = side => match.teams?.[side]?.name || match.match[`${side}TeamId`];
  const clock = match.clock ? `${match.clock.minute}'` : '';
  return `${name('home')} ${match.score.home}-${match.score.away} ${name('away')} ${clock}`.trim();
}

/**
 * The bridge state shown by the tray icon (status.json). `state`: 'local' (no upload configured), 'paused',
 * 'error' (configuration problem), 'offline' (queued, retrying), 'live' (match in progress, uploading), 'idle'.
 * @param {{ uploading: boolean, paused: boolean, current: object|null, upload: object|null }} input
 */
export function describeStatus({ uploading, paused, current, upload }) {
  const live = current?.status === 'live' ? current : null;
  const match = live ? { label: matchLabel(live), status: live.status } : null;
  const base = { match, queued: upload?.queued ?? 0, lastSentAt: upload?.lastSentAt ?? null };
  if (!uploading) return { ...base, state: 'local', message: 'Solo guarda en esta PC: falta config.json con endpoint y token.' };
  if (paused) return { ...base, state: 'paused', message: 'Subida en pausa. Los partidos se siguen guardando.' };
  const failure = upload?.lastFailure;
  if (failure) return { ...base, state: failure.kind === 'error' ? 'error' : 'offline', message: failure.message };
  if (match) return { ...base, state: 'live', message: `En vivo: ${match.label}` };
  return { ...base, state: 'idle', message: base.queued ? `${base.queued} partido(s) por subir.` : 'Esperando partido.' };
}

/**
 * What a failed upload means for the user. `kind`: 'offline' (no network or server busy: keep retrying) or
 * 'error' (configuration: retrying will not help until it is fixed).
 * @param {{ status?: number, error?: Error }} failure
 */
export function classifyFailure({ status, error } = {}) {
  if (error) return { kind: 'offline', message: `Sin conexión (${error.message}). Se reintenta solo.` };
  if (status === 401) return { kind: 'error', message: 'Token rechazado: revisá "token" en config.json y el secret MATCH_FEED_TOKEN.' };
  if (status === 404) return { kind: 'error', message: 'La función match-feed no está desplegada o el "endpoint" de config.json es incorrecto.' };
  if (status === 400 || status === 413) return { kind: 'error', message: `El servidor rechazó el resumen (${status}). Revisá bridge.log.` };
  return { kind: 'offline', message: `El servidor respondió ${status}. Se reintenta solo.` };
}
