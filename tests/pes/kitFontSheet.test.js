// Glyph sheets generated from a user font (renderFontSheet), with a recording 2D context (synthetic metrics).
import { renderFontSheet, glyphCell } from '../../pes/kits/kitFonts.js';

// "1": a narrow glyph whose ink (14 to 36) sits left of the middle of its 56-wide advance.
const METRICS = { 0: { L: -4, R: 52, w: 56 }, 1: { L: -14, R: 36, w: 56 } };
function fakeCtx(W, H) {
  const calls = [];
  let cur = {};
  const ctx = {
    canvas: { width: W, height: H },
    clearRect() {}, save() { cur = {}; }, restore() { calls.push(cur); },
    translate(x, y) { cur.tx = x; cur.ty = y; }, scale(sx, sy) { cur.sx = sx; cur.sy = sy; },
    measureText(ch) {
      const m = METRICS[ch] || METRICS[0];
      return { width: m.w, actualBoundingBoxLeft: m.L, actualBoundingBoxRight: m.R, actualBoundingBoxAscent: 72, actualBoundingBoxDescent: 0 };
    },
    fillText(ch, x) { cur.ch = ch; cur.x = x; }, strokeText() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  };
  return { ctx, calls };
}

describe('renderFontSheet (numbers)', () => {
  it('draws digits at 92 % of the cell height', () => {
    const { ctx, calls } = fakeCtx(2048, 256);
    renderFontSheet(ctx, 'back', { family: 'X', fill: '#fff' });
    const zero = calls.find(c => c.ch === '0');
    expect(zero.sy * 72).toBeCloseTo(256 * 0.92, 0);
  });
  it('centres a digit on its advance, so the stem of a flagged «1» sits in the middle', () => {
    const { ctx, calls } = fakeCtx(2048, 256);
    renderFontSheet(ctx, 'back', { family: 'X', fill: '#fff' });
    const one = calls.find(c => c.ch === '1');
    expect(one.x).toBeCloseTo(-28); // −advance/2, not the ink centre −(R−L)/2 = −25
    const [x, , w] = glyphCell('back', '1', 2048, 256);
    expect(one.tx).toBeCloseTo(x + w / 2);
  });
  it('applies a hand correction to one character only', () => {
    const { ctx, calls } = fakeCtx(2048, 256);
    renderFontSheet(ctx, 'back', { family: 'X', fill: '#fff', adjust: { 1: { x: -0.05, y: 0.02, size: 0.9 } } });
    const [x, y, w, h] = glyphCell('back', '1', 2048, 256);
    const one = calls.find(c => c.ch === '1'), two = calls.find(c => c.ch === '2');
    expect(one.tx).toBeCloseTo(x + w / 2 - 0.05 * w);
    expect(one.ty).toBeCloseTo(y + h / 2 + 0.02 * h);
    expect(one.sy * 72).toBeCloseTo(256 * 0.92 * 0.9, 0);
    const [x2, , w2] = glyphCell('back', '2', 2048, 256);
    expect(two.tx).toBeCloseTo(x2 + w2 / 2);
  });
});
