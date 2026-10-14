// WESYS container used by PES 2021 database files (common/etc/pesdb/*.bin).
//
// Verified layout (all 13 files in vendor/UML_Database/common/etc/pesdb):
//   0x00  u8[2]  0xFF 0x10           (constant)
//   0x02  u8     flags: 0x81 = zlib-compressed payload, 0x00 = stored payload
//   0x03  char[5] "WESYS"
//   0x08  u32le  payload size as stored (compressed size when flagged)
//   0x0C  u32le  decompressed size
//   0x10  payload
import { unzlibSync, zlibSync } from 'fflate';
import { PesFormatError } from './errors.js';

const MAGIC = [0x57, 0x45, 0x53, 0x59, 0x53]; // "WESYS"
export const WESYS_HEADER_SIZE = 16;
const FLAG_COMPRESSED = 0x81;
const FLAG_STORED = 0x00;

// fflate does not verify the zlib trailer, so corrupted streams can decode "successfully".
// The Adler-32 of the output is checked against the stream's trailer instead.
export function adler32(data) {
  let a = 1, b = 0;
  for (let i = 0; i < data.length;) {
    const end = Math.min(i + 3800, data.length);
    for (; i < end; i++) { a += data[i]; b += a; }
    a %= 65521; b %= 65521;
  }
  return ((b << 16) | a) >>> 0;
}

export function isWesys(bytes) {
  if (!bytes || bytes.length < WESYS_HEADER_SIZE) return false;
  return MAGIC.every((b, i) => bytes[3 + i] === b);
}

export function decodeWesys(bytes, fileName = 'archivo') {
  if (!(bytes instanceof Uint8Array)) throw new PesFormatError('NOT_BYTES', `${fileName}: se esperaba un Uint8Array.`);
  if (!isWesys(bytes)) throw new PesFormatError('NOT_WESYS', `${fileName}: no es un archivo de base de datos PES (falta la cabecera WESYS).`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const flags = bytes[2];
  const storedSize = view.getUint32(8, true);
  const size = view.getUint32(12, true);
  if (flags !== FLAG_COMPRESSED && flags !== FLAG_STORED) {
    throw new PesFormatError('UNSUPPORTED_WESYS_FLAGS', `${fileName}: modo de contenedor no soportado (0x${flags.toString(16)}).`, { flags });
  }
  if (WESYS_HEADER_SIZE + storedSize !== bytes.length) {
    throw new PesFormatError('TRUNCATED', `${fileName}: el tamaño declarado (${storedSize}) no coincide con el archivo (${bytes.length - WESYS_HEADER_SIZE}). Archivo truncado o dañado.`, { storedSize, actual: bytes.length - WESYS_HEADER_SIZE });
  }
  const body = bytes.subarray(WESYS_HEADER_SIZE);
  let payload;
  if (flags === FLAG_COMPRESSED) {
    try {
      payload = unzlibSync(body);
    } catch (e) {
      throw new PesFormatError('CORRUPT_ZLIB', `${fileName}: los datos comprimidos están dañados (${e.message}).`);
    }
    const trailer = body.length >= 4 ? new DataView(body.buffer, body.byteOffset + body.length - 4, 4).getUint32(0, false) : -1;
    if (adler32(payload) !== trailer) {
      throw new PesFormatError('CORRUPT_ZLIB', `${fileName}: los datos comprimidos están dañados (checksum Adler-32 incorrecto).`);
    }
  } else {
    payload = body.slice();
  }
  if (payload.length !== size) {
    throw new PesFormatError('SIZE_MISMATCH', `${fileName}: se descomprimieron ${payload.length} bytes pero la cabecera declara ${size}.`, { size, actual: payload.length });
  }
  return { header: bytes.slice(0, WESYS_HEADER_SIZE), compressed: flags === FLAG_COMPRESSED, payload };
}

// Re-wraps a payload, keeping the original header's constant bytes and compression mode.
export function encodeWesys(payload, { header, compressed = true } = {}) {
  const body = compressed ? zlibSync(payload, { level: 9 }) : payload;
  const out = new Uint8Array(WESYS_HEADER_SIZE + body.length);
  if (header) out.set(header.subarray(0, 8), 0);
  else out.set([0xff, 0x10, 0, ...MAGIC], 0);
  out[2] = compressed ? FLAG_COMPRESSED : FLAG_STORED;
  const view = new DataView(out.buffer);
  view.setUint32(8, body.length, true);
  view.setUint32(12, payload.length, true);
  out.set(body, WESYS_HEADER_SIZE);
  return out;
}
