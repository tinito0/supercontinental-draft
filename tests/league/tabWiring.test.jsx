// Tab/tabpanel wiring and the collapsed rules index (synthetic data, no hooks beyond mocks).
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { ClubKits } from '../../components/league/club/ClubKits.jsx';
import LeagueRulesScreen from '../../screens/league/LeagueRulesScreen.jsx';

const chapters = [
  { id: 'a', title: 'Formato', body: 'Texto uno' },
  { id: 'b', title: 'Sanciones', body: 'Texto dos' },
];

vi.mock('../../hooks/useLeagueData.js', () => ({
  useLeagueContent: () => ({ content: { chapters }, loading: false, error: '' }),
}));

describe('ClubKits tabs', () => {
  const profile = { kits: { home: 'https://example.com/a.png', away: 'https://example.com/b.png' } };

  it('links each kit tab to the panel that holds the shirt', () => {
    const html = renderToStaticMarkup(<ClubKits profile={profile} teamName="Club" />);
    const controls = html.match(/aria-controls="([^"]+)"/)[1];
    expect(html).toContain(`id="${controls}"`);
    expect(html).toContain('role="tabpanel"');
    expect(html).toMatch(/role="tabpanel"[^>]*aria-labelledby="club-kit-tabs-tab-/);
  });
});

describe('LeagueRulesScreen chapter index', () => {
  it('renders a collapsed index for phones and a separate desktop one', () => {
    const html = renderToStaticMarkup(<MemoryRouter><LeagueRulesScreen /></MemoryRouter>);
    expect(html).toContain('<details class="panel lg:hidden">');
    expect(html).not.toContain('<details open');
    expect(html.match(/href="#capitulo-1"/g)).toHaveLength(2);
  });
});
