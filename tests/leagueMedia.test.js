// Synthetic requests and a fake fetch: covers the function's validation and its Storage calls, not a real bucket.
import {
  canUploadMedia, LEAGUE_MEDIA_BUCKET, LeagueMediaError, MEDIA_LIMITS, parseMediaRequest, publicMediaUrl, storeMedia,
} from '../supabase/functions/_shared/leagueMedia.js';

const params = query => new URLSearchParams(query);
const NOW = 1_700_000_000_000;

describe('parseMediaRequest', () => {
  it('builds a fresh kit path per upload', () => {
    const media = parseMediaRequest(params('kind=kit&team=abc_123&slot=away'), { contentType: 'image/png', size: 10, now: NOW });
    expect(media).toMatchObject({ kind: 'kit', teamId: 'abc_123', slot: 'away', contentType: 'image/png' });
    expect(media.path).toBe(`kits/abc_123/away-${NOW.toString(36)}.png`);
  });

  it('builds a crest path without a slot', () => {
    const media = parseMediaRequest(params('kind=crest&team=u1'), { contentType: 'image/webp; charset=binary', size: 10, now: NOW });
    expect(media.path).toBe(`crests/u1-${NOW.toString(36)}.webp`);
  });

  it.each([
    ['kind=logo&team=u1', 'image/png', 10, 400],
    ['kind=kit&team=../x&slot=home', 'image/png', 10, 400],
    ['kind=kit&team=u1&slot=fourth', 'image/png', 10, 400],
    ['kind=kit&team=u1&slot=home', 'image/svg+xml', 10, 415],
    ['kind=kit&team=u1&slot=home', 'image/png', 0, 400],
    ['kind=crest&team=u1', 'image/png', MEDIA_LIMITS.crest + 1, 413],
    ['kind=kit&team=u1&slot=home', 'image/png', MEDIA_LIMITS.kit + 1, 413],
  ])('rejects %s (%s, %d bytes)', (query, contentType, size, status) => {
    let error;
    try { parseMediaRequest(params(query), { contentType, size }); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(LeagueMediaError);
    expect(error.status).toBe(status);
  });
});

describe('canUploadMedia', () => {
  it('lets editors upload kits but not crests', () => {
    expect(canUploadMedia('kit', { isAdmin: false, isEditor: true })).toBe(true);
    expect(canUploadMedia('crest', { isAdmin: false, isEditor: true })).toBe(false);
    expect(canUploadMedia('crest', { isAdmin: true, isEditor: false })).toBe(true);
    expect(canUploadMedia('kit', { isAdmin: false, isEditor: false })).toBe(false);
  });
});

describe('storeMedia', () => {
  const base = { supabaseUrl: 'https://p.supabase.co/', serviceKey: 'k', path: 'kits/u1/home-x.png', contentType: 'image/png', body: new Uint8Array([1]) };
  const res = (status, text = '') => new Response(text, { status });

  it('uploads and returns the public link', async () => {
    const calls = [];
    const fetchImpl = async (url, init) => { calls.push([url, init]); return res(200, '{}'); };
    const url = await storeMedia({ ...base, fetchImpl });
    expect(url).toBe(publicMediaUrl('https://p.supabase.co', base.path));
    expect(url).toBe(`https://p.supabase.co/storage/v1/object/public/${LEAGUE_MEDIA_BUCKET}/kits/u1/home-x.png`);
    expect(calls).toHaveLength(1);
    expect(calls[0][1].headers['x-upsert']).toBe('false');
  });

  it('creates the public bucket the first time and retries', async () => {
    const responses = [res(400, '{"error":"Bucket not found"}'), res(200, '{}'), res(200, '{}')];
    const calls = [];
    const fetchImpl = async (url, init) => { calls.push([url, init]); return responses.shift(); };
    await storeMedia({ ...base, fetchImpl });
    expect(calls.map(([url]) => url)).toEqual([
      `https://p.supabase.co/storage/v1/object/${LEAGUE_MEDIA_BUCKET}/kits/u1/home-x.png`,
      'https://p.supabase.co/storage/v1/bucket',
      `https://p.supabase.co/storage/v1/object/${LEAGUE_MEDIA_BUCKET}/kits/u1/home-x.png`,
    ]);
    expect(JSON.parse(calls[1][1].body)).toMatchObject({ id: LEAGUE_MEDIA_BUCKET, public: true });
  });

  it('fails on other errors without creating a bucket', async () => {
    let count = 0;
    const fetchImpl = async () => { count += 1; return res(403, 'denied'); };
    await expect(storeMedia({ ...base, fetchImpl })).rejects.toThrow(/403/);
    expect(count).toBe(1);
  });
});
