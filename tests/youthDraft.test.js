// Youth-draft rules shared by the market function and the app (supabase/functions/_shared/youthDraft.js).
// Synthetic players only.
import { describe, it, expect } from 'vitest';
import { isYouthDraftEligible, isYouthDraftLock, youthDraftPoolIds, youthDraftPath } from '../supabase/functions/_shared/youthDraft.js';

describe('isYouthDraftEligible', () => {
  it('takes 17 to 21 year olds rated 50 or more, up to 99', () => {
    expect(isYouthDraftEligible({ Age: 17, OVR_CALCULADO: 50 })).toBe(true);
    expect(isYouthDraftEligible({ Age: 21, OVR_CALCULADO: 60 })).toBe(true);
    expect(isYouthDraftEligible({ Age: 20, OVR_CALCULADO: 99 })).toBe(true);
  });

  it('refuses anyone outside the age or rating range, and missing players', () => {
    expect(isYouthDraftEligible({ Age: 16, OVR_CALCULADO: 55 })).toBe(false);
    expect(isYouthDraftEligible({ Age: 22, OVR_CALCULADO: 55 })).toBe(false);
    expect(isYouthDraftEligible({ Age: 19, OVR_CALCULADO: 49 })).toBe(false);
    expect(isYouthDraftEligible({ Age: 19, OVR_CALCULADO: 61 })).toBe(true);
    expect(isYouthDraftEligible(null)).toBe(false);
  });
});

describe('pool and locks', () => {
  it('lists pool ids as strings and tolerates a missing draft', () => {
    expect(youthDraftPoolIds({ pool: [{ id: 7000 }, { id: '7001' }] })).toEqual(new Set(['7000', '7001']));
    expect(youthDraftPoolIds(null).size).toBe(0);
  });

  it('recognises a pick lock only by its server flag', () => {
    expect(isYouthDraftLock({ isDraftee: true })).toBe(true);
    expect(isYouthDraftLock({ isDraftee: 'true' })).toBe(false);
    expect(isYouthDraftLock(undefined)).toBe(false);
  });

  it('keeps the draft next to the market config', () => {
    expect(youthDraftPath('app')).toBe('artifacts/app/public/data/config/youthDraft');
  });
});
