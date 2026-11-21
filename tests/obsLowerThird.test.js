// Synthetic fixtures: the lower third the OBS match scenes write on their own.
import { nextFixture, nextLine, sceneLowerThird } from '../utils/obsLowerThird.js';

const fx = (id, home, away, extra = {}) => ({ id, home: { name: home }, away: { name: away }, competition: 'liga', competitionLabel: 'Liga', roundLabel: 'Fecha 4', status: 'scheduled', date: '2026-11-21', time: '21:30', ...extra });

describe('nextFixture', () => {
  it('picks the earliest pending match of the round on air, by estimate or schedule', () => {
    const fixtures = [fx('a', 'A', 'B', { status: 'live' }), fx('b', 'C', 'D', { time: '22:30' }), fx('c', 'E', 'F', { time: '22:00' }), fx('d', 'G', 'H', { roundLabel: 'Fecha 5', time: '20:00' })];
    expect(nextFixture(fixtures, 'a').id).toBe('c');
    expect(nextFixture([fx('a', 'A', 'B', { status: 'finished' }), fx('b', 'C', 'D', { etaMs: 1 }), fx('c', 'E', 'F')], 'a').id).toBe('b');
    expect(nextFixture([fx('a', 'A', 'B', { status: 'finished' })], 'a')).toBeNull();
  });
});

describe('sceneLowerThird', () => {
  const scorers = { home: [{ name: 'Saka', minute: "61'", tag: 'p.' }], away: [] };
  it('writes previa, half time and final, and hands the final over to the next match', () => {
    expect(sceneLowerThird({ scene: 'previa', home: 'A', away: 'B', fixture: fx('a', 'A', 'B') })).toEqual({ headline: 'Previa: A vs B', subheadline: 'Liga · Fecha 4 · sáb 21/11 · 21:30' });
    expect(sceneLowerThird({ scene: 'descanso', home: 'A', away: 'B', score: { home: 1, away: 0 }, scorers }).headline).toBe('Entretiempo: A 1-0 B');
    expect(sceneLowerThird({ scene: 'final', home: 'A', away: 'B', score: { home: 2, away: 1 }, scorers }).subheadline).toBe("Saka 61' p.");
    const next = fx('c', 'E', 'F');
    expect(sceneLowerThird({ scene: 'final', home: 'A', away: 'B', score: { home: 2, away: 1 }, next })).toEqual({ headline: 'Siguiente partido: E vs F', subheadline: 'sáb 21/11 · 21:30 · Final: A 2-1 B' });
    expect(sceneLowerThird({ scene: 'goleadores', home: 'A', away: 'B' })).toBeNull();
    expect(nextLine(next)).toBe('E vs F · sáb 21/11 · 21:30');
  });
});
