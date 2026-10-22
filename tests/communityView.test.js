// Página /en-vivo (utils/communityView.js): datos sintéticos.
import { mvpOptions, mvpRanking, pickMvpMatch, pollResults, predictionShares } from '../utils/communityView.js';
import { MVP_GRACE_MS } from '../supabase/functions/_shared/communityVote.js';

const summary = {
  lineups: { home: { starting: [10, 11] }, away: { starting: [20] } },
  substitutions: [{ side: 'away', onId: 21, offId: 20 }],
  names: { players: { 10: 'L. Trossard', 11: 'D. Rice', 20: 'M. Salah', 21: 'D. Núñez' } },
};

describe('pickMvpMatch', () => {
  const now = 50_000_000;
  const m = (key, kind, updatedAtMs) => ({ key, status: { kind }, updatedAtMs });
  it('prefers the live match, then one that ended less than 15 minutes ago', () => {
    expect(pickMvpMatch([m('a', 'finished', now), m('b', 'live')], now).match.key).toBe('b');
    expect(pickMvpMatch([m('a', 'finished', now - 1000)], now)).toMatchObject({ open: true, match: { key: 'a' } });
    expect(pickMvpMatch([m('a', 'finished', now - MVP_GRACE_MS - 1)], now)).toEqual({ match: null, open: false });
  });
});

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

describe('MVP options and ranking', () => {
  it('groups the players who played by team', () => {
    const options = mvpOptions(summary);
    expect(options.home.map(p => p.name)).toEqual(['L. Trossard', 'D. Rice']);
    expect(options.away.map(p => p.name)).toEqual(['M. Salah', 'D. Núñez']);
  });

  it('ranks by votes with percentages', () => {
    expect(mvpRanking({ 10: 3, 20: 1 }, summary)).toEqual([
      { id: 10, votes: 3, name: 'L. Trossard', pct: 75 },
      { id: 20, votes: 1, name: 'M. Salah', pct: 25 },
    ]);
  });
});
