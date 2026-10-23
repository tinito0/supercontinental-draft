// Synthetic stat rises only: these prove the rules of matchActions.js, not anything about the game.
// The real recordings are reconciled in matchSummary.sessions.test.js.
import { buildBuckets, buildSeries, buildShots } from '../../pes-collector/collector/matchActions.js';
import { KIND, SERIES_STATS } from '../../pes-collector/collector/statKinds.js';

const clock = (period, minute, second = 0) => ({ period, minute, second });
const rise = (ms, c, side, id, kind, delta = 1) => ({ ms, clock: c, side, id, kind, delta });

describe('buildShots', () => {
  it('reads each shot outcome from the rises of the same player in the same sample', () => {
    const shots = buildShots([
      rise(100, clock(1, 0, 20), 0, 7, KIND.touches), // first sample at kick-off, as in every recording
      rise(1000, clock(1, 10, 5), 0, 7, KIND.shots),
      rise(1000, clock(1, 10, 5), 0, 7, KIND.shotsOnTarget),
      rise(1000, clock(1, 10, 5), 0, 7, KIND.goals),
      rise(5000, clock(1, 20), 1, 9, KIND.shots),
      rise(5000, clock(1, 20), 1, 9, KIND.shotsOnTarget),
      rise(9000, clock(2, 50), 1, 9, KIND.shots),
    ]);
    expect(shots).toEqual([
      { side: 'home', playerId: 7, clock: clock(1, 10, 5), outcome: 'goal', penalty: false },
      { side: 'away', playerId: 9, clock: clock(1, 20), outcome: 'on_target', penalty: false },
      { side: 'away', playerId: 9, clock: clock(2, 50), outcome: 'off_target', penalty: false },
    ]);
  });

  it('does not lend one player\'s on-target rise to a team-mate who shot in the same sample', () => {
    const shots = buildShots([
      rise(1000, clock(1, 5), 0, 7, KIND.shots),
      rise(1000, clock(1, 5), 0, 8, KIND.shots),
      rise(1000, clock(1, 5), 0, 8, KIND.shotsOnTarget),
    ]);
    expect(shots.map(s => [s.playerId, s.outcome])).toEqual([[7, 'off_target'], [8, 'on_target']]);
  });

  it('flags penalties and keeps the last real period when an in-play penalty reports period 5', () => {
    const [shot] = buildShots([
      rise(500, clock(1, 30), 1, 9, KIND.passes),
      rise(1000, clock(5, 40, 28), 1, 9, KIND.shots),
      rise(1000, clock(5, 40, 28), 1, 9, KIND.penaltyShots),
      rise(1000, clock(5, 40, 28), 1, 9, KIND.shotsOnTarget),
      rise(1000, clock(5, 40, 28), 1, 9, KIND.goals),
    ]);
    expect(shot).toMatchObject({ outcome: 'goal', penalty: true, clock: clock(1, 40, 28) });
  });

  it('splits two shots counted in one sample: goals first, then on target, then the rest', () => {
    const shots = buildShots([
      rise(1000, clock(1, 5), 0, 7, KIND.shots, 2),
      rise(1000, clock(1, 5), 0, 7, KIND.shotsOnTarget, 1),
    ]);
    expect(shots.map(s => s.outcome)).toEqual(['on_target', 'off_target']);
  });

  it('gives no time to shots of a late first sample (the probe found the stats after kick-off)', () => {
    const shots = buildShots([
      rise(1000, clock(1, 30), 0, 7, KIND.shots, 2),
      rise(3000, clock(1, 31), 0, 7, KIND.shots),
    ]);
    expect(shots.map(s => s.clock)).toEqual([null, null, clock(1, 31)]);
  });
});

describe('buildSeries', () => {
  it('counts the series kinds per minute and side, sorted by period and minute', () => {
    const series = buildSeries([
      rise(500, clock(1, 0, 30), 0, 7, KIND.touches),
      rise(600, clock(1, 3), 0, 7, KIND.passes, 2),
      rise(600, clock(1, 3), 0, 7, KIND.passesCompleted),
      rise(700, clock(1, 3), 0, 7, KIND.fouls), // not a series kind
      // The away side's first rise comes at 50': that is not a late start, the match's first sample was at 0:30.
      rise(1000, clock(2, 50), 1, 9, KIND.shots),
    ]);
    const n = SERIES_STATS.length;
    const col = name => SERIES_STATS.indexOf(name);
    expect(series.kinds).toEqual(SERIES_STATS);
    expect(series.from).toBeNull();
    expect(series.rows.map(row => row.slice(0, 2))).toEqual([[1, 0], [1, 3], [2, 50]]);
    expect(series.rows[1][2 + col('passes')]).toBe(2);
    expect(series.rows[1][2 + col('passesCompleted')]).toBe(1);
    expect(series.rows[2][2 + n + col('shots')]).toBe(1);
  });

  it('treats period 3 as second-half stoppage time unless the match had extra time', () => {
    const rises = [rise(100, clock(1, 0, 20), 0, 7, KIND.touches), rise(1000, clock(3, 90, 30), 0, 7, KIND.shots)];
    expect(buildSeries(rises).rows.at(-1).slice(0, 2)).toEqual([2, 90]);
    expect(buildSeries(rises, { extraTime: true }).rows.at(-1).slice(0, 2)).toEqual([3, 90]);
    expect(buildShots(rises)[0].clock.period).toBe(2);
  });

  it('leaves out a late first sample and says where the series starts', () => {
    const series = buildSeries([
      rise(1000, clock(1, 30, 10), 0, 7, KIND.passes, 25),
      rise(3000, clock(1, 30, 12), 0, 7, KIND.passes),
    ]);
    const expected = [1, 30, ...Array(SERIES_STATS.length * 2).fill(0)];
    expected[2 + SERIES_STATS.indexOf('passes')] = 1; // only the timed rise, not the 25 found at once
    expect(series.from).toEqual(clock(1, 30, 10));
    expect(series.rows).toEqual([expected]);
  });
});

describe('buildBuckets', () => {
  it('adds the players\' 15-minute words per side, ignoring the 9th word', () => {
    const buckets = buildBuckets([
      { side: 0, kinds: { [KIND.shots]: [1, 0, 2, 0, 0, 0, 0, 0, 5] } },
      { side: 0, kinds: { [KIND.shots]: [0, 1, 0, 0, 0, 0, 0, 1, 0] } },
      { side: 1, kinds: {} },
    ]);
    expect(buckets.home.shots).toEqual([1, 1, 2, 0, 0, 0, 0, 1]);
    expect(buckets.away.shots).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(Object.keys(buckets.home)).toEqual(SERIES_STATS);
  });
});
