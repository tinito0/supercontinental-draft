import { budgetMeter } from '../utils/budgetDisplay.js';

// Unit tests with plain numbers (no game files involved).
describe('budgetMeter', () => {
  test('uses the team base (teams/{uid}.budget) over the private profile budget', () => {
    // After a sale the server raises teams/{uid}.budget; the profile copy is stale.
    const meter = budgetMeter({ base: 250_000_000, profileBudget: 200_000_000, remaining: 125_000_000 });
    expect(meter.base).toBe(250_000_000);
    expect(meter.percent).toBe(50);
  });

  test('takes the percent computed by useBudget when given', () => {
    expect(budgetMeter({ base: 200_000_000, remaining: 10, percent: 37.5 }).percent).toBe(37.5);
  });

  test('falls back to the profile budget, then the default, while the team doc is missing', () => {
    expect(budgetMeter({ base: undefined, profileBudget: 180_000_000, remaining: 90_000_000 }))
      .toEqual({ base: 180_000_000, percent: 50 });
    expect(budgetMeter({ base: undefined, profileBudget: undefined, remaining: 0, defaultBudget: 200_000_000 }).base)
      .toBe(200_000_000);
  });

  test('clamps the percent to 0..100', () => {
    expect(budgetMeter({ base: 100, remaining: -50 }).percent).toBe(0);
    expect(budgetMeter({ base: 100, remaining: 0, percent: 140 }).percent).toBe(100);
  });

  test('is 0 with no base at all', () => {
    expect(budgetMeter({ base: 0, remaining: 50 }).percent).toBe(0);
  });
});
