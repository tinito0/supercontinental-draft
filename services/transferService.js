import { doc, runTransaction } from 'firebase/firestore';
import { APP_ID, MAX_TRANSFER_MULTIPLIER } from '../utils/constants.js';
import { offerExpiresAt } from '../supabase/functions/_shared/offerExpiry.js';

export function getOfferAmount(offer) {
  return offer?.status === 'countered' ? offer.counterAmount : offer?.offerAmount;
}

export function appendHistory(offer, event) {
  const cleanEvent = Object.fromEntries(
    Object.entries(event).filter(([, value]) => value !== undefined)
  );
  return [...(Array.isArray(offer?.history) ? offer.history : []), cleanEvent];
}

// Turnos de una negociación (mismos que isOfferTransition en firestore.rules):
// 'pending' lo responde el vendedor (targetTeamId); 'countered', el comprador (senderId).
const OFFER_ACTIONS = {
  reject: { pending: 'seller', countered: 'buyer' },
  withdraw: { pending: 'buyer', countered: 'seller' },
  counter: { pending: 'seller', countered: 'buyer' },
};

/**
 * Cambios que produce una acción sobre el estado vivo de la oferta, o un error si no le
 * toca a userId. Un comprador que responde una contraoferta hace una nueva oferta: vuelve a
 * 'pending' con su monto, y el turno pasa al vendedor.
 */
export function buildOfferUpdate({ offer, userId, action, amount, teamName, at }) {
  const role = userId === offer?.targetTeamId ? 'seller' : userId === offer?.senderId ? 'buyer' : null;
  if (!role) throw new Error('No participás en esta negociación.');
  if (OFFER_ACTIONS[action]?.[offer.status] !== role) {
    throw new Error('La oferta cambió o no es tu turno de responderla. Revisá su estado actual.');
  }

  const name = teamName || 'Equipo';
  const event = { teamId: userId, teamName: name, at };
  if (action === 'reject') {
    return {
      status: 'rejected',
      rejectedAt: at,
      rejectedBy: name,
      history: appendHistory(offer, { ...event, type: 'rejected', title: 'Oferta rechazada', amount: getOfferAmount(offer) }),
    };
  }
  if (action === 'withdraw') {
    return {
      status: 'withdrawn',
      withdrawnAt: at,
      history: appendHistory(offer, { ...event, type: 'withdrawn', title: 'Oferta retirada', amount: getOfferAmount(offer) }),
    };
  }
  // A counter or a new offer starts the other club's turn: 48 more hours to answer (offerExpiry.js).
  const expiresAtMs = offerExpiresAt(Date.parse(at));
  if (role === 'seller') {
    return {
      status: 'countered',
      counterAmount: amount,
      expiresAtMs,
      counterAt: at,
      counterBy: name,
      history: appendHistory(offer, { ...event, type: 'countered', title: 'Contraoferta enviada', amount }),
    };
  }
  return {
    status: 'pending',
    offerAmount: amount,
    expiresAtMs,
    reofferedAt: at,
    history: appendHistory(offer, { ...event, type: 'sent', title: 'Nueva oferta enviada', amount }),
  };
}

async function applyOfferAction(db, offerId, buildUpdate) {
  const offerRef = doc(db, `artifacts/${APP_ID}/public/data/offers`, offerId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(offerRef);
    if (!snap.exists()) throw new Error('La oferta ya no existe.');
    transaction.update(offerRef, buildUpdate(snap.data()));
  });
}

/**
 * Acepta una oferta de traspaso. Lo ejecuta el servidor (services/marketService.js → Edge Function
 * market): valida turno, montos con el precio real, fondos del comprador y propiedad del jugador, y
 * mueve lock, presupuestos, plantillas, oferta y feed en una transacción.
 */
export async function acceptTransferOffer({ offer, userId }) {
  if (!userId) {
    throw new Error('Debes iniciar sesión para aceptar una oferta.');
  }
  if (!offer?.id) throw new Error('Oferta inválida.');
  const { acceptOffer } = await import('./marketService.js');
  const result = await acceptOffer({ offerId: offer.id });
  return { success: true, ...result };
}

/**
 * Rechaza una oferta de traspaso.
 */
export async function rejectTransferOffer({ db, offer, userId, teamName }) {
  const at = new Date().toISOString();
  await applyOfferAction(db, offer.id, live => buildOfferUpdate({ offer: live, userId, action: 'reject', teamName, at }));
}

/**
 * Envía una contraoferta validada: el vendedor contraoferta una oferta 'pending'; el comprador
 * responde una 'countered' con una nueva oferta (ver buildOfferUpdate).
 */
export async function counterTransferOffer({ db, offer, userId, counterAmountMillions, livePlayer, teamName }) {
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

  const at = new Date().toISOString();
  const amount = Math.round(valueInMillions * 1000000);
  await applyOfferAction(db, offer.id, live => buildOfferUpdate({ offer: live, userId, action: 'counter', amount, teamName, at }));
}

/**
 * Retira una oferta: el comprador la suya 'pending'; el vendedor su contraoferta.
 */
export async function withdrawTransferOffer({ db, offer, userId, teamName }) {
  const at = new Date().toISOString();
  await applyOfferAction(db, offer.id, live => buildOfferUpdate({ offer: live, userId, action: 'withdraw', teamName, at }));
}
