// «Armar el once» (utils/autoLineup.js) with synthetic squads.
import { describe, it, expect } from 'vitest';
import { autoLineup } from '../utils/autoLineup.js';
import { FORMATIONS } from '../utils/constants.js';

const p = (Id, POS_NOMBRE, OVR_CALCULADO) => ({ Id, POS_NOMBRE, OVR_CALCULADO });
const layout = FORMATIONS['4-3-3'].layout;

describe('autoLineup', () => {
  it('puts the best player of each natural position in its slot', () => {
    const squad = [p(1, 'PT', 80), p(2, 'PT', 70), p(3, 'DFC', 82), p(4, 'DFC', 79), p(5, 'DFC', 75), p(6, 'LD', 77), p(7, 'LI', 76)];
    const lineup = autoLineup(layout, squad);
    const ids = layout.map((slot, i) => [slot.pos, lineup[i]]);
    expect(ids.find(([pos]) => pos === 'PT')[1]).toBe('1');
    expect(ids.filter(([pos]) => pos === 'DFC').map(([, id]) => id).sort()).toEqual(['3', '4']);
    expect(ids.find(([pos]) => pos === 'LD')[1]).toBe('6');
  });

  it('falls back to the same line, then any outfield player, but never puts an outfielder in goal', () => {
    const squad = [p(1, 'DFC', 80), p(2, 'MC', 78), p(3, 'DC', 77)];
    const lineup = autoLineup(layout, squad);
    const gkIndex = layout.findIndex(slot => slot.pos === 'PT');
    expect(lineup[gkIndex]).toBeUndefined();
    expect(Object.keys(lineup)).toHaveLength(3);
  });

  it('keeps the starters already placed and does not use them twice', () => {
    const squad = [p(1, 'PT', 80), p(2, 'PT', 85)];
    const gkIndex = layout.findIndex(slot => slot.pos === 'PT');
    const lineup = autoLineup(layout, squad, { [gkIndex]: '1' });
    expect(lineup[gkIndex]).toBe('1');
    expect(Object.values(lineup).filter(id => id === '2')).toHaveLength(0);
  });

  it('fills all eleven slots when the squad is big enough', () => {
    const positions = ['PT', 'LD', 'DFC', 'DFC', 'LI', 'MCD', 'MC', 'MC', 'ED', 'DC', 'EI', 'MO', 'DFC', 'PT'];
    const squad = positions.map((pos, i) => p(i + 1, pos, 70 + i));
    const lineup = autoLineup(layout, squad);
    expect(Object.keys(lineup)).toHaveLength(11);
    expect(new Set(Object.values(lineup)).size).toBe(11);
  });
});
