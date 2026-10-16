// Lectura y validación compartidas por las secciones de administración de equipos y usuarios.
import { DEFAULT_LOGO } from './constants.js';

/**
 * Fila de administración a partir del equipo público y del perfil privado.
 * El presupuesto sale de teams/{uid}.budget, que es el autoritativo (useAuth lo copia al perfil): antes se
 * prefería la copia del perfil y, si estaban desfasadas, guardar el formulario pisaba el presupuesto real.
 */
export function mergeAdminTeamProfile(uid, publicData = {}, privateData = {}) {
  const pub = publicData || {};
  const priv = privateData || {};
  return {
    uid,
    teamName: String(priv.teamName || pub.teamName || 'Sin nombre'),
    logoUrl: priv.logoUrl || pub.logoUrl || DEFAULT_LOGO,
    budget: Number(pub.budget ?? priv.budget ?? 0) || 0,
    country: pub.country || priv.country || 204,
    manualStats: pub.manualStats || {},
    inWhitelist: Boolean(pub.inWhitelist),
    email: priv.email || '',
  };
}

export function sortByTeamName(rows) {
  return [...rows].sort((a, b) => String(a.teamName || '').localeCompare(String(b.teamName || '')));
}

/** { value } si es un presupuesto válido (entero ≥ 0), { error } si no. Un campo vacío ya no se guarda como 0. */
export function parseBudgetInput(raw) {
  const text = String(raw ?? '').trim();
  if (text === '') return { error: 'Ingresá un presupuesto.' };
  const value = Number(text);
  if (!Number.isFinite(value)) return { error: 'El presupuesto tiene que ser un número.' };
  if (value < 0) return { error: 'El presupuesto no puede ser negativo.' };
  return { value: Math.round(value) };
}

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/** Mensaje de error si el archivo no sirve como escudo, o null. */
export function validateLogoFile(file) {
  if (!file) return 'No se eligió ningún archivo.';
  if (!String(file.type || '').startsWith('image/')) return 'El escudo tiene que ser una imagen.';
  if (file.size > MAX_LOGO_BYTES) return 'La imagen es muy pesada (máx. 2 MB).';
  return null;
}

/** Búsqueda (nombre, email o uid) + filtro por acceso anticipado al mercado ('all' | 'early' | 'regular'). */
export function filterAdminTeams(rows, { query = '', access = 'all' } = {}) {
  const term = String(query).trim().toLowerCase();
  return rows.filter(row => {
    if (access === 'early' && !row.inWhitelist) return false;
    if (access === 'regular' && row.inWhitelist) return false;
    if (!term) return true;
    return [row.teamName, row.email, row.uid].some(value => String(value || '').toLowerCase().includes(term));
  });
}
