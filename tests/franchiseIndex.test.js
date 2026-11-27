import { describe, it, expect } from 'vitest';
import { buildFranchiseIndex } from '../scripts/build-franchise-index.mjs';
import { franchiseByTeam } from '../utils/franchisePlayers.js';

// Synthetic catalog rows: [price, age, ovr, name, pos, country].
const catalog = {
  1: [9, 33, 82, 'Eligible', 'DC', 1],
  2: [9, 29, 85, 'Too young', 'MC', 1],
  3: [9, 35, 80, 'Too low', 'DFC', 1],
  4: [9, 34, 89, 'Too high', 'PT', 1],
  5: [9, 30, 81, 'Lower bound', 'EXI', 1],
  6: [9, 31, 88, 'Upper bound', 'EXD', 1],
};

describe('buildFranchiseIndex', () => {
  it('keeps only rows meeting the franchise age and OVR window, inclusive', () => {
    expect(Object.keys(buildFranchiseIndex(catalog))).toEqual(['1', '5', '6']);
  });

  it('keeps rows unchanged so franchiseByTeam reads the index like the full catalog', () => {
    const index = buildFranchiseIndex(catalog);
    const locks = [{ id: '1', lockedBy: 'teamA', isFranchise: true, lockedAt: '2026-10-01' }];
    expect(franchiseByTeam(locks, index)).toEqual(franchiseByTeam(locks, catalog));
  });

  it('returns an empty index for a missing catalog', () => {
    expect(buildFranchiseIndex(null)).toEqual({});
  });
});
