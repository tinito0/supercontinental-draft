import React from 'react';
import { useElementSize } from '../../hooks/useElementSize.js';
import './broadcast.css';

export const STAGE = { width: 1920, height: 1080 };

/**
 * Lienzo de la transmisión: todo se diseña en 1920×1080 px y el lienzo entero se escala para entrar en la fuente de
 * OBS (o en la vista previa del admin), centrado. Reemplaza las tres formas de escalar que había (overlay fijo en px,
 * ObsStage con transform y el bracket midiendo --u): ahora todas las escenas miden y se ven igual.
 * @param {{ mode?: 'viewport' | 'contained', transparent?: boolean, label?: string, children: React.ReactNode }} props
 *   viewport: ocupa la ventana (fuente de OBS). contained: ocupa el ancho del contenedor en 16:9 (vista previa).
 */
export function BroadcastStage({ mode = 'viewport', transparent = true, label = 'Escena de la transmisión', children }) {
  const [ref, { width, height }] = useElementSize();
  // Antes de medir (primer pintado, render en servidor) se asume la fuente de referencia de 1920×1080.
  const scale = width && height ? Math.min(width / STAGE.width, height / STAGE.height) : (mode === 'viewport' ? 1 : 0);
  const outer = mode === 'viewport'
    ? { position: 'fixed', inset: 0 }
    : { position: 'relative', width: '100%', aspectRatio: `${STAGE.width} / ${STAGE.height}` };
  return (
    <div
      ref={ref}
      className="scl-stage-outer"
      style={{ ...outer, overflow: 'hidden', background: transparent ? 'transparent' : '#060b1a' }}
      data-stage-scale={scale.toFixed(3)}
    >
      <div
        className="scl-broadcast scl-stage-canvas"
        aria-label={label}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: STAGE.width,
          height: STAGE.height,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: 'center center',
          visibility: scale ? 'visible' : 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default BroadcastStage;
