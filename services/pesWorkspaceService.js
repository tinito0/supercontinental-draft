// Firestore persistence for the PES workspace. Every write here is re-checked by
// firestore.rules (roles + field-level kit permissions), so a client that skips the UI
// still cannot persist an unauthorized operation.
import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, addDoc, onSnapshot,
  query, orderBy, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { APP_ID } from '../utils/constants.js';

const base = `artifacts/${APP_ID}`;
const rolesCol = () => collection(db, `${base}/pes_roles`);
const wsCol = () => collection(db, `${base}/pes_workspaces`);
const wsDoc = id => doc(db, `${base}/pes_workspaces`, id);
const opsCol = id => collection(db, `${base}/pes_workspaces/${id}/ops`);
const exportsCol = id => collection(db, `${base}/pes_workspaces/${id}/exports`);

/** Firestore rejects `undefined`; drop such keys recursively. */
function clean(v) {
  if (Array.isArray(v)) return v.map(clean);
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, clean(x)]));
  }
  return v;
}

// ── Roles ────────────────────────────────────────────────
/** The PES role of a user. Existing app admins are always Super Admin. */
export async function fetchPesRole(uid, isAppAdmin) {
  if (isAppAdmin) return { role: 'super_admin', label: 'Super Admin' };
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, `${base}/pes_roles`, uid));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null; // rules deny reading other users' roles; no role = no access
  }
}

export async function listPesRoles() {
  const snap = await getDocs(rolesCol());
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

export function setPesRole(uid, { role, label = '', displayName = '' }, actorUid) {
  return setDoc(doc(db, `${base}/pes_roles`, uid), clean({ role, label, displayName, updatedBy: actorUid, updatedAt: serverTimestamp() }));
}

export function removePesRole(uid) {
  return deleteDoc(doc(db, `${base}/pes_roles`, uid));
}

// ── Workspaces ───────────────────────────────────────────
export async function listWorkspaces() {
  const snap = await getDocs(query(wsCol(), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createWorkspace({ name, sources, leagueTeamIds = [] }, actorUid) {
  const ref = await addDoc(wsCol(), clean({ name, sources, leagueTeamIds, createdBy: actorUid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  return ref.id;
}

export function updateWorkspace(id, patch) {
  return updateDoc(wsDoc(id), clean({ ...patch, updatedAt: serverTimestamp() }));
}

export function subscribeWorkspace(id, cb, onError) {
  return onSnapshot(wsDoc(id), s => cb(s.exists() ? { id: s.id, ...s.data() } : null), onError);
}

// ── Operations (modification history) ────────────────────
/** Firestore rejects nested arrays (e.g. formation positions), so payloads travel as JSON text. */
const toJson = v => (v === undefined ? undefined : JSON.stringify(v));
const fromJson = (json, fallback) => (typeof json === 'string' ? JSON.parse(json) : fallback);

function decodeOp(id, d) {
  const { valueJson, beforeJson, afterJson, ...rest } = d;
  return { id, ...rest, value: fromJson(valueJson, d.value), before: fromJson(beforeJson, d.before), after: fromJson(afterJson, d.after) };
}

export function subscribeOps(id, cb, onError) {
  return onSnapshot(query(opsCol(id), orderBy('seq')), s => cb(s.docs.map(d => decodeOp(d.id, d.data()))), onError);
}

/** Persists applied operations in order. Batches of ≤ 450 writes. */
export async function saveOps(id, ops, actor) {
  const now = Date.now();
  for (let i = 0; i < ops.length; i += 450) {
    const batch = writeBatch(db);
    ops.slice(i, i + 450).forEach((op, k) => {
      batch.set(doc(opsCol(id)), clean({
        type: op.type, target: op.target, field: op.field, key: op.key, slot: op.slot, ext: op.ext, asset: op.asset,
        valueJson: toJson(op.value), beforeJson: toJson(op.before), afterJson: toJson(op.after), batch: op.batch, clientId: op.clientId,
        actorUid: actor.uid, actorRole: actor.role, state: 'saved',
        seq: now + i + k, createdAt: serverTimestamp(),
      }));
    });
    await batch.commit();
  }
}

export function discardOp(id, opId, actorUid) {
  return updateDoc(doc(opsCol(id), opId), { state: 'discarded', discardedBy: actorUid, discardedAt: serverTimestamp() });
}

// ── Exports & validation ─────────────────────────────────
export function recordExport(id, manifest, actorUid) {
  return addDoc(exportsCol(id), clean({
    exportedBy: actorUid,
    exportedAt: serverTimestamp(),
    files: manifest.files,
    operations: manifest.operations,
    validation: manifest.validation,
    warnings: manifest.warnings.slice(0, 50),
    gameTested: false,
  }));
}

export async function listExports(id) {
  const snap = await getDocs(query(exportsCol(id), orderBy('exportedAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function saveValidation(id, v, actorUid) {
  return setDoc(doc(db, `${base}/pes_workspaces/${id}/meta`, 'validation'), clean({
    passed: v.passed, errors: v.errors.length, warnings: v.warnings.length, preexisting: v.preexisting.length,
    checkedAt: v.checkedAt, checkedBy: actorUid,
  }));
}
