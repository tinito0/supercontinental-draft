// Guard against Firestore listeners that never answer (offline, empty cache): hooks/useLeagueData.js. Synthetic snapshots.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../config/firebaseCore.js', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), doc: vi.fn(), limit: vi.fn(), onSnapshot: vi.fn(), orderBy: vi.fn(), query: vi.fn(), where: vi.fn(),
}));

import { listenWithOfflineGuard, OFFLINE_TIMEOUT_MS, OFFLINE_MESSAGE } from '../hooks/useLeagueData.js';

const serverSnap = { empty: false, metadata: { fromCache: false } };
const emptyCacheSnap = { empty: true, metadata: { fromCache: true } };

function setup() {
  let push;
  let fail;
  const unsubscribe = vi.fn();
  const handlers = { onData: vi.fn(), onError: vi.fn(), onOffline: vi.fn() };
  const stop = listenWithOfflineGuard((next, error) => { push = next; fail = error; return unsubscribe; }, handlers);
  return { handlers, unsubscribe, stop, push: snap => push(snap), fail: err => fail(err) };
}

describe('listenWithOfflineGuard', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('exports a 10 s timeout and the neutral offline message', () => {
    expect(OFFLINE_TIMEOUT_MS).toBe(10000);
    expect(OFFLINE_MESSAGE).toBe('No hay conexión. Los datos aparecen apenas vuelva.');
  });

  it('reports offline when nothing answers in time', () => {
    const { handlers } = setup();
    vi.advanceTimersByTime(OFFLINE_TIMEOUT_MS - 1);
    expect(handlers.onOffline).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(handlers.onOffline).toHaveBeenCalledTimes(1);
  });

  it('treats an empty snapshot from the cache as unanswered, so it still times out', () => {
    const { handlers, push } = setup();
    push(emptyCacheSnap);
    expect(handlers.onData).not.toHaveBeenCalled();
    vi.advanceTimersByTime(OFFLINE_TIMEOUT_MS);
    expect(handlers.onOffline).toHaveBeenCalledTimes(1);
  });

  it('passes real data and cancels the timeout', () => {
    const { handlers, push } = setup();
    push(serverSnap);
    vi.advanceTimersByTime(OFFLINE_TIMEOUT_MS * 2);
    expect(handlers.onData).toHaveBeenCalledWith(serverSnap);
    expect(handlers.onOffline).not.toHaveBeenCalled();
  });

  it('still accepts data that arrives after the offline report', () => {
    const { handlers, push } = setup();
    vi.advanceTimersByTime(OFFLINE_TIMEOUT_MS);
    push(serverSnap);
    expect(handlers.onOffline).toHaveBeenCalledTimes(1);
    expect(handlers.onData).toHaveBeenCalledWith(serverSnap);
  });

  it('accepts a non-empty snapshot served from the cache', () => {
    const { handlers, push } = setup();
    const cached = { empty: false, metadata: { fromCache: true } };
    push(cached);
    expect(handlers.onData).toHaveBeenCalledWith(cached);
  });

  it('treats a missing document from the cache as unanswered, and a server one as an answer', () => {
    const { handlers, push } = setup();
    push({ exists: () => false, metadata: { fromCache: true } });
    expect(handlers.onData).not.toHaveBeenCalled();
    push({ exists: () => false, metadata: { fromCache: false } });
    expect(handlers.onData).toHaveBeenCalledTimes(1);
  });

  it('forwards listener errors and cancels the timeout', () => {
    const { handlers, fail } = setup();
    const err = new Error('denied');
    fail(err);
    vi.advanceTimersByTime(OFFLINE_TIMEOUT_MS);
    expect(handlers.onError).toHaveBeenCalledWith(err);
    expect(handlers.onOffline).not.toHaveBeenCalled();
  });

  it('cleans up the timer and the listener', () => {
    const { handlers, unsubscribe, stop } = setup();
    stop();
    vi.advanceTimersByTime(OFFLINE_TIMEOUT_MS);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(handlers.onOffline).not.toHaveBeenCalled();
  });
});

// Firestore only reports the server confirming an empty result it already had from the cache when the listener asks
// for metadata changes; without it the guard waits for an answer that never comes (review of F-07). Source check.
describe('guarded listeners ask for metadata changes', () => {
  it('passes includeMetadataChanges to every listenWithOfflineGuard subscription', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('../hooks/useLeagueData.js', import.meta.url), 'utf8');
    const subscriptions = src.match(/listenWithOfflineGuard\(\s*\(next, error\) => onSnapshot\([^\n]*\n/g) || [];
    expect(subscriptions.length).toBeGreaterThanOrEqual(4);
    for (const line of subscriptions) expect(line).toMatch(/, METADATA, next, error\)/);
    expect(src).toMatch(/const METADATA = \{ includeMetadataChanges: true \}/);
  });
});
