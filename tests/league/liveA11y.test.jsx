// /en-vivo y la ficha del partido: orden de los botones de voto, motivo visible, un solo h1 y estado anunciable.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

const ok = data => ({ data, loading: false, error: '' });
const state = {};

vi.mock('../../hooks/useLeagueData.js', () => ({
  SEASON_MATCH_LIMIT: 100,
  useBroadcastOverlay: () => state.overlay,
  usePrediction: () => state.prediction,
  usePoll: () => state.poll,
  useTournament: () => state.tournament,
  useLiveMatches: () => ({ matches: state.matches || [], loading: false, error: '' }),
  useLeagueTeams: () => ({ teams: [], teamsById: {} }),
  useClubProfiles: () => ({ byTeamId: {} }),
}));
vi.mock('../../hooks/useManagerRound.js', () => ({ useManagerRound: () => state.round }));
vi.mock('../../hooks/useDocumentTitle.js', () => ({ useDocumentTitle: () => {} }));
vi.mock('../../utils/communityView.js', async orig => ({ ...(await orig()), fixtureIsPredictable: () => true }));
vi.mock('../../services/communityService.js', () => ({ getMyVote: () => null, sendVote: vi.fn() }));

import LeagueLiveScreen from '../../screens/league/LeagueLiveScreen.jsx';
import { MatchHeader } from '../../components/league/match/MatchSummaryView.jsx';

const render = () => renderToStaticMarkup(<MemoryRouter><LeagueLiveScreen /></MemoryRouter>);
const match = { home: { name: 'Casa', score: 1 }, away: { name: 'Fuera', score: 0 }, competition: 'Liga', status: { kind: 'live' } };

beforeEach(() => {
  state.matches = [];
  state.overlay = ok({ matchId: 'm1' });
  state.prediction = ok({ homeTeam: 'Casa', awayTeam: 'Fuera' });
  state.poll = ok({ options: [{ id: 'a', name: 'Alfa' }], open: true, votes: {} });
  state.tournament = { tournament: { matches: [] }, loading: false };
  state.round = {
    round: { roundId: 'r1', title: 'Fecha 1', open: true, window: { closesAtMs: 0 }, fixtures: [{ home: 'Alfa FC', away: 'Beta FC' }], votes: {} },
    byRoundId: {}, loading: false, error: '',
  };
});

describe('/en-vivo accessibility', () => {
  it('prediction buttons are in DOM order home, draw, away with no order-* classes', () => {
    const html = render();
    const section = html.slice(html.indexOf('prediction-title'), html.indexOf('manager-title'));
    expect(section.indexOf('Casa')).toBeLessThan(section.indexOf('Empate'));
    expect(section.indexOf('Empate')).toBeLessThan(section.indexOf('Fuera</span>'));
    expect(section).not.toMatch(/order-[23]/);
  });

  it('the disabled manager vote shows its reason as visible text', () => {
    const html = render();
    expect(html).toContain('Elegí un mánager de la lista para poder votar.');
    expect(html).toContain('aria-describedby="manager-vote-hint"');
    expect(html).not.toContain('title="Elegí un manager"');
  });

  it('every voting panel has a live status region and a focusable title', () => {
    const html = render();
    expect((html.match(/role="status"/g) || []).length).toBeGreaterThanOrEqual(3);
    expect(html).toMatch(/id="manager-title"[^>]*tabindex="-1"/);
  });

  it('a live match embedded in /en-vivo adds no second h1', () => {
    state.matches = [{ ...match, key: 'k1', summary: {} }];
    const html = render();
    expect((html.match(/<h1/g) || []).length).toBe(1);
  });
});

describe('MatchHeader heading level', () => {
  it('renders an h1 by default and the requested level when embedded', () => {
    const props = { match, timeline: [], teamsById: {} };
    expect(renderToStaticMarkup(<MemoryRouter><MatchHeader {...props} /></MemoryRouter>)).toContain('<h1 class="sr-only">');
    expect(renderToStaticMarkup(<MemoryRouter><MatchHeader {...props} as="h2" /></MemoryRouter>)).toContain('<h2 class="sr-only">');
  });
});
