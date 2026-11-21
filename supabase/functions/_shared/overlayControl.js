// Comandos del overlay de OBS que llegan desde la PC del streaming (Macro Deck → pes-collector/bridge/obs.mjs →
// Edge Function `overlay-control`). Convierte un comando en el parche del doc public/data/broadcast/overlay.
// Puro y sin dependencias (se despliega con la función); tests/overlayControl.test.js.
//
// Los atajos del popup copian POPUP_PRESETS de utils/overlayPopup.js (las funciones no importan fuera de
// supabase/functions); el test falla si se desalinean.

export const OVERLAY_SCENES = ['live', 'previa', 'descanso', 'final', 'partidos', 'tabla', 'bracket', 'repechaje', 'goleadores'];

export const OVERLAY_TOGGLES = { marcador: 'showScoreboard', lower: 'showLowerThird', ticker: 'showTicker', auto: 'autoPopup' };

/** Base de los enlaces del QR si la función no tiene OVERLAY_SITE_URL. */
export const DEFAULT_SITE_URL = 'https://supercontinental-draft.vercel.app';

export const POPUP_PRESETS = [
  { id: 'vota', title: 'Votá en la web', text: 'Predecí los partidos y elegí al manager de la fecha. Sin cuenta.', path: '/en-vivo' },
  { id: 'liga', title: 'Seguí la Supercontinental', text: 'Resultados, tabla y equipos en la web.', path: '/' },
  { id: 'tabla', title: 'Tabla y copas en vivo', text: 'Escaneá y seguí el torneo desde el celular.', path: '/torneo' },
  { id: 'equipos', title: 'Conocé a los equipos', text: 'Planteles e historia de cada club.', path: '/equipos' },
];

export const POPUP_DEFAULT_SECONDS = 30;
// Tarjetas de la comunidad (components/broadcast/CommunityCard.jsx): manager de la fecha, predicción y encuesta de
// la copa.
export const OVERLAY_CARD_KINDS = ['manager', 'prediction', 'cup'];
export const CARD_DEFAULT_SECONDS = 20;
const MAX_POPUP_SECONDS = 600;

export class OverlayCommandError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OverlayCommandError';
    this.status = 400;
  }
}

const fail = message => { throw new OverlayCommandError(message); };

function popupSeconds(value, fallback = POPUP_DEFAULT_SECONDS) {
  if (value === undefined || value === null || value === '') return fallback;
  const seconds = Number(value);
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > MAX_POPUP_SECONDS) {
    fail(`La duración del popup va de 0 a ${MAX_POPUP_SECONDS} segundos (0 = hasta ocultarlo).`);
  }
  return seconds;
}

function onOff(value) {
  if (value === true || value === 'on') return true;
  if (value === false || value === 'off') return false;
  return fail('Usá on u off.');
}

/**
 * @param {{ action: string, scene?: string, preset?: string, seconds?: number, position?: string,
 *   target?: string, value?: boolean|'on'|'off' }} command
 * @param {{ siteUrl: string, now: number }} context
 * @returns {{ data: object, mask: string[], summary: string }} campos a escribir (mask = rutas de campo)
 */
export function buildOverlayCommand(command, { siteUrl, now }) {
  if (!command || typeof command !== 'object') fail('Falta el comando.');
  switch (command.action) {
    case 'scene': {
      if (!OVERLAY_SCENES.includes(command.scene)) fail(`Escena desconocida. Opciones: ${OVERLAY_SCENES.join(', ')}.`);
      return { data: { scene: command.scene }, mask: ['scene'], summary: `escena ${command.scene}` };
    }
    case 'popup': {
      if (command.preset === 'off') {
        return { data: { popup: { visible: false } }, mask: ['popup.visible'], summary: 'popup oculto' };
      }
      const preset = POPUP_PRESETS.find(item => item.id === command.preset);
      if (!preset) fail(`Popup desconocido. Opciones: ${POPUP_PRESETS.map(item => item.id).join(', ')}, off.`);
      const position = ['right', 'left', 'center'].includes(command.position) ? command.position : 'right';
      const popup = {
        visible: true,
        title: preset.title,
        text: preset.text,
        url: new URL(preset.path, siteUrl).href,
        position,
        autoHideSec: popupSeconds(command.seconds),
        shownAt: now,
      };
      return { data: { popup }, mask: ['popup'], summary: `popup ${preset.id}` };
    }
    case 'card': {
      if (command.kind === 'off') {
        return { data: { card: { visible: false } }, mask: ['card.visible'], summary: 'tarjeta oculta' };
      }
      if (!OVERLAY_CARD_KINDS.includes(command.kind)) fail(`Tarjeta desconocida. Opciones: ${OVERLAY_CARD_KINDS.join(', ')}, off.`);
      const card = { visible: true, kind: command.kind, autoHideSec: popupSeconds(command.seconds, CARD_DEFAULT_SECONDS), shownAt: now };
      return { data: { card }, mask: ['card'], summary: `tarjeta ${command.kind}` };
    }
    case 'toggle': {
      const field = OVERLAY_TOGGLES[command.target];
      if (!field) fail(`Elemento desconocido. Opciones: ${Object.keys(OVERLAY_TOGGLES).join(', ')}.`);
      const value = onOff(command.value);
      return { data: { [field]: value }, mask: [field], summary: `${command.target} ${value ? 'on' : 'off'}` };
    }
    default:
      return fail('Acción desconocida. Opciones: scene, popup, card, toggle.');
  }
}

// Popup automático «Votá en la web» (docs/COMMUNITY_PLATFORM.md, C3). Lo dispara match-feed con cada subida del bridge.
export const AUTO_POPUP_SECONDS = 45;
// During the match the QR shows briefly: a PES match of 8 minutes runs 15 game minutes in about 80 real seconds.
export const AUTO_POPUP_IN_PLAY_SECONDS = 15;
export const AUTO_CARD_SECONDS = 20;
// After the automatic «Final», the overlay pages switch to «Tabla» on their own after this long (utils/obsAutoScene.js).
export const AUTO_TABLE_AFTER_MS = 2 * 60_000;
const HALF_TIME_MINUTE = 45;
// Períodos del segundo tiempo según el probe: 2, y 3/4 en el descuento y el alargue. El 5 aparece en repeticiones
// del primer tiempo, así que no cuenta.
const SECOND_HALF_PERIODS = [2, 3, 4];
// The QR goes up at kickoff, every 15 game minutes, at half time and at full time; once each, in this order.
const STAGE_ORDER = { kickoff: 1, m15: 2, m30: 3, half: 4, m60: 5, m75: 6, final: 7 };
const IN_PLAY_STAGES = new Set(['kickoff', 'm15', 'm30', 'm60', 'm75']);

function autoPopupStage(doc, isNewMatch) {
  if (doc.status === 'finished') return 'final';
  if (doc.status !== 'live') return null;
  const clock = doc.clock || {};
  const minute = clock.minute ?? 0;
  if (SECOND_HALF_PERIODS.includes(clock.period)) {
    if (minute >= 75) return 'm75';
    if (minute >= 60) return 'm60';
    if (minute >= HALF_TIME_MINUTE) return 'half';
    return null;
  }
  if (clock.period === 1) {
    if (minute >= 30) return 'm30';
    if (minute >= 15) return 'm15';
    return 'kickoff';
  }
  return isNewMatch ? 'kickoff' : null;
}

// Tarjeta automática: la predicción cuando arranca un partido nuevo. El manager de la fecha se vota cuando termina la
// fecha, no durante un partido: su tarjeta la pone el admin.
function autoCardStage(doc, isNewMatch) {
  if (doc.status !== 'live') return null;
  return isNewMatch ? 'kickoff' : null;
}

function stageDone(marker, matchKey, stage) {
  const [doneKey, doneStage] = String(marker || '').split(':');
  return doneKey === matchKey && (STAGE_ORDER[doneStage] || 0) >= STAGE_ORDER[stage];
}

/**
 * Qué cambia en el overlay cuando el bridge sube un partido:
 * - `liveMatchKey`: el partido en vivo, que usan las escenas Entretiempo y Final.
 * - el popup con QR: al arrancar, cada 15 minutos de juego, en el entretiempo y al final (una vez cada uno).
 * - la tarjeta de la comunidad: la predicción al arrancar.
 * - la escena (`autoScenes`): «En partido» al arrancar uno nuevo, «Final» al terminar (con `autoFinalAt`, y las
 *   páginas del overlay pasan solas a «Tabla» a los 2 minutos).
 * Un partido terminado solo cuenta si fue el que estaba en vivo: el bridge reenvía partidos viejos al arrancar.
 * El admin apaga popups y tarjetas con `autoPopup: false`, y las escenas con `autoScenes: false`.
 * @returns {null | { data: object, mask: string[] }}
 */
export function liveOverlayUpdate({ doc, overlay, siteUrl, now }) {
  const data = {};
  const mask = [];
  const isLive = doc.status === 'live';
  if (isLive && overlay?.liveMatchKey !== doc.matchKey) {
    data.liveMatchKey = doc.matchKey;
    mask.push('liveMatchKey');
  }
  const isNewMatch = Boolean(data.liveMatchKey);
  const stage = autoPopupStage(doc, isNewMatch);
  const isCurrentMatch = isLive || overlay?.liveMatchKey === doc.matchKey;
  if (stage && isCurrentMatch && overlay?.autoPopup !== false && !stageDone(overlay?.autoPopupDone, doc.matchKey, stage)) {
    const seconds = IN_PLAY_STAGES.has(stage) ? AUTO_POPUP_IN_PLAY_SECONDS : AUTO_POPUP_SECONDS;
    const { data: popupData } = buildOverlayCommand(
      { action: 'popup', preset: 'vota', seconds, position: overlay?.popup?.position },
      { siteUrl, now },
    );
    data.popup = popupData.popup;
    data.autoPopupDone = `${doc.matchKey}:${stage}`;
    mask.push('popup', 'autoPopupDone');
  }
  if (overlay?.autoScenes !== false) {
    if (isNewMatch && overlay?.scene !== 'live') {
      data.scene = 'live';
      mask.push('scene');
    } else if (doc.status === 'finished' && overlay?.liveMatchKey === doc.matchKey && overlay?.autoFinalKey !== doc.matchKey) {
      data.scene = 'final';
      data.autoFinalAt = now;
      data.autoFinalKey = doc.matchKey;
      mask.push('scene', 'autoFinalAt', 'autoFinalKey');
    }
  }
  const cardStage = autoCardStage(doc, isNewMatch);
  if (cardStage && overlay?.autoPopup !== false && !stageDone(overlay?.autoCardDone, doc.matchKey, cardStage)) {
    data.card = buildOverlayCommand({ action: 'card', kind: 'prediction', seconds: AUTO_CARD_SECONDS }, { siteUrl, now }).data.card;
    data.autoCardDone = `${doc.matchKey}:${cardStage}`;
    mask.push('card', 'autoCardDone');
  }
  return mask.length ? { data, mask } : null;
}
