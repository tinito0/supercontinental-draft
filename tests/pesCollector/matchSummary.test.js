// Synthetic scl_probe events only: these prove the summary rules, not anything about the game.
// Real sessions are covered by matchSummary.sessions.test.js (skipped when the recordings are missing).
import {
  parseEventLines,
  splitMatches,
  summarizeMatch,
  toTournamentFields,
} from '../../pes-collector/collector/matchSummary.js';

const HOME = [1001, 1002, 1003];
const AWAY = [2001, 2002, 2003];

// Kind values: 9 u32, the first 8 are the match buckets (research doc S2/S8).
const k = (total, bucket = 0) => {
  const values = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  values[bucket] = total;
  return values;
};

function match(events, { finished = true } = {}) {
  return [
    { t: 'session', ms: 0, home_team: 101, away_team: 103, tournament_id: 17, probe_version: 3 },
    { t: 'stats_appeared', ms: 1000, c: [1, 0, 1], squad_home: HOME, squad_away: AWAY },
    { t: 'state', ms: 1000, c: [1, 0, 1], home: 0, away: 0, pk_home: 0, pk_away: 0, period: 1 },
    ...events,
    ...(finished ? [{ t: 'stats_gone', ms: 999000 }] : []),
  ];
}

describe('parseEventLines', () => {
  it('skips blank lines and a last line that is still being written', () => {
    const text = '{"t":"session","ms":1}\n\n{"t":"state","ms":2}\n{"t":"pst';
    expect(parseEventLines(text).map(e => e.t)).toEqual(['session', 'state']);
  });

  it('rejects a broken line in the middle of the file', () => {
    expect(() => parseEventLines('{"t":"a"}\n{oops\n{"t":"b"}\n')).toThrow(/line 2/);
  });
});

describe('splitMatches', () => {
  it('starts a new match at every stats_appeared and keeps the session settings', () => {
    const events = [
      ...match([]),
      { t: 'stats_appeared', ms: 1000000, c: [1, 0, 0], squad_home: HOME, squad_away: AWAY },
      { t: 'state', ms: 1000001, c: [1, 0, 0], home: 0, away: 0, period: 1 },
    ];
    const matches = splitMatches(events);
    expect(matches).toHaveLength(2);
    expect(matches[1].session.home_team).toBe(101);
    expect(matches[1].events[0].t).toBe('stats_appeared');
  });
});

describe('summarizeMatch', () => {
  it('credits a goal to the side whose score rose and takes the scorer from goal_scored', () => {
    const [m] = splitMatches(match([
      { t: 'goal_scored', ms: 5000, c: [1, 12, 3], player_id: 1003, home_or_away: 0, home: 0, away: 0 },
      { t: 'state', ms: 6000, c: [1, 12, 5], home: 1, away: 0, period: 1 },
      { t: 'pstats', ms: 7000, side: 0, p: { 2: { id: 1003, k: { 0: k(1) } }, 1: { id: 1002, k: { 4: k(1) } } } },
      { t: 'state', ms: 900000, c: [3, 90, 0], home: 1, away: 0, period: 3 },
    ]));
    const summary = summarizeMatch(m);
    expect(summary.score).toEqual({ home: 1, away: 0 });
    expect(summary.goals).toEqual([expect.objectContaining({
      side: 'home', playerId: 1003, ownGoal: false, penalty: false, freeKick: false, assistPlayerId: 1002,
      clock: { period: 1, minute: 12, second: 3 },
    })]);
    expect(summary.status).toBe('finished');
  });

  it('marks an own goal when the scorer plays for the other side and gives no assist', () => {
    const [m] = splitMatches(match([
      { t: 'goal_scored', ms: 5000, c: [1, 19, 18], player_id: 1001, home_or_away: 0 },
      { t: 'state', ms: 6000, c: [1, 19, 20], home: 0, away: 1, period: 1 },
      { t: 'pstats', ms: 7000, side: 0, p: { 0: { id: 1001, k: { 1: k(1) } } } },
    ]));
    const [goal] = summarizeMatch(m).goals;
    expect(goal).toMatchObject({ side: 'away', playerId: 1001, ownGoal: true, assistPlayerId: null });
  });

  it('flags penalty and free-kick goals from the scorer stat that rose with the goal', () => {
    const [m] = splitMatches(match([
      { t: 'goal_scored', ms: 5000, c: [5, 40, 28], player_id: 2003, home_or_away: 1 },
      { t: 'state', ms: 6000, c: [1, 40, 30], home: 0, away: 1, period: 1 },
      { t: 'pstats', ms: 7000, side: 1, p: { 2: { id: 2003, k: { 0: k(1), 3: k(1) } } } },
      { t: 'goal_scored', ms: 50000, c: [2, 70, 0], player_id: 2002, home_or_away: 1 },
      { t: 'state', ms: 51000, c: [2, 70, 2], home: 0, away: 2, period: 2 },
      { t: 'pstats', ms: 52000, side: 1, p: { 1: { id: 2002, k: { 0: k(1), 2: k(1) } } } },
    ]));
    const goals = summarizeMatch(m).goals;
    expect(goals.map(g => [g.playerId, g.penalty, g.freeKick])).toEqual([[2003, true, false], [2002, false, true]]);
  });

  it('leaves the assist empty and warns when two team-mates gained an assist in the same window', () => {
    const [m] = splitMatches(match([
      { t: 'goal_scored', ms: 5000, c: [1, 10, 0], player_id: 1003, home_or_away: 0 },
      { t: 'state', ms: 6000, c: [1, 10, 2], home: 1, away: 0, period: 1 },
      { t: 'pstats', ms: 7000, side: 0, p: { 0: { id: 1001, k: { 4: k(1) } }, 1: { id: 1002, k: { 4: k(1) } } } },
    ]));
    const summary = summarizeMatch(m);
    expect(summary.goals[0].assistPlayerId).toBeNull();
    expect(summary.warnings.join(' ')).toMatch(/assist/i);
  });

  it('keeps a goal without a scorer and warns when no goal_scored event matches', () => {
    const [m] = splitMatches(match([{ t: 'state', ms: 6000, c: [1, 10, 2], home: 1, away: 0, period: 1 }]));
    const summary = summarizeMatch(m);
    expect(summary.goals[0]).toMatchObject({ side: 'home', playerId: null });
    expect(summary.warnings.join(' ')).toMatch(/scorer/i);
  });

  it('records the shootout from the PK score and never as goals', () => {
    const [m] = splitMatches(match([
      { t: 'state', ms: 6000, c: [5, 120, 0], home: 0, away: 0, pk_home: 1, pk_away: 0, period: 5 },
      { t: 'state', ms: 9000, c: [5, 120, 0], home: 0, away: 0, pk_home: 2, pk_away: 4, period: 5 },
      { t: 'state', ms: 9500, c: [4, 120, 0], home: 0, away: 0, pk_home: 2, pk_away: 4, period: 4 },
    ]));
    const summary = summarizeMatch(m);
    expect(summary.goals).toEqual([]);
    expect(summary.shootout).toEqual({ home: 2, away: 4 });
  });

  it('turns a slot taken by a bench player into a substitution and ignores position swaps', () => {
    const [m] = splitMatches(match([
      { t: 'lineup', ms: 2000, c: [1, 0, 41], side: 1, slots: [0, 1], ids: [2001, 2002] },
      { t: 'lineup', ms: 3000, c: [1, 30, 0], side: 1, slots: [1, 0], ids: [2002, 2001],
        slot_changes: [{ slot: 0, from_idx: 0, to_idx: 1 }, { slot: 1, from_idx: 1, to_idx: 0 }] },
      { t: 'lineup', ms: 4000, c: [2, 74, 14], side: 1, slots: [1, 2], ids: [2002, 2003],
        slot_changes: [{ slot: 1, from_idx: 0, to_idx: 2, from_id: 2001, to_id: 2003 }] },
    ]));
    const summary = summarizeMatch(m);
    expect(summary.substitutions).toEqual([
      { side: 'away', offId: 2001, onId: 2003, slot: 1, clock: { period: 2, minute: 74, second: 14 } },
    ]);
    expect(summary.lineups.away).toEqual({ starting: [2001, 2002], final: [2002, 2003] });
  });

  it('lists every card increment, so a second yellow gives a yellow and a red', () => {
    const [m] = splitMatches(match([
      { t: 'pstats', ms: 3000, c: [1, 20, 0], side: 0, p: { 0: { id: 1001, k: { 55: k(1), 57: k(1) } } } },
      { t: 'pstats', ms: 4000, c: [2, 60, 0], side: 0, p: { 0: { id: 1001, k: { 55: k(2), 57: k(2), 58: k(1) } } } },
    ]));
    expect(summarizeMatch(m).cards.map(c => [c.type, c.playerId, c.clock.minute])).toEqual([
      ['yellow', 1001, 20], ['yellow', 1001, 60], ['red', 1001, 60],
    ]);
  });

  it('adds up team stats from the players and names the screen rows', () => {
    const [m] = splitMatches(match([
      { t: 'pstats', ms: 3000, side: 0, p: {
        0: { id: 1001, k: { 22: k(5), 23: k(4), 49: k(3), 50: k(1) } },
        1: { id: 1002, k: { 22: k(2, 3), 23: k(2, 3), 6: k(1), 17: k(1) } },
      } },
    ]));
    const summary = summarizeMatch(m);
    expect(summary.teamStats.home).toMatchObject({ passes: 7, passesCompleted: 6, shots: 1, shotsOnTarget: 1, tacklesWon: 1 });
    expect(summary.players.home.find(p => p.id === 1001).stats).toMatchObject({ tackles: 3, tacklesWon: 1 });
    expect(summary.possession).toBeNull();
  });

  it('reads possession from the probe counters of this match only', () => {
    const [m] = splitMatches(match([{ t: 'possession', ms: 3000, c: [2, 76, 53], home: 6536, away: 7553 }]));
    expect(summarizeMatch(m).possession).toMatchObject({ home: 46, away: 54 });
  });

  it('pairs a goal event that came long before the score change, but only when its score matches', () => {
    const [m] = splitMatches(match([
      { t: 'goal_scored', ms: 5000, c: [1, 19, 18], player_id: 1001, home_or_away: 0, home: 0, away: 0 },
      { t: 'state', ms: 23000, c: [1, 19, 24], home: 0, away: 1, period: 1 },
      { t: 'goal_scored', ms: 30000, c: [1, 25, 0], player_id: 2001, home_or_away: 1, home: 5, away: 5 },
      { t: 'state', ms: 31000, c: [1, 25, 2], home: 0, away: 2, period: 1 },
    ]));
    const summary = summarizeMatch(m);
    expect(summary.goals.map(g => [g.playerId, g.ownGoal])).toEqual([[1001, true], [null, false]]);
  });

  it('finishes when the clock holds at 90:00, not when the period flips during stoppage time', () => {
    const flip = [
      { t: 'state', ms: 6000, c: [3, 90, 9], home: 0, away: 0, period: 3 },
      { t: 'state', ms: 46000, c: [2, 90, 41], home: 0, away: 0, period: 2 },
    ];
    expect(summarizeMatch(splitMatches(match(flip, { finished: false }))[0]).status).toBe('live');
    const held = [...flip,
      { t: 'state', ms: 60000, c: [3, 90, 0], home: 0, away: 0, period: 3 },
      { t: 'snapshot', ms: 95000, c: [3, 90, 0] },
    ];
    expect(summarizeMatch(splitMatches(match(held, { finished: false }))[0]).status).toBe('finished');
  });

  it('takes the clock from the latest event, not the last score or period change', () => {
    const [m] = splitMatches(match([
      { t: 'pstats', ms: 9000, c: [1, 26, 6], side: 0, p: { 0: { id: 1001, k: { 22: k(1) } } } },
    ], { finished: false }));
    expect(summarizeMatch(m).clock).toEqual({ period: 1, minute: 26, second: 6 });
  });

  it('reports live while the match runs and abandoned when it ends before full time', () => {
    const live = splitMatches(match([{ t: 'state', ms: 6000, c: [1, 30, 0], home: 0, away: 0, period: 1 }],
      { finished: false }))[0];
    expect(summarizeMatch(live).status).toBe('live');
    const quit = splitMatches(match([{ t: 'state', ms: 6000, c: [2, 45, 0], home: 0, away: 0, period: 2 }]))[0];
    expect(summarizeMatch(quit).status).toBe('abandoned');
  });
});

describe('toTournamentFields', () => {
  const summary = {
    status: 'finished',
    score: { home: 3, away: 1 },
    goals: [
      { side: 'home', playerId: 1003, ownGoal: false, assistPlayerId: 1002 },
      { side: 'away', playerId: 2001, ownGoal: false, assistPlayerId: null },
      { side: 'home', playerId: 1003, ownGoal: false, assistPlayerId: null },
      { side: 'home', playerId: 2002, ownGoal: true, assistPlayerId: null },
    ],
  };
  const names = { 1002: 'Saka', 1003: 'Eze', 2001: 'Isak', 2002: 'Van Dijk' };

  it('writes scorers and assisters as the engine reads them and leaves own goals out', () => {
    const fields = toTournamentFields(summary, {
      playerName: id => names[id], homeTeam: 'Arsenal', awayTeam: 'Liverpool',
    });
    expect(fields).toEqual({
      homeTeam: 'Arsenal', awayTeam: 'Liverpool', homeScore: 3, awayScore: 1,
      homeGoals: 'Eze x2', awayGoals: 'Isak', homeAssists: 'Saka', awayAssists: '', status: 'completed',
    });
  });

  it('refuses a match that is not finished', () => {
    expect(() => toTournamentFields({ ...summary, status: 'live' }, { playerName: () => 'x' })).toThrow(/finished/);
  });
});

describe('competitionOf', () => {
  it('tells the Konami Cup from exhibition friendlies by Sider tournament_id', async () => {
    const { competitionOf } = await import('../../pes-collector/collector/matchSummary.js');
    expect(competitionOf(48)).toBe('konami_cup');
    expect(competitionOf(17)).toBe('friendly');
    expect(competitionOf(65535)).toBe('friendly');
    expect(competitionOf(2)).toBe('other');
    expect(competitionOf(null)).toBeNull();
  });
});
