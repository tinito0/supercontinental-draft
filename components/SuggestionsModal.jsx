import React, { useState, memo } from 'react';
import { X, Save, MessageSquarePlus } from 'lucide-react';
import { addDoc } from 'firebase/firestore';
import { BaseModal } from './ui/BaseModal.jsx';

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

  // No early return while hidden: BaseModal needs isOpen to go false to play its exit.
  return (
    <BaseModal
      isOpen={isVisible}
      onClose={onClose}
      size="md"
      showClose={false}
      className="!p-0 !bg-surface/95 !max-w-lg"
      contentClassName="!p-0 !overflow-hidden flex flex-col"
    >
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-center p-4 sm:p-5 border-b border-line/20 bg-raised/80 backdrop-blur-md sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-bold text-ink flex items-center">
              <MessageSquarePlus className="w-6 h-6 mr-3 text-success-soft" /> Buzón de Sugerencias
            </h2>
          </div>
          <button onClick={onClose} className="text-ink-3 hover:text-ink p-2 hover:bg-overlay rounded-full transition">
            <X size={24} />
          </button>
        </div>

        <div className="p-4 sm:p-6 flex-grow min-h-0 overflow-y-auto custom-scrollbar">
          <form onSubmit={handleSubmit} className="space-y-5 h-full flex flex-col">
            <div className="bg-blue-900/20 p-4 rounded-xl border border-blue-500/20">
              <p className="text-blue-200 text-sm leading-relaxed">
                ¿Encontraste un bug? ¿Un precio desactualizado? ¿Tienes una idea genial?
                <br /><span className="text-blue-400 font-bold block mt-1">¡Tu feedback nos ayuda a mejorar!</span>
              </p>
            </div>

            <div className="flex-grow">
              <label className="block text-xs font-bold text-ink-3 uppercase mb-2 ml-1">Tu Mensaje</label>
              <textarea
                value={suggestionText}
                onChange={(e) => setSuggestionText(e.target.value)}
                rows="6"
                className="w-full h-40 sm:h-auto p-4 bg-black/20 text-ink border border-line/20 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none placeholder-slate-600 text-base transition-all"
                placeholder="Escribe aquí tu reporte o sugerencia..."
                autoFocus
              ></textarea>
              <p className="text-right text-xs text-ink-3 mt-1">{suggestionText.length} caracteres</p>
            </div>

            <div className="flex justify-end gap-3 pt-2 mt-auto">
              <button type="button" onClick={onClose} className="px-5 py-3 sm:py-2.5 text-ink-3 font-bold hover:text-ink hover:bg-overlay rounded-xl transition w-full sm:w-auto">Cancelar</button>
              <button type="submit" disabled={isSending || suggestionText.trim().length < 10} title={isSending ? 'Hay una operación en curso' : suggestionText.trim().length < 10 ? 'Completa los datos requeridos primero' : undefined} className="flex items-center justify-center px-6 py-3 sm:py-2.5 btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 w-full sm:w-auto">
                {isSending ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><Save className="w-4 h-4 mr-2" /> Enviar</>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </BaseModal>
  );
});
