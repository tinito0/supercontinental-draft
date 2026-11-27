// Draft de jóvenes promesas (reglamento T3): who can be in the pool, and how its picks show up in locks.
// Shared by the market Edge Function (market.js), the budget (budget.js) and the app.

export const YOUTH_DRAFT_MIN_AGE = 17;
export const YOUTH_DRAFT_MAX_AGE = 21;
export const YOUTH_DRAFT_MIN_OVR = 50;
export const YOUTH_DRAFT_MAX_OVR = 60;
// The administration takes each prospect to 84–86 in the PES editor before the draft.
export const YOUTH_DRAFT_EDITED_MIN_OVR = 84;
export const YOUTH_DRAFT_EDITED_MAX_OVR = 86;
export const YOUTH_DRAFT_MAX_POOL = 40;

export const YOUTH_DRAFT_RULE_TEXT = `Edad ${YOUTH_DRAFT_MIN_AGE}-${YOUTH_DRAFT_MAX_AGE} y media original ${YOUTH_DRAFT_MIN_OVR}-${YOUTH_DRAFT_MAX_OVR}`;

export const youthDraftPath = appId => `artifacts/${appId}/public/data/config/youthDraft`;

/**
 * Eligibility uses the catalog values (the unedited game data), never the edited rating.
 * @param {{ Age?: number, OVR_CALCULADO?: number } | null | undefined} player
 */
export function isYouthDraftEligible(player) {
  if (!player) return false;
  const age = Number(player.Age);
  const ovr = Number(player.OVR_CALCULADO);
  return age >= YOUTH_DRAFT_MIN_AGE && age <= YOUTH_DRAFT_MAX_AGE && ovr >= YOUTH_DRAFT_MIN_OVR && ovr <= YOUTH_DRAFT_MAX_OVR;
}

/** Ids of the published pool, as strings. Picked or not, they stay out of the regular market all season. */
export function youthDraftPoolIds(draft) {
  return new Set((Array.isArray(draft?.pool) ? draft.pool : []).map(entry => String(entry?.id)));
}

/** A lock written by a youth-draft pick: free, and neither releasable nor transferable. */
export const isYouthDraftLock = lock => lock?.isDraftee === true;
