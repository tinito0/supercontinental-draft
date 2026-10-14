// Kit texture import. A kit-server kit uses up to seven textures, all next to its config.txt:
//   kit  <KitFile>.ftex        main kit texture (shirt, shorts, socks, armband)
//   nrm  <KitFile>_nrm.ftex    normal map (fabric relief)          — name derived from KitFile
//   srm  <KitFile>_srm.ftex    shine/roughness map                 — name derived from KitFile
//   name/back/chest/leg        font sheets (see kitFonts.js), each with its own config key
// Slot list adapted from PES Editor Rebuilt js/kitstudio.js (KS_SLOTS, BSD-3-Clause).
// The kit-server looks for .ftex first, then .dds (Rebuilt ksFindTex).
import { encodeFtex, inspectFtex } from './ftex.js';
import { FONT_SLOTS } from './kitFonts.js';
import { PesValidationError } from '../core/errors.js';

export const TEXTURE_SLOTS = [
  { slot: 'kit', key: 'KitFile', suffix: '', label: 'Textura del kit', maxWidth: 4096, dxt5: true },
  { slot: 'nrm', key: 'KitFile', suffix: '_nrm', label: 'Normal map', derived: true, maxWidth: 4096, dxt5: true },
  { slot: 'srm', key: 'KitFile', suffix: '_srm', label: 'Brillo (SRM)', derived: true, maxWidth: 2048, dxt5: false },
  ...FONT_SLOTS.map(f => ({ slot: f.kind, key: f.key, suffix: f.suffix, label: f.label, aspect: f.aspect, maxWidth: 4096, dxt5: true, font: true })),
];
export const textureSlot = s => TEXTURE_SLOTS.find(x => x.slot === s);
export const TEXTURE_SLOT_IDS = TEXTURE_SLOTS.map(s => s.slot);

const FILE_RE = /^[A-Za-z0-9_\-.]+$/;
const isPow2 = v => v > 0 && (v & (v - 1)) === 0;

/** Validates a DDS header ("DDS " + 124-byte header) and returns its size. */
export function inspectDds(bytes) {
  if (bytes.length < 128 || bytes[0] !== 0x44 || bytes[1] !== 0x44 || bytes[2] !== 0x53 || bytes[3] !== 0x20) {
    throw new PesValidationError('NOT_DDS', 'No es un archivo DDS válido.');
  }
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint32(4, true) !== 124) throw new PesValidationError('NOT_DDS', 'Cabecera DDS inválida.');
  const height = dv.getUint32(12, true), width = dv.getUint32(16, true);
  const fourCC = String.fromCharCode(...bytes.subarray(84, 88));
  if (!width || !height) throw new PesValidationError('NOT_DDS', 'DDS sin tamaño.');
  return { width, height, fourCC };
}

/** Nearest-neighbour resample to the given power-of-two size (straight alpha preserved). */
export function resamplePixels(px, W, H, NW, NH) {
  if (NW === W && NH === H) return px;
  const out = new Uint8Array(NW * NH * 4);
  for (let y = 0; y < NH; y++) {
    const sy = Math.min(H - 1, Math.floor((y + 0.5) * H / NH));
    for (let x = 0; x < NW; x++) {
      const sx = Math.min(W - 1, Math.floor((x + 0.5) * W / NW));
      const s = (sy * W + sx) * 4, d = (y * NW + x) * 4;
      out[d] = px[s]; out[d + 1] = px[s + 1]; out[d + 2] = px[s + 2]; out[d + 3] = px[s + 3];
    }
  }
  return out;
}

const pow2Near = (v, max) => Math.min(max, 2 ** Math.round(Math.log2(Math.max(4, v))));

function checkFontAspect(slot, w, h) {
  if (!slot.font) return;
  const ratio = w / h;
  if (Math.abs(ratio - slot.aspect) / slot.aspect > 0.02) {
    throw new PesValidationError('BAD_ASPECT', `${slot.label}: la imagen debe ser ${slot.aspect}:1 (es ${w}x${h}).`, { expected: slot.aspect, width: w, height: h });
  }
}

/**
 * Turns decoded RGBA pixels into a verified FTEX for a slot.
 * @returns {{ bytes: Uint8Array, ext: '.ftex', info: object }}
 */
export function textureFromPixels(slotId, px, w, h) {
  const slot = textureSlot(slotId);
  if (!slot) throw new PesValidationError('UNKNOWN_SLOT', `Ranura de textura desconocida: ${slotId}.`);
  checkFontAspect(slot, w, h);
  const NW = pow2Near(w, slot.maxWidth);
  const NH = slot.font ? NW / slot.aspect : pow2Near(h, slot.maxWidth);
  const bytes = encodeFtex(resamplePixels(px, w, h, NW, NH), NW, NH, { dxt5: slot.dxt5 });
  return { bytes, ext: '.ftex', info: inspectFtex(bytes) };
}

/**
 * Accepts an already-encoded texture file for a slot. .ftex and .dds are kept byte for byte
 * after their structure is checked; images must go through textureFromPixels.
 */
export function textureFromFile(slotId, fileName, bytes) {
  const slot = textureSlot(slotId);
  if (!slot) throw new PesValidationError('UNKNOWN_SLOT', `Ranura de textura desconocida: ${slotId}.`);
  const ext = (fileName.match(/\.[^.]+$/) || [''])[0].toLowerCase();
  if (ext === '.ftex') {
    const info = inspectFtex(bytes);
    if (!isPow2(info.width) || !isPow2(info.height)) throw new PesValidationError('FTEX_SIZE', 'La textura no es potencia de 2.');
    checkFontAspect(slot, info.width, info.height);
    return { bytes, ext, info };
  }
  if (ext === '.dds') {
    const info = inspectDds(bytes);
    checkFontAspect(slot, info.width, info.height);
    return { bytes, ext, info: { format: info.fourCC.trim() || 'DX10/RGBA', width: info.width, height: info.height } };
  }
  throw new PesValidationError('UNSUPPORTED_TEXTURE', `Formato no soportado (${ext || 'sin extensión'}). Usá .ftex, .dds, .png, .jpg o .webp.`);
}

/**
 * The file base name a slot writes to. Derived slots (nrm/srm) follow KitFile; the others use
 * `requested` or keep the current value.
 */
export function targetFileName(slotId, currentKeyValue, requested) {
  const slot = textureSlot(slotId);
  if (slot.derived) {
    if (!currentKeyValue) throw new PesValidationError('NO_KITFILE', `${slot.label}: el kit no tiene KitFile; importá primero la textura del kit.`);
    return currentKeyValue + slot.suffix;
  }
  const name = (requested || currentKeyValue || '').trim();
  if (!name || !FILE_RE.test(name)) throw new PesValidationError('INVALID_ASSET_REF', `${slot.label}: nombre de archivo inválido.`);
  return name;
}
