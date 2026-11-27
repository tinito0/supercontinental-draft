/** Pure view helpers for the scouting panel (keyboard, result status, list paging). */

export const VISIBLE_DONE_SEARCHES = 3;

/**
 * Index a key moves to inside a radio group (arrows wrap, Home/End jump), or -1 for any other key.
 * Disabled options are skipped; returns -1 when every option is disabled.
 */
export function nextRadioIndex(key, current, count, isDisabled = () => false) {
  const step = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 0;
  let target;
  if (step) target = current;
  else if (key === 'Home') { target = -1; }
  else if (key === 'End') { target = count; }
  else return -1;
  const dir = step || (key === 'Home' ? 1 : -1);
  for (let i = 0; i < count; i += 1) {
    target = ((target + dir) % count + count) % count;
    if (!isDisabled(target)) return target;
  }
  return -1;
}

/**
 * Where a result stands today: «Ya fichado» when someone holds the player now, with the current catalog price
 * (the stored result keeps the price from when the search resolved).
 */
export function resultStatus(player, playerLocks, userId, priceById) {
  const lock = playerLocks?.[String(player.Id)];
  const current = priceById?.get(String(player.Id));
  const price = Number.isFinite(Number(current)) && current !== undefined ? Number(current) : Number(player.Precio || 0);
  return {
    price,
    signed: Boolean(lock),
    signedByMe: Boolean(lock) && lock.lockedBy === userId,
  };
}

/**
 * Searches in progress always show; finished ones are cut to the latest `limit` unless `showAll`.
 * `searches` come newest first. Returns the visible list and how many finished ones are hidden.
 */
export function splitSearches(searches, limit = VISIBLE_DONE_SEARCHES, showAll = false) {
  if (showAll) return { visible: searches, hiddenCount: 0 };
  let doneSeen = 0;
  const visible = [];
  let hiddenCount = 0;
  searches.forEach(search => {
    if (search.status !== 'done') { visible.push(search); return; }
    doneSeen += 1;
    if (doneSeen <= limit) visible.push(search);
    else hiddenCount += 1;
  });
  return { visible, hiddenCount };
}

export function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  return new Date(value).getTime();
}

export function getTimeLeft(resolvesAt) {
  const diff = toMillis(resolvesAt) - Date.now();
  if (diff <= 0) return 'Lista para revisar';
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.ceil((diff % 3600000) / 60000);
  if (hours <= 0) return `${minutes} min restantes`;
  return `${hours} h ${minutes} min restantes`;
}
