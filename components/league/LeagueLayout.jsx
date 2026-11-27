import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigationType } from 'react-router-dom';
import { Menu, X, Loader2 } from 'lucide-react';
import { SiteBrand, SiteFooter, SiteNav } from '../landing/SiteChrome.jsx';
import { LEAGUE_NAME } from '../landing/leagueLinks.js';
import { isCurrentPageLink, shouldFocusPage, shouldScrollToTop } from './leagueNavHelpers.js';

/* Frame of the public league site: the draft landing's header and footer (components/landing/SiteChrome.jsx).
   The draft itself is never linked from here; managers type /draft. */

export const LEAGUE_NAV_LINKS = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/historia', label: 'Historia' },
  { to: '/equipos', label: 'Equipos' },
  { to: '/reglamento', label: 'Reglamento' },
  { to: '/torneo', label: 'Torneo' },
  { to: '/estadisticas', label: 'Estadísticas' },
  { to: '/partidos', label: 'Partidos' },
  { to: '/en-vivo', label: 'En vivo' },
];

const linkClass = ({ isActive }) =>
  `relative inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors after:absolute after:inset-x-3 after:-bottom-[10px] after:h-0.5 after:rounded-full after:transition-colors ${isActive ? 'text-ink after:bg-accent-soft' : 'text-ink-2 after:bg-transparent hover:text-ink'}`;

const mobileLinkClass = ({ isActive }) =>
  `flex min-h-11 items-center rounded-lg border-l-2 px-3 text-base font-medium transition-colors ${isActive ? 'border-accent-soft bg-overlay text-ink' : 'border-transparent text-ink-2 hover:bg-white/[0.04] hover:text-ink'}`;

function LeagueNav() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const toggleRef = useRef(null);

  useEffect(() => { setIsMenuOpen(false); }, [pathname]);

  const closeMenu = useCallback((returnFocus) => {
    setIsMenuOpen(false);
    if (returnFocus) toggleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') closeMenu(true); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isMenuOpen, closeMenu]);

  const onMobileLinkClick = (link) => {
    if (isCurrentPageLink({ ...link, pathname })) closeMenu(false);
  };

  return (
    // The header is fixed under the notch (viewport-fit=cover), so it takes the top and side insets itself.
    <SiteNav
      className="pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)]"
      brand={(
        <Link to="/" className="flex min-h-11 min-w-0 items-center gap-2.5">
          <SiteBrand shortName="SCL" name={LEAGUE_NAME} />
        </Link>
      )}
    >
      <ul className="hidden items-center gap-1 xl:flex">
        {LEAGUE_NAV_LINKS.map(link => (
          <li key={link.to}>
            <NavLink to={link.to} end={link.end} className={linkClass}>{link.label}</NavLink>
          </li>
        ))}
      </ul>
      <button
        ref={toggleRef}
        type="button"
        onClick={() => setIsMenuOpen(open => !open)}
        className="btn btn-ghost btn-icon min-h-11 min-w-11 xl:hidden"
        aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={isMenuOpen}
        aria-controls="league-mobile-menu"
      >
        {isMenuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
      </button>
      <div
        id="league-mobile-menu"
        hidden={!isMenuOpen}
        className="absolute inset-x-0 top-full max-h-[calc(100dvh-4rem-env(safe-area-inset-top))] overflow-y-auto overscroll-contain border-b border-line/10 bg-canvas animate-in fade-in slide-in-from-top xl:hidden"
      >
        <ul className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
          {LEAGUE_NAV_LINKS.map(link => (
            <li key={link.to}>
              <NavLink to={link.to} end={link.end} className={mobileLinkClass} onClick={() => onMobileLinkClick(link)}>{link.label}</NavLink>
            </li>
          ))}
        </ul>
      </div>
    </SiteNav>
  );
}

const pageFallback = (
  <div role="status" className="flex min-h-[60dvh] items-center justify-center gap-2 text-sm text-ink-3">
    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Cargando…
  </div>
);

export function LeagueLayout() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const previousPathname = useRef(null);

  // New page: top of the page and focus on <main> so the change is announced. Back/forward keeps the browser's scroll.
  useEffect(() => {
    const previous = previousPathname.current;
    previousPathname.current = pathname;
    if (shouldScrollToTop({ navigationType, previousPathname: previous, pathname }) && previous != null) window.scrollTo(0, 0);
    if (shouldFocusPage({ previousPathname: previous, pathname })) document.getElementById('contenido')?.focus({ preventScroll: true });
  }, [pathname, navigationType]);

  return (
    <div className="landing-root flex min-h-[100dvh] flex-col overflow-x-clip bg-canvas font-sans text-ink">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:font-semibold focus:text-on-accent">Saltar al contenido</a>
      <LeagueNav />
      <main id="contenido" tabIndex={-1} className="flex-1 pt-[calc(4rem+env(safe-area-inset-top))] outline-none">
        <Suspense fallback={pageFallback}>
          <Outlet />
        </Suspense>
      </main>
      <SiteFooter name={LEAGUE_NAME} />
    </div>
  );
}

export default LeagueLayout;
