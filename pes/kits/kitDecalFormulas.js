// Where PES 2021 puts a kit's name and numbers: the game's own math, read from PES2021.exe and its shaders.
//
// Evidence (all from the user's game; addresses are this PES2021.exe build, a runtime image dumped with a read-only
// Sider module and analysed in Ghidra; shaders from data/dt00_x64.cpk shaders/dx11/PesShaders_dx11.fsop):
//   1. config.txt steps → floats: FUN_141e58c80 (back), FUN_141e58d90 (chest), FUN_141e59150 (name),
//      FUN_141e59240 (NameStretch), FUN_141e594a0 (shorts), tables at 0x142B464D0 (step range) / 0x142B46590 (float
//      range). A step outside the range is rejected: position 0, size 0.01, NameStretch 1 (nothing is extrapolated).
//   2. The lettering is not painted into the kit texture: the game draws it into a 1600×256 "marking" texture
//      (FUN_1419e3c60) — name in x 0–0.64, back number in 0.64–0.88, chest number in 0.88–1 × top half — and the
//      shirt shader (pes3ddf_shirt_nb_nc) maps each region onto the kit UV (uv0) with a scale and an offset computed on
//      the CPU (FUN_141a86310 → FUN_1419a4d20 name, FUN_1419a44f0 back number, FUN_1419a4bf0 chest number). The
//      shorts number is its own 128×128 texture (FUN_1419e3a30, digits turned 90°) placed by the pants shader
//      (pes3ddf_pants_nb_nc) with FUN_1419a5000. Placement below is that math solved for kit-texture coordinates
//      (u = x / width, v = y / height of the kit texture; the back panel is upside down in the texture).
//   3. Digits: FUN_1419e2c10 (layout in the region) and FUN_1419e4a90 (cell of a digit in the number sheet).
//      Name: FUN_1419e1df0 on a 512×128 canvas, glyph cells from the table at 0x142A96CE0 (letters, and the accented
//      ones of the NameFontFile_ex sheet), curve radii 672/336/292 per NameShape.
// Verified against in-game captures of FC Barcelona p1 (NameY 36, NameSize 12, NameStretch 2, NameShape 1,
// BackNumberY 16, BackNumberSize 24): number ink height 0.151 (measured 0.152), name centre v 0.3895 (measured
// 0.387), letter pitch and name width match. Open: the light-curve drop measures ~1.6× the computed one.

/** Steps → the game's floats; outside 0..max the game rejects the value (see gameValue). */
export const GAME_STEPS = {
  NameY: { max: 39, f: n => 0.05 + n * 0.37 / 39 },
  NameSize: { max: 20, f: n => 0.9 + n * 1.5 / 20 },
  NameStretch: { max: 3, f: n => 0.5 + n * 0.5 / 3 },
  BackNumberY: { max: 29, f: n => 1.2 - n * 1.2 / 29 },
  BackNumberSize: { max: 28, f: n => n / 28 },
  BackNumberSpacing: { max: 14, f: n => n / 14 },
  ChestNumberX: { max: 29, f: n => 0.4 + n * 0.207 / 29 },
  ChestNumberY: { max: 29, f: n => 0.78 - n * 0.24 / 29 },
  ChestNumberSize: { max: 28, f: n => 0.6 + n * 1.2 / 28 },
  ShortsNumberX: { max: 29, f: n => 0.9 - n * 0.14 / 29 },
  ShortsNumberSize: { max: 28, f: n => 0.6 + n * 1.2 / 28 },
};
/** ShortsNumberY depends on ShortsNumberSide (1 = right leg, 0 = left leg). */
export const shortsNumberYFloat = (n, side) => (side === 1 ? 0.04 + n * 0.19 / 29 : 0.96 - n * 0.19 / 29);

// What the game uses when a step is outside its range (FUN_141e58c80 … FUN_141e59240).
const REJECTED = { NameSize: 0.01, BackNumberSize: 0.01, ChestNumberSize: 0.01, ShortsNumberSize: 0.01, NameStretch: 1 };

const maxStep = key => (key === 'ShortsNumberY' ? 29 : GAME_STEPS[key]?.max);

/** True when the game rejects the step (outside 0..max). */
export const outsideGameDomain = (key, n) => {
  const max = maxStep(key);
  return max != null && (n < 0 || n > max);
};

/**
 * The float the game stores for one key, as the game computes it. NameStretch 0 counts as 3 (the game reads the
 * field as 3 when its two bits are 0). Rejected steps give 0 for positions, 0.01 for sizes and 1 for NameStretch.
 * @returns {{ value: number, valid: boolean } | null}
 */
export function gameValue(key, n, side = 0) {
  const max = maxStep(key);
  if (max == null) return null;
  const step = key === 'NameStretch' && n === 0 ? 3 : n;
  if (outsideGameDomain(key, step)) return { value: REJECTED[key] ?? 0, valid: false };
  return { value: key === 'ShortsNumberY' ? shortsNumberYFloat(step, side) : GAME_STEPS[key].f(step), valid: true };
}

/** The float only (null for keys without a formula). */
export function gameFloat(key, n, side = 0) {
  return gameValue(key, n, side)?.value ?? null;
}

// ---- name ----

/** Curve radius on the 512×128 name canvas per NameShape (0x142A96C18, 0x1425C9070, 0x142A96C14). */
export const NAME_RADIUS = [0, 672, 336, 292];
/** Added to the NameY float per NameShape (FUN_1419a4e30). */
export const NAME_SHAPE_V = [0, -0.002, -0.016, -0.019];
const NAME_CANVAS = { w: 512, h: 128, cellH: 0.98, curveGap: 6, curveWidth: 0.95, pivot: 0.8, lift: 0.89 };

// Glyph table at 0x142A96CE0: [char, sheet (0 = NameFontFile, 1 = NameFontFile_ex), x, y, width, height] in a
// 1024-wide reference (height reference 256 for sheet 0, 512 for sheet 1).
const NAME_GLYPH_TABLE = [
  ['A', 0, 8, 2, 72, 124], ['B', 0, 94, 2, 60, 124], ['C', 0, 168, 2, 64, 124], ['D', 0, 248, 2, 64, 124],
  ['E', 0, 324, 2, 60, 124], ['F', 0, 388, 2, 60, 124], ['G', 0, 456, 2, 64, 124], ['H', 0, 532, 2, 64, 124],
  ['I', 0, 600, 2, 40, 124], ['J', 0, 648, 2, 52, 124], ['K', 0, 710, 2, 64, 124], ['L', 0, 784, 2, 56, 124],
  ['M', 0, 850, 2, 84, 124], ['N', 0, 940, 2, 72, 124], ['O', 0, 8, 130, 72, 124], ['P', 0, 94, 130, 60, 124],
  ['Q', 0, 168, 130, 72, 124], ['R', 0, 256, 130, 64, 124], ['S', 0, 334, 130, 60, 124], ['T', 0, 408, 130, 64, 124],
  ['U', 0, 484, 130, 64, 124], ['V', 0, 560, 130, 72, 124], ['W', 0, 640, 130, 96, 124], ['X', 0, 744, 130, 64, 124],
  ['Y', 0, 824, 130, 64, 124], ['Z', 0, 904, 130, 64, 124], [' ', 0, 1012, 130, 12, 124], ['_', 0, 0, 0, 4, 124],
  ['.', 0, 980, 130, 28, 124], ["'", 1, 8, 2, 36, 124], ['-', 1, 52, 2, 48, 124], ['À', 1, 108, 2, 72, 124],
  ['Á', 1, 188, 2, 72, 124], ['Â', 1, 268, 2, 72, 124], ['Ã', 1, 348, 2, 72, 124], ['Ä', 1, 428, 2, 72, 124],
  ['Å', 1, 508, 2, 72, 124], ['Ă', 1, 588, 2, 72, 124], ['Æ', 1, 668, 2, 104, 124], ['Ç', 1, 780, 2, 64, 124],
  ['Ć', 1, 852, 2, 64, 124], ['Č', 1, 924, 2, 64, 124], ['Ð', 1, 8, 130, 72, 124], ['Đ', 1, 88, 130, 72, 124],
  ['È', 1, 168, 130, 64, 124], ['É', 1, 240, 130, 64, 124], ['Ê', 1, 312, 130, 64, 124], ['Ë', 1, 384, 130, 64, 124],
  ['Ę', 1, 456, 130, 64, 124], ['Ə', 1, 528, 130, 64, 124], ['Ğ', 1, 600, 130, 64, 124], ['Ì', 1, 672, 130, 48, 124],
  ['Í', 1, 728, 130, 48, 124], ['Î', 1, 784, 130, 48, 124], ['Ï', 1, 840, 130, 48, 124], ['İ', 1, 896, 130, 40, 124],
  ['Ł', 1, 944, 130, 64, 124], ['Ñ', 1, 8, 258, 72, 124], ['Ò', 1, 88, 258, 72, 124], ['Ó', 1, 168, 258, 72, 124],
  ['Ô', 1, 248, 258, 72, 124], ['Õ', 1, 328, 258, 72, 124], ['Ö', 1, 408, 258, 72, 124], ['Ø', 1, 488, 258, 80, 124],
  ['Ř', 1, 576, 258, 64, 124], ['Ş', 1, 648, 258, 58, 124], ['Š', 1, 714, 258, 58, 124], ['ß', 1, 780, 258, 60, 124],
  ['Ţ', 1, 848, 258, 64, 124], ['Þ', 1, 920, 258, 64, 124], ['Ù', 1, 8, 386, 66, 124], ['Ú', 1, 82, 386, 66, 124],
  ['Û', 1, 156, 386, 66, 124], ['Ü', 1, 230, 386, 66, 124], ['Ý', 1, 304, 386, 64, 124], ['Ż', 1, 376, 386, 64, 124],
  ['Ž', 1, 448, 386, 64, 124], ['Ą', 1, 520, 386, 72, 124],
];
const NAME_GLYPHS = new Map(NAME_GLYPH_TABLE.map(([ch, sheet, x, y, w, h]) => [ch, { ch, sheet, x, y, w, h }]));

/**
 * Cell of a name character: sheet (0 = NameFontFile, 1 = NameFontFile_ex) and its rectangle as fractions of that
 * sheet. Characters the game does not have (lowercase is upper-cased like the game does) return null.
 */
export function nameGlyph(ch) {
  const g = NAME_GLYPHS.get(ch) || NAME_GLYPHS.get(String(ch).toUpperCase());
  if (!g) return null;
  const vRef = g.sheet === 1 ? 512 : 256;
  return { ch: g.ch, sheet: g.sheet, u0: g.x / 1024, v0: g.y / vRef, uw: g.w / 1024, vh: g.h / vRef, width: g.w };
}

/**
 * Name layout on the game's 512×128 canvas (FUN_1419e1df0), in reading order (x grows to the right as read on the
 * shirt, y grows towards the hem). Letters touch (cell to cell); with a curve the game adds 6 px between letters,
 * narrows them by 0.95 and places each on a circle: centre (256 + 0.8R·sinθ, 0.89R − 0.8R·cosθ), θ = (x − 256)/R,
 * turned by θ. A name wider than the canvas is squeezed to fit.
 * @returns {{ glyphs: {glyph: object, x: number, y: number, w: number, h: number, angle: number}[], missing: string[], fraction: number }}
 */
export function nameLayout(text, shape = 0) {
  const C = NAME_CANVAS;
  const missing = [];
  const glyphs = [...String(text || '')].map(ch => {
    const g = nameGlyph(ch);
    if (!g) missing.push(ch);
    return g;
  }).filter(Boolean);
  const R = NAME_RADIUS[shape] || 0;
  const gap = R && glyphs.length > 1 ? C.curveGap : 0;
  const sum = glyphs.reduce((a, g) => a + g.width, 0) / 2;
  let total = sum + (R && sum < C.w ? gap * (glyphs.length - 1) : 0);
  const squeeze = total > 0 ? Math.min(1, C.w / total) : 1;
  total = Math.min(total, C.w);
  let cursor = C.w / 2 - total / 2;
  const out = glyphs.map(glyph => {
    const w = (glyph.width / 2) * squeeze;
    const xc = cursor + w / 2;
    cursor += w + (R ? gap : 0);
    const h = 128 * (124 / 256) * C.cellH;
    if (!R) return { glyph, x: xc, y: C.h / 2, w, h, angle: 0 };
    const theta = (xc - C.w / 2) / R;
    return {
      glyph, w: w * C.curveWidth, h, angle: theta,
      x: C.w / 2 + C.pivot * R * Math.sin(theta),
      // the canvas Y grows towards the hem, like the reading y (64 = straight names)
      y: C.lift * R - C.pivot * R * Math.cos(theta),
    };
  });
  return { glyphs: out, missing, fraction: Math.min(1, sum / C.w) };
}

/** u per name-canvas pixel once the name's width is known: the game caps NameSize at 1/fraction (FUN_1419a4d20). */
export function nameScaleX(name, fraction) {
  const ns = fraction * name.size > 1 ? 1 / Math.max(fraction, 1e-4) : name.size;
  return (ns * name.stretch / 4) / 512;
}

// ---- numbers ----

/**
 * Cell of a digit in a number sheet (FUN_1419e4a90), as fractions of the sheet, and its side margin m (the 1 is
 * narrower). Horizontal sheets (wider than tall) have the digits in a row, vertical ones in a column.
 */
export function digitCell(d, horizontal = true) {
  if (horizontal) {
    const u0 = d * 0.09765625 - (d > 1 ? 0.029296875 : 0);
    return d === 1 ? { u0, v0: 0, uw: 0.048828125, vh: 1, m: 0.1875 } : { u0, v0: 0, uw: 0.078125, vh: 1, m: 0 };
  }
  return d === 1 ? { u0: 0, v0: d * 0.099609375, uw: 0.75, vh: 0.099609375, m: 0.15625 }
    : { u0: 0, v0: d * 0.099609375, uw: 1, vh: 0.099609375, m: 0 };
}

/**
 * Digits laid out in their region (FUN_1419e2c10), region units 0..1: `x`/`w` across the digits (reading
 * direction), `y`/`h` along them. `spacing` is the BackNumberSpacing float, `inset` the game's inset in 256ths of
 * the region height (26 for chest and shorts, 0 on the back).
 * @returns {{ d: number, x: number, w: number, y: number, h: number }[]}
 */
export function digitLayout(number, spacing, { inset = 0, horizontal = true } = {}) {
  const n = Number(number);
  if (!Number.isInteger(n) || n < 1 || n > 999) return [];
  // inset px top and bottom out of 256 (chest region: 26/0.5 of 256 → 26 of 128; shorts: 26 of 128)
  const h = (256 - inset * 2) / 256;
  const cells = String(n).split('').map(Number).map(d => ({ d, m: digitCell(d, horizontal).m }));
  const s = (spacing * 0.16 - 0.16) * 0.5; // fVar14
  const a = 0.0520833320915699, b = 0.1041666641831398, a2 = 0.052086666226387024;
  const place = (c, x, w) => ({ d: c.d, x, w, y: inset ? inset / 256 : 0, h: inset ? h : 1 });
  if (cells.length === 1) {
    const [c] = cells;
    return [place(c, 0.25 + 0.5 * c.m, 0.5 - c.m)];
  }
  if (cells.length === 2) {
    let left, right;
    if (n === 11) { left = b - s; right = s; }
    else if (n % 10 === 1) { right = s + a; left = a - s; }
    else if (Math.floor(n / 10) === 1) { right = s - a; left = a - s; }
    else { left = -s; right = s; }
    const [c0, c1] = cells;
    return [place(c0, left, 0.5 - c0.m), place(c1, 0.5 + right, 0.5 - c1.m)];
  }
  // three digits
  const tens = Math.floor(n / 10) % 10, units = n % 10, hundredsIsOne = n - 100 < 100;
  let o0, o1 = -a, o2;
  if (tens === 1) {
    if (units === 1) {
      o0 = b - s;
      if (hundredsIsOne) { o2 = s - b; o1 = 0; } else { o2 = s - a; o1 = a; }
    } else if (!hundredsIsOne) { o0 = a - s; o2 = s - a; o1 = 0; } else { o0 = a - s; o2 = s - b; }
  } else {
    o2 = s;
    if (units === 1) {
      o0 = a - s; o1 = a2;
      if (hundredsIsOne) { o2 = s - a; o1 = 0; }
    } else if (!hundredsIsOne) { o0 = -s; o1 = 0; } else { o0 = -s; o2 = s - a; }
  }
  const [c0, c1, c2] = cells;
  return [
    place(c0, 0.5 * c0.m + o0, 1 / 3 - c0.m),
    place(c1, 1 / 3 + 0.5 * c1.m + o1, 1 / 3 - c1.m),
    place(c2, 2 / 3 + 0.5 * c2.m + o2, 1 / 3 - c2.m),
  ];
}

// ---- placement on the kit texture ----

/**
 * Where each element lands on the kit texture, from config.txt steps.
 * name:   canvas 512×128 → u = 0.5 + (256 − x)·kx, v = vc + (64 − y)·ky (reading coordinates of nameLayout)
 * back:   region (x across, y down the digits) → u = 0.5 + W/2 − x·W, v = vTop − y·H
 * chest:  region → u = u0 + (x − 0.5)·L, v = v0 + (y − 0.5)·L
 * shorts: 128×128 number texture (digits turned 90°, top towards the waist) → centred at (u, v), side L, turned
 *         180° on the left leg
 * @param {{ NameY: number, NameSize: number, NameStretch: number, NameShape: number, BackNumberY: number,
 *   BackNumberSize: number, BackNumberSpacing: number, ChestNumberX: number, ChestNumberY: number, ChestNumberSize: number,
 *   ShortsNumberX: number, ShortsNumberY: number, ShortsNumberSize: number, ShortsNumberSide: number }} s steps
 * @param {{ nameFraction?: number }} opts nameFraction: name width / 512 canvas px (nameLayout().fraction)
 */
export function decalLayout(s, { nameFraction = 0 } = {}) {
  const v = (k, side) => gameValue(k, s[k], side);
  const side = s.ShortsNumberSide === 1 ? 1 : 0;
  const shape = NAME_RADIUS[s.NameShape] !== undefined ? s.NameShape : 0;
  const invalid = [];
  const val = (k, sd) => { const r = v(k, sd); if (r && !r.valid) invalid.push(k); return r ? r.value : 0; };

  // Name (FUN_1419a4d20): canvas height NameSize/16, width min(NameSize, 1/fraction)·NameStretch/4.
  const ns = Math.max(val('NameSize'), 1e-4), st = val('NameStretch');
  const nsw = nameFraction * ns > 1 ? 1 / Math.max(nameFraction, 1e-4) : ns;
  const name = {
    shape, radius: NAME_RADIUS[shape], curvature: shape ? 1 / NAME_RADIUS[shape] : 0,
    v: val('NameY') + NAME_SHAPE_V[shape], kx: (nsw * st / 4) / 512, ky: (ns / 16) / 128,
    size: ns, stretch: st, letterHeight: (ns / 16) * (124 / 256) * 0.98,
  };

  // Back number (FUN_1419a44f0): k = 20 − 12·size; region W = 1/(10 − 6·size), H = 1/(0.627451·k).
  const bs = val('BackNumberSize'), by = val('BackNumberY');
  const k = 20 - 12 * bs;
  const back = {
    W: 1 / (10 - 6 * bs), H: 1 / (0.627451 * k), vTop: (0.2755729854106903 - 0.1 * by) / 0.627451,
    spacing: val('BackNumberSpacing'),
  };
  back.v = back.vTop - back.H / 2;

  // Chest (FUN_1419a4bf0): centred at (ChestNumberX, ChestNumberY), side ChestNumberSize/16.
  const cs = val('ChestNumberSize');
  const chest = { u: val('ChestNumberX'), v: val('ChestNumberY'), L: cs / 16 };

  // Shorts (FUN_1419a5000): centred at (ShortsNumberY, ShortsNumberX), side ShortsNumberSize/16; negative (turned
  // 180°) when the centre is past the middle of the texture (left leg).
  const su = val('ShortsNumberY', side), sv = val('ShortsNumberX');
  const shorts = { side, u: su, v: sv, L: val('ShortsNumberSize') / 16, flipped: su > 0.5 };

  return { name, back, chest, shorts, invalid };
}
