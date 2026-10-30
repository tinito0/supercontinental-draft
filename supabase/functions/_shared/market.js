// Market operations executed on the server (Supabase Edge Function `market`). The browser can no
// longer write player locks, budgets, transfers or accepted offers (firestore.rules); it asks this
// code, which reads prices from catalog.json and the live Firestore state inside one transaction.
// Validations mirror the previous client code in app.jsx (handleAddToCart) and
// services/transferService.js (acceptTransferOffer).
import { ADMIN_USER_IDS, MAX_TRANSFER_MULTIPLIER, TRANSFER_FEE_RATE } from './marketConstants.js';
import { isFranchiseEligible, FRANCHISE_RULE_TEXT } from './franchise.js';
import { toUnits, spentOnLocks, committedInOffers } from './budget.js';
import { parseOpenTime } from './marketTime.js';
import { isOfferExpired } from './offerExpiry.js';
import { isTeamApproved, PENDING_APPROVAL_MESSAGE } from './membership.js';

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
    cartCollection: uid => `${base}/users/${uid}/cart`,
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
export async function getCommittedFunds(tx, paths, catalog, teamId, { excludeOfferId, franchisePlayerId, now = new Date() } = {}) {
  const [locks, offers] = await Promise.all([
    tx.query(paths.locks, [['lockedBy', '==', teamId]]),
    tx.query(paths.offers, [['senderId', '==', teamId], ['status', '==', 'pending']]),
  ]);
  const spent = spentOnLocks(
    locks.map(lock => [lock.id, lock.data]),
    playerId => getCatalogPlayer(catalog, playerId)?.Precio ?? 0,
    { franchisePlayerId },
  );
  const committed = committedInOffers(offers.map(offer => ({ id: offer.id, ...offer.data })), { excludeOfferId, nowMs: now.getTime() });
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
  if (!user.isAdmin && !isTeamApproved(team.data)) throw new MarketError(PENDING_APPROVAL_MESSAGE, 403);
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
    const committed = await getCommittedFunds(tx, paths, catalog, user.uid, { franchisePlayerId: profile.data.franchisePlayerId, now });
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
  if (isOfferExpired(offer, now.getTime())) {
    throw new MarketError('La oferta venció: pasaron más de 48 horas sin respuesta.', 409);
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
  if (!user.isAdmin && (!isTeamApproved(buyerTeam.data) || !isTeamApproved(sellerTeam.data))) {
    throw new MarketError('Uno de los dos equipos todavía no fue aprobado por el administrador de la liga.', 403);
  }
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
    excludeOfferId: offerId, franchisePlayerId: buyerProfile?.data.franchisePlayerId, now,
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

/**
 * Moves an old email/password account's club to the Google account of the same manager, in one transaction:
 * profile, public team, player locks, cart, offers and transfers. The caller is the old account (its token
 * authorises the request); the Google account proves itself with its own ID token (newUser, verified by the
 * Edge Function). Used by screens/LinkGoogleScreen.jsx when that Google account already exists as a separate
 * Firebase user, so linking it in the browser fails (auth/credential-already-in-use).
 */
export async function migrateAccount({ tx, appId, user, newUser, now = new Date() }) {
  const paths = marketPaths(appId);
  const oldUid = user.uid;
  const newUid = newUser?.uid;
  if (!newUid || newUid === oldUid) throw new MarketError('Cuenta de Google inválida para migrar.');
  if (newUser.provider !== 'google.com') throw new MarketError('La cuenta nueva tiene que ser de Google.');

  const [oldProfile, oldTeam, newProfile, newTeam, locks, cart, sent, received, bought, sold] = await Promise.all([
    tx.get(paths.profile(oldUid)), tx.get(paths.team(oldUid)), tx.get(paths.profile(newUid)), tx.get(paths.team(newUid)),
    tx.query(paths.locks, [['lockedBy', '==', oldUid]]),
    tx.query(paths.cartCollection(oldUid), []),
    tx.query(paths.offers, [['senderId', '==', oldUid]]),
    tx.query(paths.offers, [['targetTeamId', '==', oldUid]]),
    tx.query(paths.transfers, [['teamId', '==', oldUid]]),
    tx.query(paths.transfers, [['fromTeamId', '==', oldUid]]),
  ]);
  if (!oldProfile || !oldTeam) throw new MarketError('La cuenta anterior no tiene un equipo para migrar.', 404);
  if (oldProfile.data.migratedTo) throw new MarketError('Este equipo ya fue migrado a otra cuenta.', 409);
  if (newProfile || newTeam) {
    throw new MarketError('Esa cuenta de Google ya tiene su propio equipo. Pedile al administrador que lo resuelva.', 409);
  }

  const at = now.toISOString();
  const providers = Array.from(new Set([...(oldProfile.data.providers || []), 'google.com']));
  tx.create(paths.profile(newUid), { ...oldProfile.data, userId: newUid, providers: ['google.com'], migratedFrom: oldUid, migratedAt: at });
  tx.create(paths.team(newUid), { ...oldTeam.data, userId: newUid, rosterUpdatedAt: at });
  // The old profile stays as a marker: an email login of the old account is told to use Google (hooks/useAuth.js).
  tx.update(paths.profile(oldUid), { migratedTo: newUid, providers, migratedAt: at });
  tx.delete(paths.team(oldUid));
  locks.forEach(lock => tx.update(paths.lock(lock.id), { lockedBy: newUid }));
  cart.forEach(row => {
    tx.create(paths.cart(newUid, row.id), row.data);
    tx.delete(paths.cart(oldUid, row.id));
  });
  sent.forEach(offer => tx.update(paths.offer(offer.id), { senderId: newUid }));
  received.forEach(offer => tx.update(paths.offer(offer.id), { targetTeamId: newUid }));
  bought.forEach(entry => tx.update(paths.transfer(entry.id), { teamId: newUid }));
  sold.forEach(entry => tx.update(paths.transfer(entry.id), { fromTeamId: newUid }));

  return { from: oldUid, to: newUid, players: locks.length, offers: sent.length + received.length };
}

const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
// Same limit as the «Mánager en la liga» field of the club card (utils/leagueContent.js CLUB_PROFILE_FIELDS).
const CLUB_MANAGER_MAX = 80;
// Per-user collections that belong to the club and move with it. presence and pes_roles stay with the person.
const CLUB_USER_COLLECTIONS = ['cart', 'saved_filters', 'scout_searches', 'scout_usage'];
// Profile fields about the person, not the club: never copied to the new manager. isAdmin and role above all.
const PERSONAL_PROFILE_FIELDS = new Set([
  'isAdmin', 'role', 'email', 'providers',
  'migratedTo', 'migratedFrom', 'migratedAt', 'clubTransferredTo', 'clubTransferredFrom', 'clubTransferredAt',
]);
// Firestore commits at most 500 writes; leave room so the commit never fails half-planned.
const MAX_TRANSFER_WRITES = 480;

/**
 * Admin «Cambiar manager» (components/admin/ClubTransferDialog.jsx): moves a whole club from one account to
 * another, in one transaction. The target is a pending, empty team, created when the new manager signed in.
 *
 * Moved: profile and public team, player locks, cart, saved filters, scouting, offers, transfers, the club page
 * (league_content `club-{uid}`, plus the new manager's name on its card), the on-air overlay, shared formations and
 * the Draft → PES assignment of every PES workspace. Not moved on purpose: chat messages (they stay the old
 * manager's), community votes and PES roles (personal). Tournament tables name clubs, not accounts.
 * The old profile keeps `clubTransferredTo`, so hooks/useAuth.js shuts that account out instead of re-creating a club.
 */
export async function transferClub({ tx, appId, user, fromUid, toUid, managerName = '', now = new Date() }) {
  if (!user?.isAdmin) throw new MarketError('Solo el administrador puede cambiar el manager de un club.', 403);
  if (!UID_PATTERN.test(String(fromUid || '')) || !UID_PATTERN.test(String(toUid || '')) || fromUid === toUid) {
    throw new MarketError('Elegí un club y una cuenta nueva distintos.');
  }
  const manager = String(managerName || '').trim().slice(0, CLUB_MANAGER_MAX);
  const paths = marketPaths(appId);
  const base = `artifacts/${appId}`;
  const userCollection = (uid, name) => `${base}/users/${uid}/${name}`;
  const clubPage = uid => `${base}/public/data/league_content/club-${uid}`;
  const overlayPath = `${base}/public/data/broadcast/overlay`;

  const [oldProfile, oldTeam, newProfile, newTeam, locks, newLocks, sent, received, newSent, newReceived, bought, sold,
    oldClub, newClub, overlay, formations, workspaces, newCart] = await Promise.all([
    tx.get(paths.profile(fromUid)), tx.get(paths.team(fromUid)), tx.get(paths.profile(toUid)), tx.get(paths.team(toUid)),
    tx.query(paths.locks, [['lockedBy', '==', fromUid]]),
    tx.query(paths.locks, [['lockedBy', '==', toUid]]),
    tx.query(paths.offers, [['senderId', '==', fromUid]]),
    tx.query(paths.offers, [['targetTeamId', '==', fromUid]]),
    tx.query(paths.offers, [['senderId', '==', toUid]]),
    tx.query(paths.offers, [['targetTeamId', '==', toUid]]),
    tx.query(paths.transfers, [['teamId', '==', fromUid]]),
    tx.query(paths.transfers, [['fromTeamId', '==', fromUid]]),
    tx.get(clubPage(fromUid)), tx.get(clubPage(toUid)), tx.get(overlayPath),
    tx.query(`${base}/public/data/shared_formations`, [['createdBy', '==', fromUid]]),
    tx.query(`${base}/pes_workspaces`, []),
    tx.query(userCollection(toUid, 'cart'), []),
  ]);
  const userRows = await Promise.all(CLUB_USER_COLLECTIONS.map(name => tx.query(userCollection(fromUid, name), [])));

  if (!oldProfile || !oldTeam) throw new MarketError('Ese club no existe o ya pasó a otra cuenta.', 404);
  // The old account is shut out afterwards (hooks/useAuth.js): an admin account would lose access to Administración.
  if (ADMIN_USER_IDS.includes(fromUid) || oldProfile.data.isAdmin === true || oldProfile.data.role === 'admin') {
    throw new MarketError('Ese club es de una cuenta de administrador: no se puede pasar a otro manager.', 409);
  }
  if (!newProfile || !newTeam) throw new MarketError('La cuenta nueva no tiene equipo: el manager nuevo tiene que entrar primero a /draft.', 404);
  if (newTeam.data.approved !== false) {
    throw new MarketError('La cuenta nueva tiene que ser un equipo pendiente de aprobación, recién ingresado.', 409);
  }
  const newHasActivity = newLocks.length > 0 || newCart.length > 0
    || [...newSent, ...newReceived].some(offer => OPEN_OFFER_STATUSES.includes(offer.data.status));
  if (newHasActivity) throw new MarketError('La cuenta nueva ya tiene jugadores u ofertas: tiene que estar vacía.', 409);

  const at = now.toISOString();
  const clubProfileData = Object.fromEntries(Object.entries(oldProfile.data).filter(([key]) => !PERSONAL_PROFILE_FIELDS.has(key)));
  const personalData = Object.fromEntries(Object.entries(newProfile.data).filter(([key]) => PERSONAL_PROFILE_FIELDS.has(key)));
  tx.set(paths.profile(toUid), { ...clubProfileData, ...personalData, userId: toUid, clubTransferredFrom: fromUid, clubTransferredAt: at });
  tx.set(paths.team(toUid), { ...oldTeam.data, userId: toUid, rosterUpdatedAt: at });
  tx.update(paths.profile(fromUid), { clubTransferredTo: toUid, clubTransferredAt: at });
  tx.delete(paths.team(fromUid));

  locks.forEach(lock => tx.update(paths.lock(lock.id), { lockedBy: toUid }));
  // Offer history entries keep the old teamId: they are a log, shown by team name.
  sent.forEach(offer => tx.update(paths.offer(offer.id), { senderId: toUid }));
  received.forEach(offer => tx.update(paths.offer(offer.id), { targetTeamId: toUid }));
  bought.forEach(entry => tx.update(paths.transfer(entry.id), { teamId: toUid }));
  sold.forEach(entry => tx.update(paths.transfer(entry.id), { fromTeamId: toUid }));
  CLUB_USER_COLLECTIONS.forEach((name, index) => userRows[index].forEach(row => {
    tx.set(`${userCollection(toUid, name)}/${row.id}`, row.data);
    tx.delete(`${userCollection(fromUid, name)}/${row.id}`);
  }));

  if (oldClub || manager) {
    const page = oldClub?.data || newClub?.data || {};
    tx.set(clubPage(toUid), {
      ...page,
      body: page.body ?? '',
      profile: { ...(page.profile || {}), ...(manager ? { manager } : {}) },
      updatedAt: now,
      updatedBy: user.uid,
    });
    if (oldClub) tx.delete(clubPage(fromUid));
  }
  const overlayPatch = {};
  if (overlay?.data.homeTeamId === fromUid) overlayPatch.homeTeamId = toUid;
  if (overlay?.data.awayTeamId === fromUid) overlayPatch.awayTeamId = toUid;
  if (Object.keys(overlayPatch).length) tx.update(overlayPath, overlayPatch);
  formations.forEach(row => tx.update(`${base}/public/data/shared_formations/${row.id}`, { createdBy: toUid }));
  const renameKey = (map = {}) => Object.fromEntries(Object.entries(map).map(([key, value]) => [key === fromUid ? toUid : key, value]));
  const pesMoved = workspaces.filter(ws => ws.data.draftMap?.[fromUid] !== undefined || ws.data.draftCoaches?.[fromUid] !== undefined);
  pesMoved.forEach(ws => {
    const patch = {};
    if (ws.data.draftMap) patch.draftMap = renameKey(ws.data.draftMap);
    if (ws.data.draftCoaches) patch.draftCoaches = renameKey(ws.data.draftCoaches);
    tx.update(`${base}/pes_workspaces/${ws.id}`, patch);
  });

  if (tx.writes && tx.writes.length > MAX_TRANSFER_WRITES) {
    throw new MarketError('El club tiene demasiados registros para moverlos de una vez. Avisale al desarrollador.', 413);
  }
  return {
    from: fromUid,
    to: toUid,
    teamName: oldTeam.data.teamName || '',
    players: locks.length,
    offers: sent.length + received.length,
    transfers: bought.length + sold.length,
    clubPage: Boolean(oldClub || manager),
    overlay: Object.keys(overlayPatch).length > 0,
    formations: formations.length,
    pesWorkspaces: pesMoved.length,
  };
}

/** Entry point shared by the Edge Function and the tests. */
export async function handleMarketAction({ firestore, appId, catalog, user, body, now = new Date(), verifyIdToken }) {
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
  if (action === 'migrateAccount') {
    if (typeof body.newIdToken !== 'string' || !body.newIdToken || typeof verifyIdToken !== 'function') {
      throw new MarketError('Falta la sesión de la cuenta de Google.');
    }
    let newUser;
    try {
      newUser = await verifyIdToken(body.newIdToken);
    } catch {
      throw new MarketError('La sesión de la cuenta de Google no es válida. Volvé a intentarlo.', 401);
    }
    return firestore.runTransaction(tx => migrateAccount({ tx, appId, user, newUser, now }));
  }
  if (action === 'transferClub') {
    // Checked before opening a transaction, and again inside transferClub.
    if (!user?.isAdmin) throw new MarketError('Solo el administrador puede cambiar el manager de un club.', 403);
    const { fromUid, toUid, managerName } = body;
    return firestore.runTransaction(tx => transferClub({ tx, appId, user, fromUid, toUid, managerName, now }));
  }
  throw new MarketError('Acción desconocida.');
}
