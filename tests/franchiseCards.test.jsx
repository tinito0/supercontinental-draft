// Server-rendered markup of the franchise player card, the home showcase and the club grid line (synthetic data).
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { FranchisePlayerCard } from '../components/league/FranchisePlayerCard.jsx';
import { FranchiseShowcase } from '../components/league/home/FranchiseShowcase.jsx';
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

describe('FranchiseShowcase', () => {
  it('shows only the clubs that signed one', () => {
    const html = render(<FranchiseShowcase teams={[team, { id: 'teamB', teamName: 'Otro' }]} franchise={{ teamA: player }} loading={false} error="" />);

    expect(html).toContain('Veterano Uno');
    expect(html).not.toContain('Otro');
  });

  it('says so when no club has one yet', () => {
    expect(render(<FranchiseShowcase teams={[team]} franchise={{}} loading={false} error="" />)).toContain('Todavía no hay jugadores franquicia');
  });
});

describe('ClubGrid', () => {
  it('names each club\'s franchise player', () => {
    const html = render(<ClubGrid teams={[team]} loading={false} error="" franchise={{ teamA: player }} />);

    expect(html).toContain('Franquicia');
    expect(html).toContain('Veterano Uno');
  });
});

describe('FranchiseExplainer', () => {
  it('states the rules from the market constants', async () => {
    const { FranchiseExplainer } = await import('../components/league/home/FranchiseExplainer.jsx');
    const { FRANCHISE_MIN_AGE, FRANCHISE_MIN_OVR, FRANCHISE_MAX_OVR } = await import('../supabase/functions/_shared/marketConstants.js');
    const html = render(<FranchiseExplainer headingId="f" />);

    expect(html).toContain('id="f"');
    expect(html).toContain(`${FRANCHISE_MIN_AGE}+`);
    expect(html).toContain(`OVR ${FRANCHISE_MIN_OVR} a ${FRANCHISE_MAX_OVR}`);
    expect(html).toContain('Mercado Franquicia');
    expect(html).not.toContain('—');
  });
});
