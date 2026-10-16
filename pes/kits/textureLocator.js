// Where a kit texture lives on disk, for the local folder the user opens in the preview.
//
// The preview reads the kit-server only: the kit's own folder content/kit-server/<team>/<kit>/<file>.ftex, the
// one place kserv.lua serves kit textures from (see pes/kits/kitAssetResolver.js for the evidence). Textures the
// game would otherwise take from livecpk packs (sider.ini cpk.root, e.g. livecpk/UML_Kits/…/#windx11) are out of
// scope for now: the panel says so instead of searching them.
// Native per-team kit files (common/character0/model/character/uniform/team/<id>/<id>_DEF_1st_realUni.bin,
// 120 bytes) hold the same values as config.txt; Sider's kit-server replaces them at runtime, so the
// editor works on config.txt and never writes realUni.bin.
import { toKitServerRelative } from './kitWorkspace.js';
import { assetCandidates, kitAssetRefs } from './kitAssetResolver.js';

export const KIT_SERVER_DIR = 'content/kit-server';

/** cpk.root entries of sider.ini (commented lines skipped), as paths relative to the game folder. */
export function parseSiderRoots(iniText) {
  const roots = [];
  for (const line of String(iniText || '').split(/\r?\n/)) {
    const m = line.match(/^\s*cpk\.root\s*=\s*"?([^";]+?)"?\s*(;.*)?$/i);
    if (!m) continue;
    roots.push(m[1].trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, ''));
  }
  return roots;
}

/**
 * Candidate paths, relative to the kit-server folder, for one texture file in lookup order.
 * @param {string} kitConfigPath kit-server relative path of the kit's config.txt
 * @param {string} file texture base name from config.txt (no extension)
 */
export function textureCandidates(kitConfigPath, file) {
  const dir = toKitServerRelative(kitConfigPath).replace(/config\.txt$/i, '');
  return assetCandidates(dir, file).map(c => c.path);
}

/** Texture files a kit preview needs, by slot (kit, srm, nrm, name, name_ex, back, chest, leg). */
export function kitTextureFiles(value) {
  return Object.fromEntries(kitAssetRefs(value).map(r => [r.slot, r.file]));
}
