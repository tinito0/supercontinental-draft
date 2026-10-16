// config.txt → 3D preview: values reach the render, problems are reported, collars are real models,
// and the glyph cells line up with real kit-server font sheets.
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseKitConfig, setKitValue } from '../../pes/kits/kitConfig.js';
import { resolveKitRender, printedNumber, availableCollars } from '../../pes/kits/kitRenderConfig.js';
import { parseKitPack, selectKitParts, collarModel } from '../../pes/kits/kitModels.js';
import { decodeFtex } from '../../pes/kits/textureDecode.js';
import { KitFont } from '../../components/pes/kit3d/kitDecals.js';

// Real config.txt from the patch (content/kit-server/2. Bundesliga/1860 München/g1, written by Kit Studio 2021).
const REAL = fs.readFileSync(path.resolve(__dirname, 'fixtures/kitstudio-config.txt'), 'utf8');
const PACK = path.resolve(__dirname, '../../public/pes/kitpack.bin');
const KIT_SERVER = 'E:/eFootball PES 2021/content/kit-server';
const edit = (text, values) => Object.entries(values).reduce((cfg, [k, v]) => setKitValue(cfg, k, v).cfg, parseKitConfig(text));
const withLine = (text, key, line) => text.replace(new RegExp(`^${key}=.*$`, 'm'), line);

describe('resolveKitRender (real Kit Studio config.txt)', () => {
  it('reads the real file without notes about missing or malformed values', () => {
    const r = resolveKitRender(parseKitConfig(REAL));
    // ShortsModel=0: the comment says 1 to 16 but kserv.lua accepts 0 to 17, so it is kept and only noted.
    expect(r.notes.filter(n => n.level === 'warn')).toEqual([]);
    expect(r.notes).toContainEqual(expect.objectContaining({ key: 'ShortsModel', level: 'info' }));
    expect(r.shortsModel).toBe(0);
    expect(r.values.ShortsModel).toEqual({ raw: '0', used: 0 });
    expect(r.collar).toBe(34);
    expect(r.name).not.toBeNull();
    expect(r.chest).toBeNull(); // ChestNumbersFile= (empty)
    expect(r.shorts).toMatchObject({ left: true, side: 0, x: 20, y: 8, size: 16 });
  });

  it('places the name and back number from NameY/NameSize/BackNumberY values', () => {
    const base = resolveKitRender(parseKitConfig(REAL));
    const higher = resolveKitRender(edit(REAL, { NameY: '20', BackNumberSize: '28' }));
    expect(higher.name.v).toBeLessThan(base.name.v); // lower NameY = further from the collar (back panel: collar at high v)
    expect(higher.back.H).toBeGreaterThan(base.back.H);
    expect(resolveKitRender(edit(REAL, { Name: '1' })).name).toBeNull();
    expect(resolveKitRender(edit(REAL, { NameShape: '3' })).name.curvature).toBeGreaterThan(base.name.curvature);
  });

  it('applies BackNumberType (forced two digits) to the printed number', () => {
    expect(printedNumber(resolveKitRender(parseKitConfig(REAL)), '7')).toBe('7');
    expect(printedNumber(resolveKitRender(edit(REAL, { BackNumberType: '1' })), '7')).toBe('07');
    expect(printedNumber(resolveKitRender(parseKitConfig(REAL)), '1a23')).toBe('12');
  });

  it('hides the shorts number with 30 or 31 and keeps the side', () => {
    expect(resolveKitRender(edit(REAL, { ShortsNumberX: '30' })).shorts).toBeNull();
    expect(resolveKitRender(edit(REAL, { ShortsNumberSide: '1' })).shorts.left).toBe(false);
  });

  it('respects SleeveLimits, LongSleevesType and the winter collar', () => {
    const cfg = edit(REAL, { Collar: '10', WinterCollar: '20' });
    expect(resolveKitRender(cfg, { sleeve: 'short' })).toMatchObject({ sleeve: 'short', collar: 10, collarKey: 'Collar' });
    expect(resolveKitRender(cfg, { sleeve: 'long' })).toMatchObject({ sleeve: 'long', collar: 20, collarKey: 'WinterCollar', undershirtOnly: false });
    const onlyLong = parseKitConfig(withLine(REAL, 'SleeveLimits', 'SleeveLimits=1   ; 0=No limits, 1=Only long sleeves, 2 = Only short sleeves'));
    const r = resolveKitRender(onlyLong, { sleeve: 'short' });
    expect([r.sleeve, r.sleeveLimit]).toEqual(['long', 'long']);
    expect(r.notes.some(n => n.key === 'SleeveLimits')).toBe(true);
    expect(resolveKitRender(edit(REAL, { LongSleevesType: '187' }), { sleeve: 'long' }).undershirtOnly).toBe(true);
    expect(resolveKitRender(edit(REAL, { LongSleevesType: '187' }), { sleeve: 'short' }).undershirtOnly).toBe(false);
  });

  it('previews a collar without changing the saved one', () => {
    const r = resolveKitRender(parseKitConfig(REAL), { collarPreview: 77 });
    expect([r.collar, r.savedCollar]).toEqual([77, 34]);
  });

  it('reports missing, malformed and out-of-range values instead of hiding them', () => {
    const noNameY = parseKitConfig(REAL.replace(/^NameY=.*\r?\n/m, ''));
    expect(resolveKitRender(noNameY).notes).toContainEqual(expect.objectContaining({ key: 'NameY', level: 'warn' }));
    const bad = parseKitConfig(withLine(REAL, 'NameSize', 'NameSize=big    ; 0 to 20'));
    expect(resolveKitRender(bad).notes).toContainEqual(expect.objectContaining({ key: 'NameSize', level: 'warn' }));
    const out = parseKitConfig(withLine(REAL, 'BackNumberY', 'BackNumberY=99   ; 0 to 29'));
    const r = resolveKitRender(out);
    expect(r.notes).toContainEqual(expect.objectContaining({ key: 'BackNumberY' }));
    // outside kserv.lua's 0 to 29: drawn at 29, the top of the game's range (region against the collar)
    expect(r.back.vTop).toBeCloseTo(0.2755729854106903 / 0.627451);
  });

  it('says what the preview cannot draw', () => {
    const notes = resolveKitRender(edit(REAL, { ShirtModel: '151' })).notes.map(n => n.key);
    expect(notes).toContain('ShirtModel');
    expect(notes).toContain('RightShortX');
  });
});

describe('collar variants are real models', () => {
  let pack;
  beforeAll(() => { pack = parseKitPack(new Uint8Array(fs.readFileSync(PACK))); });

  it('lists only collars inside the Collar range (kserv.lua: 1 to 135) that exist in the pack', () => {
    const list = availableCollars(pack, parseKitConfig(REAL));
    expect(list[0]).toBe(1);
    expect(list.at(-1)).toBeLessThanOrEqual(135);
    expect(list.length).toBeGreaterThanOrEqual(130);
    expect(list.every(n => collarModel(pack, n))).toBe(true);
  });

  it('each collar option changes the collar mesh on the kit', () => {
    const value = k => ({ Collar: '34' })[k];
    const meshOf = n => selectKitParts(pack, value, { collar: n }).parts.find(p => p.k === 'collar').m.meshes[0];
    const differs = (a, b) => a.pos.length !== b.pos.length || a.pos.some((v, i) => v !== b.pos[i]);
    expect(selectKitParts(pack, value, { collar: 100 }).collar).toBe('collar_100');
    expect(differs(meshOf(1), meshOf(34))).toBe(true);
    expect(differs(meshOf(34), meshOf(100))).toBe(true);
    expect(differs(meshOf(34), meshOf(34))).toBe(false);
  });

  it('wears a long undershirt under short sleeves for LongSleevesType 187', () => {
    const { parts } = selectKitParts(pack, () => null, { sleeve: 'long', undershirtOnly: true });
    const mesh = k => parts.find(p => p.k === k).m.meshes[0];
    expect(mesh('sleeve').pos.length).toBe(pack.get('sleeve_short').meshes[0].pos.length);
    expect(mesh('undershirt').pos.length).toBe(pack.get('sleeve_long').meshes[0].pos.length);
    expect(selectKitParts(pack, () => null, { sleeve: 'long' }).parts.map(p => p.k)).not.toContain('undershirt');
  });
});

describe.skipIf(!fs.existsSync(KIT_SERVER))('font sheets of the real kit-server', () => {
  const sheets = [
    ['2. Bundesliga/1860 München/g1/u4138g1_name.ftex', 'name', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ.'],
    ['2. Bundesliga/1860 München/g1/u4138g1_num.ftex', 'back', '0123456789'],
  ];
  it.each(sheets)('%s: every glyph sits inside its template cell (no cropping)', (rel, kind, chars) => {
    const t = decodeFtex(new Uint8Array(fs.readFileSync(path.join(KIT_SERVER, rel))), { maxWidth: 8192 });
    const alpha = (x, y) => t.pixels[(y * t.width + x) * 4 + 3];
    for (const ch of chars) {
      const [x, y, w, h] = KitFont.cell(kind, ch, t.width, t.height).map(Math.round);
      let inside = 0, onEdge = 0;
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
        if (alpha(i, j) <= 24) continue;
        inside++;
        if (i === x || i === x + w - 1 || j === y || j === y + h - 1) onEdge++;
      }
      expect(inside, `${ch} has pixels`).toBeGreaterThan(100);
      expect(onEdge, `${ch} touches its cell edge`).toBe(0);
    }
  });
});
