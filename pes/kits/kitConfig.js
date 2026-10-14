// Sider kit-server kit configuration (content/kit-server/<team>/<kit>/config.txt).
//
// Format observed in the UML patch (4768 files under E:\eFootball PES 2021\content\kit-server):
//   ; comment lines and section headers
//   Key=Value<padding>; inline comment documenting the valid range
// The parser keeps every line verbatim; serialization only replaces the value text of
// edited keys, keeping padding, comments, order and line endings. Ranges are read from
// the patch's own inline comments ("1 to 130", "0=Off, 1=On", "144, 151=..., 160").
import { PesValidationError } from '../core/errors.js';

const KV_RE = /^(\s*)([A-Za-z0-9_]+)(\s*=\s*)([^;\r\n]*?)(\s*)(;.*)?$/;
const COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
const FILE_RE = /^[A-Za-z0-9_\-.]*$/;

/** Keys that hold texture asset references (file names without extension). */
export const TEXTURE_KEYS = ['KitFile', 'BackNumbersFile', 'ChestNumbersFile', 'LegNumbersFile', 'NameFontFile'];
/** Keys that hold colours (#RRGGBB). */
export const COLOR_KEYS = ['ShirtColor1', 'ShirtColor2', 'UndershirtColor', 'ShortsColor', 'SocksColor', 'UniColor_Color1', 'UniColor_Color2'];

/**
 * Every key a kit manager may change. Anything else in config.txt is read-only.
 * Kept in sync with firestore.rules (pesKitFields) — tests/pes/rulesSync.test.js checks it.
 */
export const KIT_EDITABLE_KEYS = [
  'ShortSleevesModel', 'ShirtModel', 'Collar', 'TightKit', 'ShirtPattern', 'WinterCollar', 'LongSleevesType',
  'Name', 'NameShape', 'NameY', 'NameSize', 'NameStretch', 'BackNumberY', 'BackNumberSize', 'BackNumberSpacing', 'BackNumberType',
  'ChestNumberX', 'ChestNumberY', 'ChestNumberSize',
  'ShortsModel', 'ShortsNumberSide', 'ShortsNumberX', 'ShortsNumberY', 'ShortsNumberSize',
  ...TEXTURE_KEYS, ...COLOR_KEYS,
  'RightShortX', 'RightShortY', 'RightLongX', 'RightLongY', 'LeftShortX', 'LeftShortY', 'LeftLongX', 'LeftLongY',
  'CaptainArmband',
];

/** Parses "1 to 130", "0=Off, 1=On", "144, 151=Semi-long, 160, 176=Legacy" into a constraint. */
export function parseRangeComment(comment) {
  if (!comment) return null;
  const text = comment.replace(/^;\s*/, '');
  const range = text.match(/^(-?\d+)\s+to\s+(-?\d+)/i);
  if (range) return { type: 'range', min: Number(range[1]), max: Number(range[2]) };
  const items = text.split(',').map(s => s.trim()).filter(Boolean);
  const values = [];
  const labels = {};
  for (const item of items) {
    const m = item.match(/^(-?\d+)(?:\s*=\s*(.*))?$/);
    if (!m) return null; // free text: no machine-readable constraint
    values.push(Number(m[1]));
    if (m[2]) labels[m[1]] = m[2];
  }
  return values.length ? { type: 'enum', values, labels } : null;
}

/**
 * @param {string} text config.txt contents
 * @returns {{ lines: object[], keys: Map<string, number>, eol: string, bom: boolean }}
 */
export function parseKitConfig(text) {
  const bom = text.charCodeAt(0) === 0xfeff;
  const body = bom ? text.slice(1) : text;
  const eol = body.includes('\r\n') ? '\r\n' : '\n';
  const rawLines = body.split(/\r?\n/);
  const lines = [];
  const keys = new Map();
  rawLines.forEach((raw, i) => {
    const trimmed = raw.trim();
    const m = !trimmed.startsWith(';') && !trimmed.startsWith('#') ? raw.match(KV_RE) : null;
    if (m) {
      const [, indent, key, sep, value, pad, comment] = m;
      lines.push({ type: 'kv', raw, indent, key, sep, value, pad, comment: comment || '', constraint: parseRangeComment(comment) });
      if (!keys.has(key)) keys.set(key, i);
    } else {
      lines.push({ type: 'other', raw });
    }
  });
  return { lines, keys, eol, bom };
}

export function getKitValue(cfg, key) {
  const i = cfg.keys.get(key);
  return i === undefined ? undefined : cfg.lines[i].value;
}

/** Validates a proposed value for a key against the format and the patch's own range comment. */
export function validateKitValue(cfg, key, value) {
  if (!KIT_EDITABLE_KEYS.includes(key)) throw new PesValidationError('FIELD_READ_ONLY', `Kit: "${key}" no es editable.`, { key });
  const i = cfg.keys.get(key);
  if (i === undefined) throw new PesValidationError('UNKNOWN_FIELD', `Kit: el config.txt no tiene la clave "${key}".`, { key });
  const v = String(value);
  if (/[;\r\n]/.test(v)) throw new PesValidationError('INVALID_CHARS', `Kit: "${key}" no puede contener ";" ni saltos de línea.`, { key });
  if (COLOR_KEYS.includes(key)) {
    if (!COLOR_RE.test(v)) throw new PesValidationError('INVALID_COLOR', `Kit: "${key}" debe ser un color #RRGGBB.`, { key, value: v });
    return v.toUpperCase();
  }
  if (TEXTURE_KEYS.includes(key)) {
    if (!FILE_RE.test(v)) throw new PesValidationError('INVALID_ASSET_REF', `Kit: "${key}" solo admite letras, números, "_", "-" y ".".`, { key, value: v });
    return v;
  }
  if (!/^-?\d+$/.test(v)) throw new PesValidationError('TYPE', `Kit: "${key}" debe ser un número entero.`, { key, value: v });
  const n = Number(v);
  const c = cfg.lines[i].constraint;
  if (c?.type === 'range' && (n < c.min || n > c.max)) throw new PesValidationError('OUT_OF_RANGE', `Kit: "${key}" debe estar entre ${c.min} y ${c.max}.`, { key, ...c });
  if (c?.type === 'enum' && !c.values.includes(n)) throw new PesValidationError('OUT_OF_RANGE', `Kit: "${key}" admite ${c.values.join(', ')}.`, { key, values: c.values });
  return String(n);
}

/** Returns a new config with one value replaced (the input is not mutated). */
export function setKitValue(cfg, key, value) {
  const normalized = validateKitValue(cfg, key, value);
  const i = cfg.keys.get(key);
  const line = cfg.lines[i];
  const before = line.value;
  // Keep the comment column: shrink/grow the padding so the ';' stays where it was when possible.
  let pad = line.pad;
  if (line.comment) {
    const delta = normalized.length - before.length;
    pad = pad.length - delta >= 1 ? pad.slice(0, pad.length - delta) : ' ';
    if (delta < 0) pad = line.pad + ' '.repeat(-delta);
  }
  const next = { ...line, value: normalized, pad, raw: `${line.indent}${line.key}${line.sep}${normalized}${pad}${line.comment}` };
  const lines = cfg.lines.slice();
  lines[i] = next;
  return { cfg: { ...cfg, lines }, before, after: normalized };
}

export function serializeKitConfig(cfg) {
  return (cfg.bom ? '\uFEFF' : '') + cfg.lines.map(l => l.raw).join(cfg.eol);
}

/** Colour/model summary used by the React preview; contains only values read from config.txt. */
export function kitPreviewModel(cfg) {
  const g = k => getKitValue(cfg, k);
  return {
    shirtColor1: g('ShirtColor1'), shirtColor2: g('ShirtColor2'), undershirtColor: g('UndershirtColor'),
    shortsColor: g('ShortsColor'), socksColor: g('SocksColor'),
    menuColor1: g('UniColor_Color1'), menuColor2: g('UniColor_Color2'),
    collar: g('Collar'), shirtModel: g('ShirtModel'), shortsModel: g('ShortsModel'), pattern: g('ShirtPattern'),
    textures: Object.fromEntries(TEXTURE_KEYS.map(k => [k, g(k) || ''])),
  };
}

/** Parses kit-server map.txt: `<teamId>, "<relative folder>"`. */
export function parseKitMap(text) {
  const map = new Map();
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    const m = line.match(/^(\d+)\s*,\s*"([^"]+)"/);
    if (m) map.set(Number(m[1]), m[2].replace(/\\/g, '/'));
  }
  return map;
}

/** Parses order.ini / gk_order.ini: default kit list then [variant] sections. */
export function parseKitOrder(text) {
  const sections = { default: [] };
  let cur = 'default';
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) continue;
    const s = line.match(/^\[(.+)\]$/);
    if (s) { cur = s[1]; sections[cur] = sections[cur] || []; continue; }
    sections[cur].push(line.replace(/\\/g, '/'));
  }
  return sections;
}
