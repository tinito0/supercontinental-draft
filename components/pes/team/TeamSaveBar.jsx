import React, { useRef, useState } from 'react';
import { Save, Undo2 } from 'lucide-react';
import { Alert } from '../../ui/Alert.jsx';
import { useExitAnimation } from '../../../hooks/usePresence.js';

/**
 * Save controls next to the work. Saving covers every unsaved change of the workspace (the engine saves
 * drafts as one history), so the label says so; discarding only touches this team's changes and asks first,
 * because it cannot be undone. The bar rises in when the team gets its first change and drops out once saved.
 */
export function TeamSaveBar({ teamCount, totalCount, busy, onSave, onDiscard }) {
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  // The last counts stay on screen while the bar leaves (derived during render, like SoftValue).
  const [shown, setShown] = useState(teamCount ? { teamCount, totalCount } : null);
  if (teamCount && (shown?.teamCount !== teamCount || shown?.totalCount !== totalCount)) setShown({ teamCount, totalCount });
  const ref = useRef(null);
  const leaving = !teamCount && shown != null;
  useExitAnimation(ref, leaving, () => { setShown(null); setConfirming(false); });
  if (!shown) return null;

  const run = fn => async () => {
    setError(null);
    setConfirming(false);
    try { await fn(); } catch (e) { setError(e); }
  };
  const { teamCount: count, totalCount: total } = shown;
  const many = count === 1 ? '' : 's';
  return (
    <div ref={ref} data-closing={leaving || undefined} inert={leaving ? '' : undefined}
      className="save-bar panel sticky bottom-[env(safe-area-inset-bottom)] z-10 px-4 py-3">
      {error && <Alert tone="danger" className="mb-3">{error.message || String(error)}</Alert>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p key={confirming ? 'confirm' : 'count'} className="status-swap flex-col text-sm text-ink-2" role={confirming ? 'alert' : undefined}>
          {confirming ? (
            <span>¿Descartar <span className="num font-semibold text-warning-soft">{count}</span> cambio{many} de este equipo? No se puede deshacer.</span>
          ) : (
            <>
              <span>
                <span className="num font-semibold text-warning-soft">{count}</span> cambio{many} sin guardar en este equipo
                {total > count && <span className="text-ink-3"> (<span className="num">{total}</span> en total)</span>}
              </span>
              <span className="text-xs text-ink-3">Quedan en este navegador hasta que toques Guardar.</span>
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {confirming ? (
            <>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)} autoFocus>Cancelar</button>
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
                <Save className="w-4 h-4" aria-hidden="true" />Guardar todo <span className="num">({total})</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
