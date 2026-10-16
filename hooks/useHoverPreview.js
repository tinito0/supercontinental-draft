import { useState, useRef, useCallback } from 'react';

const PREVIEW_WIDTH = 224; // w-56 in components/ui/PlayerPreview.jsx
const PREVIEW_MAX_HEIGHT = 240;
const GAP = 8;
const EDGE = 8;

/**
 * Viewport position for a fixed popover next to `rect`: right of it if it fits, otherwise left, and always
 * inside the window (it used to run off the bottom for cards near the end of the screen).
 */
export function getPreviewPosition(rect, viewport) {
  const fitsRight = rect.right + GAP + PREVIEW_WIDTH <= viewport.width - EDGE;
  const left = fitsRight ? rect.right + GAP : Math.max(EDGE, rect.left - GAP - PREVIEW_WIDTH);
  const top = Math.min(Math.max(EDGE, rect.top), Math.max(EDGE, viewport.height - PREVIEW_MAX_HEIGHT - EDGE));
  return { top, left };
}

/** Desktop-only hover preview (mouse); purely informational, clicking the card opens the full sheet. */
export function useHoverPreview(delay = 400) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [player, setPlayer] = useState(null);
  const timeoutRef = useRef(null);

  const show = useCallback((event, playerData) => {
    if (event.pointerType === 'touch') return;
    const rect = event.currentTarget.getBoundingClientRect();
    const nextPosition = getPreviewPosition(rect, { width: window.innerWidth, height: window.innerHeight });
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setPlayer(playerData);
      setPosition(nextPosition);
      setIsVisible(true);
    }, delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  }, []);

  return { isVisible, position, player, show, hide };
}
