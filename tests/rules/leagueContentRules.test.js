// Firestore security rules for the league site's texts (league_content), exercised with forged direct requests
// against the emulator. Run with: npm run test:rules
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

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

describe('league_editors (editor de la web pública)', () => {
  const EDITOR = 'santa-cabeza-manager';
  const editorDoc = (db, uid = EDITOR) => doc(db, `artifacts/${APP}/league_editors/${uid}`);
  const asEditor = () => env.authenticatedContext(EDITOR).firestore();
  const signed = (value, uid = EDITOR) => ({ ...value, updatedAt: serverTimestamp(), updatedBy: uid });

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async ctx => { await setDoc(editorDoc(ctx.firestore()), { teamName: 'Santa Cabeza' }); });
  });

  it('an editor writes the league, club and rules texts under their own name', async () => {
    const db = asEditor();
    await assertSucceeds(setDoc(content(db), signed({ body: 'Así empezó todo.' })));
    await assertSucceeds(setDoc(content(db, 'club-abc123'), signed({ body: 'Historia del club' })));
    await assertSucceeds(setDoc(content(db, 'rules'), signed({ season: '2026', chapters: [{ id: 'a', title: 'Formato', body: 'Suizo' }] })));
  });

  it('an editor cannot sign as someone else, add fields, write other docs or delete', async () => {
    const db = asEditor();
    await assertFails(setDoc(content(db), signed({ body: 'x' }, 'otro')));
    await assertFails(setDoc(content(db), { body: 'sin firma' }));
    await assertFails(setDoc(content(db), signed({ body: 'x', isAdmin: true })));
    await assertFails(setDoc(content(db), signed({ body: 'x'.repeat(20001) })));
    await assertFails(setDoc(content(db, 'cualquier-cosa'), signed({ body: 'x' })));
    await assertFails(deleteDoc(content(db)));
  });

  it('an editor saves the club card (estadio, DT, títulos) with its history', async () => {
    const db = asEditor();
    const profile = {
      nickname: 'El Santo', stadium: 'La Cabeza', capacity: '40.000', coach: 'R. Gómez', president: 'M. Díaz', manager: 'Santi',
      stadiumPhotoUrl: 'https://example.com/estadio.jpg',
      honours: [{ id: 'h1', scope: 'nacional', name: 'Liga', count: 3, years: '2019, 2021, 2023' }],
      seasons: [{ id: 's1', season: '2025', competition: 'Supercontinental', result: 'Campeón' }],
    };
    await assertSucceeds(setDoc(content(db, 'club-abc123'), signed({ body: 'Historia', profile })));
    await assertSucceeds(setDoc(content(db, 'club-abc123'), signed({ body: '', profile: { ...profile, stadiumPhotoUrl: '' } })));
  });

  it('the club card rejects non-https photos, unknown fields and oversized lists', async () => {
    const db = asEditor();
    await assertFails(setDoc(content(db, 'club-abc123'), signed({ profile: { stadiumPhotoUrl: 'http://example.com/a.jpg' } })));
    await assertFails(setDoc(content(db, 'club-abc123'), signed({ profile: { stadiumPhotoUrl: 'javascript:alert(1)' } })));
    await assertFails(setDoc(content(db, 'club-abc123'), signed({ profile: { budget: 999 } })));
    await assertFails(setDoc(content(db, 'club-abc123'), signed({ profile: { coach: 'x'.repeat(81) } })));
    await assertFails(setDoc(content(db, 'club-abc123'), signed({ profile: { honours: Array.from({ length: 31 }, (_, i) => ({ id: String(i) })) } })));
    await assertFails(setDoc(content(db, 'club-abc123'), signed({ profile: 'texto' })));
  });

  it('being an editor gives nothing outside the league texts', async () => {
    const db = asEditor();
    await assertFails(setDoc(doc(db, `artifacts/${APP}/public/data/tournament/official`), { matches: [] }));
    await assertFails(setDoc(doc(db, `artifacts/${APP}/public/data/broadcast/overlay`), { scene: 'live' }));
    await assertFails(setDoc(doc(db, `artifacts/${APP}/public/data/config/market`), { status: 'open' }));
    await assertFails(setDoc(editorDoc(db, 'amigo'), { teamName: 'Otro club' }));
  });

  it('each user reads only their own editor doc; only the admin names editors', async () => {
    await assertSucceeds(getDoc(editorDoc(asEditor())));
    await assertFails(getDoc(editorDoc(env.authenticatedContext('manager').firestore())));
    await assertFails(setDoc(editorDoc(env.authenticatedContext('manager').firestore(), 'manager'), { teamName: 'Yo' }));
    const admin = env.authenticatedContext(HARDCODED_ADMIN).firestore();
    await assertSucceeds(setDoc(editorDoc(admin, 'nuevo'), { teamName: 'Nuevo' }));
    await assertSucceeds(deleteDoc(editorDoc(admin, 'nuevo')));
  });

  it('a removed editor loses write access', async () => {
    await env.withSecurityRulesDisabled(async ctx => { await deleteDoc(editorDoc(ctx.firestore())); });
    await assertFails(setDoc(content(asEditor()), signed({ body: 'ya no puedo' })));
  });
});
