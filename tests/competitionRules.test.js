// Reglas de la competencia (utils/competitionRules.js): datos sintéticos, no partidos reales.
import {
  leagueMatchOutcome, buildLeagueStandings, rankStandings, swissPairings, goldCupQuarterFinals, knockoutWinner,
  placeCupResult,
} from '../utils/competitionRules.js';
import { buildCupRounds } from '../utils/bracketModel.js';

const TEAMS = Array.from({ length: 12 }, (_, i) => `T${String(i + 1).padStart(2, '0')}`);
const done = (id, homeTeam, awayTeam, homeScore, awayScore, extra = {}) => ({ id, homeTeam, awayTeam, homeScore, awayScore, status: 'completed', ...extra });

describe('leagueMatchOutcome', () => {
  it('gives 2 points for a win in the 90 minutes and 0 to the loser', () => {
    expect(leagueMatchOutcome({ homeScore: 2, awayScore: 1 })).toEqual({ ok: true, winner: 'home', decidedBy: 'regulation', points: { home: 2, away: 0 } });
  });

  it('gives 1 point to the shootout winner and 0 to the loser after a draw', () => {
    expect(leagueMatchOutcome({ homeScore: 1, awayScore: 1, homePenalties: 3, awayPenalties: 4 }))
      .toEqual({ ok: true, winner: 'away', decidedBy: 'shootout', points: { home: 0, away: 1 } });
  });

  it('refuses a draw without a shootout, a tied shootout or a missing score', () => {
    expect(leagueMatchOutcome({ homeScore: 1, awayScore: 1 }).ok).toBe(false);
    expect(leagueMatchOutcome({ homeScore: 1, awayScore: 1, homePenalties: 4, awayPenalties: 4 }).ok).toBe(false);
    expect(leagueMatchOutcome({ homeScore: '', awayScore: 1 }).ok).toBe(false);
  });
});

describe('buildLeagueStandings', () => {
  it('keeps shootout kicks out of goals for, against and difference', () => {
    const { rows } = buildLeagueStandings(['A', 'B'], [done('m1', 'A', 'B', 2, 2, { homePenalties: 12, awayPenalties: 11 })]);
    expect(rows.find(r => r.name === 'A')).toMatchObject({ points: 1, shootoutWins: 1, goalsFor: 2, goalsAgainst: 2 });
    expect(rows.find(r => r.name === 'B')).toMatchObject({ points: 0, losses: 1, goalsFor: 2, goalsAgainst: 2 });
  });

  it('reports invalid matches instead of counting them', () => {
    const { rows, issues } = buildLeagueStandings(['A', 'B'], [done('m1', 'A', 'B', 1, 1), done('m2', 'A', 'Z', 3, 0)]);
    expect(rows.every(r => r.played === 0)).toBe(true);
    expect(issues.map(i => i.matchId)).toEqual(['m1', 'm2']);
  });

  it('ignores matches that are not completed', () => {
    const { rows } = buildLeagueStandings(['A', 'B'], [{ ...done('m1', 'A', 'B', 3, 0), status: 'scheduled' }]);
    expect(rows.find(r => r.name === 'A').played).toBe(0);
  });
});

describe('rankStandings', () => {
  const row = (name, extra) => ({ name, points: 0, regulationWins: 0, shootoutWins: 0, goalsFor: 0, goalsAgainst: 0, ...extra });

  it('applies points, goal difference, regulation wins, total wins and goals for, in that order', () => {
    const rows = [
      row('GoalsFor', { points: 4, goalsFor: 6, goalsAgainst: 3, regulationWins: 1, shootoutWins: 2 }),
      row('MoreRegWins', { points: 4, goalsFor: 5, goalsAgainst: 2, regulationWins: 2, shootoutWins: 0 }),
      row('BetterDiff', { points: 4, goalsFor: 5, goalsAgainst: 1 }),
      row('MorePoints', { points: 6 }),
      row('MoreWins', { points: 4, goalsFor: 5, goalsAgainst: 2, regulationWins: 1, shootoutWins: 2 }),
    ];
    expect(rankStandings(rows).ranking.map(r => r.name)).toEqual(['MorePoints', 'BetterDiff', 'MoreRegWins', 'GoalsFor', 'MoreWins']);
  });

  it('flags ties that no criterion breaks instead of inventing an order', () => {
    const { unresolvedTies } = rankStandings([row('B', { points: 2 }), row('A', { points: 2 }), row('C', { points: 4 })]);
    expect(unresolvedTies).toEqual([['A', 'B']]);
  });
});

describe('swissPairings', () => {
  const ranking = (points = []) => TEAMS.map((name, i) => ({ name, points: points[i] ?? 0 }));

  it('pairs every team once, neighbours by ranking in round 1', () => {
    const result = swissPairings(ranking());
    expect(result.ok).toBe(true);
    expect(result.pairs).toEqual([['T01', 'T02'], ['T03', 'T04'], ['T05', 'T06'], ['T07', 'T08'], ['T09', 'T10'], ['T11', 'T12']]);
  });

  it('never repeats an opponent and keeps teams with the same points together', () => {
    const played = [['T01', 'T02'], ['T03', 'T04'], ['T05', 'T06'], ['T07', 'T08'], ['T09', 'T10'], ['T11', 'T12']];
    const points = [2, 2, 2, 2, 2, 1, 1, 0, 0, 0, 0, 0];
    const result = swissPairings(ranking(points), played);
    expect(result.ok).toBe(true);
    const keys = new Set(played.map(p => p.slice().sort().join()));
    for (const pair of result.pairs) expect(keys.has(pair.slice().sort().join())).toBe(false);
    expect(result.pairs.flat().sort()).toEqual([...TEAMS].sort());
    const pts = Object.fromEntries(TEAMS.map((t, i) => [t, points[i]]));
    const gaps = result.pairs.map(([a, b]) => Math.abs(pts[a] - pts[b]));
    // 5 teams on 2, 2 on 1, 5 on 0: odd groups force two cross-group pairs, each one point apart.
    expect(gaps.filter(g => g > 0)).toEqual([1, 1]);
  });

  it('says so when no valid round exists instead of allowing a rematch', () => {
    const four = TEAMS.slice(0, 4).map(name => ({ name, points: 0 }));
    const played = [['T01', 'T02'], ['T01', 'T03'], ['T01', 'T04']];
    expect(swissPairings(four, played)).toMatchObject({ ok: false });
  });

  it('refuses an odd number of teams', () => {
    expect(swissPairings(ranking().slice(0, 11)).ok).toBe(false);
  });
});

describe('Copa de Oro', () => {
  it('seeds the quarter-finals 1-8, 4-5, 2-7, 3-6', () => {
    const ranking = TEAMS.map(name => ({ name }));
    expect(goldCupQuarterFinals(ranking).map(m => [m.teamA, m.teamB])).toEqual([
      ['T01', 'T08'], ['T04', 'T05'], ['T02', 'T07'], ['T03', 'T06'],
    ]);
    expect(() => goldCupQuarterFinals(ranking.slice(0, 7))).toThrow(/8 clasificados/);
  });

  it('decides a knockout by the score after extra time, then by the shootout', () => {
    expect(knockoutWinner({ scoreA: 3, scoreB: 2 })).toBe('A');
    expect(knockoutWinner({ scoreA: 2, scoreB: 2, penaltiesA: 11, penaltiesB: 12 })).toBe('B');
    expect(knockoutWinner({ scoreA: 2, scoreB: 2 })).toBeNull();
  });
});

describe('placeCupResult', () => {
  const rounds = buildCupRounds('oro', {
    quarters: [
      { teamA: 'Los Pibes', teamB: 'La Banda', scoreA: '', scoreB: '' },
      { teamA: 'Rojo', teamB: 'Azul', scoreA: 1, scoreB: 0 },
    ],
  });

  it('finds the tie between the two teams and orients the score to it, shootout included', () => {
    const placed = placeCupResult(rounds, { homeName: 'la banda', awayName: 'Los Pibes', score: { home: 2, away: 2 }, shootout: { home: 12, away: 11 } });
    expect(placed).toMatchObject({ ok: true, path: ['quarters'], index: 0, roundId: 'quarters',
      update: { scoreA: 2, scoreB: 2, penaltiesA: 11, penaltiesB: 12 } });
  });

  it('does not overwrite a tie that already has a result', () => {
    expect(placeCupResult(rounds, { homeName: 'Rojo', awayName: 'Azul', score: { home: 3, away: 0 }, shootout: null })).toMatchObject({ ok: false });
  });

  it('refuses a match between teams that do not meet in the bracket', () => {
    expect(placeCupResult(rounds, { homeName: 'Rojo', awayName: 'Los Pibes', score: { home: 1, away: 0 }, shootout: null }).reason).toMatch(/Ningún cruce/);
  });

  it('skips ties already played: two teams from the Oro quarters can meet again in the Plata final', () => {
    const both = [
      ...buildCupRounds('oro', { quarters: [{ teamA: 'Rojo', teamB: 'Azul', scoreA: 1, scoreB: 0 }] }),
      ...buildCupRounds('plata', { repechaje: { final: { teamA: 'Azul', teamB: 'Rojo', scoreA: '', scoreB: '' } } }),
    ];
    expect(placeCupResult(both, { homeName: 'Rojo', awayName: 'Azul', score: { home: 2, away: 1 }, shootout: null }))
      .toMatchObject({ ok: true, path: ['repechaje', 'final'], isFinal: true, update: { scoreA: 1, scoreB: 2 } });
  });
});
