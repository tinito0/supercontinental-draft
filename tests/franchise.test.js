import { isFranchiseEligible } from '../supabase/functions/_shared/franchise.js';
import { FRANCHISE_MIN_AGE, FRANCHISE_MIN_OVR, FRANCHISE_MAX_OVR } from '../utils/constants.js';

// Unit tests with synthetic players (no game files involved).
describe('isFranchiseEligible', () => {
  const player = (Age, OVR_CALCULADO) => ({ Age, OVR_CALCULADO });

  test('rule is 30+ years and OVR 81-88', () => {
    expect([FRANCHISE_MIN_AGE, FRANCHISE_MIN_OVR, FRANCHISE_MAX_OVR]).toEqual([30, 81, 88]);
  });

  test('accepts the edges of the range', () => {
    expect(isFranchiseEligible(player(30, 81))).toBe(true);
    expect(isFranchiseEligible(player(30, 88))).toBe(true);
    expect(isFranchiseEligible(player(36, 84))).toBe(true);
  });

  test('rejects players outside the range', () => {
    expect(isFranchiseEligible(player(29, 85))).toBe(false);
    expect(isFranchiseEligible(player(31, 80))).toBe(false);
    expect(isFranchiseEligible(player(31, 89))).toBe(false);
  });

  test('rejects missing data', () => {
    expect(isFranchiseEligible(null)).toBe(false);
    expect(isFranchiseEligible({})).toBe(false);
  });
});
