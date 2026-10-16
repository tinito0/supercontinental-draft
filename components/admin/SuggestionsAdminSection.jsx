import React, { useState, useEffect, useCallback, memo } from 'react';
import { getDocs, query } from 'firebase/firestore';
import { MessageSquarePlus, RefreshCw } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState.jsx';

export const SuggestionsAdminSection = memo(function SuggestionsAdminSection({ getSuggestionsCollectionRef, showStatusMessage }) {
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Se lee bajo demanda (no hay listener): "Actualizar" trae las sugerencias nuevas sin recargar la página.
  const fetchSuggestions = useCallback(async () => {
    setIsLoading(true);
    try {
      const snapshot = await getDocs(query(getSuggestionsCollectionRef()));
      const suggestionList = snapshot.docs.map(doc => ({
        id: doc.id, ...doc.data(), timestamp: doc.data().timestamp?.toDate(),
      })).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setSuggestions(suggestionList);
      setHasLoaded(true);
    } catch (error) {
      console.error(error);
      showStatusMessage('error', 'Error al cargar sugerencias.');
    }
    setIsLoading(false);
  }, [getSuggestionsCollectionRef, showStatusMessage]);

  useEffect(() => { fetchSuggestions(); }, [fetchSuggestions]);

  if (isLoading && !hasLoaded) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Cargando sugerencias">
        {[0, 1, 2].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-xs text-ink-3">
          Sugerencias enviadas por los equipos desde el buzón. <span className="num">{suggestions.length}</span> en total.
        </p>
        <button type="button" onClick={fetchSuggestions} disabled={isLoading} className="btn btn-ghost btn-sm self-end sm:self-auto">
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} aria-hidden="true" />
          {isLoading ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>
      {suggestions.length === 0 ? (
        <EmptyState icon={MessageSquarePlus} title="Buzón vacío" description="Cuando un equipo mande una sugerencia aparece acá." />
      ) : (
        <ul className="space-y-3">
          {suggestions.map(sug => (
            <li key={sug.id} className="bg-raised/40 p-4 rounded-xl border border-line/15">
              <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-ink text-sm truncate">{sug.teamName || 'Anónimo'}</span>
                  {sug.userId && <span className="text-xs text-ink-3 font-mono" title={sug.userId}>({sug.userId.substring(0, 5)}…)</span>}
                </div>
                <span className="text-xs text-ink-3">
                  {sug.timestamp ? sug.timestamp.toLocaleString('es-AR') : 'Sin fecha'}
                </span>
              </div>
              <p className="text-ink-2 text-sm leading-relaxed whitespace-pre-wrap break-words">{sug.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

export default SuggestionsAdminSection;
