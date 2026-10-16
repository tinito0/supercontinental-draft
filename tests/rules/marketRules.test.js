// Firestore security rules for the draft market (teams, locks, offers, profiles), exercised with
// forged direct requests against the emulator: what a signed-in user can do with the SDK and the
// public web config, bypassing the UI. Run with: npm run test:rules
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, writeBatch, collection, serverTimestamp } from 'firebase/firestore';
import { DEFAULT_BUDGET, TRANSFER_FEE_RATE } from '../../utils/constants.js';

const APP = 'scl-draft-2025';
const base = `artifacts/${APP}`;
const BUDGET = DEFAULT_BUDGET; // firestore.rules defaultBudget() must match
const PLAYER = '7511';
const PRICE = 10000000; // base cost of PLAYER in the transfer below
let env;

const as = uid => env.authenticatedContext(uid).firestore();
const team = (db, uid) => doc(db, `${base}/public/data/teams/${uid}`);
const profile = (db, uid) => doc(db, `${base}/users/${uid}/profile/data`);
const cart = (db, uid, id = PLAYER) => doc(db, `${base}/users/${uid}/cart/${id}`);
const lock = (db, id = PLAYER) => doc(db, `${base}/public/data/player_locks/${id}`);
const offer = (db, id = 'o1') => doc(db, `${base}/public/data/offers/${id}`);

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-scl',
    firestore: { rules: fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8') },
  });
});
afterAll(async () => { await env?.cleanup(); });

// seller owns PLAYER; buyer has sent a pending offer for it.
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    for (const uid of ['seller', 'buyer', 'mallory']) {
      await setDoc(team(db, uid), { teamName: uid, userId: uid, logoUrl: '', budget: BUDGET, inWhitelist: false, roster: [] });
      await setDoc(profile(db, uid), { teamName: uid, userId: uid, budget: BUDGET, franchisePlayerUsed: false });
    }
    await setDoc(lock(db), { lockedBy: 'seller', teamName: 'seller', lockedAt: 'x', isFranchise: false });
    await setDoc(cart(db, 'seller'), { Id: PLAYER, Precio: 10 });
    await setDoc(offer(db), {
      playerId: PLAYER, senderId: 'buyer', targetTeamId: 'seller', offerAmount: 11000000,
      status: 'pending', history: [],
    });
  });
});

// The writes the old browser-side acceptTransferOffer made; now only the server may make them.
function acceptBatch(db, accepter, { amount = 11000000, status = 'accepted' } = {}) {
  const buyerBudget = BUDGET + PRICE - amount;
  const sellerBudget = BUDGET + Math.round(amount * (1 - TRANSFER_FEE_RATE)) - PRICE;
  const b = writeBatch(db);
  b.update(lock(db), { lockedBy: 'buyer', teamName: 'buyer', lockedAt: 'y', transferOfferId: 'o1' });
  b.set(team(db, 'buyer'), { budget: buyerBudget, roster: [{ Id: PLAYER }], rosterUpdatedAt: 'y', transferOfferId: 'o1' }, { merge: true });
  b.set(team(db, 'seller'), { budget: sellerBudget, roster: [], rosterUpdatedAt: 'y', transferOfferId: 'o1' }, { merge: true });
  if (accepter === 'buyer') {
    b.set(cart(db, 'buyer'), { Id: PLAYER, Precio: 10, isFranchise: false });
    b.set(profile(db, 'buyer'), { budget: buyerBudget }, { merge: true });
  } else {
    b.delete(cart(db, 'seller'));
    b.set(profile(db, 'seller'), { budget: sellerBudget }, { merge: true });
  }
  b.update(offer(db), { status, acceptedAt: 'y', history: [] });
  b.set(doc(collection(db, `${base}/public/data/transfers`)), {
    playerId: PLAYER, fromTeamId: 'seller', teamId: 'buyer', price: amount / 1e6, timestamp: serverTimestamp(),
  });
  return b;
}

describe('public team documents', () => {
  it('a manager can update the visual fields and formation of their own team', async () => {
    await assertSucceeds(setDoc(team(as('mallory'), 'mallory'), { teamName: 'M', logoUrl: 'x', formation: '4-4-2', roster: [] }, { merge: true }));
  });

  it("a manager cannot change another team's budget, roster or whitelist", async () => {
    const db = as('mallory');
    await assertFails(updateDoc(team(db, 'seller'), { budget: 0 }));
    await assertFails(updateDoc(team(db, 'seller'), { roster: [] }));
    await assertFails(updateDoc(team(db, 'seller'), { teamName: 'hacked' }));
  });

  it('a manager cannot raise their own budget or whitelist themselves', async () => {
    const db = as('mallory');
    await assertFails(updateDoc(team(db, 'mallory'), { budget: BUDGET * 10 }));
    await assertFails(updateDoc(team(db, 'mallory'), { inWhitelist: true }));
  });

  it('a new team starts with the default budget and outside the whitelist', async () => {
    const db = as('newbie');
    await assertFails(setDoc(team(db, 'newbie'), { teamName: 'n', userId: 'newbie', budget: BUDGET * 10, inWhitelist: false }));
    await assertFails(setDoc(team(db, 'newbie'), { teamName: 'n', userId: 'newbie', budget: BUDGET, inWhitelist: true }));
    await assertSucceeds(setDoc(team(db, 'newbie'), { teamName: 'n', userId: 'newbie', logoUrl: '', budget: BUDGET, inWhitelist: false }));
  });
});

describe('private profile', () => {
  it('a manager cannot raise their own budget or make themselves admin', async () => {
    const db = as('mallory');
    await assertFails(updateDoc(profile(db, 'mallory'), { budget: BUDGET * 10 }));
    await assertFails(updateDoc(profile(db, 'mallory'), { isAdmin: true }));
    await assertFails(updateDoc(profile(db, 'mallory'), { role: 'admin' }));
  });

  it('a manager can still save their formation, wishlist and team name', async () => {
    await assertSucceeds(setDoc(profile(as('mallory'), 'mallory'), { formation: '4-4-2', wishlist: ['1'], teamName: 'M' }, { merge: true }));
  });

  it('login sync may copy the public budget into the profile', async () => {
    // useAuth copies teams/{uid}.budget into the profile when they differ.
    await env.withSecurityRulesDisabled(ctx => updateDoc(team(ctx.firestore(), 'mallory'), { budget: BUDGET - 5 }));
    await assertSucceeds(setDoc(profile(as('mallory'), 'mallory'), { budget: BUDGET - 5 }, { merge: true }));
  });

  it('a new profile starts with the default budget and without admin flags', async () => {
    const db = as('newbie');
    await assertFails(setDoc(profile(db, 'newbie'), { teamName: 'n', userId: 'newbie', budget: BUDGET * 10 }));
    await assertFails(setDoc(profile(db, 'newbie'), { teamName: 'n', userId: 'newbie', budget: BUDGET, isAdmin: true }));
    await assertSucceeds(setDoc(profile(db, 'newbie'), { teamName: 'n', userId: 'newbie', budget: BUDGET, wishlist: [] }));
  });
});

describe('private profile: franchise flags', () => {
  it('only the server marks the franchise signing (a manager cannot set or reset it)', async () => {
    const db = as('mallory');
    await assertFails(updateDoc(profile(db, 'mallory'), { franchisePlayerUsed: true, franchisePlayerId: 1 }));
    await env.withSecurityRulesDisabled(ctx => updateDoc(profile(ctx.firestore(), 'mallory'), { franchisePlayerUsed: true }));
    await assertFails(updateDoc(profile(db, 'mallory'), { franchisePlayerUsed: false }));
  });
});

describe('player locks (written by the market Edge Function)', () => {
  it('a manager cannot sign or release from the browser (release runs on the server and closes offers)', async () => {
    const db = as('mallory');
    await assertFails(setDoc(lock(db, '1'), { lockedBy: 'mallory', teamName: 'm', lockedAt: 'x', isFranchise: false }));
    await env.withSecurityRulesDisabled(ctx => setDoc(lock(ctx.firestore(), '1'), { lockedBy: 'mallory', isFranchise: false }));
    await assertFails(deleteDoc(lock(db, '1')));
  });

  it('a manager cannot take over or release a player locked by another team', async () => {
    await assertFails(setDoc(lock(as('mallory')), { lockedBy: 'mallory', teamName: 'm', lockedAt: 'x', isFranchise: false }));
    await assertFails(updateDoc(lock(as('mallory')), { lockedBy: 'mallory' }));
    await assertFails(deleteDoc(lock(as('mallory'))));
  });
});

describe('private cart', () => {
  it('a player is stored as franchise only if its lock (written by the server) says so', async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(lock(ctx.firestore(), '50'), { lockedBy: 'mallory', isFranchise: true });
      await setDoc(lock(ctx.firestore(), '51'), { lockedBy: 'mallory', isFranchise: false });
    });
    const db = as('mallory');
    await assertSucceeds(setDoc(cart(db, 'mallory', '50'), { Id: 50, isFranchise: true }));
    await assertFails(setDoc(cart(db, 'mallory', '51'), { Id: 51, isFranchise: true }));
    await assertSucceeds(setDoc(cart(db, 'mallory', '51'), { Id: 51, isFranchise: false }));
  });
});

describe('transfer offers', () => {
  it('a third party cannot change or hijack an offer between two other teams', async () => {
    const db = as('mallory');
    await assertFails(updateDoc(offer(db), { status: 'rejected' }));
    await assertFails(updateDoc(offer(db), { senderId: 'mallory', status: 'withdrawn' }));
  });

  it('participants cannot rewrite who the offer is between or the original amount', async () => {
    await assertFails(updateDoc(offer(as('seller')), { senderId: 'seller' }));
    await assertFails(updateDoc(offer(as('buyer')), { offerAmount: 1 }));
  });

  it('answering an offer cannot rewrite its names, crests or player data', async () => {
    await assertFails(updateDoc(offer(as('seller')), { status: 'rejected', history: [], senderTeamName: 'Otro' }));
    await assertFails(updateDoc(offer(as('buyer')), { status: 'withdrawn', history: [], playerName: 'Fake' }));
    await assertSucceeds(updateDoc(offer(as('seller')), { status: 'rejected', rejectedAt: 'x', rejectedBy: 'seller', history: [] }));
  });

  it('the seller can reject or counter, and the buyer can withdraw', async () => {
    await assertSucceeds(updateDoc(offer(as('seller')), { status: 'countered', counterAmount: 11500000, history: [] }));
    await assertSucceeds(updateDoc(offer(as('buyer')), { status: 'withdrawn', history: [] }));
  });

  it('the buyer cannot counter their own pending offer (it is the seller\'s turn)', async () => {
    await assertFails(updateDoc(offer(as('buyer')), { status: 'countered', counterAmount: 10000000 }));
  });

  it('the buyer answers a counter-offer with a new offer, which goes back to the seller', async () => {
    await env.withSecurityRulesDisabled(ctx => updateDoc(offer(ctx.firestore()), { status: 'countered', counterAmount: 11500000 }));
    await assertFails(updateDoc(offer(as('buyer')), { status: 'countered', counterAmount: 10000000 }));
    await assertSucceeds(updateDoc(offer(as('buyer')), { status: 'pending', offerAmount: 11200000, history: [] }));
  });

  it('offer amounts must be positive whole numbers: a forged amount would free budget on the server', async () => {
    const newOffer = (db, offerAmount) => setDoc(doc(db, `${base}/public/data/offers/forged`), {
      playerId: PLAYER, senderId: 'mallory', targetTeamId: 'seller', offerAmount, status: 'pending', history: [],
    });
    for (const amount of [-1000000000000, 0, '11000000', 10500000.5]) {
      await assertFails(newOffer(as('mallory'), amount));
    }
    await assertSucceeds(newOffer(as('mallory'), 10500000));
    await assertFails(updateDoc(offer(as('seller')), { status: 'countered', counterAmount: -5, history: [] }));
    await env.withSecurityRulesDisabled(ctx => updateDoc(offer(ctx.firestore()), { status: 'countered', counterAmount: 11500000 }));
    await assertFails(updateDoc(offer(as('buyer')), { status: 'pending', offerAmount: -1000000000000, history: [] }));
  });

  it('accepting from the browser is rejected for everyone: the server executes transfers', async () => {
    await assertFails(updateDoc(offer(as('seller')), { status: 'accepted' }));
    await assertFails(acceptBatch(as('seller'), 'seller').commit());
    await env.withSecurityRulesDisabled(ctx => updateDoc(offer(ctx.firestore()), { status: 'countered', counterAmount: 11500000 }));
    await assertFails(acceptBatch(as('buyer'), 'buyer', { amount: 11500000 }).commit());
  });
});

describe('transfer feed (written by the market Edge Function)', () => {
  it('a manager cannot post or delete feed entries (the server removes the signing on release)', async () => {
    const db = as('mallory');
    await assertFails(setDoc(doc(db, `${base}/public/data/transfers/fake`), { playerId: '1', teamId: 'seller', price: 1 }));
    await assertFails(setDoc(doc(db, `${base}/public/data/transfers/mine`), { playerId: '1', teamId: 'mallory', price: 1 }));
    await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), `${base}/public/data/transfers/mine`), { playerId: '1', teamId: 'mallory', price: 1 }));
    await assertFails(deleteDoc(doc(db, `${base}/public/data/transfers/mine`)));
  });

  it('nobody but the admin deletes a transfer between two teams', async () => {
    await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), `${base}/public/data/transfers/t1`), { teamId: 'buyer', fromTeamId: 'seller', type: 'transfer' }));
    await assertFails(deleteDoc(doc(as('buyer'), `${base}/public/data/transfers/t1`)));
  });
});
