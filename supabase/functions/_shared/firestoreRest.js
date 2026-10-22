// Minimal Firestore REST client with read-write transactions, for code that runs outside Firebase
// (the Supabase Edge Function). Talks to production with a service-account token, or to the
// emulator (baseUrl http://host:port/v1, token "owner") in tests. No SDK, only fetch.
import { encodeFields, decodeFields } from './firestoreValues.js';

const OPERATORS = { '==': 'EQUAL', '!=': 'NOT_EQUAL', '<': 'LESS_THAN', '<=': 'LESS_THAN_OR_EQUAL', '>': 'GREATER_THAN', '>=': 'GREATER_THAN_OR_EQUAL', in: 'IN' };
const AUTO_ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export class FirestoreRestError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = 'FirestoreRestError';
    this.status = status;
    this.code = code;
  }
}

export function createFirestore({ projectId, databaseId = '(default)', baseUrl = 'https://firestore.googleapis.com/v1', getAccessToken, fetchImpl = fetch }) {
  const dbName = `projects/${projectId}/databases/${databaseId}`;
  const root = `${baseUrl}/${dbName}/documents`;
  const docName = path => `${dbName}/documents/${path}`;

  async function request(method, url, body) {
    const token = await getAccessToken();
    const response = await fetchImpl(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status === 404 && method === 'GET') return null;
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = Array.isArray(payload) ? payload[0]?.error : payload.error;
      throw new FirestoreRestError(response.status, error?.message || `Firestore ${response.status}`, error?.status);
    }
    return payload;
  }

  const toSnapshot = document => {
    if (!document) return null;
    const path = document.name.slice(`${dbName}/documents/`.length);
    return { id: path.split('/').pop(), path, data: decodeFields(document.fields) };
  };

  function createTransaction(transaction) {
    const writes = [];
    const write = (path, data, { mask, exists, serverTimestamps = [] } = {}) => {
      const entry = { update: { name: docName(path), fields: encodeFields(data) } };
      if (mask) entry.updateMask = { fieldPaths: mask };
      if (exists !== undefined) entry.currentDocument = { exists };
      if (serverTimestamps.length) {
        entry.updateTransforms = serverTimestamps.map(fieldPath => ({ fieldPath, setToServerValue: 'REQUEST_TIME' }));
      }
      writes.push(entry);
    };

    return {
      writes,
      // batchGet, not GET ?transaction=: the emulator never answers a transactional single-document GET.
      async get(path) {
        const rows = await request('POST', `${root}:batchGet`, { documents: [docName(path)], transaction });
        return toSnapshot(rows.find(row => row.found)?.found);
      },
      async query(collectionPath, filters = []) {
        const segments = collectionPath.split('/');
        const collectionId = segments.pop();
        const parent = segments.length ? `${root}/${segments.join('/')}` : root;
        const fieldFilters = filters.map(([field, op, value]) => ({
          fieldFilter: { field: { fieldPath: field }, op: OPERATORS[op], value: encodeFields({ v: value }).v },
        }));
        const structuredQuery = { from: [{ collectionId }] };
        if (fieldFilters.length === 1) structuredQuery.where = fieldFilters[0];
        if (fieldFilters.length > 1) structuredQuery.where = { compositeFilter: { op: 'AND', filters: fieldFilters } };
        const rows = await request('POST', `${parent}:runQuery`, { structuredQuery, transaction });
        return rows.filter(row => row.document).map(row => toSnapshot(row.document));
      },
      /** Create only: fails the commit if the document already exists. */
      create(path, data, options = {}) { write(path, data, { ...options, exists: false }); },
      /** Create or replace the whole document. */
      set(path, data, options = {}) { write(path, data, options); },
      /** Merge the given top-level fields into an existing document. */
      update(path, data, options = {}) { write(path, data, { ...options, mask: Object.keys(data), exists: true }); },
      delete(path) { writes.push({ delete: docName(path) }); },
      newId() {
        const bytes = crypto.getRandomValues(new Uint8Array(20));
        return Array.from(bytes, byte => AUTO_ID_CHARS[byte % AUTO_ID_CHARS.length]).join('');
      },
    };
  }

  /**
   * Runs fn(tx) in a read-write transaction and commits its writes. Retried when Firestore aborts
   * the transaction because of contention; errors thrown by fn roll back and propagate unchanged.
   */
  async function runTransaction(fn, { maxAttempts = 5 } = {}) {
    const isAborted = error => error instanceof FirestoreRestError && error.code === 'ABORTED';
    let lastError;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const { transaction } = await request('POST', `${root}:beginTransaction`, { options: { readWrite: {} } });
      const tx = createTransaction(transaction);
      let result;
      try {
        result = await fn(tx);
      } catch (error) {
        await request('POST', `${root}:rollback`, { transaction }).catch(() => {});
        if (!isAborted(error)) throw error;
        lastError = error;
        continue;
      }
      try {
        await request('POST', `${root}:commit`, { writes: tx.writes, transaction });
        return result;
      } catch (error) {
        if (!isAborted(error)) throw error;
        lastError = error;
      }
    }
    throw lastError;
  }

  return { runTransaction };
}
