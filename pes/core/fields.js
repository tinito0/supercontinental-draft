// Field codec for fixed-size records. A field descriptor is one of:
//   { kind: 'uint',   offset, size: 1|2|4, signed? }
//   { kind: 'bits',   offset, shift, bits, addend }   value = raw + addend
//   { kind: 'bool',   offset, bit }
//   { kind: 'string', offset, length }               UTF-8, NUL-terminated, NUL-padded
// Writes touch only the bits that belong to the field, so every other byte of the
// record (including fields the engine does not understand) is preserved.
import { PesValidationError } from './errors.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');

export function fieldRange(f) {
  switch (f.kind) {
    case 'uint':
      if (f.signed) return { min: -(2 ** (f.size * 8 - 1)), max: 2 ** (f.size * 8 - 1) - 1 };
      return { min: 0, max: 2 ** (f.size * 8) - 1 };
    case 'bits':
      return { min: f.addend, max: f.addend + 2 ** f.bits - 1 };
    case 'bool':
      return { min: 0, max: 1 };
    case 'string':
      return { maxBytes: f.length - 1 };
    default:
      throw new Error(`Tipo de campo desconocido: ${f.kind}`);
  }
}

// Byte span [start, end) of the record touched by a field; used to prove that
// writes stay inside their field.
export function fieldByteSpan(f) {
  switch (f.kind) {
    case 'uint': return [f.offset, f.offset + f.size];
    case 'bits': return [f.offset, f.offset + Math.ceil((f.shift + f.bits) / 8)];
    case 'bool': return [f.offset, f.offset + 1];
    case 'string': return [f.offset, f.offset + f.length];
    default: throw new Error(`Tipo de campo desconocido: ${f.kind}`);
  }
}

export function readField(buf, base, f) {
  const o = base + f.offset;
  switch (f.kind) {
    case 'uint': {
      let v = 0;
      for (let i = 0; i < f.size; i++) v += buf[o + i] * 2 ** (8 * i);
      if (f.signed && v >= 2 ** (f.size * 8 - 1)) v -= 2 ** (f.size * 8);
      return v;
    }
    case 'bits': {
      let v = 0;
      for (let i = 0; i < f.bits; i++) {
        const p = f.shift + i;
        if ((buf[o + (p >> 3)] >> (p & 7)) & 1) v += 2 ** i;
      }
      return v + f.addend;
    }
    case 'bool':
      return ((buf[o] >> f.bit) & 1) === 1;
    case 'string': {
      const s = buf.subarray(o, o + f.length);
      const z = s.indexOf(0);
      return decoder.decode(z < 0 ? s : s.subarray(0, z));
    }
    default:
      throw new Error(`Tipo de campo desconocido: ${f.kind}`);
  }
}

// Throws PesValidationError instead of clamping: silent clamping would apply a
// different value from the one the user asked for.
export function validateFieldValue(f, value) {
  const r = fieldRange(f);
  if (f.kind === 'string') {
    if (typeof value !== 'string') throw new PesValidationError('TYPE', `${f.name}: se esperaba texto.`, { field: f.name });
    const len = encoder.encode(value).length;
    if (len > r.maxBytes) throw new PesValidationError('STRING_TOO_LONG', `${f.name}: máximo ${r.maxBytes} bytes UTF-8 (tiene ${len}).`, { field: f.name, max: r.maxBytes });
    if (value.includes('\0')) throw new PesValidationError('STRING_NUL', `${f.name}: no puede contener caracteres nulos.`, { field: f.name });
    return value;
  }
  if (f.kind === 'bool') {
    if (typeof value !== 'boolean') throw new PesValidationError('TYPE', `${f.name}: se esperaba verdadero/falso.`, { field: f.name });
    return value;
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new PesValidationError('TYPE', `${f.name}: se esperaba un número entero.`, { field: f.name });
  if (value < r.min || value > r.max) throw new PesValidationError('OUT_OF_RANGE', `${f.name}: ${value} fuera de rango (${r.min}–${r.max}).`, { field: f.name, ...r });
  return value;
}

export function writeField(buf, base, f, value) {
  validateFieldValue(f, value);
  const o = base + f.offset;
  switch (f.kind) {
    case 'uint': {
      let v = value < 0 ? value + 2 ** (f.size * 8) : value;
      for (let i = 0; i < f.size; i++) { buf[o + i] = v % 256; v = Math.floor(v / 256); }
      return;
    }
    case 'bits': {
      const raw = value - f.addend;
      for (let i = 0; i < f.bits; i++) {
        const p = f.shift + i;
        const idx = o + (p >> 3);
        const mask = 1 << (p & 7);
        if (Math.floor(raw / 2 ** i) & 1) buf[idx] |= mask; else buf[idx] &= ~mask;
      }
      return;
    }
    case 'bool':
      if (value) buf[o] |= 1 << f.bit; else buf[o] &= ~(1 << f.bit);
      return;
    case 'string': {
      buf.fill(0, o, o + f.length);
      buf.set(encoder.encode(value), o);
      return;
    }
    default:
      throw new Error(`Tipo de campo desconocido: ${f.kind}`);
  }
}

export async function sha256Hex(bytes) {
  const data = typeof bytes === 'string' ? encoder.encode(bytes) : bytes;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
