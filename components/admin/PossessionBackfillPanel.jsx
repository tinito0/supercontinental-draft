import React, { useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { backfillPossession } from '../../services/possessionBackfillService.js';

/* Administración → Torneo: completa la posesión de los partidos ya jugados para las estadísticas de los clubes. Los
   partidos nuevos ya la traen (match-feed); este botón es para los que se guardaron antes. Se puede tocar más de una
   vez: solo lee los que faltan. */

export function PossessionBackfillPanel({ showStatusMessage }) {
  const [state, setState] = useState({ busy: false, progress: null, result: null });
  const run = async () => {
    setState({ busy: true, progress: null, result: null });
    try {
      const result = await backfillPossession((done, total) => setState(s => ({ ...s, progress: { done, total } })));
      setState({ busy: false, progress: null, result });
    } catch (error) {
      console.error('[PossessionBackfillPanel]', error);
      setState({ busy: false, progress: null, result: null });
      showStatusMessage?.('error', 'No se pudo completar la posesión. Revisá la conexión y probá de nuevo.');
    }
  };
  const { busy, progress, result } = state;
  return (
    <section className="panel space-y-3 p-5" aria-labelledby="admin-possession">
      <h2 id="admin-possession" className="section-title">Posesión de partidos viejos</h2>
      <p className="text-sm text-ink-2">
        La pestaña Estadísticas de cada club muestra la posesión promedio. Los partidos que se jugaron antes de este cambio
        no la tienen en el resumen de la temporada: este botón la copia del registro completo de cada partido.
      </p>
      <button type="button" className="btn btn-secondary min-h-11" onClick={run} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
        {busy ? (progress ? `Completando ${progress.done} de ${progress.total}…` : 'Buscando partidos…') : 'Completar posesión'}
      </button>
      {result && (
        <p className="text-sm text-ink-2" role="status">
          {result.updated + result.withoutData === 0
            ? 'No faltaba nada: todos los partidos ya tenían la posesión.'
            : <>Listo: <span className="num font-semibold text-ink">{result.updated}</span> {result.updated === 1 ? 'partido completado' : 'partidos completados'}
              {result.withoutData > 0 && <>; en <span className="num font-semibold text-ink">{result.withoutData}</span> el juego no la contó</>}.</>}
        </p>
      )}
    </section>
  );
}
