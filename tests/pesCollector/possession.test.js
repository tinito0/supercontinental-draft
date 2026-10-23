// Posesión desde los eventos `possession` del probe (pes-collector/collector/possession.js). Eventos sintéticos con
// los valores reales de las grabaciones del 21 y 22/10 (docs/PES_MATCH_DATA_RESEARCH.md, S9).
import { buildPossession } from '../../pes-collector/collector/possession.js';

const poss = (c, home, away, time) => ({ t: 'possession', c, home, away, ...(time != null ? { time } : {}) });

describe('buildPossession', () => {
  it('gives the screen\'s numbers: home truncated, away the rest (Arsenal 6536 / Real 7553 → 46 / 54)', () => {
    const events = [poss([1, 0, 18], 54, 0), poss([2, 76, 53], 6536, 7553)];
    expect(buildPossession(events)).toEqual({ home: 46, away: 54, counters: { home: 6536, away: 7553 } });
    expect(buildPossession([poss([3, 90, 0], 8680, 8468)])).toMatchObject({ home: 50, away: 50 });
  });

  it('is unknown, not 0 %, when the game never filled the counters', () => {
    expect(buildPossession([poss([1, 0, 58], 0, 0)])).toBeNull();
    expect(buildPossession([{ t: 'state', c: [1, 10, 0] }])).toBeNull();
    expect(buildPossession([])).toBeNull();
  });

  it('leaves out the penalty shootout, where the counters keep running', () => {
    const events = [
      poss([4, 105, 27], 11101, 9194),
      poss([5, 120, 0], 12773, 10163),
      poss([5, 120, 0], 13173, 10605),
      poss([4, 120, 0], 13180, 10610), // the clock goes back to 120:00 after the shootout
    ];
    expect(buildPossession(events)).toMatchObject({ home: 54, counters: { home: 11101, away: 9194 } });
    expect(buildPossession([poss([2, 88, 10], 8000, 8000), poss([5, 90, 0], 9000, 8000)])).toMatchObject({ home: 50 });
  });

  it('keeps an in-play penalty (period 5 with the clock of the foul)', () => {
    expect(buildPossession([poss([5, 35, 5], 2834, 3441)])).toMatchObject({ home: 45, away: 55 });
  });

  it('trusts the counters only when they add up to the match time (probe v4 sends it)', () => {
    expect(buildPossession([poss([2, 76, 53], 6536, 7553, 14089)])).toMatchObject({ home: 46 });
    expect(buildPossession([poss([2, 76, 53], 6536, 7553, 20000)])).toBeNull();
  });
});
