// Votos del público (supabase/functions/_shared/communityVote.js castVote) contra el emulador de Firestore, con el mismo
// cliente REST que usa la función en producción, y las reglas de lectura de los totales. Run with: npm run test:rules
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { createFirestore } from '../../supabase/functions/_shared/firestoreRest.js';
import { castVote, CommunityVoteError, MAX_VOTES_PER_IP, MVP_GRACE_MS, parseVote, predictionClosure } from '../../supabase/functions/_shared/communityVote.js';

const PROJECT = 'demo-scl';
const APP = 'scl-draft-2025';
const base = `artifacts/${APP}/public/data`;
const KEY = '20261021T232728Z_101-103';
let env;

const firestore = createFirestore({
  projectId: PROJECT,
  baseUrl: `http://${process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'}/v1`,
  getAccessToken: async () => 'owner',
});

const device = n => `device-${String(n).padStart(12, '0')}`;
const vote = (body, { ip = 'ip1', dev = 1, now = Date.now() } = {}) => castVote({
  firestore, appId: APP, vote: parseVote({ deviceId: device(dev), ...body }), ipHash: ip, deviceHash: `h${dev}`, now,
});
const predict = (choice, opts) => vote({ kind: 'prediction', matchId: 'm12', choice }, opts);
const mvp = (choice, opts) => vote({ kind: 'mvp', matchKey: KEY, choice }, opts);
const rejects = (promise, pattern) => expect(promise).rejects.toSatisfy(e => e instanceof CommunityVoteError && pattern.test(e.message));

async function read(p) {
  let data = null;
  await env.withSecurityRulesDisabled(async ctx => { data = (await getDoc(doc(ctx.firestore(), p))).data() ?? null; });
  return data;
}
const seed = fn => env.withSecurityRulesDisabled(ctx => fn(ctx.firestore()));
const summary = { lineups: { home: { starting: [10, 11] }, away: { starting: [20] } }, substitutions: [{ onId: 12, offId: 11 }] };
const setLive = (status, updatedAt = new Date()) => seed(db => setDoc(doc(db, `${base}/live_matches/${KEY}`), { status, updatedAt, summaryJson: JSON.stringify(summary) }));

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8') },
  });
});
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await seed(db => setDoc(doc(db, `${base}/broadcast/overlay`), { matchId: 'm12', homeTeamName: 'Los Pibes', awayTeamName: 'La Banda' }));
  await setLive('live');
});

describe('predictions', () => {
  it('counts one vote per browser for the match on air', async () => {
    await predict('home', { dev: 1 });
    await predict('away', { dev: 2 });
    const result = await predict('home', { dev: 3 });
    expect(result).toEqual({ votes: { home: 2, away: 1 }, total: 3 });
    expect(await read(`${base}/predictions/m12`)).toMatchObject({ homeTeam: 'Los Pibes', awayTeam: 'La Banda', total: 3 });
    await rejects(predict('away', { dev: 1 }), /Ya votaste/);
    expect((await read(`${base}/predictions/m12`)).total).toBe(3);
  });

  it('is closed for a match that is not on air or already started', async () => {
    await rejects(vote({ kind: 'prediction', matchId: 'm13', choice: 'home' }), /no está por jugarse/);
    const closure = predictionClosure({ liveStatus: 'live', matchKey: KEY, overlay: { matchId: 'm12' }, prediction: null });
    await firestore.runTransaction(async tx => tx.set(`${base}/predictions/${closure.matchId}`, closure.data, { serverTimestamps: ['closedAt'] }));
    await rejects(predict('home'), /ya empezó/);
  });

  it(`caps votes from one connection at ${MAX_VOTES_PER_IP}`, async () => {
    for (let n = 1; n <= MAX_VOTES_PER_IP; n += 1) await predict('home', { dev: n, ip: 'bar' });
    await rejects(predict('home', { dev: 99, ip: 'bar' }), /Demasiados votos/);
    await predict('home', { dev: 100, ip: 'other' });
  });
});

describe('MVP', () => {
  it('accepts players who played, during the match', async () => {
    await mvp(12, { dev: 1 });
    expect(await mvp(10, { dev: 2 })).toEqual({ votes: { 12: 1, 10: 1 }, total: 2 });
    await rejects(mvp(999, { dev: 3 }), /no jugó/);
  });

  it('stays open 15 minutes after the end, then closes', async () => {
    const end = new Date(Date.now() - 60_000);
    await setLive('finished', end);
    await mvp(20, { dev: 1 });
    await rejects(mvp(20, { dev: 2, now: end.getTime() + MVP_GRACE_MS + 1 }), /ya cerró/);
  });
});

describe('cup poll', () => {
  const poll = { title: '¿Quién gana la Copa de Oro?', open: true, options: [{ id: 'team_7', name: 'Los Pibes' }, { id: 'team_9', name: 'La Banda' }] };
  const cup = (choice, opts) => vote({ kind: 'cup', pollId: 'copa-oro', choice }, opts);

  it('counts one vote per browser for an option of an open poll, keeping the admin fields', async () => {
    await seed(db => setDoc(doc(db, `${base}/polls/copa-oro`), poll));
    await cup('team_7');
    await cup('team_9', { dev: 2 });
    await rejects(cup('team_9'), /Ya votaste en esta encuesta/);
    await rejects(cup('team_1', { dev: 3 }), /no está en la encuesta/);
    expect(await read(`${base}/polls/copa-oro`)).toMatchObject({ ...poll, votes: { team_7: 1, team_9: 1 }, total: 2 });
  });

  it('is closed when the admin closes it or it does not exist', async () => {
    await rejects(cup('team_7'), /no existe/);
    await seed(db => setDoc(doc(db, `${base}/polls/copa-oro`), { ...poll, open: false }));
    await rejects(cup('team_7'), /cerrada/);
  });

  it('accepts a draw prediction', async () => {
    await predict('draw');
    expect((await read(`${base}/predictions/m12`)).votes).toEqual({ draw: 1 });
  });
});

describe('rules', () => {
  it('anyone reads the totals; nobody writes them or reads the ballots from the browser', async () => {
    await predict('home');
    const visitor = env.unauthenticatedContext().firestore();
    const fan = env.authenticatedContext('fan').firestore();
    await assertSucceeds(getDoc(doc(visitor, `${base}/predictions/m12`)));
    await assertSucceeds(getDoc(doc(visitor, `${base}/mvp_votes/${KEY}`)));
    await assertSucceeds(getDocs(collection(visitor, `${base}/mvp_votes`)));
    await assertFails(setDoc(doc(fan, `${base}/predictions/m12`), { votes: { home: 999 }, total: 999 }));
    await assertFails(setDoc(doc(fan, `${base}/mvp_votes/${KEY}`), { votes: { 10: 999 } }));
    await assertSucceeds(getDoc(doc(visitor, `${base}/polls/copa-oro`)));
    await assertFails(setDoc(doc(fan, `${base}/polls/copa-oro`), { open: true, votes: { team_7: 999 } }));
    await assertFails(getDoc(doc(fan, 'community_ballots/prediction_m12_h1')));
    await assertFails(getDoc(doc(fan, 'community_ip/prediction_m12_ip1')));
  });
});
