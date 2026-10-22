// Firestore security rules for live PES matches (written by the match-feed function), exercised with forged
// direct requests against the emulator. Run with: npm run test:rules
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const APP = 'scl-draft-2025';
const HARDCODED_ADMIN = '2Qn5j9a9ABW66iPyFL6ZfqwXBqG3';
const KEY = '20261021T210652Z_101-103';
let env;

const live = db => doc(db, `artifacts/${APP}/public/data/live_matches/${KEY}`);
const match = { schema: 'scl.match/1', matchKey: KEY, status: 'live', score: { home: 1, away: 0 } };

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-scl',
    firestore: { rules: fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8') },
  });
});
afterAll(async () => { await env?.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => { await setDoc(live(ctx.firestore()), match); });
});

describe('live_matches', () => {
  it('anyone can read a live match, signed in or not', async () => {
    await assertSucceeds(getDoc(live(env.unauthenticatedContext().firestore())));
    await assertSucceeds(getDoc(live(env.authenticatedContext('fan').firestore())));
  });

  it('a signed-in user cannot create, change or delete a live match', async () => {
    const db = env.authenticatedContext('mallory').firestore();
    await assertFails(updateDoc(live(db), { score: { home: 9, away: 0 } }));
    await assertFails(setDoc(doc(db, `artifacts/${APP}/public/data/live_matches/fake`), match));
    await assertFails(deleteDoc(live(db)));
  });

  it('an anonymous visitor cannot write either', async () => {
    await assertFails(updateDoc(live(env.unauthenticatedContext().firestore()), { status: 'finished' }));
  });

  it('the admin can correct a live match', async () => {
    await assertSucceeds(updateDoc(live(env.authenticatedContext(HARDCODED_ADMIN).firestore()), { status: 'abandoned' }));
  });
});
