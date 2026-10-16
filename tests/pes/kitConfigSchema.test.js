// config.txt values are validated with kserv.lua's ranges, not the Kit Studio comments next to them.
// Fixture: PSG p1 config.txt of the UML patch (copied inline; real file, Kit Studio comments).
import { describe, it, expect } from 'vitest';
import { parseKitConfig, setKitValue, serializeKitConfig } from '../../pes/kits/kitConfig.js';
import { keyConstraint, KSERV_CONSTRAINTS, isBadgeOff } from '../../pes/kits/kitConfigSchema.js';
import { resolveKitRender } from '../../pes/kits/kitRenderConfig.js';

const PSG_P1 = [
  '; shirt parameters',
  'ShortSleevesModel=1                               ; 1=Normal (players), 2=Kappa (players), 3=Referee kits only',
  'ShirtModel=144                                    ; 144, 151=Semi-long short sleeves, 160, 176=Legacy',
  'Collar=2                                          ; 1 to 130',
  'TightKit=0                                        ; 0=Off, 1=On',
  'WinterCollar=1                                    ; 1 to 130',
  'LongSleevesType=62                                ; 62=Normal & Undershirt, 187=Only Undershirt',
  'Name=0                                            ; 0=On, 1=Off',
  'NameShape=0                                       ; 0=Straight, 1=Light curve, 2=Medium curve, 3=Extreme curve',
  'NameY=36                                          ; 0 to 39',
  'NameSize=8                                        ; 0 to 20',
  'NameStretch=2                                     ; 0 to 3',
  'BackNumberY=16                                    ; 0 to 29',
  'BackNumberSize=23                                 ; 0 to 28',
  'BackNumberSpacing=10                              ; 0 to 14',
  'BackNumberType=0                                  ; 0=Normal, 1=Forced two-digit',
  'ChestNumberX=0                                    ; 0 to 29',
  'ChestNumberY=0                                    ; 0 to 29',
  'ChestNumberSize=3                                 ; 0 to 28',
  'ShortsModel=1                                     ; 1 to 16 (17 and above tend make some parts of the pants black',
  'ShortsNumberSide=1                                ; 0=Left, 1=Right',
  'ShortsNumberX=16                                  ; 0 to 14',
  'ShortsNumberY=11                                  ; 0 to 15',
  'ShortsNumberSize=14                               ; 0 to 28',
  'KitFile=u0114p1',
  'BackNumbersFile=u0114p1_back',
  'ChestNumbersFile=',
  'LegNumbersFile=u0114p1_leg',
  'NameFontFile=u0114p1_name',
  'ShirtColor1=#283764',
  'RightShortX=14                                    ; 0 to 31',
  'RightShortY=12                                    ; 0 to 31',
  'RightLongX=14                                     ; 0 to 31',
  'RightLongY=12                                     ; 0 to 31',
  'LeftShortX=31                                     ; 0 to 31',
  'LeftShortY=0                                      ; 0 to 31',
  'LeftLongX=0                                       ; 0 to 31',
  'LeftLongY=31                                      ; 0 to 31',
].join('\r\n');

describe('kserv.lua ranges', () => {
  it('override a Kit Studio comment that disagrees, and keep it for reference', () => {
    const k = keyConstraint('ShortsNumberX', { type: 'range', min: 0, max: 14 });
    expect(k).toMatchObject({ source: 'kserv', constraint: { type: 'range', min: 0, max: 31 }, disagrees: true });
    expect(keyConstraint('Unknown', { type: 'range', min: 0, max: 3 }).source).toBe('comment');
    expect(KSERV_CONSTRAINTS.BackNumberSpacing).toEqual({ type: 'range', min: 0, max: 15 });
  });

  it('parse: line.constraint is the effective range, line.commentConstraint what the comment says', () => {
    const cfg = parseKitConfig(PSG_P1);
    const line = cfg.lines[cfg.keys.get('ShortsNumberX')];
    expect(line.constraint).toEqual({ type: 'range', min: 0, max: 31 });
    expect(line.commentConstraint).toEqual({ type: 'range', min: 0, max: 14 });
    expect(serializeKitConfig(cfg)).toBe(PSG_P1); // unchanged round-trip
  });

  it('accepts ShortsNumberX=16 and BackNumberSpacing=15, rejects values outside kserv.lua', () => {
    const cfg = parseKitConfig(PSG_P1);
    expect(setKitValue(cfg, 'ShortsNumberX', 20).after).toBe('20');
    expect(setKitValue(cfg, 'BackNumberSpacing', 15).after).toBe('15');
    expect(() => setKitValue(cfg, 'ShortsNumberX', 32)).toThrow(expect.objectContaining({ code: 'OUT_OF_RANGE' }));
    expect(() => setKitValue(cfg, 'ShortSleevesModel', 3)).toThrow(expect.objectContaining({ code: 'OUT_OF_RANGE' }));
  });
});

describe('resolveKitRender with the PSG p1 config', () => {
  const r = resolveKitRender(parseKitConfig(PSG_P1));

  it('draws ShortsNumberX=16 as 16 (no clamping to the comment range) and keeps the raw text', () => {
    expect(r.shorts).toMatchObject({ x: 16, y: 11, left: false, side: 1 });
    expect(r.values.ShortsNumberX).toEqual({ raw: '16', used: 16 });
    expect(r.notes.filter(n => n.level === 'warn')).toEqual([]);
    expect(r.notes).toContainEqual(expect.objectContaining({ key: 'ShortsNumberX', level: 'info' }));
  });

  it('still warns and keeps the source value when kserv.lua rejects it', () => {
    const bad = resolveKitRender(parseKitConfig(PSG_P1.replace('ShortsNumberY=11 ', 'ShortsNumberY=40 ')));
    expect(bad.notes).toContainEqual(expect.objectContaining({ key: 'ShortsNumberY', level: 'warn' }));
    expect(bad.values.ShortsNumberY).toEqual({ raw: '40', used: 31 });
  });

  it('reads the sleeve badge positions of the sleeve length on screen; X=31,Y=0 is off', () => {
    expect(r.badges.right).toMatchObject({ x: 14, y: 12, off: false });
    expect(r.badges.left).toMatchObject({ x: 31, y: 0, off: true });
    const long = resolveKitRender(parseKitConfig(PSG_P1), { sleeve: 'long' });
    expect(long.badges.left).toMatchObject({ x: 0, y: 31, off: false, keys: ['LeftLongX', 'LeftLongY'] });
    expect(isBadgeOff(31, 0)).toBe(true);
    expect(isBadgeOff(0, 31)).toBe(false);
  });
});
