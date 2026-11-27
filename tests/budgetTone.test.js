import { budgetTone, BUDGET_TONE_CLASSES, LOW_BUDGET_PERCENT } from '../utils/budgetDisplay.js';

describe('budgetTone', () => {
  test('is accent while the budget is comfortable', () => {
    expect(budgetTone(100)).toBe('accent');
    expect(budgetTone(60)).toBe('accent');
    expect(budgetTone(LOW_BUDGET_PERCENT + 0.1)).toBe('accent');
  });

  test('turns to warning from the low-budget threshold down', () => {
    expect(budgetTone(LOW_BUDGET_PERCENT)).toBe('warning');
    expect(budgetTone(5)).toBe('warning');
  });

  test('is danger once nothing is left', () => {
    expect(budgetTone(0)).toBe('danger');
    expect(budgetTone(-4)).toBe('danger');
  });

  test('stays neutral when the percent is unknown', () => {
    expect(budgetTone(null)).toBe('accent');
    expect(budgetTone(undefined)).toBe('accent');
    expect(budgetTone(NaN)).toBe('accent');
  });

  test('has classes for every tone it can return', () => {
    ['accent', 'warning', 'danger'].forEach(tone => {
      expect(BUDGET_TONE_CLASSES[tone].bar).toMatch(/^bg-/);
      expect(BUDGET_TONE_CLASSES[tone].text).toMatch(/^text-/);
    });
  });
});
