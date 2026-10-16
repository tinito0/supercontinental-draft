// "Desde tu última visita": what happened in the manager's negotiations while they were away. The live
// notifications only cover what happens with the app open (app.jsx skips the first offers snapshot), so offers,
// counters, rejections and sales that arrived offline were never notified. Built from each offer's history
// (written by the clubs and by the market function) and the profile's lastSeenAt. Pure.
import { formatPriceShort } from './helpers.js';

const MAX_MISSED = 20;

const price = amount => formatPriceShort((Number(amount) || 0) / 1000000);

function describe(event, offer, userId) {
  const club = event.teamName || 'Un rival';
  const player = offer.playerName || 'un jugador';
  const isBuyer = offer.senderId === userId;
  switch (event.type) {
    case 'sent': return { text: `${club} te ofreció ${price(event.amount)} por ${player}.`, targetTab: 'offers', type: 'offer' };
    case 'countered': return { text: `${club} te contraofertó ${price(event.amount)} por ${player}.`, targetTab: 'sent', type: 'offer' };
    case 'rejected': return { text: `${club} rechazó la oferta por ${player}.`, targetTab: 'history', type: 'warning' };
    case 'withdrawn': return { text: `${club} retiró la oferta por ${player}.`, targetTab: 'history', type: 'warning' };
    case 'accepted': return isBuyer
      ? { text: `Traspaso aceptado: ${player} ahora está en tu equipo (${price(event.amount)}).`, targetTab: 'players', type: 'transfer' }
      : { text: `Venta confirmada: ${player} se fue por ${price(event.amount)}.`, targetTab: 'history', type: 'transfer' };
    default: return null;
  }
}

/**
 * Notifications for the other clubs' moves in the manager's offers after `sinceMs` (newest first, at most 20).
 * Nothing without a previous visit: a first login would otherwise list the whole history.
 * @param {object[]} offers offers where the manager is buyer or seller (any status)
 * @param {string} userId
 * @param {number|null|undefined} sinceMs profile.lastSeenAt
 */
export function missedOfferNotifications(offers, userId, sinceMs) {
  if (!userId || !Number.isFinite(sinceMs)) return [];
  const items = [];
  for (const offer of offers || []) {
    (Array.isArray(offer.history) ? offer.history : []).forEach((event, index) => {
      const at = Date.parse(event?.at);
      if (!Number.isFinite(at) || at <= sinceMs || event.teamId === userId) return;
      const info = describe(event, offer, userId);
      if (!info) return;
      items.push({
        id: `missed-${offer.id}-${index}`,
        category: 'transfer',
        type: info.type,
        offerId: offer.id,
        playerId: offer.playerId,
        targetTab: info.targetTab,
        text: info.text,
        time: 'Mientras no estabas',
        read: false,
        createdAt: new Date(at).toISOString(),
        at,
      });
    });
  }
  return items.sort((a, b) => b.at - a.at).slice(0, MAX_MISSED).map(({ at, ...item }) => item);
}
