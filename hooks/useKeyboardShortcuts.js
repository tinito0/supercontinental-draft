import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Checks if an element is an input, textarea, select or contenteditable element
 * where normal text typing should take precedence over shortcuts.
 */
function isTyping(target) {
  if (!target) return false;
  const tagName = target.tagName ? target.tagName.toUpperCase() : '';
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }
  if (target.isContentEditable || target.getAttribute?.('contenteditable') === 'true' || target.getAttribute?.('contenteditable') === '') {
    return true;
  }
  const active = typeof document !== 'undefined' ? document.activeElement : null;
  if (active && active !== target) {
    const activeTag = active.tagName ? active.tagName.toUpperCase() : '';
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
      return true;
    }
    if (active.isContentEditable || active.getAttribute?.('contenteditable') === 'true' || active.getAttribute?.('contenteditable') === '') {
      return true;
    }
  }
  return false;
}

/**
 * Hook para registrar y gestionar atajos de teclado globales en la aplicación.
 * Solo se activan cuando no hay inputs, textareas o elementos editables con foco.
 *
 * Atajos registrados:
 * - M → setActiveTab('Marketplace')
 * - O → setActiveTab('Overview')
 * - T → setActiveTab('My Team') (formación)
 * - F → open filters modal
 * - C → toggle cart/my club
 * - ? o Shift+/ → toggle help panel
 * - Escape → close any open modal
 *
 * @param {Object} options
 * @param {Function} [options.setActiveTab]
 * @param {Function} [options.openModalRoute]
 * @param {Function} [options.toggleCart]
 * @param {Function} [options.setHelpOpen]
 * @param {Function} [options.closeAllModals]
 * @param {Function} [options.openFilters]
 * @returns {{ isHelpOpen: boolean, setIsHelpOpen: Function }}
 */
export function useKeyboardShortcuts({
  setActiveTab,
  openModalRoute,
  toggleCart,
  setHelpOpen,
  closeAllModals,
  openFilters,
} = {}) {
  const [internalHelpOpen, setInternalHelpOpen] = useState(false);
  const isHelpOpenRef = useRef(internalHelpOpen);
  isHelpOpenRef.current = internalHelpOpen;

  const setIsHelpOpen = useCallback((valueOrUpdater) => {
    setInternalHelpOpen((prev) => {
      const next = typeof valueOrUpdater === 'function' ? valueOrUpdater(prev) : valueOrUpdater;
      isHelpOpenRef.current = next;
      if (typeof setHelpOpen === 'function') {
        setHelpOpen(next);
      }
      return next;
    });
  }, [setHelpOpen]);

  const callbacksRef = useRef({
    setActiveTab,
    openModalRoute,
    toggleCart,
    closeAllModals,
    openFilters,
  });

  useEffect(() => {
    callbacksRef.current = {
      setActiveTab,
      openModalRoute,
      toggleCart,
      closeAllModals,
      openFilters,
    };
  }, [setActiveTab, openModalRoute, toggleCart, closeAllModals, openFilters]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignorar si el usuario está escribiendo en un input/textarea/editable
      if (isTyping(e.target)) {
        return;
      }

      // Escape: cerrar panel de ayuda primero si está abierto, o ejecutar callback global
      if (e.key === 'Escape') {
        if (isHelpOpenRef.current) {
          e.preventDefault();
          setIsHelpOpen(false);
          return;
        }
        if (typeof callbacksRef.current.closeAllModals === 'function') {
          callbacksRef.current.closeAllModals();
        }
        return;
      }

      // No interceptar si hay modificadores Ctrl, Alt o Meta (Cmd en Mac / Win en Windows)
      if (e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }

      // ? o Shift+/ → alternar panel de ayuda
      if (e.key === '?' || (e.shiftKey && (e.key === '/' || e.code === 'Slash'))) {
        e.preventDefault();
        setIsHelpOpen((prev) => !prev);
        return;
      }

      const key = e.key.toLowerCase();

      // M → Marketplace
      if (key === 'm') {
        e.preventDefault();
        callbacksRef.current.setActiveTab?.('Marketplace');
        return;
      }

      // O → Overview
      if (key === 'o') {
        e.preventDefault();
        callbacksRef.current.setActiveTab?.('Overview');
        return;
      }

      // T → My Team
      if (key === 't') {
        e.preventDefault();
        callbacksRef.current.setActiveTab?.('My Team');
        return;
      }

      // F → Abrir modal de filtros
      if (key === 'f') {
        e.preventDefault();
        if (typeof callbacksRef.current.openFilters === 'function') {
          callbacksRef.current.openFilters();
        } else {
          callbacksRef.current.openModalRoute?.('filters');
        }
        return;
      }

      // C → Alternar Carrito / Mi Club
      if (key === 'c') {
        e.preventDefault();
        callbacksRef.current.toggleCart?.();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setIsHelpOpen]);

  return {
    isHelpOpen: internalHelpOpen,
    setIsHelpOpen,
  };
}

export default useKeyboardShortcuts;
