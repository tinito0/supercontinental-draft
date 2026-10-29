// Gestor del torneo (components/TournamentModal.jsx): tiene que abrir aunque el torneo no haya cargado todavía.
// En producción se rompía con «can't access property "matches", l is null» antes de recibir los datos.
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { TournamentModal } from '../components/TournamentModal.jsx';

const render = props => renderToStaticMarkup(
  <MemoryRouter>
    <TournamentModal isVisible isPage isAdmin onUpdateTournament={async () => ({ ok: true })} allTeams={[]} allPlayers={[]} {...props} />
  </MemoryRouter>,
);

describe('TournamentModal', () => {
  it('renders before the tournament data arrives', () => {
    expect(() => render({ tournamentData: null })).not.toThrow();
  });

  it('renders with an empty tournament', () => {
    expect(() => render({ tournamentData: { league: [], matches: [], bracket: {} } })).not.toThrow();
  });
});
