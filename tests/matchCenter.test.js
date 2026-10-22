// Registro de partidos (utils/matchCenter.js) con un resumen sintético con la forma de scl.match/1.
import {
  buildLineups, buildTimeline, groupMatchesByDay, matchStartDate, minuteLabel, parseMatchDoc, playerStatRows, teamStatRows,
} from '../utils/matchCenter.js';

const clock = (period, minute, second = 0) => ({ period, minute, second });

const summary = {
  schema: 'scl.match/1',
  status: 'finished',
  match: { homeTeamId: 101, awayTeamId: 103, tournamentId: 48, extraTime: false, penalties: true },
  clock: clock(2, 90),
  score: { home: 1, away: 1 },
  shootout: { home: 4, away: 3 },
  goals: [
    { side: 'away', playerId: 20, assistPlayerId: null, ownGoal: false, penalty: true, clock: clock(2, 70, 5) },
    { side: 'home', playerId: 10, assistPlayerId: 11, ownGoal: false, penalty: false, clock: clock(1, 14, 29) },
  ],
  cards: [{ side: 'away', playerId: 21, type: 'yellow', clock: clock(1, 45, 30) }],
  substitutions: [{ side: 'home', offId: 11, onId: 12, slot: 8, clock: clock(2, 74) }],
  lineups: { home: { starting: [10, 11], final: [10, 12] }, away: { starting: [20, 21], final: [20, 21] } },
  players: {
    home: [
      { id: 10, stats: { goals: 1, shots: 3, shotsOnTarget: 2, passes: 20, passesCompleted: 15 } },
      { id: 11, stats: { assists: 1, passes: 10, passesCompleted: 9 } },
      { id: 12, stats: { passes: 2, passesCompleted: 2 } },
      { id: 13, stats: {} }, // en el banco, no jugó
    ],
    away: [{ id: 20, stats: { goals: 1 } }, { id: 21, stats: { tacklesWon: 2 } }],
  },
  teamStats: {
    home: { shots: 6, shotsOnTarget: 4, passes: 88, passesCompleted: 69, fouls: 2, yellowCards: 0, redCards: 0 },
    away: { shots: 4, shotsOnTarget: 2, passes: 67, passesCompleted: 50, fouls: 0, yellowCards: 1, redCards: 0 },
  },
  possession: null,
  teams: { home: { gameTeamId: 101, draftTeamId: null, name: null }, away: { gameTeamId: 103, draftTeamId: 'uid-7', name: 'Los Pibes FC' } },
  names: { teams: { home: 'Arsenal', away: 'Liverpool' }, players: { 10: 'L. Trossard', 11: 'D. Rice', 12: 'K. Havertz', 20: 'M. Salah', 21: 'A. Mac Allister' } },
};
const doc = { matchKey: '20261021T232728Z_101-103', status: 'finished', summaryJson: JSON.stringify(summary) };

describe('minuteLabel', () => {
  it('shows football minutes, with stoppage time after each period', () => {
    expect(minuteLabel(clock(1, 14, 29))).toBe("15'");
    expect(minuteLabel(clock(1, 45, 30))).toBe("45+1'");
    expect(minuteLabel(clock(2, 93))).toBe("90+4'");
    expect(minuteLabel(clock(3, 99))).toBe("100'");
    expect(minuteLabel(null)).toBe('');
  });
});

describe('parseMatchDoc', () => {
  it('uses the league name when the team is mapped and the game name otherwise', () => {
    const match = parseMatchDoc(doc);
    expect(match.home.name).toBe('Arsenal');
    expect(match.away).toMatchObject({ name: 'Los Pibes FC', draftTeamId: 'uid-7', score: 1 });
    expect(match.status).toEqual({ kind: 'finished', label: 'Final (pen.)' });
    expect(match.competition).toBe('Copa');
    expect(match.startedAt.toISOString()).toBe('2026-10-21T23:27:28.000Z');
  });

  it('shows the live minute and survives a doc without summary', () => {
    const live = parseMatchDoc({ ...doc, summaryJson: JSON.stringify({ ...summary, status: 'live', shootout: null, clock: clock(1, 30) }) });
    expect(live.status).toEqual({ kind: 'live', label: "31'" });
    const bare = parseMatchDoc({ matchKey: doc.matchKey, status: 'live', homeGameTeamId: 101, awayGameTeamId: 103, score: { home: 2, away: 0 }, clock: clock(1, 3), summaryJson: '{bad' });
    expect(bare).toMatchObject({ home: { name: 'Equipo 101', score: 2 }, status: { kind: 'live', label: "4'" }, summary: null });
    expect(parseMatchDoc({})).toBeNull();
  });
});

describe('buildTimeline', () => {
  it('orders goals, cards and subs by time and carries the running score', () => {
    const events = buildTimeline(summary);
    expect(events.map(e => [e.type, e.minute])).toEqual([['goal', "15'"], ['card', "45+1'"], ['goal', "71'"], ['sub', "75'"]]);
    expect(events[0]).toMatchObject({ player: 'L. Trossard', assist: 'D. Rice', score: '1-0' });
    expect(events[2]).toMatchObject({ player: 'M. Salah', penalty: true, assist: null, score: '1-1' });
    expect(events[3]).toMatchObject({ playerIn: 'K. Havertz', playerOut: 'D. Rice' });
  });
});

describe('teamStatRows', () => {
  it('lists only what was measured, with the pass accuracy derived and no invented possession', () => {
    const rows = teamStatRows(summary);
    expect(rows.find(r => r.key === 'possession')).toBeUndefined();
    expect(rows.find(r => r.key === 'passAccuracy')).toMatchObject({ home: 78, away: 75 });
    expect(rows.find(r => r.key === 'corners')).toBeUndefined(); // not in teamStats
    expect(teamStatRows({})).toEqual([]);
  });
});

describe('buildLineups and playerStatRows', () => {
  it('marks who went off and who came on, with goals, assists and cards', () => {
    const { home, away } = buildLineups(summary);
    expect(home.starting).toEqual([
      expect.objectContaining({ name: 'L. Trossard', goals: 1, subbedOff: null }),
      expect.objectContaining({ name: 'D. Rice', assists: 1, subbedOff: "75'" }),
    ]);
    expect(home.substitutes).toEqual([expect.objectContaining({ name: 'K. Havertz', subbedOn: "75'", replaced: 'D. Rice' })]);
    expect(away.starting[1].cards).toEqual(['yellow']);
  });

  it('includes only players who played', () => {
    const rows = playerStatRows(summary);
    expect(rows.map(r => r.id)).toEqual([10, 11, 12, 20, 21]);
    expect(rows[0]).toMatchObject({ goals: 1, shots: 3, passesCompleted: 15 });
  });
});

describe('groupMatchesByDay', () => {
  it('puts live matches first, then newest days first', () => {
    const at = (key, kind) => ({ key, startedAt: matchStartDate(key), status: { kind } });
    const groups = groupMatchesByDay([
      at('20261020T200000Z_1-2', 'finished'),
      at('20261021T200000Z_3-4', 'finished'),
      at('20261021T230000Z_5-6', 'live'),
    ], 'es-AR', 'UTC');
    expect(groups.map(g => [g.label, g.matches.map(m => m.key)])).toEqual([
      ['En vivo', ['20261021T230000Z_5-6']],
      ['miércoles, 21 de octubre', ['20261021T200000Z_3-4']],
      ['martes, 20 de octubre', ['20261020T200000Z_1-2']],
    ]);
  });
});
