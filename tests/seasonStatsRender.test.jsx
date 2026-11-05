// Estadísticas de temporada (components/league/season/*) renderizadas en el servidor con totales sintéticos.
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { SeasonStatsView } from '../components/league/season/SeasonStatsView.jsx';
import { PlayerMatchLog } from '../components/league/season/PlayerMatchLog.jsx';
import { RoundXi, SeasonRecords } from '../components/league/season/RoundAndRecords.jsx';
import { LiveNowPanel, pickLiveMatch } from '../components/league/match/LiveNowPanel.jsx';
import { StandingsTable } from '../components/league/tournament/StandingsTable.jsx';
import { BroadcastSeasonFacts } from '../components/broadcast/BroadcastMatchExtras.jsx';
import { buildSeasonStats, playerMatchLog } from '../utils/seasonStats.js';

const render = ui => renderToStaticMarkup(<MemoryRouter>{ui}</MemoryRouter>);
const player = (id, side, extra = {}) => ({
  id, side, name: `J${id}`, position: null, started: true, minutes: 90, goals: 0, ownGoals: 0, assists: 0, yellow: 0, red: 0,
  shots: 0, shotsOnTarget: 0, passes: 0, passesCompleted: 0, tackles: 0, tacklesWon: 0, interceptions: 0, clearances: 0,
  dribblesCompleted: 0, saves: 0, shotsOnTargetFaced: 0, xg: 0, rating: 6, ...extra,
});
const team = (draftTeamId, name, score) => ({ gameTeamId: 1, draftTeamId, name, score, xg: null });
const doc = (matchKey, players, homeScore, awayScore) => ({
  schema: 'scl.lines/1', matchKey, status: 'finished', startedAt: matchKey.slice(0, 16), competition: 'friendly',
  home: team('A', 'Los Pibes', homeScore), away: team('B', 'La Banda', awayScore), shootout: null, players,
});
const docs = [
  doc('20261110T200000Z_1-2', [player(9, 'home', { goals: 2, rating: 8.5, yellow: 1 }), player(10, 'home', { assists: 1 }), player(201, 'away', { position: 0, saves: 3 })], 2, 0),
  doc('20261117T200000Z_1-2', [player(9, 'home', { goals: 1, rating: 7 }), player(201, 'away', { position: 0, saves: 1 })], 1, 1),
];

describe('SeasonStatsView', () => {
  it('says there is no data yet instead of showing empty tables', () => {
    const html = render(<SeasonStatsView stats={buildSeasonStats([])} catalog={null} />);
    expect(html).toContain('Todavía no hay partidos oficiales');
    expect(html).not.toContain('Goleadores');
  });

  it('shows the leaders with links to each player page and the rating with a comma', () => {
    const html = render(<SeasonStatsView stats={buildSeasonStats(docs)} catalog={null} />);
    expect(html).toContain('2</span> partidos oficiales');
    expect(html).toContain('href="/jugadores/9"');
    expect(html).toContain('J9');
    expect(html).toContain('7,8');
    expect(html).toContain('Atajadas');
  });

  it('falls back to the catalog name when the game gave none', () => {
    const noName = [doc('20261110T200000Z_1-2', [player(9, 'home', { goals: 1, name: null })], 1, 0)];
    const html = render(<SeasonStatsView stats={buildSeasonStats(noName)} catalog={{ 9: [1, 25, 80, 'Delantero Nueve', 'DC', 1] }} />);
    expect(html).toContain('Delantero Nueve');
  });
});

describe('PlayerMatchLog', () => {
  it('lists the matches newest first with result, score and a link to the match', () => {
    const html = render(<PlayerMatchLog log={playerMatchLog(docs, 9)} teamsById={{}} />);
    expect(html.indexOf('17/11')).toBeLessThan(html.indexOf('10/11'));
    expect(html).toContain('href="/partidos/20261117T200000Z_1-2"');
    expect(html).toContain('Empató');
    expect(html).toContain('Ganó');
    expect(html).toContain('Tarjeta amarilla');
  });

  it('says so when the player has no official match', () => {
    expect(render(<PlayerMatchLog log={[]} teamsById={{}} />)).toContain('Todavía no jugó partidos oficiales');
  });
});

describe('RoundXi and SeasonRecords', () => {
  const ratedDocs = [doc('20261110T200000Z_1-2', [
    player(1, 'home', { position: 0, rating: 7 }), player(9, 'home', { position: 12, rating: 8.5, goals: 3 }),
  ], 3, 0)];

  it('shows the latest round with its players and rating, linked to their pages', () => {
    const html = render(<RoundXi docs={ratedDocs} rounds={[{ round: 'Fecha 1', keys: ['20261110T200000Z_1-2'] }]} catalog={null} />);
    expect(html).toContain('Equipo de la fecha');
    expect(html).toContain('Fecha 1');
    expect(html).toContain('href="/jugadores/9"');
    expect(html).toContain('8,5');
  });

  it('shows nothing without a round that has finished matches', () => {
    expect(render(<RoundXi docs={ratedDocs} rounds={[{ round: 'Fecha 2', keys: ['otro'] }]} catalog={null} />)).toBe('');
  });

  it('lists the records with links to their matches', () => {
    const html = render(<SeasonRecords records={buildSeasonStats(ratedDocs).records} catalog={null} />);
    expect(html).toContain('Goleada más amplia');
    expect(html).toContain('Los Pibes 3-0 La Banda');
    expect(html).toContain('Hat-trick');
    expect(html).toContain('href="/partidos/20261110T200000Z_1-2"');
  });

  it('shows the fastest goal with its minute and comebacks by deficit', () => {
    const home = { name: 'Los Pibes', score: 2 };
    const away = { name: 'La Banda', score: 1 };
    const records = {
      biggestWin: null, mostGoals: null, hatTricks: [],
      fastestGoal: { matchKey: 'k1', minute: 2, second: 40, playerId: 9, name: 'Rápido', side: 'home', home, away },
      comebacks: [{ matchKey: 'k2', deficit: 2, winner: 'home', home, away }],
    };
    const html = render(<SeasonRecords records={records} catalog={null} />);
    expect(html).toContain('Gol más rápido · 2&#x27;');
    expect(html).toContain('Rápido');
    expect(html).toContain('Remontada de 2 goles');
    expect(html).toContain('href="/partidos/k2"');
  });
});

describe('LiveNowPanel', () => {
  const live = { key: 'k1', status: { kind: 'live', label: "63'" }, home: { name: 'Los Pibes', score: 1, draftTeamId: null }, away: { name: 'La Banda', score: 0, draftTeamId: null }, competition: 'Liga', summary: { goals: [], cards: [], substitutions: [] } };

  it('shows the live match score and a link to the full match page', () => {
    const html = render(<LiveNowPanel matches={[{ ...live, key: 'old', status: { kind: 'finished', label: 'Final' } }, live]} teamsById={{}} />);
    expect(html).toContain('Los Pibes');
    expect(html).toContain('href="/partidos/k1"');
    expect(pickLiveMatch([live]).key).toBe('k1');
  });

  it('shows nothing when no match is live', () => {
    expect(render(<LiveNowPanel matches={[{ ...live, status: { kind: 'finished', label: 'Final' } }]} teamsById={{}} />)).toBe('');
  });
});

describe('StandingsTable live projection', () => {
  it('marks the live table, the teams playing and who climbs', () => {
    const rows = [{ name: 'Oeste', pj: 2, pg: 1, gpen: 0, pp: 1, pts: 2, gf: 3, gc: 2, isLive: true, move: 3 }, { name: 'Norte', pj: 2, pg: 1, gpen: 0, pp: 1, pts: 2, gf: 3, gc: 4, isLive: true, move: -1 }];
    const html = render(<StandingsTable rows={rows} clubOf={() => null} isLive />);
    expect(html).toContain('Tabla en vivo');
    expect(html).toContain('sube 3');
    expect(html).toContain('baja 1');
    expect(html).toContain('jugando ahora');
  });
});

describe('BroadcastSeasonFacts', () => {
  it('shows both forms and the head to head, with the results spelled out for screen readers', () => {
    const html = render(<BroadcastSeasonFacts facts={{ homeForm: ['W', 'L'], awayForm: ['D'], h2h: { played: 2, won: 1, drawn: 1, lost: 0 } }} />);
    expect(html).toContain('1G 1E 0P');
    expect(html).toContain('cara a cara');
    expect(html).toContain('el más nuevo al final: perdió, ganó');
    expect(html).toContain('broadcast-form-W');
  });

  it('says it is the first meeting when they never played', () => {
    expect(render(<BroadcastSeasonFacts facts={{ homeForm: ['W'], awayForm: [], h2h: { played: 0, won: 0, drawn: 0, lost: 0 } }} />)).toContain('primer cruce');
  });
});
