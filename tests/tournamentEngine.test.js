import { describe, it, expect } from 'vitest';
import { buildAutomaticTournamentData } from '../components/tournament/tournamentEngine.js';

describe('components/tournament/tournamentEngine.js', () => {
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
});
