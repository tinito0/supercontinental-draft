// Season reset writes per club. Pure functions, synthetic values.
import { describe, it, expect } from 'vitest';
import { profileResetData, teamResetData, canResetSeason } from '../utils/seasonReset.js';
import { DEFAULT_TACTICS } from '../utils/constants.js';

describe('season reset', () => {
  it('empties the public roster, so the team page stops showing last season', () => {
    const data = teamResetData(new Date('2026-10-16T12:00:00Z'));
    expect(data.roster).toEqual([]);
    expect(data.rosterUpdatedAt).toBe('2026-10-16T12:00:00.000Z');
    expect(data).toMatchObject({ lineup: {}, dorsals: {}, matchBench: [], formation: '4-3-3', tactics: DEFAULT_TACTICS });
  });

  it('gives the franchise slot back on the private profile and keeps the budget out of it', () => {
    const data = profileResetData();
    expect(data).toMatchObject({ franchisePlayerUsed: false, franchisePlayerId: null, lineup: {} });
    expect(data).not.toHaveProperty('budget');
    expect(data).not.toHaveProperty('roster');
  });

  it('only runs with the market closed', () => {
    expect(canResetSeason({ status: 'closed' })).toBe(true);
    for (const status of ['open', 'scheduled', 'FranchiseMarket', 'loading']) {
      expect(canResetSeason({ status })).toBe(false);
    }
    expect(canResetSeason(null)).toBe(false);
  });
});
