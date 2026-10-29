import React, { memo, useRef } from 'react';
import { useModalDialog } from '../hooks/useModalDialog.js';
import { Download } from 'lucide-react';

/** Install prompt for the PWA: a bottom sheet on phones, a small dialog on larger screens. */
export const InstallPopup = memo(({ isVisible, onInstall, onClose }) => {
  const panelRef = useRef(null);
  useModalDialog(panelRef, isVisible, onClose);
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-modal bg-canvas/80 flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in"
      role="dialog" aria-modal="true" aria-labelledby="install-title" onClick={onClose}>
      <div ref={panelRef} tabIndex={-1} className="panel w-full sm:max-w-sm p-6 sm:p-7 text-center rounded-b-none sm:rounded-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom sm:zoom-in-95"
        onClick={e => e.stopPropagation()}>
        <img src="/logo.webp" alt="" width={56} height={56} className="w-14 h-14 mx-auto object-contain" />
        <h2 id="install-title" className="font-display text-2xl font-bold text-ink mt-4">Instalá la app</h2>
        <p className="text-sm text-ink-2 mt-2 leading-relaxed">
          Sumá Supercontinental a tu pantalla de inicio: se abre a pantalla completa, sin la barra del navegador.
        </p>
        <div className="mt-6 space-y-2">
          <button type="button" onClick={onInstall} className="btn btn-primary btn-lg w-full">
            <Download className="w-4 h-4" aria-hidden="true" />Instalar
          </button>
          <button type="button" onClick={onClose} className="btn btn-ghost w-full">Ahora no</button>
        </div>
      </div>
    </div>
  );
});
