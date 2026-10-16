import { useCallback, useEffect, useMemo, useState } from 'react';
import { canPickFolder, pickGameFolder, rememberedGameFolder, readerFromFiles } from './gameFolder.js';
import { kitAssetProviders, loadKitTextures } from './loadKitTextures.js';
import { shareableAssets } from '../../../pes/kits/kitAssetResolver.js';
import { subscribeKitTextures, addKitTextures } from '../../../services/pesWorkspaceService.js';
import { uploadTexture } from '../../../services/pesTextureStorage.js';
import { sha256Hex } from '../../../pes/core/fields.js';
import { putAsset } from '../../../pes/storage/localStore.js';

/** Local folder access (read only): remembered handle, picker, or folder input fallback. */
function useLocalFolder() {
  const [folder, setFolder] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { rememberedGameFolder().then(setFolder).catch(() => setFolder(null)); }, []);
  const run = async fn => {
    setError(null);
    try {
      const f = await fn();
      if (f?.kind === 'unknown') setError(new Error(`«${f.name}» no tiene map.txt ni content/kit-server/map.txt: elegí la carpeta del juego o la del kit-server.`));
      setFolder(f);
    } catch (e) { if (e?.name !== 'AbortError') setError(e); }
  };
  return {
    folder, error, canPick: canPickFolder(),
    pick: () => run(pickGameFolder),
    allow: () => run(() => rememberedGameFolder({ prompt: true })),
    fromFiles: files => run(() => readerFromFiles(files)),
  };
}

/** Shared-texture manifest of one team (Firestore), with a stamp that changes on every snapshot. */
function useCloudManifest(workspaceId, teamId) {
  const [state, setState] = useState({ files: null, stamp: 0, error: null });
  useEffect(() => {
    // A team switch must not keep resolving against the previous team's manifest.
    setState(s => ({ files: null, stamp: s.stamp + 1, error: null }));
    if (!workspaceId || teamId == null) return undefined;
    return subscribeKitTextures(workspaceId, teamId,
      files => setState(s => ({ files, stamp: s.stamp + 1, error: null })),
      e => setState(s => ({ files: {}, stamp: s.stamp + 1, error: e })));
  }, [workspaceId, teamId]);
  return state;
}

/**
 * Textures of the kit on screen, resolved workspace → cloud → local folder, plus the "share" action that
 * uploads the kit-server files found locally (content-addressed in Supabase, listed in the team's manifest).
 * @param {{ kits: object, teamId: number, kit: string, version: number, workspaceId?: string, uid?: string, canShare?: boolean }} o
 */
export function useKitAssets({ kits, teamId, kit, version, workspaceId, uid, canShare }) {
  const local = useLocalFolder();
  const cloud = useCloudManifest(workspaceId, teamId);
  // `of` tags the result with the kit it belongs to: a share must never use another kit's files.
  const [state, setState] = useState({ assets: [], textures: {}, loading: true, error: null, of: null });
  const kitKey = `${teamId}|${kit}`;
  const [share, setShare] = useState(null);

  const folder = local.folder?.read ? local.folder : null;
  const providers = useMemo(
    () => kitAssetProviders({ kits, version, workspaceId, manifest: cloud.files, manifestStamp: cloud.stamp, folder }),
    [kits, version, workspaceId, cloud.files, cloud.stamp, folder],
  );

  useEffect(() => {
    let alive = true;
    setState(s => (s.of === kitKey ? { ...s, loading: true, error: null } : { assets: [], textures: {}, loading: true, error: null, of: kitKey }));
    loadKitTextures({ kits, teamId, kit, providers })
      .then(r => { if (alive) setState({ ...r, loading: false, error: null, of: kitKey }); })
      .catch(e => { if (alive) setState({ assets: [], textures: {}, loading: false, error: e, of: kitKey }); });
    return () => { alive = false; };
  }, [kits, teamId, kit, kitKey, providers]);

  useEffect(() => { setShare(null); }, [teamId, kit]);

  const pending = state.of === kitKey && !state.loading ? shareableAssets(state.assets) : [];
  const shareKit = useCallback(async () => {
    if (!pending.length) return;
    setShare({ busy: true });
    try {
      const entries = [];
      for (const a of pending) {
        const sha256 = await sha256Hex(a.bytes);
        await uploadTexture(workspaceId, sha256, a.bytes, a.ext);
        // Kept locally too, so switching to the cloud copy does not download what this browser already has.
        await putAsset(sha256, a.bytes).catch(() => {});
        entries.push({ path: a.path, sha256, ext: a.ext, size: a.bytes.length });
      }
      await addKitTextures(workspaceId, teamId, entries, uid);
      setShare({ done: `${entries.length} archivo(s) del kit compartidos: el resto del equipo los ve sin abrir la carpeta.` });
    } catch (e) { setShare({ error: e }); }
  }, [pending, workspaceId, teamId, uid]);

  return {
    ...state, local, cloud, providers, share,
    canShare: Boolean(canShare && workspaceId && uid && pending.length),
    pendingShare: pending, shareKit,
  };
}
