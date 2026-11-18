// Display quality of the 3D kit models: the pack's meshes are low-poly (a shirt is ~2,300 triangles), so they are
// subdivided with Phong tessellation (Boubekeur & Alexa 2008) for round silhouettes, and get baked ambient
// occlusion so collars, armpits and hems read as shapes instead of flat colour.
import { weldNormals, collarLining } from './kitModels.js';

const MAX_VERTICES = 65535; // indices stay Uint16 (WebGL1 without OES_element_index_uint)
const PHONG_ALPHA = 0.6;    // 0 = flat midpoints, 0.75 = the paper's value; lower keeps folded collars crisp
const AO_RAYS = 12;         // per hemisphere
const SIDE_MIN_COS = 0.25;  // normals closer than this to the body axis direction are left undecided
const THUMB_AO_RAYS = 8;    // collar picker thumbnails: drawn one per frame, they must stay cheap
const AO_REACH = 0.5;       // ray length, in kit radii: long enough to cross the torso from inside

/**
 * Splits every triangle into four. A new vertex sits on the edge midpoint pulled toward the tangent planes of the
 * edge's two vertices, so it is computed from positions and normals only: two parts sharing an edge, or two
 * vertices duplicated at a UV seam, get the same midpoint and no crack opens.
 * @param {{ pos: Float32Array, nrm: Float32Array, uv: Float32Array, idx: Uint16Array, ao?: Float32Array }} me
 * @returns {object} a new mesh (the input is not modified); the input itself when the result would not fit Uint16
 */
export function subdivideMesh(me, alpha = PHONG_ALPHA) {
  const n0 = me.pos.length / 3;
  const edges = new Map();
  for (let k = 0; k < me.idx.length; k += 3) {
    for (const [a, b] of [[me.idx[k], me.idx[k + 1]], [me.idx[k + 1], me.idx[k + 2]], [me.idx[k + 2], me.idx[k]]]) {
      const key = a < b ? a * 65536 + b : b * 65536 + a;
      if (!edges.has(key)) edges.set(key, n0 + edges.size);
    }
  }
  const n = n0 + edges.size;
  if (n > MAX_VERTICES) return me;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  const ao = me.ao ? new Float32Array(n) : null, outside = me.outside ? new Float32Array(n) : null;
  pos.set(me.pos); nrm.set(me.nrm); uv.set(me.uv); if (ao) ao.set(me.ao); if (outside) outside.set(me.outside);
  for (const [key, v] of edges) {
    const a = Math.floor(key / 65536), b = key % 65536;
    const q = [0, 1, 2].map(i => (me.pos[a * 3 + i] + me.pos[b * 3 + i]) / 2);
    const project = s => {
      const p = [me.pos[s * 3], me.pos[s * 3 + 1], me.pos[s * 3 + 2]], nn = [me.nrm[s * 3], me.nrm[s * 3 + 1], me.nrm[s * 3 + 2]];
      const d = (q[0] - p[0]) * nn[0] + (q[1] - p[1]) * nn[1] + (q[2] - p[2]) * nn[2];
      return q.map((x, i) => x - d * nn[i]);
    };
    const pa = project(a), pb = project(b);
    let nl = 0;
    for (let i = 0; i < 3; i++) {
      pos[v * 3 + i] = (1 - alpha) * q[i] + alpha * (pa[i] + pb[i]) / 2;
      nrm[v * 3 + i] = me.nrm[a * 3 + i] + me.nrm[b * 3 + i];
      nl += nrm[v * 3 + i] ** 2;
    }
    nl = Math.sqrt(nl) || 1;
    for (let i = 0; i < 3; i++) nrm[v * 3 + i] /= nl;
    uv[v * 2] = (me.uv[a * 2] + me.uv[b * 2]) / 2;
    uv[v * 2 + 1] = (me.uv[a * 2 + 1] + me.uv[b * 2 + 1]) / 2;
    if (ao) ao[v] = (me.ao[a] + me.ao[b]) / 2;
    if (outside) outside[v] = (me.outside[a] + me.outside[b]) / 2;
  }
  const mid = (a, b) => edges.get(a < b ? a * 65536 + b : b * 65536 + a);
  const idx = new Uint16Array(me.idx.length * 4);
  let o = 0;
  for (let k = 0; k < me.idx.length; k += 3) {
    const a = me.idx[k], b = me.idx[k + 1], c = me.idx[k + 2], ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
    idx.set([a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca], o);
    o += 12;
  }
  return { ...me, pos, nrm, uv, idx, ...(ao ? { ao } : {}), ...(outside ? { outside } : {}) };
}

/** Bounding volume hierarchy over the triangles of some meshes, for occlusion rays. */
export function buildOccluder(meshes) {
  let count = 0;
  for (const me of meshes) count += me.idx.length / 3;
  const tri = new Float32Array(count * 9), cen = new Float32Array(count * 3);
  let t = 0;
  for (const me of meshes) {
    for (let k = 0; k < me.idx.length; k += 3, t++) {
      for (let j = 0; j < 3; j++) {
        const s = me.idx[k + j] * 3;
        for (let i = 0; i < 3; i++) { tri[t * 9 + j * 3 + i] = me.pos[s + i]; cen[t * 3 + i] += me.pos[s + i] / 3; }
      }
    }
  }
  const order = new Uint32Array(count).map((_, i) => i);
  const nodes = []; // [minX, minY, minZ, maxX, maxY, maxZ, left|start, right|-count]
  const build = (start, end) => {
    const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let i = start; i < end; i++) {
      const b = order[i] * 9;
      for (let v = 0; v < 9; v += 3) for (let a = 0; a < 3; a++) {
        box[a] = Math.min(box[a], tri[b + v + a]); box[a + 3] = Math.max(box[a + 3], tri[b + v + a]);
      }
    }
    const id = nodes.length;
    nodes.push(null);
    if (end - start <= 4) { nodes[id] = [...box, start, -(end - start)]; return id; }
    const ext = [box[3] - box[0], box[4] - box[1], box[5] - box[2]];
    const axis = ext[0] > ext[1] ? (ext[0] > ext[2] ? 0 : 2) : (ext[1] > ext[2] ? 1 : 2);
    const part = order.subarray(start, end).sort((x, y) => cen[x * 3 + axis] - cen[y * 3 + axis]);
    order.set(part, start);
    const half = (start + end) >> 1;
    const left = build(start, half), right = build(half, end);
    nodes[id] = [...box, left, right];
    return id;
  };
  if (count) build(0, count);
  const box = new Float32Array(nodes.length * 6), link = new Int32Array(nodes.length * 2);
  nodes.forEach((nd, i) => { box.set(nd.slice(0, 6), i * 6); link[i * 2] = nd[6]; link[i * 2 + 1] = nd[7]; });
  // triangles stored in BVH order as vertex 0 + two edges, ready for the intersection test
  const ord = new Float32Array(count * 9);
  for (let i = 0; i < count; i++) {
    const b = order[i] * 9, o = i * 9;
    for (let a = 0; a < 3; a++) {
      ord[o + a] = tri[b + a];
      ord[o + 3 + a] = tri[b + 3 + a] - tri[b + a];
      ord[o + 6 + a] = tri[b + 6 + a] - tri[b + a];
    }
  }
  return { tri: ord, box, link, size: nodes.length };
}

const STACK = new Int32Array(256);

/** Distance to the nearest triangle of an occluder along a ray, or Infinity (Möller–Trumbore in a BVH walk). */
export function castRay(occ, ox, oy, oz, dx, dy, dz, tMin, tMax) {
  const { tri, box, link, size } = occ;
  if (!size) return Infinity;
  let best = tMax, sp = 0;
  const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
  STACK[sp++] = 0;
  while (sp) {
    const nd = STACK[--sp], b6 = nd * 6;
    let ta = (box[b6] - ox) * ix, tb = (box[b6 + 3] - ox) * ix;
    let t0 = Math.max(tMin, Math.min(ta, tb)), t1 = Math.min(best, Math.max(ta, tb));
    ta = (box[b6 + 1] - oy) * iy; tb = (box[b6 + 4] - oy) * iy;
    t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb));
    ta = (box[b6 + 2] - oz) * iz; tb = (box[b6 + 5] - oz) * iz;
    t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb));
    if (t0 > t1) continue;
    const l = link[nd * 2], r = link[nd * 2 + 1];
    if (r > 0) { STACK[sp++] = l; STACK[sp++] = r; continue; } // inner node (a leaf stores -count)
    for (let i = l, end = l - r; i < end; i++) {
      const o = i * 9;
      const e1x = tri[o + 3], e1y = tri[o + 4], e1z = tri[o + 5], e2x = tri[o + 6], e2y = tri[o + 7], e2z = tri[o + 8];
      const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
      const det = e1x * px + e1y * py + e1z * pz;
      if (det > -1e-12 && det < 1e-12) continue;
      const id = 1 / det, sx = ox - tri[o], sy = oy - tri[o + 1], sz = oz - tri[o + 2];
      const u = (sx * px + sy * py + sz * pz) * id;
      if (u < 0 || u > 1) continue;
      const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
      const v = (dx * qx + dy * qy + dz * qz) * id;
      if (v < 0 || u + v > 1) continue;
      const t = (e2x * qx + e2y * qy + e2z * qz) * id;
      if (t > tMin && t < best) best = t;
    }
  }
  return best < tMax ? best : Infinity;
}

/** Cosine-weighted directions around +Z (Fibonacci spiral), reused for every vertex. */
function hemisphere(count) {
  return Array.from({ length: count }, (_, i) => {
    const r = Math.sqrt((i + 0.5) / count), phi = i * 2.399963229728653;
    return [r * Math.cos(phi), r * Math.sin(phi), Math.sqrt(Math.max(0, 1 - r * r))];
  });
}
const HEMISPHERES = new Map();

/** Principal axis (unit vector) of a point cloud, by power iteration on its covariance. */
function principalAxis(points, c) {
  const C = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const p of points) {
    const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i * 3 + j] += d[i] * d[j];
  }
  let a = [0.3, 1, 0.2];
  for (let it = 0; it < 32; it++) {
    const b = [0, 1, 2].map(i => C[i * 3] * a[0] + C[i * 3 + 1] * a[1] + C[i * 3 + 2] * a[2]);
    const l = Math.hypot(...b) || 1;
    a = b.map(x => x / l);
  }
  return a;
}

const centroid = pts => pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length, s[2] + p[2] / pts.length], [0, 0, 0]);
const UP = [0, 1, 0];

/**
 * Which side of each vertex is the outside of the garment: +1 the side its normal points to, −1 the other one,
 * 0 undecided. Decided by shape, not by rays (near an opening a ray from the inside escapes to the sky): the
 * outside faces away from the body axis — the vertical torso axis for the shirt, and for sleeves, shorts and socks
 * the axis of each arm or leg (the mesh is split left/right across its widest horizontal spread). A collar is
 * decided everywhere from its lining (kitModels.collarLining): the lining's normal points inside, the rest outside.
 * @param {string} k part kind (selectKitParts)
 * @param {{ pos: Float32Array, nrm: Float32Array }} me
 * @param {Uint8Array} [lining] collar only: collarLining mask of this mesh, computed over the whole collar
 * @returns {Float32Array}
 */
export function outsideSides(k, me, lining = null) {
  const n = me.pos.length / 3, out = new Float32Array(n);
  if (k === 'collar') {
    const mask = lining || collarLining([me])[0];
    for (let v = 0; v < n; v++) out[v] = mask[v] ? -1 : 1;
    return out;
  }
  const pts = Array.from({ length: n }, (_, v) => [me.pos[v * 3], me.pos[v * 3 + 1], me.pos[v * 3 + 2]]);
  if (!n) return out;
  const c = centroid(pts);
  let groups;
  if (k === 'shirt') groups = [{ members: pts.map((_, v) => v), c, axis: UP }];
  else {
    // widest horizontal direction: PCA of the points flattened onto the floor
    const h = principalAxis(pts.map(p => [p[0], 0, p[2]]), [c[0], 0, c[2]]);
    const halves = [[], []];
    pts.forEach((p, v) => halves[(p[0] - c[0]) * h[0] + (p[2] - c[2]) * h[2] < 0 ? 0 : 1].push(v));
    groups = halves.filter(m => m.length).map(members => {
      const sub = members.map(v => pts[v]), cc = centroid(sub);
      return { members, c: cc, axis: k === 'shorts' ? UP : principalAxis(sub, cc) };
    });
  }
  for (const { members, c: gc, axis } of groups) {
    for (const v of members) {
      const d = [pts[v][0] - gc[0], pts[v][1] - gc[1], pts[v][2] - gc[2]];
      const along = d[0] * axis[0] + d[1] * axis[1] + d[2] * axis[2];
      const r = [d[0] - along * axis[0], d[1] - along * axis[1], d[2] - along * axis[2]];
      const rl = Math.hypot(...r);
      if (!rl) continue;
      const cos = (r[0] * me.nrm[v * 3] + r[1] * me.nrm[v * 3 + 1] + r[2] * me.nrm[v * 3 + 2]) / rl;
      out[v] = cos > SIDE_MIN_COS ? 1 : cos < -SIDE_MIN_COS ? -1 : 0;
    }
  }
  return out;
}

const nearest = (occluders, ox, oy, oz, dx, dy, dz, tMin, tMax) => {
  let t = Infinity;
  for (const occ of occluders) t = Math.min(t, castRay(occ, ox, oy, oz, dx, dy, dz, tMin, tMax));
  return t;
};

/**
 * Ambient occlusion of each vertex of a mesh, 0 (enclosed) to 1 (open), sampled on the outside of the garment
 * (outsideSides). Where the outside is undecided both hemispheres are sampled and the more open one is kept:
 * garments are single surfaces seen from both sides and some meshes have inward normals.
 * @param {object} me mesh with pos/nrm
 * @param {object[]} occluders from buildOccluder
 * @param {number} radius kit radius (fitParts), sets the ray length and the self-hit offset
 * @param {number} [rays] samples per hemisphere
 * @param {Float32Array} [sides] outsideSides of the mesh; omitted = undecided everywhere
 * @returns {Float32Array}
 */
export function meshOcclusion(me, occluders, radius, rays = AO_RAYS, sides = null) {
  if (!HEMISPHERES.has(rays)) HEMISPHERES.set(rays, hemisphere(rays));
  const H = HEMISPHERES.get(rays);
  const n = me.pos.length / 3, out = new Float32Array(n), reach = radius * AO_REACH, eps = radius * 0.004;
  const seen = new Map();
  for (let v = 0; v < n; v++) {
    const px = me.pos[v * 3], py = me.pos[v * 3 + 1], pz = me.pos[v * 3 + 2];
    const nx = me.nrm[v * 3], ny = me.nrm[v * 3 + 1], nz = me.nrm[v * 3 + 2];
    const known = sides ? sides[v] : 0;
    const key = `${px},${py},${pz}|${nx.toFixed(3)},${ny.toFixed(3)},${nz.toFixed(3)}|${known}`;
    if (seen.has(key)) { out[v] = seen.get(key); continue; }
    let tx = 0, ty = -nz, tz = ny;
    if (Math.abs(nx) >= 0.9) { tx = nz; ty = 0; tz = -nx; }
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl; ty /= tl; tz /= tl;
    const bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx;
    let best = 0;
    for (const side of known ? [known] : [1, -1]) {
      const ox = px + nx * eps * side, oy = py + ny * eps * side, oz = pz + nz * eps * side;
      let sum = 0;
      for (const h of H) {
        const t = nearest(occluders, ox, oy, oz,
          tx * h[0] + bx * h[1] + nx * h[2] * side, ty * h[0] + by * h[1] + ny * h[2] * side, tz * h[0] + bz * h[1] + nz * h[2] * side, eps, reach);
        sum += t === Infinity ? 1 : t / reach;
      }
      best = Math.max(best, sum / H.length);
    }
    out[v] = best;
    seen.set(key, best);
  }
  return out;
}

const withAO = (parts, occluders, radius, rays) => parts.map(({ k, m }) => {
  const linings = k === 'collar' ? collarLining(m.meshes) : [];
  return {
    k,
    m: {
      meshes: m.meshes.map((me, j) => {
        const outside = outsideSides(k, me, linings[j]);
        return { ...me, outside, ao: meshOcclusion(me, occluders, radius, rays, outside) };
      }),
    },
  };
});

const levelsOf = k => (k === 'collar' ? 2 : 1); // collars are small: an extra level keeps their folds round

const subdivideParts = parts => parts.map(({ k, m }) => {
  let meshes = m.meshes;
  for (let l = 0; l < levelsOf(k); l++) meshes = meshes.map(me => subdivideMesh(me));
  return { k, m: { meshes } };
});

/**
 * Display version of the selected kit parts: occlusion baked on the original meshes (cheap), then subdivided,
 * then normals welded again across parts.
 * @param {{k: string, m: object}[]} parts from selectKitParts with turnLining: false (continuous normals)
 * @param {number} radius from fitParts
 */
export function refineParts(parts, radius) {
  const occluders = [buildOccluder(parts.flatMap(p => p.m.meshes))];
  return weldNormals(subdivideParts(withAO(parts, occluders, radius)));
}

/**
 * Refines one collar for the collar picker against an already refined base: occlusion from the base (shared
 * occluder, built once by the caller) and from the collar itself.
 * @param {{k: 'collar', m: object}} collar raw collar part
 * @param {object} baseOccluder buildOccluder of the base meshes
 */
export function refineCollar(collar, baseOccluder, radius) {
  const occluders = [baseOccluder, buildOccluder(collar.m.meshes)];
  return subdivideParts(withAO([collar], occluders, radius, THUMB_AO_RAYS))[0];
}
