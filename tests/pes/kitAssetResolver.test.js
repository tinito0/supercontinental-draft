// Kit texture resolution: which files a kit needs, the provider order (workspace → cloud → local kit-server
// folder), caching, and the diagnostics. Synthetic providers prove the logic; the PSG block reads the real
// kit-server of the patch (skipped when E:/eFootball PES 2021 is not present).
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  kitAssetRefs, assetCandidates, kitDirOf, resolveAsset, resolveKitAssets, AssetCache,
  describeAsset, manifestKey, manifestEntry, shareableAssets,
} from '../../pes/kits/kitAssetResolver.js';
import { parseKitConfig, getKitValue } from '../../pes/kits/kitConfig.js';

const CFG = { KitFile: 'u0114p1', NameFontFile: 'u0114p1_name', BackNumbersFile: 'u0114p1_back', ChestNumbersFile: '', LegNumbersFile: 'u0114p1_leg' };
const value = k => CFG[k];
const bytes = s => new TextEncoder().encode(s);
const provider = (id, files, label = id) => ({ id, label, lookup: vi.fn(async p => files[p] || null) });
const DIR = 'Ligue 1/PSG/p1/';

describe('kitAssetRefs', () => {
  it('derives _srm and _nrm from KitFile and _ex from NameFontFile, as the game does', () => {
    const refs = Object.fromEntries(kitAssetRefs(value).map(r => [r.slot, r]));
    expect(refs.kit.file).toBe('u0114p1');
    expect(refs.srm.file).toBe('u0114p1_srm');
    expect(refs.nrm).toMatchObject({ file: 'u0114p1_nrm', optional: true, notGame: true });
    expect(refs.name_ex).toMatchObject({ file: 'u0114p1_name_ex', optional: true });
    expect(refs.chest.file).toBe(''); // ChestNumbersFile= (empty)
  });

  it('marks names that are not plain file names as invalid', () => {
    const refs = kitAssetRefs(k => (k === 'KitFile' ? '../evil' : ''));
    expect(refs.find(r => r.slot === 'kit').valid).toBe(false);
    expect(assetCandidates(DIR, '../evil')).toEqual([]);
  });

  it('builds candidates in the kit folder only, .ftex before .dds', () => {
    expect(kitDirOf('Ligue 1/PSG/p1/config.txt')).toBe(DIR);
    expect(assetCandidates(DIR, 'u0114p1').map(c => c.path)).toEqual([`${DIR}u0114p1.ftex`, `${DIR}u0114p1.dds`]);
  });
});

describe('resolveAsset', () => {
  const ref = kitAssetRefs(value).find(r => r.slot === 'back');

  it('asks providers in order and stops at the first hit', async () => {
    const ws = provider('workspace', {});
    const cloud = provider('cloud', { [`${DIR}u0114p1_back.ftex`]: bytes('cloud') });
    const local = provider('local', { [`${DIR}u0114p1_back.ftex`]: bytes('local') });
    const a = await resolveAsset(ref, DIR, [ws, cloud, local], new AssetCache());
    expect(a).toMatchObject({ status: 'found', source: 'cloud', ext: '.ftex', servedByKserv: true });
    expect(new TextDecoder().decode(a.bytes)).toBe('cloud');
    expect(local.lookup).not.toHaveBeenCalled();
  });

  it('prefers a workspace (imported) texture over the original', async () => {
    const a = await resolveAsset(ref, DIR, [provider('workspace', { [`${DIR}u0114p1_back.ftex`]: bytes('edited') }), provider('local', { [`${DIR}u0114p1_back.ftex`]: bytes('orig') })], new AssetCache());
    expect(a.source).toBe('workspace');
  });

  it('finds a .dds but flags that kserv.lua would not serve it', async () => {
    const a = await resolveAsset(ref, DIR, [provider('local', { [`${DIR}u0114p1_back.dds`]: bytes('d') })], new AssetCache());
    expect(a).toMatchObject({ status: 'found', ext: '.dds', servedByKserv: false });
    expect(describeAsset(a).level).toBe('warn');
  });

  it('reports missing, empty and failing lookups separately', async () => {
    expect((await resolveAsset(ref, DIR, [provider('local', {})], new AssetCache())).status).toBe('missing');
    const chest = kitAssetRefs(value).find(r => r.slot === 'chest');
    expect((await resolveAsset(chest, DIR, [provider('local', {})], new AssetCache())).status).toBe('empty');
    const broken = { id: 'cloud', label: 'nube', lookup: async () => { throw new Error('403'); } };
    const a = await resolveAsset(ref, DIR, [broken], new AssetCache());
    expect(a.status).toBe('error');
    expect(a.error).toContain('403');
  });

  it('continues with the next provider when one fails', async () => {
    const broken = { id: 'cloud', label: 'nube', lookup: async () => { throw new Error('offline'); } };
    const a = await resolveAsset(ref, DIR, [broken, provider('local', { [`${DIR}u0114p1_back.ftex`]: bytes('x') })], new AssetCache());
    expect(a).toMatchObject({ status: 'found', source: 'local' });
  });
});

describe('AssetCache', () => {
  it('shares one lookup between concurrent and repeated requests of the same file', async () => {
    const local = provider('local:1', { [`${DIR}u0114p1_back.ftex`]: bytes('x') });
    const cache = new AssetCache();
    const ref = kitAssetRefs(value).find(r => r.slot === 'back');
    await Promise.all([resolveAsset(ref, DIR, [local], cache), resolveAsset(ref, DIR, [local], cache)]);
    await resolveAsset(ref, DIR, [local], cache);
    expect(local.lookup).toHaveBeenCalledTimes(1);
  });

  it('does not cache failures, and forgets a provider on request', async () => {
    let fail = true;
    const p = { id: 'cloud:1', label: 'nube', lookup: vi.fn(async () => { if (fail) throw new Error('x'); return bytes('ok'); }) };
    const cache = new AssetCache();
    await expect(cache.get(p, 'a.ftex')).rejects.toThrow();
    fail = false;
    expect(await cache.get(p, 'a.ftex')).toBeTruthy();
    expect(p.lookup).toHaveBeenCalledTimes(2);
    cache.dropProvider('cloud:1');
    expect(cache.size).toBe(0);
  });

  it('retainOnly keeps one id per provider kind, freeing replaced ones', async () => {
    const cache = new AssetCache();
    const mk = id => ({ id, label: id, lookup: async () => bytes(id) });
    for (const id of ['cloud:ws:1', 'cloud:ws:2', 'local:a:1']) await cache.get(mk(id), 'x.ftex');
    cache.retainOnly('cloud:', 'cloud:ws:2');
    expect([...cache.map.keys()]).toEqual(['cloud:ws:2|x.ftex', 'local:a:1|x.ftex']);
    cache.retainOnly('local:', null);
    expect(cache.size).toBe(1);
  });

  it('resolves every slot of a kit and lists what a share would upload', async () => {
    const local = provider('local', {
      [`${DIR}u0114p1_name.ftex`]: bytes('n'), [`${DIR}u0114p1_back.ftex`]: bytes('b'), [`${DIR}u0114p1_leg.ftex`]: bytes('l'),
    });
    const all = await resolveKitAssets({ value, configPath: `${DIR}config.txt`, providers: [local], cache: new AssetCache() });
    const by = Object.fromEntries(all.map(a => [a.slot, a.status]));
    expect(by).toEqual({ kit: 'missing', srm: 'missing', nrm: 'missing', name: 'found', name_ex: 'missing', back: 'found', chest: 'empty', leg: 'found' });
    expect(shareableAssets(all).map(a => a.slot)).toEqual(['name', 'back', 'leg']);
  });
});

describe('describeAsset', () => {
  const missing = slot => ({ ...kitAssetRefs(value).find(r => r.slot === slot), status: 'missing' });
  it('only warns about required files; optional and _nrm are informational', () => {
    expect(describeAsset(missing('kit')).level).toBe('warn');
    expect(describeAsset(missing('kit'), { localAvailable: true }).text).toContain('livecpk');
    expect(describeAsset(missing('srm')).level).toBe('info');
    expect(describeAsset(missing('nrm')).text).toContain('no lo usa');
  });
});

describe('cloud manifest keys', () => {
  it('encodes paths without "." or "/" and looks them up case-insensitively', () => {
    const key = manifestKey('Ligue 1/PSG/p1/u0114p1_back.ftex');
    expect(key).not.toMatch(/[./]/);
    const files = { [key]: { sha256: 'a'.repeat(64), ext: '.ftex' } };
    expect(manifestEntry(files, 'ligue 1/psg/p1/U0114P1_BACK.ftex')).toBe(files[key]);
    expect(manifestEntry(files, 'Ligue 1/PSG/p2/u0114p1_back.ftex')).toBeNull();
    expect(manifestEntry(null, 'x')).toBeNull();
  });

  it('ignores entries whose hash or extension could not be a content-addressed texture', () => {
    const p = 'Ligue 1/PSG/p1/u0114p1.ftex';
    const bad = e => manifestEntry({ [manifestKey(p)]: e }, p);
    expect(bad({ sha256: '../../x', ext: '.ftex' })).toBeNull();
    expect(bad({ sha256: 'a'.repeat(64), ext: '/../x' })).toBeNull();
    expect(bad({ sha256: 'A'.repeat(64), ext: '.ftex' })).toBeNull();
    expect(bad({ sha256: 'a'.repeat(64), ext: '.dds' })).not.toBeNull();
  });
});

// Real files: PSG (team 114) in the UML patch. Its p1 folder holds the name/back/leg sheets but not u0114p1.ftex,
// which the patch keeps in livecpk/UML_Kits (outside the kit-server); p1x1 holds the kit texture too.
const PSG = 'E:/eFootball PES 2021/content/kit-server/Ligue 1/PSG';
describe.skipIf(!fs.existsSync(PSG))('PSG kit-server folder (real files)', () => {
  const diskProvider = { id: 'local:disk', label: 'disco', lookup: async rel => { const f = path.join('E:/eFootball PES 2021/content/kit-server', rel); return fs.existsSync(f) ? new Uint8Array(fs.readFileSync(f)) : null; } };
  const resolveKit = async kit => {
    const cfg = parseKitConfig(fs.readFileSync(path.join(PSG, kit, 'config.txt'), 'utf8'));
    return Object.fromEntries((await resolveKitAssets({ value: k => getKitValue(cfg, k), configPath: `Ligue 1/PSG/${kit}/config.txt`, providers: [diskProvider], cache: new AssetCache() })).map(a => [a.slot, a.status]));
  };

  it('p1: finds the font sheets in the kit folder; the kit texture is not in the kit-server', async () => {
    expect(await resolveKit('p1')).toMatchObject({ kit: 'missing', name: 'found', back: 'found', leg: 'found', chest: 'empty' });
  });

  it('p1x1: finds the kit texture as well', async () => {
    expect(await resolveKit('p1x1')).toMatchObject({ kit: 'found', name: 'found', back: 'found', leg: 'found' });
  });

  it('uefa/p2: finds the extra-letters sheet (NameFontFile + _ex)', async () => {
    expect((await resolveKit('uefa/p2')).name_ex).toBe('found');
  });
});
