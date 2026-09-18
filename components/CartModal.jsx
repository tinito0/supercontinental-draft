import React, { useRef, useState, useEffect, useMemo, memo } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { X, ShoppingCart, DollarSign, Shield, Users, Activity, Calendar, MapPin, ArrowRight, History } from 'lucide-react';
import { formatPriceShort } from '../utils/helpers.js';
import { DEFAULT_BUDGET, APP_ID, MAX_TRANSFER_MULTIPLIER, TRANSFER_FEE_RATE } from '../utils/constants.js';
import { doc, runTransaction, updateDoc, collection, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { TransferPlayerCard } from './TransferPlayerCard.jsx';
import { ProposalChat } from './ProposalChat.jsx';

/* ── Posiciones con paleta unificada del mercado ── */
const POS_COLOR = {
  DC: '#ef4444', SD: '#ef4444', EI: '#ef4444', ED: '#ef4444',
  MC: '#22c55e', MCD: '#22c55e', MO: '#22c55e', MI: '#22c55e', MD: '#22c55e',
  DFC: '#3b82f6', LI: '#3b82f6', LD: '#3b82f6',
  PT: '#eab308',
};

/* ── Umbrales dinámicos de color OVR consistentes con el mercado ── */
const OVR_COLOR_THRESHOLDS = [
  [90, '#1ec9a4'],
  [85, '#a0dd00'],
  [75, '#ffc400'],
  [65, '#ec7d22'],
];
const OVR_COLOR_DEFAULT = '#94a3af';

function getOvrColor(ovr) {
  for (let i = 0; i < OVR_COLOR_THRESHOLDS.length; i++) {
    if (ovr >= OVR_COLOR_THRESHOLDS[i][0]) return OVR_COLOR_THRESHOLDS[i][1];
  }
  return OVR_COLOR_DEFAULT;
}

// ─── KpiCard ────────────────────────────────────────────────────────────────
const KpiCard = memo(function KpiCard({ title, value, icon: Icon, colorClass }) {
  return (
    <div className="flex items-center gap-3.5 rounded-xl px-4 py-3 bg-[#0c1017] border border-white/[0.08] shadow-sm">
      {Icon && (
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#111722] border border-white/[0.08]">
          <Icon className={`w-4 h-4 ${colorClass || 'text-[#00b4d8]'}`} />
        </div>
      )}
      <div>
        <p className="text-xs text-slate-400 font-medium leading-tight">{title}</p>
        <p className="text-lg font-bold text-white leading-tight mt-0.5 tabular-nums">{value}</p>
      </div>
    </div>
  );
});

// ─── CartMiniPlayerCard ─────────────────────────────────────────────────────
const CartMiniPlayerCard = memo(function CartMiniPlayerCard({ player, playerMap, allPlayers, onRemove, onCardClick }) {
  const livePlayer = playerMap ? playerMap.get(String(player.Id)) : allPlayers?.find(p => p.Id === player.Id);
  const precio = livePlayer ? livePlayer.Precio : player.Precio;
  const ovr = player.OVR_CALCULADO || 0;
  const ovrColor = getOvrColor(ovr);
  const posColor = POS_COLOR[player.POS_NOMBRE] || '#94a3af';

  return (
    <div
      className="flex items-center gap-3.5 bg-[#0c1017] hover:bg-[#111722] rounded-xl p-3.5
        border border-white/[0.08] hover:border-[#00b4d8]/40 transition-all duration-200 cursor-pointer group shadow-sm"
      onClick={onCardClick}
    >
      {/* Photo */}
      <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-black/60 border border-white/10">
        <img
          src={`/fotos_jugadores/${player.Id}.webp`}
          alt={player.Name}
          className="w-full h-full object-cover"
          onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/48x48/111/444?text=${player.Name[0]}`; }}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded"
            style={{ backgroundColor: posColor }}
          >
            {player.POS_NOMBRE}
          </span>
          <span
            className="text-xs font-bold px-1.5 py-0.5 rounded-md tabular-nums"
            style={{ color: ovrColor, backgroundColor: 'rgba(255,255,255,0.06)' }}
          >
            {ovr}
          </span>
        </div>
        <p className="text-sm font-semibold text-white group-hover:text-[#00b4d8] truncate leading-tight transition">{player.Name}</p>
        <p className="text-xs text-emerald-400 font-semibold mt-1 tabular-nums">
          {formatPriceShort(precio)}
        </p>
      </div>

      {/* Remove btn */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
          text-slate-400 hover:text-red-400 hover:bg-red-500/15 border border-transparent hover:border-red-500/25 transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer"
        title="Quitar del equipo"
        aria-label={`Quitar a ${player.Name} del equipo`}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
});

const CLOSED_STATUSES = new Set(['accepted', 'rejected', 'withdrawn']);

function getOfferAmount(offer) {
  return offer.status === 'countered' ? offer.counterAmount : offer.offerAmount;
}

function getOfferStatusLabel(status) {
  if (status === 'pending') return 'Pendiente';
  if (status === 'countered') return 'Contraoferta';
  if (status === 'accepted') return 'Aceptada';
  if (status === 'rejected') return 'Rechazada';
  if (status === 'withdrawn') return 'Retirada';
  return 'Negociación';
}

function getOfferTargetName(offer, allTeams) {
  return offer.targetTeamName || allTeams?.[offer.targetTeamId]?.teamName || 'Equipo rival';
}

function getOfferSenderName(offer, allTeams) {
  return offer.senderTeamName || allTeams?.[offer.senderId]?.teamName || 'Equipo comprador';
}

function appendHistory(offer, event) {
  const cleanEvent = Object.fromEntries(
    Object.entries(event).filter(([, value]) => value !== undefined)
  );
  return [...(Array.isArray(offer.history) ? offer.history : []), cleanEvent];
}

const OfferTimeline = memo(function OfferTimeline({ offer }) {
  const history = Array.isArray(offer.history) && offer.history.length > 0
    ? offer.history
    : [{
        type: 'sent',
        title: 'Oferta enviada',
        teamName: offer.senderTeamName || 'Equipo comprador',
        amount: offer.offerAmount,
        message: offer.message || '',
        at: offer.createdAt || offer.timestamp,
      }];

  return (
    <div className="mt-3 space-y-2">
      {history.slice(-4).map((item, index) => (
        <div key={`${item.type || 'event'}-${item.at || index}`} className="rounded-xl bg-black/22 px-3 py-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.035)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-black uppercase text-gray-300">{item.title || 'Movimiento'}</p>
            {item.amount ? <span className="text-[11px] font-black text-emerald-300">{formatPriceShort(item.amount / 1000000)}</span> : null}
          </div>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-600">{item.teamName || 'Equipo'}</p>
          {item.message ? <p className="mt-1 text-xs italic text-gray-500">"{item.message}"</p> : null}
        </div>
      ))}
    </div>
  );
});

const NegotiationCard = memo(function NegotiationCard({
  offer,
  allTeams,
  playerMap,
  allPlayers,
  userId,
  userProfile,
  isIncoming,
  isHistory,
  isProcessing,
  counteringOfferId,
  counterAmount,
  setCounterAmount,
  setCounteringOfferId,
  onAccept,
  onReject,
  onCounter,
  onWithdraw,
}) {
  const livePlayer = playerMap ? playerMap.get(String(offer.playerId)) : allPlayers?.find(p => String(p.Id) === String(offer.playerId));
  const senderName = getOfferSenderName(offer, allTeams);
  const targetName = getOfferTargetName(offer, allTeams);
  const activeAmount = getOfferAmount(offer);
  const transferData = {
    ...offer,
    price: (activeAmount || 0) / 1000000,
    fromTeamId: offer.targetTeamId,
    fromTeamName: targetName,
    fromTeamLogo: offer.targetTeamLogo || allTeams?.[offer.targetTeamId]?.logoUrl,
    teamId: offer.senderId,
    teamName: senderName,
    teamLogo: offer.senderTeamLogo || allTeams?.[offer.senderId]?.logoUrl,
    type: 'transfer',
  };

  return (
    <div className="rounded-2xl bg-[#0c1017] border border-white/[0.08] hover:border-white/[0.14] p-4 sm:p-5 shadow-md transition-all">
      {offer.status === 'accepted' ? (
        <TransferPlayerCard transfer={transferData} player={livePlayer} allTeams={allTeams} compact />
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <img
                src={`/fotos_jugadores/${offer.playerId}.webp`}
                alt={offer.playerName}
                className="h-12 w-12 rounded-xl bg-black/60 border border-white/10 object-cover"
                onError={(event) => { event.currentTarget.style.display = 'none'; }}
              />
              <div className="min-w-0">
                <h4 className="truncate text-sm font-black uppercase text-white">{offer.playerName}</h4>
                <div className="mt-1 flex min-w-0 items-center gap-2 text-[11px] font-black uppercase">
                  <span className="min-w-0 truncate text-[#00b4d8]">{senderName}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  <span className="min-w-0 truncate text-purple-400">{targetName}</span>
                </div>
              </div>
            </div>
            <OfferTimeline offer={offer} />
          </div>

          <div className="w-full shrink-0 lg:w-auto lg:min-w-[250px]">
            <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-[#111722] border border-white/[0.08] px-3.5 py-2.5 shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{getOfferStatusLabel(offer.status)}</span>
              <span className="text-lg font-black text-emerald-400">{formatPriceShort((activeAmount || 0) / 1000000)}</span>
            </div>

            {!isHistory && counteringOfferId === offer.id ? (
              <div className="flex w-full flex-wrap items-center gap-2">
                <div className="relative min-w-[120px] flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    step="0.1"
                    value={counterAmount}
                    onChange={(event) => setCounterAmount(event.target.value)}
                    placeholder="Monto"
                    className="min-h-11 w-full rounded-xl bg-[#111722] border border-white/[0.08] focus:border-[#00b4d8] py-2 pl-7 pr-8 text-sm font-bold text-white outline-none transition-colors"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">M</span>
                </div>
                <button onClick={() => onCounter(offer)} disabled={isProcessing || !counterAmount} className="min-h-11 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 px-4 text-xs font-black uppercase text-amber-300 transition disabled:opacity-50 cursor-pointer">
                  Enviar
                </button>
                <button onClick={() => { setCounteringOfferId(null); setCounterAmount(''); }} className="min-h-11 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] px-4 text-xs font-black uppercase text-slate-300 transition cursor-pointer">
                  Cancelar
                </button>
              </div>
            ) : !isHistory ? (
              <div className="flex w-full flex-wrap gap-2">
                {isIncoming ? (
                  <>
                    <button onClick={() => onReject(offer)} disabled={isProcessing} className="min-h-11 flex-1 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 px-4 text-xs font-black uppercase text-red-300 transition disabled:opacity-50 cursor-pointer">Rechazar</button>
                    <button onClick={() => { setCounteringOfferId(offer.id); setCounterAmount(''); }} disabled={isProcessing} className="min-h-11 flex-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 px-4 text-xs font-black uppercase text-amber-300 transition disabled:opacity-50 cursor-pointer">Contraoferta</button>
                    <button onClick={() => onAccept(offer)} disabled={isProcessing} className="min-h-11 flex-1 rounded-xl bg-[#00b4d8] hover:bg-[#38bdf8] px-4 text-xs font-black uppercase text-[#030712] transition shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer">Aceptar</button>
                  </>
                ) : (
                  <button onClick={() => onWithdraw(offer)} disabled={isProcessing} className="min-h-11 w-full rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 px-4 text-xs font-black uppercase text-red-300 transition disabled:opacity-50 cursor-pointer">
                    Retirar Oferta
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Negotiation Chat between managers */}
      <ProposalChat
        offerId={offer.id}
        userId={userId || userProfile?.uid}
        userProfile={userProfile}
        isClosed={isHistory || ['accepted', 'rejected', 'withdrawn'].includes(offer.status)}
      />
    </div>
  );
});

export const CartModal = memo(function CartModal({ isPage, isVisible, onClose, cart, onRemoveFromCart, userProfile, userId, totalCartCost, remainingBudget, incomingOffers = [], sentOffers = [], offerHistory = [], countryMap, onPlayerClick, allPlayers, allTeams, initialTab = 'players' }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isProcessing, setIsProcessing] = useState(false);
  const processingOfferRef = useRef(null);
  const [counteringOfferId, setCounteringOfferId] = useState(null);
  const [counterAmount, setCounterAmount] = useState('');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isVisible]);

  // Antes: cart.sort(...) directo en el JSX mutaba el array del prop/estado (Array.prototype.sort
  // muta in-place) y volvía a ordenar en cada render. Acá se ordena una copia, una sola vez por cambio de cart.
  const sortedCart = useMemo(() => [...cart].sort((a, b) => b.OVR_CALCULADO - a.OVR_CALCULADO), [cart]);

  const playerMap = useMemo(() => {
    const map = new Map();
    if (Array.isArray(allPlayers)) {
      allPlayers.forEach(p => map.set(String(p.Id), p));
    }
    return map;
  }, [allPlayers]);

  const handleAcceptOffer = async (offer) => {
    if (isProcessing || processingOfferRef.current) return;
    processingOfferRef.current = offer?.id || 'unknown';
    setIsProcessing(true);
    try {
      if (!userId) {
        throw new Error("Debes iniciar sesión para aceptar una oferta.");
      }
      if (!offer?.senderId || !offer?.targetTeamId || offer.senderId === offer.targetTeamId) {
        throw new Error("Oferta invalida: comprador y vendedor no pueden ser el mismo equipo.");
      }

      const livePlayer = playerMap ? playerMap.get(String(offer.playerId)) : allPlayers?.find(p => String(p.Id) === String(offer.playerId));
      if (!livePlayer) throw new Error("Jugador no encontrado en la base de datos.");

      let activeAmount = Number(getOfferAmount(offer));
      if (!Number.isFinite(activeAmount) || activeAmount <= 0) {
        throw new Error("Monto de oferta invalido.");
      }

      // Calcular gasto del comprador sumando sus bloqueos activos en public/data/player_locks
      // (evita leer la colección privada users/{buyerId}/cart, respetando Firestore Rules)
      const locksSnap = await getDocs(collection(db, `artifacts/${APP_ID}/public/data/player_locks`));
      let buyerCartTotal = 0;
      locksSnap.forEach(docSnap => {
        const lock = docSnap.data();
        if (lock.lockedBy === offer.senderId && !lock.isFranchise) {
          const p = playerMap ? playerMap.get(docSnap.id) : allPlayers?.find(pl => String(pl.Id) === docSnap.id);
          if (p) {
            buyerCartTotal += Math.round((Number(p.Precio) || 0) * 1000000);
          }
        }
      });

      await runTransaction(db, async (transaction) => {
        const buyerTeamPublicRef = doc(db, `artifacts/${APP_ID}/public/data/teams`, offer.senderId);
        const sellerTeamPublicRef = doc(db, `artifacts/${APP_ID}/public/data/teams`, offer.targetTeamId);
        const lockRef = doc(db, `artifacts/${APP_ID}/public/data/player_locks`, String(offer.playerId));
        const offerRef = doc(db, `artifacts/${APP_ID}/public/data/offers`, offer.id);
        const buyerCartPrivateRef = doc(db, `artifacts/${APP_ID}/users/${offer.senderId}/cart`, String(offer.playerId));
        const buyerProfilePrivateRef = doc(db, `artifacts/${APP_ID}/users/${offer.senderId}/profile`, 'data');
        const sellerCartPrivateRef = doc(db, `artifacts/${APP_ID}/users/${offer.targetTeamId}/cart`, String(offer.playerId));
        const sellerProfilePrivateRef = doc(db, `artifacts/${APP_ID}/users/${offer.targetTeamId}/profile`, 'data');

        const buyerTeamDoc = await transaction.get(buyerTeamPublicRef);
        const sellerTeamDoc = await transaction.get(sellerTeamPublicRef);
        const offerDoc = await transaction.get(offerRef);
        const lockDoc = await transaction.get(lockRef);

        if (!sellerTeamDoc.exists()) throw new Error("Equipo vendedor no encontrado.");
        if (!buyerTeamDoc.exists()) throw new Error("Equipo comprador no encontrado.");

        const buyerBudget = Number(buyerTeamDoc.data().budget) || 0;
        const sellerBudget = Number(sellerTeamDoc.data().budget) || 0;
        const buyerTeamName = offer.senderTeamName || buyerTeamDoc.data()?.teamName || allTeams?.[offer.senderId]?.teamName || 'Equipo comprador';
        const sellerTeamName = offer.targetTeamName || sellerTeamDoc.data()?.teamName || allTeams?.[offer.targetTeamId]?.teamName || 'Equipo vendedor';
        const buyerTeamLogo = offer.senderTeamLogo || buyerTeamDoc.data()?.logoUrl || allTeams?.[offer.senderId]?.logoUrl || '';
        const sellerTeamLogo = offer.targetTeamLogo || sellerTeamDoc.data()?.logoUrl || allTeams?.[offer.targetTeamId]?.logoUrl || '';

        // Verificar validez de oferta
        if (!offerDoc.exists() || (offerDoc.data().status !== 'pending' && offerDoc.data().status !== 'countered')) {
          throw new Error("La oferta ya no es válida o ya fue procesada.");
        }
        const liveOffer = offerDoc.data();
        const expectedAccepterId = liveOffer.status === 'countered' ? liveOffer.senderId : liveOffer.targetTeamId;
        if (userId !== expectedAccepterId) {
          throw new Error("Solo el equipo que recibió la oferta actual puede aceptarla.");
        }
        activeAmount = Number(getOfferAmount(liveOffer));

        const buyerRemainingBudget = buyerBudget - buyerCartTotal;
        if (!Number.isFinite(activeAmount) || buyerRemainingBudget < activeAmount) {
          throw new Error("El comprador no tiene fondos suficientes.");
        }

        // Verificar propiedad del vendedor
        if (!lockDoc.exists() || lockDoc.data().lockedBy !== offer.targetTeamId) {
          throw new Error("El jugador ya no pertenece al equipo vendedor.");
        }
        if (lockDoc.data().isFranchise) {
          throw new Error('Los jugadores franquicia no son transferibles.');
        }

        const playerBaseCost = Math.round((Number(livePlayer.Precio) || 0) * 1000000);
        // El formulario opera con dos decimales de millones, por eso el tope se
        // redondea a esa misma precisión antes de compararlo con la oferta.
        const maxTransferAmount = Math.round((playerBaseCost / 1000000) * MAX_TRANSFER_MULTIPLIER * 100) * 10000;
        if (!Number.isSafeInteger(activeAmount) || !playerBaseCost || activeAmount < playerBaseCost || activeAmount > maxTransferAmount) {
          throw new Error('El monto ya no cumple los límites del jugador.');
        }

        const acceptedAt = new Date().toISOString();

        // 1. Transferir lock al comprador
        transaction.update(lockRef, {
          lockedBy: offer.senderId,
          teamName: buyerTeamName,
          lockedAt: acceptedAt
        });

        // 2. Calcular presupuestos resultantes
        const buyerBudgetAfter = buyerBudget + playerBaseCost - activeAmount;
        const sellerNetAmount = Math.round(activeAmount * (1 - TRANSFER_FEE_RATE));
        const transferFee = activeAmount - sellerNetAmount;
        const sellerBudgetAfter = sellerBudget + sellerNetAmount - playerBaseCost;

        // 3. Sincronizar rosters y presupuestos públicos en transacción atómica
        const buyerCurrentRoster = Array.isArray(buyerTeamDoc.data().roster) ? buyerTeamDoc.data().roster : [];
        const sellerCurrentRoster = Array.isArray(sellerTeamDoc.data().roster) ? sellerTeamDoc.data().roster : [];
        const newBuyerRoster = [
          ...buyerCurrentRoster.filter(p => String(p.Id) !== String(offer.playerId)),
          {
            Id: String(livePlayer.Id),
            Name: livePlayer.Name || 'Jugador',
            POS_NOMBRE: livePlayer.POS_NOMBRE || '',
            OVR_CALCULADO: Number(livePlayer.OVR_CALCULADO) || 0,
            available: true,
          }
        ];
        const newSellerRoster = sellerCurrentRoster.filter(p => String(p.Id) !== String(offer.playerId));

        transaction.set(buyerTeamPublicRef, {
          budget: buyerBudgetAfter,
          roster: newBuyerRoster,
          rosterUpdatedAt: acceptedAt,
        }, { merge: true });

        transaction.set(sellerTeamPublicRef, {
          budget: sellerBudgetAfter,
          roster: newSellerRoster,
          rosterUpdatedAt: acceptedAt,
        }, { merge: true });

        // El usuario que acepta puede actualizar sus documentos privados dentro de
        // esta misma transacción. Así, una contraoferta aceptada por el comprador
        // no depende de que otro snapshot agregue el jugador más tarde.
        if (userId === offer.senderId) {
          transaction.set(buyerCartPrivateRef, { ...livePlayer, isFranchise: false });
          transaction.set(buyerProfilePrivateRef, { budget: buyerBudgetAfter }, { merge: true });
        } else {
          transaction.delete(sellerCartPrivateRef);
          transaction.set(sellerProfilePrivateRef, { budget: sellerBudgetAfter }, { merge: true });
        }

        // 4. Actualizar estado de la oferta
        transaction.update(offerRef, {
          status: 'accepted',
          acceptedAt,
          targetTeamName: sellerTeamName,
          targetTeamLogo: sellerTeamLogo,
          senderTeamName: buyerTeamName,
          senderTeamLogo: buyerTeamLogo,
          history: appendHistory(offerDoc.data(), {
            type: 'accepted',
            title: 'Traspaso aceptado',
            teamId: offer.targetTeamId,
            teamName: sellerTeamName,
            amount: activeAmount,
            at: acceptedAt,
          })
        });

        // 5. Registrar en el feed de transferencias
        const transferRef = doc(collection(db, `artifacts/${APP_ID}/public/data/transfers`));
        transaction.set(transferRef, {
          playerId: offer.playerId,
          playerName: offer.playerName || livePlayer.Name,
          playerOvr: offer.playerOvr || livePlayer.OVR_CALCULADO || 0,
          playerPosition: offer.playerPosition || livePlayer.POS_NOMBRE || '',
          playerCountry: offer.playerCountry || livePlayer.Country1 || '',
          fromTeamId: offer.targetTeamId,
          fromTeamName: sellerTeamName,
          fromTeamLogo: sellerTeamLogo,
          teamId: offer.senderId,
          teamName: buyerTeamName,
          teamLogo: buyerTeamLogo,
          price: activeAmount / 1000000,
          sellerReceives: sellerNetAmount / 1000000,
          transferFee: transferFee / 1000000,
          type: 'transfer',
          isFranchise: false,
          timestamp: serverTimestamp()
        });
      });
      alert(`¡Traspaso completado! ${offer.playerName} ahora pertenece a ${getOfferSenderName(offer, allTeams)}.`);
    } catch (err) {
      console.error(err);
      alert("Error al aceptar la oferta: " + (err?.message || err));
    } finally {
      processingOfferRef.current = null;
      setIsProcessing(false);
    }
  };

  const handleRejectOffer = async (offer) => {
    if (isProcessing) return;
    if (!window.confirm(`¿Seguro que quieres rechazar la oferta por ${offer.playerName}?`)) return;
    setIsProcessing(true);
    try {
      const offerRef = doc(db, `artifacts/${APP_ID}/public/data/offers`, offer.id);
      const rejectedAt = new Date().toISOString();
      await updateDoc(offerRef, {
        status: 'rejected',
        rejectedAt,
        rejectedBy: userProfile?.teamName || 'Equipo',
        history: appendHistory(offer, {
          type: 'rejected',
          title: 'Oferta rechazada',
          teamId: offer.targetTeamId || offer.senderId,
          teamName: userProfile?.teamName || 'Equipo',
          amount: getOfferAmount(offer),
          at: rejectedAt,
        })
      });
    } catch (err) {
      console.error(err);
      alert("Error al rechazar la oferta.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCounterOffer = async (offer) => {
    if (isProcessing || !counterAmount || isNaN(counterAmount)) return;
    const livePlayer = allPlayers?.find(p => p.Id === offer.playerId);
    const valueInMillions = Number(counterAmount);
    const maxCounterAmount = livePlayer
      ? Math.round(Number(livePlayer.Precio) * MAX_TRANSFER_MULTIPLIER * 100) / 100
      : 0;
    if (!Number.isFinite(valueInMillions) || valueInMillions <= 0 || !livePlayer || valueInMillions < Number(livePlayer.Precio) || valueInMillions > maxCounterAmount) {
      alert(`La contraoferta debe estar entre el valor base y $${maxCounterAmount.toFixed(2)}M (115% del valor base).`);
      return;
    }
    setIsProcessing(true);
    try {
      const proposalRef = doc(db, `artifacts/${APP_ID}/public/data/offers`, offer.id);
      const counterAt = new Date().toISOString();
      const counterValue = Math.round(valueInMillions * 1000000);
      await updateDoc(proposalRef, {
        status: "countered",
        counterAmount: counterValue,
        counterAt,
        counterBy: userProfile?.teamName || 'Equipo',
        history: appendHistory(offer, {
          type: 'countered',
          title: 'Contraoferta enviada',
          teamId: offer.targetTeamId || offer.senderId,
          teamName: userProfile?.teamName || 'Equipo',
          amount: counterValue,
          at: counterAt,
        })
      });
      setCounteringOfferId(null);
      setCounterAmount('');
    } catch (e) {
      console.error(e);
      alert('Error enviando contraoferta');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWithdrawOffer = async (offer) => {
    if (isProcessing) return;
    if (!window.confirm(`¿Seguro que quieres retirar la oferta por ${offer.playerName}?`)) return;
    setIsProcessing(true);
    try {
      const offerRef = doc(db, `artifacts/${APP_ID}/public/data/offers`, offer.id);
      const withdrawnAt = new Date().toISOString();
      await updateDoc(offerRef, {
        status: 'withdrawn',
        withdrawnAt,
        history: appendHistory(offer, {
          type: 'withdrawn',
          title: 'Oferta retirada',
          teamId: offer.senderId || offer.targetTeamId,
          teamName: userProfile?.teamName || 'Equipo',
          amount: getOfferAmount(offer),
          at: withdrawnAt,
        })
      });
    } catch (e) {
      console.error(e);
      alert('Error retirando oferta');
    } finally {
      setIsProcessing(false);
    }
  };



  // --- LÓGICA DE ESTADÍSTICAS ---
  const statsData = useMemo(() => {
    const totalPlayers = cart.length;
    const avgOvr = totalPlayers > 0 ? Math.round(cart.reduce((acc, p) => acc + p.OVR_CALCULADO, 0) / totalPlayers) : 0;
    const avgAge = totalPlayers > 0 ? Math.round(cart.reduce((acc, p) => acc + p.Age, 0) / totalPlayers) : 0;

    // Distribución por posición
    const posCounts = { Arqueros: 0, Defensores: 0, Medios: 0, Delanteros: 0 };
    cart.forEach(p => {
      if (p.Grupo === 'Arqueros') posCounts.Arqueros++;
      else if (p.Grupo === 'Defensores') posCounts.Defensores++;
      else if (p.Grupo === 'Mediocampistas') posCounts.Medios++;
      else posCounts.Delanteros++;
    });

    const positionChartData = {
      labels: ['Porteros', 'Defensas', 'Medios', 'Delanteros'],
      datasets: [{
        data: [posCounts.Arqueros, posCounts.Defensores, posCounts.Medios, posCounts.Delanteros],
        backgroundColor: ['#eab308', '#3b82f6', '#22c55e', '#ef4444'],
        borderColor: '#1f2937',
        borderWidth: 2,
        hoverOffset: 4
      }],
    };

    // Top Nacionalidades
    const countryCounts = {};
    cart.forEach(p => {
      const c = p.Country1;
      countryCounts[c] = (countryCounts[c] || 0) + 1;
    });

    const sortedCountries = Object.entries(countryCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    const countryChartData = {
      labels: sortedCountries.map(([code]) => {
        return countryMap && countryMap[code] ? countryMap[code].substring(0, 10) : code;
      }),
      datasets: [{
        label: 'Jugadores',
        data: sortedCountries.map(([, count]) => count),
        backgroundColor: '#6366f1',
        borderRadius: 6,
        barThickness: 20,
      }]
    };

    return { totalPlayers, avgOvr, avgAge, positionChartData, countryChartData };
  }, [cart, countryMap]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { color: '#9ca3af', font: { size: 11, family: 'system-ui' }, boxWidth: 10, padding: 15 } },
      title: { display: false }
    },
    scales: {
      y: { ticks: { color: '#6b7280', stepSize: 1 }, grid: { color: '#374151', drawBorder: false } },
      x: { ticks: { color: '#9ca3af' }, grid: { display: false } }
    }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right', labels: { color: '#9ca3af', font: { size: 11 }, boxWidth: 12, padding: 15 } }
    }
  };

  if (!isVisible && !isPage) return null;

  const inner = (
    <div className="w-full h-full min-h-0 flex flex-col bg-[#06080d] relative overflow-hidden">
      {/* ── Header ── */}
      <div className="relative z-10 flex justify-between items-center px-4 sm:px-6 py-3.5 sm:py-4 shrink-0 bg-[#0c1017] border-b border-white/[0.08]">
        <div>
          <h2 className="text-base sm:text-xl font-bold text-white flex items-center gap-2.5">
            <DollarSign className="w-5 h-5 text-[#00b4d8]" /> Finanzas & Plantilla
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 font-medium truncate max-w-[220px] sm:max-w-none">
            {userProfile?.teamName || 'Mi Equipo'}
          </p>
        </div>
        {!isPage && (
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* ── Budget Breakdown — Cohesive 4-KPI Card ── */}
      {(() => {
        const initialBudget = userProfile?.budget || DEFAULT_BUDGET || 0;
        const committedInOffers = (sentOffers || [])
          .filter(o => o.status === 'pending' || o.status === 'countered')
          .reduce((sum, o) => sum + (Number(getOfferAmount(o)) || 0), 0);
        const liquidBudget = Math.max(0, remainingBudget - committedInOffers);
        const pct = initialBudget > 0 ? Math.min(100, Math.max(0, (liquidBudget / initialBudget) * 100)) : 0;
        const barColor = pct > 50 ? '#10b981' : pct > 20 ? '#eab308' : '#ef4444';
        const pctTextColor = pct > 50 ? 'text-emerald-400' : pct > 20 ? 'text-amber-400' : 'text-rose-400';
        const availableColor = liquidBudget > 0 ? '#00b4d8' : '#ef4444';

        const fmtM = (val) => {
          const v = Math.abs(val || 0);
          if (v >= 1000000) return `$${(v / 1000000).toFixed(2)}M`;
          if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
          return `$${v}`;
        };

        return (
          <div className="relative z-10 px-3 sm:px-6 py-3 sm:py-4 shrink-0 border-b border-white/[0.08]">
            <div className="rounded-xl sm:rounded-2xl p-4 sm:p-5 bg-[#0c1017] border border-white/[0.08] shadow-xl relative overflow-hidden">
              {/* Subtle top accent highlight */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00b4d8]/40 to-transparent pointer-events-none" />

              {/* Top row: team name + title */}
              <div className="flex items-center justify-between mb-3.5">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  {userProfile?.teamName || 'Mi Equipo'}
                </span>
                <span className="text-[11px] font-black text-[#00b4d8] uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-[#00b4d8]" /> Balance Financiero
                </span>
              </div>

              {/* 4-KPI breakdown row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mb-4">
                <div className="bg-[#111722] p-3 rounded-xl border border-white/[0.08] shadow-sm">
                  <p className="text-sm sm:text-base font-black text-white leading-none">{fmtM(initialBudget)}</p>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mt-1.5">Presupuesto Inicial</p>
                </div>
                <div className="bg-[#111722] p-3 rounded-xl border border-white/[0.08] shadow-sm">
                  <p className={`text-sm sm:text-base font-black leading-none ${totalCartCost > 0 ? 'text-white' : 'text-slate-500'}`}>{fmtM(totalCartCost)}</p>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mt-1.5">Gastado en Plantilla</p>
                </div>
                <div className="bg-[#111722] p-3 rounded-xl border border-white/[0.08] shadow-sm">
                  <p className={`text-sm sm:text-base font-black leading-none ${committedInOffers > 0 ? 'text-amber-400' : 'text-slate-500'}`}>{fmtM(committedInOffers)}</p>
                  <p className="text-[10px] text-amber-400/80 uppercase font-bold tracking-wider mt-1.5">Comprometido Ofertas</p>
                </div>
                <div className="bg-[#111722] p-3 rounded-xl border border-[#00b4d8]/30 shadow-sm">
                  <p className="text-sm sm:text-base font-black leading-none" style={{ color: availableColor }}>{fmtM(liquidBudget)}</p>
                  <p className="text-[10px] text-[#00b4d8] uppercase font-bold tracking-wider mt-1.5">Disponible Líquido</p>
                </div>
              </div>

              {/* Hero: DISPONIBLE & bar */}
              <div className="flex items-center justify-between text-xs mb-1.5 font-bold">
                <span className="text-slate-400 text-[10px] uppercase tracking-wider">Margen Operativo Disponible</span>
                <span className={pctTextColor}>{pct.toFixed(0)}% restante</span>
              </div>
              <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/[0.08]">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${pct}%`, background: barColor, boxShadow: `0 0 8px ${barColor}50` }}
                />
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Tabs (Segmented Control) ── */}
      <div className="relative z-10 px-3 sm:px-6 py-2.5 shrink-0 bg-[#0c1017]/90 border-b border-white/[0.08]">
        <div className="flex items-center gap-1.5 p-1 bg-[#111722] rounded-xl border border-white/[0.08] overflow-x-auto custom-scrollbar">
          {[
            { id: 'players', label: 'Plantilla', count: cart.length },
            { id: 'offers', label: 'Recibidas', count: incomingOffers?.length || 0 },
            { id: 'sent', label: 'Enviadas', count: sentOffers?.length || 0 },
            { id: 'history', label: 'Historial', count: offerHistory?.length || 0 },
            { id: 'stats', label: 'Gráficos', count: null }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-[#00b4d8] text-[#030712] shadow-sm font-black'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive
                      ? 'bg-black/20 text-[#030712]'
                      : 'bg-white/[0.06] text-slate-400'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 flex-grow min-h-0 overflow-y-auto px-3 sm:px-6 py-4 sm:py-5 custom-scrollbar">
        {activeTab === 'players' && (
          cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 rounded-2xl bg-[#0c1017]/60 border border-dashed border-white/[0.08] text-center p-8">
              <div className="w-12 h-12 rounded-full bg-[#111722] border border-white/[0.08] flex items-center justify-center mb-3">
                <ShoppingCart className="w-6 h-6 text-[#00b4d8]/60" />
              </div>
              <p className="text-sm font-bold text-white">Tu equipo está vacío</p>
              <p className="text-xs text-slate-400 mt-1">Explora el mercado principal para fichar jugadores para tu plantilla</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
              {sortedCart.map(player => (
                <CartMiniPlayerCard
                  key={player.Id}
                  player={player}
                  playerMap={playerMap}
                  allPlayers={allPlayers}
                  onRemove={() => onRemoveFromCart(player)}
                  onCardClick={() => onPlayerClick(player)}
                />
              ))}
            </div>
          )
        )}

        {activeTab === 'offers' && (
          incomingOffers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 rounded-2xl bg-[#0c1017]/60 border border-dashed border-white/[0.08] text-center p-8">
              <div className="w-12 h-12 rounded-full bg-[#111722] border border-white/[0.08] flex items-center justify-center mb-3">
                <DollarSign className="w-6 h-6 text-[#00b4d8]/60" />
              </div>
              <p className="text-sm font-bold text-white">No tienes ofertas pendientes</p>
              <p className="text-xs text-slate-400 mt-1">Cuando otros clubes envíen propuestas por tus jugadores aparecerán aquí</p>
            </div>
          ) : (
            <div className="space-y-3">
              {incomingOffers.map(offer => (
                <NegotiationCard
                  key={offer.id}
                  offer={offer}
                  allTeams={allTeams}
                  playerMap={playerMap}
                  allPlayers={allPlayers}
                  userId={userId}
                  userProfile={userProfile}
                  isIncoming={true}
                  isProcessing={isProcessing}
                  counteringOfferId={counteringOfferId}
                  counterAmount={counterAmount}
                  setCounterAmount={setCounterAmount}
                  setCounteringOfferId={setCounteringOfferId}
                  onAccept={handleAcceptOffer}
                  onReject={handleRejectOffer}
                  onCounter={handleCounterOffer}
                  onWithdraw={handleWithdrawOffer}
                />
              ))}
            </div>
          )
        )}

        {activeTab === 'sent' && (
          sentOffers?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 rounded-2xl bg-[#0c1017]/60 border border-dashed border-white/[0.08] text-center p-8">
              <div className="w-12 h-12 rounded-full bg-[#111722] border border-white/[0.08] flex items-center justify-center mb-3">
                <DollarSign className="w-6 h-6 text-[#00b4d8]/60" />
              </div>
              <p className="text-sm font-bold text-white">No has enviado ofertas</p>
              <p className="text-xs text-slate-400 mt-1">Inicia negociaciones con jugadores de otros equipos desde Otros Equipos o Mercado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sentOffers?.map(offer => (
                <NegotiationCard
                  key={offer.id}
                  offer={offer}
                  allTeams={allTeams}
                  playerMap={playerMap}
                  allPlayers={allPlayers}
                  userId={userId}
                  userProfile={userProfile}
                  isIncoming={false}
                  isProcessing={isProcessing}
                  counteringOfferId={counteringOfferId}
                  counterAmount={counterAmount}
                  setCounterAmount={setCounterAmount}
                  setCounteringOfferId={setCounteringOfferId}
                  onAccept={handleAcceptOffer}
                  onReject={handleRejectOffer}
                  onCounter={handleCounterOffer}
                  onWithdraw={handleWithdrawOffer}
                />
              ))}
            </div>
          )
        )}

        {activeTab === 'history' && (
          offerHistory?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 rounded-2xl bg-[#0c1017]/60 border border-dashed border-white/[0.08] text-center p-8">
              <div className="w-12 h-12 rounded-full bg-[#111722] border border-white/[0.08] flex items-center justify-center mb-3">
                <History className="w-6 h-6 text-[#00b4d8]/60" />
              </div>
              <p className="text-sm font-bold text-white">Todavía no hay negociaciones cerradas</p>
              <p className="text-xs text-slate-400 mt-1">El historial de ofertas aceptadas, rechazadas o retiradas se guardará aquí</p>
            </div>
          ) : (
            <div className="space-y-3">
              {offerHistory?.map(offer => (
                <NegotiationCard
                  key={offer.id}
                  offer={offer}
                  allTeams={allTeams}
                  playerMap={playerMap}
                  allPlayers={allPlayers}
                  userId={userId}
                  userProfile={userProfile}
                  isHistory={true}
                  isIncoming={offer.targetTeamId === userProfile?.uid}
                  isProcessing={isProcessing}
                  counteringOfferId={counteringOfferId}
                  counterAmount={counterAmount}
                  setCounterAmount={setCounterAmount}
                  setCounteringOfferId={setCounteringOfferId}
                  onAccept={handleAcceptOffer}
                  onReject={handleRejectOffer}
                  onCounter={handleCounterOffer}
                  onWithdraw={handleWithdrawOffer}
                />
              ))}
            </div>
          )
        )}

        {activeTab === 'stats' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <KpiCard title="OVR Media" value={statsData.avgOvr} icon={Activity} colorClass="text-[#00b4d8]" />
              <KpiCard title="Edad Promedio" value={<>{statsData.avgAge}<span className="text-xs text-slate-400 font-normal"> años</span></>} icon={Calendar} colorClass="text-purple-400" />
              <KpiCard title="Jugadores" value={statsData.totalPlayers} icon={Users} colorClass="text-emerald-400" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl p-5 bg-[#0c1017] border border-white/[0.08] shadow-lg flex flex-col">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#00b4d8]" /> Distribución Táctica
                </h3>
                <div className="flex-grow relative min-h-[220px]">
                  <Doughnut data={statsData.positionChartData} options={doughnutOptions} />
                </div>
              </div>
              <div className="rounded-2xl p-5 bg-[#0c1017] border border-white/[0.08] shadow-lg flex flex-col">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#00b4d8]" /> Nacionalidades
                </h3>
                <div className="flex-grow relative min-h-[220px]">
                  <Bar data={statsData.countryChartData} options={chartOptions} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (isPage) return inner;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-0 sm:p-4 animate-in fade-in duration-300"
      onClick={onClose}>
      <div className="bg-[#0c1017] sm:rounded-2xl shadow-2xl w-full max-w-6xl h-[100dvh] sm:h-[88vh] flex flex-col overflow-hidden border-0 sm:border border-white/[0.08] animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        onClick={e => e.stopPropagation()}>
        {inner}
      </div>
    </div>
  );
});
