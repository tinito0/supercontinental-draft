import { useState, useRef, useCallback } from 'react';

export function useHoverPreview(delay = 400) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [player, setPlayer] = useState(null);
  const timeoutRef = useRef(null);

  const show = useCallback((event, playerData) => {
    // Only trigger if it's a mouse event (desktop)
    if (event.pointerType === 'touch') return;

    const rect = event.currentTarget.getBoundingClientRect();
    const isRightHalf = rect.left > window.innerWidth / 2;

    // Calculate position
    // If on the right side of the screen, show on the left of the card
    // Otherwise show on the right of the card
    const top = rect.top + window.scrollY;
    let left;
    
    if (isRightHalf) {
      left = rect.left - 232; // 224px width + 8px gap
    } else {
      left = rect.right + 8;
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      setPlayer(playerData);
      setPosition({ top, left });
      setIsVisible(true);
    }, delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  }, []);

  return {
    isVisible,
    position,
    player,
    show,
    hide
  };
}
