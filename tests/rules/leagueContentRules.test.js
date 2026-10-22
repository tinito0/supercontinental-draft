// Firestore security rules for the league site's texts (league_content), exercised with forged direct requests
// against the emulator. Run with: npm run test:rules
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const APP = 'scl-draft-2025';
const HARDCODED_ADMIN = '2Qn5j9a9ABW66iPyFL6ZfqwXBqG3';
let env;

const content = (db, id = 'history') => doc(db, `artifacts/${APP}/public/data/league_content/${id}`);
const history = { body: 'Así empezó la liga.' };

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-scl',
    firestore: { rules: fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8') },
  });
});
afterAll(async () => { await env?.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => { await setDoc(content(ctx.firestore()), history); });
});

describe('league_content', () => {
  it('anyone can read the league texts, signed in or not', async () => {
    await assertSucceeds(getDoc(content(env.unauthenticatedContext().firestore())));
    await assertSucceeds(getDoc(content(env.authenticatedContext('fan').firestore())));
  });

  it('a manager cannot write, change or delete them', async () => {
    const db = env.authenticatedContext('manager').firestore();
    await assertFails(updateDoc(content(db), { body: 'Historia falsa' }));
    await assertFails(setDoc(content(db, 'club-manager'), { body: 'Mi club es el mejor' }));
    await assertFails(deleteDoc(content(db)));
  });

  it('an anonymous visitor cannot write either', async () => {
    await assertFails(setDoc(content(env.unauthenticatedContext().firestore(), 'rules'), { season: 'x', chapters: [] }));
  });

  it('the admin can write every text', async () => {
    const db = env.authenticatedContext(HARDCODED_ADMIN).firestore();
    await assertSucceeds(updateDoc(content(db), { body: 'Nueva historia' }));
    await assertSucceeds(setDoc(content(db, 'rules'), { season: '2026', chapters: [{ id: 'a', title: 'Formato', body: '' }] }));
    await assertSucceeds(setDoc(content(db, 'club-abc'), { body: 'Historia del club' }));
  });
});
