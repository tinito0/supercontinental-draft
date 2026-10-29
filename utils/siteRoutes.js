// The site serves two apps from one index.html (main.jsx picks one before rendering):
// the public league site at the root, and the draft under DRAFT_BASE, typed by hand (/draft or /DRAFT).
// Pure helpers; tests/siteRoutes.test.js.

export const DRAFT_BASE = '/draft';

/** True for /draft and anything below it, in any letter case. */
export function isDraftPath(pathname) {
  const lower = String(pathname || '').toLowerCase();
  return lower === DRAFT_BASE || lower.startsWith(`${DRAFT_BASE}/`);
}

/** /DRAFT/x → /draft/x, so the router's basename matches. Other paths are returned unchanged. */
export function normalizeDraftPath(pathname) {
  if (!isDraftPath(pathname)) return pathname;
  return DRAFT_BASE + pathname.slice(DRAFT_BASE.length);
}

// OBS browser sources configured before the move used query modes on these paths (app.jsx isSpecialMode).
const LEGACY_QUERY_MODE_PATHS = new Set(['/', '/torneo']);

/**
 * Where an old draft URL that the hosting cannot redirect (it only matches paths, not queries) must go:
 * /?mode=obs… and /torneo?mode=obs… now live under /draft. Null when the URL belongs to the league site.
 */
export function legacyDraftRedirect({ pathname, search }) {
  if (!LEGACY_QUERY_MODE_PATHS.has(pathname)) return null;
  const params = new URLSearchParams(search || '');
  if (!params.get('mode')) return null;
  return `${DRAFT_BASE}${pathname}${search}`;
}

/** Absolute URL of a draft route, for links that are copied or shared (OBS sources, shared tactics). */
export function draftUrl(path, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  return `${origin}${DRAFT_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}
