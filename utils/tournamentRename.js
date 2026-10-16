// The tournament (public/data/tournament/official) and the broadcast overlay identify clubs by name: the
// standings, logos, brackets, top scorers and the OBS overlay all match on it. Only the admin renames a club
// (components/admin/TeamsAdminSection.jsx), so the rename is carried into those documents at that moment;
// before, a renamed club got a second standings row and lost its crest. Pure.

/** Keys that hold a club name anywhere in the tournament or overlay documents. */
const TEAM_NAME_KEYS = new Set(['teamA', 'teamB', 'homeTeam', 'awayTeam', 'team', 'homeTeamName', 'awayTeamName']);

const sameName = (a, b) => typeof a === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase();

const isPlainObject = value => Boolean(value) && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;

function renameDeep(value, oldName, newName, counter) {
  if (Array.isArray(value)) return value.map(item => renameDeep(item, oldName, newName, counter));
  // Only plain maps: a Firestore Timestamp (e.g. the overlay's updatedAt) must be written back as it is.
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (TEAM_NAME_KEYS.has(key) && sameName(item, oldName)) {
      counter.count += 1;
      return [key, newName];
    }
    return [key, renameDeep(item, oldName, newName, counter)];
  }));
}

/**
 * Copy of a tournament or overlay document with every reference to oldName replaced by newName
 * (case and surrounding spaces ignored, as the standings do). League rows are renamed by their `name`;
 * elsewhere `name` is a player's name (top scorers) and is left alone.
 * `changedKeys` are the top-level fields that changed: write only those (mergeFields), so a field another
 * admin saved meanwhile is not replaced by this stale copy.
 * @returns {{ data: object, changed: number, changedKeys: string[] }}
 */
export function renameTeamInTournament(data, oldName, newName) {
  const from = String(oldName || '').trim();
  const to = String(newName || '').trim();
  if (!data || !from || !to || sameName(from, to)) return { data, changed: 0, changedKeys: [] };
  const counter = { count: 0 };
  const renamed = {};
  const changedKeys = [];
  for (const [key, value] of Object.entries(data)) {
    const before = counter.count;
    renamed[key] = key === 'league' && Array.isArray(value)
      ? value.map(row => {
        const row2 = renameDeep(row, from, to, counter);
        if (!sameName(row2?.name, from)) return row2;
        counter.count += 1;
        return { ...row2, name: to };
      })
      : TEAM_NAME_KEYS.has(key) && sameName(value, from)
        ? (counter.count += 1, to)
        : renameDeep(value, from, to, counter);
    if (counter.count > before) changedKeys.push(key);
  }
  return { data: renamed, changed: counter.count, changedKeys };
}
