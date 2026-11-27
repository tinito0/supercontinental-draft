// Unit tests for the market Edge Function pieces that need no emulator. The Firestore integration
// tests are in tests/rules/marketFunction.test.js (npm run test:rules).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { generateKeyPair, exportJWK, SignJWT, jwtVerify, createLocalJWKSet } from 'jose';
import * as shared from '../supabase/functions/_shared/marketConstants.js';
import * as constants from '../utils/constants.js';
import { encodeFields, decodeFields } from '../supabase/functions/_shared/firestoreValues.js';
import { verifyFirebaseIdToken } from '../supabase/functions/_shared/googleAuth.js';
import { isMarketOpen, isMarketAdmin, getCatalogPlayer, handleMarketAction, resetFranchise, MarketError } from '../supabase/functions/_shared/market.js';
import { buildMarketCatalog } from '../scripts/build-market-catalog.mjs';

const ROOT = path.resolve(__dirname, '..');

describe('market function: data kept in sync with the app', () => {
  it('constants equal utils/constants.js', () => {
    for (const name of ['APP_ID', 'ADMIN_USER_IDS', 'MAX_TRANSFER_MULTIPLIER', 'TRANSFER_FEE_RATE', 'FRANCHISE_MIN_AGE', 'FRANCHISE_MIN_OVR', 'FRANCHISE_MAX_OVR']) {
      expect(shared[name], name).toEqual(constants[name]);
    }
  });

  it('firestore.rules uses the same default budget', () => {
    const rules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
    expect(Number(rules.match(/function defaultBudget\(\) \{ return (\d+); \}/)?.[1])).toBe(constants.DEFAULT_BUDGET);
  });

  it('catalog.json matches public/jugadores.json (run node scripts/build-market-catalog.mjs)', () => {
    const players = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/jugadores.json'), 'utf8'));
    const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'supabase/functions/_shared/catalog.json'), 'utf8'));
    expect(catalog).toEqual(buildMarketCatalog(players));
  });

  it('drops glitched players, like the marketplace does', () => {
    const glitched = { Id: 1, Precio: '5', Finishing: 80, DefensiveAwareness: 80, Speed: 80, BallControl: 80, LowPass: 80 };
    const normal = { Id: 2, Precio: '7.5', Age: '30', OVR_CALCULADO: '84', Name: 'A', POS_NOMBRE: 'DC', Country1: 9, Finishing: 70 };
    expect(buildMarketCatalog([glitched, normal])).toEqual({ 2: [7.5, 30, 84, 'A', 'DC', 9] });
    expect(getCatalogPlayer({ 2: [7.5, 30, 84, 'A', 'DC', 9] }, '2')).toMatchObject({ Id: 2, Precio: 7.5, OVR_CALCULADO: 84 });
  });
});

describe('Firestore REST values', () => {
  it('round-trips the types the market writes', () => {
    const data = { budget: 199000000, price: 9.35, name: 'X', ok: true, none: null, at: new Date('2026-10-14T00:00:00Z'), roster: [{ Id: '1', available: true }], nested: { a: 1 } };
    expect(encodeFields(data).budget).toEqual({ integerValue: '199000000' });
    expect(encodeFields(data).price).toEqual({ doubleValue: 9.35 });
    expect(decodeFields(encodeFields(data))).toEqual(data);
  });
});

describe('market rules shared with the app', () => {
  const now = new Date('2026-10-14T12:00:00Z');
  it('isMarketOpen mirrors app.jsx', () => {
    expect(isMarketOpen({ status: 'open' }, {}, false, now)).toBe(true);
    expect(isMarketOpen({ status: 'FranchiseMarket' }, {}, false, now)).toBe(true);
    expect(isMarketOpen({ status: 'closed' }, {}, false, now)).toBe(false);
    expect(isMarketOpen({ status: 'closed' }, { inWhitelist: true }, false, now)).toBe(true);
    expect(isMarketOpen({ status: 'closed' }, {}, true, now)).toBe(true);
    expect(isMarketOpen({ status: 'scheduled', openTime: '2026-10-14T11:00:00Z' }, {}, false, now)).toBe(true);
    expect(isMarketOpen({ status: 'scheduled', openTime: '2026-10-14T13:00:00Z' }, {}, false, now)).toBe(false);
    expect(isMarketOpen(null, {}, false, now)).toBe(false);
  });

  it('admins are the hardcoded UIDs or tokens with the admin claim (as in firestore.rules)', () => {
    expect(isMarketAdmin(constants.ADMIN_USER_ID)).toBe(true);
    expect(isMarketAdmin('someone', { admin: true })).toBe(true);
    expect(isMarketAdmin('someone', { admin: 'true' })).toBe(false);
    expect(isMarketAdmin('someone', { pes_role: 'super_admin' })).toBe(true);
    expect(isMarketAdmin('someone', { pes_role: 'kit_manager' })).toBe(false);
    expect(isMarketAdmin('someone', { pes_role: 'draft_admin' })).toBe(false);
  });
});

describe('Firebase ID token verification', () => {
  const projectId = 'demo-scl';
  async function setup() {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
    const keySet = createLocalJWKSet({ keys: [jwk] });
    const token = (claims = {}, { issuer = `https://securetoken.google.com/${projectId}`, audience = projectId, exp = '1h' } = {}) =>
      new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer(issuer).setAudience(audience)
        .setSubject('uid-1').setIssuedAt().setExpirationTime(exp).sign(privateKey);
    return { keySet, token };
  }

  it('returns the uid and claims of a valid token', async () => {
    const { keySet, token } = await setup();
    await expect(verifyFirebaseIdToken(await token({ admin: true }), { projectId, jwtVerify, keySet }))
      .resolves.toMatchObject({ uid: 'uid-1', claims: { admin: true } });
  });

  it('rejects tokens of another project, expired or signed with another key', async () => {
    const { keySet, token } = await setup();
    const other = await setup();
    await expect(verifyFirebaseIdToken(await token({}, { audience: 'other' }), { projectId, jwtVerify, keySet })).rejects.toThrow();
    await expect(verifyFirebaseIdToken(await token({}, { issuer: 'https://evil' }), { projectId, jwtVerify, keySet })).rejects.toThrow();
    await expect(verifyFirebaseIdToken(await token({}, { exp: '-1m' }), { projectId, jwtVerify, keySet })).rejects.toThrow();
    await expect(verifyFirebaseIdToken(await other.token(), { projectId, jwtVerify, keySet })).rejects.toThrow();
  });
});

// resetFranchise (Administración → Equipos → Resetear franquicia) against an in-memory Firestore that follows the
// transaction API of firestoreRest.js (set with `mask` merges only those fields). Synthetic: it proves the logic,
// not Firestore itself.
describe('resetFranchise (admin only)', () => {
  const APP = 'scl-test';
  const base = `artifacts/${APP}`;
  const profile = uid => `${base}/users/${uid}/profile/data`;
  const team = uid => `${base}/public/data/teams/${uid}`;
  const lock = id => `${base}/public/data/player_locks/${id}`;
  const cart = (uid, id) => `${base}/users/${uid}/cart/${id}`;
  const admin = { uid: 'admin', isAdmin: true };

  function memoryFirestore(initial) {
    const docs = new Map(Object.entries(initial).map(([p, d]) => [p, structuredClone(d)]));
    return {
      docs,
      async runTransaction(fn) {
        const writes = [];
        const snap = p => (docs.has(p) ? { id: p.split('/').pop(), path: p, data: structuredClone(docs.get(p)) } : null);
        const tx = {
          async get(p) { return snap(p); },
          async query() { return []; },
          set(p, data, { mask } = {}) { writes.push(['set', p, data, mask]); },
          update(p, data) { writes.push(['update', p, data]); },
          delete(p) { writes.push(['delete', p]); },
        };
        const result = await fn(tx);
        for (const [op, p] of writes) if (op === 'update' && !docs.has(p)) throw new Error(`missing: ${p}`);
        for (const [op, p, data, mask] of writes) {
          if (op === 'delete') docs.delete(p);
          else if (op === 'update' || mask) docs.set(p, { ...(docs.get(p) || {}), ...structuredClone(data) });
          else docs.set(p, structuredClone(data));
        }
        return result;
      },
    };
  }

  const seed = owner => memoryFirestore({
    [profile('club')]: { teamName: 'Club', formation: '4-4-2', franchisePlayerUsed: true, franchisePlayerId: 7511 },
    [team('club')]: { teamName: 'Club', roster: [{ Id: '7511' }, { Id: '8000' }] },
    [lock(7511)]: { lockedBy: owner, teamName: owner, isFranchise: owner === 'club' },
    [cart('club', 7511)]: { Id: 7511 },
  });
  const reset = (db, user = admin, teamId = 'club') => handleMarketAction({
    firestore: db, appId: APP, catalog: {}, user, body: { action: 'resetFranchise', teamId },
  });

  it('frees the lock, cart and roster entry when the club still owns the player', async () => {
    const db = seed('club');
    await expect(reset(db)).resolves.toEqual({ teamId: 'club', playerId: 7511, lock: 'released' });
    expect(db.docs.has(lock(7511))).toBe(false);
    expect(db.docs.has(cart('club', 7511))).toBe(false);
    expect(db.docs.get(team('club')).roster).toEqual([{ Id: '8000' }]);
    expect(db.docs.get(profile('club'))).toEqual({ teamName: 'Club', formation: '4-4-2', franchisePlayerUsed: false, franchisePlayerId: null });
  });

  it('keeps a lock owned by another club and reports otherClub', async () => {
    const db = seed('rival');
    await expect(reset(db)).resolves.toEqual({ teamId: 'club', playerId: 7511, lock: 'otherClub' });
    expect(db.docs.get(lock(7511))).toMatchObject({ lockedBy: 'rival' });
    expect(db.docs.get(team('club')).roster).toHaveLength(2);
    expect(db.docs.get(profile('club'))).toMatchObject({ franchisePlayerUsed: false, franchisePlayerId: null });
  });

  it('only clears the fields when no franchise player is stored, or its lock is gone', async () => {
    const none = memoryFirestore({ [profile('club')]: { franchisePlayerUsed: true } });
    await expect(reset(none)).resolves.toEqual({ teamId: 'club', playerId: null, lock: 'none' });
    expect(none.docs.get(profile('club'))).toEqual({ franchisePlayerUsed: false, franchisePlayerId: null });
    const gone = seed('club');
    gone.docs.delete(lock(7511));
    await expect(reset(gone)).resolves.toMatchObject({ lock: 'missing' });
  });

  it('rejects non-admins, bad ids and unknown clubs without writing', async () => {
    const db = seed('club');
    const before = structuredClone([...db.docs]);
    await expect(reset(db, { uid: 'club', isAdmin: false })).rejects.toMatchObject({ status: 403 });
    await expect(reset(db, admin, '../x')).rejects.toThrow('Club inválido.');
    await expect(reset(db, admin, 'ghost')).rejects.toMatchObject({ status: 404 });
    expect([...db.docs]).toEqual(before);
  });

  it('refuses inside the transaction too, if called without the dispatcher check', async () => {
    const db = seed('club');
    await expect(db.runTransaction(tx => resetFranchise({ tx, appId: APP, user: { uid: 'x' }, teamId: 'club' })))
      .rejects.toBeInstanceOf(MarketError);
  });
});
