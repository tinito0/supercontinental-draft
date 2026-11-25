// Synthetic srm fixtures: these check the port's maths against nrm_from_srm.py's rules, not game compatibility.
// A one-off cross-check against the Python tool (48 px srm, flatten 2.5, with and without --color) matched exactly.
import { describe, it, expect } from 'vitest';
import { gaussian, normalFromSrm, NRM_FROM_SRM_DEFAULTS } from '../../pes/kits/nrmFromSrm.js';

const W = 32;
/** RGBA srm: R = 100, G = 200 everywhere, with a smooth shiny square (R 140, G 140) in the middle. */
function srmWithSquare() {
  const px = new Uint8Array(W * W * 4);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, inside = x >= 12 && x < 20 && y >= 12 && y < 20;
    px[i] = inside ? 140 : 100; px[i + 1] = inside ? 140 : 200; px[i + 3] = 255;
  }
  return { pixels: px, width: W, height: W };
}
const at = (out, x, y) => [out[(y * W + x) * 4], out[(y * W + x) * 4 + 1], out[(y * W + x) * 4 + 2], out[(y * W + x) * 4 + 3]];

describe('normal map from _srm (nrm_from_srm.py port)', () => {
  it('a flat srm gives a flat normal map (128, 128, 0, 255)', () => {
    const flat = { pixels: new Uint8Array(W * W * 4).fill(150), width: W, height: W };
    const out = normalFromSrm(flat);
    for (let i = 0; i < W * W; i++) expect([out[i * 4], out[i * 4 + 1], out[i * 4 + 2], out[i * 4 + 3]]).toEqual([128, 128, 0, 255]);
  });

  it('a shiny square rises: X points away from it on the left and right edges', () => {
    const out = normalFromSrm(srmWithSquare(), { flatten: 8 });
    // height grows left to right on the left edge → gx > 0 → R = (−gx·k) below 128
    expect(at(out, 12, 16)[0]).toBeLessThan(128);
    expect(at(out, 19, 16)[0]).toBeGreaterThan(128);
    // top edge: height grows downwards → gy > 0 → G above 128
    expect(at(out, 16, 12)[1]).toBeGreaterThan(128);
  });

  it('invert and flipY mirror the slopes', () => {
    const base = normalFromSrm(srmWithSquare(), { flatten: 8 });
    const inv = normalFromSrm(srmWithSquare(), { flatten: 8, invert: true });
    const flip = normalFromSrm(srmWithSquare(), { flatten: 8, flipY: true });
    expect(at(inv, 12, 16)[0]).toBeGreaterThan(128);
    expect(at(base, 16, 12)[1] - 128).toBeCloseTo(128 - at(flip, 16, 12)[1], -0.5);
  });

  it('adds the kit texture brightness when a colour map is given', () => {
    const flat = { pixels: new Uint8Array(W * W * 4).fill(150), width: W, height: W };
    const colour = new Uint8Array(W * W * 4).fill(0);
    for (let y = 0; y < W; y++) for (let x = 16; x < 20; x++) colour.fill(255, (y * W + x) * 4, (y * W + x) * 4 + 3);
    const out = normalFromSrm(flat, { flatten: 8, color: { pixels: colour, width: W, height: W } });
    expect(at(out, 16, 10)[0]).toBeLessThan(128);
    expect(() => normalFromSrm(flat, { color: { pixels: colour, width: 16, height: 16 } })).toThrow();
  });

  it('keeps the Python defaults', () => {
    expect(NRM_FROM_SRM_DEFAULTS).toMatchObject({ strength: 3, blur: 1.2, flatten: 64, weightR: 0.5, weightG: 1, grain: 0, colorWeight: 0.5 });
  });

  it('the wide gaussian (three box blurs) keeps a constant field and the mean', () => {
    const f = new Float64Array(64 * 64).map((_, i) => (i % 64 < 32 ? 1 : 0));
    const g = gaussian(f, 64, 64, 16);
    const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
    expect(mean(g)).toBeCloseTo(mean(f), 2);
    expect(gaussian(new Float64Array(16).fill(2), 4, 4, 8).every(v => Math.abs(v - 2) < 1e-9)).toBe(true);
  });

  it('rejects missing pixels', () => {
    expect(() => normalFromSrm(null)).toThrow();
  });
});
