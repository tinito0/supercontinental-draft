// Source records (what IndexedDB stores) <-> single files for shared storage (Supabase).
// The identity of a source is a SHA-256 over its *content* (not the archive bytes), so a
// downloaded source is verified by unpacking it and recomputing the same hash.
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { sha256Hex } from '../core/fields.js';
import { PesFormatError } from '../core/errors.js';

/** Content hash of a source record (same value readSources() stores in the workspace). */
export async function sourceSha(record) {
  if (record.kind === 'edit') return sha256Hex(record.bytes);
  if (record.kind === 'pesdb') {
    const hashes = {};
    for (const [name, bytes] of Object.entries(record.files)) hashes[name] = await sha256Hex(bytes);
    return sha256Hex(JSON.stringify(Object.entries(hashes).sort()));
  }
  if (record.kind === 'kits') return sha256Hex(JSON.stringify(record.texts));
  throw new PesFormatError('UNKNOWN_SOURCE', `Tipo de fuente desconocido: ${record.kind}.`);
}

/** Packs a source record into one file. */
export function packSource(record) {
  if (record.kind === 'edit') return record.bytes;
  if (record.kind === 'pesdb') return zipSync(Object.fromEntries(Object.entries(record.files).map(([n, b]) => [n, [b, { level: 0 }]])));
  if (record.kind === 'kits') {
    return zipSync({
      'texts.json': [strToU8(JSON.stringify(record.texts)), { level: 6 }],
      'allPaths.json': [strToU8(JSON.stringify(record.allPaths)), { level: 6 }],
    });
  }
  throw new PesFormatError('UNKNOWN_SOURCE', `Tipo de fuente desconocido: ${record.kind}.`);
}

/** Inverse of packSource. */
export function unpackSource(kind, bytes) {
  if (kind === 'edit') return { kind, bytes };
  let entries;
  try { entries = unzipSync(bytes); } catch (e) { throw new PesFormatError('CORRUPT_SOURCE', `La fuente compartida está dañada (${e.message}).`); }
  if (kind === 'pesdb') return { kind, files: entries };
  if (kind === 'kits') {
    if (!entries['texts.json'] || !entries['allPaths.json']) throw new PesFormatError('CORRUPT_SOURCE', 'Al kit-server compartido le faltan datos.');
    return { kind, texts: JSON.parse(strFromU8(entries['texts.json'])), allPaths: JSON.parse(strFromU8(entries['allPaths.json'])) };
  }
  throw new PesFormatError('UNKNOWN_SOURCE', `Tipo de fuente desconocido: ${kind}.`);
}
