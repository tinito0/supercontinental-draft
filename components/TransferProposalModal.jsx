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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-full max-w-md h-[100dvh] sm:h-auto sm:max-h-[90vh] bg-[#111] border-0 sm:border border-white/10 sm:rounded-2xl shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200 flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-black/50">
          <div className="min-w-0">
            <h3 className="text-lg font-black text-white uppercase tracking-wide">Proponer Traspaso</h3>
            <p className="text-xs text-gray-400">Oferta a <span className="text-blue-400 font-bold">{targetTeamName}</span> por <span className="text-white font-bold">{player.Name}</span></p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
            <X size={20} />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mb-4">
              <Send size={32} />
            </div>
            <h4 className="text-xl font-bold text-white mb-2">¡Propuesta Enviada!</h4>
            <p className="text-gray-400 text-sm">El mánager de {targetTeamName} ha sido notificado.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex items-center gap-4">
              <div className="flex flex-col items-center gap-1 shrink-0">
                <img
                  src={senderTeamLogo || DEFAULT_LOGO}
                  alt={senderTeamName || 'Equipo'}
                  className="w-12 h-12 rounded-xl object-contain bg-black/40 border border-white/10 p-1"
                  onError={(e) => { e.target.src = DEFAULT_LOGO; }}
                />
                <span className="text-[9px] text-cyan-300 font-black uppercase max-w-16 truncate">{senderTeamName || 'Tu equipo'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Pide traspaso por</p>
                <div className="flex items-center gap-3 mt-2">
                  <img
                    src={`/fotos_jugadores/${player.Id}.webp`}
                    alt={player.Name}
                    className="w-14 h-14 rounded-xl object-cover bg-black/40 border border-white/10"
                    onError={(e) => { e.target.src = `https://placehold.co/56x56/111/333?text=${player.Name?.[0] || '?'}`; }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-black text-white uppercase italic truncate">{player.Name}</p>
                    <p className="text-xs text-gray-500 font-bold">{targetTeamName}</p>
                  </div>
                </div>
              </div>
            </div>
            {error && (
              <div className="p-3 bg-red-900/30 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}
            
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Monto Ofrecido (En Millones)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                <input
                  type="number"
                  step="0.1"
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl pl-8 pr-12 py-3 text-white font-bold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  placeholder={`Ej. ${(player.Precio).toFixed(2)}`}
                  required
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">M</span>
              </div>
              <p className="mt-2 text-[11px] text-gray-500">
                Máximo: ${(Math.round(Number(player.Precio) * MAX_TRANSFER_MULTIPLIER * 100) / 100).toFixed(2)}M. El vendedor recibe el {Math.round((1 - TRANSFER_FEE_RATE) * 100)}%; el {Math.round(TRANSFER_FEE_RATE * 100)}% restante es comisión de transferencia.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Mensaje (Opcional)</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none"
                placeholder="Escribe un mensaje para convencer al otro equipo..."
                rows="3"
              ></textarea>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl uppercase tracking-widest transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Send size={18} /> Enviar Oferta
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
