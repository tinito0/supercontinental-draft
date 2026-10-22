// Fake fetch and clock: these prove the upload pacing, outbox and retry rules, no network.
import { createUploader } from '../../pes-collector/bridge/uploader.js';
import { hashSummary } from '../../pes-collector/bridge/bridgeCore.js';

const KEY = '20261021T210652Z_101-103';
const match = (status, minute, home = 0) => ({
  status, clock: { period: 1, minute, second: 0 }, score: { home, away: 0 }, match: { homeTeamId: 101, awayTeamId: 103 },
  source: { startedAt: '2026-10-21T21:06:52Z' },
});

function setup({ failTimes = 0, throwTimes = 0, known = {} } = {}) {
  let now = 0;
  let failures = failTimes;
  let throws = throwTimes;
  const calls = [];
  const sentLog = [];
  const logs = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    if (throws > 0) {
      throws -= 1;
      throw new Error('ENOTFOUND');
    }
    if (failures > 0) {
      failures -= 1;
      return { ok: false, status: 503, json: async () => ({ ok: false }) };
    }
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  const uploader = createUploader({
    endpoint: 'https://x.supabase.co/functions/v1/match-feed', token: 't'.repeat(40),
    fetchImpl, now: () => now, log: m => logs.push(m), minIntervalMs: 3000,
    known, onSent: (key, hash) => sentLog.push([key, hash]),
  });
  return { uploader, calls, logs, sentLog, advance: ms => { now += ms; } };
}

describe('createUploader', () => {
  it('sends the match with the bridge token and its file key', async () => {
    const { uploader, calls } = setup();
    await uploader.push(match('live', 10));
    expect(calls).toHaveLength(1);
    expect(calls[0].init.headers.Authorization).toBe(`Bearer ${'t'.repeat(40)}`);
    expect(calls[0].body.matchKey).toBe(KEY);
  });

  it('does not resend an unchanged match', async () => {
    const { uploader, calls, advance } = setup();
    await uploader.push(match('live', 10));
    advance(10000);
    await uploader.push(match('live', 10));
    expect(calls).toHaveLength(1);
  });

  it('paces live updates but sends the newest one once the interval passes', async () => {
    const { uploader, calls, advance } = setup();
    await uploader.push(match('live', 10));
    advance(1000);
    await uploader.push(match('live', 11));
    expect(calls).toHaveLength(1);
    advance(2500);
    await uploader.flush();
    expect(calls.map(c => c.body.summary.clock.minute)).toEqual([10, 11]);
  });

  it('sends goals and the final result at once, without waiting for the interval', async () => {
    const { uploader, calls, advance } = setup();
    await uploader.push(match('live', 10));
    advance(500);
    await uploader.push(match('live', 11, 1));
    advance(500);
    await uploader.push(match('finished', 90, 1));
    expect(calls.map(c => [c.body.summary.status, c.body.summary.score.home])).toEqual([
      ['live', 0], ['live', 1], ['finished', 1],
    ]);
  });

  it('keeps the latest state after a failure and retries it after the backoff', async () => {
    const { uploader, calls, logs, advance } = setup({ failTimes: 1 });
    await uploader.push(match('finished', 90, 2));
    expect(logs.join(' ')).toMatch(/503/);
    advance(5000);
    await uploader.flush();
    expect(calls).toHaveLength(2);
    expect(calls[1].body.summary.status).toBe('finished');
    advance(5000);
    await uploader.flush();
    expect(calls).toHaveLength(2);
  });

  it('does not resend what the outbox says was already uploaded before a restart', async () => {
    const done = match('finished', 90, 2);
    const { uploader, calls } = setup({ known: { [KEY]: hashSummary(done) } });
    await uploader.push(done);
    expect(calls).toHaveLength(0);
  });

  it('reports each upload so the bridge can record it in the outbox', async () => {
    const { uploader, sentLog } = setup();
    await uploader.push(match('finished', 90, 1));
    expect(sentLog).toEqual([[KEY, expect.stringMatching(/^[0-9a-f]{8}$/)]]);
  });

  it('waits with growing backoff after network failures and reports it as offline', async () => {
    const { uploader, calls, advance } = setup({ throwTimes: 2 });
    await uploader.push(match('live', 10));
    expect(uploader.status()).toMatchObject({ queued: 1, lastFailure: { kind: 'offline' } });
    advance(2000);
    await uploader.flush();
    expect(calls).toHaveLength(1);
    advance(1500);
    await uploader.flush();
    expect(calls).toHaveLength(2);
    advance(5000);
    await uploader.flush();
    expect(calls).toHaveLength(2);
    advance(2000);
    await uploader.flush();
    expect(calls).toHaveLength(3);
    expect(uploader.status()).toMatchObject({ queued: 0, lastFailure: null });
  });
});
