// Pure rules that keep a manager's private cart and public roster in line with player_locks, the only
// authoritative record of who owns a player (the market function writes it). Used by hooks/useSquadSync.js.

/** [playerId, lock] pairs of the locks owned by uid. */
export function ownedLockEntries(playerLocks, uid) {
  return Object.entries(playerLocks || {}).filter(([, lock]) => lock?.lockedBy === uid);
}

/**
 * What to write so the cart mirrors the user's locks.
 * - toAdd: owned players missing from the cart (full catalog row, so it waits for the catalog);
 * - toRemove: cart entries locked by another team (sold);
 * - orphans: cart entries with no lock at all. They are not deleted (old data could hold them and the
 *   loss would be permanent); budget and exports already ignore them, and exports report them;
 * - missingCatalog: owned players that could not be added yet because the catalog is not loaded.
 * Call it only with server-confirmed cart and locks: a cached or partial list would delete real players.
 */
export function reconcileCart({ playerLocks, cart, uid, playerById }) {
  const cartIds = new Set(cart.map(player => String(player.Id)));
  const toAdd = [];
  const missingCatalog = [];
  for (const [playerId, lock] of ownedLockEntries(playerLocks, uid)) {
    if (cartIds.has(String(playerId))) continue;
    const player = playerById?.get(String(playerId));
    if (player) toAdd.push({ playerId: String(playerId), data: { ...player, isFranchise: Boolean(lock.isFranchise) } });
    else missingCatalog.push(String(playerId));
  }
  const toRemove = [];
  const orphans = [];
  for (const playerId of cart.map(player => String(player.Id))) {
    const owner = playerLocks?.[playerId]?.lockedBy;
    if (!owner) orphans.push(playerId);
    else if (owner !== uid) toRemove.push(playerId);
  }
  return { toAdd, toRemove, orphans, missingCatalog };
}

function rosterEntry(playerId, player, userProfile) {
  return {
    Id: String(playerId),
    Name: player.Name || 'Jugador',
    POS_NOMBRE: player.POS_NOMBRE || '',
    OVR_CALCULADO: Number(player.OVR_CALCULADO) || 0,
    dorsal: userProfile?.dorsals?.[playerId] || '',
    available: userProfile?.availability?.[playerId] !== false,
  };
}

/**
 * Public squad snapshot (teams/{uid}.roster) built from the owned locks, with names and ratings from the
 * cart copy or the catalog. Returns null while any owned player has no data yet, so a partial roster is
 * never published.
 */
export function buildPublicRoster({ playerLocks, cart, uid, playerById, userProfile }) {
  const cartById = new Map(cart.map(player => [String(player.Id), player]));
  const roster = [];
  for (const [playerId] of ownedLockEntries(playerLocks, uid)) {
    const player = cartById.get(String(playerId)) || playerById?.get(String(playerId));
    if (!player) return null;
    roster.push(rosterEntry(playerId, player, userProfile));
  }
  return roster.sort((a, b) => a.Id.localeCompare(b.Id));
}

const ROSTER_KEYS = ['Id', 'Name', 'POS_NOMBRE', 'OVR_CALCULADO', 'dorsal', 'available'];

/** True when the stored roster already says the same thing (order and missing fields ignored). */
export function isSameRoster(stored, next) {
  if (!Array.isArray(stored) || stored.length !== next.length) return false;
  const normalized = list => JSON.stringify(list
    .map(entry => JSON.stringify(ROSTER_KEYS.map(key => {
      if (key === 'Id') return String(entry.Id);
      if (key === 'OVR_CALCULADO') return Number(entry.OVR_CALCULADO) || 0;
      if (key === 'available') return entry.available !== false;
      return String(entry[key] ?? '');
    })))
    .sort());
  return normalized(stored) === normalized(next);
}
