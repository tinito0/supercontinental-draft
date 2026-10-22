import React, { Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, X, Loader2 } from 'lucide-react';
import { SiteBrand, SiteFooter, SiteNav } from '../landing/SiteChrome.jsx';
import { LEAGUE_NAME } from '../landing/leagueLinks.js';

/* Frame of the public league site: the draft landing's header and footer (components/landing/SiteChrome.jsx).
   The draft itself is never linked from here; managers type /draft. */

export const LEAGUE_NAV_LINKS = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/historia', label: 'Historia' },
  { to: '/equipos', label: 'Equipos' },
  { to: '/reglamento', label: 'Reglamento' },
  { to: '/torneo', label: 'Torneo' },
  { to: '/partidos', label: 'Partidos' },
  { to: '/en-vivo', label: 'En vivo' },
];

const linkClass = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'text-ink' : 'text-ink-2 hover:text-ink'}`;

const mobileLinkClass = ({ isActive }) =>
  `flex min-h-11 items-center rounded-lg px-3 text-base font-medium transition-colors ${isActive ? 'bg-overlay text-ink' : 'text-ink-2 hover:bg-white/[0.04] hover:text-ink'}`;

function LeagueNav() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => { setIsMenuOpen(false); }, [pathname]);

  return (
    <>
      <SiteNav
        brand={(
          <Link to="/" className="flex min-w-0 items-center gap-2.5" aria-label={`${LEAGUE_NAME}, inicio`}>
            <SiteBrand shortName="SCL" name={LEAGUE_NAME} />
          </Link>
        )}
      >
        <ul className="hidden items-center gap-1 md:flex">
          {LEAGUE_NAV_LINKS.map(link => (
            <li key={link.to}>
              <NavLink to={link.to} end={link.end} className={linkClass}>{link.label}</NavLink>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setIsMenuOpen(open => !open)}
          className="btn btn-ghost btn-icon min-h-11 min-w-11 md:hidden"
          aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={isMenuOpen}
          aria-controls="league-mobile-menu"
        >
          {isMenuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </SiteNav>

      {isMenuOpen && (
        <div id="league-mobile-menu" className="landing-nav fixed inset-x-0 top-16 z-sticky border-b border-line/10 animate-in fade-in slide-in-from-top md:hidden">
          <ul className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
            {LEAGUE_NAV_LINKS.map(link => (
              <li key={link.to}>
                <NavLink to={link.to} end={link.end} className={mobileLinkClass}>{link.label}</NavLink>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

const pageFallback = (
  <div role="status" className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-ink-3">
    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Cargando…
  </div>
);

export function LeagueLayout() {
  const { pathname } = useLocation();

  // A new page starts at the top (the router keeps the old scroll position).
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  return (
    <div className="landing-root flex min-h-[100dvh] flex-col overflow-x-hidden bg-canvas font-sans text-ink">
      <LeagueNav />
      <main className="flex-1 pt-16">
        <Suspense fallback={pageFallback}>
          <Outlet />
        </Suspense>
      </main>
      <SiteFooter name={LEAGUE_NAME} />
    </div>
  );
}

export default LeagueLayout;
