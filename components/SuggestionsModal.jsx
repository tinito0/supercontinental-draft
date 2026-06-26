import React, { useState, memo } from 'react';
import { X, Save, MessageSquarePlus } from 'lucide-react';
import { addDoc } from 'firebase/firestore';

export const SuggestionsModal = memo(function SuggestionsModal({ isVisible, onClose, teamName, userId, getSuggestionsCollectionRef, showStatusMessage }) {
  const [suggestionText, setSuggestionText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (suggestionText.trim().length < 10) {
      showStatusMessage('error', 'El mensaje es muy corto (mínimo 10 caracteres).');
      return;
    }
    setIsSending(true);
    try {
      await addDoc(getSuggestionsCollectionRef(), {
        text: suggestionText,
        userId: userId,
        teamName: teamName,
        timestamp: new Date()
      });
      showStatusMessage('success', '¡Mensaje enviado! Gracias por tu aporte.');
      setSuggestionText('');
      onClose();
    } catch (e) {
      console.error(e);
      showStatusMessage('error', 'Error al enviar.');
    }
    setIsSending(false);
  };

  if (!isVisible) return null;

  return (
    // MODIFICADO: p-0 en móvil
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-0 sm:p-4 animate-in fade-in duration-300" onClick={onClose}>
      <div className="bg-gray-900/95 sm:rounded-2xl shadow-2xl w-full max-w-lg h-[100dvh] sm:h-auto sm:max-h-[90vh] flex flex-col border-0 sm:border border-gray-700/50 relative overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-700 bg-gray-800/80 backdrop-blur-md sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center">
              <MessageSquarePlus className="w-6 h-6 mr-3 text-green-400" /> Buzón de Sugerencias
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-2 hover:bg-gray-700 rounded-full transition">
            <X size={24} />
          </button>
        </div>

        <div className="p-4 sm:p-6 bg-gradient-to-b from-gray-900 to-gray-800/50 flex-grow min-h-0 overflow-y-auto custom-scrollbar">
          <form onSubmit={handleSubmit} className="space-y-5 h-full flex flex-col">
            <div className="bg-blue-900/20 p-4 rounded-xl border border-blue-500/20">
              <p className="text-blue-200 text-sm leading-relaxed">
                ¿Encontraste un bug? ¿Un precio desactualizado? ¿Tienes una idea genial?
                <br /><span className="text-blue-400 font-bold block mt-1">¡Tu feedback nos ayuda a mejorar!</span>
              </p>
            </div>

            <div className="flex-grow">
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Tu Mensaje</label>
              <textarea
                value={suggestionText}
                onChange={(e) => setSuggestionText(e.target.value)}
                rows="6"
                className="w-full h-40 sm:h-auto p-4 bg-black/20 text-white border border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none placeholder-gray-600 text-base transition-all"
                placeholder="Escribe aquí tu reporte o sugerencia..."
                autoFocus
              ></textarea>
              <p className="text-right text-xs text-gray-500 mt-1">{suggestionText.length} caracteres</p>
            </div>

            <div className="flex justify-end gap-3 pt-2 mt-auto">
              <button type="button" onClick={onClose} className="px-5 py-3 sm:py-2.5 text-gray-400 font-bold hover:text-white hover:bg-gray-700 rounded-xl transition w-full sm:w-auto">Cancelar</button>
              <button type="submit" disabled={isSending || suggestionText.trim().length < 10} className="flex items-center justify-center px-6 py-3 sm:py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold rounded-xl shadow-lg transition transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 w-full sm:w-auto">
                {isSending ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><Save className="w-4 h-4 mr-2" /> Enviar</>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
});
