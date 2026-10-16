// Finds and decodes the textures of one kit for the 3D preview, through pes/kits/kitAssetResolver.js.
// Providers, in order (kit-server files only; livecpk packs are not searched):
//   1. workspace  textures imported or generated in the workspace (kit.texture.set; shared through Supabase)
//   2. cloud      original kit-server textures someone shared (Firestore kit_textures manifest + Supabase Storage)
//   3. local      the kit's folder in the game / kit-server folder opened on this computer (read only)
import { getKitValue } from '../../../pes/kits/kitConfig.js';
import { AssetCache, resolveKitAssets, manifestEntry } from '../../../pes/kits/kitAssetResolver.js';
import { decodeTexture } from '../../../pes/kits/textureDecode.js';
import { downloadTexture } from '../../../services/pesTextureStorage.js';
import { getAsset, putAsset } from '../../../pes/storage/localStore.js';
import { pixelsToCanvas, glossFromAlpha } from './kitDecals.js';

const MAX_WIDTH = { kit: 1024, nrm: 1024, srm: 512, name: 2048, name_ex: 2048, back: 2048, chest: 2048, leg: 2048 };
/** One cache for the session: the same file is read or downloaded once, also across kits and remounts. */
export const assetCache = new AssetCache();
const decoded = new WeakMap(); // bytes → Map(slot → decoded entry)

function decode(slot, bytes, ext) {
  let bySlot = decoded.get(bytes);
  if (!bySlot) decoded.set(bytes, bySlot = new Map());
  if (bySlot.has(slot)) return bySlot.get(slot);
  const t = decodeTexture(bytes, ext, { maxWidth: MAX_WIDTH[slot] });
  const out = slot === 'kit'
    ? { canvas: pixelsToCanvas(t.pixels, t.width, t.height, { opaque: true }), gloss: glossFromAlpha(t.pixels, t.width, t.height), width: t.width, height: t.height, format: t.format }
    // Font sheets are read back glyph by glyph (KitFont.glyph), so their canvas is created for read-back.
    : { canvas: pixelsToCanvas(t.pixels, t.width, t.height, { opaque: slot === 'nrm' || slot === 'srm', readBack: !['nrm', 'srm'].includes(slot) }), width: t.width, height: t.height, format: t.format };
  bySlot.set(slot, out);
  return out;
}

/** Builds the provider list for a kit. Provider ids change with their content so cached lookups stay right. */
export function kitAssetProviders({ kits, version, workspaceId, manifest, manifestStamp, folder }) {
  const providers = [];
  if (kits?.assets?.size) {
    const byLower = new Map([...kits.assets].map(([p, b]) => [p.toLowerCase(), b]));
    providers.push({ id: `workspace:${version}`, label: 'importada en el espacio', lookup: async path => byLower.get(path.toLowerCase()) || null });
  }
  if (workspaceId && manifest && Object.keys(manifest).length) {
    providers.push({
      id: `cloud:${workspaceId}:${manifestStamp}`,
      label: 'nube (compartida)',
      lookup: async path => {
        const entry = manifestEntry(manifest, path);
        if (!entry) return null;
        const cached = await getAsset(entry.sha256).catch(() => null);
        if (cached) return cached;
        const bytes = await downloadTexture(workspaceId, entry.sha256, entry.ext); // verifies the SHA-256
        if (bytes) await putAsset(entry.sha256, bytes).catch(() => {});
        return bytes;
      },
    });
  }
  if (folder?.readKit && folder.kind !== 'unknown') {
    providers.push({ id: `local:${folder.name}:${folder.stamp}`, label: `carpeta «${folder.name}»`, lookup: path => folder.readKit(path) });
  }
  // A provider id changes with its content: drop the cached lookups (and bytes) of the ids it replaces.
  for (const kind of ['workspace:', 'cloud:', 'local:']) assetCache.retainOnly(kind, providers.find(p => p.id.startsWith(kind))?.id ?? null);
  return providers;
}

/**
 * @returns {Promise<{ assets: import('../../../pes/kits/kitAssetResolver.js').ResolvedAsset[], textures: Record<string, object|null> }>}
 *   textures.kit has { canvas, gloss }, the rest { canvas }; null when not found or not decodable (see assets[].status).
 */
export async function loadKitTextures({ kits, teamId, kit, providers }) {
  const configPath = kits.configPath(teamId, kit);
  const cfg = kits.getConfig(teamId, kit);
  const resolved = await resolveKitAssets({ value: k => getKitValue(cfg, k), configPath, providers, cache: assetCache });
  const textures = {};
  const assets = resolved.map(a => {
    textures[a.slot] = null;
    if (a.status !== 'found') return a;
    try {
      textures[a.slot] = decode(a.slot, a.bytes, a.ext);
      return { ...a, width: textures[a.slot].width, height: textures[a.slot].height, format: textures[a.slot].format };
    } catch (e) {
      return { ...a, status: 'error', error: `${a.file}${a.ext} (${a.sourceLabel}) no se pudo leer: ${e?.message || e}` };
    }
  });
  return { assets, textures };
}
