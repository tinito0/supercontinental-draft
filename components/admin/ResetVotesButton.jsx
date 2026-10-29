import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { resetCommunityVotes } from '../../services/communityAdminService.js';
import { confirmAction } from '../ui/ConfirmDialog.jsx';

/**
 * «Reiniciar votos» de una votación del público: pide confirmación porque borra los votos y no se puede deshacer.
 * @param {{ kind: 'prediction'|'mvp'|'cup', target: string, label: string, total: number,
 *   showStatusMessage?: (tone: string, message: string) => void }} props label: qué se reinicia, para la confirmación
 */
export function ResetVotesButton({ kind, target, label, total, showStatusMessage }) {
  const [busy, setBusy] = useState(false);
  if (!target) return null;

  const reset = async () => {
    const count = Number(total) || 0;
    const votes = `${count} ${count === 1 ? 'voto' : 'votos'}`;
    const isConfirmed = await confirmAction({
      title: `¿Reiniciar los votos de ${label}?`,
      message: `Se borran los ${votes} y todos pueden volver a votar.`,
      confirmLabel: 'Reiniciar votos',
      irreversible: true,
    });
    if (!isConfirmed) return;
    setBusy(true);
    try {
      await resetCommunityVotes(kind, target);
      showStatusMessage?.('success', `${label}: votos reiniciados.`);
    } catch (error) {
      console.error('[ResetVotesButton]', error);
      showStatusMessage?.('error', 'No se pudieron reiniciar los votos. Revisá la conexión.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" className="btn btn-ghost min-h-11" disabled={busy} onClick={reset}>
      <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reiniciar votos
    </button>
  );
}

export default ResetVotesButton;
