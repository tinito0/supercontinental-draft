import React, { useRef, useState } from 'react';
import { useExitAnimation } from '../../hooks/usePresence.js';
import { X } from 'lucide-react';
import { useModalDialog, hasOpenModalDialog } from '../../hooks/useModalDialog.js';

/** True while any modal dialog is open. The app's global Escape listener leaves Escape to it (app.jsx). */
export const hasOpenBaseModal = hasOpenModalDialog;

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
  // Focus trap, Escape, scroll lock and focus return (hooks/useModalDialog.js, shared with hand-made dialogs).
  useModalDialog(dialogRef, isOpen, onClose);

  // Exit: a dialog whose isOpen turns false stays mounted with data-closing while it animates out. Focus, the
  // dialog stack and the page scroll are released at once (the effect above), and the leaving copy is inert.
  // Callers that unmount the whole component (route modals rendered with &&) still close at once.
  const [isMounted, setIsMounted] = useState(isOpen);
  if (isOpen && !isMounted) setIsMounted(true);
  const isClosing = isMounted && !isOpen;
  const backdropRef = useRef(null);
  useExitAnimation(backdropRef, isClosing, () => setIsMounted(false));

  if (!isMounted) return null;

  const sizeClass = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || (typeof title === 'string' ? title : 'Ventana emergente')}
      ref={backdropRef}
      className="modal-backdrop fixed inset-0 z-modal flex items-end sm:items-center justify-center sm:p-4 bg-canvas/90 animate-in fade-in"
      data-closing={isClosing ? '' : undefined}
      inert={isClosing ? '' : undefined}
      onClick={isClosing ? undefined : onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`modal-panel bg-surface border border-line/[0.14] rounded-t-2xl sm:rounded-2xl w-full shadow-lg flex flex-col overflow-hidden max-h-[94dvh] sm:max-h-[92dvh] max-sm:pb-[env(safe-area-inset-bottom)] animate-in slide-in-from-bottom sm:zoom-in-95 ${sizeClass} ${className}`}
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
