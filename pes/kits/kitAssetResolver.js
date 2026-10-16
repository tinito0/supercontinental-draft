// Finds the texture files of one kit (kit texture, shine map, font sheets) through an ordered list of providers.
// Pure: no React, no Firebase, no DOM. Providers are plain objects, so the cloud and the local folder are injected.
//
// What the game asks for (kserv.lua v1.17, Sider kit-server module):
//   - config.txt names the files: KitFile, NameFontFile, BackNumbersFile, ChestNumbersFile, LegNumbersFile.
//   - the game derives two more names itself: KitFile + "_srm" (shine/specular) and NameFontFile + "_ex"
//     (kserv.lua adds KitFile_srm / NameFontFile_ex because it renames the files, see update_kit_config).
//   - kserv.lua serves a file from the kit's own folder only when `<kit-server>/<team>/<kit>/<name>.ftex` exists
//     (config_update_filenames); otherwise the name is left alone and the game looks in its CPKs / livecpk.
//     Only .ftex is checked: a .dds in the kit folder is not served by kserv.lua.
//   - `<KitFile>_nrm` is not one of those names: kserv.lua never remaps it and the UML patch ships none. It is
//     kept as an optional slot because the editor can generate one.
// This resolver only looks at the kit-server (the kit's folder): livecpk packs are deliberately out of scope.

/** Slots in display order. `key` = config.txt key; `from` + `suffix` = name derived from another key. */
export const ASSET_SLOTS = [
  { slot: 'kit', key: 'KitFile', label: 'Textura del kit', role: 'kit' },
  { slot: 'srm', from: 'KitFile', suffix: '_srm', label: 'Brillo (_srm)', role: 'map', optional: true },
  { slot: 'nrm', from: 'KitFile', suffix: '_nrm', label: 'Relieve (_nrm)', role: 'map', optional: true, notGame: true },
  { slot: 'name', key: 'NameFontFile', label: 'Letras del nombre', role: 'font' },
  { slot: 'name_ex', from: 'NameFontFile', suffix: '_ex', label: 'Letras extra (_ex)', role: 'font', optional: true },
  { slot: 'back', key: 'BackNumbersFile', label: 'Números de la espalda', role: 'font' },
  { slot: 'chest', key: 'ChestNumbersFile', label: 'Número del pecho', role: 'font' },
  { slot: 'leg', key: 'LegNumbersFile', label: 'Número del short', role: 'font' },
];

const FILE_RE = /^[A-Za-z0-9_\-.]+$/;
/** Extensions tried in the kit folder, in order. kserv.lua only serves .ftex; .dds is read for the preview only. */
export const KIT_FOLDER_EXTS = ['.ftex', '.dds'];

/**
 * Texture references of a kit from its config values.
 * @param {(key: string) => string|null|undefined} value config getter
 * @returns {{ slot: string, label: string, role: string, file: string, key: string, optional: boolean, notGame: boolean, valid: boolean }[]}
 */
export function kitAssetRefs(value) {
  const g = k => String(value(k) ?? '').trim();
  return ASSET_SLOTS.map(s => {
    const base = s.key ? g(s.key) : g(s.from);
    const file = base ? `${base}${s.suffix || ''}` : '';
    return {
      slot: s.slot, label: s.label, role: s.role, key: s.key || s.from, file,
      optional: Boolean(s.optional), notGame: Boolean(s.notGame), valid: !file || FILE_RE.test(file),
    };
  });
}

/** Kit-server relative folder of a kit ("Ligue 1/PSG/p1/") from its config.txt path. */
export const kitDirOf = configPath => String(configPath).replace(/\\/g, '/').replace(/config\.txt$/i, '');

/** Candidate kit-server relative paths of one file, in lookup order. */
export function assetCandidates(kitDir, file) {
  if (!file || !FILE_RE.test(file)) return [];
  return KIT_FOLDER_EXTS.map(ext => ({ path: `${kitDir}${file}${ext}`, ext }));
}

/**
 * @typedef {{ id: string, label: string, lookup: (path: string) => Promise<Uint8Array|null> }} AssetProvider
 *   id must change when the provider's content changes (e.g. include a manifest version), because results are cached by id.
 * @typedef {{ slot: string, label: string, role: string, key: string, file: string, optional: boolean, notGame: boolean,
 *   status: 'found'|'missing'|'empty'|'invalid'|'error', source: string|null, sourceLabel: string|null, path: string|null,
 *   ext: string|null, bytes: Uint8Array|null, tried: string[], error: string|null, servedByKserv: boolean }} ResolvedAsset
 */

/**
 * Lookup cache shared by every resolution: `${providerId}|${lower-case path}` → Promise<bytes|null>.
 * Concurrent requests for the same file share one promise; a failed lookup is not cached.
 */
export class AssetCache {
  constructor() { this.map = new Map(); }

  get(provider, path) {
    const key = `${provider.id}|${path.toLowerCase()}`;
    if (!this.map.has(key)) {
      const p = Promise.resolve().then(() => provider.lookup(path));
      this.map.set(key, p);
      p.catch(() => this.map.delete(key));
    }
    return this.map.get(key);
  }

  /** Forgets every entry of one provider (e.g. after the user picked another folder). */
  dropProvider(providerId) {
    for (const key of [...this.map.keys()]) if (key.startsWith(`${providerId}|`)) this.map.delete(key);
  }

  /**
   * Keeps only `keepId` among the providers whose id starts with `kind` ("local:", "cloud:", …): an id changes
   * when its content does, and the old entries (which hold texture bytes) would otherwise stay for the session.
   */
  retainOnly(kind, keepId) {
    for (const key of [...this.map.keys()]) if (key.startsWith(kind) && !key.startsWith(`${keepId}|`)) this.map.delete(key);
  }

  get size() { return this.map.size; }
}

/**
 * Resolves one reference: for each candidate extension, each provider in order.
 * @param {ReturnType<typeof kitAssetRefs>[number]} ref
 * @param {string} kitDir
 * @param {AssetProvider[]} providers
 * @param {AssetCache} cache
 * @returns {Promise<ResolvedAsset>}
 */
export async function resolveAsset(ref, kitDir, providers, cache) {
  const base = { ...ref, source: null, sourceLabel: null, path: null, ext: null, bytes: null, tried: [], error: null, servedByKserv: false };
  if (!ref.file) return { ...base, status: 'empty' };
  if (!ref.valid) return { ...base, status: 'invalid', error: `«${ref.file}» no es un nombre de archivo válido.` };
  const errors = [];
  for (const { path, ext } of assetCandidates(kitDir, ref.file)) {
    for (const provider of providers) {
      if (!base.tried.includes(provider.id)) base.tried.push(provider.id);
      let bytes = null;
      try { bytes = await cache.get(provider, path); } catch (e) { errors.push(`${provider.label}: ${e?.message || e}`); continue; }
      if (bytes && bytes.length) {
        return { ...base, status: 'found', source: provider.id, sourceLabel: provider.label, path, ext, bytes, servedByKserv: ext === '.ftex' };
      }
    }
  }
  return errors.length ? { ...base, status: 'error', error: errors.join(' · ') } : { ...base, status: 'missing' };
}

/**
 * Resolves every texture reference of a kit.
 * @param {{ value: (key: string) => any, configPath: string, providers: AssetProvider[], cache: AssetCache }} o
 * @returns {Promise<ResolvedAsset[]>}
 */
export async function resolveKitAssets({ value, configPath, providers, cache }) {
  const kitDir = kitDirOf(configPath);
  return Promise.all(kitAssetRefs(value).map(ref => resolveAsset(ref, kitDir, providers, cache)));
}

/**
 * Human-readable diagnostic per slot. Missing optional/derived files are informational: the game itself
 * works without them. A required file that is missing explains what the preview does instead.
 * @param {ResolvedAsset} a
 * @param {{ localAvailable: boolean }} ctx
 * @returns {{ level: 'ok'|'info'|'warn'|'error', text: string }}
 */
export function describeAsset(a, { localAvailable = false } = {}) {
  if (a.status === 'found') {
    if (!a.servedByKserv) return { level: 'warn', text: `${a.file}${a.ext}: se ve en la vista previa, pero kserv.lua solo usa .ftex del kit-server; el juego no cargaría este .dds.` };
    return { level: 'ok', text: `${a.file}${a.ext} · ${a.sourceLabel}` };
  }
  if (a.status === 'empty') {
    return { level: 'info', text: a.slot === 'chest' ? 'Sin número en el pecho (ChestNumbersFile vacío).' : `${a.key} está vacío.` };
  }
  if (a.status === 'invalid' || a.status === 'error') return { level: 'error', text: a.error };
  // missing
  const where = localAvailable ? 'No está en la nube ni en la carpeta del kit' : 'No está en la nube; abrí la carpeta del juego o del kit-server para buscarlo en esta PC';
  if (a.slot === 'nrm') return { level: 'info', text: `${a.file}: PES 2021 no lo usa (kserv.lua no remapea _nrm); se genera un relieve para la vista previa.` };
  if (a.optional) return { level: 'info', text: `${a.file}: opcional, ${localAvailable ? 'no está en la carpeta del kit' : 'no encontrado'}.` };
  const fallback = a.slot === 'kit' ? 'se usan los colores del config.txt' : 'se usa una fuente genérica';
  const outside = localAvailable ? ' (puede estar en un livecpk, que esta vista no lee)' : '';
  return { level: 'warn', text: `${a.file}: ${where}${outside}; ${fallback}.` };
}

/** Key of a kit-server relative path in a shared manifest (Firestore map keys must not contain "." or "/"). */
export const manifestKey = path => encodeURIComponent(String(path).toLowerCase()).replace(/\./g, '%2E');

const SHA_RE = /^[0-9a-f]{64}$/;
/**
 * Looks a path up in a manifest `files` map ({ [manifestKey]: { sha256, ext, size, path } }). Entries come from
 * Firestore, written by other users: anything that is not a hex SHA-256 with a .ftex/.dds extension is ignored, so
 * it never reaches a Storage path.
 */
export function manifestEntry(files, path) {
  const e = files && files[manifestKey(path)];
  if (!e || typeof e.sha256 !== 'string' || !SHA_RE.test(e.sha256) || !['.ftex', '.dds'].includes(e.ext)) return null;
  return e;
}

/** Local finds that are not in the cloud yet: what "Compartir texturas" would upload. */
export const shareableAssets = resolved => resolved.filter(a => a.status === 'found' && a.source === 'local' && a.ext === '.ftex');
