// State + actions for the PES workspace screen. The engine (pes/) does the work; this hook
// wires it to IndexedDB (sources, drafts, assets), Firestore (roles, history, exports) and
// Supabase Storage (shared sources and textures, so every user works on the same files).
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  fetchPesRole, listWorkspaces, createWorkspace, updateWorkspace, deleteWorkspace, subscribeWorkspace, subscribeOps,
  saveOps, discardOp, recordExport, listExports, saveValidation,
} from '../services/pesWorkspaceService.js';
import { uploadTexture, downloadTexture, uploadSource, downloadSource, deleteWorkspaceFiles } from '../services/pesTextureStorage.js';
import {
  getSource, putSource, deleteSource, getDraft, putDraft, clearDraft, getAsset, putAsset, resetLocalStore,
} from '../pes/storage/localStore.js';
import { classifyFiles, readSources, buildWorkspace, restoreWorkingCopy } from '../pes/session.js';
import { applyOperations } from '../pes/operations.js';
import { validateWorkspace } from '../pes/validator.js';
import { buildExport } from '../pes/exportService.js';
import { capabilitiesOf } from '../pes/permissions.js';
import { sha256Hex } from '../pes/core/fields.js';

const ACTIVE_KEY = 'pes.activeWorkspace';
const readActive = () => { try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; } };
const writeActive = id => { try { if (id) localStorage.setItem(ACTIVE_KEY, id); else localStorage.removeItem(ACTIVE_KEY); } catch { /* per-viewer convenience only */ } };

export function usePesWorkspace({ userId, isAdmin }) {
  const [role, setRole] = useState(undefined); // undefined = loading, null = no access
  const [workspaces, setWorkspaces] = useState([]);
  const [activeId, setActiveId] = useState(readActive);
  const [wsDoc, setWsDoc] = useState(null);
  const [savedOps, setSavedOps] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [engineState, setEngineState] = useState({ ws: null, missing: [], failures: [], version: 0, loading: false, loadingMessage: null, error: null });
  const [validation, setValidation] = useState(null);
  const [exportsList, setExportsList] = useState([]);
  const [busy, setBusy] = useState(null);
  const [rebuildKey, setRebuildKey] = useState(0);
  const assetStore = useRef(new Map());
  const draftsRef = useRef([]);
  draftsRef.current = drafts;

  const actor = useMemo(() => (role ? { uid: userId, role: role.role, label: role.label } : null), [role, userId]);
  const caps = useMemo(() => capabilitiesOf(actor), [actor]);
  const canRead = caps.has('workspace.read');

  useEffect(() => {
    let alive = true;
    fetchPesRole(userId, isAdmin).then(r => { if (alive) setRole(r); });
    return () => { alive = false; };
  }, [userId, isAdmin]);

  const refreshWorkspaces = useCallback(async () => {
    if (!canRead) return;
    setWorkspaces(await listWorkspaces());
  }, [canRead]);

  useEffect(() => { refreshWorkspaces().catch(() => {}); }, [refreshWorkspaces]);

  useEffect(() => {
    if (!activeId || !role) { setWsDoc(null); setSavedOps([]); return undefined; }
    writeActive(activeId);
    const u1 = subscribeWorkspace(activeId, setWsDoc, () => setWsDoc(null));
    const u2 = subscribeOps(activeId, setSavedOps, () => setSavedOps([]));
    getDraft(activeId).then(d => { setDrafts(d); setRebuildKey(k => k + 1); }).catch(() => setDrafts([]));
    listExports(activeId).then(setExportsList).catch(() => setExportsList([]));
    return () => { u1(); u2(); };
  }, [activeId, role]);

  // Collect texture assets referenced by operations (local cache first, then Supabase Storage).
  const ensureAssets = useCallback(async ops => {
    for (const op of ops) {
      const sha = op.asset?.sha256;
      if (!sha || assetStore.current.has(sha)) continue;
      let bytes = await getAsset(sha).catch(() => null);
      if (!bytes && activeId) {
        bytes = await downloadTexture(activeId, sha, op.ext);
        if (bytes) await putAsset(sha, bytes).catch(() => {});
      }
      if (bytes) assetStore.current.set(sha, bytes);
    }
  }, [activeId]);

  // Rebuild the working copy when sources or the saved history change, or drafts are discarded.
  // Applying a new draft does not rebuild: the operation is already applied in memory.
  useEffect(() => {
    if (!wsDoc) { setEngineState(s => ({ ...s, ws: null, missing: [], failures: [] })); return undefined; }
    let alive = true;
    (async () => {
      setEngineState(s => ({ ...s, loading: true, error: null }));
      try {
        const records = [];
        const missing = [];
        const sources = wsDoc.sources || [];
        for (const [i, src] of sources.entries()) {
          let rec = await getSource(src.sha256);
          if (!rec && src.stored) {
            // Shared copy in Supabase: download once, verify the hash, keep it in IndexedDB.
            if (alive) setEngineState(st => ({ ...st, loadingMessage: `Descargando la base compartida (${i + 1}/${sources.length})…` }));
            rec = await downloadSource(wsDoc.id, src);
            if (rec) await putSource(src.sha256, rec);
          }
          if (rec) records.push(rec); else missing.push(src);
        }
        // A just-saved draft can still be in draftsRef when the history listener fires.
        const savedIds = new Set(savedOps.map(o => o.clientId).filter(Boolean));
        const currentDrafts = draftsRef.current.filter(d => !savedIds.has(d.clientId));
        await ensureAssets([...savedOps, ...currentDrafts]);
        const ws = buildWorkspace(records, { leagueTeamIds: wsDoc.leagueTeamIds || [] }, assetStore.current);
        const missingKinds = new Set(missing.map(m => m.kind));
        const needs = op => (op.type.startsWith('bin.') ? 'pesdb' : op.type.startsWith('edit.') ? 'edit' : 'kits');
        const replayable = list => list.filter(op => !missingKinds.has(needs(op)));
        const res = restoreWorkingCopy(ws, replayable(savedOps), replayable(currentDrafts));
        if (alive) {
          setEngineState(s => ({ ws, missing, failures: [...res.saved, ...res.drafts], version: s.version + 1, loading: false, loadingMessage: null, error: null }));
          setValidation(null);
        }
      } catch (e) {
        if (alive) setEngineState(s => ({ ...s, ws: null, loading: false, loadingMessage: null, error: e }));
      }
    })();
    return () => { alive = false; };
  }, [wsDoc, savedOps, rebuildKey, ensureAssets]);

  const selectWorkspace = useCallback(id => { setActiveId(id); writeActive(id); }, []);
  /** Rebuilds the working copy (e.g. after the missing sources were loaded on this machine). */
  const reload = useCallback(() => setRebuildKey(k => k + 1), []);

  /**
   * "Actualizar": reconnects the local database, reloads the workspace list, the drafts and exports
   * of the active workspace, and rebuilds its working copy from the sources.
   */
  const refreshAll = useCallback(async () => {
    setBusy('Actualizando…');
    try {
      await resetLocalStore();
      const list = canRead ? await listWorkspaces() : [];
      setWorkspaces(list);
      if (!activeId) return;
      if (!list.some(w => w.id === activeId)) { selectWorkspace(null); return; }
      setDrafts(await getDraft(activeId));
      setExportsList(await listExports(activeId).catch(() => []));
      setRebuildKey(k => k + 1);
    } finally { setBusy(null); }
  }, [canRead, activeId, selectWorkspace]);

  /**
   * Deletes a workspace for everyone (Super Admin): its shared files in Supabase, its history in
   * Firestore, and this browser's drafts and local copies of sources no other workspace uses.
   * Returns warnings for the parts that could not be cleaned (the workspace is deleted anyway).
   */
  const removeWorkspace = useCallback(async id => {
    const target = workspaces.find(w => w.id === id) || (wsDoc?.id === id ? wsDoc : null);
    const warnings = [];
    if (activeId === id) { selectWorkspace(null); setDrafts([]); }
    setBusy('Eliminando el espacio de trabajo…');
    try {
      try {
        await deleteWorkspaceFiles(id);
      } catch (e) {
        warnings.push(`No se pudieron borrar los archivos compartidos en Supabase: ${e.message}`);
      }
      await deleteWorkspace(id);
      await clearDraft(id).catch(() => {});
      const stillUsed = new Set(workspaces.filter(w => w.id !== id).flatMap(w => (w.sources || []).map(s => s.sha256)));
      for (const source of target?.sources || []) {
        if (!stillUsed.has(source.sha256)) await deleteSource(source.sha256).catch(() => {});
      }
      setWorkspaces(await listWorkspaces());
      return { warnings };
    } finally { setBusy(null); }
  }, [workspaces, wsDoc, activeId, selectWorkspace]);

  /** Reads files, validates them and stores the originals locally (never overwritten). */
  const importFiles = useCallback(async fileList => {
    setBusy('Leyendo archivos…');
    try {
      const classified = classifyFiles([...fileList]);
      const sources = await readSources(classified);
      for (const s of sources) await putSource(s.sha256, s.record);
      return { sources, ignored: classified.ignored };
    } finally { setBusy(null); }
  }, []);

  /** Uploads sources to shared storage and returns their summaries marked as stored. */
  const shareList = useCallback(async (workspaceId, sources) => {
    const out = [];
    for (const [i, src] of sources.entries()) {
      setBusy(`Subiendo la base compartida (${i + 1}/${sources.length}: ${src.kind})…`);
      await uploadSource(workspaceId, src);
      out.push({ ...src.summary, stored: true });
    }
    return out;
  }, []);

  const createFromSources = useCallback(async (name, sources, leagueTeamIds) => {
    const id = await createWorkspace({ name, sources: sources.map(s => ({ ...s.summary, stored: false })), leagueTeamIds }, userId);
    await refreshWorkspaces();
    selectWorkspace(id);
    try {
      await updateWorkspace(id, { sources: await shareList(id, sources) });
    } finally { setBusy(null); }
    return id;
  }, [userId, refreshWorkspaces, selectWorkspace, shareList]);

  /** Adds or replaces a source kind in the active workspace (Super Admin, explicit action). */
  const replaceSource = useCallback(async source => {
    try {
      const [summary] = await shareList(activeId, [source]);
      const others = (wsDoc.sources || []).filter(s => s.kind !== source.kind);
      await updateWorkspace(activeId, { sources: [...others, summary] });
    } finally { setBusy(null); }
  }, [activeId, wsDoc, shareList]);

  /** Retries sharing sources that this browser has but were not uploaded yet. */
  const shareSources = useCallback(async () => {
    try {
      const next = [];
      for (const src of wsDoc.sources || []) {
        const record = src.stored ? null : await getSource(src.sha256);
        if (!record) { next.push(src); continue; }
        const [summary] = await shareList(activeId, [{ kind: src.kind, sha256: src.sha256, record, summary: src }]);
        next.push(summary);
      }
      await updateWorkspace(activeId, { sources: next });
    } finally { setBusy(null); }
  }, [activeId, wsDoc, shareList]);

  /** Saves the draft team → game team assignment (and the optional coach of each draft team). */
  const setDraftMap = useCallback((map, coaches) => updateWorkspace(activeId, { draftMap: map, ...(coaches ? { draftCoaches: coaches } : {}) }), [activeId]);

  const setLeagueTeams = useCallback(ids => updateWorkspace(activeId, { leagueTeamIds: ids }), [activeId]);

  /** Applies operations to the working copy as drafts (persisted locally until saved). */
  const apply = useCallback(async ops => {
    const ws = engineState.ws;
    if (!ws) throw new Error('No hay un espacio de trabajo cargado.');
    const applied = applyOperations(ws, ops, actor);
    // From draftsRef, not this render's `drafts`: two applies before a re-render (a color drag, Enter then
    // blur) must both stay, or the working copy holds a change that no draft records.
    const next = [...draftsRef.current, ...applied.map(op => ({ ...op, clientId: crypto.randomUUID(), actorUid: userId, actorRole: actor.role, draftAt: new Date().toISOString() }))];
    draftsRef.current = next;
    setDrafts(next);
    setEngineState(s => ({ ...s, version: s.version + 1 }));
    setValidation(null);
    try {
      await putDraft(activeId, next);
    } catch (e) {
      throw new Error(`El cambio se aplicó, pero este navegador no pudo guardar el borrador (${e?.message || 'almacenamiento no disponible'}): guardá los cambios antes de recargar.`);
    }
    return applied;
  }, [engineState.ws, actor, activeId, userId]);

  /** Registers texture bytes so a kit.texture.set operation can reference them. */
  const registerAsset = useCallback(async bytes => {
    const sha = await sha256Hex(bytes);
    assetStore.current.set(sha, bytes);
    await putAsset(sha, bytes).catch(() => {});
    return sha;
  }, []);

  const saveDrafts = useCallback(async () => {
    const captured = draftsRef.current;
    if (!captured.length) return;
    // A draft that no longer applies would go to everyone's shared history broken.
    const capturedIds = new Set(captured.map(d => d.clientId));
    const failing = engineState.failures.filter(f => capturedIds.has(f.op?.clientId));
    if (failing.length) {
      throw new Error(`${failing.length} cambio(s) sin guardar no se pueden aplicar sobre las fuentes actuales. Descartalos antes de guardar.`);
    }
    setBusy('Guardando cambios…');
    try {
      // Drafts already in the history (a previous save that stopped half way) are not saved twice.
      const alreadySaved = new Set(savedOps.map(o => o.clientId).filter(Boolean));
      const pending = captured.filter(d => !alreadySaved.has(d.clientId));
      for (const op of pending) {
        if (!op.asset?.sha256) continue;
        try {
          await uploadTexture(activeId, op.asset.sha256, assetStore.current.get(op.asset.sha256), op.ext);
        } catch (error) {
          // One texture the storage refuses (too large, wrong type) used to block every save with a generic error.
          // Name the draft so it can be discarded and the rest saved.
          const position = captured.indexOf(op) + 1;
          throw new Error(`No se pudo subir la textura del cambio n.º ${position} sin guardar (${error.message}). Descartá ese cambio en «Sin guardar» y volvé a guardar el resto.`, { cause: error });
        }
      }
      await saveOps(activeId, pending, actor);
      // Keep what was applied while saving (the panels stay editable): only the captured drafts are done.
      const remaining = draftsRef.current.filter(d => !capturedIds.has(d.clientId));
      if (remaining.length) await putDraft(activeId, remaining); else await clearDraft(activeId);
      draftsRef.current = remaining;
      setDrafts(remaining); // the saved-ops subscription rebuilds the working copy
    } finally { setBusy(null); }
  }, [engineState.failures, savedOps, activeId, actor]);

  const discardDrafts = useCallback(async (indexes = null) => {
    const next = indexes ? draftsRef.current.filter((_, i) => !indexes.includes(i)) : [];
    draftsRef.current = next;
    await putDraft(activeId, next);
    setDrafts(next);
    setRebuildKey(k => k + 1);
  }, [activeId]);

  const discardSaved = useCallback(opId => discardOp(activeId, opId, userId), [activeId, userId]);

  const runValidation = useCallback(async () => {
    if (!engineState.ws) return null;
    const v = validateWorkspace(engineState.ws);
    setValidation(v);
    saveValidation(activeId, v, userId).catch(() => {});
    return v;
  }, [engineState.ws, activeId, userId]);

  const exportZip = useCallback(async () => {
    setBusy('Generando y verificando la exportación…');
    try {
      const active = savedOps.filter(o => o.state !== 'discarded');
      const { zip, manifest } = await buildExport(engineState.ws, {
        workspaceId: activeId, sources: wsDoc.sources || [], operations: [...active, ...drafts], actor,
      });
      await recordExport(activeId, manifest, userId);
      setExportsList(await listExports(activeId));
      return { zip, manifest };
    } finally { setBusy(null); }
  }, [engineState.ws, savedOps, drafts, activeId, wsDoc, actor, userId]);

  return {
    role, actor, caps, workspaces, activeId, wsDoc, savedOps, drafts, validation, exportsList, busy,
    ws: engineState.ws, version: engineState.version, missing: engineState.missing, failures: engineState.failures,
    loading: engineState.loading, loadingMessage: engineState.loadingMessage, error: engineState.error,
    selectWorkspace, reload, importFiles, createFromSources, replaceSource, shareSources, setDraftMap, setLeagueTeams,
    apply, registerAsset, saveDrafts, discardDrafts, discardSaved, runValidation, exportZip, refreshWorkspaces,
    refreshAll, removeWorkspace,
  };
}
