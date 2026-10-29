import { describe, it, expect } from 'vitest';
import { teamStrength, strengthBarScale, STRENGTH_LINES } from '../utils/teamStrength.js';

describe('teamStrength', () => {
  it('averages the OVR of the starters in each line by the role they play', () => {
    const starters = [
      { pos: 'PT', ovr: 80 },
      { pos: 'DFC', ovr: 70 }, { pos: 'DFC', ovr: 75 }, { pos: 'LI', ovr: 72 }, { pos: 'LD', ovr: 71 },
      { pos: 'MC', ovr: 80 }, { pos: 'MCD', ovr: 78 }, { pos: 'MO', ovr: 85 },
      { pos: 'EI', ovr: 84 }, { pos: 'DC', ovr: 90 }, { pos: 'ED', ovr: 83 },
    ];

    const result = teamStrength(starters);

    expect(result.attack).toBe(86);
    expect(result.midfield).toBe(81);
    expect(result.defense).toBe(72);
    expect(result.keeper).toBe(80);
    expect(result.overall).toBe(79);
    expect(result.count).toBe(11);
  });

  it('returns null for a line with no starters instead of inventing a value', () => {
    const result = teamStrength([{ pos: 'DC', ovr: 88 }]);

    expect(result.attack).toBe(88);
    expect(result.midfield).toBeNull();
    expect(result.defense).toBeNull();
    expect(result.overall).toBe(88);
  });

  it('ignores starters without a usable OVR and unknown roles', () => {
    const result = teamStrength([{ pos: 'DC', ovr: 0 }, { pos: 'MC', ovr: 'x' }, { pos: '??', ovr: 90 }, null]);

    expect(result.attack).toBeNull();
    expect(result.midfield).toBeNull();
    expect(result.overall).toBeNull();
    expect(result.count).toBe(0);
  });

  it('lists the three outfield lines in pitch order, attack first', () => {
    expect(STRENGTH_LINES.map(line => line.key)).toEqual(['attack', 'midfield', 'defense']);
  });
});

describe('strengthBarScale', () => {
  it('maps an OVR to a 0..1 bar length that starts above zero so close lines look different', () => {
    expect(strengthBarScale(null)).toBe(0);
    expect(strengthBarScale(30)).toBe(0);
    expect(strengthBarScale(99)).toBe(1);
    expect(strengthBarScale(120)).toBe(1);
    expect(strengthBarScale(84)).toBeGreaterThan(strengthBarScale(78));
  });
});
