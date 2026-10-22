// Firestore security rules for the draft market (teams, locks, offers, profiles), exercised with
// forged direct requests against the emulator: what a signed-in user can do with the SDK and the
// public web config, bypassing the UI. Run with: npm run test:rules
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, collection, serverTimestamp, addDoc, getDocs, query, where, or } from 'firebase/firestore';
import { DEFAULT_BUDGET, TRANSFER_FEE_RATE } from '../../utils/constants.js';
import { OFFER_TTL_MS } from '../../supabase/functions/_shared/offerExpiry.js';

// Expiry of a turn that starts now (the emulator's request.time is the real clock).
const turn = () => Date.now() + OFFER_TTL_MS;

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
    await assertSucceeds(setDoc(team(db, 'newbie'), { teamName: 'n', userId: 'newbie', logoUrl: '', budget: BUDGET, inWhitelist: false, approved: false }));
  });

  it('a new team waits for approval: it cannot create itself approved or approve itself', async () => {
    const db = as('newbie');
    await assertFails(setDoc(team(db, 'newbie'), { teamName: 'n', userId: 'newbie', budget: BUDGET, inWhitelist: false }));
    await assertFails(setDoc(team(db, 'newbie'), { teamName: 'n', userId: 'newbie', budget: BUDGET, inWhitelist: false, approved: true }));
    await assertSucceeds(setDoc(team(db, 'newbie'), { teamName: 'n', userId: 'newbie', budget: BUDGET, inWhitelist: false, approved: false }));
    await assertFails(updateDoc(team(db, 'newbie'), { approved: true }));
  });

  it('a team waiting for approval cannot make offers or write in the chat', async () => {
    await env.withSecurityRulesDisabled(ctx => updateDoc(team(ctx.firestore(), 'mallory'), { approved: false }));
    const db = as('mallory');
    await assertFails(setDoc(doc(db, `${base}/public/data/offers/pending-team`), {
      playerId: PLAYER, senderId: 'mallory', targetTeamId: 'seller', offerAmount: 10500000, status: 'pending', history: [], expiresAtMs: turn(),
    }));
    await assertFails(addDoc(collection(db, `${base}/public/data/manager_chat`), { senderId: 'mallory', senderTeamName: 'm', text: 'hola', gifUrl: '' }));
    await env.withSecurityRulesDisabled(ctx => updateDoc(team(ctx.firestore(), 'mallory'), { approved: true }));
    await assertSucceeds(addDoc(collection(db, `${base}/public/data/manager_chat`), { senderId: 'mallory', senderTeamName: 'm', text: 'hola', gifUrl: '' }));
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
    await assertSucceeds(updateDoc(offer(as('seller')), { status: 'countered', counterAmount: 11500000, expiresAtMs: turn(), history: [] }));
    await assertSucceeds(updateDoc(offer(as('buyer')), { status: 'withdrawn', history: [] }));
  });

  it('the buyer cannot counter their own pending offer (it is the seller\'s turn)', async () => {
    await assertFails(updateDoc(offer(as('buyer')), { status: 'countered', counterAmount: 10000000 }));
  });

  it('the buyer answers a counter-offer with a new offer, which goes back to the seller', async () => {
    await env.withSecurityRulesDisabled(ctx => updateDoc(offer(ctx.firestore()), { status: 'countered', counterAmount: 11500000 }));
    await assertFails(updateDoc(offer(as('buyer')), { status: 'countered', counterAmount: 10000000 }));
    await assertSucceeds(updateDoc(offer(as('buyer')), { status: 'pending', offerAmount: 11200000, expiresAtMs: turn(), history: [] }));
  });

  it('every turn expires in 48 hours: no offer or answer without it, or with a later one', async () => {
    const create = (fields) => setDoc(doc(as('mallory'), `${base}/public/data/offers/timed`), {
      playerId: PLAYER, senderId: 'mallory', targetTeamId: 'seller', offerAmount: 10500000, status: 'pending', history: [], ...fields,
    });
    await assertFails(create({}));
    await assertFails(create({ expiresAtMs: turn() + 30 * 24 * 3600 * 1000 }));
    await assertSucceeds(create({ expiresAtMs: turn() }));
    await assertFails(updateDoc(offer(as('seller')), { status: 'countered', counterAmount: 11500000, history: [] }));
    await assertFails(updateDoc(offer(as('seller')), { status: 'rejected', expiresAtMs: turn(), history: [] }));
  });

  it('offer amounts must be positive whole numbers: a forged amount would free budget on the server', async () => {
    const newOffer = (db, offerAmount) => setDoc(doc(db, `${base}/public/data/offers/forged`), {
      playerId: PLAYER, senderId: 'mallory', targetTeamId: 'seller', offerAmount, status: 'pending', history: [], expiresAtMs: turn(),
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

describe('negotiation chat', () => {
  const message = (db, fields = {}) => addDoc(collection(db, `${base}/public/data/offers/o1/messages`), {
    senderId: 'buyer', senderTeamName: 'buyer', senderTeamLogo: '', text: 'Hola', createdAtIso: 'x', ...fields,
  });

  it('only the two clubs of the offer write, with short text', async () => {
    await assertSucceeds(message(as('buyer')));
    await assertSucceeds(message(as('seller'), { senderId: 'seller', senderTeamName: 'seller' }));
    await assertFails(message(as('mallory'), { senderId: 'mallory' }));
    await assertFails(message(as('buyer'), { senderId: 'seller' }));
    await assertFails(message(as('buyer'), { text: '' }));
    await assertFails(message(as('buyer'), { text: 'x'.repeat(501) }));
    await assertFails(message(as('buyer'), { extra: true }));
  });

  it('closes when the offer is no longer open', async () => {
    await env.withSecurityRulesDisabled(ctx => updateDoc(offer(ctx.firestore()), { status: 'rejected' }));
    await assertFails(message(as('buyer')));
  });
});

describe('manager chat', () => {
  const chat = (db, fields = {}) => addDoc(collection(db, `${base}/public/data/manager_chat`), {
    senderId: 'buyer', senderTeamName: 'buyer', text: 'Hola', gifUrl: '', ...fields,
  });

  it('accepts a message that is only a GIF, over https', async () => {
    await assertSucceeds(chat(as('buyer'), { text: '', gifUrl: 'https://media.giphy.com/media/x/giphy.gif' }));
    await assertFails(chat(as('buyer'), { text: '', gifUrl: '' }));
    await assertFails(chat(as('buyer'), { text: '', gifUrl: 'javascript:alert(1)' }));
    await assertFails(chat(as('buyer'), { gifUrl: 'http://example.com/a.gif' }));
  });

  it('is read only by signed-in managers', async () => {
    await assertSucceeds(getDocs(collection(as('buyer'), `${base}/public/data/manager_chat`)));
    await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), `${base}/public/data/manager_chat`)));
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

// docs/SECURITY_AUDIT.md S1: any new Google account gets a pending team, so "signed in" is not "manager".
describe('who reads negotiations and the manager chat', () => {
  const offers = db => collection(db, `${base}/public/data/offers`);
  const mine = (db, uid) => query(offers(db), or(where('targetTeamId', '==', uid), where('senderId', '==', uid)));
  const messages = db => collection(db, `${base}/public/data/offers/o1/messages`);

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      const db = ctx.firestore();
      await setDoc(team(db, 'stranger'), { teamName: 'x', userId: 'stranger', budget: BUDGET, inWhitelist: false, approved: false });
      await setDoc(doc(db, `${base}/public/data/offers/o1/messages/m1`), { senderId: 'buyer', text: 'hola' });
    });
  });

  it('each club reads only its own offers, with the query the app uses', async () => {
    await assertSucceeds(getDocs(mine(as('buyer'), 'buyer')));
    await assertSucceeds(getDocs(mine(as('seller'), 'seller')));
    await assertSucceeds(getDoc(offer(as('buyer'))));
    await assertFails(getDoc(offer(as('mallory'))));
    await assertFails(getDocs(offers(as('mallory'))));
    await assertFails(getDocs(offers(as('stranger'))));
  });

  it('only the two clubs read the negotiation chat', async () => {
    await assertSucceeds(getDocs(messages(as('seller'))));
    await assertFails(getDocs(messages(as('mallory'))));
    await assertFails(getDocs(messages(env.unauthenticatedContext().firestore())));
  });

  it('a signed-in account waiting for approval cannot read the manager chat', async () => {
    await assertFails(getDocs(collection(as('stranger'), `${base}/public/data/manager_chat`)));
    await assertFails(getDocs(collection(as('nobody'), `${base}/public/data/manager_chat`)));
  });

  it('nobody deletes someone else\'s presence', async () => {
    await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), `${base}/presence/seller`), { online: true }));
    await assertFails(deleteDoc(doc(as('mallory'), `${base}/presence/seller`)));
    await assertSucceeds(deleteDoc(doc(as('seller'), `${base}/presence/seller`)));
  });
});

describe('shared formations (auditoría S7)', () => {
  const formations = db => collection(db, `${base}/public/data/shared_formations`);
  const valid = uid => ({
    teamName: 'Los Pibes', logoUrl: '/logo.webp', formationKey: '4-3-3', formationName: '4-3-3',
    formationStates: { formation: '4-3-3', fluid: false, positions: {}, roles: {}, presets: {} },
    slots: { 0: { playerId: '1', name: 'X', pos: 'PT', ovr: 80, dorsal: '1' } },
    bench: [{ playerId: '2', name: 'Y', pos: 'DFC', ovr: 75, dorsal: '', available: true }],
    isPublic: true, createdAt: new Date().toISOString(), createdBy: uid,
  });

  it('a signed-in manager shares the formation the app builds', async () => {
    await assertSucceeds(addDoc(formations(as('buyer')), valid('buyer')));
  });

  it('refuses extra fields, oversized text and oversized lists', async () => {
    const db = as('buyer');
    await assertFails(addDoc(formations(db), { ...valid('buyer'), blob: 'x' }));
    await assertFails(addDoc(formations(db), { ...valid('buyer'), teamName: 'x'.repeat(81) }));
    await assertFails(addDoc(formations(db), { ...valid('buyer'), bench: Array.from({ length: 61 }, () => ({})) }));
    await assertFails(addDoc(formations(db), { ...valid('buyer'), createdBy: 'someone-else' }));
  });
});
