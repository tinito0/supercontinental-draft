// Texture decoding for previews: FTEX (RGBA8, DXT1/3/5, BC7) and DDS (DXT1/3/5, BC7 via DX10, RGBA8).
// Block decoders adapted from PES Editor Rebuilt js/dds.js (BSD-3-Clause); its BC7 decoder is in turn
// adapted from bcdec by Sergii Kudlai (MIT / public domain). See pes/THIRD_PARTY_NOTICES.md.
// Decoding is read-only: textures written to the game are never produced from decoded pixels.
import { ftexHeader, readFtexMip } from './ftex.js';
import { PesFormatError } from '../core/errors.js';

const KIND = { RGBA8: 0, DXT1: 1, DXT3: 3, DXT5: 5, BC7: 7 };

const PAL = new Int32Array(16), AL = new Int32Array(8), A16 = new Uint8Array(16);

function dxtColor(b, o, out, w, h, x, y, dxt1, alpha) {
  const c0 = b[o] | (b[o + 1] << 8), c1 = b[o + 2] | (b[o + 3] << 8);
  const r0 = (((c0 >> 11) & 31) * 255 / 31) | 0, g0 = (((c0 >> 5) & 63) * 255 / 63) | 0, b0 = ((c0 & 31) * 255 / 31) | 0;
  const r1 = (((c1 >> 11) & 31) * 255 / 31) | 0, g1 = (((c1 >> 5) & 63) * 255 / 63) | 0, b1 = ((c1 & 31) * 255 / 31) | 0;
  PAL.set([r0, g0, b0, 255, r1, g1, b1, 255], 0);
  if (!dxt1 || c0 > c1) {
    PAL.set([((2 * r0 + r1) / 3) | 0, ((2 * g0 + g1) / 3) | 0, ((2 * b0 + b1) / 3) | 0, 255, ((r0 + 2 * r1) / 3) | 0, ((g0 + 2 * g1) / 3) | 0, ((b0 + 2 * b1) / 3) | 0, 255], 8);
  } else {
    PAL.set([(r0 + r1) >> 1, (g0 + g1) >> 1, (b0 + b1) >> 1, 255, 0, 0, 0, 0], 8);
  }
  const bits = (b[o + 4] | (b[o + 5] << 8) | (b[o + 6] << 16) | (b[o + 7] << 24)) >>> 0;
  for (let py = 0; py < 4; py++) {
    const Y = y + py;
    if (Y >= h) break;
    for (let px = 0; px < 4; px++) {
      const X = x + px;
      if (X >= w) continue;
      const i = py * 4 + px, k = ((bits >>> (2 * i)) & 3) * 4, p = (Y * w + X) * 4;
      out[p] = PAL[k]; out[p + 1] = PAL[k + 1]; out[p + 2] = PAL[k + 2];
      out[p + 3] = alpha ? (PAL[k + 3] ? alpha[i] : 0) : PAL[k + 3];
    }
  }
}

// ---- BC7 ----
const BC7_PART = '40110011001100154001000100010005411101110111011540010011001101154000000100010015401101110111111540010011011111154000000100110115400000000001001540110111111111154000000101111115400000000001011540010111111111154000000011111115400011111111111540000000000011154000100011101115415100010000000040000000500011104151001100010000405100010000000040001000510011104000000050001100411100110011000540510001000100004000100050001100415001100110011040510110011011004001011151101000400011115111000041510001100011104051100110011100410101010101010540001111000011154101105001011010401100115100110040511100001111004101010150101010411010010110100541011010101001054151001111001110400100115100100040510010010011004051101111011100415010011001011040111100110000154110011010011005400001500110000041001150010000004050011100100000400000500111001040000100511001004110110010010015401101101100100541500011100111004051100111000110411011001100100541100011001110054111111010000005400110001110011540001111001100154051001111110000405000101110111041000100011101154015001102212226400500116211222140002001621122154226002200110115400000005122112640150011002200264026002211111115401100116211221540000000511122264000111151112226400011512222222640120052001200164112015201120116412205220122012640150112112212264015200162002220400500110112112641150011600122004000112251221126402600220022111541150111022202264005000162212221400000510122012640001100625022104126052200110000401200125122222641101261522101104000015012611221402211025102002641100510200222264011012201620015400020006211222540000002512212264226002200120015401500120022022641200520016001204000115122620000412012016052012041202012560101204011220011620015401111622200001541050101222222264000000061212125402215220022112640260011002200154220126102201225410122622222010540002121612121254105010101012226422601110222011540021512000211164000251221122116422205110111022640021112511200064110051001102226400000002152211641100510222222264022001100510026402211225122002640000000000025164006000100020005422212220222522641052222222222264115201162012220';
const BC7_BITS = [4, 6, 5, 7, 5, 7, 7, 5], BC7_ABITS = [0, 0, 0, 0, 6, 8, 7, 5];
const W2 = [0, 21, 43, 64], W3 = [0, 9, 18, 27, 37, 46, 55, 64], W4 = [0, 4, 9, 13, 17, 21, 26, 30, 34, 38, 43, 47, 51, 55, 60, 64];
const EP = new Int32Array(24), IDX = new Uint8Array(16);

function bc7Block(b, o, out, w, h, x, y) {
  let pos = 0;
  const rd = n => { let v = 0; for (let k = 0; k < n; k++, pos++) v |= ((b[o + (pos >> 3)] >> (pos & 7)) & 1) << k; return v; };
  let mode = 0;
  while (mode < 8 && !rd(1)) mode++;
  if (mode >= 8) { // reserved mode: transparent black (as the spec requires)
    for (let py = 0; py < 4; py++) for (let px = 0; px < 4; px++) { const X = x + px, Y = y + py; if (X < w && Y < h) out.fill(0, (Y * w + X) * 4, (Y * w + X) * 4 + 4); }
    return;
  }
  let partition = 0, np = 1, rotation = 0, isb = 0;
  if (mode === 0 || mode === 1 || mode === 2 || mode === 3 || mode === 7) { np = (mode === 0 || mode === 2) ? 3 : 2; partition = rd(mode === 0 ? 4 : 6); }
  const ne = np * 2;
  if (mode === 4 || mode === 5) { rotation = rd(2); if (mode === 4) isb = rd(1); }
  const cb = BC7_BITS[mode], ab = BC7_ABITS[mode];
  for (let c = 0; c < 3; c++) for (let e = 0; e < ne; e++) EP[e * 4 + c] = rd(cb);
  if (ab) for (let e = 0; e < ne; e++) EP[e * 4 + 3] = rd(ab);
  const hasP = (0b11001011 >> mode) & 1;
  if (mode === 0 || mode === 1 || mode === 3 || mode === 6 || mode === 7) {
    for (let e = 0; e < ne; e++) for (let c = 0; c < 4; c++) EP[e * 4 + c] <<= 1;
    if (mode === 1) { const i = rd(1), j = rd(1); for (let c = 0; c < 3; c++) { EP[c] |= i; EP[4 + c] |= i; EP[8 + c] |= j; EP[12 + c] |= j; } }
    else if (hasP) for (let e = 0; e < ne; e++) { const j = rd(1); for (let c = 0; c < 4; c++) EP[e * 4 + c] |= j; }
  }
  for (let e = 0; e < ne; e++) {
    let j = cb + hasP;
    for (let c = 0; c < 3; c++) { const v = EP[e * 4 + c] << (8 - j); EP[e * 4 + c] = (v | (v >> j)) & 255; }
    j = ab + hasP;
    const v = EP[e * 4 + 3] << (8 - j);
    EP[e * 4 + 3] = ab ? (v | (v >> j)) & 255 : 255;
  }
  const ib = (mode === 0 || mode === 1) ? 3 : mode === 6 ? 4 : 2, ib2 = mode === 4 ? 3 : mode === 5 ? 2 : 0;
  const wt = ib === 2 ? W2 : ib === 3 ? W3 : W4, wt2 = ib2 === 2 ? W2 : W3, base = (np - 2) * 1024 + partition * 16;
  const ps = i => (np === 1 ? (i ? 0 : 4) : BC7_PART.charCodeAt(base + i) - 48);
  for (let i = 0; i < 16; i++) IDX[i] = rd((ps(i) & 4) ? ib - 1 : ib);
  for (let i = 0; i < 16; i++) {
    const s = (ps(i) & 3) * 8, idx = IDX[i];
    const it = (c, W, k) => ((64 - W[k]) * EP[s + c] + W[k] * EP[s + 4 + c] + 32) >> 6;
    let r, g, bb, a;
    if (!ib2) { r = it(0, wt, idx); g = it(1, wt, idx); bb = it(2, wt, idx); a = it(3, wt, idx); }
    else {
      const i2 = rd(i ? ib2 : ib2 - 1);
      if (!isb) { r = it(0, wt, idx); g = it(1, wt, idx); bb = it(2, wt, idx); a = it(3, wt2, i2); }
      else { r = it(0, wt2, i2); g = it(1, wt2, i2); bb = it(2, wt2, i2); a = it(3, wt, idx); }
    }
    if (rotation === 1) [a, r] = [r, a]; else if (rotation === 2) [a, g] = [g, a]; else if (rotation === 3) [a, bb] = [bb, a];
    const X = x + (i & 3), Y = y + (i >> 2);
    if (X >= w || Y >= h) continue;
    const p = (Y * w + X) * 4;
    out[p] = r; out[p + 1] = g; out[p + 2] = bb; out[p + 3] = a;
  }
}

/** Decodes raw block data of one mip into straight RGBA8. */
export function decodeBlocks(b, w, h, kind, off = 0) {
  const out = new Uint8ClampedArray(w * h * 4);
  if (kind === KIND.RGBA8) { out.set(b.subarray(off, off + w * h * 4)); return out; }
  const bs = kind === KIND.DXT1 ? 8 : 16;
  for (let y = 0; y < h; y += 4) {
    for (let x = 0; x < w; x += 4, off += bs) {
      if (kind === KIND.BC7) bc7Block(b, off, out, w, h, x, y);
      else if (kind === KIND.DXT1) dxtColor(b, off, out, w, h, x, y, true, null);
      else if (kind === KIND.DXT3) {
        for (let i = 0; i < 16; i++) A16[i] = ((b[off + (i >> 1)] >> ((i & 1) * 4)) & 15) * 17;
        dxtColor(b, off + 8, out, w, h, x, y, false, A16);
      } else {
        const a0 = b[off], a1 = b[off + 1];
        AL[0] = a0; AL[1] = a1;
        if (a0 > a1) for (let k = 1; k < 7; k++) AL[k + 1] = (((7 - k) * a0 + k * a1) / 7) | 0;
        else { for (let k = 1; k < 5; k++) AL[k + 1] = (((5 - k) * a0 + k * a1) / 5) | 0; AL[6] = 0; AL[7] = 255; }
        const lo = b[off + 2] | (b[off + 3] << 8) | (b[off + 4] << 16), hi = b[off + 5] | (b[off + 6] << 8) | (b[off + 7] << 16);
        for (let i = 0; i < 16; i++) A16[i] = AL[i < 8 ? (lo >> (3 * i)) & 7 : (hi >> (3 * (i - 8))) & 7];
        dxtColor(b, off + 8, out, w, h, x, y, false, A16);
      }
    }
  }
  return out;
}

/** Picks the largest mip whose width is ≤ maxWidth (kit textures are 4096 px: decoding mip 0 is slow). */
function pickMip(mips, maxWidth) {
  const sorted = [...mips].sort((a, b) => b.width - a.width);
  return sorted.find(m => m.width <= maxWidth) || sorted[sorted.length - 1];
}

/** Decodes an FTEX to { width, height, pixels } (RGBA8, straight alpha). */
export function decodeFtex(bytes, { maxWidth = 1024 } = {}) {
  const h = ftexHeader(bytes);
  const mip = pickMip(h.mips, maxWidth);
  const data = readFtexMip(bytes, mip, h.fmt);
  return { width: mip.width, height: mip.height, pixels: decodeBlocks(data, mip.width, mip.height, KIND[h.format]), format: h.format };
}

/** Decodes a DDS (DXT1/3/5, DX10 BC1/2/3/7, 32-bit RGBA/BGRA) to { width, height, pixels }. */
export function decodeDds(bytes, { maxWidth = 1024 } = {}) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 128 || dv.getUint32(0, true) !== 0x20534444) throw new PesFormatError('NOT_DDS', 'No es un archivo DDS válido.');
  let h = dv.getUint32(12, true), w = dv.getUint32(16, true);
  const mips = Math.max(1, dv.getUint32(28, true));
  const four = String.fromCharCode(bytes[84], bytes[85], bytes[86], bytes[87]), pf = dv.getUint32(80, true);
  let off = 128 + (four === 'DX10' ? 20 : 0), kind = -1, bgra = false;
  if (four === 'DX10') {
    const dx = dv.getUint32(128, true);
    kind = ({ 71: 1, 72: 1, 74: 3, 75: 3, 77: 5, 78: 5, 98: 7, 99: 7, 28: 0, 29: 0, 87: 0 })[dx] ?? -1;
    bgra = dx === 87;
  } else if (pf & 4) {
    kind = ({ DXT1: 1, DXT3: 3, DXT5: 5 })[four] ?? -1;
  } else if (dv.getUint32(88, true) === 32) {
    kind = 0;
    bgra = dv.getUint32(92, true) === 0x00ff0000; // red mask in the third byte → BGRA
  }
  if (kind < 0) throw new PesFormatError('DDS_FORMAT', `Formato DDS no soportado para la vista previa (${four}).`);
  const size = (W, H) => (kind ? Math.max(1, (W + 3) >> 2) * Math.max(1, (H + 3) >> 2) * (kind === 1 ? 8 : 16) : W * H * 4);
  let lvl = 0;
  while (w > maxWidth && lvl < mips - 1) { off += size(w, h); w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); lvl++; }
  if (off + size(w, h) > bytes.length) throw new PesFormatError('DDS_TRUNCATED', 'El DDS está incompleto.');
  const pixels = decodeBlocks(bytes, w, h, kind, off);
  if (bgra) for (let i = 0; i < pixels.length; i += 4) { const t = pixels[i]; pixels[i] = pixels[i + 2]; pixels[i + 2] = t; }
  return { width: w, height: h, pixels };
}

/** Decodes a kit-server texture by extension (.ftex / .dds). PNGs are decoded by the browser. */
export function decodeTexture(bytes, ext, options) {
  if (/ftex$/i.test(ext)) return decodeFtex(bytes, options);
  if (/dds$/i.test(ext)) return decodeDds(bytes, options);
  throw new PesFormatError('TEXTURE_FORMAT', `No se puede previsualizar ${ext}.`);
}
