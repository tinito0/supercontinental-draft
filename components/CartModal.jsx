import React, { useRef, useState, useEffect, useMemo, memo } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import '../utils/chartSetup.js';
import { X, ShoppingCart, DollarSign, ArrowRight, History, ClipboardList, Lock } from 'lucide-react';
import { formatPriceShort, getPosColorClass, getStatAndOvrColorClass } from '../utils/helpers.js';
import { DEFAULT_BUDGET, TRANSFER_FEE_RATE } from '../utils/constants.js';
import { buildClubLedger } from '../utils/clubLedger.js';
import { budgetMeter } from '../utils/budgetDisplay.js';
import { isOfferExpired, offerTimeLeft } from '../supabase/functions/_shared/offerExpiry.js';
import { formatTimeLeft } from '../utils/marketCountdown.js';
import { db } from '../config/firebase.js';
import { TransferPlayerCard } from './TransferPlayerCard.jsx';
import { ProposalChat } from './ProposalChat.jsx';
import { BaseModal } from './ui/BaseModal.jsx';
import { confirmAction } from './ui/ConfirmDialog.jsx';
import { Page } from './ui/Page.jsx';
import { PageHeader } from './ui/PageHeader.jsx';
import { Tabs } from './ui/Tabs.jsx';
import { Stat } from './ui/Stat.jsx';
import { EmptyState } from './ui/EmptyState.jsx';
import {
  acceptTransferOffer,
  rejectTransferOffer,
  counterTransferOffer,
  withdrawTransferOffer,
  getOfferAmount,
  appendHistory,
} from '../services/transferService.js';

// ─── CartMiniPlayerCard ─────────────────────────────────────────────────────
// Row of the squad: photo, position and OVR in the market's colour scale, current price.
const CartMiniPlayerCard = memo(function CartMiniPlayerCard({ player, playerMap, allPlayers, onRemove, onCardClick }) {
  const livePlayer = playerMap ? playerMap.get(String(player.Id)) : allPlayers?.find(p => p.Id === player.Id);
  const precio = livePlayer ? livePlayer.Precio : player.Precio;
  const ovr = player.OVR_CALCULADO || 0;

  return (
    <div className="group relative flex items-center gap-3 rounded-xl p-2.5 pr-1.5 bg-surface border border-line/[0.12] hover:border-line/30 hover:bg-raised transition-colors">
      <button type="button" onClick={onCardClick} className="absolute inset-0 rounded-xl" aria-label={`Ver perfil de ${player.Name}`} />
      <img src={`/fotos_jugadores/${player.Id}.webp`} alt="" width={48} height={48} loading="lazy"
        className="w-12 h-12 rounded-lg object-cover object-top bg-raised shrink-0"
        onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
      <div className="flex-1 min-w-0 pointer-events-none">
        <p className="text-sm font-semibold text-ink truncate group-hover:text-accent-soft transition-colors">{player.Name}</p>
        <p className="mt-1 flex items-center gap-2 text-xs">
          <span className={`px-1.5 rounded text-[11px] font-bold ${getPosColorClass(player.POS_NOMBRE)}`}>{player.POS_NOMBRE}</span>
          {/* The franchise player costs nothing from the budget (hooks/useBudget.js), so no price for him. */}
          {player.isFranchise
            ? <span className="font-semibold text-accent-soft">Franquicia</span>
            : <span className="num text-ink-3">{formatPriceShort(precio)}</span>}
        </p>
      </div>
      <span className={`w-9 h-9 rounded-lg flex items-center justify-center font-display num text-base font-bold shrink-0 pointer-events-none ${getStatAndOvrColorClass(ovr)}`}>{ovr}</span>
      {/* Un Jugador Franquicia no se libera (el servidor lo rechaza; el admin resetea la franquicia). */}
      {player.isFranchise ? (
        <span className="relative w-8 h-8 shrink-0 flex items-center justify-center text-accent-soft" title="El Jugador Franquicia no se puede liberar">
          <Lock className="w-4 h-4" aria-hidden="true" />
          <span className="sr-only">Jugador Franquicia: no se puede liberar</span>
        </span>
      ) : (
        <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="relative btn btn-ghost btn-icon btn-sm text-ink-3 hover:text-danger-soft"
          title="Quitar del plantel" aria-label={`Quitar a ${player.Name} del plantel`}>
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
});

const CLOSED_STATUSES = new Set(['accepted', 'rejected', 'withdrawn']);

function getOfferStatusLabel(status) {
  if (status === 'pending') return 'Pendiente';
  if (status === 'countered') return 'Contraoferta';
  if (status === 'accepted') return 'Aceptada';
  if (status === 'rejected') return 'Rechazada';
  if (status === 'withdrawn') return 'Retirada';
  return 'Negociación';
}

const STATUS_TONE = { pending: 'text-warning-soft', countered: 'text-warning-soft', accepted: 'text-success-soft', rejected: 'text-danger-soft', withdrawn: 'text-ink-3' };

// The live team name first: the names stored in the offer are written by its sender.
function getOfferTargetName(offer, allTeams) {
  return allTeams?.[offer.targetTeamId]?.teamName || offer.targetTeamName || 'Equipo rival';
}

function getOfferSenderName(offer, allTeams) {
  return allTeams?.[offer.senderId]?.teamName || offer.senderTeamName || 'Equipo comprador';
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
    <ol className="mt-3 border-l border-line/15 pl-3 space-y-2.5">
      {history.slice(-4).map((item, index) => (
        <li key={`${item.type || 'event'}-${item.at || index}`} className="text-xs">
          <p className="flex items-center justify-between gap-3">
            <span className="font-semibold text-ink-2">{item.title || 'Movimiento'} · <span className="font-normal text-ink-3">{item.teamName || 'Equipo'}</span></span>
            {item.amount ? <span className="num font-semibold text-ink">{formatPriceShort(item.amount / 1000000)}</span> : null}
          </p>
          {item.message ? <p className="mt-0.5 text-ink-3">«{item.message}»</p> : null}
        </li>
      ))}
    </ol>
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
  const busyTitle = isProcessing ? 'Hay una operación en curso' : undefined;
  // Each turn has 48 hours (supabase/functions/_shared/offerExpiry.js). An expired offer can still be rejected or
  // withdrawn to tidy up, but not accepted or countered, and it no longer holds the buyer's money.
  const isOpenOffer = !isHistory && (offer.status === 'pending' || offer.status === 'countered');
  const timeLeft = isOpenOffer ? offerTimeLeft(offer) : null;
  const isExpired = isOpenOffer && isOfferExpired(offer);
  const expiredTitle = isExpired ? 'La oferta venció: pasaron 48 horas sin respuesta' : undefined;
  // When the other club answers (counter, re-offer, rejection) the card glows once, so the change is noticed
  // while reading another offer. Restarting a CSS animation needs the class removed and a reflow in between.
  const cardRef = useRef(null);
  const previousStateRef = useRef(`${offer.status}:${activeAmount}`);
  useEffect(() => {
    const state = `${offer.status}:${activeAmount}`;
    if (previousStateRef.current === state) return;
    previousStateRef.current = state;
    const el = cardRef.current;
    if (!el) return;
    el.classList.remove('row-flash');
    void el.offsetWidth;
    el.classList.add('row-flash');
  }, [offer.status, activeAmount]);
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
    <article ref={cardRef} className="panel-flat p-4 sm:p-5" aria-label={`Negociación por ${offer.playerName}`}>
      {offer.status === 'accepted' ? (
        <TransferPlayerCard transfer={transferData} player={livePlayer} allTeams={allTeams} compact />
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <img src={`/fotos_jugadores/${offer.playerId}.webp`} alt="" width={48} height={48}
                className="h-12 w-12 rounded-lg bg-raised object-cover object-top shrink-0"
                onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} />
              <div className="min-w-0">
                <h4 className="truncate font-display text-lg font-bold text-ink leading-tight">{offer.playerName}</h4>
                <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-ink-3">
                  <span className="min-w-0 truncate text-ink-2">{senderName}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-label="ofrece a" />
                  <span className="min-w-0 truncate text-ink-2">{targetName}</span>
                </p>
              </div>
            </div>
            <OfferTimeline offer={offer} />
          </div>

          <div className="w-full shrink-0 lg:w-auto lg:min-w-[260px]">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <span className={`text-xs font-semibold ${STATUS_TONE[offer.status] || 'text-ink-3'}`}>{getOfferStatusLabel(offer.status)}</span>
              <span className="font-display num text-2xl font-bold text-ink">{formatPriceShort((activeAmount || 0) / 1000000)}</span>
            </div>
            {timeLeft !== null && (
              <p className={`-mt-2 mb-3 text-xs ${isExpired ? 'font-semibold text-warning-soft' : 'text-ink-3'}`}>
                {isExpired
                  ? (isIncoming ? 'Vencida: pasaron 48 h sin respuesta.' : 'Vencida: ya no reserva tu presupuesto.')
                  : <>Vence en <span className="num">{formatTimeLeft(timeLeft)}</span></>}
              </p>
            )}

            {!isHistory && counteringOfferId === offer.id ? (
              <div className="flex w-full flex-wrap items-center gap-2">
                <label className="relative min-w-[120px] flex-1">
                  <span className="sr-only">Monto de la contraoferta en millones</span>
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-3" aria-hidden="true">$</span>
                  <input type="number" step="0.1" inputMode="decimal" value={counterAmount} onChange={(event) => setCounterAmount(event.target.value)}
                    placeholder="Monto" className="input num pl-7 pr-8" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-3" aria-hidden="true">M</span>
                </label>
                <button type="button" onClick={() => onCounter(offer)} disabled={isProcessing || !counterAmount}
                  title={busyTitle || (!counterAmount ? 'Escribí un monto primero' : undefined)} className="btn btn-primary">Enviar</button>
                <button type="button" onClick={() => { setCounteringOfferId(null); setCounterAmount(''); }} className="btn btn-ghost">Cancelar</button>
              </div>
            ) : !isHistory ? (
              <div className="grid w-full grid-cols-3 gap-2">
                {isIncoming ? (
                  <>
                    <button type="button" onClick={() => onReject(offer)} disabled={isProcessing} title={busyTitle} className="btn btn-danger">Rechazar</button>
                    <button type="button" onClick={() => { setCounteringOfferId(offer.id); setCounterAmount(''); }} disabled={isProcessing || isExpired} title={busyTitle || expiredTitle} className="btn btn-secondary">Contraofertar</button>
                    <button type="button" onClick={() => onAccept(offer)} disabled={isProcessing || isExpired} title={busyTitle || expiredTitle} className="btn btn-primary">Aceptar</button>
                  </>
                ) : (
                  <button type="button" onClick={() => onWithdraw(offer)} disabled={isProcessing} title={busyTitle} className="btn btn-danger col-span-3">Retirar oferta</button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      <ProposalChat
        offerId={offer.id}
        userId={userId || userProfile?.uid}
        userProfile={userProfile}
        isClosed={isHistory || CLOSED_STATUSES.has(offer.status)}
      />
    </article>
  );
});

export const CartModal = memo(function CartModal({ isPage, isVisible, onClose, cart, isSquadLoading = false, onRemoveFromCart, userProfile, userId, budgetBase, budgetPercent, totalCartCost, remainingBudget, committedInOffers, incomingOffers = [], sentOffers = [], offerHistory = [], countryMap, onPlayerClick, allPlayers, allTeams, initialTab = 'players', onOpenTactics, showStatusMessage, isMarketOpen = true }) {
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

  const offerPlayer = (offer) => playerMap.get(String(offer.playerId)) || { Id: offer.playerId, Name: offer.playerName };

  const handleAcceptOffer = async (offer) => {
    if (isProcessing || processingOfferRef.current) return;
    if (!isMarketOpen) {
      showStatusMessage?.('error', 'El mercado está cerrado: las ofertas se aceptan cuando abra.');
      return;
    }
    // The only offer action that cannot be undone (rejecting and withdrawing already asked).
    const price = formatPriceShort(getOfferAmount(offer) / 1000000);
    const isConfirmed = await confirmAction({
      title: '¿Aceptar la oferta?',
      player: offerPlayer(offer),
      amount: price,
      message: `${offer.playerName} pasa a ${getOfferSenderName(offer, allTeams)}.`,
      confirmLabel: 'Aceptar oferta',
      tone: 'primary',
      irreversible: true,
    });
    if (!isConfirmed) return;
    processingOfferRef.current = offer?.id || 'unknown';
    setIsProcessing(true);
    showStatusMessage?.('loading', `Aceptando la oferta por ${offer.playerName}...`);
    try {
      await acceptTransferOffer({ offer, userId });
      showStatusMessage?.('success', `Traspaso confirmado: ${offer.playerName} ahora pertenece a ${getOfferSenderName(offer, allTeams)}.`);

    } catch (err) {
      console.error(err);
      showStatusMessage?.('error', `No se pudo aceptar la oferta: ${err?.message || 'reintentá en unos instantes.'}`);
    } finally {
      processingOfferRef.current = null;
      setIsProcessing(false);
    }
  };

  const handleRejectOffer = async (offer) => {
    if (isProcessing) return;
    const isConfirmed = await confirmAction({
      title: '¿Rechazar la oferta?',
      player: offerPlayer(offer),
      amount: formatPriceShort(getOfferAmount(offer) / 1000000),
      message: `${getOfferSenderName(offer, allTeams)} recibe el aviso y el jugador sigue en tu plantel.`,
      confirmLabel: 'Rechazar oferta',
    });
    if (!isConfirmed) return;
    setIsProcessing(true);
    showStatusMessage?.('loading', `Rechazando la oferta por ${offer.playerName}...`);
    try {
      await rejectTransferOffer({
        db,
        offer,
        userId,
        teamName: userProfile?.teamName || 'Equipo',
      });
      showStatusMessage?.('success', `Oferta por ${offer.playerName} rechazada.`);
    } catch (err) {
      console.error(err);
      showStatusMessage?.('error', `No se pudo rechazar la oferta: ${err?.message || 'reintentá en unos instantes.'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCounterOffer = async (offer) => {
    if (isProcessing || !counterAmount || isNaN(counterAmount)) return;
    const livePlayer = playerMap.get(String(offer.playerId));
    setIsProcessing(true);
    showStatusMessage?.('loading', `Enviando contraoferta por ${offer.playerName}...`);
    try {
      await counterTransferOffer({
        db,
        offer,
        userId,
        counterAmountMillions: counterAmount,
        livePlayer,
        teamName: userProfile?.teamName || 'Equipo',
      });
      setCounteringOfferId(null);
      setCounterAmount('');
      showStatusMessage?.('success', `Contraoferta enviada por ${offer.playerName}.`);
    } catch (e) {
      console.error(e);
      showStatusMessage?.('error', e?.message || 'No se pudo enviar la contraoferta. Reintentá en unos instantes.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWithdrawOffer = async (offer) => {
    if (isProcessing) return;
    const isConfirmed = await confirmAction({
      title: '¿Retirar la oferta?',
      player: offerPlayer(offer),
      amount: formatPriceShort(getOfferAmount(offer) / 1000000),
      message: 'El dinero reservado vuelve a tu presupuesto. Podés volver a ofertar después.',
      confirmLabel: 'Retirar oferta',
    });
    if (!isConfirmed) return;
    setIsProcessing(true);
    showStatusMessage?.('loading', `Retirando la oferta por ${offer.playerName}...`);
    try {
      await withdrawTransferOffer({
        db,
        offer,
        userId,
        teamName: userProfile?.teamName || 'Equipo',
      });
      showStatusMessage?.('success', `Oferta por ${offer.playerName} retirada.`);
    } catch (e) {
      console.error(e);
      showStatusMessage?.('error', e?.message || 'No se pudo retirar la oferta. Reintentá en unos instantes.');
    } finally {
      setIsProcessing(false);
    }
  };



  // --- LÓGICA DE ESTADÍSTICAS ---
  const ledger = useMemo(
    () => buildClubLedger({ squad: cart, offerHistory, userId: userId || userProfile?.uid, feeRate: TRANSFER_FEE_RATE }),
    [cart, offerHistory, userId, userProfile?.uid],
  );

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
        borderColor: '#0e1320',
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
        backgroundColor: '#3a66c4',
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
      legend: { position: 'bottom', labels: { color: '#b8c2d6', font: { size: 11, family: 'Barlow' }, boxWidth: 10, padding: 15 } },
      title: { display: false }
    },
    scales: {
      y: { ticks: { color: '#8692ab', stepSize: 1 }, grid: { color: 'rgba(150, 166, 200, 0.12)', drawBorder: false } },
      x: { ticks: { color: '#b8c2d6' }, grid: { display: false } }
    }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right', labels: { color: '#b8c2d6', font: { size: 11 }, boxWidth: 12, padding: 15 } }
    }
  };

  if (!isVisible && !isPage) return null;

  // Same base as "Disponible" (useBudget): the profile copy of the budget goes stale after a transfer.
  const { base: initialBudget, percent: budgetPct } = budgetMeter({
    base: budgetBase, profileBudget: userProfile?.budget, defaultBudget: DEFAULT_BUDGET, remaining: remainingBudget, percent: budgetPercent,
  });
  const activeCommitted = committedInOffers !== undefined
    ? committedInOffers
    : (sentOffers || []).filter(o => o.senderId === userId && o.status === 'pending').reduce((sum, o) => sum + (Number(o.offerAmount) || 0), 0);
  // One tone for the "Disponible" figure and its meter: accent, warning from 20% down (the budget alert's
  // threshold, hooks/useBudget.js), danger once nothing is left.
  const availableTone = remainingBudget <= 0 ? 'danger' : budgetPct <= 20 ? 'warning' : 'accent';
  const meterTone = { danger: 'bg-danger', warning: 'bg-warning', accent: 'bg-accent' }[availableTone];
  // Same format as every other price in the app ($12.50M). Keeps the sign: an overdrawn budget reads -$3.20M.
  const fmtM = (val) => {
    const v = Number(val) || 0;
    return v < 0 ? `-${formatPriceShort(-v / 1000000)}` : formatPriceShort(v / 1000000);
  };

  const tabs = [
    { id: 'players', label: 'Plantel', count: cart.length },
    { id: 'offers', label: 'Recibidas', count: incomingOffers?.length || 0 },
    { id: 'sent', label: 'Enviadas', count: sentOffers?.length || 0 },
    { id: 'history', label: 'Historial', count: offerHistory?.length || 0 },
    { id: 'stats', label: 'Finanzas' },
  ];

  const negotiationProps = {
    allTeams, playerMap, allPlayers, userId, userProfile, isProcessing, counteringOfferId, counterAmount, setCounterAmount, setCounteringOfferId,
    onAccept: handleAcceptOffer, onReject: handleRejectOffer, onCounter: handleCounterOffer, onWithdraw: handleWithdrawOffer,
  };

  const finances = (
    <section aria-label="Balance financiero" className="border-y border-line/[0.08] py-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
        {/* Short labels: each fits one line at 360px; the detail goes in the hint. */}
        <Stat label="Presupuesto" value={fmtM(initialBudget)} size="sm" hint="Cambia con los traspasos" />
        <Stat label="Gastado" value={fmtM(totalCartCost)} size="sm" hint="En el plantel" />
        <Stat label="En ofertas" value={fmtM(activeCommitted)} size="sm" tone={activeCommitted > 0 ? 'warning' : 'default'} hint="Enviadas, pendientes" />
        <Stat label="Disponible" value={fmtM(remainingBudget)} size="sm" tone={availableTone} hint={`${budgetPct.toFixed(0)}% del presupuesto`} />
      </div>
      <div className="mt-4 h-1.5 rounded-full bg-white/[0.06] overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(budgetPct)} aria-label="Presupuesto disponible">
        <div className={`h-full rounded-full transition-[width] duration-move ${meterTone}`} style={{ width: `${budgetPct}%` }} />
      </div>
    </section>
  );

  const content = (
    <>
      {activeTab === 'players' && (
        isSquadLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5" role="status" aria-label="Cargando el plantel">
            {Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-[70px] rounded-xl" />)}
          </div>
        ) : cart.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="Tu plantel está vacío" description="Explorá el mercado para fichar jugadores." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {sortedCart.map(player => (
              <CartMiniPlayerCard key={player.Id} player={player} playerMap={playerMap} allPlayers={allPlayers}
                onRemove={() => onRemoveFromCart(player)} onCardClick={() => onPlayerClick(player)} />
            ))}
          </div>
        )
      )}

      {activeTab === 'offers' && (
        incomingOffers.length === 0 ? (
          <EmptyState icon={DollarSign} title="No tenés ofertas pendientes" description="Cuando otros clubes ofrezcan por tus jugadores, las vas a ver acá." />
        ) : (
          <div className="space-y-3">
            {incomingOffers.map(offer => <NegotiationCard key={offer.id} offer={offer} isIncoming={true} {...negotiationProps} />)}
          </div>
        )
      )}

      {activeTab === 'sent' && (
        !sentOffers?.length ? (
          <EmptyState icon={DollarSign} title="No enviaste ofertas" description="Negociá por jugadores de otros clubes desde Rivales o el Mercado." />
        ) : (
          <div className="space-y-3">
            {sentOffers.map(offer => <NegotiationCard key={offer.id} offer={offer} isIncoming={false} {...negotiationProps} />)}
          </div>
        )
      )}

      {activeTab === 'history' && (
        !offerHistory?.length ? (
          <EmptyState icon={History} title="Todavía no hay negociaciones cerradas" description="Las ofertas aceptadas, rechazadas o retiradas quedan guardadas acá." />
        ) : (
          <div className="space-y-3">
            {offerHistory.map(offer => (
              <NegotiationCard key={offer.id} offer={offer} isHistory={true} isIncoming={offer.targetTeamId === userProfile?.uid} {...negotiationProps} />
            ))}
          </div>
        )
      )}

      {activeTab === 'stats' && (
        <div className="space-y-6">
          <section className="panel-flat p-5" aria-labelledby="cart-ledger">
            <h3 id="cart-ledger" className="eyebrow mb-4">Movimientos de la temporada</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Stat label="Fichajes" value={fmtM(ledger.totals.spentOnSignings)} hint={`${ledger.signings.length} jugadores`} size="sm" />
              <Stat label="Compras" value={fmtM(ledger.totals.spentOnPurchases)} hint={`${ledger.purchases.length} traspasos`} size="sm" />
              <Stat label="Ventas (neto)" value={fmtM(ledger.totals.receivedFromSales)} hint={`comisión ${fmtM(ledger.totals.fees)}`} size="sm" />
              <Stat label="Balance" value={fmtM(ledger.totals.net)} tone={ledger.totals.net < 0 ? 'danger' : 'accent'} size="sm" />
            </div>
            {(ledger.purchases.length > 0 || ledger.sales.length > 0) && (
              <ul className="mt-4 divide-y divide-line/[0.08] text-sm">
                {ledger.purchases.map(row => (
                  <li key={`buy-${row.id}`} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 truncate text-ink-2">Compra · <span className="text-ink">{row.name}</span>{row.club ? ` de ${row.club}` : ''}</span>
                    <span className="num font-semibold text-danger-soft shrink-0">-{fmtM(row.amount)}</span>
                  </li>
                ))}
                {ledger.sales.map(row => (
                  <li key={`sale-${row.id}`} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 truncate text-ink-2">Venta · <span className="text-ink">{row.name}</span>{row.club ? ` a ${row.club}` : ''}</span>
                    <span className="num font-semibold text-success-soft shrink-0">+{fmtM(row.net)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-ink-3">Los fichajes cuentan a precio de catálogo; las ventas, después de la comisión de la liga. El presupuesto disponible es el de arriba.</p>
          </section>
          <div className="grid grid-cols-3 gap-6">
            <Stat label="Media del plantel" value={statsData.avgOvr} tone="accent" size="sm" />
            <Stat label="Edad promedio" value={statsData.avgAge} hint="años" size="sm" />
            <Stat label="Jugadores" value={statsData.totalPlayers} size="sm" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="panel-flat p-5 flex flex-col" aria-labelledby="cart-chart-positions">
              <h3 id="cart-chart-positions" className="eyebrow mb-4">Distribución por línea</h3>
              <div className="flex-grow relative min-h-[220px]">
                <Doughnut data={statsData.positionChartData} options={doughnutOptions} aria-label="Gráfico de jugadores por línea" role="img" />
              </div>
            </section>
            <section className="panel-flat p-5 flex flex-col" aria-labelledby="cart-chart-countries">
              <h3 id="cart-chart-countries" className="eyebrow mb-4">Nacionalidades</h3>
              <div className="flex-grow relative min-h-[220px]">
                <Bar data={statsData.countryChartData} options={chartOptions} aria-label="Gráfico de las cinco nacionalidades más presentes" role="img" />
              </div>
            </section>
          </div>
        </div>
      )}
    </>
  );

  const tabList = <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab} label="Secciones del plantel" />;

  if (isPage) {
    return (
      <Page className="pb-10">
        <PageHeader
          eyebrow="Mi club"
          title="Plantel y finanzas"
          description={userProfile?.teamName || 'Mi Equipo'}
          actions={onOpenTactics && (
            <button type="button" onClick={onOpenTactics} className="btn btn-secondary">
              <ClipboardList className="w-4 h-4" aria-hidden="true" />Pizarra táctica
            </button>
          )}
        />
        {finances}
        {tabList}
        <div>{content}</div>
      </Page>
    );
  }

  const inner = (
    <div className="w-full h-full min-h-0 flex flex-col bg-surface">
      <div className="flex justify-between items-center gap-3 px-4 sm:px-6 py-3 shrink-0 border-b border-line/10">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold text-ink">Plantel y finanzas</h2>
          <p className="text-xs text-ink-3 truncate">{userProfile?.teamName || 'Mi Equipo'}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar plantel y finanzas" className="btn btn-ghost btn-icon">
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>
      <div className="flex-grow min-h-0 overflow-y-auto px-4 sm:px-6 py-4 space-y-5 custom-scrollbar">
        {finances}
        {tabList}
        <div>{content}</div>
      </div>
    </div>
  );



  return (
    <BaseModal
      isOpen={isVisible}
      onClose={onClose}
      ariaLabel="Finanzas y plantilla"
      showClose={false}
      size="2xl"
      className="h-[100dvh] sm:h-[88vh] max-w-6xl rounded-none border-0 sm:rounded-2xl sm:border"
      contentClassName="p-0 overflow-hidden"
    >
      {inner}
    </BaseModal>
  );
});
