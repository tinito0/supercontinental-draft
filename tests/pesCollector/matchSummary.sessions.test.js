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

describe.skipIf(!shootout)('Arsenal 1-1 Liverpool, 2-4 on penalties (probe v1: no per-player stats)', () => {
  it('records the shootout and the two goals with scorers', () => {
    const [m] = shootout;
    expect(m.score).toEqual({ home: 1, away: 1 });
    expect(m.shootout).toEqual({ home: 2, away: 4 });
    expect(m.goals.map(g => g.playerId)).toEqual([126918, 115079]);
    expect(m.warnings.join(' ')).toMatch(/per-player/);
  });
});
