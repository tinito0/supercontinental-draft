import { budgetStatusFrom } from '../hooks/useBudget.js';

describe('budgetStatusFrom', () => {
  const profile = { budget: 100 };

  test('is ready when the profile and the locks are loaded', () => {
    expect(budgetStatusFrom({ userProfile: profile, locksStatus: 'ready' })).toBe('ready');
  });

  test('is loading while the profile is missing even if locks are ready', () => {
    expect(budgetStatusFrom({ userProfile: null, locksStatus: 'ready' })).toBe('loading');
  });

  test('is loading while the locks are loading', () => {
    expect(budgetStatusFrom({ userProfile: profile, locksStatus: 'loading' })).toBe('loading');
  });

  test('is error when the locks failed, with or without a profile', () => {
    expect(budgetStatusFrom({ userProfile: profile, locksStatus: 'error' })).toBe('error');
    expect(budgetStatusFrom({ userProfile: null, locksStatus: 'error' })).toBe('error');
  });
});
