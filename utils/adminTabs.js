// Secciones de Administración. 'users' y 'overlay' eran pestañas propias: hoy viven dentro de
// 'equipos' (Equipos y usuarios) y 'torneo' (Torneo y transmisión).
export const ADMIN_TAB_IDS = ['general', 'equipos', 'torneo', 'comunidad', 'web', 'templates', 'suggestions'];

const LEGACY_TABS = { users: 'equipos', overlay: 'torneo' };
const STORAGE_KEY = 'scl.admin.tab';

export function normalizeAdminTab(tab) {
  const mapped = LEGACY_TABS[tab] || tab;
  return ADMIN_TAB_IDS.includes(mapped) ? mapped : 'general';
}

/** Última sección abierta en esta pestaña del navegador (comodidad; si el storage falla, Configuración). */
export function readStoredAdminTab(storage = globalThis.sessionStorage) {
  try {
    return storage?.getItem(STORAGE_KEY) || 'general';
  } catch {
    return 'general';
  }
}

export function storeAdminTab(tab, storage = globalThis.sessionStorage) {
  try {
    storage?.setItem(STORAGE_KEY, tab);
  } catch {
    // Storage bloqueado (modo privado, etc.): solo se pierde recordar la sección.
  }
}
