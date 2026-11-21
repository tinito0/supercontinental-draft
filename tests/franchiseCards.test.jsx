// Server-rendered markup of the franchise player card, the home showcase and the club grid line (synthetic data).
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { FranchisePlayerCard } from '../components/league/FranchisePlayerCard.jsx';
import { ClubCrestGrid, FranchiseSummary } from '../components/league/home/HomeCompact.jsx';
import { FRANCHISE_MIN_AGE, FRANCHISE_MIN_OVR, FRANCHISE_MAX_OVR } from '../supabase/functions/_shared/marketConstants.js';
import { ClubGrid } from '../components/league/ClubGrid.jsx';

const team = { id: 'teamA', teamName: 'Club de Prueba' };
const player = { playerId: '10', name: 'Veterano Uno', pos: 'DC', ovr: 82, age: 33 };
const render = node => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);

describe('FranchisePlayerCard', () => {
  it('links to the club and names player and club', () => {
    const html = render(<FranchisePlayerCard player={player} team={team} />);

    expect(html).toContain('href="/equipos/teamA"');
    expect(html).toContain('aria-label="Veterano Uno, jugador franquicia de Club de Prueba"');
    expect(html).toContain('/fotos_jugadores/10.webp');
    expect(html).toContain('stat-c-80');
    expect(html).toContain('pos-delantero');
  });

  it('without a club it is not a link and shows the age', () => {
    const html = render(<FranchisePlayerCard player={player} />);

    expect(html).not.toContain('<a ');
    expect(html).toContain('>33</span> años');
  });

  it('without catalog data it shows no invented OVR or position', () => {
    const html = render(<FranchisePlayerCard player={{ playerId: '99', name: '', pos: '', ovr: null, age: null }} />);

    expect(html).toContain('Jugador franquicia');
    expect(html).not.toContain('stat-c-');
  });
});

describe('FranchiseSummary', () => {
  it('shows only the clubs that signed one, and the rules from the market constants', () => {
    const html = render(<FranchiseSummary teams={[team, { id: 'teamB', teamName: 'Otro' }]} franchise={{ teamA: player }} loading={false} headingId="f" />);

    expect(html).toContain('id="f"');
    expect(html).toContain('Veterano Uno');
    expect(html).not.toContain('Otro');
    expect(html).toContain(`de ${FRANCHISE_MIN_AGE} años o más`);
    expect(html).toContain(`media de ${FRANCHISE_MIN_OVR} a ${FRANCHISE_MAX_OVR}`);
    expect(html).not.toContain('—');
  });

  it('says how one gets there when no club has one yet, and when loading failed', () => {
    expect(render(<FranchiseSummary teams={[team]} franchise={{}} loading={false} />)).toContain('Mercado Franquicia');
    expect(render(<FranchiseSummary teams={[team]} franchise={{}} loading={false} error="x" />)).toContain('No se pudieron cargar');
  });
});

describe('ClubCrestGrid', () => {
  it('links every crest to its club', () => {
    const html = render(<ClubCrestGrid teams={[team]} loading={false} />);
    expect(html).toContain('href="/equipos/teamA"');
    expect(html).toContain('Club de Prueba');
  });
});

describe('ClubGrid', () => {
  it('names each club\'s franchise player', () => {
    const html = render(<ClubGrid teams={[team]} loading={false} error="" franchise={{ teamA: player }} />);

    expect(html).toContain('Franquicia');
    expect(html).toContain('Veterano Uno');
  });
});
