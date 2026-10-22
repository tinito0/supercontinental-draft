import { DEFAULT_LOGO } from './constants.js';

/**
 * A team's crest URL, safe to put in <img src>. Some teams were saved with Windows separators
 * ("\Logos_equipos\x.webp"), which browsers do not resolve as a path. Pure; tests/teamCrest.test.js.
 */
export function teamCrestUrl(team) {
  const raw = String(team?.logoUrl || '').trim();
  if (!raw) return DEFAULT_LOGO;
  return raw.replace(/\\/g, '/');
}
