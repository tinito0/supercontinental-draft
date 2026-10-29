// Name/number placement as PES2021.exe computes it (constants and formulas read from this build of the game and its
// shaders; see pes/kits/kitDecalFormulas.js). The capture checks use in-game screenshots of FC Barcelona p1 measured
// on the kit texture: they verify the game-derived math, they do not define it.
import { describe, it, expect } from 'vitest';
import { gameFloat, gameValue, shortsNumberYFloat, decalLayout, outsideGameDomain, digitCell, digitLayout, nameGlyph, nameLayout, nameScaleX, NAME_RADIUS } from '../../pes/kits/kitDecalFormulas.js';

const near = (value, expected, tolerance) => expect(Math.abs(value - expected)).toBeLessThanOrEqual(tolerance);

// content/kit-server/LaLiga EA SPORTS/Barcelona/p1/config.txt (the values the kserv live editor showed in the captures).
const BARCA_P1 = { NameY: 36, NameSize: 12, NameStretch: 2, NameShape: 1, BackNumberY: 16, BackNumberSize: 24, BackNumberSpacing: 8,
  ChestNumberX: 0, ChestNumberY: 0, ChestNumberSize: 7, ShortsNumberX: 17, ShortsNumberY: 13, ShortsNumberSize: 15, ShortsNumberSide: 1 };

describe('steps → floats (FUN_141e58c80 … FUN_141e59240)', () => {
  it('match the game formulas at their end points', () => {
    expect(gameFloat('NameY', 0)).toBeCloseTo(0.05);
    expect(gameFloat('NameY', 39)).toBeCloseTo(0.42);
    expect(gameFloat('BackNumberY', 29)).toBeCloseTo(0);
    expect(gameFloat('ChestNumberX', 29)).toBeCloseTo(0.607);
    expect(gameFloat('ShortsNumberSize', 28)).toBeCloseTo(1.8);
    expect(gameFloat('Collar', 3)).toBeNull();
  });

  it('NameStretch is 0.5 + n/6 and 0 counts as 3 (normal width)', () => {
    expect(gameFloat('NameStretch', 0)).toBeCloseTo(1);
    expect(gameFloat('NameStretch', 1)).toBeCloseTo(2 / 3);
    expect(gameFloat('NameStretch', 2)).toBeCloseTo(5 / 6);
    expect(gameFloat('NameStretch', 3)).toBeCloseTo(1);
  });

  it('mirror ShortsNumberY between legs', () => {
    for (const n of [0, 13, 29]) expect(shortsNumberYFloat(n, 0)).toBeCloseTo(1 - shortsNumberYFloat(n, 1));
  });

  it('reject steps outside the game range instead of extrapolating (position 0, size 0.01)', () => {
    expect(gameValue('ShortsNumberX', 30)).toEqual({ value: 0, valid: false });
    expect(gameValue('ShortsNumberSize', 29)).toEqual({ value: 0.01, valid: false });
    expect(gameValue('BackNumberSpacing', 15).valid).toBe(false);
    expect(outsideGameDomain('ShortsNumberX', 29)).toBe(false);
    expect(decalLayout({ ...BARCA_P1, ShortsNumberX: 31 }).invalid).toContain('ShortsNumberX');
  });
});

describe('digits (FUN_1419e4a90, FUN_1419e2c10)', () => {
  it('cut the digit cells of a horizontal sheet (the 1 is narrower)', () => {
    expect(digitCell(0)).toMatchObject({ u0: 0, uw: 0.078125, m: 0 });
    expect(digitCell(1)).toMatchObject({ u0: 0.09765625, uw: 0.048828125, m: 0.1875 });
    near(digitCell(5).u0 * 2048, 940, 1e-6); // [940, 1100] of a 2048-wide sheet
  });

  it('centre one digit in the middle half of its region', () => {
    expect(digitLayout(5, 0.5)).toEqual([{ d: 5, x: 0.25, w: 0.5, y: 0, h: 1 }]);
  });

  it('place two digits from the spacing: 0.08·(spacing − 1) towards each other', () => {
    const [a, b] = digitLayout(23, 1);
    near(a.x, 0, 1e-12); near(b.x, 0.5, 1e-12);
    const [c, d] = digitLayout(23, 0);
    near(c.x, 0.08, 1e-9); near(d.x, 0.42, 1e-9);
    const [e] = digitLayout(11, 1);
    near(e.x, 0.1041667, 1e-6);
  });

  it('inset chest and shorts digits by 26/256 at top and bottom', () => {
    const [q] = digitLayout(7, 0.5, { inset: 26 });
    near(q.y, 26 / 256, 1e-9); near(q.h, 204 / 256, 1e-9);
  });
});

describe('name (FUN_1419e1df0, glyph table 0x142A96CE0)', () => {
  it('reads letters and accented letters (NameFontFile_ex) from the game table', () => {
    expect(nameGlyph('A')).toMatchObject({ sheet: 0, u0: 8 / 1024, uw: 72 / 1024 });
    expect(nameGlyph('É')).toMatchObject({ sheet: 1 });
    expect(nameGlyph('a')).toMatchObject({ ch: 'A' }); // upper-cased like the game
    expect(nameGlyph('@')).toBeNull();
  });

  it('packs straight names cell to cell, centred on the 512 px canvas', () => {
    const L = nameLayout('AB', 0);
    near(L.glyphs[0].w + L.glyphs[1].w, (72 + 60) / 2, 1e-9);
    near((L.glyphs[0].x + L.glyphs[1].x) / 2 + (L.glyphs[1].w - L.glyphs[0].w) / 4, 256, 1e-9);
    expect(L.glyphs.every(q => q.angle === 0 && q.y === 64)).toBe(true);
  });

  it('squeezes a name wider than the canvas to fit', () => {
    const L = nameLayout('WWWWWWWWWWWW', 0); // 12 × 48 px = 576 > 512
    near(L.glyphs.reduce((a, q) => a + q.w, 0), 512, 1e-6);
  });

  it('bends curved names on the shape radius, 6 px apart, ends towards the hem', () => {
    expect(NAME_RADIUS).toEqual([0, 672, 336, 292]);
    const L = nameLayout('ABCDEFG', 1);
    const [first, , , mid, , , last] = L.glyphs;
    expect(first.y).toBeGreaterThan(mid.y);
    expect(last.y).toBeGreaterThan(mid.y);
    expect(first.angle).toBeLessThan(0);
  });
});

describe('placement on the kit texture vs the in-game captures (FC Barcelona p1)', () => {
  const L = decalLayout(BARCA_P1, { nameFraction: nameLayout('ABCDEFG', 1).fraction });

  it('back number: game region, ink height 0.151 (screenshot 0.152), centre near the measured 0.262', () => {
    near(L.back.W, 1 / (10 - 6 * 24 / 28), 1e-9);
    near(L.back.H * 235 / 256, 0.152, 0.004); // ink of the "5" is 235 of the 256 cell rows
    near(L.back.v, 0.262, 0.012);
  });

  it('name: centre at NameY + shape offset (0.3895, screenshot 0.387), letter ink 0.031 (screenshot 0.0327)', () => {
    near(L.name.v, 0.3895, 1e-4);
    near(L.name.letterHeight * 143 / 248, 0.0327, 0.003);
    // letter pitch: the measured A–G distance (169 screen px ≈ 0.130 u) on a curved name
    const N = nameLayout('ABCDEFG', 1);
    const kx = nameScaleX(L.name, N.fraction);
    near((N.glyphs[6].x - N.glyphs[0].x) * kx, 0.130, 0.006);
  });

  it('shorts: centred at (ShortsNumberY, ShortsNumberX), side ShortsNumberSize/16, not turned on the right leg', () => {
    near(L.shorts.u, 0.1252, 1e-3);
    near(L.shorts.v, 0.8179, 1e-3);
    near(L.shorts.L, (0.6 + 15 * 1.2 / 28) / 16, 1e-9);
    expect(L.shorts.flipped).toBe(false);
    expect(decalLayout({ ...BARCA_P1, ShortsNumberSide: 0 }).shorts.flipped).toBe(true);
  });

  it('chest: centred at (ChestNumberX, ChestNumberY), side ChestNumberSize/16', () => {
    const C = decalLayout({ ...BARCA_P1, ChestNumberX: 29, ChestNumberY: 29, ChestNumberSize: 28 }).chest;
    near(C.u, 0.607, 1e-6); near(C.v, 0.54, 1e-6); near(C.L, 1.8 / 16, 1e-9);
  });

  it('moves the number towards the collar as BackNumberY grows', () => {
    expect(decalLayout({ ...BARCA_P1, BackNumberY: 29 }).back.vTop).toBeGreaterThan(L.back.vTop);
  });
});
