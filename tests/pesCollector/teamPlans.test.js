// Team plans added by the bridge (pes-collector/bridge/teamPlans.js). attachTeamPlans uses synthetic plans; the
// save check runs only when vendor/EDIT00000000 is present (real fixture, skipped otherwise).
import fs from 'node:fs';
import { attachTeamPlans, readTeamPlan } from '../../pes-collector/bridge/teamPlans.js';
import { loadEditDatabase } from '../../pes/formats/pes2021/editDatabase.js';
import { EDIT_FILE, hasEdit } from '../pes/fixtures.js';

const XI = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const plan = {
  lineup: XI,
  numbers: Object.fromEntries([...XI, 30].map((id, i) => [id, i + 1])),
  roles: [0, 1, 1, 3, 2, 4, 5, 10, 9, 8, 12],
  pos: XI.map((_, i) => [3 + i * 4, 52]),
  strategy: { attackingStyles: 1 },
  advanced: [0, 0, 0, 0],
};
const summary = {
  match: { homeTeamId: 101, awayTeamId: 103 },
  lineups: { home: { starting: XI }, away: { starting: [...XI].reverse() } },
  substitutions: [{ side: 'home', offId: 20, onId: 30 }],
};

describe('attachTeamPlans', () => {
  it('uses the plan only when the kick-off XI matches it slot by slot', () => {
    const named = attachTeamPlans(summary, () => plan);
    expect(named.teamPlans.home).toMatchObject({ status: 'matches', roles: plan.roles, pos: plan.pos, strategy: plan.strategy });
    expect(named.teamPlans.away).toEqual({ status: 'differs' });
    expect(summary.teamPlans).toBeUndefined(); // the original is not mutated
  });

  it('keeps the shirt numbers of the players who played, subs included', () => {
    const { numbers } = attachTeamPlans(summary, () => plan).teamPlans.home;
    expect(Object.keys(numbers).map(Number).sort((a, b) => a - b)).toEqual([...XI, 30]);
  });

  it('says why there is no plan: none in the save, or no kick-off XI yet', () => {
    expect(attachTeamPlans(summary, () => null).teamPlans.home).toEqual({ status: 'missing' });
    const early = { ...summary, lineups: { home: { starting: [] }, away: null } };
    expect(attachTeamPlans(early, () => plan).teamPlans).toEqual({ home: { status: 'unknown' }, away: { status: 'unknown' } });
  });

  it('returns the summary unchanged without a plan source', () => {
    expect(attachTeamPlans(summary, null)).toBe(summary);
  });
});

describe.skipIf(!hasEdit)('readTeamPlan (real save)', () => {
  it('reads the Arsenal plan: XI in formation-slot order, roles and positions', () => {
    const edit = loadEditDatabase(new Uint8Array(fs.readFileSync(EDIT_FILE)));
    const arsenal = readTeamPlan(edit, 101);
    expect(arsenal.lineup).toHaveLength(11);
    expect(arsenal.roles[0]).toBe(0); // goalkeeper slot
    expect(arsenal.pos).toHaveLength(11);
    expect(readTeamPlan(edit, 999999)).toBeNull();
    expect(readTeamPlan(null, 101)).toBeNull();
  });
});
