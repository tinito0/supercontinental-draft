import { describe, it, expect } from 'vitest';
import { readSessionHint, writeSessionHint } from '../utils/sessionHint.js';

const memoryStorage = () => {
  const map = new Map();
  return { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k) };
};

describe('session hint (public routes render before Firebase Auth when there was no session)', () => {
  it('waits for Auth (true) when nothing was recorded yet, so users from before the hint existed see no landing flash', () => {
    expect(readSessionHint(memoryStorage())).toBe(true);
  });

  it('tracks login and logout once Auth has answered', () => {
    const storage = memoryStorage();
    writeSessionHint(false, storage);
    expect(readSessionHint(storage)).toBe(false);
    writeSessionHint(true, storage);
    expect(readSessionHint(storage)).toBe(true);
    writeSessionHint(false, storage);
    expect(readSessionHint(storage)).toBe(false);
  });

  it('falls back to waiting for Auth (true) when storage is blocked', () => {
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
    expect(readSessionHint(blocked)).toBe(true);
    expect(() => writeSessionHint(true, blocked)).not.toThrow();
  });
});
