import React, { useState } from 'react';
import { Save, Undo2 } from 'lucide-react';
import { Alert } from '../../ui/Alert.jsx';

/**
 * Save controls next to the work. Saving covers every unsaved change of the workspace (the engine saves
 * drafts as one history), so the label says so; discarding only touches this team's changes and asks first,
 * because it cannot be undone.
 */
export function TeamSaveBar({ teamCount, totalCount, busy, onSave, onDiscard }) {
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  if (!teamCount) return null;
  const run = fn => async () => {
    setError(null);
    setConfirming(false);
    try { await fn(); } catch (e) { setError(e); }
  };
  return (
    <div className="panel sticky bottom-[env(safe-area-inset-bottom)] z-10 px-4 py-3">
      {error && <Alert tone="danger" className="mb-3">{error.message || String(error)}</Alert>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2" role={confirming ? 'alert' : undefined}>
          {confirming ? (
            <>¿Descartar <span className="num font-semibold text-warning-soft">{teamCount}</span> cambio{teamCount === 1 ? '' : 's'} de este equipo? No se puede deshacer.</>
          ) : (
            <>
              <span className="num font-semibold text-warning-soft">{teamCount}</span> cambio{teamCount === 1 ? '' : 's'} sin guardar en este equipo
              {totalCount > teamCount && <span className="text-ink-3"> (<span className="num">{totalCount}</span> en total)</span>}
              <span className="block text-xs text-ink-3">Quedan en este navegador hasta que toques Guardar.</span>
            </>
          )}
        </p>
        <div className="flex gap-2">
          {confirming ? (
            <>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)}>Cancelar</button>
              <button type="button" className="btn btn-danger btn-sm" disabled={Boolean(busy)} onClick={run(onDiscard)}>
                <Undo2 className="w-4 h-4" aria-hidden="true" />Sí, descartar
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-ghost btn-sm" disabled={Boolean(busy)} onClick={() => setConfirming(true)}>
                <Undo2 className="w-4 h-4" aria-hidden="true" />Descartar los de este equipo
              </button>
              <button type="button" className="btn btn-primary btn-sm" disabled={Boolean(busy)} onClick={run(onSave)}>
                <Save className="w-4 h-4" aria-hidden="true" />Guardar todo <span className="num">({totalCount})</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
