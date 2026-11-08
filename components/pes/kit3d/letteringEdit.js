// Moving and resizing the name and numbers by dragging them on the 3D kit. The pointer gives a kit texture
// coordinate (KitGL.pick); the config.txt steps that put the element's centre closest to where it was dragged are
// found by trying every step with the game's own layout (decalLayout), so the result is always a value the game
// accepts and lands where the preview shows it.
import { decalLayout, GAME_STEPS } from '../../../pes/kits/kitDecalFormulas.js';
import { setKitValue } from '../../../pes/kits/kitConfig.js';

/** config.txt keys of each element: x/y move it (null = fixed on that axis), size scales it. */
export const LETTERING = {
  name: { label: 'Nombre', x: null, y: 'NameY', size: 'NameSize' },
  back: { label: 'Número de la espalda', x: null, y: 'BackNumberY', size: 'BackNumberSize' },
  chest: { label: 'Número del pecho', x: 'ChestNumberX', y: 'ChestNumberY', size: 'ChestNumberSize' },
  shorts: { label: 'Número del short', x: 'ShortsNumberX', y: 'ShortsNumberY', size: 'ShortsNumberSize' },
};

// ShortsNumberY 30 and 31 hide the number (kserv.lua): dragging never goes there.
const maxStep = key => (key === 'ShortsNumberY' ? 29 : GAME_STEPS[key]?.max ?? 0);

/** Texture-space centre (u, v) of an element for a set of steps. */
export function decalCenter(steps, group) {
  const L = decalLayout(steps);
  if (group === 'name') return [0.5, L.name.v];
  if (group === 'back') return [0.5, L.back.v];
  if (group === 'chest') return [L.chest.u, L.chest.v];
  return [L.shorts.u, L.shorts.v];
}

/** Steps the preview draws with, from resolveKitRender().values. */
export function stepsOf(render) {
  return Object.fromEntries(Object.entries(render.values).map(([k, v]) => [k, v.used]));
}

/**
 * Steps that move `group` so its centre is closest to `target` (u, v). Only keys present in config.txt move
 * (`canEdit(key)`); the others keep their value.
 * @returns {Record<string, number>} the value of every axis that can move (unchanged ones included)
 */
export function stepsForTarget(steps, group, target, canEdit) {
  const { x, y } = LETTERING[group];
  const xs = x && canEdit(x) ? range(maxStep(x)) : [steps[x]];
  const ys = y && canEdit(y) ? range(maxStep(y)) : [steps[y]];
  let best = null;
  for (const sx of xs) for (const sy of ys) {
    const trial = { ...steps };
    if (x) trial[x] = sx;
    if (y) trial[y] = sy;
    const [u, v] = decalCenter(trial, group);
    const d = (u - target[0]) ** 2 + (v - target[1]) ** 2;
    if (!best || d < best.d - 1e-12) best = { d, sx, sy };
  }
  const out = {};
  if (x && canEdit(x)) out[x] = best.sx;
  if (y && canEdit(y)) out[y] = best.sy;
  return out;
}

const range = n => Array.from({ length: n + 1 }, (_, i) => i);

/** Size step one notch bigger (+1) or smaller (−1), inside the game's range. */
export function nudgeSize(steps, group, dir) {
  const key = LETTERING[group].size;
  const next = Math.max(0, Math.min(maxStep(key), (steps[key] ?? 0) + dir));
  return next === steps[key] ? {} : { [key]: next };
}

/** Config with the unsaved lettering values applied (keys missing from config.txt are skipped). */
export function applyDraft(cfg, draft) {
  let next = cfg;
  for (const [key, value] of Object.entries(draft)) {
    if (!next?.keys.has(key)) continue;
    try { next = setKitValue(next, key, String(value)).cfg; } catch { /* out of the line's range: keep the saved value */ }
  }
  return next;
}

/** Element under a texture coordinate, with a small margin so thin digits are easy to grab. */
export function hitLettering(regions, uv, margin = 0.012) {
  if (!uv) return null;
  const [u, v] = uv;
  for (const group of ['chest', 'shorts', 'back', 'name']) {
    const r = regions?.[group];
    if (r && u >= r.u0 - margin && u <= r.u1 + margin && v >= r.v0 - margin && v <= r.v1 + margin) return group;
  }
  return null;
}
