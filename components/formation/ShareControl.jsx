import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Link2Off, Loader2, RefreshCw, Share2 } from 'lucide-react';

/**
 * «Compartir» in the board's header (audit PIZ-8, PIZ-10). The first press creates the club's public link and copies
 * it; with a link already made it opens the panel: copy, update it with the board as it is now, or stop sharing.
 * `share` is the useBoardShare() result.
 */
export function ShareControl({ share }) {
  const [isOpen, setIsOpen] = useState(false);
  const areaRef = useRef(null);
  const { shareUrl, isShared, isBusy, copied } = share;

  useEffect(() => {
    if (!isOpen) return undefined;
    const onPointer = e => { if (!areaRef.current?.contains(e.target)) setIsOpen(false); };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); setIsOpen(false); } };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [isOpen]);

  const toggle = async () => {
    if (isOpen) { setIsOpen(false); return; }
    share.resetCopied();
    if (!isShared) await share.share();
    setIsOpen(true);
  };

  const label = isShared ? 'Link público' : 'Compartir';
  return (
    <div className="sm:relative" ref={areaRef}>
      <button type="button" onClick={toggle} disabled={isBusy} aria-expanded={isOpen} aria-haspopup="dialog"
        aria-label={label} className="btn btn-secondary btn-icon sm:w-auto sm:px-4">
        {isBusy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Share2 className="w-4 h-4" aria-hidden="true" />}
        <span className="hidden sm:inline">{label}</span>
      </button>
      {isOpen && (
        <div role="dialog" aria-label="Link público de la táctica"
          className="absolute inset-x-3 top-full mt-2 sm:inset-x-auto sm:right-0 sm:w-[22rem] panel p-3 z-50 space-y-3">
          {isShared ? (
            <>
              <div className="flex items-center gap-2">
                <input type="text" readOnly value={shareUrl} aria-label="Link público de la táctica"
                  className="input flex-1 min-w-0 min-h-11 text-xs font-mono" onFocus={e => e.target.select()} />
                <button type="button" onClick={share.copyAgain} className="btn btn-primary shrink-0">
                  <Copy className="w-4 h-4" aria-hidden="true" />Copiar
                </button>
              </div>
              <p className="text-xs text-ink-2" role="status">
                {copied
                  ? <span className="inline-flex items-center gap-1.5 text-success-soft font-semibold"><Check className="w-3.5 h-3.5" aria-hidden="true" />Link copiado</span>
                  : 'Cualquiera con el link ve tu once y tus suplentes.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={share.share} disabled={isBusy} className="btn btn-secondary btn-sm">
                  <RefreshCw className="w-4 h-4" aria-hidden="true" />Actualizar con la táctica actual
                </button>
                <button type="button" onClick={async () => { await share.unshare(); setIsOpen(false); }} disabled={isBusy} className="btn btn-ghost btn-sm text-danger-soft">
                  <Link2Off className="w-4 h-4" aria-hidden="true" />Dejar de compartir
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-2">Todavía no compartiste la táctica. Tocá «Compartir» para crear el link.</p>
          )}
        </div>
      )}
    </div>
  );
}
