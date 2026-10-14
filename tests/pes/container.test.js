import { describe, it, expect } from 'vitest';
import { decodeWesys, encodeWesys } from '../../pes/core/wesys.js';
import { readField, writeField, fieldByteSpan, fieldRange } from '../../pes/core/fields.js';
import { hasPesdb, readPesdb } from './fixtures.js';

describe('WESYS container', () => {
  it('round-trips a payload (synthetic)', () => {
    const payload = new Uint8Array(1000).map((_, i) => i % 251);
    const file = encodeWesys(payload);
    const d = decodeWesys(file);
    expect(d.compressed).toBe(true);
    expect([...d.payload]).toEqual([...payload]);
  });

  it('supports stored (uncompressed) payloads (synthetic)', () => {
    const payload = new Uint8Array([1, 2, 3, 4]);
    const d = decodeWesys(encodeWesys(payload, { compressed: false }));
    expect(d.compressed).toBe(false);
    expect([...d.payload]).toEqual([1, 2, 3, 4]);
  });

  it('rejects non-WESYS input', () => {
    expect(() => decodeWesys(new Uint8Array(64))).toThrow(expect.objectContaining({ code: 'NOT_WESYS' }));
  });

  it('rejects truncated files', () => {
    const file = encodeWesys(new Uint8Array(500).fill(7));
    expect(() => decodeWesys(file.subarray(0, file.length - 3))).toThrow(expect.objectContaining({ code: 'TRUNCATED' }));
  });

  it('rejects corrupted zlib data', () => {
    const file = encodeWesys(new Uint8Array(500).map((_, i) => i));
    file.fill(0xaa, 20, 40);
    expect(() => decodeWesys(file)).toThrow(expect.objectContaining({ code: 'CORRUPT_ZLIB' }));
  });

  it('rejects a wrong declared size', () => {
    const file = encodeWesys(new Uint8Array(100));
    new DataView(file.buffer).setUint32(12, 99, true);
    expect(() => decodeWesys(file)).toThrow(expect.objectContaining({ code: 'SIZE_MISMATCH' }));
  });

  it('rejects unsupported container modes', () => {
    const file = encodeWesys(new Uint8Array(10));
    file[2] = 0x42;
    expect(() => decodeWesys(file)).toThrow(expect.objectContaining({ code: 'UNSUPPORTED_WESYS_FLAGS' }));
  });

  it.skipIf(!hasPesdb)('decodes every real pesdb file to its declared size', () => {
    for (const [name, bytes] of Object.entries(readPesdb())) {
      const d = decodeWesys(bytes, name);
      expect(d.payload.length, name).toBe(new DataView(bytes.buffer, bytes.byteOffset).getUint32(12, true));
    }
  });
});

describe('field codec', () => {
  const bits = { name: 'x', kind: 'bits', offset: 2, shift: 3, bits: 9, addend: 40 };

  it('writes only the bits of the field', () => {
    const buf = new Uint8Array(8).fill(0xff);
    writeField(buf, 0, bits, 40);
    expect(readField(buf, 0, bits)).toBe(40);
    // bits 3..11 of byte 2 cleared, everything else untouched
    expect([...buf]).toEqual([0xff, 0xff, 0b00000111, 0b11110000, 0xff, 0xff, 0xff, 0xff]);
    const [s, e] = fieldByteSpan(bits);
    expect([s, e]).toEqual([2, 4]);
  });

  it('applies the addend and validates ranges', () => {
    const buf = new Uint8Array(8);
    expect(fieldRange(bits)).toEqual({ min: 40, max: 40 + 511 });
    writeField(buf, 0, bits, 551);
    expect(readField(buf, 0, bits)).toBe(551);
    expect(() => writeField(buf, 0, bits, 39)).toThrow(expect.objectContaining({ code: 'OUT_OF_RANGE' }));
    expect(() => writeField(buf, 0, bits, 552)).toThrow(expect.objectContaining({ code: 'OUT_OF_RANGE' }));
    expect(() => writeField(buf, 0, bits, 50.5)).toThrow(expect.objectContaining({ code: 'TYPE' }));
  });

  it('handles signed integers, booleans and strings', () => {
    const buf = new Uint8Array(16);
    const i16 = { name: 'v', kind: 'uint', offset: 0, size: 2, signed: true };
    writeField(buf, 0, i16, -1);
    expect(readField(buf, 0, i16)).toBe(-1);
    const flag = { name: 'f', kind: 'bool', offset: 2, bit: 6 };
    writeField(buf, 0, flag, true);
    expect(buf[2]).toBe(64);
    const str = { name: 's', kind: 'string', offset: 4, length: 6 };
    writeField(buf, 0, str, 'Peñ');
    expect(readField(buf, 0, str)).toBe('Peñ');
    expect(() => writeField(buf, 0, str, 'abcdef')).toThrow(expect.objectContaining({ code: 'STRING_TOO_LONG' }));
  });
});
