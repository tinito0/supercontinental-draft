import {
  BENCH_MIN_AVG_OVR, SQUAD_MIN_PLAYERS, averageOvr, buildTeamRuleRows, benchPlayers, checkBench, evaluateSquadRules, formatAverage, isLocalPlayer,
} from '../utils/squadRules.js';

// Synthetic squads: ids 1..n, OVR given per player.
const squadOf = (ovrs, extra = () => ({})) => ovrs.map((ovr, i) => ({ Id: i + 1, OVR_CALCULADO: ovr, ...extra(i) }));
const lineupOf = ids => Object.fromEntries(ids.map((id, slot) => [slot, String(id)]));
const firstEleven = lineupOf([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

describe('squadRules', () => {
  test('the bench is every squad player outside the XI', () => {
    const squad = squadOf([80, 80, 70]);
    expect(benchPlayers(squad, lineupOf([1])).map(p => p.Id)).toEqual([2, 3]);
  });

  test('starters no longer in the squad do not shrink the bench', () => {
    const squad = squadOf([80, 70]);
    expect(benchPlayers(squad, lineupOf([99, 1])).map(p => p.Id)).toEqual([2]);
  });

  test('average is exact, not rounded', () => {
    expect(averageOvr(squadOf([73, 72]))).toBe(72.5);
    expect(formatAverage(72.5)).toBe('72,5');
    expect(averageOvr([])).toBeNull();
  });

  test('a 72.6 bench fails a 73 floor', () => {
    const squad = squadOf([...Array(11).fill(85), 73, 73, 73, 73, 72, 72, 72, 73, 73, 72]);
    const check = checkBench(squad, firstEleven);
    expect(check.applies).toBe(true);
    expect(check.average).toBeCloseTo(72.6, 5);
    expect(check.ok).toBe(false);
  });

  test('a bench of exactly 73 passes', () => {
    const squad = squadOf([...Array(11).fill(85), ...Array(10).fill(BENCH_MIN_AVG_OVR)]);
    expect(checkBench(squad, firstEleven).ok).toBe(true);
  });

  test('not measured below the squad minimum or without a full XI', () => {
    const short = squadOf([...Array(11).fill(85), ...Array(5).fill(60)]);
    expect(checkBench(short, firstEleven)).toMatchObject({ applies: false, ok: true });
    const full = squadOf([...Array(11).fill(85), ...Array(10).fill(60)]);
    expect(checkBench(full, lineupOf([1, 2, 3]))).toMatchObject({ applies: false, ok: true });
  });

  test('a local player has the club country as first or second nationality', () => {
    expect(isLocalPlayer({ Country1: 204 }, 204)).toBe(true);
    expect(isLocalPlayer({ Country1: 10, Country2: 204 }, '204')).toBe(true);
    expect(isLocalPlayer({ Country1: 10, Country2: 0 }, 204)).toBe(false);
    expect(isLocalPlayer({ Country1: 204 }, null)).toBe(false);
  });

  test('evaluateSquadRules reports each rule and the overall result', () => {
    const squad = squadOf([...Array(11).fill(85), ...Array(10).fill(75)], i => ({ Country1: i < 7 ? 204 : 10 }));
    const result = evaluateSquadRules({ squad, lineup: firstEleven, teamCountry: 204 });
    expect(result.ok).toBe(true);
    expect(result.rules.map(rule => [rule.id, rule.ok])).toEqual([['squad', true], ['bench', true], ['locals', true]]);
  });

  test('missing players, a weak bench and few locals all fail', () => {
    const short = evaluateSquadRules({ squad: squadOf(Array(SQUAD_MIN_PLAYERS - 2).fill(80)), lineup: {}, teamCountry: 204 });
    expect(short.ok).toBe(false);
    expect(short.rules.find(rule => rule.id === 'squad').detail).toBe('Faltan 2');
    expect(short.rules.find(rule => rule.id === 'locals').detail).toBe('Faltan 7');

    const weak = evaluateSquadRules({ squad: squadOf([...Array(11).fill(85), ...Array(10).fill(65)]), lineup: firstEleven, teamCountry: 204 });
    expect(weak.rules.find(rule => rule.id === 'bench')).toMatchObject({ ok: false, value: '65,0' });
  });

  test('meters fill up to the minimum and the bench marks its floor', () => {
    const squad = squadOf([...Array(11).fill(85), ...Array(10).fill(73)], i => ({ Country1: i < 14 ? 204 : 10 }));
    const rules = evaluateSquadRules({ squad, lineup: firstEleven, teamCountry: 204 }).rules;
    const [plantel, bench, locals] = rules;
    expect(plantel).toMatchObject({ fill: 1, tick: null });
    expect(locals.fill).toBe(1);
    expect(bench.fill).toBeCloseTo(bench.tick, 5);
    const half = evaluateSquadRules({ squad: squadOf(Array(7).fill(80)), lineup: {}, teamCountry: 204 }).rules;
    expect(half[0].fill).toBeCloseTo(7 / 21, 5);
  });

  test('a club without country cannot meet the local quota', () => {
    const result = evaluateSquadRules({ squad: squadOf([80]), lineup: {}, teamCountry: '' });
    expect(result.rules.find(rule => rule.id === 'locals')).toMatchObject({ ok: false, applies: false });
  });
});

describe('buildTeamRuleRows', () => {
  test('groups locks by club, skips unapproved clubs and lists failing clubs first', () => {
    const players = new Map(squadOf(Array(22).fill(80), () => ({ Country1: 204 })).map(p => [String(p.Id), p]));
    const locks = Object.fromEntries([...players.keys()].map((id, i) => [id, { lockedBy: i < 21 ? 'full' : 'short' }]));
    const teams = {
      full: { teamName: 'Zeta', country: 204, lineup: lineupOf([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) },
      short: { teamName: 'Alfa', country: 204 },
      pending: { teamName: 'Nuevo', approved: false },
    };
    const rows = buildTeamRuleRows(teams, locks, players);
    expect(rows.map(row => [row.teamName, row.result.ok])).toEqual([['Alfa', false], ['Zeta', true]]);
  });
});
