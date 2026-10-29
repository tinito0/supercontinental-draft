// pes/storage/localStore.js against an in-memory IndexedDB (fake-indexeddb).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

const DB_NAME = 'scl-pes-workspace';

async function loadStore() {
  vi.resetModules(); // the module caches its connection
  return import('../../pes/storage/localStore.js');
}

function createLegacyDatabase(stores, version = 1) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, version);
    req.onupgradeneeded = () => stores.forEach(s => req.result.createObjectStore(s));
    req.onsuccess = () => { req.result.close(); resolve(); };
    req.onerror = () => reject(req.error);
  });
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe('pes/storage/localStore.js', () => {
  it('stores and reads sources, drafts and assets', async () => {
    const store = await loadStore();
    await store.putSource('abc', { kind: 'edit' });
    await store.putDraft('ws1', [{ type: 'kit.set' }]);
    expect(await store.getSource('abc')).toMatchObject({ kind: 'edit' });
    expect(await store.getDraft('ws1')).toEqual([{ type: 'kit.set' }]);
    await store.deleteSource('abc');
    expect(await store.getSource('abc')).toBeUndefined();
  });

  it("repairs a database left at version 1 without the 'sources' store, keeping its data", async () => {
    await createLegacyDatabase(['drafts']);
    const store = await loadStore();
    await store.putDraft('ws1', [{ type: 'a' }]);
    // Before the fix: "IDBDatabase.transaction: 'sources' is not a known object store name".
    await expect(store.getSource('missing')).resolves.toBeUndefined();
    await store.putSource('abc', { kind: 'pesdb' });
    expect(await store.getSource('abc')).toMatchObject({ kind: 'pesdb' });
    expect(await store.getDraft('ws1')).toEqual([{ type: 'a' }]);
  });

  it('opens a database that an older build left at a higher version', async () => {
    await createLegacyDatabase(['sources', 'drafts', 'assets'], 3);
    const store = await loadStore();
    await store.putAsset('sha', new Uint8Array([1, 2]));
    expect(await store.getAsset('sha')).toEqual(new Uint8Array([1, 2]));
  });

  it('reconnects after resetLocalStore (the "Actualizar" button)', async () => {
    const store = await loadStore();
    await store.putDraft('ws1', [1]);
    await store.resetLocalStore();
    expect(await store.getDraft('ws1')).toEqual([1]);
  });
});
