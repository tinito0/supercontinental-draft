// Firestore security rules for the PES editor, exercised with forged direct requests against
// the emulator (no UI involved). Run with: npm run test:rules
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, addDoc, collection } from 'firebase/firestore';

const APP = 'scl-draft-2025';
const HARDCODED_ADMIN = '2Qn5j9a9ABW66iPyFL6ZfqwXBqG3';
const base = `artifacts/${APP}`;
let env;

const op = (uid, extra) => ({ actorUid: uid, actorRole: 'x', state: 'saved', seq: 1, target: { teamId: 101, kit: 'p1' }, ...extra });
const as = uid => env.authenticatedContext(uid).firestore();
const opsOf = (db, ws = 'league') => collection(db, `${base}/pes_workspaces/${ws}/ops`);

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-scl',
    firestore: { rules: fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8') },
  });
});
afterAll(async () => { await env?.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, `${base}/pes_roles/super`), { role: 'super_admin' });
    await setDoc(doc(db, `${base}/pes_roles/lusitano`), { role: 'kit_manager', label: 'Lusitano' });
    await setDoc(doc(db, `${base}/pes_roles/balvanera`), { role: 'kit_manager', label: 'Talleres de Balvanera' });
    await setDoc(doc(db, `${base}/pes_roles/draft`), { role: 'draft_admin' });
    await setDoc(doc(db, `${base}/pes_workspaces/league`), { name: 'Liga', leagueTeamIds: [101, 102] });
    await setDoc(doc(db, `${base}/pes_workspaces/open`), { name: 'Abierto', leagueTeamIds: [] });
    await setDoc(doc(db, `${base}/pes_workspaces/league/ops/byLusitano`), op('lusitano', { type: 'kit.set', key: 'Collar', value: '3' }));
  });
});

describe('users without a PES role', () => {
  it('cannot read workspaces, history or roles, nor write operations', async () => {
    const db = as('random');
    await assertFails(getDoc(doc(db, `${base}/pes_workspaces/league`)));
    await assertFails(getDoc(doc(db, `${base}/pes_workspaces/league/ops/byLusitano`)));
    await assertFails(getDoc(doc(db, `${base}/pes_roles/super`)));
    await assertFails(addDoc(opsOf(db), op('random', { type: 'kit.set', key: 'Collar', value: '3' })));
    await assertFails(setDoc(doc(db, `${base}/pes_roles/random`), { role: 'super_admin' }));
  });

  it('unauthenticated requests are rejected', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, `${base}/pes_workspaces/league`)));
  });
});

describe('Kit Managers (Lusitano and Talleres de Balvanera)', () => {
  for (const km of ['lusitano', 'balvanera']) {
    it(`${km}: may persist kit, texture, team-colour and UniColor operations for league teams`, async () => {
      const db = as(km);
      await assertSucceeds(getDoc(doc(db, `${base}/pes_workspaces/league`)));
      await assertSucceeds(addDoc(opsOf(db), op(km, { type: 'kit.set', key: 'Collar', value: '3' })));
      await assertSucceeds(addDoc(opsOf(db), op(km, { type: 'kit.set', key: 'UniColor_Color1', value: '#FFFFFF' })));
      await assertSucceeds(addDoc(opsOf(db), op(km, { type: 'kit.texture.set', slot: 'name', ext: '.ftex', value: 'club_name', asset: { sha256: 'a' } })));
      await assertSucceeds(addDoc(opsOf(db), op(km, { type: 'edit.team.set', target: { teamId: 102 }, field: 'c1r', value: 10 })));
    });
  }

  it('cannot persist database, player or non-kit fields (field-level check)', async () => {
    const db = as('lusitano');
    await assertFails(addDoc(opsOf(db), op('lusitano', { type: 'bin.player.set', target: { playerId: 1 }, field: 'speed', value: 99 })));
    await assertFails(addDoc(opsOf(db), op('lusitano', { type: 'bin.team.set', target: { teamId: 101 }, field: 'nameEnglish', value: 'X' })));
    await assertFails(addDoc(opsOf(db), op('lusitano', { type: 'bin.assignment.add', target: { teamId: 101 }, value: {} })));
    await assertFails(addDoc(opsOf(db), op('lusitano', { type: 'edit.team.set', target: { teamId: 101 }, field: 'name', value: 'X' })));
    await assertFails(addDoc(opsOf(db), op('lusitano', { type: 'edit.player.set', target: { playerId: 1 }, field: 'height', value: 190 })));
    await assertFails(addDoc(opsOf(db), op('lusitano', { type: 'kit.set', key: 'Unk_Offset0x1C_Bits0to1', value: '1' })));
    await assertFails(addDoc(opsOf(db), op('lusitano', { type: 'kit.texture.set', slot: 'Collar', ext: '.ftex', value: 'x' })));
    await assertFails(addDoc(opsOf(db), op('lusitano', { type: 'kit.texture.set', slot: 'kit', ext: '.exe', value: 'x' })));
    await assertFails(addDoc(opsOf(db), op('lusitano', { type: 'edit.team.squad', target: { teamId: 101 }, valueJson: '{}' })));
    await assertFails(addDoc(opsOf(db), op('lusitano', { type: 'edit.roster.remove', target: { teamId: 101 }, valueJson: '1' })));
  });

  it('may add kits to league teams but not change coaches', async () => {
    const db = as('lusitano');
    await assertSucceeds(addDoc(opsOf(db), op('lusitano', { type: 'kit.add', target: { teamId: 101 }, valueJson: '{"kit":"p5","from":"p1"}' })));
    await assertFails(addDoc(opsOf(db), op('lusitano', { type: 'kit.add', target: { teamId: 999 }, valueJson: '{"kit":"p5","from":"p1"}' })));
    await assertFails(addDoc(opsOf(db), op('lusitano', { type: 'bin.coach.set', target: { coachId: 47, teamId: 101 }, field: 'name', value: 'X' })));
    await assertFails(addDoc(opsOf(db), op('lusitano', { type: 'edit.coach.set', target: { coachId: 47, teamId: 101 }, field: 'name', value: 'X' })));
  });

  it('cannot edit kits of teams outside the league list', async () => {
    const db = as('lusitano');
    await assertFails(addDoc(opsOf(db), op('lusitano', { type: 'kit.set', target: { teamId: 999, kit: 'p1' }, key: 'Collar', value: '3' })));
    await assertSucceeds(addDoc(opsOf(db, 'open'), op('lusitano', { type: 'kit.set', target: { teamId: 999, kit: 'p1' }, key: 'Collar', value: '3' })));
  });

  it('cannot impersonate, forge state, export, manage workspaces or roles', async () => {
    const db = as('lusitano');
    await assertFails(addDoc(opsOf(db), op('balvanera', { type: 'kit.set', key: 'Collar', value: '3' })));
    await assertFails(addDoc(opsOf(db), { ...op('lusitano', { type: 'kit.set', key: 'Collar', value: '3' }), state: 'discarded' }));
    await assertFails(addDoc(collection(db, `${base}/pes_workspaces/league/exports`), { exportedBy: 'lusitano' }));
    await assertFails(updateDoc(doc(db, `${base}/pes_workspaces/league`), { leagueTeamIds: [] }));
    await assertFails(setDoc(doc(db, `${base}/pes_roles/lusitano`), { role: 'super_admin' }));
  });

  it('may discard only their own operations, and only the state fields', async () => {
    const own = as('lusitano');
    const other = as('balvanera');
    const ref = p => doc(p, `${base}/pes_workspaces/league/ops/byLusitano`);
    await assertFails(updateDoc(ref(other), { state: 'discarded', discardedBy: 'balvanera', discardedAt: 1 }));
    await assertFails(updateDoc(ref(own), { value: '99' }));
    await assertFails(updateDoc(ref(own), { state: 'discarded', discardedBy: 'balvanera', discardedAt: 1 }));
    await assertSucceeds(updateDoc(ref(own), { state: 'discarded', discardedBy: 'lusitano', discardedAt: 1 }));
  });
});

describe('Draft Admin', () => {
  it('can read but cannot persist any operation', async () => {
    const db = as('draft');
    await assertSucceeds(getDoc(doc(db, `${base}/pes_workspaces/league`)));
    await assertFails(addDoc(opsOf(db), op('draft', { type: 'bin.player.set', target: { playerId: 1 }, field: 'speed', value: 80 })));
    await assertFails(addDoc(opsOf(db), op('draft', { type: 'kit.set', key: 'Collar', value: '3' })));
    await assertFails(addDoc(opsOf(db), op('draft', { type: 'kit.add', target: { teamId: 101 }, valueJson: '{"kit":"p5","from":"p1"}' })));
    await assertFails(addDoc(opsOf(db), op('draft', { type: 'edit.coach.set', target: { coachId: 47, teamId: 101 }, field: 'name', value: 'X' })));
  });
});

describe('Super Admin', () => {
  for (const uid of ['super', HARDCODED_ADMIN]) {
    it(`${uid === 'super' ? 'role document' : 'existing app admin'}: full access`, async () => {
      const db = as(uid);
      await assertSucceeds(addDoc(opsOf(db), op(uid, { type: 'bin.player.set', target: { playerId: 1 }, field: 'speed', value: 80 })));
      await assertSucceeds(addDoc(opsOf(db), op(uid, { type: 'bin.assignment.add', target: { teamId: 999 }, value: {} })));
      await assertSucceeds(addDoc(opsOf(db), op(uid, { type: 'edit.team.squad', target: { teamId: 101 }, valueJson: '{}' })));
      await assertSucceeds(addDoc(opsOf(db), op(uid, { type: 'bin.coach.set', target: { coachId: 47, teamId: 126 }, field: 'name', value: 'DT' })));
      await assertSucceeds(addDoc(opsOf(db), op(uid, { type: 'edit.coach.set', target: { coachId: 47, teamId: 126 }, field: 'country', value: 9 })));
      await assertSucceeds(addDoc(opsOf(db), op(uid, { type: 'kit.add', target: { teamId: 999 }, valueJson: '{"kit":"p5","from":"p1"}' })));
      await assertSucceeds(addDoc(collection(db, `${base}/pes_workspaces`), { name: 'Nuevo', sources: [] }));
      await assertSucceeds(addDoc(collection(db, `${base}/pes_workspaces/league/exports`), { exportedBy: uid }));
      // The pre-existing catch-all `match /{document=**} { allow read, write: if isAdmin(); }`
      // lets the app admin write anything, so field checks only bind role-document Super Admins.
      if (uid === 'super') await assertFails(addDoc(collection(db, `${base}/pes_workspaces/league/exports`), { exportedBy: 'someone-else' }));
      await assertSucceeds(setDoc(doc(db, `${base}/pes_roles/newKm`), { role: 'kit_manager', label: 'Lusitano' }));
      if (uid === 'super') await assertFails(setDoc(doc(db, `${base}/pes_roles/newKm`), { role: 'owner' }));
      await assertSucceeds(updateDoc(doc(db, `${base}/pes_workspaces/league/ops/byLusitano`), { state: 'discarded', discardedBy: uid, discardedAt: 1 }));
    });
  }

  it('still cannot persist an unknown operation type', async () => {
    await assertFails(addDoc(opsOf(as('super')), op('super', { type: 'db.drop' })));
  });

  it('documents the pre-existing catch-all: the hardcoded app admin bypasses field checks', async () => {
    await assertSucceeds(addDoc(opsOf(as(HARDCODED_ADMIN)), op('someone-else', { type: 'db.drop' })));
  });
});
