// 3D kit viewer: camera math, dragging the name/numbers, and the collar lining (synthetic data, no game files).
import { zoomPan, panPerPixel, shortestYaw, DEFAULT_VIEW } from '../../components/pes/kit3d/useKitCamera.js';
import { LETTERING, decalCenter, stepsForTarget, nudgeSize, applyDraft, hitLettering } from '../../components/pes/kit3d/letteringEdit.js';
import { parseKitConfig, getKitValue } from '../../pes/kits/kitConfig.js';
import { turnCollarLining } from '../../pes/kits/kitModels.js';

const steps = {
  NameY: 8, NameSize: 10, NameStretch: 2, NameShape: 0, BackNumberY: 6, BackNumberSize: 14, BackNumberSpacing: 7,
  ChestNumberX: 20, ChestNumberY: 20, ChestNumberSize: 8, ShortsNumberX: 10, ShortsNumberY: 5, ShortsNumberSize: 8, ShortsNumberSide: 0,
};
const all = () => true;

describe('camera', () => {
  it('keeps the point under the cursor still when zooming', () => {
    const view = { ...DEFAULT_VIEW };
    expect(zoomPan(view, [0, 0], 1.5, 10, 5)).toEqual({ panX: 0, panY: 0 });
    const p = zoomPan(view, [1, 0], 1, 10, 5);
    expect(p.panX).toBeGreaterThan(0);
    expect(p.panY).toBe(0);
  });
  it('pans more per pixel when farther away', () => {
    expect(panPerPixel(10, 500)).toBeCloseTo(2 * panPerPixel(5, 500));
  });
  it('turns the short way round', () => {
    expect(shortestYaw(0.1, Math.PI * 2 - 0.1)).toBeCloseTo(-0.1);
    expect(Math.abs(shortestYaw(0, Math.PI))).toBeCloseTo(Math.PI);
  });
});

describe('dragging the name and numbers', () => {
  it('finds the step that puts the back number where it was dropped', () => {
    const target = decalCenter({ ...steps, BackNumberY: 20 }, 'back');
    expect(stepsForTarget(steps, 'back', target, all)).toEqual({ BackNumberY: 20 });
  });
  it('moves the chest number on both axes and only the keys config.txt has', () => {
    const target = decalCenter({ ...steps, ChestNumberX: 3, ChestNumberY: 25 }, 'chest');
    expect(stepsForTarget(steps, 'chest', target, all)).toEqual({ ChestNumberX: 3, ChestNumberY: 25 });
    expect(stepsForTarget(steps, 'chest', target, k => k !== 'ChestNumberX')).toEqual({ ChestNumberY: 25 });
  });
  it('never drags the shorts number to the hidden positions 30 and 31', () => {
    const out = stepsForTarget(steps, 'shorts', [5, 5], all);
    expect(out.ShortsNumberY).toBeLessThanOrEqual(29);
  });
  it('resizes inside the game range', () => {
    expect(nudgeSize(steps, 'back', 1)).toEqual({ BackNumberSize: 15 });
    expect(nudgeSize({ ...steps, BackNumberSize: 28 }, 'back', 1)).toEqual({});
    expect(nudgeSize({ ...steps, NameSize: 0 }, 'name', -1)).toEqual({});
  });
  it('previews unsaved values without touching keys config.txt does not have', () => {
    const cfg = parseKitConfig(['NameY=8 ; 0 to 39', 'BackNumberY=6'].join('\r\n'));
    const next = applyDraft(cfg, { NameY: 12, ChestNumberX: 4 });
    expect(getKitValue(next, 'NameY')).toBe('12');
    expect(next.keys.has('ChestNumberX')).toBe(false);
    expect(getKitValue(cfg, 'NameY')).toBe('8');
  });
  it('finds the element under the pointer, with a margin', () => {
    const regions = { back: { u0: 0.4, v0: 0.1, u1: 0.6, v1: 0.3 }, name: { u0: 0.4, v0: 0.32, u1: 0.6, v1: 0.36 } };
    expect(hitLettering(regions, [0.5, 0.2])).toBe('back');
    expect(hitLettering(regions, [0.5, 0.315])).not.toBeNull();
    expect(hitLettering(regions, [0.9, 0.9])).toBeNull();
    expect(hitLettering(regions, null)).toBeNull();
  });
  it('labels every element', () => {
    expect(Object.values(LETTERING).every(l => l.label && l.size)).toBe(true);
  });
});

describe('collar lining', () => {
  // A ring: outer wall facing out, inner wall facing the axis (as the collar models ship).
  const ring = () => {
    const pos = [], nrm = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, x = Math.sin(a), z = Math.cos(a);
      pos.push(x, 0, z); nrm.push(x, 0, z); // outer
      pos.push(x * 0.9, 0, z * 0.9); nrm.push(-x, 0, -z); // inner
    }
    pos.push(0, 0.2, 0); nrm.push(0, 1, 0); // top
    return { k: 'collar', m: { meshes: [{ pos: new Float32Array(pos), nrm: new Float32Array(nrm), uv: new Float32Array(), idx: new Uint16Array() }] } };
  };
  it('turns the inner wall around and leaves the outer wall and other parts alone', () => {
    const shirt = { k: 'shirt', m: { meshes: [] } };
    const [collar, same] = turnCollarLining([ring(), shirt]);
    const n = collar.m.meshes[0].nrm;
    expect([n[0], n[2]]).toEqual([0, 1]); // outer of vertex 0 unchanged
    expect(n[3 + 2]).toBeCloseTo(1); // inner now points outwards
    expect(same).toBe(shirt);
  });
});
