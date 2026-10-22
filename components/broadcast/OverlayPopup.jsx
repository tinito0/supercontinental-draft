import React, { memo, useEffect, useMemo, useState } from 'react';
import { popupRemainingMs, qrSvgPath, timedRemainingMs } from '../../utils/overlayPopup.js';
import { BroadcastFrame } from './BroadcastFrame.jsx';

// Tarjeta con QR para la comunidad, sobre el overlay de OBS (1920×1080), con el marco de la transmisión
// (broadcast.css). Los datos vienen del campo `popup` del doc del overlay (utils/overlayPopup.js); se oculta sola
// cuando vence `autoHideSec`. Es lo único que se ve durante el partido.

/** El QR como SVG: módulos oscuros sobre fondo blanco, sin escalado borroso. */
export const QrCode = memo(function QrCode({ url, size = 220, label }) {
  const qr = useMemo(() => (url ? qrSvgPath(url) : null), [url]);
  if (!qr) return null;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${qr.size} ${qr.size}`} shapeRendering="crispEdges" role="img" aria-label={label || `Código QR: ${url}`}>
      <rect width={qr.size} height={qr.size} fill="#ffffff" />
      <path d={qr.path} fill="#04173a" />
    </svg>
  );
});

// La salida (.is-leaving en broadcast.css) dura 280 ms: arranca un poco antes de que venza el tiempo.
export const LEAVE_MS = 300;

/** Milisegundos que le quedan en pantalla (ver timedRemainingMs); re-renderiza hasta que vence. */
export function useRemaining(item, remainingMs = timedRemainingMs) {
  const [now, setNow] = useState(() => Date.now());
  const remaining = remainingMs(item, now);
  useEffect(() => {
    if (!remaining) return undefined;
    // Despierta justo al empezar la salida y otra vez al terminar, además de cada segundo.
    const untilLeave = remaining - LEAVE_MS;
    const delay = untilLeave > 0 ? Math.min(untilLeave, 1000) : remaining;
    const timer = setTimeout(() => setNow(Date.now()), delay);
    return () => clearTimeout(timer);
  }, [remaining, now]);
  return remaining;
}

/** Cambia con cada nuevo `shownAt`: la key reinicia la animación de entrada. */
export function shownKey(item) {
  const shownAt = item.shownAt;
  return typeof shownAt?.toMillis === 'function' ? shownAt.toMillis() : shownAt ?? 'pending';
}

function popupKey(popup) {
  return `${shownKey(popup)}|${popup.url}|${popup.title}`;
}

function displayUrl(href) {
  try {
    const url = new URL(href);
    return `${url.host}${url.pathname === '/' ? '' : url.pathname}`;
  } catch {
    return '';
  }
}

export const OverlayPopup = memo(function OverlayPopup({ popup }) {
  const remaining = useRemaining(popup, popupRemainingMs);
  if (remaining === 0) return null;
  const host = displayUrl(popup.url);
  const isLeaving = remaining !== null && remaining <= LEAVE_MS;
  return (
    // La key reinicia la animación de entrada cada vez que el admin vuelve a mostrarlo (nuevo shownAt).
    <BroadcastFrame
      key={popupKey(popup)}
      className={`scl-popup ${isLeaving ? 'is-leaving' : ''}`}
      dataPosition={popup.position || 'right'}
      title={popup.title}
    >
      {popup.text && <div className="scl-popup-text">{popup.text}</div>}
      <div className="scl-popup-qr">
        <QrCode url={popup.url} size={250} />
        <div className="scl-popup-scan" aria-hidden="true" />
      </div>
      {host && <div className="scl-popup-url">{host}</div>}
    </BroadcastFrame>
  );
});

export default OverlayPopup;
