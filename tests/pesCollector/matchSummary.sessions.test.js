// Real scl_probe recordings from E:\eFootball PES 2021\scl_probe (2026-10-21). Skipped when they are missing.
// Expected values come from the user's notes and the in-game result screens of each match.
import { existsSync, readFileSync } from 'node:fs';
import { parseEventLines, splitMatches, summarizeMatch } from '../../pes-collector/collector/matchSummary.js';

const ROOT = process.env.SCL_PROBE_DIR || 'E:/eFootball PES 2021/scl_probe';

function load(session) {
  const file = `${ROOT}/${session}/events.ndjson`;
  return existsSync(file) ? splitMatches(parseEventLines(readFileSync(file, 'utf8'))).map(summarizeMatch) : null;
}

const arsenalLiverpool = load('20261021_180553');
const bayernReal = load('20261021_183131');
const shootout = load('20261021_162012');

describe.skipIf(!arsenalLiverpool)('Arsenal 1-1 Liverpool (probe v2)', () => {
  const [m] = arsenalLiverpool || [];

  it('has the final score, the FK goal and Eze assisted by Havertz', () => {
    expect(m.status).toBe('finished');
    expect(m.score).toEqual({ home: 1, away: 1 });
    expect(m.goals.map(g => [g.side, g.playerId, g.freeKick, g.assistPlayerId, g.clock.minute])).toEqual([
      ['away', 130319, true, null, 33],
      ['home', 114906, false, 114506, 90],
    ]);
  });

  it('has the six substitutions at 74 and 87 minutes and the yellow at 74', () => {
    expect(m.substitutions.map(s => [s.side, s.clock.minute])).toEqual([
      ['away', 74], ['away', 74], ['away', 74], ['home', 87], ['home', 87], ['home', 87],
    ]);
    expect(m.cards).toEqual([expect.objectContaining({ side: 'home', playerId: 130202, type: 'yellow' })]);
  });

  it('matches the full-time team screen', () => {
    expect(m.teamStats.home).toMatchObject({ shots: 7, shotsOnTarget: 6, fouls: 3, corners: 3, freeKicks: 2,
      passes: 60, passesCompleted: 49, crosses: 0, interceptions: 9, tacklesWon: 1, saves: 0 });
    expect(m.teamStats.away).toMatchObject({ shots: 2, shotsOnTarget: 1, fouls: 2, corners: 0, freeKicks: 3,
      passes: 62, passesCompleted: 48, crosses: 1, interceptions: 6, tacklesWon: 0, saves: 5 });
  });
});

describe.skipIf(!bayernReal)('Bayern 0-2 Real Madrid, then an unfinished replay (probe v3)', () => {
  it('splits the session into the full match and the abandoned replay', () => {
    expect(bayernReal.map(m => m.status)).toEqual(['finished', 'abandoned']);
  });

  it('has the Neuer own goal, the Mbappé penalty and the Kane red', () => {
    const [m] = bayernReal;
    expect(m.score).toEqual({ home: 0, away: 2 });
    expect(m.goals.map(g => [g.side, g.playerId, g.ownGoal, g.penalty])).toEqual([
      ['away', 33185, true, false],
      ['away', 110718, false, true],
    ]);
    expect(m.cards.filter(c => c.type === 'red').map(c => c.playerId)).toEqual([47287]);
    expect(m.teamStats.away).toMatchObject({ shots: 6, shotsOnTarget: 6, passes: 66, passesCompleted: 53, tacklesWon: 3 });
  });
});

// The derived fields must add up to the game's own totals in every recorded match (research doc S10).
const recorded = ['20261021_180553', '20261021_183131', '20261021_190934', '20261021_202647']
  .flatMap(session => (load(session) || []).map((summary, index) => ({ label: `${session}#${index}`, summary })));

describe.skipIf(!recorded.length)('shots, series and buckets reconcile with the totals (real recordings)', () => {
  it.each(recorded)('$label', ({ summary }) => {
    for (const side of ['home', 'away']) {
      const stats = summary.teamStats[side];
      const shots = summary.shots.filter(shot => shot.side === side);
      const count = outcome => shots.filter(shot => shot.outcome === outcome).length;
      const ownGoalsFor = summary.goals.filter(goal => goal.side === side && goal.ownGoal).length;
      expect(shots).toHaveLength(stats.shots);
      expect(count('goal') + count('on_target')).toBe(stats.shotsOnTarget);
      expect(count('goal') + ownGoalsFor).toBe(summary.score[side]);
      expect(shots.filter(shot => shot.penalty)).toHaveLength(stats.penaltyShots);
      expect(stats.shortPasses + stats.throughPasses + stats.longPasses + stats.crosses).toBe(stats.passes);
      expect(stats.shortPassesCompleted + stats.throughPassesCompleted + stats.longPassesCompleted + stats.crossesCompleted)
        .toBe(stats.passesCompleted);
      for (const [column, name] of summary.series.kinds.entries()) {
        const offset = 2 + (side === 'home' ? 0 : summary.series.kinds.length) + column;
        const perMinute = summary.series.rows.reduce((sum, row) => sum + row[offset], 0);
        const perBucket = summary.buckets[side][name].reduce((sum, value) => sum + value, 0);
        expect(perMinute, `${side} ${name} per minute`).toBe(stats[name] ?? perBucket);
        expect(perBucket, `${side} ${name} per bucket`).toBe(perMinute);
      }
    }
  });
});

describe.skipIf(!shootout)('Arsenal 1-1 Liverpool, 2-4 on penalties (probe v1: no per-player stats)', () => {
  it('records the shootout and the two goals with scorers', () => {
    const [m] = shootout;
    expect(m.score).toEqual({ home: 1, away: 1 });
    expect(m.shootout).toEqual({ home: 2, away: 4 });
    expect(m.goals.map(g => g.playerId)).toEqual([126918, 115079]);
    expect(m.warnings.join(' ')).toMatch(/per-player/);
  });
});
