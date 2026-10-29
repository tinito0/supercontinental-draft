import { useEffect, useRef, useState } from 'react';
import { KitGL } from './kitRenderer.js';

/**
 * WebGL renderer of a canvas, with context loss handled: on `webglcontextlost` the renderer is dropped (drawing
 * stops instead of failing), on `webglcontextrestored` it is rebuilt and `epoch` changes so the caller re-uploads
 * models and textures. Unmounting frees the GPU objects but keeps the context, so a remount of the same canvas
 * (React StrictMode) gets a working renderer instead of a lost context.
 * @param {React.RefObject<HTMLCanvasElement>} canvasRef
 * @returns {{ glRef: React.MutableRefObject<object|null>, epoch: number, error: Error|null }}
 */
export function useKitGL(canvasRef) {
  const glRef = useRef(null);
  const [epoch, setEpoch] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const create = () => {
      const R = KitGL.make(canvas);
      glRef.current = R;
      if (!R) { setError(new Error('No se pudo iniciar WebGL en este navegador: el kit no se puede mostrar en 3D.')); return; }
      setError(null);
      setEpoch(e => e + 1);
    };
    const lost = e => {
      e.preventDefault(); // lets the browser restore the context
      glRef.current = null;
      setError(new Error('El navegador liberó el contexto WebGL de la vista 3D. Se recupera solo en unos segundos.'));
    };
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', create);
    create();
    return () => {
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', create);
      if (glRef.current) KitGL.dispose(glRef.current);
      glRef.current = null;
    };
  }, [canvasRef]);

  return { glRef, epoch, error };
}
