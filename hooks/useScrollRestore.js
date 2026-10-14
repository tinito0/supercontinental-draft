import { useRef, useCallback } from 'react';

/**
 * Hook to persist and restore scroll position for a container or window
 * when opening and closing modals or navigating between views.
 *
 * @param {string} [containerSelector] - CSS selector for the scrollable container.
 *                                      Defaults to window if not provided or found.
 * @returns {{ saveScroll: () => void, restoreScroll: () => void }}
 */
export function useScrollRestore(containerSelector) {
  const savedPosition = useRef(0);

  const getElement = useCallback(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return null;
    if (!containerSelector) return window;
    const el = document.querySelector(containerSelector);
    if (!el) return window;
    // Fallback: If targeted element is not scrollable (e.g. #player-list without overflow),
    // delegate to the scrollable container #main-content
    if (el !== window && el.scrollHeight <= el.clientHeight && el.scrollTop === 0) {
      const scrollableParent = el.closest('#main-content') || document.querySelector('#main-content');
      if (scrollableParent) return scrollableParent;
    }
    return el;
  }, [containerSelector]);

  const saveScroll = useCallback(() => {
    const el = getElement();
    if (!el) return;
    savedPosition.current = el === window ? window.scrollY : el?.scrollTop || 0;
  }, [getElement]);

  const restoreScroll = useCallback(() => {
    if (typeof window === 'undefined') return;
    const apply = () => {
      const el = getElement();
      if (!el) return;
      if (el === window) {
        window.scrollTo(0, savedPosition.current);
      } else {
        el.scrollTop = savedPosition.current;
      }
    };

    const raf = typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame.bind(window)
      : (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(cb, 16));

    raf(() => {
      apply();
      raf(apply);
    });
  }, [getElement]);

  return { saveScroll, restoreScroll };
}
