// Partidos: marcador anunciable, nombres de equipo y estadísticas sin depender del color ni del hover,
// área de toque de los tiros, y el error de los partidos en vivo visible en /partidos.
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../hooks/useLeagueData.js', () => ({
  useLeagueTeams: () => ({ teams: [], teamsById: {} }),
}));
vi.mock('../../hooks/useLeagueFixtures.js', () => ({ useLeagueFixtures: () => state.fixtures }));
vi.mock('../../hooks/useDocumentTitle.js', () => ({ useDocumentTitle: () => {} }));
vi.mock('../../components/league/home/FeaturedMatch.jsx', () => ({ FeaturedMatch: () => null }));
vi.mock('../../components/league/match/LeagueLeaders.jsx', () => ({ LeagueLeaders: () => null }));

const state = {};

import { LiveScore } from '../../components/league/match/LiveScore.jsx';
import { RatingChip } from '../../components/league/match/MatchParts.jsx';
import { ShotMap } from '../../components/league/match/ShotMap.jsx';
import { Heatmap } from '../../components/league/match/Heatmap.jsx';
import { PlayerStatsTable } from '../../components/league/match/MatchDetailViews.jsx';
import LeagueMatchesScreen from '../../screens/league/LeagueMatchesScreen.jsx';

const match = { home: { name: 'Talleres' }, away: { name: 'Racing' } };

describe('LiveScore', () => {
  it('announces score changes through an always-mounted polite live region', () => {
    const html = renderToStaticMarkup(<LiveScore home={1} away={0} />);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-atomic="true"');
    expect(html).toContain('1 a 0');
  });
});

describe('RatingChip', () => {
  it('names the rating in sr-only text instead of an aria-label on a generic span', () => {
    const html = renderToStaticMarkup(<RatingChip value={7.5} isBest />);
    expect(html).not.toContain('aria-label');
    expect(html).toContain('<span class="sr-only">Valoración 7,5, la mejor del partido</span>');
  });
});

describe('ShotMap', () => {
  const shots = [{ index: 0, side: 'home', name: 'Pérez', minute: "37'", outcome: 'goal', outcomeLabel: 'Gol', xg: 0.05, x: 90, y: 30 }];

  it('gives each shot a hit area of at least 5 viewBox units with a visible focus ring', () => {
    const html = renderToStaticMarkup(<ShotMap shots={shots} match={match} selected={null} onSelect={() => {}} />);
    const hit = html.match(/<circle[^>]*role="button"[^>]*>/)?.[0] || '';
    const radius = Number(hit.match(/ r="([\d.]+)"/)?.[1]);
    expect(radius).toBeGreaterThanOrEqual(5);
    expect(hit).toContain('focus-visible:stroke-ink');
    expect(hit).not.toContain('outline-none');
  });

  it('keeps the visible dot out of the pointer and accessibility tree', () => {
    const html = renderToStaticMarkup(<ShotMap shots={shots} match={match} selected={null} onSelect={() => {}} />);
    expect(html).toMatch(/<circle cx="[^"]*" cy="[^"]*" r="[^"]*" aria-hidden="true" class="pointer-events-none/);
  });
});

describe('Heatmap', () => {
  it('has a scale legend and a label that explains the colours', () => {
    const cells = Array.from({ length: 4 * 3 }, (_, i) => i);
    const html = renderToStaticMarkup(<Heatmap cells={cells} cols={4} rows={3} label="Mapa de calor de Talleres" />);
    expect(html).toContain('>menos<');
    expect(html).toContain('>más<');
    expect(html).toContain('Rojo: zonas donde más veces estuvo');
    expect(html).toContain('A la izquierda, el arco propio');
  });
});

describe('PlayerStatsTable', () => {
  const row = {
    id: 1, name: 'Pérez', side: 'home', rating: 7.5, goals: 1, assists: 0, shots: 2, shotsOnTarget: 1,
    passes: 20, passesCompleted: 15, dribbles: 3, dribblesCompleted: 2, tacklesWon: 1, interceptions: 0, saves: 0, cards: [],
  };

  it('has a caption, expands abbreviations, and explains them below the table', () => {
    const html = renderToStaticMarkup(<PlayerStatsTable rows={[row]} match={match} />);
    expect(html).toContain('<caption class="sr-only">Estadísticas de los jugadores de Talleres</caption>');
    expect(html).toContain('<abbr title="Goles"');
    expect(html).toContain('G: Goles');
    expect(html).toContain('Gamb.: Gambetas logradas / intentadas');
  });
});

describe('LeagueMatchesScreen live read error', () => {
  const base = { fixtures: [], groups: [], liveMatches: [], prediction: null, loading: false, error: '', liveError: '' };

  it('shows an alert when the live matches fail to load', () => {
    state.fixtures = { ...base, liveError: 'boom' };
    const html = renderToStaticMarkup(<MemoryRouter><LeagueMatchesScreen /></MemoryRouter>);
    expect(html).toContain('No pudimos cargar los partidos en vivo');
  });

  it('shows no live alert when the live read succeeds', () => {
    state.fixtures = { ...base };
    const html = renderToStaticMarkup(<MemoryRouter><LeagueMatchesScreen /></MemoryRouter>);
    expect(html).not.toContain('No pudimos cargar los partidos en vivo');
  });
});
