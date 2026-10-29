import React, { useRef, useState } from 'react';
import { X, Send, AlertTriangle } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { offerExpiresAt } from '../supabase/functions/_shared/offerExpiry.js';
import { BaseModal } from './ui/BaseModal.jsx';
import { db } from '../config/firebase.js';
import { APP_ID, DEFAULT_LOGO, MAX_TRANSFER_MULTIPLIER, TRANSFER_FEE_RATE } from '../utils/constants.js';
import { playerPlaceholder } from '../utils/playerPlaceholder.js';

export const TransferProposalModal = ({ isVisible, onClose, player, targetTeamName, targetTeamId, senderId, senderTeamName, senderTeamLogo, remainingBudget }) => {
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
      setError('No podés ofertar por un jugador de tu propio equipo.');
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

    const numericOffer = Math.round(Number(offerAmount) * 1000000);
    if (remainingBudget !== undefined && numericOffer > remainingBudget) {
      setError(`No te alcanza el presupuesto: tenés $${((remainingBudget || 0) / 1000000).toFixed(2)}M disponibles.`);
      return;
    }
    
    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      const proposalRef = collection(db, `artifacts/${APP_ID}/public/data/offers`);
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
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
        // The seller has 48 hours to answer; after that the offer stops holding this club's money.
        expiresAtMs: offerExpiresAt(nowMs),
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
    <BaseModal
      isOpen={isVisible}
      onClose={onClose}
      size="md"
      showClose={false}
      ariaLabel={`Proponer traspaso por ${player.Name}`}
      className="!p-0"
      contentClassName="!p-0 !overflow-hidden flex flex-col"
    >
      <div 
        className="w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] bg-surface flex flex-col relative"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-line/20 flex items-center justify-between bg-surface/60">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-ink">Proponer traspaso</h3>
            <p className="text-xs text-ink-3">Oferta a <span className=" text-accent-soft font-semibold">{targetTeamName}</span> por <span className=" text-ink font-semibold">{player.Name}</span></p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="w-11 h-11 shrink-0 flex items-center justify-center text-ink-3 hover:text-ink rounded-lg hover:bg-raised transition-colors">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center flex flex-col items-center">
            <div className="w-14 h-14 bg-success/10 text-success-soft rounded-full flex items-center justify-center mb-4">
              <Send size={28} />
            </div>
            <h4 className="text-lg font-bold text-ink mb-1">¡Propuesta Enviada!</h4>
            <p className=" text-ink-3 text-xs">El mánager de {targetTeamName} ha sido notificado.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
            <div className="rounded-xl border border-line/20 bg-surface/40 p-3.5 flex items-center gap-3.5">
              <div className="flex flex-col items-center gap-1 shrink-0">
                <img
                  src={senderTeamLogo || DEFAULT_LOGO}
                  alt={senderTeamName || 'Equipo'}
                  width={44}
                  height={44}
                  className="w-11 h-11 rounded-lg object-contain bg-raised border border-line/20 p-1"
                  onError={(e) => { e.target.src = DEFAULT_LOGO; }}
                />
                <span className="text-[11px] text-ink-3 font-semibold max-w-16 truncate">{senderTeamName || 'Tu equipo'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-ink-3 uppercase font-semibold tracking-wider">Pide traspaso por</p>
                <div className="flex items-center gap-2.5 mt-1.5">
                  <img
                    src={`/fotos_jugadores/${player.Id}.webp`}
                    alt={player.Name}
                    className="w-12 h-12 rounded-lg object-cover bg-raised border border-line/20"
                    onError={(e) => { e.target.src = playerPlaceholder(player.Name?.[0] || '?'); }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink truncate">{player.Name}</p>
                    <p className="text-xs text-ink-3 font-medium">{targetTeamName}</p>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg flex items-center gap-2 text-danger-soft text-xs">
                <AlertTriangle size={15} />
                <span>{error}</span>
              </div>
            )}
            
            <div>
              <label htmlFor="offer-amount-input" className="block text-xs font-semibold text-ink-2 mb-1.5">Monto Ofrecido (En Millones)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3 font-bold text-sm">$</span>
                <input
                  id="offer-amount-input"
                  type="number"
                  step="0.1"
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(e.target.value)}
                  className="w-full bg-surface border border-line/20 rounded-xl pl-7 pr-10 py-2.5 text-ink font-semibold text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-[border-color,box-shadow]"
                  placeholder={`Ej. ${(player.Precio).toFixed(2)}`}
                  required
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-3 font-bold text-xs">M</span>
              </div>
              <div className="flex items-center justify-between mt-1.5 text-[11px] text-ink-3">
                <span>Máximo: ${(Math.round(Number(player.Precio) * MAX_TRANSFER_MULTIPLIER * 100) / 100).toFixed(2)}M</span>
                {remainingBudget !== undefined && (
                  <span className="font-semibold text-accent-soft">
                    Disponible: ${((remainingBudget || 0) / 1000000).toFixed(2)}M
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-ink-3">
                El vendedor recibe el {Math.round((1 - TRANSFER_FEE_RATE) * 100)}%; comisión {Math.round(TRANSFER_FEE_RATE * 100)}%.
              </p>
            </div>

            <div>
              <label htmlFor="offer-message-input" className="block text-xs font-semibold text-ink-2 mb-1.5">Mensaje (Opcional)</label>
              <textarea
                id="offer-message-input"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-surface border border-line/20 rounded-xl px-3.5 py-2.5 text-ink text-xs focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-[border-color,box-shadow] resize-none"
                placeholder="Un mensaje para convencer al otro club (opcional)…"
                rows="3"
              ></textarea>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                title={isSubmitting ? 'Hay una operación en curso' : undefined}
                className="w-full bg-accent hover:bg-accent text-ink font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 text-xs uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
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
    </BaseModal>
  );
};
