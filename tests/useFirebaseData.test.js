import { listenersToRetry, bumpRetryKeys } from '../hooks/useFirebaseData.js';

describe('listenersToRetry', () => {
  test('flags only the listeners in error', () => {
    const result = listenersToRetry({ teams: 'ready', locks: 'error', profile: 'loading' });
    expect(result).toEqual({ teams: false, locks: true, profile: false });
  });

  test('flags nothing when every listener is healthy', () => {
    const result = listenersToRetry({ teams: 'ready', locks: 'ready', profile: 'ready' });
    expect(result).toEqual({ teams: false, locks: false, profile: false });
  });
});

describe('bumpRetryKeys', () => {
  test('bumps only the failed listeners and keeps the input untouched', () => {
    const keys = Object.freeze({ teams: 0, locks: 2, profile: 1 });
    const next = bumpRetryKeys(keys, { teams: 'error', locks: 'ready', profile: 'error' });
    expect(next).toEqual({ teams: 1, locks: 2, profile: 2 });
    expect(keys).toEqual({ teams: 0, locks: 2, profile: 1 });
  });

  test('returns equal keys when nothing failed', () => {
    const keys = { teams: 0, locks: 0, profile: 0 };
    expect(bumpRetryKeys(keys, { teams: 'ready', locks: 'loading', profile: 'ready' })).toEqual(keys);
  });
});
