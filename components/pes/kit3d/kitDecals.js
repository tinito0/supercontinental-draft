// Names and numbers on the 3D kit, drawn with the kit's own font sheets (NameFontFile, BackNumbersFile,
// ChestNumbersFile, LegNumbersFile) where config.txt places them. KitFont is extracted verbatim from
// PES Editor Rebuilt js/kitfont.js (glyph cells of the game's "Letters/Numbers Template.psd"); the
// composition follows Rebuilt js/kitstudio.js (UVR, KS_POS, ksDisplayTex, ksFallbackTex).
// BSD-3-Clause, copyright AgustinMarconi27 — see pes/THIRD_PARTY_NOTICES.md. Positions are approximations
// measured on the models, not the game's exact placement.
/* eslint-disable */
export const KitFont = (() => {
  const LET = { A: [18, 160], B: [188, 306], C: [336, 464], D: [496, 620], E: [648, 766], F: [776, 896], G: [912, 1040], H: [1064, 1188], I: [1200, 1282], J: [1296, 1402], K: [1420, 1548], L: [1568, 1680], M: [1698, 1868], N: [1880, 2022],
    O: [18, 160], P: [190, 306], Q: [336, 480], R: [512, 642], S: [670, 786], T: [818, 944], U: [968, 1096], V: [1120, 1264], W: [1282, 1472], X: [1488, 1618], Y: [1648, 1776], Z: [1808, 1936], '.': [1960, 2014], ' ': [2022, 2048] };
  const ROW2 = new Set('OPQRSTUVWXYZ. ');
  const NUM = [[0, 160], [200, 300], [340, 500], [540, 700], [740, 900], [940, 1100], [1140, 1300], [1340, 1500], [1540, 1700], [1740, 1900]];
  // tamaño de cada textura (el que usa el Parche)
  const SIZE = { name: [4096, 1024], back: [4096, 512], chest: [2048, 256], leg: [2048, 256] };
  // rectángulo de un carácter dentro de la textura (x, y, w, h en píxeles)
  function cell(kind, ch, W, H) {
    const k = W / 2048;
    if (kind === 'name') { const c = LET[ch]; if (!c) return null; const r2 = ROW2.has(ch), yh = H / 2; return [c[0] * k, (r2 ? 260 / 512 : 4 / 512) * H, (c[1] - c[0]) * k, yh * (248 / 256)]; }
    const c = NUM[+ch]; if (!c) return null; return [c[0] * k, 0, (c[1] - c[0]) * k, H];
  }
  // ---- recorta el carácter de una textura de fuente (para dibujar "JUGADOR 10" con la fuente real del kit) ----
  const CROP = new WeakMap();
  function glyph(tex, kind, ch) {
    if (!tex) return null; let m = CROP.get(tex); if (!m) CROP.set(tex, m = new Map());
    const key = kind + ch; if (m.has(key)) return m.get(key);
    const r = cell(kind, ch, tex.width, tex.height); if (!r) { m.set(key, null); return null; }
    const [x, y, w, h] = r.map(Math.round), src = tex.getContext('2d', { willReadFrequently: true }).getImageData(x, y, Math.max(1, w), Math.max(1, h)).data;
    let x0 = w, x1 = -1, y0 = h, y1 = -1;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (src[(j * w + i) * 4 + 3] > 24) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
    const out = x1 < 0 ? null : { c: tex, sx: x + x0, sy: y + y0, sw: x1 - x0 + 1, sh: y1 - y0 + 1, cellH: h };
    m.set(key, out); return out;
  }
  // dibuja un texto con los caracteres de la textura; centrado en (cx, cy), alto h, curva opcional
  function drawText(g, tex, kind, text, cx, cy, h, { stretch = 1, spacing = 0, curve = 0, fallback } = {}) {
    const gl = [...String(text).toUpperCase()].map(ch => ch === ' ' ? { sp: true } : glyph(tex, kind, ch));
    if (!tex || gl.some(x => x === null)) { // sin textura de fuente: texto común
      g.save(); g.font = `800 ${h}px ${fallback || '"Saira Condensed", sans-serif'}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffffff'; g.strokeStyle = '#000000aa'; g.lineWidth = h * .06; g.translate(cx, cy); g.scale(stretch, 1); g.strokeText(text, 0, 0); g.fillText(text, 0, 0); g.restore(); return;
    }
    const ref = gl.find(x => x && !x.sp); if (!ref) return;
    const k = h / (kind === 'name' ? ref.cellH * .84 : ref.cellH * .74), ws = gl.map(x => x.sp ? h * .35 : x.sw * k * stretch), gap = spacing * h;
    const total = ws.reduce((a, b) => a + b, 0) + gap * (ws.length - 1); let x = cx - total / 2;
    gl.forEach((q, i) => {
      if (!q.sp) { const w = ws[i], hh = q.sh * k, off = curve ? curve * h * ((x + w / 2 - cx) / (total / 2 || 1)) ** 2 : 0; g.drawImage(q.c, q.sx, q.sy, q.sw, q.sh, x, cy - hh / 2 + off, w, hh); }
      x += ws[i] + gap;
    });
  }
  return { cell, glyph, drawText, SIZE };
})();
/* eslint-enable */

// Texture regions measured on the models: the back is rotated 180° in the texture.
const UVR = { back: [0.357, 0.642, 0.023, 0.464], front: [0.344, 0.656, 0.49, 0.906] };

/** Approximate positions (0..1 inside each region) from the config.txt values. */
function positions(n) {
  return {
    name: { y: 0.07 + (39 - n('NameY')) / 39 * 0.35, h: 0.05 + n('NameSize') * 0.006, stretch: 0.75 + n('NameStretch') * 0.15, curve: [0, 0.12, 0.25, 0.45][n('NameShape')] || 0 },
    num: { y: 0.22 + (29 - n('BackNumberY')) / 29 * 0.35, h: 0.12 + n('BackNumberSize') / 28 * 0.22, spacing: (n('BackNumberSpacing') - 7) * 0.012 },
    chest: { x: 0.2 + n('ChestNumberX') / 29 * 0.6, y: 0.05 + n('ChestNumberY') / 29 * 0.35, h: 0.04 + n('ChestNumberSize') / 28 * 0.1 },
  };
}

/** Colour-only kit texture from config.txt colours, used when the real texture is not available. */
export function fallbackKitTexture(value, S = 1024) {
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const g = c.getContext('2d'), col = k => value(k) || '#888888';
  g.fillStyle = col('ShirtColor1'); g.fillRect(0, 0, S, S);
  g.fillStyle = col('ShirtColor2');
  for (const [u0, u1] of [[0.40, 0.43], [0.57, 0.60]]) g.fillRect(u0 * S, 0.49 * S, (u1 - u0) * S, 0.42 * S);
  g.fillStyle = col('SocksColor'); g.fillRect(0, 0.31 * S, 0.33 * S, 0.25 * S); g.fillRect(0.67 * S, 0.31 * S, 0.33 * S, 0.25 * S);
  g.fillStyle = col('ShortsColor'); g.fillRect(0, 0.585 * S, 0.335 * S, 0.4 * S); g.fillRect(0.665 * S, 0.585 * S, 0.335 * S, 0.4 * S);
  return c;
}

/**
 * Kit texture with the player's name and numbers drawn where the game puts them.
 * @param {HTMLCanvasElement|null} base decoded kit texture (null → colours from config)
 * @param {(key: string) => string|null} value config getter
 * @param {{ name?: HTMLCanvasElement, back?: HTMLCanvasElement, chest?: HTMLCanvasElement, leg?: HTMLCanvasElement }} fonts decoded font sheets
 * @param {{ name: string, number: string }} sample
 */
export function composeKitTexture(base, value, fonts, sample, S = 1024) {
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const g = c.getContext('2d');
  g.drawImage(base || fallbackKitTexture(value, S), 0, 0, S, S);
  const n = k => Number(value(k)) || 0;
  const P = positions(n);
  const num = String(sample.number || '').replace(/\D/g, '').slice(0, 2);
  const name = String(sample.name || '').toUpperCase().replace(/[^A-Z. ]/g, '');

  const [u0, u1, v0, v1] = UVR.back, bw = (u1 - u0) * S, bh = (v1 - v0) * S;
  g.save();
  g.translate(u1 * S, v1 * S);
  g.rotate(Math.PI); // back: rotated 180° in the texture
  if (value('Name') !== '1' && name) KitFont.drawText(g, fonts.name, 'name', name, bw / 2, P.name.y * bh, P.name.h * bh, { stretch: P.name.stretch, curve: P.name.curve });
  if (num) KitFont.drawText(g, fonts.back, 'back', num, bw / 2, P.num.y * bh, P.num.h * bh, { spacing: P.num.spacing });
  g.restore();

  if (String(value('ChestNumbersFile') || '').trim() && num) {
    const [f0, f1, t0, t1] = UVR.front;
    const font = fonts.chest || fonts.back;
    KitFont.drawText(g, font, fonts.chest ? 'chest' : 'back', num, (f0 + P.chest.x * (f1 - f0)) * S, (t0 + P.chest.y * (t1 - t0)) * S, P.chest.h * (t1 - t0) * S);
  }
  if (n('ShortsNumberX') < 30 && n('ShortsNumberY') < 30 && num) {
    // The shorts are rotated 90° in the texture; transform measured on the models (per cm of leg).
    const left = value('ShortsNumberSide') !== '1';
    const M = left ? [0.0007, -0.0063, 0.0065, 0.0007, 0.944, 0.865] : [0.0008, 0.0066, -0.0066, 0.001, 0.053, 0.862];
    g.save();
    g.setTransform(M[0] * S, M[1] * S, M[2] * S, M[3] * S, M[4] * S, M[5] * S);
    const dx = (n('ShortsNumberX') - 15) / 15 * 4.5 * (left ? 1 : -1), dy = -3.5 + n('ShortsNumberY') / 29 * 8, hh = 3 + n('ShortsNumberSize') / 28 * 5;
    KitFont.drawText(g, fonts.leg || fonts.back, fonts.leg ? 'leg' : 'back', num, dx, dy, hh);
    g.restore();
  }
  return c;
}

/** Shine (gloss) map: the kit texture's alpha channel as grey. */
export function glossFromAlpha(pixels, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d'), im = g.createImageData(w, h);
  for (let i = 0; i < w * h; i++) { const a = pixels[i * 4 + 3]; im.data[i * 4] = a; im.data[i * 4 + 1] = a; im.data[i * 4 + 2] = a; im.data[i * 4 + 3] = 255; }
  g.putImageData(im, 0, 0);
  return c;
}

/** RGBA pixels → canvas; `opaque` drops alpha (kit textures keep shine in alpha, not transparency). */
export function pixelsToCanvas(pixels, w, h, { opaque = false, readBack = false } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: readBack }), im = g.createImageData(w, h);
  im.data.set(pixels);
  if (opaque) for (let i = 3; i < im.data.length; i += 4) im.data[i] = 255;
  g.putImageData(im, 0, 0);
  return c;
}
