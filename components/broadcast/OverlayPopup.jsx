import React, { memo, useEffect, useMemo, useState } from 'react';
import { nextArrival, popupRemainingMs, qrSvgPath, timedRemainingMs } from '../../utils/overlayPopup.js';
import { CommunityFrame } from './CommunityFrame.jsx';

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

// La salida (.scl-pop.is-leaving en broadcast.css) dura 280 ms: arranca un poco antes de que venza el tiempo.
export const LEAVE_MS = 300;

/**
 * Milisegundos que le quedan en pantalla (ver timedRemainingMs); re-renderiza hasta que vence. Lo que llega con la
 * fuente abierta se cuenta desde que llegó, no por la hora del servidor (utils/overlayPopup.js nextArrival).
 */
export function useRemaining(item, remainingMs = timedRemainingMs, loaded = true) {
  const [now, setNow] = useState(() => Date.now());
  const key = item ? String(shownKey(item)) : null;
  const [arrival, setArrival] = useState({ key: null, at: null, seen: false });
  const next = nextArrival(arrival, key, Date.now(), loaded);
  if (next !== arrival) setArrival(next);
  const anchored = next.at !== null ? { ...item, shownAt: next.at } : item;
  const remaining = remainingMs(anchored, now);
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

export const OverlayPopup = memo(function OverlayPopup({ popup, loaded = true }) {
  const remaining = useRemaining(popup, popupRemainingMs, loaded);
  if (remaining === 0) return null;
  const host = displayUrl(popup.url);
  const isLeaving = remaining !== null && remaining <= LEAVE_MS;
  return (
    // La key reinicia la animación de entrada cada vez que el admin vuelve a mostrarlo (nuevo shownAt).
    <CommunityFrame
      key={popupKey(popup)}
      className="scl-popup"
      position={popup.position || 'right'}
      title={popup.title}
      isLeaving={isLeaving}
    >
      <div className="scl-popup-qr">
        {/* 200 px: unos 6 px por módulo, lo mínimo para que se escanee desde la tele con la compresión del stream. */}
        <QrCode url={popup.url} size={200} />
      </div>
      <div className="scl-popup-copy">
        {popup.text
          ? <p className="scl-popup-text" style={{ '--i': 0 }}>{popup.text}</p>
          : <span className="scl-popup-hint" style={{ '--i': 1 }}>Escaneá con la cámara del celular</span>}
        {host && <span className="scl-popup-url" style={{ '--i': 2 }}>{host}</span>}
      </div>
    </CommunityFrame>
  );
});

export default OverlayPopup;
