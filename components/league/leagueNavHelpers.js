/* Pure decisions behind LeagueLayout's navigation, kept apart so they can be tested without a DOM. */

/** Back/forward (POP) keeps the browser's scroll; a new page, or a different path reached by link, starts at the top. */
export function shouldScrollToTop({ navigationType, previousPathname, pathname }) {
  if (navigationType === 'POP') return false;
  return previousPathname !== pathname;
}

/** Focus moves to the page only after a real route change, never on first load or on a hash jump in the same path. */
export function shouldFocusPage({ previousPathname, pathname }) {
  return previousPathname != null && previousPathname !== pathname;
}

/** A tap on the link of the page already open does not change the route, so the menu has to close by itself. */
export function isCurrentPageLink({ to, end, pathname }) {
  if (end || to === '/') return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}
