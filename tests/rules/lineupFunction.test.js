// saveLineup and squadCompliance (supabase/functions/_shared/lineup.js) against the Firestore emulator, through the
// REST client the Edge Function uses in production. Synthetic squads. Run with: npm run test:rules
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { createFirestore } from '../../supabase/functions/_shared/firestoreRest.js';
import { handleLineupAction } from '../../supabase/functions/_shared/lineup.js';

const PROJECT = 'demo-scl';
const APP = 'scl-draft-2025';
const base = `artifacts/${APP}`;
// Ids 1..11 at 85 (the XI) and 12..21 at 75: the bench averages 75.
const catalog = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [String(i + 1), [1, 25, i < 11 ? 85 : 75, `P${i + 1}`, 'MC', 9]]));
const eleven = Object.fromEntries(Array.from({ length: 11 }, (_, slot) => [String(slot), String(slot + 1)]));

let env;
const firestore = createFirestore({
  projectId: PROJECT,
  baseUrl: `http://${process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'}/v1`,
  getAccessToken: async () => 'owner',
});
const call = (uid, body, isAdmin = false) => handleLineupAction({ firestore, appId: APP, catalog, user: { uid, isAdmin }, body });
const seed = fn => env.withSecurityRulesDisabled(ctx => fn(ctx.firestore()));
async function read(path) {
  let data = null;
  await env.withSecurityRulesDisabled(async ctx => { data = (await getDoc(doc(ctx.firestore(), path))).data() ?? null; });
  return data;
}

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: PROJECT, firestore: { rules: 'rules_version = "2"; service cloud.firestore { match /{d=**} { allow read, write: if false; } }' } });
});
afterAll(async () => { await env?.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await seed(async db => {
    await setDoc(doc(db, `${base}/public/data/teams/u1`), { teamName: 'U1', country: 9, lineup: { 0: '1', 5: '6' }, formation: '4-3-3', budget: 1 });
    await setDoc(doc(db, `${base}/users/u1/profile/data`), { teamName: 'U1', lineup: { 0: '1', 5: '6' }, dorsals: { 1: '1', 2: '2' } });
    for (let id = 1; id <= 21; id++) await setDoc(doc(db, `${base}/public/data/player_locks/${id}`), { lockedBy: 'u1' });
  });
});

describe('saveLineup on the emulator', () => {
  it('replaces the lineup and board maps whole on both documents and keeps the other fields', async () => {
    const result = await call('u1', { action: 'saveLineup', lineup: eleven, dorsals: { 1: '10' } });
    expect(result.bench).toMatchObject({ applies: true, average: 75, min: 73 });
    for (const path of [`${base}/public/data/teams/u1`, `${base}/users/u1/profile/data`]) {
      const data = await read(path);
      expect(data.lineup).toEqual(eleven);
      expect(data.dorsals).toEqual({ 1: '10' });
      expect(data.matchBench).toEqual(result.saved.matchBench);
      expect(data.teamName).toBe('U1');
    }
    expect((await read(`${base}/public/data/teams/u1`)).budget).toBe(1);
  });

  it('refuses a bench under the minimum in config/squadRules and writes nothing', async () => {
    await seed(db => setDoc(doc(db, `${base}/public/data/config/squadRules`), { benchMinAvgOvr: 76 }));
    await expect(call('u1', { action: 'saveLineup', lineup: eleven })).rejects.toMatchObject({ code: 'bench-below-minimum', details: { average: 75, min: 76 } });
    expect((await read(`${base}/public/data/teams/u1`)).lineup).toEqual({ 0: '1', 5: '6' });
  });

  it('squadCompliance reads every approved club for the admin', async () => {
    await seed(db => setDoc(doc(db, `${base}/public/data/teams/u2`), { teamName: 'U2', approved: false }));
    const result = await call('admin', { action: 'squadCompliance' }, true);
    expect(result.teams.map(t => t.teamId)).toEqual(['u1']);
    expect(result.teams[0].rules.map(r => [r.id, r.ok])).toEqual([['squad', true], ['bench', true], ['locals', true]]);
  });
});
