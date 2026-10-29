import { describe, it, expect } from 'vitest';
import { franchiseByTeam, franchiseIdsOf } from '../utils/franchisePlayers.js';

// Synthetic catalog rows in the market catalog shape: [price, age, ovr, name, pos, country].
const catalog = {
  10: [0.5, 33, 82, 'Veterano Uno', 'DC', 1],
  20: [1.2, 31, 79, 'Veterano Dos', 'MC', 2],
};

describe('franchiseByTeam', () => {
  it('maps each team to its franchise player with name, position and OVR from the catalog', () => {
    const locks = [
      { id: '10', lockedBy: 'teamA', isFranchise: true, lockedAt: '2026-10-01T10:00:00Z' },
      { id: '20', lockedBy: 'teamB', isFranchise: true, lockedAt: '2026-10-02T10:00:00Z' },
    ];

    expect(franchiseByTeam(locks, catalog)).toEqual({
      teamA: { playerId: '10', name: 'Veterano Uno', pos: 'DC', ovr: 82, age: 33 },
      teamB: { playerId: '20', name: 'Veterano Dos', pos: 'MC', ovr: 79, age: 31 },
    });
  });

  it('ignores locks that are not franchise signings', () => {
    expect(franchiseByTeam([{ id: '10', lockedBy: 'teamA', isFranchise: false }], catalog)).toEqual({});
  });

  it('keeps the most recent signing if a team somehow has two', () => {
    const locks = [
      { id: '20', lockedBy: 'teamA', isFranchise: true, lockedAt: '2026-10-05T10:00:00Z' },
      { id: '10', lockedBy: 'teamA', isFranchise: true, lockedAt: '2026-10-01T10:00:00Z' },
    ];

    expect(franchiseByTeam(locks, catalog).teamA.playerId).toBe('20');
  });

  it('keeps a player missing from the catalog, without inventing his data', () => {
    const result = franchiseByTeam([{ id: '99', lockedBy: 'teamA', isFranchise: true }], catalog);

    expect(result.teamA).toEqual({ playerId: '99', name: '', pos: '', ovr: null, age: null });
  });

  it('works before the catalog has loaded', () => {
    expect(franchiseByTeam([{ id: '10', lockedBy: 'teamA', isFranchise: true }], null).teamA.playerId).toBe('10');
  });
});

describe('franchiseIdsOf', () => {
  it('returns the ids of the franchise locks among a team\'s locks', () => {
    const locks = [{ id: '10', isFranchise: true }, { id: '11', isFranchise: false }, { id: '12' }];

    expect([...franchiseIdsOf(locks)]).toEqual(['10']);
  });
});
