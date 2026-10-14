import { describe, it, expect } from 'vitest';
import { parseKitConfig, serializeKitConfig, setKitValue, getKitValue, parseRangeComment, parseKitMap, kitPreviewModel } from '../../pes/kits/kitConfig.js';
import { KitWorkspace, kitCategory } from '../../pes/kits/kitWorkspace.js';
import { encodeFtex, inspectFtex } from '../../pes/kits/ftex.js';
import { glyphCell, charsOf, sheetSize, fontFileName, fontLibrary, encodeFontSheet, FONT_SLOTS } from '../../pes/kits/kitFonts.js';
import { textureFromFile, textureFromPixels, targetFileName, inspectDds } from '../../pes/kits/kitTextures.js';
import { SYNTHETIC_KIT_CONFIG, syntheticKitServer, hasKitServer, readKitServer, KIT_SERVER_DIR } from './fixtures.js';
import fs from 'node:fs';
import path from 'node:path';

describe('kit config.txt (synthetic, patch format)', () => {
  it('round-trips byte for byte', () => {
    expect(serializeKitConfig(parseKitConfig(SYNTHETIC_KIT_CONFIG))).toBe(SYNTHETIC_KIT_CONFIG);
  });

  it('changes only the edited value and keeps the comment column', () => {
    const cfg = parseKitConfig(SYNTHETIC_KIT_CONFIG);
    const { cfg: next, before, after } = setKitValue(cfg, 'Collar', 120);
    expect([before, after]).toEqual(['1', '120']);
    const a = SYNTHETIC_KIT_CONFIG.split('\r\n'), b = serializeKitConfig(next).split('\r\n');
    const diff = a.map((l, i) => (l === b[i] ? null : i)).filter(i => i !== null);
    expect(diff).toEqual([2]);
    expect(b[2].indexOf(';')).toBe(a[2].indexOf(';'));
    expect(getKitValue(cfg, 'Collar')).toBe('1'); // input not mutated
  });

  it('enforces the ranges documented in the patch comments', () => {
    const cfg = parseKitConfig(SYNTHETIC_KIT_CONFIG);
    expect(() => setKitValue(cfg, 'Collar', 131)).toThrow(expect.objectContaining({ code: 'OUT_OF_RANGE' }));
    expect(() => setKitValue(cfg, 'TightKit', 2)).toThrow(expect.objectContaining({ code: 'OUT_OF_RANGE' }));
    expect(() => setKitValue(cfg, 'ShirtModel', 150)).toThrow(expect.objectContaining({ code: 'OUT_OF_RANGE' }));
    expect(setKitValue(cfg, 'ShirtModel', 176).after).toBe('176');
    expect(() => setKitValue(cfg, 'Collar', 'abc')).toThrow(expect.objectContaining({ code: 'TYPE' }));
  });

  it('validates colours, asset references and read-only keys', () => {
    const cfg = parseKitConfig(SYNTHETIC_KIT_CONFIG);
    expect(setKitValue(cfg, 'UniColor_Color2', '#00ff00').after).toBe('#00FF00');
    expect(() => setKitValue(cfg, 'ShirtColor1', 'red')).toThrow(expect.objectContaining({ code: 'INVALID_COLOR' }));
    expect(() => setKitValue(cfg, 'KitFile', '../evil')).toThrow(expect.objectContaining({ code: 'INVALID_ASSET_REF' }));
    expect(() => setKitValue(cfg, 'Unk_Offset0x1C_Bits0to1', 1)).toThrow(expect.objectContaining({ code: 'FIELD_READ_ONLY' }));
    expect(() => setKitValue(cfg, 'NameY', 3)).toThrow(expect.objectContaining({ code: 'UNKNOWN_FIELD' }));
  });

  it('parses range comments', () => {
    expect(parseRangeComment('; 1 to 130')).toEqual({ type: 'range', min: 1, max: 130 });
    expect(parseRangeComment('; 0=Off, 1=On')).toMatchObject({ type: 'enum', values: [0, 1] });
    expect(parseRangeComment('; 1 to 16 (17 and above tend make some parts black')).toMatchObject({ type: 'range', min: 1, max: 16 });
    expect(parseRangeComment('; free text')).toBeNull();
  });

  it('builds a preview model only from config values', () => {
    expect(kitPreviewModel(parseKitConfig(SYNTHETIC_KIT_CONFIG))).toMatchObject({ shirtColor1: '#D12B2B', menuColor2: '#FFFFFF', collar: '1' });
  });
});

describe('kit-server workspace (synthetic)', () => {
  const make = () => { const s = syntheticKitServer(); return new KitWorkspace(s.texts, s.all); };

  it('maps team ids to kits with categories', () => {
    expect(parseKitMap('101,\t"Premier League\\Arsenal"').get(101)).toBe('Premier League/Arsenal');
    const ws = make();
    expect(ws.kitsOf(9999).map(k => [k.kit, k.category, k.inOrder])).toEqual([['g1', 'goalkeeper', true], ['p1', 'player', true]]);
    expect(kitCategory('epl/p2')).toBe('player');
    expect(() => ws.kitsOf(1)).toThrow(expect.objectContaining({ code: 'NO_KITS' }));
  });

  it('tracks modified files and texture references', () => {
    const ws = make();
    ws.setValue(9999, 'p1', 'ShirtColor1', '#000000');
    expect(Object.keys(ws.modifiedFiles())).toEqual(['content/kit-server/Test League/Test FC/p1/config.txt']);
    ws.setValue(9999, 'p1', 'ShirtColor1', '#D12B2B');
    expect(ws.modifiedFiles()).toEqual({});
    const refs = Object.fromEntries(ws.textureRefs(9999, 'p1').map(r => [r.key, r.status]));
    expect(refs).toMatchObject({ NameFontFile: 'present', KitFile: 'external', BackNumbersFile: 'empty' });
  });
});

describe('FTEX + kit fonts', () => {
  it('encodes a texture that the inspector accepts (synthetic)', () => {
    const px = new Uint8Array(128 * 32 * 4).map((_, i) => (i * 37) % 256);
    const info = inspectFtex(encodeFtex(px, 128, 32));
    expect(info).toMatchObject({ format: 'DXT5', width: 128, height: 32, mips: 8 });
  });

  it('rejects invalid sizes and corrupt textures', () => {
    expect(() => encodeFtex(new Uint8Array(12), 3, 1)).toThrow(expect.objectContaining({ code: 'FTEX_SIZE' }));
    const t = encodeFtex(new Uint8Array(64 * 64 * 4).map((_, i) => i % 200), 64, 64);
    expect(() => inspectFtex(t.subarray(0, t.length - 10))).toThrow();
    expect(() => inspectFtex(new Uint8Array(100))).toThrow(expect.objectContaining({ code: 'NOT_FTEX' }));
  });

  it('keeps every glyph cell inside the sheet', () => {
    for (const slot of FONT_SLOTS) for (const w of [1024, 2048, 4096]) {
      const [W, H] = sheetSize(slot.kind, w);
      for (const ch of charsOf(slot.kind)) {
        const [x, y, cw, chh] = glyphCell(slot.kind, ch, W, H);
        expect(x >= 0 && y >= 0 && x + cw <= W && y + chh <= H, `${slot.kind} ${ch} ${w}`).toBe(true);
      }
    }
  });

  it('produces valid sheet names and encodes a font sheet', () => {
    expect(fontFileName('Club Font #1', 'name')).toBe('club_font_1_name');
    const [W, H] = sheetSize('back', 1024);
    const { info } = encodeFontSheet(new Uint8Array(W * H * 4), 'back', 1024);
    expect(info).toMatchObject({ width: 1024, height: 128 });
  });

  it('lists fonts used by the kit-server (synthetic)', () => {
    const s = syntheticKitServer();
    const lib = fontLibrary(new KitWorkspace(s.texts, s.all));
    expect(lib.name).toEqual([expect.objectContaining({ file: 'test_name', present: true })]);
    expect(lib.name[0].usedBy).toHaveLength(3);
  });

  it('applies a generated font as a kit asset (synthetic)', () => {
    const s = syntheticKitServer();
    const ws = new KitWorkspace(s.texts, s.all);
    const bytes = encodeFtex(new Uint8Array(64 * 8 * 4), 64, 8);
    const r = ws.setTextureAsset(9999, 'p1', 'back', 'club_back', bytes);
    expect(r.assetPath).toBe('Test League/Test FC/p1/club_back.ftex');
    expect(Object.keys(ws.assetFiles())).toEqual(['content/kit-server/Test League/Test FC/p1/club_back.ftex']);
    expect(ws.textureRefs(9999, 'p1').find(t => t.key === 'BackNumbersFile').status).toBe('present');
  });
});

describe('kit texture import', () => {
  // SYNTHETIC: minimal DDS header (DXT5 fourCC) for header validation only.
  const syntheticDds = (w, h) => {
    const b = new Uint8Array(128 + w * h);
    b.set([0x44, 0x44, 0x53, 0x20]);
    const dv = new DataView(b.buffer);
    dv.setUint32(4, 124, true); dv.setUint32(12, h, true); dv.setUint32(16, w, true);
    b.set([0x44, 0x58, 0x54, 0x35], 84);
    return b;
  };

  it('keeps an imported .ftex byte for byte after checking it', () => {
    const t = encodeFtex(new Uint8Array(256 * 64 * 4), 256, 64);
    const r = textureFromFile('name', 'club_name.ftex', t);
    expect(r.bytes).toBe(t);
    expect(r.info).toMatchObject({ width: 256, height: 64 });
  });

  it('validates .dds imports (synthetic header)', () => {
    expect(textureFromFile('kit', 'u1p1.dds', syntheticDds(16, 16)).info).toMatchObject({ format: 'DXT5', width: 16 });
    expect(() => inspectDds(new Uint8Array(200))).toThrow(expect.objectContaining({ code: 'NOT_DDS' }));
    expect(() => textureFromFile('kit', 'a.gif', new Uint8Array(4))).toThrow(expect.objectContaining({ code: 'UNSUPPORTED_TEXTURE' }));
  });

  it('converts decoded image pixels to FTEX and enforces font proportions', () => {
    const r = textureFromPixels('kit', new Uint8Array(1000 * 1000 * 4).fill(128), 1000, 1000);
    expect(r.info).toMatchObject({ format: 'DXT5', width: 1024, height: 1024 });
    expect(textureFromPixels('srm', new Uint8Array(64 * 64 * 4), 64, 64).info.format).toBe('DXT1');
    expect(textureFromPixels('back', new Uint8Array(800 * 100 * 4), 800, 100).info).toMatchObject({ width: 1024, height: 128 });
    expect(() => textureFromPixels('name', new Uint8Array(100 * 100 * 4), 100, 100)).toThrow(expect.objectContaining({ code: 'BAD_ASPECT' }));
  });

  it('names derived maps after KitFile', () => {
    expect(targetFileName('nrm', 'u0101p1')).toBe('u0101p1_nrm');
    expect(targetFileName('kit', 'u0101p1', 'club_home')).toBe('club_home');
    expect(() => targetFileName('srm', '')).toThrow(expect.objectContaining({ code: 'NO_KITFILE' }));
    expect(() => targetFileName('kit', '', '../x')).toThrow(expect.objectContaining({ code: 'INVALID_ASSET_REF' }));
  });

  it('refuses a .dds that an existing .ftex of the same name would shadow (synthetic)', () => {
    const s = syntheticKitServer();
    const ws = new KitWorkspace(s.texts, s.all);
    expect(() => ws.setTextureAsset(9999, 'p1', 'name', 'test_name', syntheticDds(16, 4), '.dds')).toThrow(expect.objectContaining({ code: 'SHADOWED_TEXTURE' }));
    const kitTex = encodeFtex(new Uint8Array(16 * 16 * 4), 16, 16);
    ws.setTextureAsset(9999, 'p1', 'kit', 'club_p1', kitTex);
    ws.setTextureAsset(9999, 'p1', 'nrm', 'club_p1_nrm', kitTex);
    expect(() => ws.setTextureAsset(9999, 'p1', 'srm', 'other_srm', kitTex)).toThrow(expect.objectContaining({ code: 'INVALID_ASSET_REF' }));
    expect(Object.keys(ws.assetFiles()).sort()).toEqual([
      'content/kit-server/Test League/Test FC/p1/club_p1.ftex', 'content/kit-server/Test League/Test FC/p1/club_p1_nrm.ftex']);
  });
});

describe.skipIf(!hasKitServer)('real kit-server of the patch (read-only)', () => {
  it('imports a real BC7 font texture unchanged', () => {
    const f = path.join(KIT_SERVER_DIR, '2. Bundesliga/Bochum/p1/u4128p1_name.ftex');
    if (!fs.existsSync(f)) return;
    const bytes = new Uint8Array(fs.readFileSync(f));
    expect(textureFromFile('name', 'u4128p1_name.ftex', bytes).info).toMatchObject({ format: 'BC7', width: 2048, height: 512 });
  });

  it('parses and re-serializes every config.txt exactly', () => {
    const { texts, all } = readKitServer();
    const ws = new KitWorkspace(texts, all);
    expect(ws.configs.size).toBeGreaterThan(1000);
    for (const [p, cfg] of ws.configs) expect(serializeKitConfig(cfg), p).toBe(texts.get(p));
    expect(ws.map.size).toBeGreaterThan(500);
  }, 180_000);

  it('reads real font textures (BC7) structurally', () => {
    const arsenal = path.join(KIT_SERVER_DIR, '2. Bundesliga/Bochum/p1/u4128p1_name.ftex');
    if (!fs.existsSync(arsenal)) return;
    expect(inspectFtex(new Uint8Array(fs.readFileSync(arsenal)))).toMatchObject({ format: 'BC7', width: 2048, height: 512 });
  });
});
