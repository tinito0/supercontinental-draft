import { nextRadioIndex, resultStatus, splitSearches } from '../utils/scoutView.js';

describe('nextRadioIndex', () => {
  it('moves and wraps with arrows', () => {
    expect(nextRadioIndex('ArrowRight', 0, 3)).toBe(1);
    expect(nextRadioIndex('ArrowDown', 2, 3)).toBe(0);
    expect(nextRadioIndex('ArrowLeft', 0, 3)).toBe(2);
    expect(nextRadioIndex('ArrowUp', 1, 3)).toBe(0);
  });
  it('jumps with Home and End', () => {
    expect(nextRadioIndex('Home', 2, 4)).toBe(0);
    expect(nextRadioIndex('End', 0, 4)).toBe(3);
  });
  it('ignores other keys', () => {
    expect(nextRadioIndex('a', 0, 3)).toBe(-1);
  });
  it('skips disabled options and reports none when all are disabled', () => {
    expect(nextRadioIndex('ArrowRight', 0, 3, i => i === 1)).toBe(2);
    expect(nextRadioIndex('ArrowRight', 0, 3, () => true)).toBe(-1);
  });
});

describe('resultStatus', () => {
  const prices = new Map([['7', 2500000]]);
  it('flags a locked player and uses the current price', () => {
    const status = resultStatus({ Id: 7, Precio: 1000000 }, { 7: { lockedBy: 'u2' } }, 'u1', prices);
    expect(status).toEqual({ price: 2500000, signed: true, signedByMe: false });
  });
  it('knows when the lock is mine', () => {
    expect(resultStatus({ Id: 7 }, { 7: { lockedBy: 'u1' } }, 'u1', prices).signedByMe).toBe(true);
  });
  it('falls back to the stored price and free state', () => {
    expect(resultStatus({ Id: 9, Precio: 400000 }, {}, 'u1', prices)).toEqual({ price: 400000, signed: false, signedByMe: false });
  });
});

describe('splitSearches', () => {
  const list = [
    { id: 'a', status: 'searching' },
    { id: 'b', status: 'done' },
    { id: 'c', status: 'done' },
    { id: 'd', status: 'done' },
  ];
  it('keeps every search in progress and cuts finished ones', () => {
    const { visible, hiddenCount } = splitSearches(list, 2);
    expect(visible.map(s => s.id)).toEqual(['a', 'b', 'c']);
    expect(hiddenCount).toBe(1);
  });
  it('shows everything on request', () => {
    expect(splitSearches(list, 2, true)).toEqual({ visible: list, hiddenCount: 0 });
  });
});
