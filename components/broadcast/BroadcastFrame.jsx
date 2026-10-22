import React from 'react';
import { DEFAULT_LOGO } from '../../utils/constants.js';
import './broadcast.css';

/** Escudo de la liga en un cuadro blanco, como en los encabezados de la transmisión. */
export function BroadcastBadge() {
  return (
    <div className="scl-badge">
      <img src={DEFAULT_LOGO} alt="" width={48} height={48} onError={event => { event.currentTarget.style.visibility = 'hidden'; }} />
    </div>
  );
}

/**
 * Marco de la transmisión (broadcast.css): franja clara, degradé azul marino → lavanda, encabezado con el escudo y
 * panel blanco con las esquinas de abajo redondeadas. Va dentro de un contenedor con la clase `scl-broadcast`.
 * @param {{ kicker?: string, title: string, aside?: React.ReactNode, className?: string, panelClassName?: string,
 *   children: React.ReactNode, style?: object, dataPosition?: string }} props
 */
export function BroadcastFrame({ kicker, title, aside, className = '', panelClassName = '', children, style, dataPosition }) {
  return (
    <div className={`scl-frame ${className}`} style={style} data-position={dataPosition}>
      <div className="scl-frame-stripe" aria-hidden="true" />
      <div className="scl-frame-ball" aria-hidden="true" />
      <div className="scl-frame-head">
        <BroadcastBadge />
        <div className="scl-frame-titles">
          {kicker && <span className="scl-frame-kicker">{kicker}</span>}
          <span className="scl-frame-title">{title}</span>
        </div>
        {aside && <div className="scl-frame-aside">{aside}</div>}
      </div>
      <div className={`scl-panel ${panelClassName}`}>{children}</div>
    </div>
  );
}
