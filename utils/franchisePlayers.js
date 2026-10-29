// Jugadores Franquicia as the public sees them: each club's franchise signing, from the public market locks
// (player_locks/{playerId}.isFranchise, written by the market function) joined with the market catalog
// (supabase/functions/_shared/catalog.json rows: [price, age, ovr, name, pos, country]).
// Locks signed before the isFranchise flag existed are only known from the private profile, so they do not show.

const CATALOG_AGE = 1;
const CATALOG_OVR = 2;
const CATALOG_NAME = 3;
const CATALOG_POS = 4;

/** Ids of the franchise locks among some locks ({ id, isFranchise }). */
export function franchiseIdsOf(locks) {
  return new Set((locks || []).filter(lock => lock?.isFranchise === true).map(lock => String(lock.id)));
}

/**
 * @param {Array<{ id: string, lockedBy: string, isFranchise?: boolean, lockedAt?: string }>} locks
 * @param {Record<string, Array>|null} catalog market catalog, or null while it loads
 * @returns {Record<string, { playerId: string, name: string, pos: string, ovr: number|null, age: number|null }>}
 */
export function franchiseByTeam(locks, catalog) {
  const latest = {};
  (locks || []).forEach(lock => {
    if (lock?.isFranchise !== true || !lock.lockedBy) return;
    const current = latest[lock.lockedBy];
    if (!current || String(lock.lockedAt || '') > String(current.lockedAt || '')) latest[lock.lockedBy] = lock;
  });
  return Object.fromEntries(Object.entries(latest).map(([teamId, lock]) => {
    const row = catalog?.[String(lock.id)];
    return [teamId, {
      playerId: String(lock.id),
      name: row?.[CATALOG_NAME] || '',
      pos: row?.[CATALOG_POS] || '',
      ovr: row ? Number(row[CATALOG_OVR]) || null : null,
      age: row ? Number(row[CATALOG_AGE]) || null : null,
    }];
  }));
}
