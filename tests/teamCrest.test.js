import { describe, it, expect } from 'vitest';
import { teamCrestUrl } from '../utils/teamCrest.js';
import { DEFAULT_LOGO } from '../utils/constants.js';

describe('teamCrestUrl', () => {
  it('keeps a normal public path', () => {
    expect(teamCrestUrl({ logoUrl: '/Logos_equipos/Portland.webp' })).toBe('/Logos_equipos/Portland.webp');
  });

  it('turns Windows separators into URL slashes', () => {
    expect(teamCrestUrl({ logoUrl: '\\Logos_equipos\\asp_calc.webp' })).toBe('/Logos_equipos/asp_calc.webp');
  });

  it('falls back to the default logo when the team has none', () => {
    expect(teamCrestUrl({ logoUrl: '  ' })).toBe(DEFAULT_LOGO);
    expect(teamCrestUrl(null)).toBe(DEFAULT_LOGO);
  });
});
