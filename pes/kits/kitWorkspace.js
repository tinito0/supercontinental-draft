// Kit-server workspace: indexes a Sider kit-server folder (map.txt + <team>/<kit>/config.txt)
// and applies validated edits. Textures are never decoded here; texture keys are only
// checked against the files present in the kit-server folder.
import { parseKitConfig, serializeKitConfig, setKitValue, getKitValue, parseKitMap, parseKitOrder, TEXTURE_KEYS } from './kitConfig.js';
import { PesFormatError, PesValidationError } from '../core/errors.js';
import { textureSlot } from './kitTextures.js';

export const KIT_SERVER_PREFIX = 'content/kit-server';
const TEXTURE_EXTS = ['.ftex', '.dds', '.png'];

/** Inserts `kit` after the last entry of `section` (creating it if needed), keeping every other line and the line endings. */
export function insertInOrder(text, section, kit) {
  const eol = /\r\n/.test(text) ? '\r\n' : '\n';
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  let start = section === 'default' ? 0 : lines.findIndex(l => l.trim() === `[${section}]`);
  if (start < 0) return [...lines, ...(lines.length ? [''] : []), `[${section}]`, kit].join(eol) + eol;
  if (section !== 'default') start += 1;
  let last = start - 1;
  for (let i = start; i < lines.length && !/^\s*\[.+\]\s*$/.test(lines[i]); i++) {
    const t = lines[i].trim();
    if (t && !t.startsWith(';') && !t.startsWith('#')) last = i;
  }
  lines.splice(last + 1, 0, kit);
  return lines.join(eol) + eol;
}

const norm = p => p.replace(/\\/g, '/').replace(/^\/+/, '');

/** Strips everything up to and including "kit-server/" so both the folder itself and a parent can be imported. */
export function toKitServerRelative(path) {
  const p = norm(path);
  const i = p.toLowerCase().lastIndexOf('kit-server/');
  return i >= 0 ? p.slice(i + 'kit-server/'.length) : p;
}

/** Classifies a kit folder name: p* = player kits, g* = goalkeeper kits (Sider convention). */
export function kitCategory(kitName) {
  const leaf = kitName.split('/').pop();
  if (/^g\d/i.test(leaf)) return 'goalkeeper';
  if (/^p\d/i.test(leaf)) return 'player';
  return 'other';
}

export class KitWorkspace {
  /**
   * @param {Map<string,string>} texts kit-server relative path -> text (map.txt, order.ini, gk_order.ini, config.txt)
   * @param {Set<string>} allPaths every kit-server relative path seen (including textures), lower-cased
   */
  constructor(texts, allPaths = new Set()) {
    this.texts = new Map([...texts].map(([k, v]) => [toKitServerRelative(k), v]));
    this.allPaths = new Set([...allPaths].map(p => toKitServerRelative(p).toLowerCase()));
    const mapText = this.texts.get('map.txt');
    if (mapText == null) throw new PesFormatError('NO_KIT_MAP', 'No se encontró map.txt del kit-server.');
    this.map = parseKitMap(mapText);
    this.original = new Map();
    this.configs = new Map();
    for (const [path, text] of this.texts) {
      if (!/\/config\.txt$/i.test(path)) continue;
      this.configs.set(path, parseKitConfig(text));
      this.original.set(path, text);
    }
    this.modified = new Set();
    this.assets = new Map(); // kit-server relative path -> generated texture bytes
    this.orderEdits = new Set(); // order.ini / gk_order.ini paths changed by addKit
  }

  teamIds() { return [...this.map.keys()]; }

  teamFolder(teamId) {
    const folder = this.map.get(teamId);
    if (!folder) throw new PesValidationError('NO_KITS', `El equipo ${teamId} no tiene carpeta en el kit-server.`, { teamId });
    return folder;
  }

  /** Kits of a team: every <team>/<kit>/config.txt found, with order.ini membership. */
  kitsOf(teamId) {
    const folder = this.teamFolder(teamId);
    const prefix = folder.toLowerCase() + '/';
    const order = this.texts.get(`${folder}/order.ini`);
    const gkOrder = this.texts.get(`${folder}/gk_order.ini`);
    const listed = new Set([
      ...Object.values(order ? parseKitOrder(order) : {}).flat(),
      ...Object.values(gkOrder ? parseKitOrder(gkOrder) : {}).flat(),
    ].map(s => s.toLowerCase()));
    const kits = [];
    for (const path of this.configs.keys()) {
      if (!path.toLowerCase().startsWith(prefix)) continue;
      const kit = path.slice(prefix.length).replace(/\/config\.txt$/i, '');
      kits.push({ kit, path, category: kitCategory(kit), inOrder: listed.has(kit.toLowerCase()), modified: this.modified.has(path) });
    }
    return kits.sort((a, b) => a.kit.localeCompare(b.kit, undefined, { numeric: true }));
  }

  configPath(teamId, kit) {
    const path = `${this.teamFolder(teamId)}/${kit}/config.txt`;
    const real = [...this.configs.keys()].find(p => p.toLowerCase() === path.toLowerCase());
    if (!real) throw new PesValidationError('NO_KIT', `El kit "${kit}" del equipo ${teamId} no existe.`, { teamId, kit });
    return real;
  }

  getConfig(teamId, kit) { return this.configs.get(this.configPath(teamId, kit)); }

  setValue(teamId, kit, key, value) {
    const path = this.configPath(teamId, kit);
    const res = setKitValue(this.configs.get(path), key, value);
    this.configs.set(path, res.cfg);
    if (this.original.get(path) !== null && serializeKitConfig(res.cfg) === this.original.get(path)) this.modified.delete(path); else this.modified.add(path);
    return { path, before: res.before, after: res.after };
  }

  /**
   * Stores an imported/generated texture next to the kit's config.txt. Non-derived slots
   * point their config key at the file; nrm/srm follow KitFile and change no key.
   * @param {string} slotId one of TEXTURE_SLOT_IDS
   * @param {string} file texture base name (no extension)
   * @param {Uint8Array} bytes verified texture bytes
   * @param {'.ftex'|'.dds'} ext
   */
  setTextureAsset(teamId, kit, slotId, file, bytes, ext = '.ftex') {
    const slot = textureSlot(slotId);
    if (!slot) throw new PesValidationError('UNKNOWN_SLOT', `Ranura de textura desconocida: ${slotId}.`);
    const dir = this.configPath(teamId, kit).replace(/config\.txt$/i, '');
    const assetPath = `${dir}${file}${ext}`;
    const ftexTwin = `${dir}${file}.ftex`;
    if (ext === '.dds' && this.allPaths.has(ftexTwin.toLowerCase()) && !this.assets.has(ftexTwin)) {
      throw new PesValidationError('SHADOWED_TEXTURE', `Ya existe ${file}.ftex en el kit y el kit-server la usa antes que el .dds: usá otro nombre o importá un .ftex/.png.`);
    }
    let res = { path: this.configPath(teamId, kit), before: null, after: null };
    if (slot.derived) {
      if (`${getKitValue(this.getConfig(teamId, kit), 'KitFile') || ''}${slot.suffix}` !== file) {
        throw new PesValidationError('INVALID_ASSET_REF', `${slot.label} debe llamarse <KitFile>${slot.suffix}.`);
      }
    } else {
      res = this.setValue(teamId, kit, slot.key, file);
    }
    this.assets.set(assetPath, bytes);
    this.allPaths.add(assetPath.toLowerCase());
    return { ...res, assetPath };
  }

  /** Texture references of a kit and whether each file exists in the kit folder. */
  textureRefs(teamId, kit) {
    const cfg = this.getConfig(teamId, kit);
    const dir = this.configPath(teamId, kit).replace(/config\.txt$/i, '').toLowerCase();
    return TEXTURE_KEYS.map(key => {
      const file = getKitValue(cfg, key) || '';
      if (!file) return { key, file, status: 'empty' };
      const found = TEXTURE_EXTS.find(ext => this.allPaths.has(dir + file.toLowerCase() + ext));
      return { key, file, status: found ? 'present' : 'external', ext: found || null };
    });
  }

  /** Order files of a team: player kits in order.ini, goalkeeper kits in gk_order.ini. */
  orderPath(teamId, category) {
    return `${this.teamFolder(teamId)}/${category === 'goalkeeper' ? 'gk_order.ini' : 'order.ini'}`;
  }

  /** Sections of a team's order file ('default' = lines before the first [section]). */
  orderSections(teamId, category) {
    const text = this.texts.get(this.orderPath(teamId, category));
    return text ? parseKitOrder(text) : { default: [] };
  }

  /** First unused p<n> / g<n> folder name of a team. */
  nextKitName(teamId, category) {
    const prefix = category === 'goalkeeper' ? 'g' : 'p';
    const used = new Set(this.kitsOf(teamId).map(k => k.kit.toLowerCase()));
    const folder = this.teamFolder(teamId).toLowerCase() + '/';
    for (const p of this.allPaths) if (p.startsWith(folder)) used.add(p.slice(folder.length).split('/')[0]);
    let n = 1;
    while (used.has(`${prefix}${n}`)) n++;
    return `${prefix}${n}`;
  }

  /**
   * Adds a kit to a team as a copy of one of its kits (config.txt values, texture names) and lists it in
   * order.ini / gk_order.ini under `section`, leaving the rest of the order file untouched.
   * Textures stay shared by name until new ones are imported for the new kit.
   * @returns {{ path: string, orderPath: string, before: null, after: object }}
   */
  addKit(teamId, { kit, from, section }) {
    if (!/^[pg][1-9]\d{0,2}$/.test(kit)) throw new PesValidationError('INVALID_KIT_NAME', `Nombre de kit inválido: "${kit}" (p1, p2… o g1, g2…).`);
    const category = kit.startsWith('g') ? 'goalkeeper' : 'player';
    const src = this.kitsOf(teamId).find(k => k.kit === from);
    if (!src) throw new PesValidationError('NO_KIT', `El kit "${from}" del equipo ${teamId} no existe.`, { teamId, kit: from });
    if (src.category !== category) throw new PesValidationError('KIT_CATEGORY', `Un kit de ${category === 'goalkeeper' ? 'arquero' : 'jugador'} se copia de otro igual (${from} no sirve).`);
    const kitDir = `${this.teamFolder(teamId)}/${kit}/`.toLowerCase();
    if (this.kitsOf(teamId).some(k => k.kit.toLowerCase() === kit) || [...this.allPaths].some(p => p.startsWith(kitDir))) {
      throw new PesValidationError('KIT_EXISTS', `El equipo ${teamId} ya tiene un kit "${kit}".`, { teamId, kit });
    }
    const path = `${this.teamFolder(teamId)}/${kit}/config.txt`;
    const sections = this.orderSections(teamId, category);
    const target = section && section in sections ? section : Object.keys(sections).find(k => k !== 'default') || 'default';
    const orderPath = this.orderPath(teamId, category);
    this.texts.set(orderPath, insertInOrder(this.texts.get(orderPath) || '', target, kit));
    this.orderEdits.add(orderPath);
    this.configs.set(path, parseKitConfig(serializeKitConfig(this.configs.get(src.path))));
    this.original.set(path, null); // new file: always exported
    this.modified.add(path);
    this.allPaths.add(path.toLowerCase());
    return { path, orderPath, before: null, after: { kit, from, section: target } };
  }

  /** Generated textures as { 'content/kit-server/<path>': bytes }. */
  assetFiles() {
    const out = {};
    for (const [path, bytes] of this.assets) out[`${KIT_SERVER_PREFIX}/${path}`] = bytes;
    return out;
  }

  /** Modified config files as { 'content/kit-server/<path>': text }. */
  modifiedFiles() {
    const out = {};
    for (const path of this.modified) out[`${KIT_SERVER_PREFIX}/${path}`] = serializeKitConfig(this.configs.get(path));
    for (const path of this.orderEdits) out[`${KIT_SERVER_PREFIX}/${path}`] = this.texts.get(path);
    return out;
  }
}
