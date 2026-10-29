// 3D kit models for the preview: shirt, sleeves, collars, shorts and socks.
// Meshes come from the CometKIT previewer as packed by PES Editor Rebuilt (js/kitpack.js, BSD-3-Clause);
// the pack is served as public/kit3d/kitpack.bin (zlib). Part selection, normal welding and framing are
// adapted from Rebuilt js/kit3d.js (k3Pack, k3Load, K3GL.weld, k3Fit). See pes/THIRD_PARTY_NOTICES.md.
import { unzlibSync } from 'fflate';
import { PesFormatError } from '../core/errors.js';

/** Per-vertex normals averaged by position so UV seams do not show as cuts. */
function smoothNormals(pos, idx, n) {
  const nrm = new Float32Array(n * 3), acc = new Map();
  const key = i => `${pos[i * 3]},${pos[i * 3 + 1]},${pos[i * 3 + 2]}`;
  for (let k = 0; k + 2 < idx.length; k += 3) {
    const a = idx[k] * 3, b = idx[k + 1] * 3, c = idx[k + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const i of [idx[k], idx[k + 1], idx[k + 2]]) {
      const kk = key(i);
      let v = acc.get(kk);
      if (!v) acc.set(kk, (v = [0, 0, 0]));
      v[0] += nx; v[1] += ny; v[2] += nz;
    }
  }
  for (let i = 0; i < n; i++) {
    const v = acc.get(key(i)) || [0, 1, 0], l = Math.hypot(v[0], v[1], v[2]) || 1;
    nrm[i * 3] = v[0] / l; nrm[i * 3 + 1] = v[1] / l; nrm[i * 3 + 2] = v[2] / l;
  }
  return nrm;
}

/**
 * Parses the kit model pack: u32 header length, JSON header { scale, parts: [{ n, o, v, i }] }, then per part
 * v × int16[3] positions, v × uint16[2] UVs and i × uint16 indices.
 * @param {Uint8Array} compressed contents of kitpack.bin
 */
export function parseKitPack(compressed) {
  let raw;
  try { raw = unzlibSync(compressed); } catch (e) { throw new PesFormatError('KIT_PACK', `Modelos 3D dañados (${e.message}).`); }
  const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const hl = dv.getUint32(0, true);
  const hdr = JSON.parse(new TextDecoder().decode(raw.subarray(4, 4 + hl)));
  const base = 4 + hl;
  const map = new Map(hdr.parts.map(p => [p.n, p]));
  const cache = new Map();
  const copy = (o, len) => raw.buffer.slice(raw.byteOffset + o, raw.byteOffset + o + len);
  const get = name => {
    if (cache.has(name)) return cache.get(name);
    const p = map.get(name);
    if (!p) return null;
    const o = base + p.o, n = p.v;
    const q = new Int16Array(copy(o, n * 6)), uq = new Uint16Array(copy(o + n * 6, n * 4)), idx = new Uint16Array(copy(o + n * 10, p.i * 2));
    const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    for (let i = 0; i < n * 3; i++) pos[i] = q[i] * hdr.scale;
    for (let i = 0; i < n * 2; i++) uv[i] = uq[i] / 65535;
    const model = { meshes: [{ pos, nrm: smoothNormals(pos, idx, n), uv, idx, hasUV: true }] };
    cache.set(name, model);
    return model;
  };
  return { get, has: n => map.has(n), names: () => [...map.keys()] };
}

/** Mesh of one collar model exactly as numbered (no nearest fallback), for the collar picker. */
export function collarModel(pack, n) {
  return pack.get(`collar_${String(Number(n) || 0).padStart(3, '0')}`);
}

function collarName(pack, n) {
  const v = Number(n) || 0;
  for (const c of [v, v - 1, v + 1]) {
    const k = `collar_${String(c).padStart(3, '0')}`;
    if (c > 0 && pack.has(k)) return { name: k, exact: c === v };
  }
  return null;
}

/**
 * Picks the model parts of a kit from its config.txt values.
 * @param {(key: string) => string|null} value config getter
 * @param {{ sleeve?: 'short'|'long', socks?: 'long'|'middle'|'short', tuck?: 'out'|'in', captain?: boolean, goalkeeper?: boolean,
 *           collar?: number|null, undershirtOnly?: boolean }} view
 *   collar: collar model to show (resolveKitRender: Collar, WinterCollar or a previewed one); default config Collar.
 *   undershirtOnly: LongSleevesType=187, long sleeves are the undershirt under the short-sleeved shirt.
 * @returns {{ parts: {k: string, m: object}[], collar: string|null, collarExact: boolean }}
 */
export function selectKitParts(pack, value, view = {}) {
  const g = k => String(value(k) ?? '').trim();
  const tight = g('TightKit') === '1', kappa = g('ShortSleevesModel') === '2', gk = Boolean(view.goalkeeper);
  const tuck = view.tuck === 'in' ? 'in' : 'out', socks = view.socks || 'long';
  const undershirt = !gk && view.sleeve === 'long' && Boolean(view.undershirtOnly);
  const long = (view.sleeve === 'long' && !undershirt) || gk;
  const sleeve = gk ? `sleeve_gk${tight ? '_tight' : ''}` : `sleeve_${long ? 'long' : 'short'}${tight ? '_tight' : ''}${kappa ? '_kappa' : ''}`;
  const shorts = `pants_${String(Number(g('ShortsModel')) || 1).padStart(3, '0')}`;
  const col = collarName(pack, view.collar ?? g('Collar'));
  const want = [
    ['shirt', `shirt_${tuck}${tight ? '_tight' : ''}`],
    ['sleeve', sleeve + (view.captain ? '_cap' : '')],
    ['shorts', pack.has(shorts) ? shorts : 'pants_001'],
    ['socks', `socks_${socks}`],
    ['collar', col?.name],
    // Long undershirt under the short sleeve: the long-sleeve mesh, drawn in UndershirtColor without the kit
    // texture; the short sleeve is drawn in front of it (polygon offset in the renderer). The pack's
    // `arm_long` mesh is not used: it is not placed on this body (checked in the browser).
    ['undershirt', undershirt ? `sleeve_long${tight ? '_tight' : ''}${kappa ? '_kappa' : ''}` : null],
  ];
  const parts = [];
  for (const [k, n] of want) {
    const m = n && (pack.get(n) || (k === 'sleeve' ? pack.get(sleeve) : null));
    if (m) parts.push({ k, m });
  }
  // The top of the shorts hidden under the shirt (without it a gap shows between shirt and shorts).
  const sub = pack.get(tuck === 'in' ? 'pants_sub_in' : tight ? 'pants_sub_tight' : 'pants_sub_out');
  const sp = parts.find(p => p.k === 'shorts');
  if (sub && sp) sp.m = { meshes: [...sp.m.meshes, ...sub.meshes] };
  return { parts: weldNormals(parts), collar: col?.name ?? null, collarExact: Boolean(col?.exact) };
}

/** Averages normals of touching parts (shirt, sleeves, collar, shorts) so seams have no light steps. */
export function weldNormals(parts, tol = 0.003) {
  const acc = new Map();
  const key = (x, y, z) => `${Math.round(x / tol)},${Math.round(y / tol)},${Math.round(z / tol)}`;
  for (const { m } of parts) for (const me of m.meshes) {
    for (let i = 0; i < me.pos.length / 3; i++) {
      const k = key(me.pos[i * 3], me.pos[i * 3 + 1], me.pos[i * 3 + 2]);
      let v = acc.get(k);
      if (!v) acc.set(k, (v = [0, 0, 0]));
      v[0] += me.nrm[i * 3]; v[1] += me.nrm[i * 3 + 1]; v[2] += me.nrm[i * 3 + 2];
    }
  }
  return parts.map(({ k, m }) => ({
    k,
    m: {
      meshes: m.meshes.map(me => {
        const n = new Float32Array(me.nrm.length);
        for (let i = 0; i < me.pos.length / 3; i++) {
          const v = acc.get(key(me.pos[i * 3], me.pos[i * 3 + 1], me.pos[i * 3 + 2])), l = Math.hypot(v[0], v[1], v[2]) || 1;
          n[i * 3] = v[0] / l; n[i * 3 + 1] = v[1] / l; n[i * 3 + 2] = v[2] / l;
        }
        return { ...me, nrm: n };
      }),
    },
  }));
}

/**
 * Bounding box, the yaw that faces the shirt front (from the front/back UV regions) and whether the
 * texture is mirrored, so the camera starts in front of the kit.
 */
export function fitParts(parts) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  const F = [0, 0, 0, 0], B = [0, 0, 0, 0], reg = [];
  for (const { k, m } of parts) for (const me of m.meshes) {
    for (let v = 0; v < me.pos.length / 3; v++) {
      const x = me.pos[v * 3], y = me.pos[v * 3 + 1], z = me.pos[v * 3 + 2];
      mn[0] = Math.min(mn[0], x); mn[1] = Math.min(mn[1], y); mn[2] = Math.min(mn[2], z);
      mx[0] = Math.max(mx[0], x); mx[1] = Math.max(mx[1], y); mx[2] = Math.max(mx[2], z);
      if (k !== 'shirt' || !me.hasUV) continue;
      const u = me.uv[v * 2], w = me.uv[v * 2 + 1];
      if (u > 0.36 && u < 0.64 && w > 0.52 && w < 0.9) { F[0] += x; F[1] += y; F[2] += z; F[3]++; reg.push([x, z, u]); }
      else if (u > 0.36 && u < 0.64 && w > 0.04 && w < 0.44) { B[0] += x; B[1] += y; B[2] += z; B[3]++; }
    }
  }
  const center = mn.map((v, i) => (v + mx[i]) / 2);
  const radius = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) / 2 || 1;
  let fx = 0, fz = 1;
  if (F[3] && B[3]) {
    fx = F[0] / F[3] - B[0] / B[3]; fz = F[2] / F[3] - B[2] / B[3];
    const l = Math.hypot(fx, fz) || 1;
    fx /= l; fz /= l;
  }
  const a = Math.atan2(fx, fz), yaw0 = -a;
  let mirror = 1;
  if (reg.length > 20) {
    const c = Math.cos(yaw0), s = Math.sin(yaw0);
    let su = 0, sx = 0, sxu = 0;
    for (const [x, z, u] of reg) { const X = c * (x - center[0]) + s * (z - center[2]); sx += X; su += u; sxu += X * u; }
    const n = reg.length;
    if (sxu / n - (sx / n) * (su / n) < 0) mirror = -1;
  }
  return { center, radius, yaw0: mirror < 0 ? a : yaw0, mirror };
}
