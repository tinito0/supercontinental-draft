import { afterEach, describe, expect, test, vi } from 'vitest';
import { prefersReducedMotion, scrollBehavior } from '../utils/scrollBehavior.js';

function stubWindow(matchMedia) {
  vi.stubGlobal('window', matchMedia === undefined ? {} : { matchMedia });
}

describe('scrollBehavior', () => {
  afterEach(() => vi.unstubAllGlobals());

  test('returns smooth when there is no window (SSR, node tests)', () => {
    expect(prefersReducedMotion()).toBe(false);
    expect(scrollBehavior()).toBe('smooth');
  });

  test('returns smooth when matchMedia is missing', () => {
    stubWindow(undefined);
    expect(scrollBehavior()).toBe('smooth');
  });

  test('returns auto when the user prefers reduced motion', () => {
    const matchMedia = vi.fn(() => ({ matches: true }));
    stubWindow(matchMedia);
    expect(scrollBehavior()).toBe('auto');
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });

  test('returns smooth when reduced motion is not requested', () => {
    stubWindow(() => ({ matches: false }));
    expect(scrollBehavior()).toBe('smooth');
  });

  test('returns smooth when matchMedia throws', () => {
    stubWindow(() => { throw new Error('boom'); });
    expect(scrollBehavior()).toBe('smooth');
  });
});
