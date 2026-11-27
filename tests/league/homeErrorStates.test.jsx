// Error states of the league home and /equipos: a failed read must not read as "no clubs". Synthetic hook results.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

const hooks = vi.hoisted(() => ({
  teams: { teams: [], teamsById: {}, loading: false, error: '' },
  profiles: { byTeamId: {}, loading: false, error: '' },
  franchise: { byTeamId: {}, loading: false, error: '' },
}));
vi.mock('../../hooks/useLeagueData.js', () => ({
  useLeagueTeams: () => hooks.teams,
  useClubProfiles: () => hooks.profiles,
  useFranchisePlayers: () => hooks.franchise,
}));

import { ClubCrestGrid, FranchiseSummary } from '../../components/league/home/HomeCompact.jsx';
import LeagueTeamsScreen from '../../screens/league/LeagueTeamsScreen.jsx';

const render = ui => renderToStaticMarkup(<MemoryRouter>{ui}</MemoryRouter>);
const FALSE_EMPTY = 'aparecen acá cuando la administración los aprueba';

describe('ClubCrestGrid', () => {
  it('shows a danger alert, not the empty text, when the read failed', () => {
    const html = render(<ClubCrestGrid teams={[]} loading={false} error="No se pudieron cargar los equipos." />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('No se pudieron cargar los equipos.');
    expect(html).toContain('Recargá');
    expect(html).not.toContain(FALSE_EMPTY);
  });

  it('keeps the empty text when there is genuinely no club', () => {
    expect(render(<ClubCrestGrid teams={[]} loading={false} />)).toContain(FALSE_EMPTY);
  });
});

describe('FranchiseSummary', () => {
  it('does not claim nobody chose a franchise player when the clubs failed to load', () => {
    const html = render(<FranchiseSummary teams={[]} franchise={{}} loading={false} teamsError="No se pudieron cargar los equipos." />);
    expect(html).toContain('role="alert"');
    expect(html).not.toContain('Ningún club eligió');
  });

  it('still reports its own error', () => {
    const html = render(<FranchiseSummary teams={[]} franchise={{}} loading={false} error="No se pudieron cargar los jugadores franquicia." />);
    expect(html).toContain('No se pudieron cargar los jugadores franquicia.');
    expect(html).not.toContain('Ningún club eligió');
  });
});

describe('LeagueTeamsScreen', () => {
  beforeEach(() => {
    hooks.teams = { teams: [], teamsById: {}, loading: false, error: '' };
    hooks.profiles = { byTeamId: {}, loading: false, error: '' };
    hooks.franchise = { byTeamId: {}, loading: false, error: '' };
  });

  it('uses a neutral intro with no count when the read failed', () => {
    hooks.teams = { ...hooks.teams, error: 'No se pudieron cargar los equipos.' };
    const html = render(<LeagueTeamsScreen />);
    expect(html).not.toMatch(/Los \d+ clubes/);
    expect(html).toContain('Los clubes de la liga.');
    expect(html).toContain('role="alert"');
  });

  it('keeps the count when it loaded', () => {
    hooks.teams = { ...hooks.teams, teams: [{ id: 'a', teamName: 'A' }, { id: 'b', teamName: 'B' }] };
    expect(render(<LeagueTeamsScreen />)).toContain('Los 2 clubes de la liga');
  });

  it('shows profile and franchise errors as a warning without hiding the grid', () => {
    hooks.teams = { ...hooks.teams, teams: [{ id: 'a', teamName: 'Alfa' }] };
    hooks.profiles = { byTeamId: {}, loading: false, error: 'No se pudieron cargar las fichas de los clubes.' };
    hooks.franchise = { byTeamId: {}, loading: false, error: 'No se pudieron cargar los jugadores franquicia.' };
    const html = render(<LeagueTeamsScreen />);
    expect(html).toContain('Alfa');
    expect(html).toContain('No se pudieron cargar las fichas de los clubes.');
    expect(html).toContain('No se pudieron cargar los jugadores franquicia.');
    expect(html).not.toContain('role="alert"');
  });
});
