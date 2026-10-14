import { describe, it, expect } from 'vitest';
import { packSource, unpackSource, sourceSha } from '../../pes/storage/sourceArchive.js';
import { hasPesdb, hasEdit, hasKitServer, readPesdb, readEdit, readKitServer, syntheticKitServer } from './fixtures.js';

const LIMIT = 32 * 1024 * 1024; // bucket file_size_limit in supabase/storage-policies.sql

async function roundTrip(record) {
  const packed = packSource(record);
  const back = unpackSource(record.kind, packed);
  expect(await sourceSha(back)).toBe(await sourceSha(record));
  return packed;
}

describe('shared source archives', () => {
  it('round-trips a kit-server record (synthetic)', async () => {
    const s = syntheticKitServer();
    await roundTrip({ kind: 'kits', texts: [...s.texts].sort((a, b) => (a[0] < b[0] ? -1 : 1)), allPaths: [...s.all] });
  });

  it('rejects a damaged archive', () => {
    expect(() => unpackSource('pesdb', new Uint8Array([1, 2, 3, 4]))).toThrow(expect.objectContaining({ code: 'CORRUPT_SOURCE' }));
  });

  it.skipIf(!hasPesdb)('round-trips the real pesdb within the bucket limit', async () => {
    const packed = await roundTrip({ kind: 'pesdb', files: readPesdb() });
    expect(packed.length).toBeLessThan(LIMIT);
  });

  it.skipIf(!hasEdit)('round-trips the real EDIT within the bucket limit', async () => {
    const packed = await roundTrip({ kind: 'edit', bytes: readEdit() });
    expect(packed.length).toBeLessThan(LIMIT);
  });

  it.skipIf(!hasKitServer)('round-trips the real kit-server within the bucket limit', async () => {
    const { texts, all } = readKitServer();
    const packed = await roundTrip({ kind: 'kits', texts: [...texts].sort((a, b) => (a[0] < b[0] ? -1 : 1)), allPaths: [...all] });
    expect(packed.length).toBeLessThan(LIMIT);
  }, 180_000);
});
