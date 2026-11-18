// Display refinement of the kit meshes. Synthetic meshes prove the geometry rules (no cracks, occlusion where
// something blocks the light); the real CometKIT pack (public/kit3d/kitpack.bin, in the repo) checks it runs on
// every part of an actual kit. Neither says anything about how the game draws kits.
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseKitPack, selectKitParts, fitParts, collarModel, collarLining } from '../../pes/kits/kitModels.js';
import { subdivideMesh, buildOccluder, castRay, meshOcclusion, outsideSides, refineParts, refineCollar } from '../../pes/kits/kitRefine.js';

/** A flat n×n grid in the XZ plane (y = 0), normals up, UVs 0..1. */
function grid(n, size = 1, y = 0) {
  const pos = [], nrm = [], uv = [], idx = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    pos.push((i / n - 0.5) * size, y, (j / n - 0.5) * size); nrm.push(0, 1, 0); uv.push(i / n, j / n);
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), uv: new Float32Array(uv), idx: new Uint16Array(idx), hasUV: true };
}

describe('subdivideMesh', () => {
  it('splits each triangle in four and keeps a flat surface flat', () => {
    const g = grid(2);
    const s = subdivideMesh(g);
    expect(s.idx.length).toBe(g.idx.length * 4);
    expect(s.pos.length / 3).toBe(9 + 16); // 9 vertices + 16 edges of a 2×2 grid
    for (let i = 1; i < s.pos.length; i += 3) expect(s.pos[i]).toBeCloseTo(0, 6);
    expect(Math.max(...s.idx)).toBeLessThan(s.pos.length / 3);
    expect(g.idx.length).toBe(24); // the input is left alone
  });

  it('gives the same midpoint to two copies of an edge (UV seam), so no crack opens', () => {
    // two triangles sharing an edge through duplicated vertices with different UVs and bent normals
    const pos = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, -1, 0, 0]);
    const k = Math.SQRT1_2;
    const nrm = new Float32Array([k, 0, k, k, 0, k, k, 0, k, k, 0, k, k, 0, k, k, 0, k]);
    const uv = new Float32Array([0, 0, 1, 0, 0, 1, 0.5, 0.5, 0.5, 1, 0.2, 0.5]);
    const s = subdivideMesh({ pos, nrm, uv, idx: new Uint16Array([0, 1, 2, 3, 4, 5]), hasUV: true });
    const at = v => [...s.pos.subarray(v * 3, v * 3 + 3)];
    const mids = [];
    for (let v = 6; v < s.pos.length / 3; v++) mids.push(at(v).map(x => x.toFixed(6)).join());
    const shared = mids.filter((m, i) => mids.indexOf(m) !== i);
    expect(shared).toHaveLength(1); // the 0–2 and 3–4 edges land on one point
  });

  it('rounds a bent surface outward (Phong tessellation) instead of leaving the chord', () => {
    // edge from (−1,0,0) to (1,0,0) whose normals lean outward like a cylinder seen from above
    const k = Math.SQRT1_2;
    const pos = new Float32Array([-1, 0, 0, 1, 0, 0, 0, 0, -1]);
    const nrm = new Float32Array([-k, 0, k, k, 0, k, 0, 0, -1]);
    const s = subdivideMesh({ pos, nrm, uv: new Float32Array(6), idx: new Uint16Array([0, 1, 2]), hasUV: true });
    const mid = [...s.pos.subarray(9, 12)]; // first edge 0–1
    expect(mid[0]).toBeCloseTo(0, 6);
    expect(mid[2]).toBeGreaterThan(0.1);
  });

  it('keeps the mesh as is when the result would not fit 16-bit indices', () => {
    const g = grid(150); // 22,801 vertices → ~90,000 after one split
    expect(subdivideMesh(g)).toBe(g);
  });
});

describe('ambient occlusion', () => {
  it('casts rays against the BVH', () => {
    const occ = buildOccluder([grid(4, 2, 1)]); // plane at y = 1
    expect(castRay(occ, 0.1, 0, 0.1, 0, 1, 0, 1e-4, 10)).toBeCloseTo(1, 5);
    expect(castRay(occ, 0.1, 0, 0.1, 0, -1, 0, 1e-4, 10)).toBe(Infinity);
    expect(castRay(occ, 0.1, 0, 0.1, 0, 1, 0, 1e-4, 0.5)).toBe(Infinity); // beyond reach
  });

  it('is 1 on an open plane and lower where the outside is covered', () => {
    const floor = grid(4, 2), roof = grid(4, 4, 0.3);
    const up = new Float32Array(floor.pos.length / 3).fill(1); // outside = +N (the roof side)
    expect(Math.min(...meshOcclusion(floor, [buildOccluder([floor])], 2, 12, up))).toBeCloseTo(1, 5);
    expect(Math.max(...meshOcclusion(floor, [buildOccluder([floor, roof])], 2, 12, up))).toBeLessThan(1);
    // undecided side: the more open hemisphere wins, so a roof on one side alone does not darken it
    expect(Math.min(...meshOcclusion(floor, [buildOccluder([floor, roof])], 2))).toBeCloseTo(1, 5);
  });
});

/** An open vertical tube around (cx, 0, cz), normals pointing out (or in). */
function tube(cx, cz, { inward = false, r = 0.1, segs = 12, rings = 4 } = {}) {
  const pos = [], nrm = [];
  for (let j = 0; j <= rings; j++) for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2, s = inward ? -1 : 1;
    pos.push(cx + Math.cos(a) * r, j / rings, cz + Math.sin(a) * r);
    nrm.push(Math.cos(a) * s, 0, Math.sin(a) * s);
  }
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm) };
}

describe('outside of a garment', () => {
  it('faces away from the torso axis, whatever way the normals point', () => {
    expect(outsideSides('shirt', tube(0, 0)).every(s => s === 1)).toBe(true);
    expect(outsideSides('shirt', tube(0, 0, { inward: true })).every(s => s === -1)).toBe(true);
  });

  it('uses the axis of each leg for socks, not the middle of the body', () => {
    const left = tube(-0.15, 0), right = tube(0.15, 0);
    const both = { pos: new Float32Array([...left.pos, ...right.pos]), nrm: new Float32Array([...left.nrm, ...right.nrm]) };
    // with one axis in the middle, the inner side of each leg would count as the inside
    expect(outsideSides('socks', both).every(s => s === 1)).toBe(true);
  });
});

describe('refined kit parts (real CometKIT pack)', () => {
  let pack;
  beforeAll(() => { pack = parseKitPack(new Uint8Array(fs.readFileSync(path.resolve(__dirname, '../../public/kit3d/kitpack.bin')))); });

  it('subdivides every part, collars twice, and bakes occlusion in 0..1', () => {
    const sel = selectKitParts(pack, k => ({ Collar: '34' })[k], { turnLining: false });
    const refined = refineParts(sel.parts, fitParts(sel.parts).radius);
    expect(refined.map(p => p.k)).toEqual(sel.parts.map(p => p.k));
    for (const [i, p] of refined.entries()) {
      const before = sel.parts[i].m.meshes[0], after = p.m.meshes[0];
      expect(after.idx.length, p.k).toBe(before.idx.length * (p.k === 'collar' ? 16 : 4));
      expect(after.ao.length).toBe(after.pos.length / 3);
      expect(after.ao.every(a => a >= 0 && a <= 1)).toBe(true);
      expect(after.outside.length).toBe(after.ao.length);
      expect(Math.max(...after.idx)).toBeLessThan(after.pos.length / 3);
    }
    // the collar sits in a crease against the shirt: some of it must be shaded
    expect(Math.min(...refined.find(p => p.k === 'collar').m.meshes[0].ao)).toBeLessThan(0.5);
  });

  it('gives the same geometry key for the same parts and a different one when a part changes', () => {
    const v = k => ({ Collar: '34' })[k];
    expect(selectKitParts(pack, v, {}).key).toBe(selectKitParts(pack, v, {}).key);
    expect(selectKitParts(pack, v, {}).key).not.toBe(selectKitParts(pack, v, { socks: 'short' }).key);
    expect(selectKitParts(pack, v, {}).key).not.toBe(selectKitParts(pack, v, { collar: 35 }).key);
  });

  it('marks the collar lining as the inside instead of turning its normals', () => {
    const v = k => ({ Collar: '34' })[k];
    const kept = selectKitParts(pack, v, { turnLining: false }).parts.find(p => p.k === 'collar').m.meshes[0];
    const turned = selectKitParts(pack, v, {}).parts.find(p => p.k === 'collar').m.meshes[0];
    const [lining] = collarLining([kept]);
    const sides = outsideSides('collar', kept, lining);
    expect(lining.some(Boolean)).toBe(true); // the model has a lining
    expect(lining.some(x => !x)).toBe(true); // and an outer face
    for (let i = 0; i < sides.length; i++) {
      expect(sides[i]).toBe(lining[i] ? -1 : 1);
      // the default (unrefined) path turns exactly those normals around
      expect(Math.sign(turned.nrm[i * 3 + 1])).toBe(lining[i] ? -Math.sign(kept.nrm[i * 3 + 1]) : Math.sign(kept.nrm[i * 3 + 1]));
    }
  });

  it('refines a picker collar against the shirt', () => {
    const sel = selectKitParts(pack, () => null, {});
    const base = sel.parts.filter(p => p.k === 'shirt' || p.k === 'sleeve');
    const radius = fitParts(sel.parts).radius;
    const collar = refineCollar({ k: 'collar', m: collarModel(pack, 10) }, buildOccluder(base.flatMap(p => p.m.meshes)), radius);
    expect(collar.k).toBe('collar');
    expect(collar.m.meshes[0].ao.length).toBe(collar.m.meshes[0].pos.length / 3);
  });
});
