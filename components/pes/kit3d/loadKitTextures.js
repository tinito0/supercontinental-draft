// Finds and decodes the textures of one kit for the 3D preview.
// Order: textures imported/generated in the workspace (shared with every user), then the game folder
// opened on this computer (kit folder first, then livecpk roots in sider.ini order, like the game).
import { getKitValue } from '../../../pes/kits/kitConfig.js';
import { textureCandidates, kitTextureFiles } from '../../../pes/kits/textureLocator.js';
import { decodeTexture } from '../../../pes/kits/textureDecode.js';
import { pixelsToCanvas, glossFromAlpha } from './kitDecals.js';

const MAX_WIDTH = { kit: 1024, nrm: 1024, srm: 512, name: 2048, back: 2048, chest: 2048, leg: 2048 };
const cache = new Map(); // game folder: `${folder}|${path}` → decoded entry or null (files do not change during a session)
const wsCache = new WeakMap(); // workspace asset bytes → decoded entry

function decode(slot, bytes, path) {
  const ext = path.slice(path.lastIndexOf('.'));
  const t = decodeTexture(bytes, ext, { maxWidth: MAX_WIDTH[slot] });
  if (slot === 'kit') return { canvas: pixelsToCanvas(t.pixels, t.width, t.height, { opaque: true }), gloss: glossFromAlpha(t.pixels, t.width, t.height), width: t.width, format: t.format };
  // Font sheets are read back glyph by glyph (KitFont.glyph), so their canvas is created for read-back.
  return { canvas: pixelsToCanvas(t.pixels, t.width, t.height, { opaque: slot === 'nrm' || slot === 'srm', readBack: !['nrm', 'srm'].includes(slot) }), width: t.width, format: t.format };
}

/** Where a game texture came from: the kit's kit-server folder or a livecpk pack. */
const origin = path => (path.startsWith('content/kit-server/') ? 'kit-server' : path.split('/').slice(0, 2).join('/'));

async function findOne(slot, file, { kits, configPath, reader }) {
  if (!file) return null;
  const dir = configPath.replace(/config\.txt$/i, '');
  for (const ext of ['.ftex', '.dds']) {
    const path = `${dir}${file}${ext}`;
    const bytes = kits.assets.get(path);
    if (!bytes) continue;
    if (!wsCache.has(bytes)) wsCache.set(bytes, decode(slot, bytes, path));
    return { ...wsCache.get(bytes), source: 'workspace', path };
  }
  if (!reader?.read) return null;
  for (const path of textureCandidates(configPath, file, [...(reader.roots || []), ...(reader.fallbackRoots || [])])) {
    const key = `game:${reader.name}|${path}`;
    if (cache.has(key)) { const hit = cache.get(key); if (hit) return { ...hit, source: 'game', from: origin(path), path }; continue; }
    const bytes = await reader.read(path);
    if (!bytes) { cache.set(key, null); continue; }
    cache.set(key, decode(slot, bytes, path));
    return { ...cache.get(key), source: 'game', from: origin(path), path };
  }
  return null;
}

/**
 * @returns {Promise<{ textures: Record<string, object|null>, errors: string[] }>}
 *   textures.kit has { canvas, gloss }, the rest { canvas }; null when not found.
 */
export async function loadKitTextures({ kits, teamId, kit, reader }) {
  const configPath = kits.configPath(teamId, kit);
  const cfg = kits.getConfig(teamId, kit);
  const files = kitTextureFiles(k => getKitValue(cfg, k));
  const textures = {}, errors = [];
  for (const [slot, file] of Object.entries(files)) {
    try { textures[slot] = await findOne(slot, file, { kits, configPath, reader }); } catch (e) {
      textures[slot] = null;
      errors.push(`${file}: ${e.message}`);
    }
  }
  return { textures, files, errors };
}
