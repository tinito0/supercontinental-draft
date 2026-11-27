// Navigation frame of the league site (components/league/LeagueLayout.jsx). Static markup and pure helpers: synthetic.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LeagueLayout } from '../../components/league/LeagueLayout.jsx';
import { isCurrentPageLink, shouldFocusPage, shouldScrollToTop } from '../../components/league/leagueNavHelpers.js';

const render = () => renderToStaticMarkup(
  <MemoryRouter initialEntries={['/equipos']}>
    <Routes><Route element={<LeagueLayout />}><Route path="/equipos" element={<h1>Equipos</h1>} /></Route></Routes>
  </MemoryRouter>,
);

describe('LeagueLayout markup', () => {
  const html = render();
  it('keeps the mobile menu in the DOM, hidden, so aria-controls resolves, inside the nav landmark', () => {
    expect(html).toMatch(/aria-controls="league-mobile-menu"/);
    expect(html).toMatch(/<nav[^>]*>.*id="league-mobile-menu"[^>]*hidden.*<\/nav>/s);
  });
  it('scrolls the menu on short viewports and hides the full nav until xl', () => {
    expect(html).toContain('max-h-[calc(100dvh-4rem-env(safe-area-inset-top))]');
    expect(html).toContain('overflow-y-auto');
    expect(html).toContain('xl:flex');
  });
  it('does not blur the header and leaves the brand name to its visible text', () => {
    expect(html).not.toContain('landing-nav');
    expect(html).not.toMatch(/<a[^>]*href="\/"[^>]*aria-label/);
  });
});

describe('navigation helpers', () => {
  it('restores scroll on back/forward and resets it on a new path', () => {
    expect(shouldScrollToTop({ navigationType: 'POP', previousPathname: '/equipos/a', pathname: '/equipos' })).toBe(false);
    expect(shouldScrollToTop({ navigationType: 'PUSH', previousPathname: '/equipos', pathname: '/equipos/a' })).toBe(true);
    expect(shouldScrollToTop({ navigationType: 'PUSH', previousPathname: '/equipos', pathname: '/equipos' })).toBe(false);
  });
  it('moves focus only after a real route change', () => {
    expect(shouldFocusPage({ previousPathname: null, pathname: '/' })).toBe(false);
    expect(shouldFocusPage({ previousPathname: '/', pathname: '/equipos' })).toBe(true);
    expect(shouldFocusPage({ previousPathname: '/equipos', pathname: '/equipos' })).toBe(false);
  });
  it('recognises the link of the current page', () => {
    expect(isCurrentPageLink({ to: '/', end: true, pathname: '/' })).toBe(true);
    expect(isCurrentPageLink({ to: '/', end: true, pathname: '/equipos' })).toBe(false);
    expect(isCurrentPageLink({ to: '/equipos', pathname: '/equipos/abc' })).toBe(true);
  });
});
