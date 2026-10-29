// QA stub of firebase/firestore: no network; writes are logged on window.__writes.
const log = (op, ...args) => { (window.__writes ||= []).push({ op, args: JSON.parse(JSON.stringify(args.map(a => (a && a.path) || a), (k, v) => (typeof v === 'function' ? undefined : v))) }); };
export const doc = (_db, ...parts) => ({ path: parts.join('/') });
export const collection = (_db, ...parts) => ({ path: parts.join('/') });
export const query = (ref) => ref;
export const orderBy = () => ({});
export const limit = () => ({});
export const where = () => ({});
export const serverTimestamp = () => 'SERVER_TIME';
export const onSnapshot = () => () => {};
export const getDoc = async () => ({ exists: () => false, data: () => null });
export const getDocs = async () => ({ docs: [], forEach: () => {} });
export const setDoc = async (ref, data, options) => log('set', ref, data, options);
export const updateDoc = async (ref, data) => log('update', ref, data);
export const deleteDoc = async (ref) => log('delete', ref);
export const addDoc = async (ref, data) => log('add', ref, data);
export const writeBatch = () => ({ set: (r, d, o) => log('batch.set', r, d, o), update: (r, d) => log('batch.update', r, d), delete: r => log('batch.delete', r), commit: async () => {} });
export const runTransaction = async (_db, fn) => fn({ get: async () => ({ exists: () => false, data: () => ({}) }), set: (r, d, o) => log('tx.set', r, d, o), update: (r, d) => log('tx.update', r, d), delete: r => log('tx.delete', r) });
export const Timestamp = { now: () => ({ toMillis: () => Date.now() }) };
