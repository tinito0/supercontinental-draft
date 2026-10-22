// Jugador del Torneo: suma de los MVP de la comunidad (utils/playerOfTournament.js).
import { mvpWinner, rankPlayerOfTournament } from '../utils/playerOfTournament.js';

const summary = (home, away, names) => ({
  lineups: { home: { starting: home }, away: { starting: away } },
  names: { teams: { home: 'Arsenal', away: 'Racing' }, players: names },
});
const match = (key, kind, sum) => ({ key, status: { kind }, summary: sum });

describe('mvpWinner', () => {
  it('is the most voted player, none on a tie or without votes', () => {
    expect(mvpWinner({ votes: { 7: 5, 9: 3 } })).toEqual({ playerId: 7, votes: 5 });
    expect(mvpWinner({ votes: { 7: 4, 9: 4 } })).toBeNull();
    expect(mvpWinner({ votes: {} })).toBeNull();
    expect(mvpWinner(null)).toBeNull();
  });
});

describe('rankPlayerOfTournament', () => {
  const s1 = summary([7, 8], [9], { 7: 'Saka', 8: 'Rice', 9: 'Nine' });
  const matches = [
    match('m1', 'finished', s1),
    match('m2', 'finished', s1),
    match('m3', 'finished', s1),
    match('m4', 'live', s1),
  ];
  const votes = {
    m1: { votes: { 7: 5, 9: 1 } },
    m2: { votes: { 9: 6, 7: 2 } },
    m3: { votes: { 7: 3 } },
    m4: { votes: { 9: 50 } },
  };

  it('counts MVP awards of finished matches only, with the team and the total of votes', () => {
    expect(rankPlayerOfTournament(matches, votes)).toEqual([
      { playerId: 7, name: 'Saka', team: 'Arsenal', awards: 2, votes: 10 },
      { playerId: 9, name: 'Nine', team: 'Racing', awards: 1, votes: 7 },
    ]);
  });

  it('breaks a tie in awards by total votes and ignores matches without votes', () => {
    const ranking = rankPlayerOfTournament(matches.slice(0, 2), votes);
    expect(ranking.map(entry => entry.playerId)).toEqual([7, 9]);
    expect(ranking[0]).toMatchObject({ awards: 1, votes: 7 });
    expect(rankPlayerOfTournament(matches, {})).toEqual([]);
  });
});
