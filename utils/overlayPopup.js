// Popup para la comunidad en el overlay de OBS: una tarjeta con un QR que lleva a la web. Vive en el campo `popup` del
// doc public/data/broadcast/overlay (lo escribe el admin desde components/admin/obs/ObsSceneStudio.jsx, lo lee components/broadcast/
// OverlayPopup.jsx). El QR se arma acá, sin servicios externos. Puro; tests/overlayPopup.test.js.
import qrcode from 'qrcode-generator';

export const POPUP_LIMITS = { TITLE: 60, TEXT: 140, URL: 300, MIN_SECONDS: 5, MAX_SECONDS: 600 };
export const POPUP_POSITIONS = ['right', 'left', 'center'];

// Rutas de la web pública de la liga (utils/siteRoutes.js): el QR siempre lleva a la web, nunca al draft.
export const POPUP_PRESETS = [
  { id: 'vota', label: 'Votá el MVP', title: 'Votá al mejor del partido', text: 'Escaneá, predecí y elegí al MVP. Sin cuenta.', path: '/en-vivo' },
  { id: 'liga', label: 'Seguí la liga', title: 'Seguí la Supercontinental', text: 'Resultados, tabla y equipos en la web.', path: '/' },
  { id: 'tabla', label: 'Tabla y copas', title: 'Tabla y copas en vivo', text: 'Escaneá y seguí el torneo desde el celular.', path: '/torneo' },
  { id: 'equipos', label: 'Los equipos', title: 'Conocé a los equipos', text: 'Planteles e historia de cada club.', path: '/equipos' },
];

export const DEFAULT_POPUP = {
  visible: false,
  title: POPUP_PRESETS[0].title,
  text: POPUP_PRESETS[0].text,
  url: '',
  position: 'right',
  autoHideSec: 30,
  shownAt: null,
};

/**
 * Solo https (el QR lo abre un celular cualquiera) y corto, para que el código siga legible en el stream.
 * @returns {{ ok: true, url: string } | { ok: false, reason: string }}
 */
export function normalizePopupUrl(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return { ok: false, reason: 'Falta el enlace.' };
  let url;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'El enlace no es válido: tiene que empezar con https://' };
  }
  if (url.protocol !== 'https:') return { ok: false, reason: 'El enlace tiene que empezar con https://' };
  if (url.username || url.password) return { ok: false, reason: 'El enlace no puede llevar usuario ni contraseña.' };
  if (url.href.length > POPUP_LIMITS.URL) return { ok: false, reason: `El enlace es demasiado largo (máximo ${POPUP_LIMITS.URL} caracteres).` };
  return { ok: true, url: url.href };
}

const clip = (value, max) => String(value ?? '').trim().slice(0, max);

/**
 * Valida el formulario del admin y arma el campo `popup` a guardar. `shownAt` lo pone quien guarda (serverTimestamp).
 * @returns {{ ok: true, popup: object } | { ok: false, reason: string }}
 */
export function buildPopup(form) {
  const url = normalizePopupUrl(form?.url);
  if (!url.ok) return url;
  const title = clip(form.title, POPUP_LIMITS.TITLE);
  if (!title) return { ok: false, reason: 'Falta el título.' };
  const seconds = Number(form.autoHideSec);
  const autoHideSec = seconds === 0 ? 0 : Math.round(seconds);
  if (!Number.isFinite(autoHideSec) || (autoHideSec !== 0 && (autoHideSec < POPUP_LIMITS.MIN_SECONDS || autoHideSec > POPUP_LIMITS.MAX_SECONDS))) {
    return { ok: false, reason: `La duración va de ${POPUP_LIMITS.MIN_SECONDS} a ${POPUP_LIMITS.MAX_SECONDS} segundos (0 = hasta ocultarlo).` };
  }
  return {
    ok: true,
    popup: {
      visible: Boolean(form.visible),
      title,
      text: clip(form.text, POPUP_LIMITS.TEXT),
      url: url.url,
      position: POPUP_POSITIONS.includes(form.position) ? form.position : 'right',
      autoHideSec,
    },
  };
}

// Firestore Timestamp, Date o milisegundos. Null mientras serverTimestamp() no volvió del servidor.
function toMillis(value) {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return null;
}

/**
 * Milisegundos que le quedan en pantalla a algo con { visible, autoHideSec, shownAt } (popup o tarjeta de la
 * comunidad): null = sin límite, 0 = no se muestra. Un `shownAt` todavía pendiente cuenta como "recién mostrado".
 */
export function timedRemainingMs(item, nowMs) {
  if (!item?.visible) return 0;
  if (!item.autoHideSec) return null;
  const duration = item.autoHideSec * 1000;
  const shownAt = toMillis(item.shownAt) ?? nowMs;
  // Con el reloj local atrasado, shownAt queda en el futuro: nunca más que la duración pedida.
  return Math.min(duration, Math.max(0, shownAt + duration - nowMs));
}

/**
 * Desde cuándo contar un popup o tarjeta en esta fuente (components/broadcast/OverlayPopup.jsx useRemaining).
 * `shownAt` lo pone el servidor y la PC de OBS puede tener la hora corrida, así que lo que cambia con la fuente abierta
 * se cuenta desde que llegó (`at`, reloj local). Lo que ya estaba al cargar el doc (al abrir o refrescar la fuente) usa
 * `shownAt` (`at: null`): si no, un popup viejo volvería a salir en cada refresco. Un `shownAt` en el futuro solo puede
 * ser reloj atrasado: cuenta desde ahora.
 * @param {{ key: string|null, at: number|null, seen: boolean }} prev seen: ya se cargó el doc una vez
 * @param {string|null} key shownKey del item ('pending' o los ms de shownAt), o null si no hay item
 * @param {boolean} [loaded] el doc del overlay ya llegó (mientras carga, nada cuenta como recién llegado)
 * @returns {{ key: string|null, at: number|null, seen: boolean }}
 */
export function nextArrival(prev, key, nowMs, loaded = true) {
  if (prev.key === key) return prev.seen || !loaded ? prev : { ...prev, seen: true };
  if (!prev.seen) {
    const future = Number(key) > nowMs;
    return { key, at: future ? nowMs : null, seen: loaded };
  }
  if (key === null) return { key, at: null, seen: true };
  // Un serverTimestamp que se resuelve ('pending' → hora) es el mismo popup: no reinicia la cuenta.
  if (prev.key === 'pending') return { key, at: prev.at ?? nowMs, seen: true };
  return { key, at: nowMs, seen: true };
}

/** Igual que timedRemainingMs; un popup sin enlace no se muestra. */
export function popupRemainingMs(popup, nowMs) {
  return popup?.url ? timedRemainingMs(popup, nowMs) : 0;
}

/**
 * QR del enlace como un solo path SVG (un cuadrado por módulo oscuro), con 4 módulos de margen blanco.
 * Corrección de errores M: aguanta la compresión del stream sin agrandar demasiado el código.
 * @returns {{ size: number, path: string }}
 */
export function qrSvgPath(text, margin = 4) {
  const qr = qrcode(0, 'M');
  qr.addData(text, 'Byte');
  qr.make();
  const count = qr.getModuleCount();
  let path = '';
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) path += `M${col + margin} ${row + margin}h1v1h-1z`;
    }
  }
  return { size: count + margin * 2, path };
}
