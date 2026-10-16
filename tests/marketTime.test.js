// When a scheduled market opens: the market function runs in UTC and the app in the manager's zone; both
// must agree (supabase/functions/_shared/marketTime.js). Synthetic data only.
import { describe, it, expect } from 'vitest';
import { parseOpenTime } from '../supabase/functions/_shared/marketTime.js';
import { isMarketOpen } from '../supabase/functions/_shared/market.js';

describe('parseOpenTime', () => {
  it('reads ISO instants as they are', () => {
    expect(parseOpenTime('2026-10-20T23:00:00.000Z').toISOString()).toBe('2026-10-20T23:00:00.000Z');
    expect(parseOpenTime('2026-10-20T20:00:00-03:00').toISOString()).toBe('2026-10-20T23:00:00.000Z');
  });

  it('reads old datetime-local values (no zone) as league time, whatever zone runs the code', () => {
    expect(parseOpenTime('2026-10-20T20:00').toISOString()).toBe('2026-10-20T23:00:00.000Z');
    expect(parseOpenTime('2026-10-20T20:00:30').toISOString()).toBe('2026-10-20T23:00:30.000Z');
  });

  it('returns null for missing or invalid values', () => {
    expect([undefined, null, '', '  ', 'mañana', 42].map(parseOpenTime)).toEqual([null, null, null, null, null, null]);
  });
});

describe('isMarketOpen with a scheduled opening', () => {
  const scheduled = { status: 'scheduled', openTime: '2026-10-20T20:00' }; // 20:00 in Argentina = 23:00 UTC

  it('stays closed until the league time, not the server time', () => {
    expect(isMarketOpen(scheduled, {}, false, new Date('2026-10-20T22:59:00Z'))).toBe(false);
    expect(isMarketOpen(scheduled, {}, false, new Date('2026-10-20T23:00:01Z'))).toBe(true);
  });

  it('whitelisted teams and admins are always in; an invalid date never opens', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    expect(isMarketOpen(scheduled, { inWhitelist: true }, false, now)).toBe(true);
    expect(isMarketOpen(scheduled, {}, true, now)).toBe(true);
    expect(isMarketOpen({ status: 'scheduled', openTime: 'x' }, {}, false, now)).toBe(false);
  });
});
