// «Armar el once»: fills the empty slots of the tactics board with the best available players, keeping the
// starters already placed. Natural position first, then the same line (defence, midfield, attack), then any outfield
// player for an outfield slot. A goalkeeper slot only takes a goalkeeper.

const LINES = {
  PT: 'gk',
  DFC: 'def', LI: 'def', LD: 'def',
  MCD: 'mid', MC: 'mid', MI: 'mid', MD: 'mid', MO: 'mid',
  EI: 'att', ED: 'att', SD: 'att', DC: 'att',
};

const ovrOf = player => Number(player?.OVR_CALCULADO) || 0;

/**
 * @param {{pos: string}[]} layout slots in kick-off order (layoutForState)
 * @param {object[]} players the squad that can play (unavailable players already left out)
 * @param {Record<string, string>} [current] slot index → player id already placed
 * @returns {Record<string, string>} the new lineup (same shape as current)
 */
export function autoLineup(layout, players, current = {}) {
  const lineup = {};
  const used = new Set();
  Object.entries(current || {}).forEach(([slot, id]) => {
    if (id == null || Number(slot) >= layout.length) return;
    lineup[slot] = String(id);
    used.add(String(id));
  });
  const pool = [...(players || [])].filter(p => !used.has(String(p.Id))).sort((a, b) => ovrOf(b) - ovrOf(a));
  const take = (slotIndex, matches) => {
    const player = pool.find(p => !used.has(String(p.Id)) && matches(p));
    if (!player) return;
    lineup[slotIndex] = String(player.Id);
    used.add(String(player.Id));
  };
  const empty = () => layout.map((slot, index) => ({ slot, index })).filter(({ index }) => lineup[index] == null);

  empty().forEach(({ slot, index }) => take(index, p => p.POS_NOMBRE === slot.pos));
  empty().forEach(({ slot, index }) => {
    if (LINES[slot.pos] === 'gk') return;
    take(index, p => LINES[p.POS_NOMBRE] === LINES[slot.pos]);
  });
  empty().forEach(({ slot, index }) => {
    if (LINES[slot.pos] === 'gk') return;
    take(index, p => LINES[p.POS_NOMBRE] !== 'gk');
  });
  return lineup;
}
