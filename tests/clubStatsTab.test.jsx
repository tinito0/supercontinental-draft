// Pestaña Estadísticas del club (components/league/season/ClubStatsTab.jsx). Datos sintéticos, hooks simulados.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

const state = {};
vi.mock('../hooks/useSeasonStats.js', () => ({
  useSeasonStats: () => state.season,
  useMarketCatalog: () => null,
  catalogEntry: () => null,
}));
const { ClubStatsTab } = await import('../components/league/season/ClubStatsTab.jsx');
const { buildSeasonStats } = await import('../utils/seasonStats.js');

const line = (id, side, extra) => ({ id, side, name: `J${id}`, position: 9, started: true, minutes: 90, goals: 0, ownGoals: 0, assists: 0,
  yellow: 0, red: 0, shots: 0, shotsOnTarget: 0, passes: 0, passesCompleted: 0, tackles: 0, tacklesWon: 0, interceptions: 0, clearances: 0,
  dribblesCompleted: 0, saves: 0, rating: 7, ...extra });
const docs = [{
  matchKey: '20261101T200000Z_1-2', status: 'finished', startedAt: '2026-11-01',
  home: { gameTeamId: 1, draftTeamId: 'A', name: 'Los Pibes', score: 2 }, away: { gameTeamId: 2, draftTeamId: 'B', name: 'La Banda', score: 0 },
  players: [line(10, 'home', { goals: 2, shots: 5, assists: 0 }), line(11, 'home', { assists: 2, passes: 40, passesCompleted: 36 }), line(20, 'away', { shots: 1 })],
}];
const render = clubId => renderToStaticMarkup(<MemoryRouter><ClubStatsTab clubId={clubId} /></MemoryRouter>);

describe('ClubStatsTab', () => {
  it('shows the team per match against the league, and only the club players, without repeating the club', () => {
    state.season = { stats: buildSeasonStats(docs), docs, officialKeys: undefined, loading: false, error: '' };
    const html = render('A');
    expect(html).toContain('El equipo por partido');
    expect(html).toContain('1.º de 2');
    expect(html).toContain('J11');
    expect(html).not.toContain('J20');
    expect(html).not.toContain('Los Pibes</span>');
  });

  it('says why it is empty for a club without official matches', () => {
    state.season = { stats: buildSeasonStats(docs), docs, officialKeys: undefined, loading: false, error: '' };
    expect(render('Z')).toContain('todavía no jugó partidos oficiales');
  });
});
