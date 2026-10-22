import { describe, it, expect } from 'vitest';
import { buildAutomaticTournamentData, buildAutomaticTournamentReport, getMatchesWithNewResults } from '../components/tournament/tournamentEngine.js';

describe('components/tournament/tournamentEngine.js', () => {
  it('undoes computed stats when a completed match goes back to scheduled', () => {
    const match = { id: 'm1', homeTeam: 'Boca', awayTeam: 'River', homeScore: 2, awayScore: 0, homeGoals: 'Cavani x 2', status: 'completed' };
    const computed = buildAutomaticTournamentData({ league: [{ name: 'Boca' }, { name: 'River' }], matches: [match] });
    expect(computed.league.find(t => t.name === 'Boca')).toMatchObject({ pj: 1, pts: 2, gf: 2 });

    const reverted = buildAutomaticTournamentData({ ...computed, matches: [{ ...match, status: 'scheduled' }] });
    expect(reverted.league.find(t => t.name === 'Boca')).toMatchObject({ pj: 0, pg: 0, pts: 0, gf: 0, gc: 0 });
    expect(reverted.league.find(t => t.name === 'River')).toMatchObject({ pj: 0, pp: 0, pts: 0 });
    expect(reverted.topScorers.every(s => s.name === '')).toBe(true);
  });

  it('a team whose only match is reverted is reset even while other matches stay completed', () => {
    const m1 = { id: 'm1', homeTeam: 'Boca', awayTeam: 'River', homeScore: 1, awayScore: 0, status: 'completed' };
    const m2 = { id: 'm2', homeTeam: 'Racing', awayTeam: 'Independiente', homeScore: 3, awayScore: 3, homePenalties: 5, awayPenalties: 4, status: 'completed' };
    const computed = buildAutomaticTournamentData({ league: [], matches: [m1, m2] });
    const reverted = buildAutomaticTournamentData({ ...computed, matches: [{ ...m1, status: 'scheduled' }, m2] });
    expect(reverted.league.find(t => t.name === 'Boca')).toMatchObject({ pj: 0, pts: 0 });
    expect(reverted.league.find(t => t.name === 'Racing')).toMatchObject({ pj: 1, pts: 1, gf: 3 });
  });

  it('keeps stats typed by hand for teams without completed matches', () => {
    const manual = { league: [{ name: 'Boca', pj: 5, pts: 9 }], matches: [], topScorers: [{ name: 'X', team: 'Boca', goals: 4 }] };
    expect(buildAutomaticTournamentData(manual)).toEqual(manual);
  });

  it('returns data unchanged when there are no completed matches', () => {
    const initialData = {
      league: [{ name: 'Boca' }, { name: 'River' }],
      matches: [
        { homeTeam: 'Boca', awayTeam: 'River', status: 'scheduled' }
      ]
    };
    const result = buildAutomaticTournamentData(initialData);
    expect(result).toEqual(initialData);
  });

  it('accurately calculates points, goals, and records for completed matches', () => {
    const inputData = {
      league: [
        { name: 'Boca', pj: 0, pg: 0, gpen: 0, pp: 0, pts: 0, gf: 0, gc: 0 },
        { name: 'River', pj: 0, pg: 0, gpen: 0, pp: 0, pts: 0, gf: 0, gc: 0 }
      ],
      matches: [
        {
          id: 'm1',
          homeTeam: 'Boca',
          awayTeam: 'River',
          homeScore: 3,
          awayScore: 1,
          status: 'completed',
          homeGoals: 'Cavani x 2, Merentiel',
          awayGoals: 'Borja',
          homeAssists: 'Zenón x 2',
          awayAssists: 'Nacho'
        }
      ]
    };

    const calculated = buildAutomaticTournamentData(inputData);

    const boca = calculated.league.find(t => t.name.toLowerCase() === 'boca');
    const river = calculated.league.find(t => t.name.toLowerCase() === 'river');

    expect(boca).toBeDefined();
    expect(boca.pj).toBe(1);
    expect(boca.pg).toBe(1);
    expect(boca.pts).toBe(2); // Win awards 2 points in tournament format
    expect(boca.gf).toBe(3);
    expect(boca.gc).toBe(1);

    expect(river).toBeDefined();
    expect(river.pj).toBe(1);
    expect(river.pp).toBe(1);
    expect(river.pts).toBe(0);
    expect(river.gf).toBe(1);
    expect(river.gc).toBe(3);

    // Check top scorers
    expect(calculated.topScorers[0].name).toBe('Cavani');
    expect(calculated.topScorers[0].goals).toBe(2);

    // Check top assisters
    expect(calculated.topAssisters[0].name).toBe('Zenón');
    expect(calculated.topAssisters[0].assists).toBe(2);

    // Check table padding
    expect(calculated.league.length).toBe(12);
  });

  it('a draw goes to the shootout winner: 1 point and a GPEN for the winner, a loss for the other (T1)', () => {
    const inputData = {
      league: [
        { name: 'Racing', pj: 0, pg: 0, gpen: 0, pp: 0, pts: 0, gf: 0, gc: 0 },
        { name: 'Independiente', pj: 0, pg: 0, gpen: 0, pp: 0, pts: 0, gf: 0, gc: 0 }
      ],
      matches: [{ id: 'm2', homeTeam: 'Racing', awayTeam: 'Independiente', homeScore: 2, awayScore: 2, homePenalties: 3, awayPenalties: 4, status: 'completed' }],
    };
    const { data, issues } = buildAutomaticTournamentReport(inputData);
    const racing = data.league.find(t => t.name === 'Racing');
    const rojo = data.league.find(t => t.name === 'Independiente');
    expect(rojo).toMatchObject({ pj: 1, pg: 0, gpen: 1, pp: 0, pts: 1, gf: 2, gc: 2 });
    expect(racing).toMatchObject({ pj: 1, pg: 0, gpen: 0, pp: 1, pts: 0, gf: 2, gc: 2 });
    expect(issues).toEqual([]);
  });

  it('a draw without the shootout counts the goals but no points, and is reported', () => {
    const inputData = {
      league: [{ name: 'Racing' }, { name: 'Independiente' }],
      matches: [{ id: 'm2', homeTeam: 'Racing', awayTeam: 'Independiente', homeScore: 1, awayScore: 1, status: 'completed' }],
    };
    const { data, issues } = buildAutomaticTournamentReport(inputData);
    expect(data.league.find(t => t.name === 'Racing')).toMatchObject({ pj: 1, pts: 0, gf: 1, gpen: 0, pp: 0 });
    expect(issues).toEqual([{ matchId: 'm2', label: 'Racing vs Independiente', reason: 'Empate en los 90 minutos: falta el resultado de la tanda de penales.' }]);
  });

  it('a match marked completed without both scores does not count as a 0-0 draw', () => {
    const data = { league: [{ name: 'Boca', pj: 3, pts: 6 }], matches: [
      { id: 'm1', homeTeam: 'Boca', awayTeam: 'River', homeScore: '', awayScore: '', homeGoals: 'Cavani', status: 'completed' },
    ] };
    const computed = buildAutomaticTournamentData(data);
    expect(computed.league.find(t => t.name === 'Boca')).toMatchObject({ pj: 3, pts: 6 });
    expect(computed.league.find(t => t.name === 'River')).toMatchObject({ pj: 0, pts: 0 });
    expect(computed.topScorers[0]).toMatchObject({ name: 'Cavani', goals: 1 });
  });
});

describe('getMatchesWithNewResults', () => {
  const done = { id: 'm1', homeTeam: 'Boca', awayTeam: 'River', homeScore: 2, awayScore: 1, status: 'completed' };

  it('returns nothing when results did not change (saving no longer republishes old news)', () => {
    expect(getMatchesWithNewResults([done], [{ ...done, homeScore: '2' }])).toEqual([]);
  });

  it('returns newly completed and corrected matches only', () => {
    const scheduled = { ...done, id: 'm2', status: 'scheduled' };
    const next = [{ ...done, awayScore: 3 }, { ...scheduled, status: 'completed' }, { id: 'm3', status: 'scheduled' }];
    expect(getMatchesWithNewResults([done, scheduled], next).map(m => m.id)).toEqual(['m1', 'm2']);
    expect(getMatchesWithNewResults(undefined, [done]).map(m => m.id)).toEqual(['m1']);
    expect(getMatchesWithNewResults([done], [{ ...done, id: undefined }])).toEqual([]);
  });
});

describe('rankLeague (desempates del reglamento, T3)', () => {
  it('orders by points, goal difference, regulation wins, total wins and goals for, empty slots last', async () => {
    const { rankLeague } = await import('../components/tournament/tournamentEngine.js');
    const league = [
      { name: 'Club...', pts: 0 },
      { name: 'A', pts: 4, pg: 1, gpen: 2, gf: 5, gc: 3 },
      { name: 'B', pts: 4, pg: 2, gpen: 0, gf: 6, gc: 4 },
      { name: 'C', pts: 6, pg: 3, gpen: 0, gf: 3, gc: 3 },
    ];
    const { league: ranked, unresolvedTies } = rankLeague(league);
    expect(ranked.map(row => row.name)).toEqual(['C', 'B', 'A', 'Club...']);
    expect(unresolvedTies).toEqual([]);
  });

  it('reports ties no criterion breaks instead of deciding them', async () => {
    const { rankLeague } = await import('../components/tournament/tournamentEngine.js');
    const twin = { pts: 2, pg: 1, gpen: 0, gf: 1, gc: 0 };
    expect(rankLeague([{ name: 'Y', ...twin }, { name: 'X', ...twin }]).unresolvedTies).toEqual([['X', 'Y']]);
  });
});

describe('buildAutomaticTournamentReport', () => {
  it('reports the clubs that do not fit in the 12-team table instead of dropping them silently', async () => {
    const { buildAutomaticTournamentReport } = await import('../components/tournament/tournamentEngine.js');
    const league = Array.from({ length: 12 }, (_, i) => ({ name: `Club ${i + 1}` }));
    const match = { id: 'x', homeTeam: 'Club 1', awayTeam: 'Club Fantasma', homeScore: 1, awayScore: 0, status: 'completed' };
    const { data, overflow } = buildAutomaticTournamentReport({ league, matches: [match] });
    expect(overflow).toEqual(['Club Fantasma']);
    expect(data.league).toHaveLength(12);
    expect(buildAutomaticTournamentReport({ league, matches: [{ ...match, awayTeam: 'Club 2' }] }).overflow).toEqual([]);
  });
});

describe('suggestSwissRound («Sugerir fecha N»)', () => {
  const teams = ['A', 'B', 'C', 'D'];
  const done = (id, round, homeTeam, awayTeam, homeScore, awayScore) => ({ id, round, homeTeam, awayTeam, homeScore, awayScore, status: 'completed' });

  it('leaves round 1 to the admin', async () => {
    const { suggestSwissRound } = await import('../components/tournament/tournamentEngine.js');
    expect(suggestSwissRound({ league: teams.map(name => ({ name })), matches: [] })).toMatchObject({ ok: false, reason: expect.stringMatching(/fecha 1/i) });
  });

  it('pairs teams by the table without repeating a rival once the round is over', async () => {
    const { suggestSwissRound } = await import('../components/tournament/tournamentEngine.js');
    const data = { league: teams.map(name => ({ name })), matches: [done('1', 'Fecha 1', 'A', 'B', 2, 0), done('2', 'Fecha 1', 'C', 'D', 1, 0)] };
    const suggestion = suggestSwissRound(data);
    expect(suggestion.ok).toBe(true);
    expect(suggestion.round).toBe('Fecha 2');
    // Tabla: A y C con 2 puntos; D (DG -1) arriba de B (DG -2).
    expect(suggestion.pairs).toEqual([['A', 'C'], ['D', 'B']]);
  });

  it('waits until every match of the last round is finished', async () => {
    const { suggestSwissRound } = await import('../components/tournament/tournamentEngine.js');
    const data = { league: teams.map(name => ({ name })), matches: [done('1', 'Fecha 1', 'A', 'B', 2, 0), { id: '2', round: 'Fecha 1', homeTeam: 'C', awayTeam: 'D', status: 'scheduled' }] };
    expect(suggestSwissRound(data)).toMatchObject({ ok: false, reason: expect.stringMatching(/Terminá la Fecha 1/) });
  });
});
