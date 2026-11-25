// Normal map (<KitFile>_nrm) from a kit's shine map (_srm): everything that changes in the srm comes out in relief
// (crest, sponsor, stripes, weaves, seams). Port of the project tool E:\supercontinental-3d\tools\nrm_from_srm.py
// (documented in tools/NRM_FROM_SRM.md), same defaults and the same steps:
//   height = wR·R − wG·G (smooth, shiny prints end up high) + wC·luminance of the kit texture (--color: tone-on-tone
//   stripes, weaves and piping the srm does not mark), minus a wide gaussian (so the cloth is not tilted as a
//   whole), smoothed by a narrow one, plus optional fixed grain; normal = normalize(−gx·k, gy·k, 1) from np.gradient.
// The game's nrm: R = X, G = Y (0..255 → −1..1), B = 0, alpha 255.
//
// Differences from the Python tool: the wide gaussians (sigma ≥ 3, i.e. --flatten) are three box blurs, the usual
// approximation, because an exact sigma-64 kernel over a 4096 texture would block the page for minutes; the grain
// noise comes from a seeded JS generator, so it does not match numpy's seed 7 pixel for pixel.
import { PesValidationError } from '../core/errors.js';

/** Defaults of nrm_from_srm.py. */
export const NRM_FROM_SRM_DEFAULTS = Object.freeze({
  strength: 3, blur: 1.2, flatten: 64, weightR: 0.5, weightG: 1, invert: false, flipY: false, grain: 0, colorWeight: 0.5,
});
/** Slider ranges: [min, max, step]. */
export const NRM_FROM_SRM_RANGES = Object.freeze({
  strength: [0, 12, 0.25], blur: [0, 4, 0.1], flatten: [8, 256, 8], grain: [0, 5, 0.25], colorWeight: [0, 2, 0.05],
});

const EXACT_SIGMA_MAX = 3; // below this the gaussian is an exact kernel (scipy truncate = 4, mode 'reflect')
const GRAIN_SIGMA = 0.7;
const GRAIN_SEED = 7;

/** scipy 'reflect' boundary: (d c b a | a b c d | d c b a). */
const reflect = (i, n) => {
  if (n === 1) return 0;
  const p = 2 * n;
  let k = ((i % p) + p) % p;
  return k < n ? k : p - 1 - k;
};

function kernel(sigma) {
  const r = Math.max(1, Math.round(4 * sigma)), k = new Float64Array(2 * r + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) { k[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma)); sum += k[i + r]; }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  return { k, r };
}

/** One separable pass of an exact gaussian along x (dx = 1) or y (dx = W). */
function convolve(src, W, H, { k, r }, alongX) {
  const out = new Float64Array(src.length);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let j = -r; j <= r; j++) {
        s += k[j + r] * (alongX ? src[y * W + reflect(x + j, W)] : src[reflect(y + j, H) * W + x]);
      }
      out[y * W + x] = s;
    }
  }
  return out;
}

/** Box widths whose three passes approximate a gaussian of this sigma (Kovesi / Ivan Kutskir). */
function boxSizes(sigma, n = 3) {
  const ideal = Math.sqrt((12 * sigma * sigma) / n + 1);
  let wl = Math.floor(ideal);
  if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  const m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4));
  return Array.from({ length: n }, (_, i) => (i < m ? wl : wu));
}

/** Running-sum box blur of radius r along one axis, reflect boundary. */
function boxPass(src, W, H, r, alongX) {
  const out = new Float64Array(src.length), len = alongX ? W : H, lines = alongX ? H : W, inv = 1 / (2 * r + 1);
  const at = (line, i) => (alongX ? src[line * W + reflect(i, W)] : src[reflect(i, H) * W + line]);
  for (let line = 0; line < lines; line++) {
    let s = 0;
    for (let i = -r; i <= r; i++) s += at(line, i);
    for (let i = 0; i < len; i++) {
      out[alongX ? line * W + i : i * W + line] = s * inv;
      s += at(line, i + r + 1) - at(line, i - r);
    }
  }
  return out;
}

/** Gaussian blur of a W × H float field (exact for small sigma, three box blurs for large). */
export function gaussian(src, W, H, sigma) {
  if (!(sigma > 0)) return Float64Array.from(src);
  if (sigma < EXACT_SIGMA_MAX) {
    const k = kernel(sigma);
    return convolve(convolve(src, W, H, k, true), W, H, k, false);
  }
  let a = src;
  for (const w of boxSizes(sigma)) {
    const r = (w - 1) / 2;
    a = boxPass(boxPass(a, W, H, r, true), W, H, r, false);
  }
  return a;
}

/** Standard normal noise from a fixed seed (mulberry32 + Box–Muller). */
function noise(n, seed) {
  let t = seed >>> 0;
  const rand = () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let z = t;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
  return out;
}

/**
 * Height field of nrm_from_srm.py height_map(). `srm`: RGBA pixels, values 0..255. `color`: optional RGBA pixels of
 * the kit texture at the same W × H (--color), weighted by colorWeight with Rec. 709 luminance.
 */
export function srmHeight(srm, W, H, o = NRM_FROM_SRM_DEFAULTS, color = null) {
  let h = new Float64Array(W * H);
  const sign = o.invert ? -1 : 1, wc = color ? o.colorWeight : 0;
  for (let i = 0; i < W * H; i++) {
    const lum = wc ? 0.2126 * color[i * 4] + 0.7152 * color[i * 4 + 1] + 0.0722 * color[i * 4 + 2] : 0;
    h[i] = sign * (o.weightR * srm[i * 4] - o.weightG * srm[i * 4 + 1] + wc * lum) / 255;
  }
  const tilt = gaussian(h, W, H, o.flatten);
  for (let i = 0; i < h.length; i++) h[i] -= tilt[i];
  h = gaussian(h, W, H, o.blur);
  if (o.grain > 0) {
    const g = gaussian(noise(W * H, GRAIN_SEED), W, H, GRAIN_SIGMA);
    for (let i = 0; i < h.length; i++) h[i] += o.grain * 0.01 * g[i];
  }
  return h;
}

/**
 * Normal map (RGBA, W × H) from a kit's _srm pixels, as nrm_from_srm.py does.
 * @param {{ pixels: Uint8Array|Uint8ClampedArray, width: number, height: number }} srm
 * @param {Partial<typeof NRM_FROM_SRM_DEFAULTS> & { color?: { pixels: Uint8Array|Uint8ClampedArray, width: number, height: number }|null }} [options]
 *   color: the kit texture at the srm's size (--color); left out = srm only.
 * @returns {Uint8ClampedArray}
 */
export function normalFromSrm(srm, { color = null, ...options } = {}) {
  const o = { ...NRM_FROM_SRM_DEFAULTS, ...options };
  const W = srm?.width, H = srm?.height;
  if (!srm?.pixels || !Number.isInteger(W) || !Number.isInteger(H) || W < 2 || H < 2 || srm.pixels.length < W * H * 4) {
    throw new PesValidationError('SRM_PIXELS', 'El _srm del kit no tiene píxeles válidos.');
  }
  if (color && (color.width !== W || color.height !== H)) throw new PesValidationError('SRM_PIXELS', 'La textura del kit tiene que tener el tamaño del _srm.');
  const h = srmHeight(srm.pixels, W, H, o, color?.pixels || null), out = new Uint8ClampedArray(W * H * 4);
  const at = (x, y) => h[y * W + x];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // np.gradient: central differences inside, one-sided on the edges
      const gx = x === 0 ? at(1, y) - at(0, y) : x === W - 1 ? at(x, y) - at(x - 1, y) : (at(x + 1, y) - at(x - 1, y)) / 2;
      const gyRaw = y === 0 ? at(x, 1) - at(x, 0) : y === H - 1 ? at(x, y) - at(x, y - 1) : (at(x, y + 1) - at(x, y - 1)) / 2;
      const gy = o.flipY ? -gyRaw : gyRaw;
      const nx = -gx * o.strength, ny = gy * o.strength, l = Math.hypot(nx, ny, 1), i = (y * W + x) * 4;
      out[i] = Math.round((nx / l * 0.5 + 0.5) * 255);
      out[i + 1] = Math.round((ny / l * 0.5 + 0.5) * 255);
      out[i + 2] = 0;
      out[i + 3] = 255;
    }
  }
  return out;
}
