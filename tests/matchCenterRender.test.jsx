// Vistas del registro de partidos (components/league/match/*) renderizadas en el servidor con datos sintéticos.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MatchHeader, MatchTimeline } from '../components/league/match/MatchSummaryView.jsx';
import { MatchLineups, MatchStats, PlayerStatsTable } from '../components/league/match/MatchDetailViews.jsx';
import { buildLineups, buildTimeline, parseMatchDoc, playerStatRows, teamStatRows } from '../utils/matchCenter.js';

const clock = (period, minute, second = 0) => ({ period, minute, second });
const summary = {
  schema: 'scl.match/1', status: 'live',
  match: { homeTeamId: 101, awayTeamId: 103, tournamentId: 17 },
  clock: clock(2, 62), score: { home: 2, away: 1 }, shootout: null,
  goals: [
    { side: 'home', playerId: 10, assistPlayerId: 11, ownGoal: false, penalty: false, clock: clock(1, 14) },
    { side: 'away', playerId: 20, assistPlayerId: null, ownGoal: false, penalty: true, clock: clock(1, 44) },
    { side: 'home', playerId: 21, assistPlayerId: null, ownGoal: true, penalty: false, clock: clock(2, 55) },
  ],
  cards: [{ side: 'away', playerId: 21, type: 'red', clock: clock(2, 58) }],
  substitutions: [{ side: 'home', offId: 11, onId: 12, clock: clock(2, 50) }],
  lineups: { home: { starting: [10, 11] }, away: { starting: [20, 21] } },
  players: { home: [{ id: 10, stats: { goals: 1, shots: 2 } }, { id: 11, stats: {} }, { id: 12, stats: {} }], away: [{ id: 20, stats: { goals: 1 } }, { id: 21, stats: { ownGoals: 1 } }] },
  teamStats: { home: { shots: 6, passes: 80, passesCompleted: 60 }, away: { shots: 3, passes: 50, passesCompleted: 40 } },
  names: { teams: { home: 'Arsenal', away: 'Liverpool' }, players: { 10: 'L. Trossard', 11: 'D. Rice', 12: 'K. Havertz', 20: 'M. Salah', 21: 'V. van Dijk' } },
};
const match = parseMatchDoc({ matchKey: '20261021T232728Z_101-103', summaryJson: JSON.stringify(summary) });
const timeline = buildTimeline(match.summary);

describe('match page views', () => {
  it('header: teams, live score, minute and scorers with minute', () => {
    const html = renderToStaticMarkup(<MatchHeader match={match} timeline={timeline} teamsById={{}} />);
    expect(html).toContain('Arsenal');
    expect(html).toContain('aria-label="2 a 1"');
    expect(html).toContain("63&#x27;");
    expect(html).toContain('en vivo');
    expect(html).toContain('L. Trossard 15&#x27;');
    expect(html).toContain('V. van Dijk 56&#x27; (e.c.)');
    expect(html).toContain('M. Salah 45&#x27; (p)');
  });

  it('timeline: one row per event, a break between halves, running score', () => {
    const html = renderToStaticMarkup(<MatchTimeline timeline={timeline} match={match} />);
    expect(html.split('<li class="grid').length - 1).toBe(5);
    expect(html).toContain('Primer tiempo');
    expect(html).toContain('Segundo tiempo');
    expect(html).toContain('Asistencia: D. Rice');
    expect(html).toContain('Tarjeta roja');
    expect(html).toContain('>2-1<');
  });

  it('stats, lineups and player table render what was measured', () => {
    const stats = renderToStaticMarkup(<MatchStats rows={teamStatRows(match.summary)} match={match} />);
    expect(stats).toContain('Precisión de pases');
    expect(stats).toContain('75%');
    expect(stats).toContain('La posesión todavía no se mide');
    const lineups = renderToStaticMarkup(<MatchLineups lineups={buildLineups(match.summary)} match={match} />);
    expect(lineups).toContain('K. Havertz');
    expect(lineups).toContain('por D. Rice');
    const table = renderToStaticMarkup(<PlayerStatsTable rows={playerStatRows(match.summary)} match={match} />);
    expect(table).toContain('L. Trossard');
    expect(table).not.toContain('M. Salah'); // the table opens on the home side
  });
});
