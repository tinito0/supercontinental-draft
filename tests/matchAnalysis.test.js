// Análisis del partido (utils/matchAnalysis.js) con resúmenes sintéticos.
import { SERIES_STATS } from '../pes-collector/collector/statKinds.js';
import {
  MOMENTUM_DECAY, ROLE_LABELS, bucketRows, dataSources, formationChanges, halfTotals, momentum, passMix, pitchLayout, playPeriod,
  rolesSummary, teamPlanView,
} from '../utils/matchAnalysis.js';

const clock = (period, minute, second = 0) => ({ period, minute, second });
const n = SERIES_STATS.length;
// Fila de la serie: [tiempo, minuto, ...local, ...visitante] con los valores dados por nombre.
const seriesRow = (period, minute, home = {}, away = {}) => [
  period, minute, ...SERIES_STATS.map(k => home[k] || 0), ...SERIES_STATS.map(k => away[k] || 0),
];

describe('playPeriod', () => {
  it('derives the period of an in-play penalty from its minute and folds stoppage flaps into the 2nd half', () => {
    expect(playPeriod(clock(5, 40), false)).toBe(1);
    expect(playPeriod(clock(5, 70), false)).toBe(2);
    expect(playPeriod(clock(3, 90), false)).toBe(2);
    expect(playPeriod(clock(3, 95), true)).toBe(3);
  });
});

describe('momentum', () => {
  const summary = {
    status: 'finished', clock: clock(3, 90), match: { extraTime: false },
    series: { kinds: SERIES_STATS, from: null, rows: [
      seriesRow(1, 2, { shots: 1, shotsOnTarget: 1 }),
      seriesRow(1, 3, {}, { corners: 2 }),
      seriesRow(2, 90, { crosses: 1 }), // stoppage time
    ] },
    goals: [{ side: 'home', clock: clock(5, 2, 10) }],
  };

  it('weights the actions, carries half of the previous minute and covers every minute of both halves', () => {
    const result = momentum(summary);
    const at = (period, minute) => result.points.find(p => p.period === period && p.minute === minute);
    expect(at(1, 2).value).toBe(2);
    expect(at(1, 3).value).toBe(-1 + 2 * MOMENTUM_DECAY);
    expect(at(1, 4).value).toBe(0);
    expect(at(2, 45).value).toBe(0); // reset at half time
    expect(at(2, 90).value).toBe(0.5);
    expect(result.points.filter(p => p.period === 1)).toHaveLength(45);
    expect(result.points.some(p => p.period === 3)).toBe(false);
    expect(result.goals).toEqual([{ period: 1, minute: 2, side: 'home' }]);
  });

  it('stops at the current minute of a live match and is null without a per-minute series', () => {
    const live = { ...summary, status: 'live', clock: clock(1, 20), series: { ...summary.series, rows: summary.series.rows.slice(0, 2) } };
    expect(momentum(live).points.at(-1)).toMatchObject({ period: 1, minute: 20 });
    expect(momentum({ series: { kinds: SERIES_STATS, rows: [] } })).toBeNull();
    expect(momentum({})).toBeNull();
  });
});

describe('bucketRows and halfTotals', () => {
  const words = values => [...values, ...Array(8 - values.length).fill(0)];
  const buckets = {
    home: Object.fromEntries(SERIES_STATS.map(k => [k, words(k === 'passes' ? [10, 0, 5] : k === 'passesCompleted' ? [8, 0, 5] : [])])),
    away: Object.fromEntries(SERIES_STATS.map(k => [k, words([])])),
  };

  it('gives six regular-time rows with accuracy per bucket, null where nobody passed', () => {
    const rows = bucketRows({ buckets, match: { extraTime: false } });
    expect(rows).toHaveLength(6);
    expect(rows[0].home).toMatchObject({ passes: 10, passAccuracy: 80 });
    expect(rows[1].home.passAccuracy).toBeNull();
    expect(rows[1].empty).toBe(true);
    expect(bucketRows({ buckets, match: { extraTime: true } })).toHaveLength(8);
  });

  it('adds the buckets into halves and shows extra time only when there was any', () => {
    const halves = halfTotals({ buckets, match: { extraTime: false } });
    expect(halves.map(h => h.label)).toEqual(['Primer tiempo', 'Segundo tiempo']);
    expect(halves[0].home).toMatchObject({ passes: 15, passAccuracy: 87 });
    expect(bucketRows({})).toEqual([]);
  });
});

describe('pitchLayout', () => {
  const XI = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const plan = { status: 'matches', roles: [0, 1, 1, 3, 2, 4, 5, 10, 9, 8, 12], pos: XI.map((_, i) => [3 + i * 4, 10 + i * 8]), numbers: { 1: 1 } };
  const summary = {
    lineups: { home: { starting: XI }, away: { starting: XI } },
    teamPlans: { home: plan, away: { status: 'differs' } },
    substitutions: [{ side: 'home', offId: 11, onId: 12, clock: clock(2, 70) }],
    names: { players: { 1: 'Arquero' } },
  };

  it('puts the home team attacking right in game coordinates and never places a side without a confirmed plan', () => {
    const layout = pitchLayout(summary);
    expect(layout.home.players[0]).toMatchObject({ name: 'Arquero', number: 1, role: 'PT', x: 3, y: 10 });
    expect(layout.home.players[10]).toMatchObject({ role: 'DC', x: 43, subbedOff: "71'" });
    expect(layout.away).toEqual({ status: 'differs', players: [] });
  });

  it('mirrors the away team: depth from the right, its left side at the bottom', () => {
    const away = pitchLayout({ ...summary, teamPlans: { away: plan } }).away.players[3];
    expect(away).toMatchObject({ role: 'LD', x: 100 - 15, y: 100 - 34 });
  });

  it('prefers the formation read from the game, even when the saved plan does not match the XI', () => {
    const live = { clock: clock(1, 0, 30), xi: XI.map((_, i) => i), ids: XI.map(id => id + 100),
      variants: [{ roles: [0, 1, 1, 1, 4, 4, 7, 6, 8, 11, 12], pos: XI.map(() => [20, 50]) }] };
    const layout = pitchLayout({ ...summary, formations: { home: [], away: [live] } });
    expect(layout.away.status).toBe('live');
    expect(layout.away.players.map(p => p.id)).toEqual(XI.map(id => id + 100));
    expect(layout.away.players[3].role).toBe('DFC');
    expect(layout.away.players[0].number).toBeNull(); // shirt numbers only from a matching save
    expect(layout.home.status).toBe('matches'); // no live state for home: the matching save still counts
  });

  it('labels the roles in game order', () => {
    expect(ROLE_LABELS).toEqual(['PT', 'DFC', 'LI', 'LD', 'MCD', 'MC', 'MI', 'MD', 'MO', 'EI', 'ED', 'SD', 'DC']);
  });
});

describe('teamPlanView and passMix', () => {
  it('names the strategy as the game shows it, with the save\'s inverted pressure, and the advanced instructions', () => {
    const view = teamPlanView({ teamPlans: { home: {
      status: 'matches', strategy: { attackingStyles: 1, pressuring: 0, defensiveLine: 8, numbersInAttack: 3 }, advanced: [6, 0, 13, 0],
    } } }, 'home');
    expect(view.attack).toEqual([
      { key: 'attackingStyles', label: 'Estilo de ataque', value: 'Posesión' },
      { key: 'numbersInAttack', label: 'Efectivos en ataque', value: 'Muchos' },
    ]);
    expect(view.defense.map(r => r.value)).toEqual(['Agresiva', '8 / 10']);
    expect(view.instructions).toEqual({ attack: ['Tiqui-taca'], defense: ['Presión alta'] });
    expect(teamPlanView({ teamPlans: { home: { status: 'differs' } } }, 'home')).toBeNull();
  });

  it('splits passes by type, or null when the types were not measured', () => {
    const stats = { passes: 100, shortPasses: 70, throughPasses: 10, longPasses: 15, crosses: 5 };
    expect(passMix({ teamStats: { home: stats, away: stats } }).home).toEqual({ short: 70, through: 10, long: 15, cross: 5 });
    expect(passMix({ teamStats: { home: { passes: 10 }, away: stats } })).toBeNull();
  });
});

describe('formationChanges and rolesSummary', () => {
  const variant = roles => [{ roles, pos: [] }];
  const XI = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const summary = { formations: {
    home: [
      { clock: clock(1, 0), xi: XI, variants: variant([0, 1, 1, 3, 2, 4, 5, 10, 9, 8, 12]) },
      { clock: clock(2, 90, 5), xi: XI, variants: variant([0, 1, 1, 1, 4, 4, 7, 6, 8, 11, 12]) },
    ],
    away: [
      { clock: clock(1, 0), xi: XI, variants: variant([0, 1, 1, 3, 2, 4, 5, 10, 9, 8, 12]) },
      { clock: clock(1, 30), xi: [0, 2, 1, ...XI.slice(3)], variants: variant([0, 1, 1, 3, 2, 4, 5, 10, 9, 8, 12]) },
    ],
  } };

  it('lists changes after kick-off in match order, telling a new shape from a position swap', () => {
    const changes = formationChanges(summary);
    expect(changes.map(c => [c.side, c.minute, c.formationChanged, c.positionsChanged])).toEqual([
      ['away', "31'", false, true],
      ['home', "90+1'", true, false],
    ]);
    expect(changes[1].roles).toBe('DFC ×3 · MCD ×2 · MI · MD · MO · SD · DC');
    expect(formationChanges({})).toEqual([]);
  });

  it('summarizes the outfield roles of a formation', () => {
    expect(rolesSummary([0, 1, 1, 3, 2, 4, 5, 10, 9, 8, 12])).toBe('DFC ×2 · LI · LD · MCD · MC · MO · EI · ED · DC');
  });
});

describe('dataSources', () => {
  it('marks what is missing and explains a plan that does not match the XI', () => {
    const sources = dataSources({ teamPlans: { home: { status: 'matches' }, away: { status: 'differs' } } });
    const by = label => sources.find(s => s.label.startsWith(label));
    expect(by('Lista de tiros').source).toBe('unavailable');
    expect(by('Dominio').source).toBe('unavailable');
    expect(by('Goles esperados').source).toBe('unavailable');
    expect(by('Formación').detail).toMatch(/visitante: el plan guardado no coincide/);
    expect(by('Posesión').source).toBe('unavailable');
  });

  it('marks possession as calculated when the game filled its counters', () => {
    const sources = dataSources({ possession: { home: 46, away: 54 } });
    expect(sources.find(s => s.label === 'Posesión').source).toBe('calculated');
  });
});
