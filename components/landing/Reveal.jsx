import React, { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../../utils/motion.js';

const showAtOnce = () => prefersReducedMotion() || !('IntersectionObserver' in window);

/**
 * Fades its content in the first time it enters the viewport, so each section reads in order.
 * With reduced motion (or no IntersectionObserver) the content is shown right away.
 */
export function Reveal({ children, delay = 0, className = '', as: Tag = 'div' }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(showAtOnce);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <Tag
      ref={ref}
      className={`landing-reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}

export default Reveal;
