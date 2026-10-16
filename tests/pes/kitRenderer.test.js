// WebGL lifecycle of the kit renderer against a recording fake context (synthetic: proves the call sequence,
// not pixels). Covers the failure path seen in production: a lost context or failed shader made KitGL.make
// throw inside a React effect, and deleted mesh buffers left enabled broke the next background draw.
import { describe, it, expect } from 'vitest';
import { KitGL } from '../../components/pes/kit3d/kitRenderer.js';

/** Fake WebGL1 context: records calls, tracks enabled attribute arrays and deleted objects. */
function fakeGL({ lost = false, compileOk = true } = {}) {
  const calls = [];
  const enabled = new Set();
  const deleted = new Set();
  let id = 0;
  const state = { lost };
  const gl = new Proxy({
    canvas: { width: 300, height: 400 },
    isContextLost: () => state.lost,
    getExtension: () => null,
    getShaderParameter: () => compileOk,
    getProgramParameter: () => true,
    getShaderInfoLog: () => null,
    getAttribLocation: (_p, n) => ({ p: 0, n: 1, t: 2, q: 0 }[n] ?? -1),
    getUniformLocation: (_p, n) => ({ n }),
    createShader: () => ({ id: ++id }), createProgram: () => ({ id: ++id }), createBuffer: () => ({ id: ++id }), createTexture: () => ({ id: ++id }),
    enableVertexAttribArray: at => { enabled.add(at); calls.push(['enable', at]); },
    disableVertexAttribArray: at => { enabled.delete(at); calls.push(['disable', at]); },
    deleteBuffer: b => deleted.add(b), deleteTexture: t => deleted.add(t), deleteProgram: p => deleted.add(p),
    drawArrays: () => calls.push(['drawArrays', [...enabled]]),
    drawElements: () => calls.push(['drawElements', [...enabled]]),
  }, { get: (t, k) => (k in t ? t[k] : (typeof k === 'string' && /^[A-Z_0-9]+$/.test(k) ? k : () => {})) });
  return { canvas: { getContext: () => gl, width: 300, height: 400 }, gl, calls, enabled, deleted, state };
}

const MESH = { k: 'shirt', m: { meshes: [{ pos: new Float32Array(9), nrm: new Float32Array(9), uv: new Float32Array(6), idx: new Uint16Array([0, 1, 2]), hasUV: true }] } };
const LIGHT = { key: [0, 30, 1, '#ffffff'], fill: [0, 30, 1, '#ffffff'], rim: [0, 30, 1, '#ffffff'], amb: 0.5, exp: 1, spec: 1, envInt: 1, envYaw: 0, envMix: 1, sh: null };
const scene = { fit: { center: [0, 0, 0], radius: 1, mirror: 1, yaw0: 0 }, yaw: 0, pitch: 0, bg: true, L: LIGHT, textured: new Set(['shirt']), colors: {} };

describe('KitGL lifecycle', () => {
  it('make() returns null instead of throwing on a lost context or a failed shader', () => {
    expect(KitGL.make(fakeGL({ lost: true }).canvas)).toBeNull();
    expect(KitGL.make(fakeGL({ compileOk: false }).canvas)).toBeNull();
    expect(KitGL.make({ getContext: () => null })).toBeNull();
    expect(KitGL.make(fakeGL().canvas)).not.toBeNull();
  });

  it('draw() leaves no vertex attribute enabled, so the next background pass never reads a deleted buffer', () => {
    const f = fakeGL();
    const R = KitGL.make(f.canvas);
    KitGL.upload(R, [MESH]);
    R.tx[4] = { id: 'env' }; // environment present → background pass with drawArrays
    KitGL.draw(R, scene);
    expect(f.enabled.size).toBe(0);
    KitGL.upload(R, [MESH]); // deletes the previous mesh buffers
    KitGL.draw(R, scene);
    const bg = f.calls.filter(c => c[0] === 'drawArrays');
    expect(bg).toHaveLength(2);
    expect(bg[1][1]).toEqual([0]); // only the quad attribute during the background pass
  });

  it('skips work on a lost context and frees everything on dispose without losing the context', () => {
    const f = fakeGL();
    const R = KitGL.make(f.canvas);
    KitGL.upload(R, [MESH]);
    f.state.lost = true;
    expect(KitGL.draw(R, scene)).toBeNull();
    expect(() => KitGL.upload(R, [MESH])).not.toThrow();
    f.state.lost = false;
    const buffers = R.bufs.flatMap(b => [b.p, b.n, b.t, b.i]);
    KitGL.dispose(R);
    expect(buffers.every(b => f.deleted.has(b))).toBe(true);
    expect(R.bufs).toEqual([]);
    expect(KitGL.make(f.canvas)).not.toBeNull(); // remount on the same canvas works
  });
});
