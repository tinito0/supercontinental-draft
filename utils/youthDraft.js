// Draft de jóvenes promesas on the client: the published pool shown with its edited sheets, the candidate checks of
// the PES editor and the turn order. The rules the server enforces live in supabase/functions/_shared/youthDraft.js.
//
// Document artifacts/{APP_ID}/public/data/config/youthDraft (written by the admin, read by everyone):
//   candidates  ids marked in the PES editor, not yet published
//   pool        [{ id, name, age, position, ovr, originalOvr, stats }] published from the PES working copy
//   order       team ids in pick order, loaded by hand in Administración
//   turnTeamId  the team allowed to pick now (null between turns)
//   picks       { teamId: playerId }, written only by the market function
import { playerRating, RATING_FIELDS } from '../pes/rating.js';
import {
  isYouthDraftEligible, youthDraftPoolIds,
  YOUTH_DRAFT_EDITED_MIN_OVR, YOUTH_DRAFT_EDITED_MAX_OVR, YOUTH_DRAFT_MAX_POOL,
} from '../supabase/functions/_shared/youthDraft.js';

export {
  isYouthDraftEligible, youthDraftPoolIds, youthDraftPath, isYouthDraftLock,
  YOUTH_DRAFT_RULE_TEXT, YOUTH_DRAFT_EDITED_MIN_OVR, YOUTH_DRAFT_EDITED_MAX_OVR, YOUTH_DRAFT_MAX_POOL,
} from '../supabase/functions/_shared/youthDraft.js';

// Same groups as scripts/main.py RADAR_STATS_MAP, so an edited sheet gets the radar the catalog would give it.
const RADAR_STATS = {
  STAT_SHO: ['Finishing', 'PlaceKicking', 'Curl', 'KickingPower', 'Heading'],
  STAT_PAS: ['LowPass', 'LoftedPass', 'TightPossession'],
  STAT_STR: ['PhysicalContact', 'Jump', 'Stamina'],
  STAT_DEF: ['DefensiveAwareness', 'BallWinning', 'Aggression'],
  STAT_SPD: ['Speed', 'Acceleration'],
  STAT_DRI: ['BallControl', 'Dribbling', 'OffensiveAwareness', 'Balance'],
  STAT_GK: ['GKAwareness', 'GKCatching', 'GKClearing', 'GKReflexes', 'GKReach'],
};

const STAT_FIELDS = RATING_FIELDS.filter(field => field !== 'registeredPosition');

/** Player.bin field → catalog column (gkReach → GKReach, ballControl → BallControl). */
const catalogKey = field => (field.startsWith('gk') ? `GK${field.slice(2)}` : field[0].toUpperCase() + field.slice(1));

/** The OVR of the unedited game data. Pool players carry it apart once the edited sheet is laid over them. */
export const originalOvrOf = player => Number(player?.OVR_ORIGINAL ?? player?.OVR_CALCULADO) || 0;

/**
 * Whether a player can be marked as a prospect, with the reason when not. Uses the catalog (original) values.
 * @param {object | undefined} appPlayer catalog row
 */
export function candidateCheck(appPlayer) {
  if (!appPlayer) return { eligible: false, reason: 'No está en el mercado (jugadores.json).' };
  const original = { Age: appPlayer.Age, OVR_CALCULADO: originalOvrOf(appPlayer) };
  if (!isYouthDraftEligible(original)) {
    return { eligible: false, reason: `Tiene ${appPlayer.Age} años y OVR ${original.OVR_CALCULADO} en el juego original.` };
  }
  return { eligible: true, reason: '' };
}

/** Whether the edited rating is in the 84–86 band the reglamento asks for. */
export const isEditedOvrInRange = ovr => ovr >= YOUTH_DRAFT_EDITED_MIN_OVR && ovr <= YOUTH_DRAFT_EDITED_MAX_OVR;

/**
 * Rating of the sheet as it is now in the PES working copy, or null when a field is missing.
 * @param {(field: string) => number} get reads a Player.bin field of this player
 */
export function editedRating(get) {
  const player = Object.fromEntries(RATING_FIELDS.map(field => [field, get(field)]));
  if (RATING_FIELDS.some(field => !Number.isFinite(player[field]))) return null;
  try {
    return playerRating(player);
  } catch {
    return null;
  }
}

/**
 * Pool entry published from the PES working copy: the edited sheet, plus the original OVR for reference.
 * @param {{ id: number, get: (field: string) => any, appPlayer?: object, position: string }} input
 */
export function poolEntryFromSheet({ id, get, appPlayer, position }) {
  const stats = Object.fromEntries(STAT_FIELDS.map(field => [catalogKey(field), Number(get(field))]));
  return {
    id: Number(id),
    name: String(get('name') || appPlayer?.Name || `Jugador ${id}`),
    age: Number(get('age') ?? appPlayer?.Age) || 0,
    position,
    ovr: editedRating(get) ?? originalOvrOf(appPlayer),
    originalOvr: originalOvrOf(appPlayer),
    stats,
  };
}

const average = (values) => Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

/**
 * Catalog with the published pool laid over it: edited attributes, radar and OVR, and `isYouthProspect`. The rest of
 * the app (cards, player sheet, bench average) reads these players as usual. Returns new objects; the input is kept.
 */
export function applyYouthDraft(players, draft) {
  const pool = Array.isArray(draft?.pool) ? draft.pool : [];
  if (!pool.length || !Array.isArray(players)) return players;
  const byId = new Map(pool.map(entry => [String(entry?.id), entry]));
  return players.map(player => {
    const entry = byId.get(String(player.Id));
    if (!entry) return player;
    const merged = { ...player, ...(entry.stats || {}) };
    const radar = Object.fromEntries(Object.entries(RADAR_STATS).map(([key, fields]) => [
      key, average(fields.map(field => Number(merged[field]) || 40)),
    ]));
    return {
      ...merged,
      ...radar,
      OVR_CALCULADO: Number(entry.ovr) || player.OVR_CALCULADO,
      OVR_ORIGINAL: originalOvrOf(player),
      isYouthProspect: true,
    };
  });
}

const picksOf = draft => (draft?.picks && typeof draft.picks === 'object' ? draft.picks : {});

/** Pool ids nobody picked yet: they cannot be signed on the regular market. */
export function unpickedPoolIds(draft) {
  const picked = new Set(Object.values(picksOf(draft)).map(String));
  return new Set([...youthDraftPoolIds(draft)].filter(id => !picked.has(id)));
}

/** After the first pick the pool is fixed: republishing would change what the clubs already chose from. */
export const isPoolLocked = draft => Object.keys(picksOf(draft)).length > 0;

/** The first team of the order that has not picked yet, or null when everyone did. */
export function nextTeamToPick(draft) {
  const picks = picksOf(draft);
  return (Array.isArray(draft?.order) ? draft.order : []).find(teamId => picks[teamId] === undefined) ?? null;
}

/**
 * Whether the marked candidates can be published: at least one per club, at most YOUTH_DRAFT_MAX_POOL.
 * @returns {{ ok: boolean, reason: string }}
 */
export function publishCheck({ validCount, teamCount }) {
  const minimum = Math.max(1, teamCount);
  if (validCount < minimum) return { ok: false, reason: `Faltan promesas: hay ${validCount} válidas y los clubes son ${minimum}.` };
  if (validCount > YOUTH_DRAFT_MAX_POOL) return { ok: false, reason: `Hay ${validCount} promesas: el máximo es ${YOUTH_DRAFT_MAX_POOL}.` };
  return { ok: true, reason: '' };
}
