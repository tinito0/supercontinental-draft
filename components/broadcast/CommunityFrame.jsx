import React from 'react';
import { BroadcastBadge } from './BroadcastFrame.jsx';
import './broadcast.css';

/**
 * Marco de lo que aparece sobre el juego para el público (popup con QR y tarjetas de la comunidad), más bajo y
 * compacto que BroadcastFrame: franja con el degradé de la liga, encabezado con el escudo y panel blanco con las
 * esquinas de abajo redondeadas. Anclado abajo, para no tapar el marcador y el reloj del juego (broadcast.css .scl-pop).
 * @param {{ kicker?: string, title: string, aside?: React.ReactNode, className?: string, position?: string,
 *   isLeaving?: boolean, children: React.ReactNode }} props
 */
export function CommunityFrame({ kicker = 'Comunidad', title, aside, className = '', position = 'right', isLeaving = false, children }) {
  return (
    <section className={`scl-pop ${className} ${isLeaving ? 'is-leaving' : ''}`} data-position={position}>
      <div className="scl-pop-head">
        <div className="scl-pop-edge" aria-hidden="true" />
        <div className="scl-frame-ball" aria-hidden="true" />
        <BroadcastBadge />
        <div className="scl-pop-titles">
          <span className="scl-pop-kicker">
            {kicker}
            {aside && <span className="scl-pop-aside">{aside}</span>}
          </span>
          <span className="scl-pop-title">{title}</span>
        </div>
      </div>
      <div className="scl-pop-body">{children}</div>
    </section>
  );
}

export default CommunityFrame;
