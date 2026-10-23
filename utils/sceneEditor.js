// Editor de escenas del overlay de OBS (components/admin/obs/): qué campos se editan como borrador y qué se escribe
// al guardar. Puro; tests/sceneEditor.test.js.
//
// Antes «Guardar overlay» escribía todos los campos del formulario (escena y visibilidad incluidas): si Macro Deck
// cambiaba la escena entre que se abrió el panel y se guardó, el guardado la volvía atrás. Ahora se escriben solo los
// campos que el admin cambió, y la escena únicamente con «Mandar al aire».

import { getDirtyOverlayFields } from './broadcastMatches.js';

/** Campos del partido al aire: elegir un partido los cambia juntos. */
export const MATCH_FIELDS = ['matchId', 'homeTeamId', 'awayTeamId', 'homeTeamName', 'awayTeamName', 'homeScore', 'awayScore', 'roundLabel', 'clock', 'matchStatus'];
/** Rótulos: lower third y ticker. */
export const TEXT_FIELDS = ['competitionLabel', 'headline', 'subheadline', 'ticker'];
export const VISIBILITY_FIELDS = ['showLowerThird', 'showTicker'];
/** Todo lo que el editor maneja como borrador (popup, tarjeta y automático se publican al instante, aparte). */
export const DRAFT_FIELDS = [...MATCH_FIELDS, ...TEXT_FIELDS, ...VISIBILITY_FIELDS];

/** Textos por defecto de los rótulos (lo que hace «Restablecer textos»). */
export const DEFAULT_TEXTS = {
  competitionLabel: 'SUPERCONTINENTAL LEAGUE',
  headline: 'SUPERCONTINENTAL LEAGUE',
  subheadline: 'Transmisión oficial',
  ticker: 'Bienvenidos a la transmisión de la Supercontinental League.',
};

/** El borrador inicial: los campos editables del overlay guardado. */
export function draftFrom(overlay, defaults = {}) {
  const merged = { ...defaults, ...(overlay || {}) };
  return Object.fromEntries(DRAFT_FIELDS.map(field => [field, merged[field] ?? '']));
}

/** Campos cambiados respecto de lo guardado. */
export function dirtyDraftFields(draft, saved) {
  return getDirtyOverlayFields(draft, saved, DRAFT_FIELDS);
}

/**
 * Qué escribir: solo los campos cambiados y, si `scene` viene, la escena (mandar al aire).
 * @returns {object | null} null si no hay nada que escribir
 */
export function buildScenePatch(draft, saved, { scene } = {}) {
  const patch = Object.fromEntries(dirtyDraftFields(draft, saved).map(field => [field, draft[field]]));
  if (scene && scene !== (saved?.scene || 'live')) patch.scene = scene;
  return Object.keys(patch).length ? patch : null;
}
