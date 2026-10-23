// Pestañas nuevas del partido (components/league/match/*) renderizadas en el servidor: un resumen sintético completo
// y uno grabado antes de los campos nuevos (shots, series, buckets, teamPlans), que tiene que mostrar faltantes, no ceros.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { SERIES_STATS } from '../pes-collector/collector/statKinds.js';
import { LineupPitch } from '../components/league/match/LineupPitch.jsx';
import { MatchAnalysisView } from '../components/league/match/MatchAnalysisView.jsx';
import { MatchTacticsView } from '../components/league/match/MatchTacticsView.jsx';
import { MomentumChart } from '../components/league/match/MomentumChart.jsx';
import { PlayerAnalysis } from '../components/league/match/PlayerAnalysis.jsx';
import { ShotsPanel } from '../components/league/match/ShotsPanel.jsx';
import { parseMatchDoc, playerStatRows } from '../utils/matchCenter.js';
import { momentum, pitchLayout } from '../utils/matchAnalysis.js';
import { shotRows } from '../utils/matchStats.js';

const clock = (period, minute, second = 0) => ({ period, minute, second });
const XI = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const row = (period, minute, home = {}) => [period, minute, ...SERIES_STATS.map(k => home[k] || 0), ...SERIES_STATS.map(() => 0)];
const words = () => Object.fromEntries(SERIES_STATS.map(k => [k, [1, 0, 0, 0, 0, 0, 0, 0]]));

const full = {
  schema: 'scl.match/1', status: 'finished', clock: clock(3, 90), score: { home: 1, away: 0 },
  match: { homeTeamId: 101, awayTeamId: 103, tournamentId: 17, extraTime: false },
  goals: [{ side: 'home', playerId: 9, assistPlayerId: null, ownGoal: false, penalty: false, clock: clock(1, 20) }],
  cards: [], substitutions: [],
  lineups: { home: { starting: XI }, away: { starting: XI.map(id => id + 100) } },
  players: { home: XI.map(id => ({ id, stats: id === 9 ? { goals: 1, shots: 2, shotsOnTarget: 1, touches: 9 } : { touches: 1 } })), away: [] },
  teamStats: {
    home: { shots: 2, shotsOnTarget: 1, passes: 10, passesCompleted: 8, shortPasses: 6, throughPasses: 2, longPasses: 1, crosses: 1 },
    away: { shots: 0, shotsOnTarget: 0, passes: 5, passesCompleted: 3, shortPasses: 5, throughPasses: 0, longPasses: 0, crosses: 0 },
  },
  shots: [
    { side: 'home', playerId: 9, clock: clock(1, 20), outcome: 'goal', penalty: false },
    { side: 'home', playerId: 9, clock: clock(2, 60), outcome: 'off_target', penalty: false },
  ],
  series: { kinds: SERIES_STATS, from: null, rows: [row(1, 20, { shots: 1, shotsOnTarget: 1 })] },
  buckets: { home: words(), away: words() },
  teamPlans: {
    home: { status: 'matches', roles: [0, 1, 1, 3, 2, 4, 5, 10, 9, 8, 12], pos: XI.map((_, i) => [3 + i * 4, 50]), numbers: { 9: 14 },
      strategy: { attackingStyles: 1 }, advanced: [6, 0, 0, 0] },
    away: { status: 'differs' },
  },
  names: { teams: { home: 'Arsenal', away: 'Liverpool' }, players: { 9: 'V. Gyökeres' }, positions: { 9: 12 } },
};
const old = { ...full, shots: undefined, series: undefined, buckets: undefined, teamPlans: undefined,
  teamStats: { home: { shots: 2, passes: 10, passesCompleted: 8 }, away: { shots: 0, passes: 5, passesCompleted: 3 } } };
const doc = summary => parseMatchDoc({ matchKey: '20261022T010000Z_101-103', summaryJson: JSON.stringify(summary) });
const html = node => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);

describe('match analysis views (full summary)', () => {
  const match = doc(full);

  it('momentum: an accessible chart with the goal marked and the legend', () => {
    const out = html(<MomentumChart data={momentum(match.summary)} match={match} />);
    expect(out).toContain('role="img"');
    expect(out).toContain('Gol Arsenal, minuto 21');
    expect(out).toContain('Liverpool');
  });

  it('shots: each shot with minute and outcome, and the reason there is no map', () => {
    const out = html(<ShotsPanel shots={shotRows(match.summary)} match={match} />);
    expect(out).toContain('V. Gyökeres');
    expect(out).toContain("21&#x27;");
    expect(out).toContain('Afuera');
    expect(out).toContain('Sin mapa de tiros');
  });

  it('pitch: the confirmed side is drawn with shirt numbers, the other one says why it is not', () => {
    const out = html(<LineupPitch layout={pitchLayout(match.summary)} match={match} />);
    expect(out).toContain('V. Gyökeres, dorsal 14, EI'); // slot 8 plays LWF in this synthetic plan
    expect(out).toContain('el plan guardado no coincide con el XI');
  });

  it('players, tactics and analysis render what was measured', () => {
    const players = html(<PlayerAnalysis rows={playerStatRows(match.summary)} summary={match.summary} match={match} />);
    expect(players).toContain('Los que más');
    expect(players).toContain('Sin calificación');
    const tactics = html(<MatchTacticsView summary={match.summary} match={match} />);
    expect(tactics).toContain('Posesión');
    expect(tactics).toContain('Tiqui-taca');
    expect(tactics).toContain('Cortos 60 %');
    const analysis = html(<MatchAnalysisView summary={match.summary} match={match} />);
    expect(analysis).toContain("0&#x27;–15&#x27;");
    expect(analysis).toContain('Modelo propio, no un dato del juego');
    expect(analysis).not.toContain('De dónde sale cada dato');
  });
});

describe('match analysis views (summary recorded before the new fields)', () => {
  const match = doc(old);

  it('says what is missing instead of drawing zeros', () => {
    expect(html(<MomentumChart data={momentum(match.summary)} match={match} />)).toContain('se grabó antes de medir');
    expect(html(<ShotsPanel shots={shotRows(match.summary)} match={match} />)).toContain('antes de medirlos uno por uno');
    expect(html(<LineupPitch layout={pitchLayout(match.summary)} match={match} />)).toContain('no tiene plan');
    expect(html(<MatchTacticsView summary={match.summary} match={match} />)).toContain('antes de medir los tipos de pase');
    expect(html(<MatchAnalysisView summary={match.summary} match={match} />)).toContain('antes de guardar los tramos');
  });
});
