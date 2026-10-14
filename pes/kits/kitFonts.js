// Kit fonts. In PES 2021 a kit's lettering is not a font file but four glyph-sheet
// textures referenced from config.txt:
//   NameFontFile     letters A–Z and "." of the back name      (4:1 sheet)
//   BackNumbersFile  digits 0–9 on the back                     (8:1 sheet)
//   ChestNumbersFile digits 0–9 on the chest (empty = no chest number)
//   LegNumbersFile   digits 0–9 on the shorts                   (8:1 sheet)
// Glyph cell positions are adapted from PES Editor Rebuilt js/kitfont.js (BSD-3-Clause),
// measured on the "Letters/Numbers Template.psd" masks at 2048 px width and scaled.
// Sheet sizes observed in the UML patch (400 font textures, all BC7):
//   name 2048x512 (most), 1024x256; numbers 4096x512, 2048x256, 1024x128.
import { encodeFtex, inspectFtex } from './ftex.js';
import { getKitValue } from './kitConfig.js';
import { PesValidationError } from '../core/errors.js';

export const FONT_SLOTS = [
  { kind: 'name', key: 'NameFontFile', label: 'Letras del nombre', aspect: 4, defaultWidth: 2048, suffix: '_name' },
  { kind: 'back', key: 'BackNumbersFile', label: 'Números de la espalda', aspect: 8, defaultWidth: 2048, suffix: '_back' },
  { kind: 'chest', key: 'ChestNumbersFile', label: 'Números del pecho', aspect: 8, defaultWidth: 1024, suffix: '_chest' },
  { kind: 'leg', key: 'LegNumbersFile', label: 'Números del short', aspect: 8, defaultWidth: 2048, suffix: '_leg' },
];
export const FONT_WIDTHS = [1024, 2048, 4096];

const LETTERS = {
  A: [18, 160], B: [188, 306], C: [336, 464], D: [496, 620], E: [648, 766], F: [776, 896], G: [912, 1040], H: [1064, 1188],
  I: [1200, 1282], J: [1296, 1402], K: [1420, 1548], L: [1568, 1680], M: [1698, 1868], N: [1880, 2022],
  O: [18, 160], P: [190, 306], Q: [336, 480], R: [512, 642], S: [670, 786], T: [818, 944], U: [968, 1096], V: [1120, 1264],
  W: [1282, 1472], X: [1488, 1618], Y: [1648, 1776], Z: [1808, 1936], '.': [1960, 2014],
};
const SECOND_ROW = new Set('OPQRSTUVWXYZ.');
const DIGITS = [[0, 160], [200, 300], [340, 500], [540, 700], [740, 900], [940, 1100], [1140, 1300], [1340, 1500], [1540, 1700], [1740, 1900]];

export const slotByKind = kind => FONT_SLOTS.find(s => s.kind === kind);
export const charsOf = kind => (kind === 'name' ? Object.keys(LETTERS) : '0123456789'.split(''));

/** Pixel rectangle [x, y, w, h] of a character inside a W x H sheet. */
export function glyphCell(kind, ch, W, H) {
  const k = W / 2048;
  if (kind === 'name') {
    const c = LETTERS[ch];
    if (!c) return null;
    return [c[0] * k, (SECOND_ROW.has(ch) ? 260 / 512 : 4 / 512) * H, (c[1] - c[0]) * k, (H / 2) * (248 / 256)];
  }
  const c = DIGITS[Number(ch)];
  if (!c || !/^\d$/.test(ch)) return null;
  return [c[0] * k, 0, (c[1] - c[0]) * k, H];
}

export function sheetSize(kind, width) {
  const slot = slotByKind(kind);
  if (!slot) throw new PesValidationError('UNKNOWN_FONT_SLOT', `Tipo de fuente desconocido: ${kind}.`);
  if (!FONT_WIDTHS.includes(width)) throw new PesValidationError('OUT_OF_RANGE', `Ancho de hoja inválido (${width}).`);
  return [width, width / slot.aspect];
}

/** Valid texture base name for a generated sheet (letters, digits, "_", "-"). */
export function fontFileName(base, kind) {
  const clean = String(base).toLowerCase().replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
  if (!clean) throw new PesValidationError('INVALID_ASSET_REF', 'Nombre de fuente vacío.');
  return clean + slotByKind(kind).suffix;
}

/**
 * Fonts already used by the patch: every distinct texture name per slot, which kits use
 * it and whether the .ftex/.dds exists in the kit-server (otherwise it lives in a CPK).
 */
export function fontLibrary(kits) {
  const lib = Object.fromEntries(FONT_SLOTS.map(s => [s.kind, new Map()]));
  for (const [path, cfg] of kits.configs) {
    const dir = path.replace(/config\.txt$/i, '').toLowerCase();
    for (const slot of FONT_SLOTS) {
      const file = getKitValue(cfg, slot.key);
      if (!file) continue;
      const entry = lib[slot.kind].get(file) || { file, usedBy: [], present: false };
      entry.usedBy.push(path.replace(/\/config\.txt$/i, ''));
      if (['.ftex', '.dds', '.png'].some(ext => kits.allPaths.has(dir + file.toLowerCase() + ext))) entry.present = true;
      lib[slot.kind].set(file, entry);
    }
  }
  return Object.fromEntries(Object.entries(lib).map(([k, m]) => [k, [...m.values()].sort((a, b) => b.usedBy.length - a.usedBy.length)]));
}

/**
 * Draws a glyph sheet with a font the browser has loaded. `ctx` is a 2D canvas context of
 * the sheet size. Returns straight RGBA pixels ready for encodeFtex.
 * @param {CanvasRenderingContext2D} ctx
 * @param {'name'|'back'|'chest'|'leg'} kind
 * @param {{ family: string, weight?: number, italic?: boolean, fill: string, outline?: number, outlineColor?: string, widthScale?: number }} o
 */
export function renderFontSheet(ctx, kind, o) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);
  const font = `${o.italic ? 'italic ' : ''}${o.weight || 700} 100px "${o.family}", sans-serif`;
  ctx.font = font;
  const ref = ctx.measureText(kind === 'name' ? 'H' : '0');
  const capRef = (ref.actualBoundingBoxAscent + ref.actualBoundingBoxDescent) || 72;
  for (const ch of charsOf(kind)) {
    const [x, y, w, h] = glyphCell(kind, ch, W, H);
    const outline = Math.max(0, o.outline || 0) * (h / 256);
    const target = h * (kind === 'name' ? 0.84 : 0.74) - outline * 2;
    ctx.save();
    ctx.font = font;
    const m = ctx.measureText(ch);
    const gw = (m.actualBoundingBoxRight + m.actualBoundingBoxLeft) || m.width;
    const s = target / capRef;
    const sx = Math.min(o.widthScale || 1, (w * 0.92 - outline * 2) / (gw * s));
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(s * sx, s);
    const by = (ref.actualBoundingBoxAscent - ref.actualBoundingBoxDescent) / 2;
    const dx = -(m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2;
    if (outline > 0) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = (outline * 2) / s;
      ctx.strokeStyle = o.outlineColor || '#000000';
      ctx.strokeText(ch, dx, by);
    }
    ctx.fillStyle = o.fill;
    ctx.fillText(ch, dx, by);
    ctx.restore();
  }
  return ctx.getImageData(0, 0, W, H).data;
}

/** Encodes a rendered sheet to FTEX (DXT5) and verifies the result structurally. */
export function encodeFontSheet(pixels, kind, width) {
  const [W, H] = sheetSize(kind, width);
  const bytes = encodeFtex(pixels, W, H, { dxt5: true });
  const info = inspectFtex(bytes);
  if (info.width !== W || info.height !== H) throw new PesValidationError('FTEX_VERIFY', 'La textura generada no tiene el tamaño esperado.');
  return { bytes, info };
}
