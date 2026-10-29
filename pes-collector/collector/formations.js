// Game plans as the match used them, from the probe's `formation` events (probe v4; MATCH_INFO, research doc
// S12–S13). Pure; tests/pesCollector/formations.test.js.
//
// Layout (the save's, confirmed live for the variants and the order): plan = 3 fluid variants of 0x21 bytes
// (byte 0 unknown, roles of slots 1–10, 11 × (depth, lateral)), then the strategy bytes; order = 40 roster slots,
// the first 11 = the XI by formation slot. Variant 0 is the kick-off state, 1 and 2 the in/out of possession ones.

const VARIANT_BYTES = 0x21;
const VARIANTS = 3;
const SIDES = ['home', 'away'];

function clockOf(event) {
  return Array.isArray(event?.c) ? { period: event.c[0], minute: event.c[1], second: event.c[2] } : null;
}

/** Plan hex → { variants: [{ roles: [0, …10 roles], pos: [[depth, lateral] × 11] }] }, or null if malformed. */
export function decodePlan(hex) {
  if (typeof hex !== 'string' || !/^[0-9a-f]*$/i.test(hex) || hex.length < VARIANT_BYTES * VARIANTS * 2) return null;
  const bytes = hex.match(/../g).map(pair => parseInt(pair, 16));
  const variants = Array.from({ length: VARIANTS }, (_, v) => {
    const base = v * VARIANT_BYTES;
    return {
      roles: [0, ...bytes.slice(base + 1, base + 11)],
      pos: Array.from({ length: 11 }, (_, i) => [bytes[base + 11 + i * 2], bytes[base + 12 + i * 2]]),
    };
  });
  return { variants };
}

/**
 * Formation states per side, in match order: [{ clock, xi: 11 squad indices, ids: 11 player ids (null if the
 * squad is unknown), variants }]. The first state is the one at kick-off; an event identical to the previous state
 * (same XI and variants) is skipped. Warns when the kick-off XI does not equal the first `lineup` event.
 */
export function buildFormations(events, warnings = []) {
  const appeared = events.find(e => e.t === 'stats_appeared');
  const squads = [appeared?.squad_home || [], appeared?.squad_away || []];
  const result = { home: [], away: [] };
  for (const event of events.filter(e => e.t === 'formation')) {
    const side = SIDES[event.side];
    const plan = decodePlan(event.plan);
    if (!side || !plan || !Array.isArray(event.order) || event.order.length < 11) continue;
    const xi = event.order.slice(0, 11);
    const state = { clock: clockOf(event), xi, ids: xi.map(idx => squads[event.side][idx] ?? null), variants: plan.variants };
    const previous = result[side].at(-1);
    if (previous && JSON.stringify([previous.xi, previous.variants]) === JSON.stringify([state.xi, state.variants])) continue;
    result[side].push(state);
  }
  for (const [index, side] of SIDES.entries()) {
    const firstLineup = events.find(e => e.t === 'lineup' && e.side === index);
    const kickoff = result[side][0];
    if (kickoff && firstLineup?.slots && kickoff.xi.join(',') !== firstLineup.slots.join(',')) {
      warnings.push(`formation ${side}: kick-off XI ${kickoff.xi.join(',')} differs from the first lineup ${firstLineup.slots.join(',')}`);
    }
  }
  return result;
}
