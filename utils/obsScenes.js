// Escenas del overlay de OBS y qué escena pide cada URL. Puro; tests/obsScenes.test.js.
// La lista de ids debe coincidir con OVERLAY_SCENES de supabase/functions/_shared/overlayControl.js (Macro Deck);
// el test falla si se desalinean.

export const OBS_SCENES = [
  { id: 'live', label: 'En partido', hint: 'Solo el popup con QR y las tarjetas de la comunidad', group: 'partido' },
  { id: 'previa', label: 'Previa', hint: 'Los dos equipos y la predicción', group: 'partido' },
  { id: 'descanso', label: 'Entretiempo', hint: 'Resultado parcial y goles', group: 'partido' },
  { id: 'final', label: 'Final', hint: 'Resultado, goles y MVP', group: 'partido' },
  { id: 'partidos', label: 'Fecha', hint: 'Los partidos de la fecha o ronda actual', group: 'torneo' },
  { id: 'tabla', label: 'Tabla', hint: 'Posiciones de la liga', group: 'torneo' },
  { id: 'bracket', label: 'Copa de Oro', hint: 'Cuadro completo', group: 'torneo' },
  { id: 'repechaje', label: 'Copa de Plata', hint: 'Cuadro completo', group: 'torneo' },
  { id: 'goleadores', label: 'Goleadores', hint: 'Máximos goleadores', group: 'torneo' },
];

export const OBS_SCENE_IDS = OBS_SCENES.map(scene => scene.id);
export const sceneLabel = id => OBS_SCENES.find(scene => scene.id === id)?.label || id;

/** Escenas que ocupan toda la pantalla: no llevan lower third ni ticker encima (los tapaban). */
export const FULLSCREEN_SCENES = new Set(['partidos', 'tabla', 'bracket', 'repechaje']);
/** Escenas que usan el partido al aire. */
export const MATCH_SCENES = new Set(['previa', 'descanso', 'final']);

// Nombres viejos o alternativos que todavía usan fuentes de OBS ya configuradas.
const ALIASES = { table: 'tabla', groups: 'tabla', llaves: 'bracket', stats: 'goleadores', matches: 'partidos' };

/** Id de escena válido para un nombre que viene de una URL; null si no es ninguna. */
export function normalizeSceneId(value) {
  const id = ALIASES[String(value || '').toLowerCase()] || String(value || '').toLowerCase();
  return OBS_SCENE_IDS.includes(id) ? id : null;
}

/**
 * Si una URL del draft es una fuente de OBS y qué muestra. main.jsx la resuelve antes de montar el draft, así una
 * fuente de OBS no carga el login ni el mercado.
 * - /draft/overlay: el overlay; sigue la escena guardada salvo que la URL fije una (?scene=, o ?view= de antes).
 * - ?mode=obs&view=…: las vistas del torneo de antes, ahora escenas del mismo overlay (fondo transparente).
 * - ?mode=table / ?mode=bracket: tabla o copa como página (fondo opaco).
 * @param {string} draftPath la ruta dentro del draft (sin /draft)
 * @returns {null | { scene: string | null, transparent: boolean }}
 */
export function resolveObsRequest(draftPath, search) {
  const params = new URLSearchParams(search || '');
  const path = String(draftPath || '/').toLowerCase();
  const mode = params.get('mode');
  const view = params.get('view');
  const isPlata = params.get('tournament') === 'copa-plata';
  const fromView = fallback => {
    const scene = normalizeSceneId(view) || fallback;
    return scene === 'bracket' && isPlata ? 'repechaje' : scene;
  };
  if (path === '/overlay' || path.startsWith('/overlay/')) {
    return { scene: normalizeSceneId(params.get('scene')) || normalizeSceneId(view), transparent: true };
  }
  if (mode === 'obs') return { scene: fromView('tabla'), transparent: true };
  if (mode === 'table') return { scene: fromView('tabla'), transparent: false };
  if (mode === 'bracket') return { scene: fromView('bracket'), transparent: false };
  return null;
}
