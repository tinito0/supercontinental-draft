// Browser-local persistence (IndexedDB) for data too large for Firestore on the Spark plan:
//  - sources: the original files, keyed by SHA-256. Written once, never overwritten.
//  - drafts:  pending (unsaved) operations per workspace, so they survive a refresh.
//  - assets:  generated textures cached locally (the shared copy lives in Firestore).
// localStorage is never used for binary data.

const DB_NAME = 'scl-pes-workspace';
const DB_VERSION = 1;
const STORES = ['sources', 'drafts', 'assets'];

let dbPromise = null;

function openVersion(version) {
  return new Promise((resolve, reject) => {
    const req = version ? indexedDB.open(DB_NAME, version) : indexedDB.open(DB_NAME);
    req.onupgradeneeded = () => {
      for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s);
    };
    req.onsuccess = () => {
      const db = req.result;
      // Another tab upgrading the schema: let it, and reconnect on the next call.
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Cerrá las otras pestañas del Editor PES y volvé a intentar: están usando una versión anterior de la base local.'));
  });
}

/**
 * Opens the local database and makes sure every store exists. A database left at this version
 * without some store (an older build, or an upgrade interrupted midway) never runs onupgradeneeded
 * again and fails with "'sources' is not a known object store name"; reopening one version higher
 * creates the missing stores and keeps the data that is there.
 */
async function connect() {
  if (typeof indexedDB === 'undefined') throw new Error('Este navegador no tiene IndexedDB.');
  let db = await openVersion();
  if (db.version < DB_VERSION || STORES.some(s => !db.objectStoreNames.contains(s))) {
    const next = Math.max(DB_VERSION, db.version + 1);
    db.close();
    db = await openVersion(next);
  }
  return db;
}

function open() {
  if (!dbPromise) {
    dbPromise = connect().catch(error => { dbPromise = null; throw error; });
  }
  return dbPromise;
}

/** Drops the cached connection so the next call reconnects (used by "Actualizar"). */
export async function resetLocalStore() {
  const pending = dbPromise;
  dbPromise = null;
  if (pending) (await pending.catch(() => null))?.close();
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
export const deleteSource = sha256 => del('sources', sha256);

export const getDraft = async wsId => (await get('drafts', wsId)) || [];
export const putDraft = (wsId, ops) => put('drafts', wsId, ops);
export const clearDraft = wsId => del('drafts', wsId);

export const getAsset = sha256 => get('assets', sha256);
export const putAsset = (sha256, bytes) => put('assets', sha256, bytes);
