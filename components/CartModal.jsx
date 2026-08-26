import React, { useRef, useState, useMemo, memo } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { X, ShoppingCart, DollarSign, Shield, Users, Activity, Calendar, MapPin, ArrowRight, History } from 'lucide-react';
import { formatPriceShort } from '../utils/helpers.js';
import { DEFAULT_BUDGET, APP_ID } from '../utils/constants.js';
import { doc, runTransaction, updateDoc, collection, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { TransferPlayerCard } from './TransferPlayerCard.jsx';

// ─── KpiCard ────────────────────────────────────────────────────────────────
const KpiCard = memo(function KpiCard({ title, value, icon: Icon, colorClass }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-4 py-3"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      {Icon && (
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass?.replace('text-', 'bg-').replace('400', '900/60').replace('purple', 'purple')}`}
          style={{ background: 'rgba(255,255,255,0.06)' }}>
          <Icon className={`w-4 h-4 ${colorClass}`} />
        </div>
      )}
      <div>
        <p className="text-[10px] text-gray-600 uppercase font-bold tracking-wider leading-tight">{title}</p>
        <p className="text-lg font-black text-white leading-tight">{value}</p>
      </div>
    </div>
  );
});

// ─── CartMiniPlayerCard ─────────────────────────────────────────────────────
const CartMiniPlayerCard = memo(function CartMiniPlayerCard({ player, playerMap, allPlayers, onRemove, onCardClick }) {
  const livePlayer = playerMap ? playerMap.get(String(player.Id)) : allPlayers?.find(p => p.Id === player.Id);
  const precio = livePlayer ? livePlayer.Precio : player.Precio;
  const ovr = player.OVR_CALCULADO || 0;
  let ovrColor = 'text-orange-400';
  if (ovr > 85) ovrColor = 'text-green-400';
  else if (ovr >= 70) ovrColor = 'text-yellow-400';

  const posColors = { DC: 'bg-red-600', SD: 'bg-red-600', EI: 'bg-red-600', ED: 'bg-red-600', MC: 'bg-green-700', MCD: 'bg-green-700', MO: 'bg-green-700', MI: 'bg-green-700', MD: 'bg-green-700', DFC: 'bg-blue-700', LI: 'bg-blue-700', LD: 'bg-blue-700', PT: 'bg-yellow-600' };
  const posBg = posColors[player.POS_NOMBRE] || 'bg-gray-700';

  return (
    <div
      className="flex items-center gap-3 bg-white/[0.03] hover:bg-white/[0.06] rounded-xl p-3
        border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200 cursor-pointer group"
      onClick={onCardClick}
    >
      {/* Photo */}
      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-[#111]">
        <img
          src={`/fotos_jugadores/${player.Id}.webp`}
          alt={player.Name}
          className="w-full h-full object-cover"
          onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/48x48/111/444?text=${player.Name[0]}`; }}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={`text-[9px] font-black text-white px-1.5 py-0.5 rounded ${posBg}`}>
            {player.POS_NOMBRE}
          </span>
          <span className={`text-xs font-black ${ovrColor}`}>{ovr}</span>
        </div>
        <p className="text-sm font-bold text-white/90 truncate leading-tight">{player.Name}</p>
        <p className="text-xs text-emerald-400 font-bold mt-0.5">
          ${precio?.toFixed(2)}M
        </p>
      </div>

      {/* Remove btn */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center
          text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
        title="Quitar del equipo"
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
    <div className="rounded-2xl bg-white/[0.025] p-4 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.055)]">
      {offer.status === 'accepted' ? (
        <TransferPlayerCard transfer={transferData} player={livePlayer} allTeams={allTeams} compact />
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <img
                src={`/fotos_jugadores/${offer.playerId}.webp`}
                alt={offer.playerName}
                className="h-12 w-12 rounded-xl bg-black/40 object-cover shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
                onError={(event) => { event.currentTarget.style.display = 'none'; }}
              />
              <div className="min-w-0">
                <h4 className="truncate text-sm font-black uppercase italic text-white">{offer.playerName}</h4>
                <div className="mt-1 flex min-w-0 items-center gap-2 text-[11px] font-black uppercase">
                  <span className="min-w-0 truncate text-cyan-300">{senderName}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                  <span className="min-w-0 truncate text-purple-300">{targetName}</span>
                </div>
              </div>
            </div>
            <OfferTimeline offer={offer} />
          </div>

          <div className="w-full shrink-0 lg:w-auto lg:min-w-[250px]">
            <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-black/22 px-3 py-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.035)]">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{getOfferStatusLabel(offer.status)}</span>
              <span className="text-lg font-black text-emerald-300">{formatPriceShort((activeAmount || 0) / 1000000)}</span>
            </div>

            {!isHistory && counteringOfferId === offer.id ? (
              <div className="flex w-full flex-wrap items-center gap-2">
                <div className="relative min-w-[120px] flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.1"
                    value={counterAmount}
                    onChange={(event) => setCounterAmount(event.target.value)}
                    placeholder="Monto"
                    className="min-h-11 w-full rounded-xl bg-black/36 py-2 pl-7 pr-8 text-sm font-bold text-white outline-none shadow-[inset_0_0_0_1px_rgba(34,211,238,0.12)] focus:shadow-[inset_0_0_0_1px_rgba(34,211,238,0.36)]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">M</span>
                </div>
                <button onClick={() => onCounter(offer)} disabled={isProcessing || !counterAmount} className="min-h-11 rounded-xl bg-yellow-500/16 px-4 text-xs font-black uppercase text-yellow-200 transition hover:bg-yellow-500/24 disabled:opacity-50">
                  Enviar
                </button>
                <button onClick={() => { setCounteringOfferId(null); setCounterAmount(''); }} className="min-h-11 rounded-xl bg-white/[0.04] px-4 text-xs font-black uppercase text-gray-300 transition hover:bg-white/[0.07]">
                  Cancelar
                </button>
              </div>
            ) : !isHistory ? (
              <div className="flex w-full flex-wrap gap-2">
                {isIncoming ? (
                  <>
                    <button onClick={() => onReject(offer)} disabled={isProcessing} className="min-h-11 flex-1 rounded-xl bg-red-500/12 px-4 text-xs font-black uppercase text-red-300 transition hover:bg-red-500/20 disabled:opacity-50">Rechazar</button>
                    <button onClick={() => { setCounteringOfferId(offer.id); setCounterAmount(''); }} disabled={isProcessing} className="min-h-11 flex-1 rounded-xl bg-yellow-500/12 px-4 text-xs font-black uppercase text-yellow-300 transition hover:bg-yellow-500/20 disabled:opacity-50">Contraoferta</button>
                    <button onClick={() => onAccept(offer)} disabled={isProcessing} className="min-h-11 flex-1 rounded-xl bg-cyan-500 px-4 text-xs font-black uppercase text-black transition hover:bg-cyan-300 disabled:opacity-50">Aceptar</button>
                  </>
                ) : (
                  <button onClick={() => onWithdraw(offer)} disabled={isProcessing} className="min-h-11 w-full rounded-xl bg-red-500/12 px-4 text-xs font-black uppercase text-red-300 transition hover:bg-red-500/20 disabled:opacity-50">
                    Retirar Oferta
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
});

export const CartModal = memo(function CartModal({ isPage, isVisible, onClose, cart, onRemoveFromCart, userProfile, totalCartCost, remainingBudget, incomingOffers = [], sentOffers = [], offerHistory = [], countryMap, onPlayerClick, allPlayers, allTeams }) {
  const [activeTab, setActiveTab] = useState('players');
  const [isProcessing, setIsProcessing] = useState(false);
  const processingOfferRef = useRef(null);
  const [counteringOfferId, setCounteringOfferId] = useState(null);
  const [counterAmount, setCounterAmount] = useState('');

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
      if (!offer?.senderId || !offer?.targetTeamId || offer.senderId === offer.targetTeamId) {
        throw new Error("Oferta invalida: comprador y vendedor no pueden ser el mismo equipo.");
      }

      const livePlayer = playerMap.get(String(offer.playerId)) || allPlayers?.find(p => p.Id === offer.playerId);
      if (!livePlayer) throw "Jugador no encontrado en la base de datos";

      let activeAmount = Number(getOfferAmount(offer));
      if (!Number.isFinite(activeAmount) || activeAmount <= 0) {
        throw new Error("Monto de oferta invalido.");
      }

      // El presupuesto real disponible del comprador es budget - valor de su carrito actual
      // (el campo "budget" en Firestore nunca se descuenta al fichar; el gasto se calcula
      // siempre restando el carrito. Por eso NO se debe escribir el campo budget acá, o el
      // dinero se cuenta dos veces). Hay que sumar el carrito ANTES de la transacción porque
      // runTransaction no puede leer una collection completa, solo docs puntuales.
      const buyerCartSnap = await getDocs(collection(db, `artifacts/${APP_ID}/users/${offer.senderId}/cart`));
      const buyerCartTotal = buyerCartSnap.docs.reduce((sum, cartDoc) => {
        const cartPlayer = cartDoc.data();
        return sum + (cartPlayer.isFranchise ? 0 : (Number(cartPlayer.Precio) || 0) * 1000000);
      }, 0);

      await runTransaction(db, async (transaction) => {
        const buyerProfileRef = doc(db, `artifacts/${APP_ID}/users/${offer.senderId}/profile`, "data");
        const sellerProfileRef = doc(db, `artifacts/${APP_ID}/users/${offer.targetTeamId}/profile`, "data");
        const buyerDoc = await transaction.get(buyerProfileRef);
        const sellerDoc = await transaction.get(sellerProfileRef);
        
        if (!buyerDoc.exists() || !sellerDoc.exists()) throw "Perfiles no encontrados";
        
        const buyerBudget = buyerDoc.data().budget || 0;
        const buyerProfile = buyerDoc.data();
        const sellerProfile = sellerDoc.data();
        const buyerTeamName = offer.senderTeamName || buyerProfile.teamName || allTeams?.[offer.senderId]?.teamName || 'Equipo comprador';
        const sellerTeamName = offer.targetTeamName || sellerProfile.teamName || allTeams?.[offer.targetTeamId]?.teamName || 'Equipo rival';
        const buyerTeamLogo = offer.senderTeamLogo || buyerProfile.logoUrl || allTeams?.[offer.senderId]?.logoUrl || '';
        const sellerTeamLogo = offer.targetTeamLogo || sellerProfile.logoUrl || allTeams?.[offer.targetTeamId]?.logoUrl || '';

        const buyerRemainingBudget = buyerBudget - buyerCartTotal;
        if (buyerRemainingBudget < activeAmount) throw "El comprador no tiene fondos suficientes";

        // Verify the offer is still valid
        const offerRef = doc(db, `artifacts/${APP_ID}/public/data/offers`, offer.id);
        const offerDoc = await transaction.get(offerRef);
        activeAmount = Number(getOfferAmount(offerDoc.exists() ? offerDoc.data() : {}));
        if (!offerDoc.exists() || (offerDoc.data().status !== 'pending' && offerDoc.data().status !== 'countered')) {
          throw new Error("La oferta ya no es válida o ya fue procesada.");
        }

        // Verify the seller still owns the player
        const lockRef = doc(db, `artifacts/${APP_ID}/public/data/player_locks`, String(offer.playerId));
        const lockDoc = await transaction.get(lockRef);
        const sellerCartRef = doc(db, `artifacts/${APP_ID}/users/${offer.targetTeamId}/cart`, String(offer.playerId));
        const buyerCartRef = doc(db, `artifacts/${APP_ID}/users/${offer.senderId}/cart`, String(offer.playerId));
        const sellerCartDoc = await transaction.get(sellerCartRef);
        const buyerCartDoc = await transaction.get(buyerCartRef);
        if (!sellerCartDoc.exists()) throw new Error('El jugador ya no está en el plantel vendedor.');
        if (buyerCartDoc.exists()) throw new Error('El comprador ya tiene este jugador.');
        const ownedPlayer = sellerCartDoc.data();
        if (ownedPlayer.isFranchise || (lockDoc.exists() && lockDoc.data().isFranchise)) {
          throw new Error('Los jugadores franquicia no son transferibles.');
        }
        const playerBaseCost = Math.round((Number(ownedPlayer.Precio) || 0) * 1000000);
        if (!Number.isSafeInteger(activeAmount) || !playerBaseCost || activeAmount < playerBaseCost || activeAmount > playerBaseCost * 3) {
          throw new Error('El monto ya no cumple los límites del jugador.');
        }
        if (Number(buyerBudget) - buyerCartTotal < activeAmount) {
          throw new Error('El comprador no tiene fondos suficientes.');
        }
        if (!lockDoc.exists() || lockDoc.data().lockedBy !== offer.targetTeamId) {
          throw new Error("El jugador ya no pertenece al equipo vendedor.");
        }

        // 1. NO tocar el campo "budget" acá a propósito: en toda la app el presupuesto
        // disponible se calcula como budget - valor del carrito (ver handleAddToCart /
        // remainingBudget en app.jsx). Mover al jugador de carrito (paso 3) ya ajusta
        // ese cálculo solo. Si además sumamos/restamos el campo budget, la plata se
        // cuenta dos veces (ese era el bug: vendedor terminaba con presupuesto inflado).

        // 2. Transfer lock ownership
        transaction.update(lockRef, {
          lockedBy: offer.senderId,
          teamName: buyerTeamName,
          lockedAt: new Date().toISOString()
        });

        // 3. Move player from seller cart to buyer cart
        transaction.delete(sellerCartRef);
        transaction.set(buyerCartRef, { ...ownedPlayer, isFranchise: false });
        const buyerBudgetAfter = buyerBudget + playerBaseCost - activeAmount;
        const sellerBudgetAfter = (Number(sellerProfile.budget) || 0) + activeAmount - playerBaseCost;
        transaction.update(buyerProfileRef, { budget: buyerBudgetAfter });
        transaction.update(sellerProfileRef, { budget: sellerBudgetAfter });
        transaction.set(doc(db, `artifacts/${APP_ID}/public/data/teams`, offer.senderId), { budget: buyerBudgetAfter }, { merge: true });
        transaction.set(doc(db, `artifacts/${APP_ID}/public/data/teams`, offer.targetTeamId), { budget: sellerBudgetAfter }, { merge: true });
        
        // 4. Update offer status
        const acceptedAt = new Date().toISOString();
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

        // 5. Delete old signing transfer entry (from when seller originally signed)
        // (handled by cleanup — not critical inside transaction)

        // 6. Write transfer event to live feed
        const transferRef = doc(collection(db, `artifacts/${APP_ID}/public/data/transfers`));
        transaction.set(transferRef, {
          playerId: offer.playerId,
          playerName: offer.playerName,
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
    if (!Number.isFinite(valueInMillions) || valueInMillions <= 0 || !livePlayer || valueInMillions < Number(livePlayer.Precio) || valueInMillions > Number(livePlayer.Precio) * 3) {
      alert('La contraoferta debe estar entre el valor base y tres veces ese valor.');
      return;
    }
    if (livePlayer && Number(counterAmount) > livePlayer.Precio * 3) {
      alert(`La contraoferta no puede superar el límite máximo de $${(livePlayer.Precio * 3).toFixed(2)}M (3x valor base).`);
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
    <div className="w-full h-full min-h-0 flex flex-col bg-[#0a0a0a]">
      {/* ── Header ── */}
      <div className="flex justify-between items-center px-4 sm:px-6 py-3 sm:py-4 shrink-0"
        style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.05)' }}>
        <div>
          <h2 className="text-base sm:text-xl font-black text-white flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-cyan-500" /> Gestión de Equipo
          </h2>
          <p className="text-[10px] sm:text-xs text-gray-600 mt-0.5 uppercase tracking-widest font-bold truncate max-w-[220px] sm:max-w-none">
            {userProfile?.teamName}
          </p>
        </div>
        {!isPage && (
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:text-white hover:bg-white/[0.06] transition">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* ── Budget Breakdown — Cohesive Card ── */}
      {(() => {
        const initialBudget = userProfile?.budget || DEFAULT_BUDGET || 0;
        const pct = initialBudget > 0 ? Math.min(100, Math.max(0, (remainingBudget / initialBudget) * 100)) : 0;
        const barColor = pct > 50 ? '#10b981' : pct > 20 ? '#eab308' : '#ef4444';
        const pctTextColor = pct > 50 ? 'text-emerald-400' : pct > 20 ? 'text-yellow-400' : 'text-red-400';
        const availableColor = remainingBudget > 0 ? '#00C8FF' : '#ef4444';

        const fmtM = (val) => {
          const v = Math.abs(val || 0);
          if (v >= 1000000) return `$${(v / 1000000).toFixed(2)}M`;
          if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
          return `$${v}`;
        };

        return (
          <div className="px-3 sm:px-6 py-3 sm:py-4 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div
              className="rounded-xl sm:rounded-2xl p-4 sm:p-5"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              {/* Top row: team name + title */}
              <div className="flex items-center justify-between mb-5">
                <span className="text-xs font-black text-white/40 uppercase tracking-widest">
                  {userProfile?.teamName || 'Mi Equipo'}
                </span>
                <span className="text-[10px] font-bold text-white/25 uppercase tracking-wider flex items-center gap-1.5">
                  💰 Gestión Financiera
                </span>
              </div>

              {/* Secondary stats row */}
              <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-5">
                <div>
                  <p className="text-sm sm:text-lg font-black text-white/45 leading-none">{fmtM(initialBudget)}</p>
                  <p className="text-[9px] text-white/25 uppercase font-bold tracking-wider mt-1">Presupuesto inicial</p>
                </div>
                <div>
                  <p className={`text-sm sm:text-lg font-black leading-none ${totalCartCost > 0 ? 'text-white/45' : 'text-white/20'}`}>{fmtM(totalCartCost)}</p>
                  <p className="text-[9px] text-white/25 uppercase font-bold tracking-wider mt-1">Gastado en fichajes</p>
                </div>
                <div>
                  <p className={`text-sm sm:text-lg font-black leading-none ${totalCartCost > 0 ? 'text-white/45' : 'text-white/20'}`}>{fmtM(totalCartCost)}</p>
                  <p className="text-[9px] text-white/25 uppercase font-bold tracking-wider mt-1">Valor de plantilla</p>
                </div>
              </div>

              {/* Hero: DISPONIBLE */}
              <div className="flex items-end justify-between mb-2">
                <div>
                  <p className="text-[10px] text-white/25 uppercase font-black tracking-widest mb-1">Disponible</p>
                  <p className="text-2xl sm:text-3xl font-black leading-none" style={{ color: availableColor }}>
                    {fmtM(remainingBudget)}
                  </p>
                </div>
                <span className={`text-sm font-black ${pctTextColor}`}>
                  {pct.toFixed(0)}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden mt-3">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${pct}%`, background: barColor }}
                />
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Tabs ── */}
      <div className="flex px-3 sm:px-6 gap-0 shrink-0 overflow-x-auto custom-scrollbar" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {[['players', `Plantilla (${cart.length})`], ['offers', `Recibidas (${incomingOffers?.length || 0})`], ['sent', `Enviadas (${sentOffers?.length || 0})`], ['stats', 'Gráficos']].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`shrink-0 px-3 sm:px-5 py-3 text-xs sm:text-sm font-bold transition-all border-b-2 -mb-px ${
              activeTab === id
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-gray-600 hover:text-gray-300'
            }`}>
            {label}
          </button>
        ))}
        <button
          onClick={() => setActiveTab('history')}
          className={`shrink-0 px-3 sm:px-5 py-3 text-xs sm:text-sm font-bold transition-all border-b-2 -mb-px ${
            activeTab === 'history'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-gray-600 hover:text-gray-300'
          }`}
        >
          Historial ({offerHistory?.length || 0})
        </button>
      </div>

      {/* ── Content ── */}
      <div className="flex-grow min-h-0 overflow-y-auto px-3 sm:px-6 py-4 sm:py-5 custom-scrollbar">
        {activeTab === 'players' && (
          cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-600">
              <ShoppingCart className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">Tu equipo está vacío</p>
              <p className="text-xs mt-1 opacity-60">Vé al mercado para fichar jugadores</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
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
            <div className="flex flex-col items-center justify-center h-64 text-gray-600">
              <DollarSign className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">No tenés ofertas pendientes</p>
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

        {false && activeTab === 'offers' && (
          incomingOffers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-600">
              <DollarSign className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">No tienes ofertas pendientes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {incomingOffers.map(offer => (
                <div key={offer.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <img src={offer.senderTeamLogo || DEFAULT_LOGO} alt={offer.senderTeamName || 'Equipo'} className="w-9 h-9 rounded-lg object-contain bg-black/40 border border-white/10 p-1" onError={(e) => { e.target.src = DEFAULT_LOGO; }} />
                      <img src={`/fotos_jugadores/${offer.playerId}.webp`} alt={offer.playerName} className="w-10 h-10 rounded-lg object-cover bg-black/40 border border-white/10" onError={(e) => { e.target.style.display = 'none'; }} />
                      <div className="min-w-0">
                        <h4 className="text-white font-bold truncate">{offer.playerName}</h4>
                        <p className="text-xs text-gray-400">Oferta de: <span className="text-cyan-400 font-bold">{offer.senderTeamName}</span></p>
                      </div>
                    </div>
                    <p className="text-lg font-black text-green-500">{formatPriceShort((offer.status === 'countered' ? offer.counterAmount : offer.offerAmount) / 1000000)}</p>
                    {offer.message && <p className="text-xs text-gray-500 italic mt-1">"{offer.message}"</p>}
                  </div>
                  <div className="flex w-full sm:w-auto">
                    {counteringOfferId === offer.id ? (
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">$</span>
                          <input 
                            type="number" 
                            step="0.1"
                            value={counterAmount} 
                            onChange={(e) => setCounterAmount(e.target.value)} 
                            placeholder="Monto" 
                            className="pl-6 pr-6 py-2 bg-black/40 border border-gray-600 rounded-lg text-white text-xs outline-none focus:border-cyan-500 w-28"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">M</span>
                        </div>
                        <button 
                          onClick={() => handleCounterOffer(offer)}
                          disabled={isProcessing || !counterAmount}
                          className="px-3 py-2 bg-yellow-600 hover:bg-yellow-500 text-white font-bold text-xs rounded-lg transition-colors"
                        >
                          Enviar
                        </button>
                        <button 
                          onClick={() => { setCounteringOfferId(null); setCounterAmount(''); }}
                          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button 
                          onClick={() => handleRejectOffer(offer)}
                          disabled={isProcessing}
                          className="flex-1 sm:flex-none px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold text-xs rounded-lg transition-colors border border-red-500/20"
                        >
                          Rechazar
                        </button>
                        <button 
                          onClick={() => { setCounteringOfferId(offer.id); setCounterAmount(''); }}
                          disabled={isProcessing}
                          className="flex-1 sm:flex-none px-4 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 font-bold text-xs rounded-lg transition-colors border border-yellow-500/20"
                        >
                          Contraoferta
                        </button>
                        <button 
                          onClick={() => handleAcceptOffer(offer)}
                          disabled={isProcessing}
                          className="flex-1 sm:flex-none px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-lg transition-colors"
                        >
                          Aceptar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'sent' && (
          sentOffers?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-600">
              <DollarSign className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">No enviaste ofertas</p>
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

        {false && activeTab === 'sent' && (
          sentOffers?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-600">
              <DollarSign className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">No has enviado ofertas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sentOffers?.map(offer => (
                <div key={offer.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h4 className="text-white font-bold">{offer.playerName}</h4>
                    <p className="text-xs text-gray-400">Oferta enviada a: <span className="text-cyan-400 font-bold">{offer.targetTeamId === userProfile?.uid ? offer.senderTeamName : 'Otro equipo'}</span></p>
                    <p className="text-lg font-black text-blue-500">{formatPriceShort((offer.status === 'countered' ? offer.counterAmount : offer.offerAmount) / 1000000)}</p>
                    {offer.status === 'countered' && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded font-bold">Es Contraoferta</span>}
                  </div>
                  <div className="flex w-full sm:w-auto gap-2">
                    <button 
                      onClick={() => handleWithdrawOffer(offer)}
                      disabled={isProcessing}
                      className="w-full sm:w-auto px-4 py-2 bg-red-900/50 hover:bg-red-800 text-white font-bold text-xs rounded-lg transition-colors border border-red-700/50"
                    >
                      Retirar Oferta
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'history' && (
          offerHistory?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-600">
              <History className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">Todavía no hay negociaciones cerradas</p>
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
              <KpiCard title="OVR Media" value={statsData.avgOvr} icon={Activity} colorClass="text-cyan-400" />
              <KpiCard title="Edad Promedio" value={<>{statsData.avgAge}<span className="text-xs text-gray-600 font-normal"> años</span></>} icon={Calendar} colorClass="text-purple-400" />
              <KpiCard title="Jugadores" value={statsData.totalPlayers} icon={Users} colorClass="text-emerald-400" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl p-5 flex flex-col" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-cyan-500" /> Distribución Táctica
                </h3>
                <div className="flex-grow relative min-h-[200px]">
                  <Doughnut data={statsData.positionChartData} options={doughnutOptions} />
                </div>
              </div>
              <div className="rounded-xl p-5 flex flex-col" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-indigo-400" /> Nacionalidades
                </h3>
                <div className="flex-grow relative min-h-[200px]">
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
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}>
      <div className="bg-[#0f0f0f] sm:rounded-2xl shadow-2xl w-full max-w-6xl h-[100dvh] sm:h-[85vh] flex flex-col overflow-hidden"
        style={{ border: '1px solid rgba(255,255,255,0.05)' }}
        onClick={e => e.stopPropagation()}>
        {inner}
      </div>
    </div>
  );
});
