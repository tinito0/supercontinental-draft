// Names and numbers on the 3D kit, drawn with the kit's own font sheets (NameFontFile, BackNumbersFile,
// ChestNumbersFile, LegNumbersFile) where config.txt places them. KitFont is extracted verbatim from
// PES Editor Rebuilt js/kitfont.js (glyph cells of the game's "Letters/Numbers Template.psd"); the
// glyph cells are kept for tests and the fallback font. BSD-3-Clause, copyright AgustinMarconi27 — see
// pes/THIRD_PARTY_NOTICES.md. Placement, sizes, digit layout and name layout are the game's own (read from
// PES2021.exe and its shaders, see pes/kits/kitDecalFormulas.js).
import { printedNumber } from '../../../pes/kits/kitRenderConfig.js';
import { digitLayout, digitCell, nameLayout, nameGlyph, nameScaleX } from '../../../pes/kits/kitDecalFormulas.js';
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
  // (Supercontinental: devuelve qué se usó, para avisar cuando falta la hoja o un carácter)
  // (Supercontinental: `ink: true` = h es el alto de la tinta de un carácter de referencia — H o 0 — medido en la hoja,
  //  como se midió en el juego; sin `ink`, h es el alto de celda de Rebuilt)
  function drawText(g, tex, kind, text, cx, cy, h, { stretch = 1, spacing = 0, curve = 0, fallback, ink = false } = {}) {
    const gl = [...String(text).toUpperCase()].map(ch => ch === ' ' ? { sp: true } : glyph(tex, kind, ch));
    if (!tex || gl.some(x => x === null)) { // sin textura de fuente: texto común
      if (ink) h /= .72; // tinta de una mayúscula ≈ 72 % del cuerpo de la fuente
      g.save(); g.font = `800 ${h}px ${fallback || '"Saira Condensed", sans-serif'}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffffff'; g.strokeStyle = '#000000aa'; g.lineWidth = h * .06; g.translate(cx, cy); g.scale(stretch, 1); g.strokeText(text, 0, 0); g.fillText(text, 0, 0); g.restore();
      return { font: false, missing: tex ? [...String(text).toUpperCase()].filter((ch, i) => gl[i] === null) : null };
    }
    const ref = gl.find(x => x && !x.sp); if (!ref) return { font: true, missing: [] };
    const inkRef = ink ? glyph(tex, kind, kind === 'name' ? 'H' : '0') || ref : null;
    const k = ink ? h / inkRef.sh : h / (kind === 'name' ? ref.cellH * .84 : ref.cellH * .74), ws = gl.map(x => x.sp ? h * .35 : x.sw * k * stretch), gap = spacing * h;
    const total = ws.reduce((a, b) => a + b, 0) + gap * (ws.length - 1); let x = cx - total / 2;
    gl.forEach((q, i) => {
      if (!q.sp) { const w = ws[i], hh = q.sh * k, off = curve ? curve * h * ((x + w / 2 - cx) / (total / 2 || 1)) ** 2 : 0; g.drawImage(q.c, q.sx, q.sy, q.sw, q.sh, x, cy - hh / 2 + off, w, hh); }
      x += ws[i] + gap;
    });
    return { font: true, missing: [] };
  }
  return { cell, glyph, drawText, SIZE };
})();
/* eslint-enable */

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

const FONT_LABEL = { name: 'letras del nombre (NameFontFile)', back: 'números de la espalda (BackNumbersFile)', chest: 'número del pecho (ChestNumbersFile)', leg: 'número del short (LegNumbersFile)' };

/** Notes for text drawn without the kit's own font sheet. */
function fontNote(kind, sheetName, result) {
  if (result.font) return null;
  if (result.missing?.length) return { key: kind, level: 'warn', text: `La hoja de ${FONT_LABEL[kind]} no tiene ${result.missing.map(ch => `«${ch}»`).join(', ')}: ese texto se ve con una fuente genérica.` };
  return { key: kind, level: 'warn', text: `Falta la textura de ${FONT_LABEL[kind]}${sheetName ? ` («${sheetName}»)` : ''}: se ve con una fuente genérica.` };
}

/**
 * Kit texture with the player's name and numbers drawn where PES 2021 draws them (pes/kits/kitDecalFormulas.js:
 * the game's marking layout and shader mapping, read from PES2021.exe).
 * @param {HTMLCanvasElement|null} base decoded kit texture (null → colours from config)
 * @param {(key: string) => string|null} value config getter
 * @param {{ name?: HTMLCanvasElement, name_ex?: HTMLCanvasElement, back?: HTMLCanvasElement, chest?: HTMLCanvasElement, leg?: HTMLCanvasElement }} fonts decoded font sheets
 * @param {{ name: string, number: string }} sample
 * @param {object} render resolveKitRender(cfg) — placement from config.txt
 * @returns {{ canvas: HTMLCanvasElement, notes: {key: string, level: string, text: string}[] }}
 */
export function composeKitTexture(base, value, fonts, sample, render, S = 1024) {
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const g = c.getContext('2d');
  g.drawImage(base || fallbackKitTexture(value, S), 0, 0, S, S);
  const notes = [];
  const sheet = key => String(value(key) || '').trim();
  const num = render.back || render.chest || render.shorts ? printedNumber(render, sample.number) : '';

  if (render.name && String(sample.name || '').trim()) drawName(g, S, fonts, sample.name, render.name, notes, sheet('NameFontFile'));
  if (num && render.back) {
    const B = render.back;
    // region x (across) → u = 0.5 + W/2 − x·W, y (down the digits) → v = vTop − y·H: the back is upside down
    drawDigits(g, fonts.back, num, B.spacing, 0, (dx, dy, dw, dh) => [-dw * B.W * S, 0, 0, -dh * B.H * S, (0.5 + B.W / 2 - dx * B.W) * S, (B.vTop - dy * B.H) * S],
      r => notes.push(fontNote('back', sheet('BackNumbersFile'), r)));
  }
  if (num && render.chest) {
    const C = render.chest;
    // Without its own sheet the chest number uses the back numbers, as the game does with an empty sheet name.
    if (!fonts.chest) notes.push({ key: 'chest', level: 'info', text: `No se encontró «${sheet('ChestNumbersFile')}»: el número del pecho usa los números de la espalda.` });
    drawDigits(g, fonts.chest || fonts.back, num, render.back?.spacing ?? 0.5, 26, (dx, dy, dw, dh) => [dw * C.L * S, 0, 0, dh * C.L * S, (C.u - C.L / 2 + dx * C.L) * S, (C.v - C.L / 2 + dy * C.L) * S],
      r => fonts.chest && notes.push(fontNote('chest', sheet('ChestNumbersFile'), r)));
  }
  if (num && render.shorts) {
    const P = render.shorts, L = P.L * S, f = P.flipped ? -1 : 1;
    const ox = (P.u - f * P.L / 2) * S, oy = (P.v - f * P.L / 2) * S;
    // 128×128 number texture, digits turned 90° (top towards the waist): region x (across the digits) runs along v,
    // y (down a digit) runs against u; the left leg is the same texture turned 180°.
    drawDigits(g, fonts.leg || fonts.back, num, render.back?.spacing ?? 0.5, 26, (dx, dy, dw, dh) => [0, f * dw * L, -f * dh * L, 0, ox + f * (dy + dh) * L, oy + f * dx * L],
      r => notes.push(fontNote('leg', sheet('LegNumbersFile'), r)));
  }
  return { canvas: c, notes: notes.filter(Boolean) };
}

/** Draws one sheet cell into the unit square mapped by M = [a, b, c, d, e, f] (canvas transform). */
function drawCell(g, tex, cell, M) {
  g.save();
  g.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]);
  g.drawImage(tex, cell.u0 * tex.width, cell.v0 * tex.height, Math.max(1, cell.uw * tex.width), Math.max(1, cell.vh * tex.height), 0, 0, 1, 1);
  g.restore();
}

/** Digits laid out like the game (digitLayout) and mapped by toCanvas(x, y, w, h) → transform of each cell. */
function drawDigits(g, tex, num, spacing, inset, toCanvas, report) {
  const horizontal = !tex || tex.width >= tex.height;
  const cells = digitLayout(num, spacing, { inset, horizontal });
  if (!tex) {
    // No number sheet: plain digits in the same boxes.
    for (const q of cells) {
      g.save();
      const M = toCanvas(q.x, q.y, q.w, q.h);
      g.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]);
      g.font = '800 0.9px "Saira Condensed", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffffff';
      g.fillText(String(q.d), 0.5, 0.55, 1);
      g.restore();
    }
    report({ font: false });
    return;
  }
  for (const q of cells) drawCell(g, tex, digitCell(q.d, horizontal), toCanvas(q.x, q.y, q.w, q.h));
  report({ font: true });
}

/** The name on the game's 512×128 canvas (nameLayout), mapped onto the back: u = 0.5 + (256 − x)·kx, v = v + (64 − y)·ky. */
function drawName(g, S, fonts, text, P, notes, sheetName) {
  const L = nameLayout(text, P.shape);
  if (L.missing.length) notes.push({ key: 'name', level: 'warn', text: `El juego no tiene ${[...new Set(L.missing)].map(ch => `«${ch}»`).join(', ')} en la fuente del nombre: no se dibuja.` });
  const kx = nameScaleX(P, L.fraction), ky = P.ky;
  const needEx = L.glyphs.some(q => q.glyph.sheet === 1);
  if (needEx && !fonts.name_ex) notes.push({ key: 'name_ex', level: 'info', text: `Falta la hoja «${sheetName ? sheetName + '_ex' : 'NameFontFile_ex'}» con las letras acentuadas: se dibujan sin tilde.` });
  if (!fonts.name) notes.push(fontNote('name', sheetName, { font: false }));
  for (const q of L.glyphs) {
    let glyph = q.glyph, tex = glyph.sheet === 1 ? fonts.name_ex : fonts.name;
    if (glyph.sheet === 1 && !tex) { glyph = nameGlyph(glyph.ch.normalize('NFD')[0]) || glyph; tex = fonts.name; }
    const cos = Math.cos(q.angle), sin = Math.sin(q.angle);
    const px0 = q.x - 0.5 * q.w * cos + 0.5 * q.h * sin, py0 = q.y - 0.5 * q.w * sin - 0.5 * q.h * cos;
    const M = [-S * kx * q.w * cos, -S * ky * q.w * sin, S * kx * q.h * sin, -S * ky * q.h * cos,
      S * (0.5 + (256 - px0) * kx), S * (P.v + (64 - py0) * ky)];
    if (tex) { drawCell(g, tex, glyph, M); continue; }
    g.save();
    g.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]);
    g.font = '800 0.8px "Saira Condensed", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffffff';
    g.fillText(glyph.ch, 0.5, 0.55, 1);
    g.restore();
  }
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
