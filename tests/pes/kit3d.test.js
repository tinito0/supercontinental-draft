import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseKitPack, selectKitParts, fitParts } from '../../pes/kits/kitModels.js';
import { parseSiderRoots, textureCandidates, kitTextureFiles } from '../../pes/kits/textureLocator.js';
import { parseKitConfig, getKitValue } from '../../pes/kits/kitConfig.js';
import { SYNTHETIC_KIT_CONFIG } from './fixtures.js';
import { readerFromFiles } from '../../components/pes/kit3d/gameFolder.js';

const PACK = path.resolve(__dirname, '../../public/kit3d/kitpack.bin');

describe('kit models for the 3D preview', () => {
  let pack;
  beforeAll(() => { pack = parseKitPack(new Uint8Array(fs.readFileSync(PACK))); });

  it('contains every garment part the config can ask for', () => {
    for (const n of ['shirt_out', 'shirt_in_tight', 'sleeve_short', 'sleeve_long_kappa', 'sleeve_gk', 'socks_long', 'pants_016', 'collar_002']) expect(pack.has(n), n).toBe(true);
    const shirt = pack.get('shirt_out').meshes[0];
    expect(shirt.idx.length % 3).toBe(0);
    expect(Math.max(...shirt.idx)).toBeLessThan(shirt.pos.length / 3);
    expect(shirt.uv.every(v => v >= 0 && v <= 1)).toBe(true);
  });

  it('picks the parts from config.txt values (tight kit, collar, shorts model)', () => {
    const values = { TightKit: '1', Collar: '2', ShortsModel: '3', ShortSleevesModel: '1' };
    const { parts, collar, collarExact } = selectKitParts(pack, k => values[k], { sleeve: 'long' });
    expect(parts.map(p => p.k)).toEqual(['shirt', 'sleeve', 'shorts', 'socks', 'collar']);
    expect([collar, collarExact]).toEqual(['collar_002', true]);
    const gk = selectKitParts(pack, k => values[k], { goalkeeper: true });
    const gkSleeve = gk.parts.find(p => p.k === 'sleeve').m.meshes[0];
    expect(gkSleeve.pos.length).toBe(pack.get('sleeve_gk_tight').meshes[0].pos.length);
  });

  it('frames the kit facing the camera', () => {
    const { parts } = selectKitParts(pack, () => null, {});
    const fit = fitParts(parts);
    expect(fit.radius).toBeGreaterThan(0);
    expect([1, -1]).toContain(fit.mirror);
    expect(Number.isFinite(fit.yaw0)).toBe(true);
  });
});

describe('kit texture lookup order', () => {
  it('reads cpk.root entries of sider.ini in order, skipping comments', () => {
    const ini = '[sider]\ncpk.root = ".\\livecpk\\UML_Database"\n;cpk.root = ".\\livecpk\\Off"\ncpk.root = ".\\livecpk\\UML_Kits"   ; kits\n';
    expect(parseSiderRoots(ini)).toEqual(['livecpk/UML_Database', 'livecpk/UML_Kits']);
  });

  it('looks only in the kit folder of the kit-server (.ftex first), never in livecpk', () => {
    expect(textureCandidates('Bundesliga/Dortmund/p1/config.txt', 'u0126p1')).toEqual([
      'Bundesliga/Dortmund/p1/u0126p1.ftex',
      'Bundesliga/Dortmund/p1/u0126p1.dds',
    ]);
    expect(textureCandidates('content/kit-server/Ligue 1/PSG/p1/config.txt', 'u0114p1_back')[0]).toBe('Ligue 1/PSG/p1/u0114p1_back.ftex');
    expect(textureCandidates('a/b/config.txt', '../evil')).toEqual([]);
  });

  it('reads a chosen game folder or kit-server folder, matching paths case-insensitively', async () => {
    const file = (rel, text = 'x') => ({ name: rel.split('/').pop(), webkitRelativePath: rel, arrayBuffer: async () => new TextEncoder().encode(text).buffer });
    const game = await readerFromFiles([
      file('PES/content/kit-server/map.txt', '114, "Ligue 1\PSG"'),
      file('PES/content/kit-server/Ligue 1/PSG/p1/u0114p1_name.ftex', 'name'),
      file('PES/livecpk/UML_Kits/Asset/model/character/uniform/texture/#windx11/u0114p1.ftex', 'kit'),
    ]);
    expect(game.kind).toBe('game');
    expect(new TextDecoder().decode(await game.readKit('ligue 1/psg/p1/U0114P1_NAME.ftex'))).toBe('name');
    expect(await game.readKit('Ligue 1/PSG/p1/u0114p1.ftex')).toBeNull(); // only in livecpk: not searched
    const ks = await readerFromFiles([file('kit-server/map.txt'), file('kit-server/Ligue 1/PSG/p1/u0114p1_leg.ftex', 'leg')]);
    expect(ks.kind).toBe('kit-server');
    expect(new TextDecoder().decode(await ks.readKit('Ligue 1/PSG/p1/u0114p1_leg.ftex'))).toBe('leg');
    const other = await readerFromFiles([file('Pictures/a.png')]);
    expect(other.kind).toBe('unknown');
    expect(await other.readKit('x/y.ftex')).toBeNull();
  });

  it('lists the textures a kit needs from its config', () => {
    const cfg = parseKitConfig(SYNTHETIC_KIT_CONFIG);
    const files = kitTextureFiles(k => getKitValue(cfg, k));
    expect(files.nrm).toBe(`${files.kit}_nrm`);
    expect(files.srm).toBe(`${files.kit}_srm`);
    expect(Object.keys(files)).toEqual(['kit', 'srm', 'nrm', 'name', 'name_ex', 'back', 'chest', 'leg']);
  });
});
