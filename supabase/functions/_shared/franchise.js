// Jugador Franquicia: who can be signed as one. Shared by the market Edge Function (market.js) and the app
// (marketplace filter, player sheet, signing), so both always apply the same rule.
import { FRANCHISE_MIN_AGE, FRANCHISE_MIN_OVR, FRANCHISE_MAX_OVR } from './marketConstants.js';

/** @param {{ Age?: number, OVR_CALCULADO?: number } | null | undefined} player */
export function isFranchiseEligible(player) {
  if (!player) return false;
  const age = Number(player.Age);
  const ovr = Number(player.OVR_CALCULADO);
  return age >= FRANCHISE_MIN_AGE && ovr >= FRANCHISE_MIN_OVR && ovr <= FRANCHISE_MAX_OVR;
}

export const FRANCHISE_RULE_TEXT = `Edad ≥ ${FRANCHISE_MIN_AGE} y OVR ${FRANCHISE_MIN_OVR}-${FRANCHISE_MAX_OVR}`;
