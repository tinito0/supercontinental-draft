import { useEffect, useRef } from 'react';
import { isTyping } from './useKeyboardShortcuts.js';

// Open dialogs, oldest first. Only the top one reacts to Escape/Tab: with a confirmation open over a sheet,
// one Escape used to close both (every dialog listens on window).
const openDialogs = [];

/** True while any modal dialog using this hook is open. The app's global Escape listener leaves Escape to it. */
export const hasOpenModalDialog = () => openDialogs.length > 0;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog behaviour shared by BaseModal and the dialogs built by hand: focus moves into the dialog and
 * stays there (Tab wraps), Escape closes it (after leaving a field being typed in), the page behind does not
 * scroll, and focus returns to the trigger on close. Stacked dialogs: only the top one reacts.
 * @param {React.RefObject<HTMLElement>} dialogRef the element that holds the dialog's controls
 * @param {boolean} isOpen
 * @param {() => void} onClose called on Escape
 */
export function useModalDialog(dialogRef, isOpen, onClose) {
  // Parents usually pass an inline onClose (a new function on every render). Reading it through a ref keeps the
  // effect tied to opening/closing only: re-running it on each render moved the focus to the first focusable
  // control while the user was typing in a field.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const dialogToken = {};
    openDialogs.push(dialogToken);
    const isTopDialog = () => openDialogs[openDialogs.length - 1] === dialogToken;
    const previouslyFocused = document.activeElement;
    const getFocusableElements = () => dialogRef.current?.querySelectorAll(FOCUSABLE) || [];

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
  }, [isOpen, dialogRef]);
}
