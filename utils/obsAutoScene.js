// What the OBS overlay shows after an automatic «Final» (match-feed sets scene 'final' with autoFinalAt), and which
// real OBS scene goes with each overlay scene for the remote control source (?control=obs). Pure; tests/obsAutoScene.test.js.

import { AUTO_TABLE_AFTER_MS } from '../supabase/functions/_shared/overlayControl.js';
import { POPUP_PRESETS } from './overlayPopup.js';
import { MATCH_SCENES } from './obsScenes.js';

export const BETWEEN_MATCHES_POPUP_SECONDS = 30;

/** Default names of the OBS scenes the control source switches to; the admin can rename them (overlay.obsScenes). */
export const DEFAULT_OBS_SCENE_NAMES = {
  partido: 'SCL Partido',
  partidos: 'SCL Fecha',
  tabla: 'SCL Tabla',
  bracket: 'SCL Copa de Oro',
  repechaje: 'SCL Copa de Plata',
  goleadores: 'SCL Goleadores',
  jugador1: 'SCL Jugador 1',
  jugador2: 'SCL Jugador 2',
  relator: 'SCL Relator',
};

// Cameras: «Jugador 1» is the home side of the game match, «Jugador 2» the away side.
export const CAMERA_TOUR_STEP_MS = 12_000;
// Final goes through the cameras once, then stays on the commentator. The Previa tour and the scorer's camera after
// a goal were removed on 2026-11-26 (the user switches those by hand).
const CAMERA_TOUR = ['jugador1', 'jugador2', 'relator'];
const TOUR_SCENES = new Set(['final']);

/**
 * The camera of the Final tour at `elapsed` ms since the scene went on air, or null for scenes without one.
 * One pass, 12 s each, ending on the commentator.
 */
export function tourCamera(scene, elapsed) {
  if (!TOUR_SCENES.has(scene)) return null;
  const step = Math.max(0, Math.floor(elapsed / CAMERA_TOUR_STEP_MS));
  return CAMERA_TOUR[Math.min(step, CAMERA_TOUR.length - 1)];
}

/** True while an automatic «Final» has been on for long enough: the overlay moves to the table. */
export function autoTableActive(overlay, now) {
  return overlay?.scene === 'final' && overlay?.autoScenes !== false && Number.isFinite(overlay?.autoFinalAt)
    && now - overlay.autoFinalAt >= AUTO_TABLE_AFTER_MS;
}

/**
 * The overlay doc as the pages should draw it now: the table two minutes after an automatic final, with the QR popup
 * once when it switches (between matches), unless the admin turned automatic popups off.
 */
export function effectiveOverlay(overlay, now, siteUrl) {
  if (!overlay || !autoTableActive(overlay, now)) return overlay;
  const switchedAt = overlay.autoFinalAt + AUTO_TABLE_AFTER_MS;
  const next = { ...overlay, scene: 'tabla' };
  const shownLater = Number(overlay.popup?.shownAt) > switchedAt;
  if (overlay.autoPopup !== false && !shownLater) {
    const preset = POPUP_PRESETS.find(item => item.id === 'vota');
    next.popup = {
      visible: true,
      title: preset.title,
      text: preset.text,
      url: new URL(preset.path, siteUrl).href,
      position: overlay.popup?.position || 'right',
      autoHideSec: BETWEEN_MATCHES_POPUP_SECONDS,
      shownAt: switchedAt,
    };
  }
  return next;
}

/** Name of the OBS scene for an overlay scene: the match scenes share the game scene. */
export function obsSceneName(scene, names = {}) {
  const merged = { ...DEFAULT_OBS_SCENE_NAMES, ...Object.fromEntries(Object.entries(names || {}).filter(([, value]) => String(value || '').trim())) };
  if (CAMERA_TOUR.includes(scene)) return merged[scene];
  if (!scene || scene === 'live' || MATCH_SCENES.has(scene)) return merged.partido;
  return merged[scene] || null;
}
