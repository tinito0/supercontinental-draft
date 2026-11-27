// Home and shared chrome fixes: copy that matches the featured match, accessible names of external links,
// one announcement per spinner, region role on the marquee. Static markup only; synthetic data.
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { MatchCentre } from '../../components/league/home/MatchCentre.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { OnlineIndicator } from '../../components/ui/OnlineIndicator.jsx';
import { PlayerMarquee } from '../../components/landing/PlayerMarquee.jsx';
import { SocialLinks, FollowLeague } from '../../components/landing/FollowLeague.jsx';
import { SiteNav } from '../../components/landing/SiteChrome.jsx';

const wrap = ui => renderToStaticMarkup(<MemoryRouter>{ui}</MemoryRouter>);
const EMPTY_GROUPS = { live: [], results: [], upcoming: [], other: [] };

describe('MatchCentre upcoming copy', () => {
  it('does not say nothing is scheduled when the only upcoming match is the featured one', () => {
    const groups = { ...EMPTY_GROUPS, upcoming: [{ id: 'f1' }] };
    const html = wrap(<MatchCentre groups={groups} clubOf={() => null} featuredId="f1" />);
    expect(html).toContain('No hay otros partidos próximos');
    expect(html).not.toContain('No hay partidos programados');
  });
});

describe('Spinner announcement', () => {
  it('keeps the label in the sr-only text and drops the duplicate aria-label', () => {
    const html = wrap(<Spinner />);
    expect(html).not.toContain('aria-label="Cargando...');
    expect(html).toContain('<span class="sr-only">Cargando...</span>');
  });
  it('keeps aria-label when the label is visible', () => {
    expect(wrap(<Spinner label="Guardando" />)).toContain('aria-label="Cargando..."');
  });
});

describe('OnlineIndicator', () => {
  it('uses Spanish instead of the English word', () => {
    const html = wrap(<OnlineIndicator count={3} />);
    expect(html).toContain('3 en línea');
    expect(html).not.toContain('online');
  });
});

describe('external links say they open a new tab', () => {
  it('adds the notice to every social link name', () => {
    expect(wrap(<SocialLinks />)).toMatch(/aria-label="[^"]*en [^"]*\(se abre en otra pestaña\)"/);
  });
  it('adds the notice to the video and stream links of the follow section', () => {
    const html = wrap(<FollowLeague />);
    expect((html.match(/se abre en otra pestaña/g) || []).length).toBeGreaterThanOrEqual(3);
  });
});

describe('PlayerMarquee', () => {
  it('exposes the scroll region with a role so its label is announced', () => {
    expect(wrap(<PlayerMarquee />)).toMatch(/role="region" aria-label="Jugadores del mercado"/);
  });
});

describe('SiteNav', () => {
  it('applies the extra header classes passed by the league layout', () => {
    expect(wrap(<SiteNav brand={null} className="pt-[env(safe-area-inset-top)]" />)).toContain('pt-[env(safe-area-inset-top)]');
  });
});
