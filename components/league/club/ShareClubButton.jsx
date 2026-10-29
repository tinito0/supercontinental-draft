import React, { useEffect, useState } from 'react';
import { Check, Share2 } from 'lucide-react';

/* Compartir la página de un club: el menú de compartir del teléfono (navigator.share) y, donde no existe, copiar el
   link. El link es el de la web pública, que ya trae su vista previa (scripts/build-share-pages.mjs). */

const COPIED_MS = 2500;

/**
 * @param {{ teamId: string, teamName: string }} props
 */
export function ShareClubButton({ teamId, teamName }) {
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!status) return undefined;
    const timer = setTimeout(() => setStatus(''), COPIED_MS);
    return () => clearTimeout(timer);
  }, [status]);

  const share = async () => {
    const url = `${window.location.origin}/equipos/${teamId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: teamName, url });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setStatus('Link copiado');
    } catch (err) {
      console.warn('[ShareClubButton] no se pudo copiar el link:', err);
      setStatus('No se pudo copiar: copiá la dirección del navegador');
    }
  };

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button type="button" onClick={share} className="btn btn-secondary min-h-11">
        {status === 'Link copiado' ? <Check className="h-4 w-4" aria-hidden="true" /> : <Share2 className="h-4 w-4" aria-hidden="true" />}
        Compartir
      </button>
      <p className="min-h-5 text-sm text-ink-2" role="status">{status}</p>
    </div>
  );
}

export default ShareClubButton;
