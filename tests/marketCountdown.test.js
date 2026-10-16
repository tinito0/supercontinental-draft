// Countdown shown on the closed-market banner. Pure function, synthetic values.
import { describe, it, expect } from 'vitest';
import { formatCountdown } from '../utils/marketCountdown.js';

describe('formatCountdown', () => {
  it('shows hours, minutes and seconds under a day', () => {
    expect(formatCountdown((3 * 3600 + 14 * 60 + 5) * 1000)).toBe('03:14:05');
  });

  it('adds the days above a day', () => {
    expect(formatCountdown((2 * 86400 + 60) * 1000)).toBe('2 d 00:01:00');
  });

  it('is empty once the opening time has passed, or for bad input', () => {
    expect(formatCountdown(0)).toBe('');
    expect(formatCountdown(-5000)).toBe('');
    expect(formatCountdown(NaN)).toBe('');
  });
});
