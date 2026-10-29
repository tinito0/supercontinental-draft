import { getMyVote, sendVote } from '../services/communityService.js';

// Synthetic localStorage only: proves the vote memory, not the Edge Function.
function memoryStorage() {
  const items = new Map();
  return { getItem: key => (items.has(key) ? items.get(key) : null), setItem: (key, value) => items.set(key, String(value)), clear: () => items.clear() };
}

beforeEach(() => vi.stubGlobal('window', { localStorage: memoryStorage() }));
afterEach(() => vi.unstubAllGlobals());

describe('getMyVote and vote rounds', () => {

  it('reads votes saved before rounds existed as round 0', () => {
    window.localStorage.setItem('scl.community.vote.prediction.league-8', 'home');
    expect(getMyVote('prediction', 'league-8')).toBe('home');
    expect(getMyVote('prediction', 'league-8', 1)).toBeNull();
  });

  it('forgets the remembered vote once the admin resets the voting', () => {
    window.localStorage.setItem('scl.community.vote.cup.oro', JSON.stringify({ choice: 'team-a', round: 2 }));
    expect(getMyVote('cup', 'oro', 2)).toBe('team-a');
    expect(getMyVote('cup', 'oro', 3)).toBeNull();
  });

  it('returns null when nothing was voted', () => {
    expect(getMyVote('mvp', 'k1', 0)).toBeNull();
  });
});

describe('sendVote without the functions URL', () => {
  it('fails cleanly instead of throwing', async () => {
    const result = await sendVote({ kind: 'prediction', matchId: 'league-8', choice: 'home' }, { round: 1 });
    expect(result.ok).toBe(false);
  });
});
