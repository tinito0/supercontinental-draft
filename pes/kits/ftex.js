// FTEX texture writer/reader (the texture format the kit-server loads).
// Writer adapted from PES Editor Rebuilt js/ftexenc.js (BSD-3-Clause), using fflate for
// zlib so it also runs outside the browser. Layout produced (same as the patch's kits):
//   0x00 "FTEX", f32 version 2.03, u16 format (4 = DXT5, 2 = DXT1), u16 width, u16 height, u16 depth=1
//   0x10 u8 mipCount, u8 2, u16 0x11 ... u32 3 at 0x1C
//   0x40 mip table, 16 bytes per mip: u32 offset, u32 uncompressedSize, u32 storedSize, u8 index, u8 0, u16 chunkCount
//   mip data: chunk table (u16 storedLen, u16 rawLen & 0xFFFF, u32 offset) then zlib (or raw) 16 KB chunks
import { zlibSync, unzlibSync } from 'fflate';
import { PesFormatError } from '../core/errors.js';
import { adler32 } from '../core/wesys.js';

const CHUNK = 16384;
const c565 = (r, g, b) => ((r * 31 / 255 + 0.5) | 0) << 11 | ((g * 63 / 255 + 0.5) | 0) << 5 | ((b * 31 / 255 + 0.5) | 0);
const un565 = c => [((c >> 11) & 31) * 255 / 31, ((c >> 5) & 63) * 255 / 63, (c & 31) * 255 / 31];

function colorBlock(out, o, blk) {
  let r0 = 255, g0 = 255, b0 = 255, r1 = 0, g1 = 0, b1 = 0;
  for (let i = 0; i < 16; i++) {
    const r = blk[i * 4], g = blk[i * 4 + 1], b = blk[i * 4 + 2];
    if (r < r0) r0 = r; if (g < g0) g0 = g; if (b < b0) b0 = b;
    if (r > r1) r1 = r; if (g > g1) g1 = g; if (b > b1) b1 = b;
  }
  const ir = (r1 - r0) >> 4, ig = (g1 - g0) >> 4, ib = (b1 - b0) >> 4;
  r0 += ir; g0 += ig; b0 += ib; r1 -= ir; g1 -= ig; b1 -= ib;
  let ca = c565(r1, g1, b1), cb = c565(r0, g0, b0);
  if (ca < cb) { const t = ca; ca = cb; cb = t; }
  if (ca === cb) { if (cb > 0) cb--; else ca++; }
  const A = un565(ca), B = un565(cb);
  const P = [A, B, [(2 * A[0] + B[0]) / 3, (2 * A[1] + B[1]) / 3, (2 * A[2] + B[2]) / 3], [(A[0] + 2 * B[0]) / 3, (A[1] + 2 * B[1]) / 3, (A[2] + 2 * B[2]) / 3]];
  let bits = 0;
  for (let i = 15; i >= 0; i--) {
    const r = blk[i * 4], g = blk[i * 4 + 1], b = blk[i * 4 + 2];
    let best = 0, bd = 1e9;
    for (let k = 0; k < 4; k++) {
      const dr = r - P[k][0], dg = g - P[k][1], db = b - P[k][2];
      const d = dr * dr * 3 + dg * dg * 4 + db * db * 2;
      if (d < bd) { bd = d; best = k; }
    }
    bits = (bits << 2) | best;
  }
  out[o] = ca & 255; out[o + 1] = ca >> 8; out[o + 2] = cb & 255; out[o + 3] = cb >> 8;
  out[o + 4] = bits & 255; out[o + 5] = (bits >>> 8) & 255; out[o + 6] = (bits >>> 16) & 255; out[o + 7] = (bits >>> 24) & 255;
}

function alphaBlock(out, o, blk) {
  let a0 = 0, a1 = 255;
  for (let i = 0; i < 16; i++) { const a = blk[i * 4 + 3]; if (a > a0) a0 = a; if (a < a1) a1 = a; }
  out[o] = a0; out[o + 1] = a1;
  if (a0 === a1) { for (let k = 2; k < 8; k++) out[o + k] = 0; return; }
  const pal = [a0, a1];
  for (let k = 1; k < 7; k++) pal.push(((7 - k) * a0 + k * a1) / 7);
  let lo = 0, hi = 0;
  for (let i = 0; i < 16; i++) {
    const a = blk[i * 4 + 3];
    let best = 0, bd = 999;
    for (let k = 0; k < 8; k++) { const d = Math.abs(a - pal[k]); if (d < bd) { bd = d; best = k; } }
    if (i < 8) lo |= best << (3 * i); else hi |= best << (3 * (i - 8));
  }
  out[o + 2] = lo & 255; out[o + 3] = (lo >> 8) & 255; out[o + 4] = (lo >> 16) & 255;
  out[o + 5] = hi & 255; out[o + 6] = (hi >> 8) & 255; out[o + 7] = (hi >> 16) & 255;
}

function encodeDxt(px, w, h, dxt5) {
  const bw = Math.max(1, (w + 3) >> 2), bh = Math.max(1, (h + 3) >> 2), bs = dxt5 ? 16 : 8;
  const out = new Uint8Array(bw * bh * bs);
  const blk = new Uint8Array(64);
  let o = 0;
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++, o += bs) {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const sx = Math.min(w - 1, bx * 4 + x), sy = Math.min(h - 1, by * 4 + y), s = (sy * w + sx) * 4, d = (y * 4 + x) * 4;
      blk[d] = px[s]; blk[d + 1] = px[s + 1]; blk[d + 2] = px[s + 2]; blk[d + 3] = px[s + 3];
    }
    if (dxt5) { alphaBlock(out, o, blk); colorBlock(out, o + 8, blk); } else colorBlock(out, o, blk);
  }
  return out;
}

function packMip(data) {
  const n = Math.max(1, Math.ceil(data.length / CHUNK));
  const parts = [];
  for (let i = 0; i < n; i++) {
    const raw = data.subarray(i * CHUNK, Math.min(data.length, (i + 1) * CHUNK));
    const z = zlibSync(raw, { level: 6 });
    parts.push(z.length < raw.length ? { z, raw } : { z: raw, raw });
  }
  const tbl = 8 * n;
  const out = new Uint8Array(tbl + parts.reduce((a, p) => a + p.z.length, 0));
  const dv = new DataView(out.buffer);
  let off = tbl;
  parts.forEach((p, i) => {
    dv.setUint16(i * 8, p.z.length, true);
    dv.setUint16(i * 8 + 2, p.raw.length & 0xffff, true);
    dv.setUint32(i * 8 + 4, off, true);
    out.set(p.z, off);
    off += p.z.length;
  });
  return { bytes: out, chunks: n, unc: data.length };
}

const isPow2 = v => v > 0 && (v & (v - 1)) === 0;

/**
 * Encodes straight (non-premultiplied) RGBA pixels into an FTEX with a full mip chain.
 * @param {Uint8Array|Uint8ClampedArray} px RGBA, width*height*4
 */
export function encodeFtex(px, W, H, { dxt5 = true } = {}) {
  if (!isPow2(W) || !isPow2(H) || W > 8192 || H > 8192) throw new PesFormatError('FTEX_SIZE', `Tamaño de textura inválido ${W}x${H} (potencia de 2, máx. 8192).`);
  if (px.length !== W * H * 4) throw new PesFormatError('FTEX_PIXELS', 'La cantidad de píxeles no coincide con el tamaño.');
  const levels = [];
  let cur = px, w = W, h = H;
  for (;;) {
    levels.push(encodeDxt(cur, w, h, dxt5));
    if (w === 1 && h === 1) break;
    const nw = Math.max(1, w >> 1), nh = Math.max(1, h >> 1), nx = new Uint8Array(nw * nh * 4);
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) for (let c = 0; c < 4; c++) {
      const x0 = Math.min(w - 1, x * 2), x1 = Math.min(w - 1, x * 2 + 1), y0 = Math.min(h - 1, y * 2), y1 = Math.min(h - 1, y * 2 + 1);
      nx[(y * nw + x) * 4 + c] = (cur[(y0 * w + x0) * 4 + c] + cur[(y0 * w + x1) * 4 + c] + cur[(y1 * w + x0) * 4 + c] + cur[(y1 * w + x1) * 4 + c] + 2) >> 2;
    }
    cur = nx; w = nw; h = nh;
  }
  const packed = levels.map(packMip);
  const n = levels.length, head = 0x40 + n * 16;
  const out = new Uint8Array(head + packed.reduce((a, p) => a + p.bytes.length, 0));
  const dv = new DataView(out.buffer);
  out.set([0x46, 0x54, 0x45, 0x58]);
  dv.setFloat32(4, 2.03, true);
  dv.setUint16(8, dxt5 ? 4 : 2, true); dv.setUint16(10, W, true); dv.setUint16(12, H, true); dv.setUint16(14, 1, true);
  out[16] = n; out[17] = 2; dv.setUint16(18, 0x11, true); dv.setUint32(0x1c, 3, true);
  let off = head;
  for (let i = n - 1; i >= 0; i--) {
    const p = packed[i], e = 0x40 + i * 16;
    dv.setUint32(e, off, true); dv.setUint32(e + 4, p.unc, true); dv.setUint32(e + 8, p.bytes.length, true);
    out[e + 12] = i; out[e + 13] = 0; dv.setUint16(e + 14, p.chunks, true);
    out.set(p.bytes, off);
    off += p.bytes.length;
  }
  return out;
}

/**
 * Parses an FTEX and checks every mip decompresses to the expected DXT size.
 * Used to verify generated textures before they are exported.
 */
// FTEX pixel formats (codes from PES Editor Rebuilt js/kitstudio.js ftexDecode, confirmed on patch files).
export const FTEX_FORMATS = {
  0: { name: 'RGBA8', bytesPerPixel: 4 },
  2: { name: 'DXT1', blockBytes: 8 },
  3: { name: 'DXT3', blockBytes: 16 },
  4: { name: 'DXT5', blockBytes: 16 },
  11: { name: 'BC7', blockBytes: 16 },
};

function mipSize(fmt, w, h) {
  return fmt.bytesPerPixel ? w * h * fmt.bytesPerPixel : Math.max(1, (w + 3) >> 2) * Math.max(1, (h + 3) >> 2) * fmt.blockBytes;
}

/** FTEX header: format, size and mip table (no pixel data read). */
export function ftexHeader(bytes) {
  if (bytes.length < 0x40 || String.fromCharCode(...bytes.subarray(0, 4)) !== 'FTEX') throw new PesFormatError('NOT_FTEX', 'No es una textura FTEX.');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const code = dv.getUint16(8, true), width = dv.getUint16(10, true), height = dv.getUint16(12, true), mips = bytes[16];
  const fmt = FTEX_FORMATS[code];
  if (!fmt) throw new PesFormatError('FTEX_FORMAT', `Formato FTEX no soportado (${code}).`);
  if (0x40 + mips * 16 > bytes.length) throw new PesFormatError('FTEX_TRUNCATED', 'Tabla de mips fuera del archivo.');
  const table = [];
  for (let i = 0; i < mips; i++) {
    const e = 0x40 + i * 16;
    const level = bytes[e + 12];
    table.push({
      index: i, level, offset: dv.getUint32(e, true), size: dv.getUint32(e + 4, true), stored: dv.getUint32(e + 8, true), chunks: dv.getUint16(e + 14, true),
      width: Math.max(1, width >> level), height: Math.max(1, height >> level),
    });
  }
  return { code, format: fmt.name, fmt, width, height, mips: table };
}

/** Decompresses one mip (entry of ftexHeader().mips) and verifies its size and checksums. */
export function readFtexMip(bytes, mip, fmt) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const { level, offset: off, size: unc, stored, chunks } = mip;
  const expected = mipSize(fmt, mip.width, mip.height);
  if (unc !== expected) throw new PesFormatError('FTEX_MIP', `Mip ${level}: tamaño ${unc}, se esperaba ${expected}.`);
  if (off + stored > bytes.length) throw new PesFormatError('FTEX_TRUNCATED', `Mip ${level} fuera del archivo.`);
  const out = new Uint8Array(unc);
  let total = 0;
  for (let c = 0; c < chunks; c++) {
    const co = off + c * 8;
    const len = dv.getUint16(co, true), rawLen = dv.getUint16(co + 2, true) || 65536, dof = dv.getUint32(co + 4, true);
    const at = off + (dof & 0x7fffffff);
    if (at + len > bytes.length) throw new PesFormatError('FTEX_TRUNCATED', `Mip ${level}, bloque ${c} fuera del archivo.`);
    const chunk = bytes.subarray(at, at + len);
    let data;
    const raw = (dof & 0x80000000) || len === rawLen;
    try { data = raw ? chunk : unzlibSync(chunk); } catch (err) {
      throw new PesFormatError('FTEX_CHUNK', `Mip ${level}, bloque ${c}: datos comprimidos dañados (${err.message}).`);
    }
    if (!raw && adler32(data) !== new DataView(chunk.buffer, chunk.byteOffset + chunk.length - 4, 4).getUint32(0, false)) {
      throw new PesFormatError('FTEX_CHUNK', `Mip ${level}, bloque ${c}: checksum incorrecto.`);
    }
    if (data.length !== rawLen) throw new PesFormatError('FTEX_CHUNK', `Mip ${level}, bloque ${c}: ${data.length} bytes, se esperaban ${rawLen}.`);
    if (total + data.length > unc) throw new PesFormatError('FTEX_MIP', `Mip ${level}: más datos que los ${unc} bytes esperados.`);
    out.set(data, total);
    total += data.length;
  }
  if (total !== unc) throw new PesFormatError('FTEX_MIP', `Mip ${level}: se leyeron ${total} de ${unc} bytes.`);
  return out;
}

/**
 * Parses an FTEX header and mip table and checks that every mip's chunks decompress to
 * the size its format requires. Reads real patch textures (any format above) and is used
 * to verify generated textures before export. Pixel data is not decoded.
 */
export function inspectFtex(bytes) {
  const h = ftexHeader(bytes);
  for (const mip of h.mips) readFtexMip(bytes, mip, h.fmt);
  return { format: h.format, code: h.code, width: h.width, height: h.height, mips: h.mips.length };
}
