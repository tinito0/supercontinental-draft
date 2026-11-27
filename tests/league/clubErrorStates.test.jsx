// Error states of the club page (screens/league/LeagueClubScreen.jsx, ClubFranchise). Hooks mocked: synthetic.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ClubFranchise } from '../../components/league/club/ClubFranchise.jsx';

const mocks = vi.hoisted(() => ({
  teams: { teamsById: {}, loading: false, error: '' },
  franchise: { byTeamId: {}, loading: false, error: '' },
}));

vi.mock('../../hooks/useLeagueData.js', () => ({
  useLeagueTeams: () => mocks.teams,
  useLeagueContent: () => ({ content: null, loading: false, error: '' }),
  useTournament: () => ({ tournament: null, loading: false, error: '' }),
  useFranchisePlayers: () => mocks.franchise,
}));
vi.mock('../../screens/TeamScreen.jsx', () => ({ default: () => null }));

import LeagueClubScreen from '../../screens/league/LeagueClubScreen.jsx';

const render = () => renderToStaticMarkup(
  <MemoryRouter initialEntries={['/equipos/abc']}>
    <Routes><Route path="/equipos/:userId" element={<LeagueClubScreen />} /></Routes>
  </MemoryRouter>,
);

describe('LeagueClubScreen errors', () => {
  it('shows an alert with retry and a way back when the teams read fails', () => {
    mocks.teams = { teamsById: {}, loading: false, error: 'No se pudieron cargar los equipos.' };
    const html = render();
    expect(html).toContain('role="alert"');
    expect(html).toContain('Reintentar');
    expect(html).toContain('href="/equipos"');
    expect(html).not.toContain('Este club no existe');
  });

  it('still says the club does not exist when the read worked', () => {
    mocks.teams = { teamsById: {}, loading: false, error: '' };
    expect(render()).toContain('Este club no existe');
  });
});

describe('ClubFranchise', () => {
  it('reports a failed read instead of claiming no signing', () => {
    const html = renderToStaticMarkup(<ClubFranchise player={null} error="x" />);
    expect(html).toContain('No se pudo cargar el jugador franquicia');
    expect(html).not.toContain('todavía no fichó');
  });

  it('keeps the no-franchise-yet text when there is no error', () => {
    expect(renderToStaticMarkup(<ClubFranchise player={null} />)).toContain('todavía no fichó');
  });
});
