// Synthetic game records and fixtures: how estimated kickoffs follow the real length of the night's games.
import { estimateKickoffs, formatEta, matchTimingModel, scheduledMs } from '../utils/matchEta.js';

const MIN = 60_000;
const base = new Date(2026, 10, 20, 21, 0, 0, 0).getTime();
const game = (key, startMin, endMin = null) => ({ key, startedAtMs: base + startMin * MIN, finishedAtMs: endMin == null ? null : base + endMin * MIN });
const fx = (id, time, extra = {}) => ({ id, date: '2026-11-20', time, competition: 'liga', roundLabel: 'Fecha 1', status: 'scheduled', order: Number(id.slice(-1)), ...extra });

describe('matchTimingModel', () => {
  it('uses defaults until there are three real games', () => {
    expect(matchTimingModel([game('a', 0, 14)])).toMatchObject({ matchMs: 15 * MIN, breakMs: 5 * MIN, fromHistory: false });
  });

  it('takes the median length and break, ignoring tests and runaway records', () => {
    const history = [game('a', 0, 12), game('b', 16, 28), game('c', 30, 44), game('d', 50, 52), game('e', 100, 230)];
    const model = matchTimingModel(history);
    expect(model.fromHistory).toBe(true);
    expect(model.matchMs).toBe(12 * MIN);
    // Only two breaks between the valid games: the 5-minute default stays.
    expect(model.breakMs).toBe(5 * MIN);
  });
});

describe('estimateKickoffs', () => {
  const now = base + 5 * MIN;
  const model = { matchMs: 15 * MIN, breakMs: 5 * MIN };

  it('chains the pending matches of the round after the one being played', () => {
    const fixtures = [fx('f1', '21:00', { status: 'live', liveMatchKey: 'k1' }), fx('f2', '21:00'), fx('f3', '21:00')];
    const eta = estimateKickoffs(fixtures, [game('k1', 0)], { now, model });
    expect(eta.get('f2')).toBe(base + 20 * MIN);
    expect(eta.get('f3')).toBe(base + 40 * MIN);
  });

  it('uses the real end of a finished game and skips estimates within five minutes of the schedule', () => {
    const fixtures = [fx('f1', '21:00', { status: 'played', liveMatchKey: 'k1' }), fx('f2', '21:20'), fx('f3', '21:30')];
    const eta = estimateKickoffs(fixtures, [game('k1', 0, 14)], { now: base + 15 * MIN, model });
    expect(eta.has('f2')).toBe(false);
    expect(eta.get('f3')).toBe(base + 39 * MIN);
  });

  it('says nothing before the round starts or for a game from another night', () => {
    expect(estimateKickoffs([fx('f1', '21:00'), fx('f2', '21:30')], [], { now, model }).size).toBe(0);
    const old = [fx('f1', '21:00', { status: 'finished', liveMatchKey: 'k1' }), fx('f2', '21:30')];
    expect(estimateKickoffs(old, [game('k1', 0, 14)], { now: base + 24 * 60 * MIN, model }).size).toBe(0);
  });

  it('only estimates the round in play', () => {
    const fixtures = [fx('f1', '21:00', { status: 'live', liveMatchKey: 'k1' }), fx('g1', '21:30', { roundLabel: 'Fecha 2' })];
    expect(estimateKickoffs(fixtures, [game('k1', 0)], { now, model }).size).toBe(0);
  });
});

it('reads the scheduled time and formats the estimate', () => {
  expect(scheduledMs(fx('f1', '21:00'))).toBe(base);
  expect(scheduledMs({ date: '2026-11-20' })).toBeNull();
  expect(formatEta(base + 48 * MIN)).toBe('aprox. 21:48');
});
