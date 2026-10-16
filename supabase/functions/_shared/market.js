// Market operations executed on the server (Supabase Edge Function `market`). The browser can no
// longer write player locks, budgets, transfers or accepted offers (firestore.rules); it asks this
// code, which reads prices from catalog.json and the live Firestore state inside one transaction.
// Validations mirror the previous client code in app.jsx (handleAddToCart) and
// services/transferService.js (acceptTransferOffer).
import { ADMIN_USER_IDS, MAX_TRANSFER_MULTIPLIER, TRANSFER_FEE_RATE } from './marketConstants.js';
import { isFranchiseEligible, FRANCHISE_RULE_TEXT } from './franchise.js';
import { toUnits, spentOnLocks, committedInOffers } from './budget.js';
import { parseOpenTime } from './marketTime.js';

export class MarketError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'MarketError';
    this.status = status;
  }
}

const OPEN_OFFER_STATUSES = ['pending', 'countered'];

export function marketPaths(appId) {
  const base = `artifacts/${appId}`;
  return {
    market: `${base}/public/data/config/market`,
    team: uid => `${base}/public/data/teams/${uid}`,
    profile: uid => `${base}/users/${uid}/profile/data`,
    locks: `${base}/public/data/player_locks`,
    lock: playerId => `${base}/public/data/player_locks/${playerId}`,
    offers: `${base}/public/data/offers`,
    offer: offerId => `${base}/public/data/offers/${offerId}`,
    cart: (uid, playerId) => `${base}/users/${uid}/cart/${playerId}`,
    transfers: `${base}/public/data/transfers`,
    transfer: transferId => `${base}/public/data/transfers/${transferId}`,
  };
}

export function isMarketAdmin(uid, claims = {}) {
  return ADMIN_USER_IDS.includes(uid) || claims.admin === true;
}

/** Catalog row → player, or null when the id is unknown (or filtered out as glitched). */
export function getCatalogPlayer(catalog, playerId) {
  const row = catalog[String(playerId)];
  if (!row) return null;
  const [Precio, Age, OVR_CALCULADO, Name, POS_NOMBRE, Country1] = row;
  return { Id: Number(playerId), Precio, Age, OVR_CALCULADO, Name, POS_NOMBRE, Country1 };
}

const offerAmount = offer => (offer.status === 'countered' ? offer.counterAmount : offer.offerAmount);

/** Whether the market is open for this team. The app (app.jsx) imports this same function. */
export function isMarketOpen(marketStatus, team, isAdmin, now = new Date()) {
  if (isAdmin || team?.inWhitelist) return true;
  const status = marketStatus?.status || 'closed';
  if (status === 'open' || status === 'FranchiseMarket') return true;
  const openTime = status === 'scheduled' ? parseOpenTime(marketStatus.openTime) : null;
  return Boolean(openTime) && now > openTime;
}

/** Money already spent (locks not franchise) or committed in pending offers by a team (budget.js). */
export async function getCommittedFunds(tx, paths, catalog, teamId, { excludeOfferId, franchisePlayerId } = {}) {
  const [locks, offers] = await Promise.all([
    tx.query(paths.locks, [['lockedBy', '==', teamId]]),
    tx.query(paths.offers, [['senderId', '==', teamId], ['status', '==', 'pending']]),
  ]);
  const spent = spentOnLocks(
    locks.map(lock => [lock.id, lock.data]),
    playerId => getCatalogPlayer(catalog, playerId)?.Precio ?? 0,
    { franchisePlayerId },
  );
  const committed = committedInOffers(offers.map(offer => ({ id: offer.id, ...offer.data })), { excludeOfferId });
  return spent + committed;
}

/** Signs a free player for the calling manager (normal or franchise signing). */
export async function signPlayer({ tx, appId, catalog, user, playerId, isFranchise = false, now = new Date() }) {
  const paths = marketPaths(appId);
  const player = getCatalogPlayer(catalog, playerId);
  if (!player) throw new MarketError('Jugador no encontrado en la base de datos.', 404);
  const lockId = String(player.Id);

  const [market, team, profile, lock] = await Promise.all([
    tx.get(paths.market), tx.get(paths.team(user.uid)), tx.get(paths.profile(user.uid)), tx.get(paths.lock(lockId)),
  ]);
  if (!team || !profile) throw new MarketError('Tu equipo no está configurado. Volvé a iniciar sesión.', 409);
  const marketStatus = market?.data || { status: 'closed' };

  if (!isMarketOpen(marketStatus, team.data, user.isAdmin, now)) {
    throw new MarketError('El mercado está cerrado.', 403);
  }
  if (!isFranchise && marketStatus.status === 'FranchiseMarket') {
    throw new MarketError('Solo se permiten fichajes de Jugadores Franquicia en este momento.', 403);
  }
  if (lock) {
    throw new MarketError(lock.data.lockedBy === user.uid
      ? 'Este jugador ya es tuyo.'
      : `Jugador bloqueado por ${lock.data.teamName || 'otro equipo'}.`, 409);
  }

  if (isFranchise) {
    if (profile.data.franchisePlayerUsed) {
      throw new MarketError('Ya has utilizado tu ficha de Jugador Franquicia esta temporada.', 409);
    }
    if (!isFranchiseEligible(player)) {
      throw new MarketError(`El jugador no cumple los requisitos de Jugador Franquicia (${FRANCHISE_RULE_TEXT}).`);
    }
  } else {
    const budget = Number(team.data.budget ?? profile.data.budget) || 0;
    const committed = await getCommittedFunds(tx, paths, catalog, user.uid, { franchisePlayerId: profile.data.franchisePlayerId });
    if (budget - committed < toUnits(player.Precio)) {
      throw new MarketError('No tienes presupuesto suficiente (incluyendo ofertas comprometidas).', 409);
    }
  }

  const teamName = profile.data.teamName || team.data.teamName || 'Equipo';
  tx.create(paths.lock(lockId), { lockedBy: user.uid, teamName, lockedAt: now.toISOString(), isFranchise });
  if (isFranchise) {
    tx.update(paths.profile(user.uid), { franchisePlayerUsed: true, franchisePlayerId: player.Id });
  }
  // Touching the team serialises concurrent signings by the same manager (budget check above).
  tx.update(paths.team(user.uid), { marketUpdatedAt: now.toISOString() });
  tx.create(paths.transfer(tx.newId()), {
    playerId: player.Id,
    playerName: player.Name,
    teamId: user.uid,
    teamName,
    price: isFranchise ? 0 : player.Precio,
    isFranchise,
  }, { serverTimestamps: ['timestamp'] });

  return { playerId: player.Id, playerName: player.Name, isFranchise };
}

function appendHistory(offer, event) {
  return [...(Array.isArray(offer.history) ? offer.history : []), event];
}

/** Accepts a transfer offer: moves the player and both budgets, closes the other offers for it. */
export async function acceptOffer({ tx, appId, catalog, user, offerId, now = new Date() }) {
  const paths = marketPaths(appId);
  const offerSnap = await tx.get(paths.offer(offerId));
  if (!offerSnap || !OPEN_OFFER_STATUSES.includes(offerSnap.data.status)) {
    throw new MarketError('La oferta ya no es válida o ya fue procesada.', 409);
  }
  const offer = offerSnap.data;
  const { senderId: buyerId, targetTeamId: sellerId } = offer;
  if (!buyerId || !sellerId || buyerId === sellerId) {
    throw new MarketError('Oferta inválida: comprador y vendedor no pueden ser el mismo equipo.');
  }
  const accepterId = offer.status === 'countered' ? buyerId : sellerId;
  if (user.uid !== accepterId) {
    throw new MarketError('Solo el equipo que recibió la oferta actual puede aceptarla.', 403);
  }
  const player = getCatalogPlayer(catalog, offer.playerId);
  if (!player) throw new MarketError('Jugador no encontrado en la base de datos.', 404);
  const lockId = String(player.Id);

  const [market, buyerTeam, sellerTeam, buyerProfile, lock, playerOffers] = await Promise.all([
    tx.get(paths.market), tx.get(paths.team(buyerId)), tx.get(paths.team(sellerId)), tx.get(paths.profile(buyerId)),
    tx.get(paths.lock(lockId)), tx.query(paths.offers, [['playerId', '==', offer.playerId]]),
  ]);
  if (!sellerTeam) throw new MarketError('Equipo vendedor no encontrado.', 404);
  if (!buyerTeam) throw new MarketError('Equipo comprador no encontrado.', 404);
  const accepterTeam = accepterId === buyerId ? buyerTeam : sellerTeam;
  if (!isMarketOpen(market?.data || { status: 'closed' }, accepterTeam.data, user.isAdmin, now)) {
    throw new MarketError('El mercado está cerrado.', 403);
  }
  if (!lock || lock.data.lockedBy !== sellerId) throw new MarketError('El jugador ya no pertenece al equipo vendedor.', 409);
  if (lock.data.isFranchise) throw new MarketError('Los jugadores franquicia no son transferibles.', 409);

  const amount = Number(offerAmount(offer));
  const baseCost = toUnits(player.Precio);
  const maxAmount = Math.round((baseCost / 1000000) * MAX_TRANSFER_MULTIPLIER * 100) * 10000;
  if (!Number.isSafeInteger(amount) || !baseCost || amount < baseCost || amount > maxAmount) {
    throw new MarketError('El monto ya no cumple los límites del jugador.', 409);
  }

  const buyerBudget = Number(buyerTeam.data.budget) || 0;
  const sellerBudget = Number(sellerTeam.data.budget) || 0;
  const buyerCommitted = await getCommittedFunds(tx, paths, catalog, buyerId, {
    excludeOfferId: offerId, franchisePlayerId: buyerProfile?.data.franchisePlayerId,
  });
  if (buyerBudget - buyerCommitted < amount) {
    throw new MarketError('El comprador no tiene fondos líquidos suficientes (incluyendo ofertas comprometidas).', 409);
  }

  const at = now.toISOString();
  const sellerNet = Math.round(amount * (1 - TRANSFER_FEE_RATE));
  const transferFee = amount - sellerNet;
  // Names, crests and player data come from the team documents and the catalog, never from the offer:
  // its creator writes those fields, and they end up in the lock and the public feed.
  const buyerName = buyerTeam.data.teamName || 'Equipo comprador';
  const sellerName = sellerTeam.data.teamName || 'Equipo vendedor';
  const buyerLogo = buyerTeam.data.logoUrl || '';
  const sellerLogo = sellerTeam.data.logoUrl || '';
  const rosterEntry = { Id: lockId, Name: player.Name || 'Jugador', POS_NOMBRE: player.POS_NOMBRE || '', OVR_CALCULADO: Number(player.OVR_CALCULADO) || 0, available: true };
  const withoutPlayer = roster => (Array.isArray(roster) ? roster : []).filter(p => String(p.Id) !== lockId);

  tx.update(paths.lock(lockId), { lockedBy: buyerId, teamName: buyerName, lockedAt: at });
  // The seller's private copy goes now, even if the seller never opens the app again: the PES exports read
  // squads from locks, but the app shows the cart. The buyer's copy (full catalog row) is added by the app
  // (hooks/useSquadSync.js) when it sees the lock.
  tx.delete(paths.cart(sellerId, lockId));
  tx.update(paths.team(buyerId), {
    budget: buyerBudget + baseCost - amount,
    roster: [...withoutPlayer(buyerTeam.data.roster), rosterEntry],
    rosterUpdatedAt: at,
  });
  tx.update(paths.team(sellerId), {
    budget: sellerBudget + sellerNet - baseCost,
    roster: withoutPlayer(sellerTeam.data.roster),
    rosterUpdatedAt: at,
  });
  tx.update(paths.offer(offerId), {
    status: 'accepted',
    acceptedAt: at,
    targetTeamName: sellerName,
    targetTeamLogo: sellerLogo,
    senderTeamName: buyerName,
    senderTeamLogo: buyerLogo,
    history: appendHistory(offer, {
      type: 'accepted', title: 'Traspaso aceptado', teamId: user.uid,
      teamName: user.uid === buyerId ? buyerName : sellerName, amount, at,
    }),
  });
  // Other open offers for this player can no longer be accepted and kept the buyers' money frozen.
  playerOffers
    .filter(other => other.id !== offerId && OPEN_OFFER_STATUSES.includes(other.data.status))
    .forEach(other => tx.update(paths.offer(other.id), {
      status: 'rejected',
      rejectedAt: at,
      rejectedBy: sellerName,
      history: appendHistory(other.data, {
        type: 'rejected', title: 'El jugador fue traspasado a otro equipo', teamId: sellerId,
        teamName: sellerName, amount: offerAmount(other.data), at,
      }),
    }));
  tx.create(paths.transfer(tx.newId()), {
    playerId: player.Id,
    playerName: player.Name || 'Jugador',
    playerOvr: Number(player.OVR_CALCULADO) || 0,
    playerPosition: player.POS_NOMBRE || '',
    playerCountry: player.Country1 || '',
    fromTeamId: sellerId,
    fromTeamName: sellerName,
    fromTeamLogo: sellerLogo,
    teamId: buyerId,
    teamName: buyerName,
    teamLogo: buyerLogo,
    price: amount / 1000000,
    sellerReceives: sellerNet / 1000000,
    transferFee: transferFee / 1000000,
    type: 'transfer',
    isFranchise: false,
  }, { serverTimestamps: ['timestamp'] });

  return { playerId: player.Id, playerName: player.Name, amount };
}

/**
 * Releases one of the caller's players back to the market: lock, private copy, the team's own signing in
 * the feed and its public roster entry. Open offers for the player are closed, so no buyer keeps money
 * held for a player that is no longer for sale. Franchise players are not released (the admin can reset
 * the franchise slot). Not limited by the market state, as before.
 */
export async function releasePlayer({ tx, appId, user, playerId, now = new Date() }) {
  const paths = marketPaths(appId);
  const lockId = String(playerId);
  const numericId = Number(playerId);
  const [market, lock, team, playerOffers, signings] = await Promise.all([
    tx.get(paths.market), tx.get(paths.lock(lockId)), tx.get(paths.team(user.uid)),
    tx.query(paths.offers, [['playerId', '==', numericId]]),
    tx.query(paths.transfers, [['playerId', '==', numericId], ['teamId', '==', user.uid]]),
  ]);
  if (!lock || lock.data.lockedBy !== user.uid) {
    throw new MarketError('Este jugador ya no está en tu plantel.', 409);
  }
  if (lock.data.isFranchise) {
    throw new MarketError('Los Jugadores Franquicia no se pueden liberar. Pedile al administrador que resetee la franquicia.', 409);
  }
  // A release refunds the player's price, so with the market closed it would let squads change while no one can buy.
  if (!isMarketOpen(market?.data || { status: 'closed' }, team?.data, user.isAdmin, now)) {
    throw new MarketError('El mercado está cerrado.', 403);
  }

  const at = now.toISOString();
  const teamName = team?.data.teamName || lock.data.teamName || 'Equipo';
  tx.delete(paths.lock(lockId));
  tx.delete(paths.cart(user.uid, lockId));
  if (team) {
    const roster = (Array.isArray(team.data.roster) ? team.data.roster : []).filter(p => String(p.Id) !== lockId);
    tx.update(paths.team(user.uid), { roster, rosterUpdatedAt: at });
  }
  // The team's own signing leaves the feed; transfers between teams stay (history).
  signings
    .filter(entry => entry.data.type !== 'transfer')
    .forEach(entry => tx.delete(paths.transfer(entry.id)));
  playerOffers
    .filter(offer => OPEN_OFFER_STATUSES.includes(offer.data.status))
    .forEach(offer => tx.update(paths.offer(offer.id), {
      status: 'rejected',
      rejectedAt: at,
      rejectedBy: teamName,
      history: appendHistory(offer.data, {
        type: 'rejected', title: 'El jugador fue liberado', teamId: user.uid,
        teamName, amount: offerAmount(offer.data), at,
      }),
    }));

  return { playerId: numericId };
}

/** Entry point shared by the Edge Function and the tests. */
export async function handleMarketAction({ firestore, appId, catalog, user, body, now = new Date() }) {
  const action = body?.action;
  if (action === 'sign') {
    const playerId = body.playerId;
    if (playerId === undefined || playerId === null || !/^\d+$/.test(String(playerId))) {
      throw new MarketError('Jugador inválido.');
    }
    return firestore.runTransaction(tx => signPlayer({ tx, appId, catalog, user, playerId, isFranchise: body.isFranchise === true, now }));
  }
  if (action === 'release') {
    const playerId = body.playerId;
    if (playerId === undefined || playerId === null || !/^\d+$/.test(String(playerId))) {
      throw new MarketError('Jugador inválido.');
    }
    return firestore.runTransaction(tx => releasePlayer({ tx, appId, user, playerId, now }));
  }
  if (action === 'acceptOffer') {
    const offerId = body.offerId;
    if (typeof offerId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(offerId)) throw new MarketError('Oferta inválida.');
    return firestore.runTransaction(tx => acceptOffer({ tx, appId, catalog, user, offerId, now }));
  }
  throw new MarketError('Acción desconocida.');
}
