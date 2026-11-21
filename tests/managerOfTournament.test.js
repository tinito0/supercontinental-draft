// Manager del torneo (utils/managerOfTournament.js): fechas ganadas en la votación del público. Sintético.
import { managerWinner, rankManagerOfTournament } from '../utils/managerOfTournament.js';

describe('managerWinner', () => {
  it('is the most voted club, or nobody without votes or on a tie at the top', () => {
    expect(managerWinner({ votes: { Talleres: 5, 'SK Konya': 3 } })).toEqual({ club: 'Talleres', votes: 5 });
    expect(managerWinner({ votes: { Talleres: 3, 'SK Konya': 3 } })).toBeNull();
    expect(managerWinner({ votes: {} })).toBeNull();
    expect(managerWinner(null)).toBeNull();
  });
});

describe('rankManagerOfTournament', () => {
  it('ranks by rounds won, then by every vote of the season', () => {
    const ranking = rankManagerOfTournament({
      'fecha-2': { votes: { Talleres: 4, 'SK Konya': 2 } },
      'fecha-1': { votes: { 'SK Konya': 9, Talleres: 1 } },
      'fecha-3': { votes: { Lourinhã: 2, Talleres: 2 } },
      'fecha-10': { votes: { Talleres: 3 } },
    });
    expect(ranking).toEqual([
      { club: 'Talleres', awards: 2, votes: 10, rounds: ['fecha-2', 'fecha-10'] },
      { club: 'SK Konya', awards: 1, votes: 11, rounds: ['fecha-1'] },
    ]);
  });

  it('leaves out the round that is still being voted', () => {
    const byRoundId = { 'fecha-1': { votes: { Talleres: 2 } }, 'fecha-2': { votes: { 'SK Konya': 5 } } };
    expect(rankManagerOfTournament(byRoundId, { openRoundId: 'fecha-2' })).toEqual([{ club: 'Talleres', awards: 1, votes: 2, rounds: ['fecha-1'] }]);
  });
});
