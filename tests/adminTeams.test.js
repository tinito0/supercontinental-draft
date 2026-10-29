import { describe, it, expect } from 'vitest';
import { mergeAdminTeamProfile, parseBudgetInput, sortByTeamName, validateLogoFile, MAX_LOGO_BYTES } from '../utils/adminTeams.js';
import { toLocalDateTimeInput } from '../utils/helpers.js';

describe('mergeAdminTeamProfile', () => {
  it('takes the budget from the public team doc (authoritative), not the profile copy', () => {
    const row = mergeAdminTeamProfile('u1', { budget: 500, teamName: 'Pub' }, { budget: 900, teamName: 'Priv' });
    expect(row.budget).toBe(500);
    expect(row.teamName).toBe('Priv');
  });

  it('falls back to the profile budget and safe defaults', () => {
    expect(mergeAdminTeamProfile('u1', {}, { budget: 300 }).budget).toBe(300);
    expect(mergeAdminTeamProfile('u1', null, null)).toMatchObject({ uid: 'u1', teamName: 'Sin nombre', budget: 0, inWhitelist: false });
  });
});

describe('sortByTeamName', () => {
  it('does not crash on missing names (used to empty the whitelist list)', () => {
    expect(sortByTeamName([{ teamName: 'b' }, {}, { teamName: 'a' }]).map(r => r.teamName)).toEqual([undefined, 'a', 'b']);
  });
});

describe('parseBudgetInput', () => {
  it('rejects empty, negative and non-numeric values instead of saving 0', () => {
    expect(parseBudgetInput('')).toHaveProperty('error');
    expect(parseBudgetInput('  ')).toHaveProperty('error');
    expect(parseBudgetInput('-5')).toHaveProperty('error');
    expect(parseBudgetInput('abc')).toHaveProperty('error');
  });
  it('accepts zero and positive amounts', () => {
    expect(parseBudgetInput('0')).toEqual({ value: 0 });
    expect(parseBudgetInput(' 150000000 ')).toEqual({ value: 150000000 });
  });
});

describe('validateLogoFile', () => {
  it('accepts images up to 2 MB', () => {
    expect(validateLogoFile({ type: 'image/png', size: MAX_LOGO_BYTES })).toBeNull();
    expect(validateLogoFile({ type: 'application/pdf', size: 10 })).toMatch(/imagen/);
    expect(validateLogoFile({ type: 'image/webp', size: MAX_LOGO_BYTES + 1 })).toMatch(/2 MB/);
    expect(validateLogoFile(null)).toBeTruthy();
  });
});

describe('toLocalDateTimeInput', () => {
  it('formats in local time for datetime-local inputs', () => {
    expect(toLocalDateTimeInput(new Date(2026, 0, 5, 9, 7))).toBe('2026-01-05T09:07');
  });
});

describe('membership approval', () => {
  it('marks only teams explicitly waiting for approval; older teams count as approved', async () => {
    const { isTeamApproved } = await import('../supabase/functions/_shared/membership.js');
    const { filterAdminTeams } = await import('../utils/adminTeams.js');
    expect(isTeamApproved({})).toBe(true);
    expect(isTeamApproved({ approved: true })).toBe(true);
    expect(isTeamApproved({ approved: false })).toBe(false);
    const rows = [mergeAdminTeamProfile('a', { approved: false }), mergeAdminTeamProfile('b', {})];
    expect(rows.map(row => row.pendingApproval)).toEqual([true, false]);
    expect(filterAdminTeams(rows, { access: 'pending' }).map(row => row.uid)).toEqual(['a']);
  });
});
