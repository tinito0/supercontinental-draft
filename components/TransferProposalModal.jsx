import React, { useRef, useState } from 'react';
import { X, Send, AlertTriangle } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { APP_ID, DEFAULT_LOGO, MAX_TRANSFER_MULTIPLIER, TRANSFER_FEE_RATE } from '../utils/constants.js';

export const TransferProposalModal = ({ isVisible, onClose, player, targetTeamName, targetTeamId, senderId, senderTeamName, senderTeamLogo }) => {
  const [offerAmount, setOfferAmount] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  if (!isVisible) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return;
    if (!senderId || !targetTeamId || senderId === targetTeamId) {
      setError('No puedes enviarte una oferta a tu propio equipo.');
      return;
    }

    if (!offerAmount || isNaN(offerAmount) || offerAmount <= 0) {
      setError('Por favor, ingresa un monto válido.');
      return;
    }
    
    if (Number(offerAmount) < player.Precio) {
      setError(`La oferta debe ser al menos el valor base del jugador ($${(player.Precio).toFixed(2)}M).`);
      return;
    }

    const maxOfferAmount = Math.round(Number(player.Precio) * MAX_TRANSFER_MULTIPLIER * 100) / 100;
    if (Number(offerAmount) > maxOfferAmount) {
      setError(`La oferta no puede superar el límite máximo de $${maxOfferAmount.toFixed(2)}M (115% del valor base).`);
      return;
    }
    
    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      const proposalRef = collection(db, `artifacts/${APP_ID}/public/data/offers`);
      const nowIso = new Date().toISOString();
      const numericOffer = Math.round(Number(offerAmount) * 1000000);
      await addDoc(proposalRef, {
        playerId: player.Id,
        playerName: player.Name,
        playerOvr: player.OVR_CALCULADO || 0,
        playerPosition: player.POS_NOMBRE || '',
        playerCountry: player.Country1 || '',
        targetTeamId,
        targetTeamName: targetTeamName || 'Equipo rival',
        senderId,
        senderTeamName: senderTeamName || 'Tu equipo',
        senderTeamLogo: senderTeamLogo || '',
        offerAmount: numericOffer,
        message: message.trim(),
        status: 'pending',
        createdAt: nowIso,
        history: [{
          type: 'sent',
          title: 'Oferta enviada',
          teamId: senderId,
          teamName: senderTeamName || 'Tu equipo',
          amount: numericOffer,
          message: message.trim(),
          at: nowIso,
        }],
        timestamp: serverTimestamp(),
      });
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Error enviando propuesta:', err);
      setError('Hubo un error al enviar la propuesta. Inténtalo de nuevo.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-full max-w-md h-[100dvh] sm:h-auto sm:max-h-[90vh] bg-white dark:bg-[#0c1017] border-0 sm:border border-slate-200 dark:border-slate-800 sm:rounded-2xl shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200 flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Proponer Traspaso</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Oferta a <span className="text-sky-600 dark:text-sky-400 font-semibold">{targetTeamName}</span> por <span className="text-slate-900 dark:text-white font-semibold">{player.Name}</span></p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center flex flex-col items-center">
            <div className="w-14 h-14 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-4">
              <Send size={28} />
            </div>
            <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-1">¡Propuesta Enviada!</h4>
            <p className="text-slate-500 dark:text-slate-400 text-xs">El mánager de {targetTeamName} ha sido notificado.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-3.5 flex items-center gap-3.5">
              <div className="flex flex-col items-center gap-1 shrink-0">
                <img
                  src={senderTeamLogo || DEFAULT_LOGO}
                  alt={senderTeamName || 'Equipo'}
                  className="w-11 h-11 rounded-lg object-contain bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1"
                  onError={(e) => { e.target.src = DEFAULT_LOGO; }}
                />
                <span className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold max-w-16 truncate">{senderTeamName || 'Tu equipo'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold tracking-wider">Pide traspaso por</p>
                <div className="flex items-center gap-2.5 mt-1.5">
                  <img
                    src={`/fotos_jugadores/${player.Id}.webp`}
                    alt={player.Name}
                    className="w-12 h-12 rounded-lg object-cover bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    onError={(e) => { e.target.src = `https://placehold.co/56x56/111/333?text=${player.Name?.[0] || '?'}`; }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{player.Name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{targetTeamName}</p>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs">
                <AlertTriangle size={15} />
                <span>{error}</span>
              </div>
            )}
            
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Monto Ofrecido (En Millones)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                <input
                  type="number"
                  step="0.1"
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-7 pr-10 py-2.5 text-slate-900 dark:text-white font-semibold text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
                  placeholder={`Ej. ${(player.Precio).toFixed(2)}`}
                  required
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">M</span>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                Máximo: ${(Math.round(Number(player.Precio) * MAX_TRANSFER_MULTIPLIER * 100) / 100).toFixed(2)}M. El vendedor recibe el {Math.round((1 - TRANSFER_FEE_RATE) * 100)}%; comisión {Math.round(TRANSFER_FEE_RATE * 100)}%.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Mensaje (Opcional)</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all resize-none"
                placeholder="Escribe un mensaje para convencer al otro equipo..."
                rows="3"
              ></textarea>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500 text-white font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 text-xs uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Send size={15} /> Enviar Oferta
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
