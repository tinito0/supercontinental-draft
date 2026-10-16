import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { isTyping } from '../../hooks/useKeyboardShortcuts.js';

// Open dialogs, oldest first. Only the top one reacts to Escape/Tab: with a confirmation open over a sheet,
// one Escape used to close both (every dialog listens on window).
const openDialogs = [];

const SIZE_MAP = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-6xl',
  full: 'max-w-[95vw] h-[90vh]',
};

export function BaseModal({
  isOpen = true,
  onClose,
  title,
  subtitle,
  ariaLabel,
  icon: Icon,
  size = 'md',
  children,
  footer,
  showClose = true,
  className = '',
  contentClassName = '',
}) {
  const dialogRef = useRef(null);
  // Parents usually pass an inline onClose (a new function on every render). Reading it through a ref
  // keeps the focus effect below tied to opening/closing only: re-running it on each render moved the
  // focus to the first focusable control (the close button) while the user was typing in a field.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Keep keyboard focus inside the dialog and return it to the trigger on close.
  // This is deliberately centralized so every consumer gets the same baseline.
  useEffect(() => {
    if (!isOpen) return;

    const dialogToken = {};
    openDialogs.push(dialogToken);
    const isTopDialog = () => openDialogs[openDialogs.length - 1] === dialogToken;
    const previouslyFocused = document.activeElement;
    const getFocusableElements = () => dialogRef.current?.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) || [];

    const handleKeyDown = (e) => {
      if (!isTopDialog()) return;
      if (e.key === 'Escape') {
        // Escape inside a field leaves the field first; it never closes the dialog while typing.
        if (isTyping(e.target)) {
          e.target.blur?.();
          return;
        }
        onCloseRef.current?.();
        return;
      }

      if (e.key === 'Tab') {
        const focusable = Array.from(getFocusableElements());
        if (focusable.length === 0) {
          e.preventDefault();
          dialogRef.current?.focus();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    // A dialog stacked over another (a confirmation over a sheet) takes Escape first, in the capture phase,
    // and stops it: otherwise the dialog below and the app's global Escape listener would close too.
    const handleStackedEscape = (e) => {
      if (e.key !== 'Escape' || openDialogs.length < 2 || !isTopDialog() || isTyping(e.target)) return;
      e.stopPropagation();
      e.preventDefault();
      onCloseRef.current?.();
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keydown', handleStackedEscape, true);
    const firstFocusable = getFocusableElements()[0];
    (firstFocusable || dialogRef.current)?.focus();

    return () => {
      const index = openDialogs.indexOf(dialogToken);
      if (index !== -1) openDialogs.splice(index, 1);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keydown', handleStackedEscape, true);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClass = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || (typeof title === 'string' ? title : 'Ventana emergente')}
      className="fixed inset-0 z-modal flex items-end sm:items-center justify-center sm:p-4 bg-canvas/80 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`bg-surface border border-line/[0.14] rounded-t-2xl sm:rounded-2xl w-full shadow-lg flex flex-col overflow-hidden max-h-[94dvh] sm:max-h-[92dvh] max-sm:pb-[env(safe-area-inset-bottom)] animate-in slide-in-from-bottom sm:zoom-in-95 ${sizeClass} ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || showClose) && (
          <div className="flex items-center justify-between gap-3 pl-5 pr-3 py-3 border-b border-line/10 shrink-0">
            <div className="flex items-center gap-3 min-w-0 pr-4">
              {Icon && (
                <div className="w-9 h-9 rounded-lg bg-accent/[0.14] flex items-center justify-center text-accent-soft shrink-0">
                  <Icon className="w-[18px] h-[18px]" aria-hidden="true" />
                </div>
              )}
              <div className="min-w-0">
                {title && (
                  <h2 className="font-display text-lg sm:text-xl font-bold text-ink leading-tight truncate">
                    {title}
                  </h2>
                )}
                {subtitle && (
                  <p className="text-xs text-ink-3 truncate mt-0.5">{subtitle}</p>
                )}
              </div>
            </div>
            {showClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="w-11 h-11 rounded-lg text-ink-3 hover:text-ink hover:bg-white/[0.06] flex items-center justify-center transition-colors shrink-0"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className={`p-5 overflow-y-auto overscroll-contain custom-scrollbar flex-1 min-h-0 ${contentClassName}`}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-5 py-3.5 border-t border-line/10 flex items-center justify-end gap-2.5 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default BaseModal;
