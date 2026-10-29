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
import { isMarketOpen, isMarketAdmin, getCatalogPlayer } from '../supabase/functions/_shared/market.js';
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
