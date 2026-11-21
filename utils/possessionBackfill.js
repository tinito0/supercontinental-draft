// Completa la posesión de los partidos que se guardaron en match_lines antes de que match-feed la copiara: la saca del
// resumen completo del mismo partido en live_matches. Puro; tests/possessionBackfill.test.js.
import { possessionOf } from '../supabase/functions/_shared/matchLines.js';

/** Si a un partido de match_lines le falta el campo de posesión (nunca se completó). */
export function needsPossession(linesDoc) {
  return Boolean(linesDoc) && !('possession' in (linesDoc.home || {}) && 'possession' in (linesDoc.away || {}));
}

/**
 * Qué escribir en match_lines/{matchKey}, o null si no hace falta.
 * Un partido que ya tiene el campo (con número o null, «el juego no la contó») no se toca: correrlo dos veces no
 * cambia nada.
 * @param {object|null} liveDoc live_matches/{matchKey} (con summaryJson)
 * @param {object|null} linesDoc match_lines/{matchKey}
 * @returns {null | { 'home.possession': number|null, 'away.possession': number|null }}
 */
export function possessionPatch(liveDoc, linesDoc) {
  if (!liveDoc || !needsPossession(linesDoc)) return null;
  let summary = null;
  try { summary = JSON.parse(liveDoc.summaryJson || 'null'); } catch { summary = null; }
  return { 'home.possession': possessionOf(summary, 'home'), 'away.possession': possessionOf(summary, 'away') };
}
