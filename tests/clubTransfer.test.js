// «Cambiar manager» (supabase/functions/_shared/market.js transferClub) against an in-memory Firestore that follows
// the transaction API of firestoreRest.js (get, query with == filters, create/set/update/delete, all-or-nothing
// commit). Synthetic: it proves the logic, not Firestore itself; tests/rules/marketFunction.test.js runs the same
// action on the emulator.
import { describe, it, expect, beforeEach } from 'vitest';
import { handleMarketAction, MarketError } from '../supabase/functions/_shared/market.js';

const APP = 'scl-test';
const base = `artifacts/${APP}`;

function memoryFirestore(initial = {}) {
  const docs = new Map(Object.entries(initial).map(([path, data]) => [path, structuredClone(data)]));
  const parentOf = path => path.split('/').slice(0, -1).join('/');
  const snap = path => (docs.has(path) ? { id: path.split('/').pop(), path, data: structuredClone(docs.get(path)) } : null);
  return {
    docs,
    async runTransaction(fn) {
      const writes = [];
      const tx = {
        writes,
        async get(path) { return snap(path); },
        async query(collection, filters = []) {
          return [...docs.keys()]
            .filter(path => parentOf(path) === collection)
            .filter(path => filters.every(([field, op, value]) => op === '==' && docs.get(path)[field] === value))
            .map(snap);
        },
        create(path, data) { writes.push(['create', path, data]); },
        set(path, data) { writes.push(['set', path, data]); },
        update(path, data) { writes.push(['update', path, data]); },
        delete(path) { writes.push(['delete', path]); },
      };
      const result = await fn(tx);
      // Commit: every precondition first, so a failure leaves nothing applied.
      for (const [op, path] of writes) {
        if (op === 'create' && docs.has(path)) throw new Error(`exists: ${path}`);
        if (op === 'update' && !docs.has(path)) throw new Error(`missing: ${path}`);
      }
      for (const [op, path, data] of writes) {
        if (op === 'delete') docs.delete(path);
        else if (op === 'update') docs.set(path, { ...docs.get(path), ...structuredClone(data) });
        else docs.set(path, structuredClone(data));
      }
      return result;
    },
  };
}

const team = uid => `${base}/public/data/teams/${uid}`;
const profile = uid => `${base}/users/${uid}/profile/data`;
const admin = { uid: 'admin', isAdmin: true };

let db;
const transfer = (body, user = admin) => handleMarketAction({
  firestore: db, appId: APP, catalog: {}, user, body: { action: 'transferClub', ...body },
});

beforeEach(() => {
  db = memoryFirestore({
    // The club: approved, with history everywhere.
    [team('old')]: { teamName: 'Sendai Ryuden', userId: 'old', budget: 150000000, logoUrl: 'crest.webp' },
    [profile('old')]: { teamName: 'Sendai Ryuden', userId: 'old', budget: 150000000, formation: '4-4-2', lineup: { 1: 7511 }, email: 'viejo@gmail.com', providers: ['google.com'] },
    [`${base}/public/data/player_locks/7511`]: { lockedBy: 'old', teamName: 'Sendai Ryuden' },
    [`${base}/public/data/player_locks/8000`]: { lockedBy: 'old', teamName: 'Sendai Ryuden' },
    [`${base}/public/data/player_locks/9000`]: { lockedBy: 'rival', teamName: 'Rival' },
    [`${base}/users/old/cart/7511`]: { Id: 7511 },
    [`${base}/users/old/saved_filters/f1`]: { name: 'Rápidos' },
    [`${base}/users/old/scout_searches/s1`]: { query: 'DC' },
    [`${base}/public/data/offers/o1`]: { senderId: 'rival', targetTeamId: 'old', status: 'pending' },
    [`${base}/public/data/offers/o2`]: { senderId: 'old', targetTeamId: 'rival', status: 'pending' },
    [`${base}/public/data/transfers/t1`]: { teamId: 'old', type: 'signing' },
    [`${base}/public/data/transfers/t2`]: { teamId: 'rival', fromTeamId: 'old', type: 'transfer' },
    [`${base}/public/data/league_content/club-old`]: { body: 'Fundado en 2024.', profile: { manager: 'Fefo', stadium: 'Sendai' } },
    [`${base}/public/data/broadcast/overlay`]: { homeTeamId: 'old', awayTeamId: 'rival' },
    [`${base}/public/data/shared_formations/sf1`]: { createdBy: 'old', teamName: 'Sendai Ryuden' },
    [`${base}/pes_workspaces/ws1`]: { draftMap: { old: 101, rival: 102 }, draftCoaches: { old: { name: 'DT' } } },
    [`${base}/public/data/manager_chat/m1`]: { userId: 'old', text: 'hola' },
    // The new manager: just signed in, pending and empty.
    [team('new')]: { teamName: 'Equipo new12', userId: 'new', approved: false, budget: 200000000 },
    [profile('new')]: { teamName: 'Equipo new12', userId: 'new', providers: ['google.com'], email: 'nuevo@gmail.com' },
    // An approved club, to try as a wrong target.
    [team('rival')]: { teamName: 'Rival', userId: 'rival', budget: 1 },
    [profile('rival')]: { teamName: 'Rival', userId: 'rival' },
  });
});

describe('transferClub («Cambiar manager»)', () => {
  it('moves the whole club to the pending account in one go', async () => {
    const result = await transfer({ fromUid: 'old', toUid: 'new', managerName: '  Juan  ' });
    expect(result).toMatchObject({ teamName: 'Sendai Ryuden', players: 2, offers: 2, transfers: 2, clubPage: true, overlay: true, formations: 1, pesWorkspaces: 1 });

    const d = path => db.docs.get(path);
    expect(d(team('new'))).toMatchObject({ teamName: 'Sendai Ryuden', userId: 'new', budget: 150000000, logoUrl: 'crest.webp' });
    expect(d(team('new')).approved).toBeUndefined();
    expect(d(team('old'))).toBeUndefined();
    expect(d(`${base}/public/data/player_locks/7511`).lockedBy).toBe('new');
    expect(d(`${base}/public/data/player_locks/9000`).lockedBy).toBe('rival');
    expect(d(`${base}/users/new/cart/7511`)).toEqual({ Id: 7511 });
    expect(d(`${base}/users/old/cart/7511`)).toBeUndefined();
    expect(d(`${base}/users/new/saved_filters/f1`)).toEqual({ name: 'Rápidos' });
    expect(d(`${base}/users/new/scout_searches/s1`)).toEqual({ query: 'DC' });
    expect(d(`${base}/public/data/offers/o1`).targetTeamId).toBe('new');
    expect(d(`${base}/public/data/offers/o2`).senderId).toBe('new');
    expect(d(`${base}/public/data/transfers/t1`).teamId).toBe('new');
    expect(d(`${base}/public/data/transfers/t2`).fromTeamId).toBe('new');
    expect(d(`${base}/public/data/league_content/club-new`)).toMatchObject({ body: 'Fundado en 2024.', profile: { manager: 'Juan', stadium: 'Sendai' }, updatedBy: 'admin' });
    expect(d(`${base}/public/data/league_content/club-old`)).toBeUndefined();
    expect(d(`${base}/public/data/broadcast/overlay`)).toEqual({ homeTeamId: 'new', awayTeamId: 'rival' });
    expect(d(`${base}/public/data/shared_formations/sf1`).createdBy).toBe('new');
    expect(d(`${base}/pes_workspaces/ws1`)).toEqual({ draftMap: { new: 101, rival: 102 }, draftCoaches: { new: { name: 'DT' } } });
  });

  it('keeps what is personal: the new account does not inherit a role, email or sign-in methods', async () => {
    db.docs.set(profile('old'), { ...db.docs.get(profile('old')), role: 'kit-helper' });
    await transfer({ fromUid: 'old', toUid: 'new' });
    const moved = db.docs.get(profile('new'));
    expect(moved).toMatchObject({ teamName: 'Sendai Ryuden', formation: '4-4-2', lineup: { 1: 7511 }, email: 'nuevo@gmail.com', providers: ['google.com'], clubTransferredFrom: 'old' });
    expect(moved.role).toBeUndefined();
    expect(db.docs.get(profile('old'))).toMatchObject({ clubTransferredTo: 'new', email: 'viejo@gmail.com' });
    // Chat messages stay with the old manager.
    expect(db.docs.get(`${base}/public/data/manager_chat/m1`).userId).toBe('old');
  });

  it('keeps the club card manager when no new name is given', async () => {
    await transfer({ fromUid: 'old', toUid: 'new' });
    expect(db.docs.get(`${base}/public/data/league_content/club-new`).profile.manager).toBe('Fefo');
  });

  it('refuses anyone but the admin, before reading anything', async () => {
    const before = new Map(db.docs);
    await expect(transfer({ fromUid: 'old', toUid: 'new' }, { uid: 'new', isAdmin: false }))
      .rejects.toSatisfy(e => e instanceof MarketError && e.status === 403);
    expect(db.docs).toEqual(before);
  });

  it('refuses a target that is approved, has players or offers, or does not exist, and changes nothing', async () => {
    const before = new Map(db.docs);
    const refuse = (body, message) => expect(transfer(body)).rejects.toSatisfy(e => e instanceof MarketError && message.test(e.message));
    await refuse({ fromUid: 'old', toUid: 'rival' }, /pendiente/);
    await refuse({ fromUid: 'old', toUid: 'ghost' }, /entrar primero/);
    await refuse({ fromUid: 'old', toUid: 'old' }, /distintos/);
    await refuse({ fromUid: '../x', toUid: 'new' }, /distintos/);
    expect(db.docs).toEqual(before);

    db.docs.set(`${base}/public/data/player_locks/9100`, { lockedBy: 'new' });
    await refuse({ fromUid: 'old', toUid: 'new' }, /vacía/);
    db.docs.delete(`${base}/public/data/player_locks/9100`);
    db.docs.set(`${base}/public/data/offers/o3`, { senderId: 'new', targetTeamId: 'rival', status: 'pending' });
    await refuse({ fromUid: 'old', toUid: 'new' }, /vacía/);
  });

  it('refuses to move the club of an admin account, which would lock the admin out', async () => {
    const refuse = message => expect(transfer({ fromUid: 'old', toUid: 'new' })).rejects.toSatisfy(e => e instanceof MarketError && message.test(e.message));
    db.docs.set(profile('old'), { ...db.docs.get(profile('old')), isAdmin: true });
    await refuse(/administrador/);
    db.docs.set(profile('old'), { ...db.docs.get(profile('old')), isAdmin: false, role: 'admin' });
    await refuse(/administrador/);
    expect(db.docs.get(team('old'))).toBeDefined();
  });

  it('cannot move the same club twice', async () => {
    await transfer({ fromUid: 'old', toUid: 'new' });
    await expect(transfer({ fromUid: 'old', toUid: 'new' })).rejects.toSatisfy(e => e instanceof MarketError && /ya pasó/.test(e.message));
  });

  it('cuts the new manager name to the club card limit', async () => {
    await transfer({ fromUid: 'old', toUid: 'new', managerName: 'x'.repeat(200) });
    expect(db.docs.get(`${base}/public/data/league_content/club-new`).profile.manager).toHaveLength(80);
  });
});
