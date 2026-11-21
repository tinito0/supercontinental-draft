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
};

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
  if (!scene || scene === 'live' || MATCH_SCENES.has(scene)) return merged.partido;
  return merged[scene] || null;
}
