import React from 'react';
import { Gamepad2 } from 'lucide-react';
import { confirmAction } from '../ui/ConfirmDialog.jsx';

// Matches imported by the collector (utils/collectorImport.js) carry `importedFrom`. Their result came from the game,
// so the editor keeps score, shootout and scorers read-only until the admin chooses to correct them by hand.

export const isFromGame = match => Boolean(match?.importedFrom);

/** Plain source note next to the match date. */
export function FromGameNote({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium normal-case tracking-normal text-ink-3 ${className}`}>
      <Gamepad2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />Del juego
    </span>
  );
}

/** Edit-mode line on an imported match: says why the result is locked and offers the manual correction. */
export function FromGameLock({ onUnlock, compact = false }) {
  const unlock = async () => {
    const isConfirmed = await confirmAction({
      title: '¿Corregir a mano un partido del juego?',
      message: 'El resultado lo cargó el colector. Si lo cambiás, el torneo deja de coincidir con lo que pasó en el juego.',
      confirmLabel: 'Corregir a mano',
      tone: 'primary',
    });
    if (isConfirmed) onUnlock();
  };
  return (
    <div className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-ink-3 ${compact ? 'border-t border-line/[0.08] bg-raised px-3 py-1' : 'mt-2'}`}>
      <span>Resultado del juego, bloqueado.</span>
      <button type="button" onClick={unlock} className="min-h-11 font-semibold text-accent-soft hover:text-ink transition-colors cursor-pointer">
        Corregir a mano
      </button>
    </div>
  );
}
