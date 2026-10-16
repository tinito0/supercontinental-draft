// The market Edge Function logic (supabase/functions/_shared/market.js) run against the Firestore
// emulator through the same REST client it uses in production. Run with: npm run test:rules
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, collection, updateDoc } from 'firebase/firestore';
import { createFirestore } from '../../supabase/functions/_shared/firestoreRest.js';
import { handleMarketAction, MarketError } from '../../supabase/functions/_shared/market.js';
import { DEFAULT_BUDGET } from '../../utils/constants.js';

const PROJECT = 'demo-scl';
const APP = 'scl-draft-2025';
const base = `artifacts/${APP}`;
const BUDGET = DEFAULT_BUDGET;
// [Precio (M), Age, OVR, Name, POS, Country]
const catalog = {
  7511: [10, 25, 80, 'Delantero', 'DC', 1],
  8000: [50, 31, 85, 'Veterano', 'MC', 2],
  9000: [150, 25, 80, 'Caro', 'DC', 3],
  9100: [60, 25, 80, 'Medio', 'MC', 4],
};

let env;
const firestore = createFirestore({
  projectId: PROJECT,
  baseUrl: `http://${process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'}/v1`,
  getAccessToken: async () => 'owner',
});
const call = (uid, body, { isAdmin = false } = {}) => handleMarketAction({ firestore, appId: APP, catalog, user: { uid, isAdmin }, body });
const sign = (uid, playerId, isFranchise = false) => call(uid, { action: 'sign', playerId, isFranchise });
const accept = (uid, offerId = 'o1') => call(uid, { action: 'acceptOffer', offerId });

async function read(path) {
  let data = null;
  await env.withSecurityRulesDisabled(async ctx => { data = (await getDoc(doc(ctx.firestore(), path))).data() ?? null; });
  return data;
}
async function readAll(path) {
  let rows = [];
  await env.withSecurityRulesDisabled(async ctx => { rows = (await getDocs(collection(ctx.firestore(), path))).docs.map(d => d.data()); });
  return rows;
}
const seed = fn => env.withSecurityRulesDisabled(ctx => fn(ctx.firestore()));
const setMarket = status => seed(db => setDoc(doc(db, `${base}/public/data/config/market`), { status }));
const expectMarketError = (promise, message) => expect(promise).rejects.toSatisfy(e => e instanceof MarketError && message.test(e.message));

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: PROJECT, firestore: { rules: 'rules_version = "2"; service cloud.firestore { match /{d=**} { allow read, write: if false; } }' } });
});
afterAll(async () => { await env?.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await seed(async db => {
    for (const uid of ['seller', 'buyer', 'mallory']) {
      await setDoc(doc(db, `${base}/public/data/teams/${uid}`), { teamName: `Team ${uid}`, userId: uid, budget: BUDGET, roster: [] });
      await setDoc(doc(db, `${base}/users/${uid}/profile/data`), { teamName: `Team ${uid}`, budget: BUDGET });
    }
    await setDoc(doc(db, `${base}/public/data/config/market`), { status: 'open' });
    await setDoc(doc(db, `${base}/public/data/player_locks/7511`), { lockedBy: 'seller', teamName: 'Team seller', isFranchise: false });
    await setDoc(doc(db, `${base}/public/data/teams/seller`), { roster: [{ Id: '7511' }] }, { merge: true });
    await setDoc(doc(db, `${base}/public/data/offers/o1`), { playerId: 7511, senderId: 'buyer', targetTeamId: 'seller', offerAmount: 11000000, status: 'pending', history: [] });
  });
});

describe('sign', () => {
  it('locks the player for the caller, publishes the signing and touches the team', async () => {
    await expect(sign('mallory', 9100)).resolves.toMatchObject({ playerId: 9100, playerName: 'Medio' });
    expect(await read(`${base}/public/data/player_locks/9100`)).toMatchObject({ lockedBy: 'mallory', teamName: 'Team mallory', isFranchise: false });
    const feed = await readAll(`${base}/public/data/transfers`);
    expect(feed).toHaveLength(1);
    expect(feed[0]).toMatchObject({ playerId: 9100, teamId: 'mallory', price: 60, isFranchise: false });
    expect(feed[0].timestamp).toBeTruthy();
    expect((await read(`${base}/public/data/teams/mallory`)).marketUpdatedAt).toBeTruthy();
  });

  it('charges the catalog price against the base budget, signed players and pending offers', async () => {
    await sign('mallory', 9000); // 150 M of 200 M
    await expectMarketError(sign('mallory', 9100), /presupuesto/); // 60 M > 50 M left
    await seed(db => setDoc(doc(db, `${base}/public/data/offers/o9`), { playerId: 1, senderId: 'buyer', targetTeamId: 'x', offerAmount: 150000000, status: 'pending' }));
    await expectMarketError(sign('buyer', 9100), /presupuesto/); // 200 − 150 committed < 60
  });

  it('refuses a player that is already locked, or unknown', async () => {
    await expectMarketError(sign('mallory', 7511), /bloqueado por Team seller/);
    await expectMarketError(sign('seller', 7511), /ya es tuyo/);
    await expect(sign('mallory', 123456)).rejects.toMatchObject({ status: 404 });
  });

  it('respects the market state: closed, whitelist, admin and franchise-only windows', async () => {
    await setMarket('closed');
    await expectMarketError(sign('mallory', 9100), /cerrado/);
    await expect(call('mallory', { action: 'sign', playerId: 9100 }, { isAdmin: true })).resolves.toBeTruthy();
    await seed(db => updateDoc(doc(db, `${base}/public/data/teams/buyer`), { inWhitelist: true }));
    await expect(sign('buyer', 9000)).resolves.toBeTruthy();

    await setMarket('FranchiseMarket');
    await expectMarketError(sign('seller', 8000), /Solo se permiten fichajes de Jugadores Franquicia/);
    await expect(sign('seller', 8000, true)).resolves.toMatchObject({ isFranchise: true });
  });

  it('allows one franchise signing per season, only for eligible players, at no cost', async () => {
    await sign('mallory', 9000); // leaves 50 M, less than the 50 M + franchise player's price
    await expectMarketError(sign('mallory', 9100, true), /requisitos/); // age 25
    await expect(sign('mallory', 8000, true)).resolves.toMatchObject({ isFranchise: true });
    expect(await read(`${base}/users/mallory/profile/data`)).toMatchObject({ franchisePlayerUsed: true, franchisePlayerId: 8000 });
    expect(await read(`${base}/public/data/player_locks/8000`)).toMatchObject({ isFranchise: true });
    await seed(db => setDoc(doc(db, `${base}/public/data/player_locks/8000`), { lockedBy: 'x' }));
    await expectMarketError(sign('mallory', 8000, true), /bloqueado/);
  });

  it('only one of two managers signing the same player at once gets it', async () => {
    const results = await Promise.allSettled([sign('buyer', 9100), sign('mallory', 9100)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const owner = (await read(`${base}/public/data/player_locks/9100`)).lockedBy;
    expect(['buyer', 'mallory']).toContain(owner);
    expect(await readAll(`${base}/public/data/transfers`)).toHaveLength(1);
  });
});

describe('acceptOffer', () => {
  it('the seller accepts: exact budgets, lock, rosters, offer, feed, and other offers closed', async () => {
    await seed(db => setDoc(doc(db, `${base}/public/data/offers/o2`), { playerId: 7511, senderId: 'mallory', targetTeamId: 'seller', offerAmount: 10500000, status: 'pending', history: [] }));
    await expect(accept('seller')).resolves.toMatchObject({ amount: 11000000 });

    expect((await read(`${base}/public/data/teams/buyer`)).budget).toBe(BUDGET + 10000000 - 11000000);
    expect((await read(`${base}/public/data/teams/seller`)).budget).toBe(BUDGET + 9350000 - 10000000);
    expect((await read(`${base}/public/data/teams/buyer`)).roster.map(p => p.Id)).toEqual(['7511']);
    expect((await read(`${base}/public/data/teams/seller`)).roster).toEqual([]);
    expect(await read(`${base}/public/data/player_locks/7511`)).toMatchObject({ lockedBy: 'buyer', isFranchise: false });
    expect(await read(`${base}/public/data/offers/o1`)).toMatchObject({ status: 'accepted' });
    expect((await read(`${base}/public/data/offers/o1`)).history.at(-1)).toMatchObject({ type: 'accepted', teamId: 'seller' });
    expect(await read(`${base}/public/data/offers/o2`)).toMatchObject({ status: 'rejected' });
    const feed = await readAll(`${base}/public/data/transfers`);
    expect(feed[0]).toMatchObject({ type: 'transfer', teamId: 'buyer', fromTeamId: 'seller', price: 11, sellerReceives: 9.35 });
    // The buyer's committed funds no longer include o2's 10.5 M.
    await expect(sign('mallory', 9000)).resolves.toBeTruthy();
  });

  it("drops the seller's private copy of the player, so exports and the seller's app agree at once", async () => {
    await seed(db => setDoc(doc(db, `${base}/users/seller/cart/7511`), { Id: 7511, Precio: 10, isFranchise: false }));
    await accept('seller');
    expect(await read(`${base}/users/seller/cart/7511`)).toBeNull();
  });

  it('a forged negative pending offer does not free the manager budget', async () => {
    await seed(db => setDoc(doc(db, `${base}/public/data/offers/neg`), { playerId: 1, senderId: 'mallory', targetTeamId: 'x', offerAmount: -1e12, status: 'pending' }));
    await sign('mallory', 9000); // 150 M of 200 M
    await expectMarketError(sign('mallory', 9100), /presupuesto/); // still only 50 M left
  });

  it('only the party whose turn it is can accept', async () => {
    await expect(accept('buyer')).rejects.toMatchObject({ status: 403 });
    await expect(accept('mallory')).rejects.toMatchObject({ status: 403 });
    await seed(db => updateDoc(doc(db, `${base}/public/data/offers/o1`), { status: 'countered', counterAmount: 11500000 }));
    await expect(accept('seller')).rejects.toMatchObject({ status: 403 });
    await expect(accept('buyer')).resolves.toMatchObject({ amount: 11500000 });
    expect((await read(`${base}/public/data/teams/buyer`)).budget).toBe(BUDGET + 10000000 - 11500000);
  });

  it('enforces the amount limits with the catalog price', async () => {
    await seed(db => updateDoc(doc(db, `${base}/public/data/offers/o1`), { offerAmount: 11600000 }));
    await expectMarketError(accept('seller'), /límites/);
    await seed(db => updateDoc(doc(db, `${base}/public/data/offers/o1`), { offerAmount: 9000000 }));
    await expectMarketError(accept('seller'), /límites/);
  });

  it("checks the buyer's liquid funds, ownership and franchise status", async () => {
    await seed(db => updateDoc(doc(db, `${base}/public/data/teams/buyer`), { budget: 5000000 }));
    await expectMarketError(accept('seller'), /fondos/);
    await seed(async db => {
      await updateDoc(doc(db, `${base}/public/data/teams/buyer`), { budget: BUDGET });
      await updateDoc(doc(db, `${base}/public/data/player_locks/7511`), { isFranchise: true });
    });
    await expectMarketError(accept('seller'), /franquicia/);
    await seed(db => updateDoc(doc(db, `${base}/public/data/player_locks/7511`), { isFranchise: false, lockedBy: 'mallory' }));
    await expectMarketError(accept('seller'), /ya no pertenece/);
  });

  it('cannot accept the same offer twice', async () => {
    await accept('seller');
    await expectMarketError(accept('seller'), /ya no es válida/);
  });
});

describe('acceptOffer: market state and names', () => {
  it('refuses to accept while the market is closed for the accepting team', async () => {
    await setMarket('closed');
    await expectMarketError(accept('seller'), /cerrado/);
    await seed(db => updateDoc(doc(db, `${base}/public/data/teams/seller`), { inWhitelist: true }));
    await expect(accept('seller')).resolves.toMatchObject({ amount: 11000000 });
  });

  it('takes names, crests and player data from the teams and the catalog, not from the offer', async () => {
    await seed(db => updateDoc(doc(db, `${base}/public/data/offers/o1`), {
      senderTeamName: 'Team seller', senderTeamLogo: 'https://evil.example/x.png', playerName: 'Fake', playerOvr: 99,
    }));
    await accept('seller');
    expect(await read(`${base}/public/data/player_locks/7511`)).toMatchObject({ lockedBy: 'buyer', teamName: 'Team buyer' });
    const [feed] = await readAll(`${base}/public/data/transfers`);
    expect(feed).toMatchObject({ teamName: 'Team buyer', teamLogo: '', playerName: 'Delantero', playerOvr: 80, playerId: 7511 });
  });
});

describe('release', () => {
  const release = (uid, playerId = 7511) => call(uid, { action: 'release', playerId });

  it('frees the player and closes the open offers that held buyers money', async () => {
    await seed(async db => {
      await setDoc(doc(db, `${base}/users/seller/cart/7511`), { Id: 7511, Precio: 10 });
      await setDoc(doc(db, `${base}/public/data/transfers/s1`), { playerId: 7511, teamId: 'seller', type: 'signing' });
      await setDoc(doc(db, `${base}/public/data/transfers/t1`), { playerId: 7511, teamId: 'seller', fromTeamId: 'x', type: 'transfer' });
    });
    await expect(release('seller')).resolves.toMatchObject({ playerId: 7511 });

    expect(await read(`${base}/public/data/player_locks/7511`)).toBeNull();
    expect(await read(`${base}/users/seller/cart/7511`)).toBeNull();
    expect(await read(`${base}/public/data/transfers/s1`)).toBeNull();
    expect(await read(`${base}/public/data/transfers/t1`)).not.toBeNull();
    expect((await read(`${base}/public/data/teams/seller`)).roster).toEqual([]);
    const offer = await read(`${base}/public/data/offers/o1`);
    expect(offer).toMatchObject({ status: 'rejected' });
    expect(offer.history.at(-1)).toMatchObject({ title: 'El jugador fue liberado' });
    // The buyer's 11 M are no longer held: 200 − 150 = 50 M left for a 50 M player.
    await expect(sign('buyer', 9000)).resolves.toBeTruthy();
    await expect(sign('buyer', 8000)).resolves.toBeTruthy();
  });

  it('only the owner releases, and franchise players are not released', async () => {
    await expectMarketError(release('mallory'), /ya no está en tu plantel/);
    await expectMarketError(release('seller', 9100), /ya no está en tu plantel/);
    await seed(db => updateDoc(doc(db, `${base}/public/data/player_locks/7511`), { isFranchise: true }));
    await expectMarketError(release('seller'), /Franquicia/);
    expect(await read(`${base}/public/data/player_locks/7511`)).toMatchObject({ lockedBy: 'seller' });
  });
});

describe('request validation', () => {
  it('rejects unknown actions and malformed ids', async () => {
    await expectMarketError(call('mallory', { action: 'nope' }), /desconocida/);
    await expectMarketError(call('mallory', { action: 'sign', playerId: '../x' }), /inválido/);
    await expectMarketError(call('mallory', { action: 'acceptOffer', offerId: 'a/b' }), /inválida/);
  });
});
