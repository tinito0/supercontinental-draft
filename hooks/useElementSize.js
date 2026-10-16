import { useRef, useState, useLayoutEffect } from 'react';

// Mide un elemento con ResizeObserver nativo (redondeado a px enteros, sin re-render si no cambia).
// Por qué no react-virtualized-auto-sizer: su mecanismo de "resize-triggers" se quedaba en 0×0 dentro de
// los flex anidados de la app.
export function useElementSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      const roundedWidth = Math.round(rect.width);
      const roundedHeight = Math.round(rect.height);
      setSize(prev => (prev.width === roundedWidth && prev.height === roundedHeight)
        ? prev
        : { width: roundedWidth, height: roundedHeight });
    };

    updateSize();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }

    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, size];
}

export default useElementSize;
