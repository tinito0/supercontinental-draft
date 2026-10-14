import { doc, runTransaction, updateDoc, collection, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { APP_ID, MAX_TRANSFER_MULTIPLIER, TRANSFER_FEE_RATE } from '../utils/constants.js';

export function getOfferAmount(offer) {
  return offer?.status === 'countered' ? offer.counterAmount : offer?.offerAmount;
}

export function appendHistory(offer, event) {
  const cleanEvent = Object.fromEntries(
    Object.entries(event).filter(([, value]) => value !== undefined)
  );
  return [...(Array.isArray(offer?.history) ? offer.history : []), cleanEvent];
}

/**
 * Acepta una oferta de traspaso ejecutando la transacción multi-documento atómica en Firestore.
 */
export async function acceptTransferOffer({
  db,
  offer,
  userId,
  allPlayers,
  playerMap,
  allTeams,
}) {
  if (!userId) {
    throw new Error('Debes iniciar sesión para aceptar una oferta.');
  }
  if (!offer?.senderId || !offer?.targetTeamId || offer.senderId === offer.targetTeamId) {
    throw new Error('Oferta inválida: comprador y vendedor no pueden ser el mismo equipo.');
  }

  const livePlayer = playerMap
    ? playerMap.get(String(offer.playerId))
    : allPlayers?.find(p => String(p.Id) === String(offer.playerId));
  if (!livePlayer) throw new Error('Jugador no encontrado en la base de datos.');

  let activeAmount = Number(getOfferAmount(offer));
  if (!Number.isFinite(activeAmount) || activeAmount <= 0) {
    throw new Error('Monto de oferta inválido.');
  }

  // 1. Calcular gasto del comprador sumando sus bloqueos activos en public/data/player_locks
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

  // 2. Calcular otras ofertas pendientes del comprador
  const offersSnap = await getDocs(query(
    collection(db, `artifacts/${APP_ID}/public/data/offers`),
    where('senderId', '==', offer.senderId),
    where('status', '==', 'pending')
  ));
  let buyerOtherCommittedOffers = 0;
  offersSnap.forEach(docSnap => {
    if (docSnap.id !== offer.id) {
      const oData = docSnap.data();
      buyerOtherCommittedOffers += Number(oData.offerAmount) || 0;
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

    if (!sellerTeamDoc.exists()) throw new Error('Equipo vendedor no encontrado.');
    if (!buyerTeamDoc.exists()) throw new Error('Equipo comprador no encontrado.');

    const buyerBudget = Number(buyerTeamDoc.data().budget) || 0;
    const sellerBudget = Number(sellerTeamDoc.data().budget) || 0;
    const buyerTeamName = offer.senderTeamName || buyerTeamDoc.data()?.teamName || allTeams?.[offer.senderId]?.teamName || 'Equipo comprador';
    const sellerTeamName = offer.targetTeamName || sellerTeamDoc.data()?.teamName || allTeams?.[offer.targetTeamId]?.teamName || 'Equipo vendedor';
    const buyerTeamLogo = offer.senderTeamLogo || buyerTeamDoc.data()?.logoUrl || allTeams?.[offer.senderId]?.logoUrl || '';
    const sellerTeamLogo = offer.targetTeamLogo || sellerTeamDoc.data()?.logoUrl || allTeams?.[offer.targetTeamId]?.logoUrl || '';

    // Verificar validez de oferta
    if (!offerDoc.exists() || (offerDoc.data().status !== 'pending' && offerDoc.data().status !== 'countered')) {
      throw new Error('La oferta ya no es válida o ya fue procesada.');
    }
    const liveOffer = offerDoc.data();
    const expectedAccepterId = liveOffer.status === 'countered' ? liveOffer.senderId : liveOffer.targetTeamId;
    if (userId !== expectedAccepterId) {
      throw new Error('Solo el equipo que recibió la oferta actual puede aceptarla.');
    }
    activeAmount = Number(getOfferAmount(liveOffer));

    const buyerRemainingBudget = buyerBudget - buyerCartTotal - buyerOtherCommittedOffers;
    if (!Number.isFinite(activeAmount) || buyerRemainingBudget < activeAmount) {
      throw new Error('El comprador no tiene fondos líquidos suficientes (incluyendo ofertas comprometidas).');
    }

    // Verificar propiedad del vendedor
    if (!lockDoc.exists() || lockDoc.data().lockedBy !== offer.targetTeamId) {
      throw new Error('El jugador ya no pertenece al equipo vendedor.');
    }
    if (lockDoc.data().isFranchise) {
      throw new Error('Los jugadores franquicia no son transferibles.');
    }

    const playerBaseCost = Math.round((Number(livePlayer.Precio) || 0) * 1000000);
    const maxTransferAmount = Math.round((playerBaseCost / 1000000) * MAX_TRANSFER_MULTIPLIER * 100) * 10000;
    if (!Number.isSafeInteger(activeAmount) || !playerBaseCost || activeAmount < playerBaseCost || activeAmount > maxTransferAmount) {
      throw new Error('El monto ya no cumple los límites del jugador.');
    }

    const acceptedAt = new Date().toISOString();

    // 1. Transferir lock al comprador
    transaction.update(lockRef, {
      lockedBy: offer.senderId,
      teamName: buyerTeamName,
      lockedAt: acceptedAt,
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
      },
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
      }),
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
      timestamp: serverTimestamp(),
    });
  });

  return { success: true, livePlayer, activeAmount };
}

/**
 * Rechaza una oferta de traspaso.
 */
export async function rejectTransferOffer({ db, offer, teamName }) {
  const offerRef = doc(db, `artifacts/${APP_ID}/public/data/offers`, offer.id);
  const rejectedAt = new Date().toISOString();
  await updateDoc(offerRef, {
    status: 'rejected',
    rejectedAt,
    rejectedBy: teamName || 'Equipo',
    history: appendHistory(offer, {
      type: 'rejected',
      title: 'Oferta rechazada',
      teamId: offer.targetTeamId || offer.senderId,
      teamName: teamName || 'Equipo',
      amount: getOfferAmount(offer),
      at: rejectedAt,
    }),
  });
}

/**
 * Envía una contraoferta validada.
 */
export async function counterTransferOffer({ db, offer, counterAmountMillions, livePlayer, teamName }) {
  const valueInMillions = Number(counterAmountMillions);
  const maxCounterAmount = livePlayer
    ? Math.round(Number(livePlayer.Precio) * MAX_TRANSFER_MULTIPLIER * 100) / 100
    : 0;

  if (
    !Number.isFinite(valueInMillions) ||
    valueInMillions <= 0 ||
    !livePlayer ||
    valueInMillions < Number(livePlayer.Precio) ||
    valueInMillions > maxCounterAmount
  ) {
    throw new Error(`La contraoferta debe estar entre el valor base y $${maxCounterAmount.toFixed(2)}M (115% del valor base).`);
  }

  const proposalRef = doc(db, `artifacts/${APP_ID}/public/data/offers`, offer.id);
  const counterAt = new Date().toISOString();
  const counterValue = Math.round(valueInMillions * 1000000);

  await updateDoc(proposalRef, {
    status: 'countered',
    counterAmount: counterValue,
    counterAt,
    counterBy: teamName || 'Equipo',
    history: appendHistory(offer, {
      type: 'countered',
      title: 'Contraoferta enviada',
      teamId: offer.targetTeamId || offer.senderId,
      teamName: teamName || 'Equipo',
      amount: counterValue,
      at: counterAt,
    }),
  });
}

/**
 * Retira una oferta enviada pendiente.
 */
export async function withdrawTransferOffer({ db, offer, teamName }) {
  const offerRef = doc(db, `artifacts/${APP_ID}/public/data/offers`, offer.id);
  const withdrawnAt = new Date().toISOString();
  await updateDoc(offerRef, {
    status: 'withdrawn',
    withdrawnAt,
    history: appendHistory(offer, {
      type: 'withdrawn',
      title: 'Oferta retirada',
      teamId: offer.senderId || offer.targetTeamId,
      teamName: teamName || 'Equipo',
      amount: getOfferAmount(offer),
      at: withdrawnAt,
    }),
  });
}
