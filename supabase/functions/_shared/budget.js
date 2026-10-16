// Budget arithmetic shared by the market function (market.js) and the app (hooks/useBudget.js), so the
// remaining budget the app shows is the one the server enforces. Pure: no Firestore, no React.
// Budget = team base budget − base price of the team's non-franchise locks − its pending offers.

/** Millions (catalog `Precio`) → money units, rounded like every stored amount. */
export const toUnits = millions => Math.round((Number(millions) || 0) * 1000000);

/**
 * A lock is a franchise signing when the server marked it so. Locks written before that flag existed fall
 * back to the profile's franchisePlayerId (users cannot write it: firestore.rules).
 */
export function isFranchiseLock(playerId, lock, franchisePlayerId) {
  if (lock?.isFranchise !== undefined) return lock.isFranchise === true;
  return franchisePlayerId != null && String(franchisePlayerId) === String(playerId);
}

/**
 * Money spent on the squad: base price of every owned non-franchise player.
 * @param {Array<[string, object]>} ownedLocks [playerId, lock data] pairs of the team's locks
 * @param {(playerId: string) => number} priceOf catalog price in millions (0 when unknown)
 */
export function spentOnLocks(ownedLocks, priceOf, { franchisePlayerId } = {}) {
  return ownedLocks.reduce((sum, [playerId, lock]) => (
    isFranchiseLock(playerId, lock, franchisePlayerId) ? sum : sum + toUnits(priceOf(String(playerId)))
  ), 0);
}

/** An offer amount that can hold money: a finite positive number, anything else counts as 0. */
export function heldAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

/** Money held by the team's pending offers (pass only offers the team sent with status 'pending'). */
export function committedInOffers(pendingOffers, { excludeOfferId } = {}) {
  return pendingOffers
    .filter(offer => offer.id !== excludeOfferId)
    .reduce((sum, offer) => sum + heldAmount(offer.offerAmount), 0);
}
