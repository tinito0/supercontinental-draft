import { describe, it, expect } from 'vitest';
import { buildAutomaticTournamentData, getMatchesWithNewResults } from '../components/tournament/tournamentEngine.js';

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
    const m2 = { id: 'm2', homeTeam: 'Racing', awayTeam: 'Independiente', homeScore: 3, awayScore: 3, status: 'completed' };
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

  it('handles draws awarding 1 point to each side', () => {
    const inputData = {
      league: [
        { name: 'Racing', pj: 0, pg: 0, gpen: 0, pp: 0, pts: 0, gf: 0, gc: 0 },
        { name: 'Independiente', pj: 0, pg: 0, gpen: 0, pp: 0, pts: 0, gf: 0, gc: 0 }
      ],
      matches: [
        {
          id: 'm2',
          homeTeam: 'Racing',
          awayTeam: 'Independiente',
          homeScore: 2,
          awayScore: 2,
          status: 'completed'
        }
      ]
    };

    const calculated = buildAutomaticTournamentData(inputData);
    const racing = calculated.league.find(t => t.name.toLowerCase() === 'racing');
    const rojo = calculated.league.find(t => t.name.toLowerCase() === 'independiente');

    expect(racing.pts).toBe(1);
    expect(racing.gpen).toBe(1);
    expect(rojo.pts).toBe(1);
    expect(rojo.gpen).toBe(1);
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
