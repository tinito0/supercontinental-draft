// Browser-local persistence (IndexedDB) for data too large for Firestore on the Spark plan:
//  - sources: the original files, keyed by SHA-256. Written once, never overwritten.
//  - drafts:  pending (unsaved) operations per workspace, so they survive a refresh.
//  - assets:  generated textures cached locally (the shared copy lives in Firestore).
// localStorage is never used for binary data.

const DB_NAME = 'scl-pes-workspace';
const DB_VERSION = 1;
const STORES = ['sources', 'drafts', 'assets'];

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('Este navegador no tiene IndexedDB.')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transacción cancelada'));
  });
}

const get = (store, key) => tx(store, 'readonly', s => s.get(key));
const put = (store, key, value) => tx(store, 'readwrite', s => s.put(value, key));
const del = (store, key) => tx(store, 'readwrite', s => s.delete(key));

/** Stores an original source once; refuses to replace different content under the same hash. */
export async function putSource(sha256, record) {
  const existing = await get('sources', sha256);
  if (existing) return existing;
  await put('sources', sha256, { ...record, storedAt: new Date().toISOString() });
  return record;
}
export const getSource = sha256 => get('sources', sha256);

export const getDraft = async wsId => (await get('drafts', wsId)) || [];
export const putDraft = (wsId, ops) => put('drafts', wsId, ops);
export const clearDraft = wsId => del('drafts', wsId);

export const getAsset = sha256 => get('assets', sha256);
export const putAsset = (sha256, bytes) => put('assets', sha256, bytes);
