import React, { useState, useEffect, memo } from 'react';
import { getDocs, query } from 'firebase/firestore';

export const SuggestionsAdminSection = memo(function SuggestionsAdminSection({ getSuggestionsCollectionRef, showStatusMessage }) {
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSuggestions = async () => {
      setIsLoading(true);
      try {
        const suggestionsQuery = query(getSuggestionsCollectionRef());
        const snapshot = await getDocs(suggestionsQuery);
        const suggestionList = snapshot.docs.map(doc => ({
          id: doc.id, ...doc.data(), timestamp: doc.data().timestamp?.toDate()
        })).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setSuggestions(suggestionList);
      } catch (error) {
        console.error(error); showStatusMessage('error', 'Error al cargar sugerencias.');
      }
      setIsLoading(false);
    };
    fetchSuggestions();
  }, [getSuggestionsCollectionRef, showStatusMessage]);

  if (isLoading) return <div className="text-center p-8"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div></div>;

  return (
    <div className="space-y-4">
      {suggestions.length === 0 ? (
        <p className="text-gray-500 italic text-center py-8">Bandeja de entrada vacía.</p>
      ) : (
        suggestions.map(sug => (
          <div key={sug.id} className="bg-gray-800/40 p-4 rounded-xl border border-gray-700/50 hover:border-gray-600 transition shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                <span className="font-bold text-white text-sm">{sug.teamName || 'Anónimo'}</span>
                <span className="text-xs text-gray-500 font-mono">({sug.userId?.substring(0, 5)}...)</span>
              </div>
              <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wide bg-gray-900/50 px-2 py-1 rounded">
                {sug.timestamp ? sug.timestamp.toLocaleString('es-ES') : '-'}
              </span>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed bg-gray-900/30 p-3 rounded-lg border border-gray-700/30">{sug.text}</p>
          </div>
        ))
      )}
    </div>
  );
});

export default SuggestionsAdminSection;
