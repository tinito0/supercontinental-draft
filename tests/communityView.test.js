// Página /en-vivo (utils/communityView.js): datos sintéticos.
import { pollResults, predictionShares } from '../utils/communityView.js';

describe('predictionShares', () => {
  it('rounds to whole percentages that add up to 100', () => {
    expect(predictionShares({ home: 2, away: 1 })).toEqual({ home: 67, draw: 0, away: 33, total: 3, leader: 'home' });
    expect(predictionShares({ home: 1, draw: 1, away: 1 })).toMatchObject({ home: 34, draw: 33, away: 33, leader: null });
    expect(predictionShares({ draw: 3, away: 1 })).toMatchObject({ draw: 75, away: 25, leader: 'draw' });
    expect(predictionShares({})).toEqual({ home: 0, draw: 0, away: 0, total: 0, leader: null });
  });
});

describe('pollResults (¿quién gana la copa?)', () => {
  it('lists every option with its share, most voted first', () => {
    const poll = { options: [{ id: 'a', name: 'Los Pibes' }, { id: 'b', name: 'La Banda' }, { id: 'c', name: 'Sin votos' }], votes: { a: 1, b: 3 } };
    expect(pollResults(poll)).toEqual({
      total: 4,
      options: [
        { id: 'b', name: 'La Banda', votes: 3, pct: 75 },
        { id: 'a', name: 'Los Pibes', votes: 1, pct: 25 },
        { id: 'c', name: 'Sin votos', votes: 0, pct: 0 },
      ],
    });
    expect(pollResults(null)).toEqual({ total: 0, options: [] });
  });
});
