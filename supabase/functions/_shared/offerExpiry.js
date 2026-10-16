// Offer expiry, shared by the market function, the app and (as a range check) firestore.rules. Pure.
// Every turn of a negotiation (the offer, a counter, a new offer) gives the other club 48 hours to answer. An
// expired pending offer no longer holds the buyer's money, and an expired offer cannot be accepted. Offers made
// before expiry existed have no expiresAtMs and never expire.

export const OFFER_TTL_MS = 48 * 60 * 60 * 1000;

/** When a turn that starts at `nowMs` expires (milliseconds, stored as expiresAtMs). */
export function offerExpiresAt(nowMs = Date.now()) {
  return Math.round(nowMs) + OFFER_TTL_MS;
}

/** True when the offer has an expiry and it has passed. */
export function isOfferExpired(offer, nowMs = Date.now()) {
  const expiresAt = Number(offer?.expiresAtMs);
  return Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt <= nowMs;
}

/** Milliseconds left in the current turn, or null for offers without expiry. Never negative. */
export function offerTimeLeft(offer, nowMs = Date.now()) {
  const expiresAt = Number(offer?.expiresAtMs);
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) return null;
  return Math.max(0, expiresAt - nowMs);
}
