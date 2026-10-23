// `formation` events of probe v4 (pes-collector/collector/formations.js). The plan bytes are the Arsenal plan of
// the real save (research doc S12): a real layout, but synthetic events — nothing here was recorded in a match.
import { buildFormations, decodePlan } from '../../pes-collector/collector/formations.js';

// Variants 0 (kick-off), 1 (with ball) and 2 (without) of Arsenal's saved plan, then zeros for the strategy bytes.
const ARSENAL_PLAN = [
  '000101030204050a09080c03340b400b280d580d10153a1e28235b241120432a38',
  '000101070204080a09080c03340c47092a10570e1415352128276029141f472a42',
  '0001010302040507060b0c03340b400b280d580d1018401f292258221025422b2c',
].join('') + '00'.repeat(0xA0 - 3 * 0x21);
// The same plan with the kick-off variant switched to 3-5-2 (bytes seen live in the B2 step of the research log).
const ARSENAL_352 = `0001010104040706080b0c03340b340b480b20134013281f581f10213429402b1a${ARSENAL_PLAN.slice(66)}`;
const ORDER = [0, 2, 3, 8, 6, 10, 12, 18, 17, 14, 21, ...Array.from({ length: 29 }, (_, i) => i + 11)];
const SQUAD = Array.from({ length: 30 }, (_, i) => 1000 + i);

const events = extra => [
  { t: 'stats_appeared', ms: 1, c: [1, 0, 0], squad_home: SQUAD, squad_away: SQUAD },
  { t: 'lineup', ms: 2, c: [1, 0, 30], side: 0, slots: ORDER.slice(0, 11) },
  { t: 'formation', ms: 2, c: [1, 0, 30], side: 0, plan: ARSENAL_PLAN, order: ORDER },
  ...extra,
];

describe('decodePlan', () => {
  it('reads roles and positions of the three variants, the goalkeeper first', () => {
    const { variants } = decodePlan(ARSENAL_PLAN);
    expect(variants).toHaveLength(3);
    expect(variants[0].roles).toEqual([0, 1, 1, 3, 2, 4, 5, 10, 9, 8, 12]);
    expect(variants[0].pos[0]).toEqual([3, 52]);
    expect(variants[0].pos[10]).toEqual([42, 56]);
    expect(variants[1].roles[3]).toBe(7); // with the ball the right back pushes up to RMF
  });

  it('rejects malformed hex', () => {
    expect(decodePlan('zz')).toBeNull();
    expect(decodePlan('00')).toBeNull();
    expect(decodePlan(null)).toBeNull();
  });
});

describe('buildFormations', () => {
  it('keeps the kick-off state with the XI as player ids, then each change with its clock', () => {
    const formations = buildFormations(events([
      { t: 'formation', ms: 3, c: [1, 10, 0], side: 0, plan: ARSENAL_PLAN, order: ORDER }, // identical: skipped
      { t: 'formation', ms: 4, c: [1, 30, 5], side: 0, plan: ARSENAL_352, order: ORDER },
    ]));
    expect(formations.home).toHaveLength(2);
    expect(formations.home[0]).toMatchObject({ clock: { period: 1, minute: 0, second: 30 }, xi: ORDER.slice(0, 11) });
    expect(formations.home[0].ids[1]).toBe(1002);
    expect(formations.home[1].variants[0].roles).toEqual([0, 1, 1, 1, 4, 4, 7, 6, 8, 11, 12]);
    expect(formations.away).toEqual([]);
  });

  it('warns when the kick-off XI read from MATCH_INFO is not the first lineup the probe saw', () => {
    const warnings = [];
    buildFormations([
      ...events([]).slice(0, 1),
      { t: 'lineup', ms: 2, side: 0, slots: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
      { t: 'formation', ms: 2, side: 0, plan: ARSENAL_PLAN, order: ORDER },
    ], warnings);
    expect(warnings.join(' ')).toMatch(/kick-off XI/);
  });

  it('ignores malformed events and recordings without formation events', () => {
    expect(buildFormations(events([{ t: 'formation', side: 0, plan: 'bad', order: ORDER }])).home).toHaveLength(1);
    expect(buildFormations([{ t: 'stats_appeared', squad_home: [], squad_away: [] }])).toEqual({ home: [], away: [] });
  });
});
