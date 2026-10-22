import { describe, it, expect } from 'vitest';
import { ADMIN_TAB_IDS, normalizeAdminTab, readStoredAdminTab, storeAdminTab } from '../utils/adminTabs.js';
import { filterAdminTeams } from '../utils/adminTeams.js';

describe('admin tabs', () => {
  it('has six sections and maps the merged legacy ones', () => {
    expect(ADMIN_TAB_IDS).toEqual(['general', 'equipos', 'torneo', 'web', 'templates', 'suggestions']);
    expect(normalizeAdminTab('users')).toBe('equipos');
    expect(normalizeAdminTab('overlay')).toBe('torneo');
    expect(normalizeAdminTab('torneo')).toBe('torneo');
    expect(normalizeAdminTab('web')).toBe('web');
    expect(normalizeAdminTab('nope')).toBe('general');
    expect(normalizeAdminTab(undefined)).toBe('general');
  });

  it('remembers the last section and survives a blocked storage', () => {
    const memory = new Map();
    const storage = { getItem: k => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v) };
    expect(readStoredAdminTab(storage)).toBe('general');
    storeAdminTab('torneo', storage);
    expect(readStoredAdminTab(storage)).toBe('torneo');
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(readStoredAdminTab(blocked)).toBe('general');
    expect(() => storeAdminTab('torneo', blocked)).not.toThrow();
  });
});

describe('filterAdminTeams (Equipos y usuarios)', () => {
  const rows = [
    { uid: 'abc123', teamName: 'Boca', email: 'boca@x.com', inWhitelist: true },
    { uid: 'def456', teamName: 'River', email: 'river@x.com', inWhitelist: false },
    { uid: 'ghi789', teamName: undefined, email: '', inWhitelist: false },
  ];

  it('filters by early market access', () => {
    expect(filterAdminTeams(rows, { access: 'early' }).map(r => r.uid)).toEqual(['abc123']);
    expect(filterAdminTeams(rows, { access: 'regular' }).map(r => r.uid)).toEqual(['def456', 'ghi789']);
    expect(filterAdminTeams(rows)).toHaveLength(3);
  });

  it('searches name, email and uid, tolerating missing fields', () => {
    expect(filterAdminTeams(rows, { query: ' RIVER@ ' }).map(r => r.uid)).toEqual(['def456']);
    expect(filterAdminTeams(rows, { query: 'ghi' }).map(r => r.uid)).toEqual(['ghi789']);
    expect(filterAdminTeams(rows, { query: 'boca', access: 'regular' })).toEqual([]);
  });
});
