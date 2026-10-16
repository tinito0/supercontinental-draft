// What the 3D preview draws for a kit, resolved from its config.txt (format: see kitConfig.js).
//
// Every value is validated against the range Sider's kserv.lua accepts (kitConfigSchema.js), falling back to the
// range of the line's own inline comment for keys kserv.lua does not list. A key that is missing, not a number or
// out of range is reported in `notes`; the source text is never changed: `values[key]` keeps the raw text next to
// the number the preview draws with. Keys the preview cannot represent (sleeve badges, ShirtModel 151) are
// reported as well, so the panel can say which config.txt values reach the render and which do not.
//
// Semantics from the comments Kit Studio 2021 writes in every config.txt of the patch and kserv.lua's editor:
//   SleeveLimits     0 = no limits, 1 = only long sleeves, 2 = only short sleeves
//   LongSleevesType  62 = normal & undershirt, 187 = only undershirt (short-sleeved shirt over a long undershirt)
//   WinterCollar     collar model worn with long sleeves (PES Editor Rebuilt: "cuello de invierno")
//   BackNumberType   0 = normal, 1 = forced two-digit
//   Name             0 = on, 1 = off;  NameShape 0 straight … 3 extreme curve
//   ShortsNumberX/Y  0 to 31 in kserv.lua (Kit Studio comments say 0 to 14/15); 30 or 31 hides the number
//   Right/Left Short/Long X/Y  sleeve badge position, 0 to 31; kserv.lua hides a badge with X=31, Y=0
import { getKitValue } from './kitConfig.js';
import { keyConstraint, satisfies, describeConstraint, BADGE_KEYS, isBadgeOff } from './kitConfigSchema.js';
import { decalLayout, GAME_STEPS } from './kitDecalFormulas.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const maxStepOf = key => (key === 'ShortsNumberY' ? 29 : GAME_STEPS[key].max);

/**
 * Reads integer keys once each. Records { raw, used } per key in `values` and a note for missing, malformed or
 * out-of-range values. In-range values are used as they are, even when the line's comment says otherwise.
 */
function reader(cfg, notes, values) {
  const cache = new Map();
  return (key, { fallback = 0, quiet = false } = {}) => {
    if (cache.has(key)) return cache.get(key);
    let v;
    const i = cfg?.keys.get(key);
    if (i === undefined) {
      if (!quiet) notes.push({ key, level: 'warn', text: `${key} no está en el config.txt: se usa ${fallback}.` });
      v = fallback;
      values[key] = { raw: null, used: v };
    } else {
      const line = cfg.lines[i];
      const raw = line.value.trim();
      if (!/^-?\d+$/.test(raw)) {
        notes.push({ key, level: 'warn', text: `${key}=${raw || '(vacío)'} no es un número: se usa ${fallback}.` });
        v = fallback;
      } else {
        v = Number(raw);
        const k = keyConstraint(key, line.commentConstraint ?? null);
        const c = k.constraint;
        if (!satisfies(c, v)) {
          const used = c.type === 'range' ? clamp(v, c.min, c.max) : fallback;
          const by = k.source === 'kserv' ? ' (rango de kserv.lua)' : '';
          notes.push({ key, level: 'warn', text: `${key}=${v} está fuera de ${describeConstraint(c)}${by}: el archivo no se cambia, la vista previa lo dibuja como ${used}.` });
          v = used;
        } else if (k.disagrees && k.comment && !satisfies(k.comment, v)) {
          notes.push({ key, level: 'info', text: `${key}=${v}: el comentario del config.txt dice ${describeConstraint(k.comment)}, pero kserv.lua acepta ${describeConstraint(c)}. Se usa ${v}.` });
        }
      }
      values[key] = { raw, used: v };
    }
    cache.set(key, v);
    return v;
  };
}

/**
 * @param {object} cfg parsed config.txt (parseKitConfig)
 * @param {{ sleeve?: 'short'|'long', goalkeeper?: boolean, collarPreview?: number|null }} view
 *   sleeve: the sleeve length asked for in the viewer; collarPreview: a collar being previewed (not saved yet)
 */
export function resolveKitRender(cfg, view = {}) {
  const notes = [];
  const values = {};
  const n = reader(cfg, notes, values);
  const s = key => String(getKitValue(cfg, key) ?? '').trim();
  const gk = Boolean(view.goalkeeper);

  // Sleeves: SleeveLimits wins over the viewer's choice; goalkeepers always wear long sleeves in the models.
  const limit = n('SleeveLimits', { quiet: true });
  const sleeveLimit = limit === 1 ? 'long' : limit === 2 ? 'short' : null;
  let sleeve = view.sleeve === 'long' ? 'long' : 'short';
  if (gk) sleeve = 'long';
  else if (sleeveLimit && sleeve !== sleeveLimit) {
    notes.push({ key: 'SleeveLimits', level: 'info', text: `SleeveLimits=${limit}: este kit solo se usa con mangas ${sleeveLimit === 'long' ? 'largas' : 'cortas'}.` });
    sleeve = sleeveLimit;
  }
  const longType = sleeve === 'long' && !gk ? n('LongSleevesType', { fallback: 62 }) : 62;
  const undershirtOnly = longType === 187;

  // Collar: the winter collar goes with long sleeves when the kit sets one.
  const winter = sleeve === 'long' && cfg?.keys.has('WinterCollar') ? n('WinterCollar') : 0;
  const collarKey = winter > 0 ? 'WinterCollar' : 'Collar';
  const savedCollar = winter > 0 ? winter : n('Collar');
  const collar = Number.isInteger(view.collarPreview) && view.collarPreview > 0 ? view.collarPreview : savedCollar;

  const shortsModel = n('ShortsModel', { fallback: 1 });
  const shortSleeves = n('ShortSleevesModel', { fallback: 1 });
  const shirtModel = n('ShirtModel', { quiet: true });
  if (shirtModel === 151) notes.push({ key: 'ShirtModel', level: 'info', text: 'ShirtModel=151 (mangas cortas semilargas): los modelos de la vista previa no tienen esa manga, se ve la corta normal.' });
  if (shortSleeves === 3) notes.push({ key: 'ShortSleevesModel', level: 'info', text: 'ShortSleevesModel=3 es para árbitros: se muestra la manga normal.' });

  // Name and numbers: config steps → the game's floats → placement on the kit texture, as PES2021.exe computes them
  // (kitDecalFormulas.js). The game rejects a step outside its own range (position 0, size 0.01): it is not drawn.
  const nameOn = n('Name', { quiet: true }) !== 1;
  const sx = n('ShortsNumberX', { fallback: 30 }), sy = n('ShortsNumberY', { fallback: 30 });
  const side = n('ShortsNumberSide', { quiet: true }) === 1 ? 1 : 0;
  const steps = {
    NameY: n('NameY'), NameSize: n('NameSize'), NameStretch: n('NameStretch'), NameShape: n('NameShape'),
    BackNumberY: n('BackNumberY'), BackNumberSize: n('BackNumberSize'), BackNumberSpacing: n('BackNumberSpacing', { fallback: 7 }),
    ChestNumberX: n('ChestNumberX'), ChestNumberY: n('ChestNumberY'), ChestNumberSize: n('ChestNumberSize'),
    ShortsNumberX: sx, ShortsNumberY: sy, ShortsNumberSize: n('ShortsNumberSize'), ShortsNumberSide: side,
  };
  const layout = decalLayout(steps);
  const rejected = new Set(layout.invalid);
  const group = { name: ['NameY', 'NameSize'], back: ['BackNumberY', 'BackNumberSize', 'BackNumberSpacing'],
    chest: ['ChestNumberX', 'ChestNumberY', 'ChestNumberSize'], shorts: ['ShortsNumberX', 'ShortsNumberY', 'ShortsNumberSize'] };
  const label = { name: 'el nombre', back: 'el número de la espalda', chest: 'el número del pecho', shorts: 'el número del short' };
  const hidden = {};
  for (const [g, keys] of Object.entries(group)) {
    const bad = keys.filter(k => rejected.has(k));
    hidden[g] = bad.length > 0;
    for (const key of bad) {
      notes.push({ key, level: 'info', text: `${key}=${steps[key]} está fuera del rango que acepta el juego (0 a ${maxStepOf(key)}): el juego lo descarta y ${label[g]} no se ve.` });
    }
  }
  if (rejected.has('NameStretch')) notes.push({ key: 'NameStretch', level: 'info', text: `NameStretch=${steps.NameStretch} está fuera de 0 a 3: el juego usa el ancho normal.` });
  const name = nameOn && !hidden.name ? { ...layout.name, steps } : null;
  const back = hidden.back ? null : { ...layout.back, twoDigits: n('BackNumberType', { quiet: true }) === 1 };
  // Front: only when the kit has a chest number sheet (empty ChestNumbersFile = no chest number).
  const chest = s('ChestNumbersFile') && !hidden.chest ? layout.chest : null;
  const shorts = hidden.shorts ? null : { ...layout.shorts, left: side !== 1, x: sx, y: sy, size: steps.ShortsNumberSize };

  // Sleeve badges: positions for the sleeve length on screen. The badge images belong to the competition
  // (Sider badge-server: content/badge-server/<competition>/badge/badge.ftex, badge-left.ftex), not to the kit.
  const badges = {};
  for (const side of ['right', 'left']) {
    const [kx, ky] = BADGE_KEYS[side][sleeve];
    if (!cfg?.keys.has(kx) || !cfg?.keys.has(ky)) { badges[side] = null; continue; }
    const x = n(kx), y = n(ky);
    badges[side] = { x, y, off: isBadgeOff(x, y), keys: [kx, ky] };
  }
  const shownBadges = ['right', 'left'].filter(side => badges[side] && !badges[side].off);
  if (shownBadges.length) {
    notes.push({ key: 'RightShortX', level: 'info', text: `Parches de manga (${shownBadges.map(s => (s === 'right' ? 'derecha' : 'izquierda')).join(' y ')}): las posiciones se leen, pero las imágenes son de la competición (badge-server) y esta vista solo usa el kit-server, así que no se dibujan.` });
  }

  return {
    sleeve, sleeveLimit, undershirtOnly,
    collar: collar > 0 ? collar : null, collarKey, savedCollar: savedCollar > 0 ? savedCollar : null,
    tight: n('TightKit', { quiet: true }) === 1, kappa: shortSleeves === 2, shortsModel,
    name, back, chest, shorts, badges,
    values, notes,
  };
}

/** Number as printed: digits only, at most two, padded to two when BackNumberType forces it. */
export function printedNumber(render, number) {
  const digits = String(number ?? '').replace(/\D/g, '').slice(0, 2);
  if (!digits) return '';
  return render.back?.twoDigits ? digits.padStart(2, '0') : digits;
}

/**
 * Collars the model pack can show, limited to the Collar range (kserv.lua: 1 to 135).
 * @param {{ names: () => string[] }} pack
 */
export function availableCollars(pack, cfg) {
  const i = cfg?.keys.get('Collar');
  const c = i === undefined ? null : cfg.lines[i].constraint;
  return pack.names()
    .map(name => /^collar_(\d{3})$/.exec(name))
    .filter(Boolean)
    .map(m => Number(m[1]))
    .filter(v => !c || c.type !== 'range' || (v >= c.min && v <= c.max))
    .sort((a, b) => a - b);
}
