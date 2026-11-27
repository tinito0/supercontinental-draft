// saveLineup and squadCompliance of the market Edge Function (supabase/functions/_shared/lineup.js) with an
// in-memory transaction and synthetic squads. The emulator version is tests/rules/lineupFunction.test.js.
import { describe, it, expect } from 'vitest';
import { handleLineupAction, parseLineup, parseBoardFields, LINEUP_ACTIONS } from '../supabase/functions/_shared/lineup.js';
import { MarketError } from '../supabase/functions/_shared/market.js';

const APP = 'app';
const base = `artifacts/${APP}`;
// 21 players: ids 1..11 at 85 (the XI), 12..21 at the bench OVR given.
const catalogFor = benchOvr => Object.fromEntries(
  Array.from({ length: 21 }, (_, i) => [String(i + 1), [1, 25, i < 11 ? 85 : benchOvr, `P${i + 1}`, 'MC', 9]]),
);
const eleven = Object.fromEntries(Array.from({ length: 11 }, (_, slot) => [String(slot), String(slot + 1)]));

function fakeFirestore(docs) {
  const writes = [];
  const tx = {
    async get(path) { return docs[path] ? { id: path.split('/').pop(), path, data: docs[path] } : null; },
    async query(collection, filters = []) {
      return Object.entries(docs)
        .filter(([path]) => path.startsWith(`${collection}/`) && !path.slice(collection.length + 1).includes('/'))
        .map(([path, data]) => ({ id: path.split('/').pop(), path, data }))
        .filter(row => filters.every(([field, , value]) => row.data[field] === value));
    },
    set(path, data, options) { writes.push({ path, data, options }); },
  };
  return { writes, runTransaction: fn => fn(tx) };
}

function seed({ benchMin } = {}) {
  const docs = {
    [`${base}/public/data/teams/u1`]: { teamName: 'U1' },
    [`${base}/public/data/teams/u2`]: { teamName: 'U2', country: 9 },
  };
  for (let id = 1; id <= 21; id++) docs[`${base}/public/data/player_locks/${id}`] = { lockedBy: 'u1' };
  if (benchMin !== undefined) docs[`${base}/public/data/config/squadRules`] = { benchMinAvgOvr: benchMin };
  return docs;
}

const run = (firestore, catalog, body, user = { uid: 'u1', isAdmin: false }) =>
  handleLineupAction({ firestore, appId: APP, catalog, user, body });
const rejects = (promise, code) => expect(promise).rejects.toSatisfy(e => e instanceof MarketError && e.code === code);

describe('saveLineup', () => {
  it('writes lineup, board fields and the computed bench to the profile and the public team, whole', async () => {
    const firestore = fakeFirestore(seed());
    const result = await run(firestore, catalogFor(75), { action: 'saveLineup', lineup: eleven, formation: '4-3-3', dorsals: { 1: '9' } });
    expect(result.bench).toMatchObject({ applies: true, average: 75, min: 73, benchCount: 10 });
    expect(result.saved.matchBench).toEqual(['12', '13', '14', '15', '16', '17', '18', '19', '20', '21']);
    expect(firestore.writes.map(w => w.path)).toEqual([`${base}/users/u1/profile/data`, `${base}/public/data/teams/u1`]);
    firestore.writes.forEach(w => {
      expect(w.data).toEqual(result.saved);
      expect(w.options.mask.sort()).toEqual(['dorsals', 'formation', 'lineup', 'matchBench']);
    });
  });

  it('refuses a bench under the minimum read from config/squadRules, with average and min', async () => {
    const firestore = fakeFirestore(seed({ benchMin: 76 }));
    const error = await run(firestore, catalogFor(75), { action: 'saveLineup', lineup: eleven }).catch(e => e);
    expect(error).toMatchObject({ code: 'bench-below-minimum', status: 409, details: { average: 75, min: 76, benchCount: 10 } });
    expect(firestore.writes).toEqual([]);
  });

  it('uses the default 73 when the config is missing or unusable', async () => {
    await rejects(run(fakeFirestore(seed()), catalogFor(72), { action: 'saveLineup', lineup: eleven }), 'bench-below-minimum');
    await rejects(run(fakeFirestore(seed({ benchMin: 'x' })), catalogFor(72), { action: 'saveLineup', lineup: eleven }), 'bench-below-minimum');
  });

  it('counts a locked player missing from the catalog toward the 21, like the app', async () => {
    const catalog = catalogFor(60);
    delete catalog['21'];
    await rejects(run(fakeFirestore(seed()), catalog, { action: 'saveLineup', lineup: eleven }), 'bench-below-minimum');
  });

  it('does not measure the bench without a full XI (the draft is still being built)', async () => {
    const ten = Object.fromEntries(Object.entries(eleven).slice(0, 10));
    const result = await run(fakeFirestore(seed()), catalogFor(60), { action: 'saveLineup', lineup: ten });
    expect(result.bench.applies).toBe(false);
  });

  it('drops starters the club does not own, so they cannot hide a weak bench', async () => {
    const firestore = fakeFirestore(seed());
    const lineup = { ...eleven, 10: '999' };
    const result = await run(firestore, { ...catalogFor(60), 999: [1, 25, 99, 'X', 'DC', 9] }, { action: 'saveLineup', lineup });
    expect(result.dropped).toEqual(['999']);
    expect(result.saved.lineup['10']).toBeUndefined();
    expect(result.bench.applies).toBe(false);
  });

  it("only an admin saves another club's lineup", async () => {
    const body = { action: 'saveLineup', teamId: 'u1', lineup: {} };
    await rejects(run(fakeFirestore(seed()), catalogFor(75), body, { uid: 'u2', isAdmin: false }), 'forbidden');
    await expect(run(fakeFirestore(seed()), catalogFor(75), body, { uid: 'admin', isAdmin: true })).resolves.toMatchObject({ teamId: 'u1' });
    await rejects(run(fakeFirestore(seed()), catalogFor(75), { action: 'saveLineup', lineup: {} }, { uid: 'ghost' }), 'team-not-found');
  });

  it('refuses malformed lineups, duplicated starters and fields outside the board', () => {
    expect(() => parseLineup(null)).toThrow(MarketError);
    expect(() => parseLineup({ 11: '1' })).toThrow(/inválida/);
    expect(() => parseLineup({ 0: 'abc' })).toThrow(/inválida/);
    expect(() => parseLineup({ 0: '1', 1: '1' })).toThrow(/dos veces/);
    expect(parseLineup({ 0: 7, 1: '8' })).toEqual({ 0: '7', 1: '8' });
    expect(() => parseBoardFields({ lineup: {}, matchBench: [] })).toThrow(/no permitido/);
    expect(() => parseBoardFields({ lineup: {}, budget: 1 })).toThrow(/no permitido/);
    expect(() => parseBoardFields({ lineup: {}, dorsals: [] })).toThrow(/inválido/);
    expect(parseBoardFields({ action: 'saveLineup', lineup: {}, formationStates: null, formation: '4-4-2' })).toEqual({ formationStates: null, formation: '4-4-2' });
  });

  it('refuses an oversized request', async () => {
    const body = { action: 'saveLineup', lineup: {}, tactics: { note: 'x'.repeat(100_001) } };
    await rejects(run(fakeFirestore(seed()), catalogFor(75), body), 'lineup-invalid');
  });
});

describe('squadCompliance', () => {
  it('is admin only and lists each approved club with the three rules', async () => {
    expect(LINEUP_ACTIONS.has('squadCompliance')).toBe(true);
    await rejects(run(fakeFirestore(seed()), catalogFor(75), { action: 'squadCompliance' }), 'forbidden');
    const result = await run(fakeFirestore(seed({ benchMin: 74 })), catalogFor(75), { action: 'squadCompliance' }, { uid: 'a', isAdmin: true });
    expect(result.benchMin).toBe(74);
    expect(result.teams.map(t => [t.teamId, t.ok])).toEqual([['u1', false], ['u2', false]]);
    expect(result.teams[0].rules.find(r => r.id === 'squad')).toMatchObject({ ok: true, value: '21' });
  });
});
