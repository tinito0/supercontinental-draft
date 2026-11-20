// Completar la posesión de partidos viejos (utils/possessionBackfill.js). Sintético.
import { possessionPatch } from '../utils/possessionBackfill.js';

const live = possession => ({ summaryJson: JSON.stringify({ possession }) });
const lines = (home = {}, away = {}) => ({ home: { score: 1, ...home }, away: { score: 0, ...away } });

describe('possessionPatch', () => {
  it('copies the possession of the full summary into the compact lines', () => {
    expect(possessionPatch(live({ home: 61, away: 39 }), lines())).toEqual({ 'home.possession': 61, 'away.possession': 39 });
  });

  it('marks a match the game did not count, so it is not read again', () => {
    expect(possessionPatch(live(null), lines())).toEqual({ 'home.possession': null, 'away.possession': null });
    expect(possessionPatch({ summaryJson: '{roto' }, lines())).toEqual({ 'home.possession': null, 'away.possession': null });
  });

  it('leaves alone a match that already has it, or one without both documents', () => {
    expect(possessionPatch(live({ home: 61, away: 39 }), lines({ possession: 50 }, { possession: 50 }))).toBeNull();
    expect(possessionPatch(live({ home: 61, away: 39 }), lines({ possession: null }, { possession: null }))).toBeNull();
    expect(possessionPatch(null, lines())).toBeNull();
    expect(possessionPatch(live({ home: 61, away: 39 }), null)).toBeNull();
  });
});
