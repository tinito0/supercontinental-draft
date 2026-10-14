// Fabric maps for a kit: normal map (<KitFile>_nrm) and shine map (<KitFile>_srm).
// The game's normal map stores the fabric slope in red (X) and green (Y); blue is unused. It combines
// a repeating weave with the relief of the kit's drawings (crest, sponsor, stripes) taken from the
// kit texture's brightness. SRM: red = specular shine, green = roughness.
// Adapted from PES Editor Rebuilt js/kitmat.js (KMAT, BSD-3-Clause) to work on pixel arrays.
import { PesValidationError } from '../core/errors.js';

export const FABRICS = [
  { k: 'liso', n: 'Liso', d: 'Tela lisa, sin trama', spec: 70, rough: 150 },
  { k: 'malla', n: 'Malla deportiva', d: 'Agujeritos chicos en filas, como las camisetas actuales', spec: 85, rough: 120 },
  { k: 'pique', n: 'Piqué', d: 'Puntitos en relieve, tela de chomba', spec: 65, rough: 165 },
  { k: 'panal', n: 'Panal', d: 'Hexágonos, tela técnica', spec: 90, rough: 115 },
  { k: 'rayas', n: 'Acanalado', d: 'Rayitas verticales finas', spec: 75, rough: 140 },
  { k: 'diagonal', n: 'Sarga diagonal', d: 'Trama en diagonal', spec: 80, rough: 130 },
  { k: 'jacquard', n: 'Jacquard', d: 'Ondas tejidas en la tela', spec: 95, rough: 110 },
  { k: 'retro', n: 'Algodón retro', d: 'Tela gruesa y opaca de camiseta antigua', spec: 45, rough: 200 },
];
const fabricOf = k => {
  const f = FABRICS.find(x => x.k === k);
  if (!f) throw new PesValidationError('UNKNOWN_FABRIC', `Tela desconocida: ${k}.`);
  return f;
};

/** Height (0..1) of the weave in a seamless N × N tile. */
export function fabricTile(kind, N = 64) {
  fabricOf(kind);
  const h = new Float32Array(N * N), T = Math.PI * 2;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N;
    let z = 0.5;
    if (kind === 'malla') { const cx = ((u * 8) % 1) - 0.5, cy = ((v * 8 + (Math.floor(u * 8) % 2) * 0.5) % 1) - 0.5; z = Math.min(1, Math.hypot(cx, cy) * 3.2); }
    else if (kind === 'pique') { const cx = ((u * 12) % 1) - 0.5, cy = ((v * 12) % 1) - 0.5; z = 1 - Math.min(1, Math.hypot(cx, cy) * 2.6); }
    // Hexagons: whole periods in both directions (10 and 12) so the tile repeats without a seam
    // (Rebuilt used 6/√3, which is not periodic); 10 / 6 ≈ √3 keeps the hexagons regular.
    else if (kind === 'panal') { const a = u * 10 * T, b = v * 12 * T; z = 0.5 + (Math.cos(a + b / 2) + Math.cos(a - b / 2) + Math.cos(b)) / 6; z = Math.abs(z - 0.5) * 2; }
    else if (kind === 'rayas') z = 0.5 + 0.5 * Math.sin(u * T * 16);
    else if (kind === 'diagonal') z = 0.5 + 0.5 * Math.sin((u + v) * T * 12);
    else if (kind === 'jacquard') z = 0.5 + 0.25 * Math.sin(u * T * 4 + Math.sin(v * T * 3) * 2) + 0.25 * Math.sin(v * T * 8);
    else if (kind === 'retro') z = 0.5 + 0.2 * Math.sin(u * T * 24) * Math.sin(v * T * 24) + 0.1 * Math.sin((u * 7 + v * 13) * T);
    h[y * N + x] = z;
  }
  return h;
}

/** Brightness of the kit texture resampled to S × S (0..1). */
function luminance(kit, S) {
  const a = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    const sy = Math.min(kit.height - 1, Math.floor(((y + 0.5) * kit.height) / S));
    for (let x = 0; x < S; x++) {
      const sx = Math.min(kit.width - 1, Math.floor(((x + 0.5) * kit.width) / S)), p = (sy * kit.width + sx) * 4;
      a[y * S + x] = (kit.pixels[p] * 0.3 + kit.pixels[p + 1] * 0.59 + kit.pixels[p + 2] * 0.11) / 255;
    }
  }
  return a;
}

/**
 * Normal map as RGBA pixels (size × size).
 * @param {{ kit?: {pixels: Uint8Array|Uint8ClampedArray, width: number, height: number}|null, fabric?: string,
 *           repeat?: number, fabricStrength?: number, emboss?: number, size?: number }} o
 *   repeat: weave tiles across the texture; fabricStrength 0..1; emboss 0..1 relief of the kit drawings.
 */
export function normalMapPixels({ kit = null, fabric = 'malla', repeat = 48, fabricStrength = 0.5, emboss = 0.6, size = 2048 } = {}) {
  fabricOf(fabric);
  if (!Number.isInteger(size) || size < 4 || (size & (size - 1))) throw new PesValidationError('FTEX_SIZE', 'El normal map debe ser potencia de 2.');
  const W = size, H = size, out = new Uint8Array(W * H * 4);
  const N = 64, tl = fabric === 'liso' ? null : fabricTile(fabric, N);
  const S = Math.min(W, 1024), lum = kit && emboss > 0 ? luminance(kit, S) : null;
  const L = (x, y) => lum[Math.min(S - 1, Math.max(0, y)) * S + Math.min(S - 1, Math.max(0, x))];
  const Hf = (x, y) => tl[(((y % N) + N) % N) * N + (((x % N) + N) % N)];
  const fk = (repeat * N) / W; // tile samples per pixel
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let nx = 0, ny = 0;
      if (tl) {
        const fx = Math.floor(x * fk), fy = Math.floor(y * fk);
        nx += (Hf(fx - 1, fy) - Hf(fx + 1, fy)) * fabricStrength;
        ny += (Hf(fx, fy - 1) - Hf(fx, fy + 1)) * fabricStrength;
      }
      if (lum) {
        const lx = Math.floor((x * S) / W), ly = Math.floor((y * S) / H);
        nx += (L(lx - 1, ly) - L(lx + 1, ly)) * emboss * 6;
        ny += (L(lx, ly - 1) - L(lx, ly + 1)) * emboss * 6;
      }
      const i = (y * W + x) * 4, l = Math.hypot(nx, ny, 1);
      out[i] = Math.round(128 + (127 * nx) / l);
      out[i + 1] = Math.round(128 + (127 * ny) / l);
      out[i + 2] = 0;
      out[i + 3] = 255;
    }
  }
  return out;
}

/** Shine/roughness map of a fabric as RGBA pixels (uniform: red = shine, green = roughness). */
export function srmPixels(fabric, size = 1024) {
  const f = fabricOf(fabric), out = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) { out[i * 4] = f.spec; out[i * 4 + 1] = f.rough; out[i * 4 + 3] = 255; }
  return out;
}
