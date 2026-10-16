// Exit animations and the leaving-item bookkeeping behind ToastStack. Fake animation objects, no DOM.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { waitForExit, mergeWithLeaving, findRemoved, EXIT_TIMEOUT_MS } from '../utils/motion.js';

const animation = ({ finished = Promise.resolve(), endTime = 120 } = {}) => ({
  finished,
  effect: { getComputedTiming: () => ({ endTime }) },
});
const element = animations => ({ getAnimations: () => animations });
const never = () => new Promise(() => {});

afterEach(() => vi.useRealTimers());

describe('waitForExit', () => {
  it('resolves at once when nothing animates (reduced motion, or no element)', async () => {
    await expect(waitForExit(element([]))).resolves.toBeUndefined();
    await expect(waitForExit(null)).resolves.toBeUndefined();
  });

  it('waits for the exit animation to finish', async () => {
    let finish;
    const finished = new Promise(resolve => { finish = resolve; });
    let done = false;
    const wait = waitForExit(element([animation({ finished })])).then(() => { done = true; });
    await Promise.resolve();
    expect(done).toBe(false);
    finish();
    await wait;
    expect(done).toBe(true);
  });

  it('gives up after the timeout when an animation never reports done', async () => {
    vi.useFakeTimers();
    let done = false;
    const wait = waitForExit(element([animation({ finished: never() })])).then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(EXIT_TIMEOUT_MS - 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await wait;
    expect(done).toBe(true);
  });

  it('ignores infinite animations, such as a spinner inside a toast', async () => {
    await expect(waitForExit(element([animation({ finished: never(), endTime: Infinity })]))).resolves.toBeUndefined();
  });
});

describe('leaving items', () => {
  const a = { key: 'a' };
  const b = { key: 'b' };
  const c = { key: 'c' };

  it('finds removed items with the index they had', () => {
    expect(findRemoved([a, b, c], [a, c])).toEqual([{ key: 'b', index: 1 }]);
    expect(findRemoved([a], [a, b])).toEqual([]);
  });

  it('keeps a leaving item where it was, flagged, until it is dropped', () => {
    const merged = mergeWithLeaving([a, c], [{ key: 'b', index: 1 }]);
    expect(merged.map(item => [item.key, item.leaving])).toEqual([['a', false], ['b', true], ['c', false]]);
  });

  it('shows an item that came back as current, not leaving', () => {
    expect(mergeWithLeaving([a, b], [{ key: 'b', index: 1 }]).map(item => item.leaving)).toEqual([false, false]);
  });

  it('puts leaving items past the end at the end', () => {
    expect(mergeWithLeaving([], [{ key: 'b', index: 3 }]).map(item => item.key)).toEqual(['b']);
  });
});
