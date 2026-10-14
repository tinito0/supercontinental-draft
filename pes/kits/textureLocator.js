// Where the game finds a kit texture, in the order it looks:
//   1. the kit's own folder in Sider's kit-server (content/kit-server/<team>/<kit>/<file>.ftex|.dds)
//   2. every livecpk root listed in sider.ini (cpk.root, in file order), under
//      Asset/model/character/uniform/texture/#windx11/ (the UML patch keeps 7 000 kit and font
//      textures there, e.g. livecpk/UML_Kits/…/u0126p1.ftex, dor_bla_num.ftex)
// Native per-team kit files (common/character0/model/character/uniform/team/<id>/<id>_DEF_1st_realUni.bin,
// 120 bytes) hold the same values as config.txt; Sider's kit-server replaces them at runtime, so the
// editor works on config.txt and never writes realUni.bin.
import { toKitServerRelative } from './kitWorkspace.js';

export const TEXTURE_DIRS = [
  'Asset/model/character/uniform/texture/#windx11',
  'common/character0/model/character/uniform/texture/#windx11',
];
const EXTS = ['.ftex', '.dds'];

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
 * Candidate paths (relative to the game folder) for one texture file, in lookup order.
 * @param {string} kitConfigPath kit-server relative path of the kit's config.txt
 * @param {string} file texture base name from config.txt (no extension)
 * @param {string[]} roots livecpk roots from parseSiderRoots
 */
export function textureCandidates(kitConfigPath, file, roots) {
  if (!file || !/^[A-Za-z0-9_\-.]+$/.test(file)) return [];
  const dir = toKitServerRelative(kitConfigPath).replace(/config\.txt$/i, '');
  const out = EXTS.map(ext => `content/kit-server/${dir}${file}${ext}`);
  for (const root of roots) for (const d of TEXTURE_DIRS) for (const ext of EXTS) out.push(`${root}/${d}/${file}${ext}`);
  return out;
}

/** Texture files a kit preview needs: kit + normal/shine maps + the four font sheets. */
export function kitTextureFiles(value) {
  const g = k => String(value(k) ?? '').trim();
  const kit = g('KitFile');
  return {
    kit, nrm: kit && `${kit}_nrm`, srm: kit && `${kit}_srm`,
    name: g('NameFontFile'), back: g('BackNumbersFile'), chest: g('ChestNumbersFile'), leg: g('LegNumbersFile'),
  };
}
