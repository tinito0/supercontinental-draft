// /en-vivo: un fallo de lectura muestra un Alert y no los controles de voto; mientras carga no se muestra el texto vacío.
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
  useLiveMatches: () => ({ matches: [], loading: false, error: '' }),
  useLeagueTeams: () => ({ teams: [], teamsById: {} }),
  useClubProfiles: () => ({ byTeamId: {} }),
}));
vi.mock('../../hooks/useManagerRound.js', () => ({ useManagerRound: () => state.round }));
vi.mock('../../hooks/useDocumentTitle.js', () => ({ useDocumentTitle: () => {} }));
vi.mock('../../utils/communityView.js', async orig => ({ ...(await orig()), fixtureIsPredictable: () => true }));
vi.mock('../../services/communityService.js', () => ({ getMyVote: () => null, sendVote: vi.fn() }));

import LeagueLiveScreen from '../../screens/league/LeagueLiveScreen.jsx';

const render = () => renderToStaticMarkup(<MemoryRouter><LeagueLiveScreen /></MemoryRouter>);
const poll = { options: [{ id: 'a', name: 'Alfa' }, { id: 'b', name: 'Beta' }], open: true, votes: {} };

beforeEach(() => {
  state.overlay = ok({ matchId: 'm1' });
  state.prediction = ok({ homeTeam: 'Casa', awayTeam: 'Fuera' });
  state.poll = ok(poll);
  state.tournament = { tournament: { matches: [] }, loading: false };
  state.round = { round: null, byRoundId: {}, loading: false, error: '' };
});

describe('LeagueLiveScreen read failures', () => {
  it('prediction error shows an alert and no vote buttons', () => {
    state.prediction = { data: null, loading: false, error: 'No se pudo cargar.' };
    const html = render();
    expect(html).toContain('No pudimos cargar la predicción');
    expect(html).not.toContain('Empate');
  });

  it('poll error shows an alert and no options', () => {
    state.poll = { data: null, loading: false, error: 'No se pudo cargar.' };
    const html = render();
    expect(html).toContain('No pudimos cargar la encuesta');
    expect(html).not.toContain('Alfa');
  });

  it('manager vote error shows an alert and no vote button', () => {
    state.round = { round: null, byRoundId: {}, loading: false, error: 'No se pudieron cargar los votos.' };
    const html = render();
    expect(html).toContain('No pudimos cargar la votación');
    expect(html).not.toContain('Votar</button>');
  });

  it('shows a loading state, not the empty copy, while data loads', () => {
    state.overlay = { data: null, loading: true, error: '' };
    state.round = { round: null, byRoundId: {}, loading: true, error: '' };
    const html = render();
    expect(html).toContain('Cargando la predicción');
    expect(html).toContain('Cargando la votación');
    expect(html).not.toContain('Cuando haya un partido');
    expect(html).not.toContain('Cuando termine la primera fecha');
  });
});
