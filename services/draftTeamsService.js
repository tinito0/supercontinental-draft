// Reads every draft team for both exports (EJOGC CSVs in TemplateAdminSection and the PES draft transfer):
// public team (name, country) + private profile (dorsals, formation, lineup, setPieces, tactics,
// formationStates, advancedInstructions) + squad. Private profiles and carts are readable only by the app
// admin (firestore.rules). Legacy profiles without the newer fields get null (= defaults downstream).
//
// The squad is the team's player_locks (written by the market function), never the cart: the cart is a
// private copy its owner can write, and it lags behind transfers until the owner opens the app. Cart rows
// only supply the player's data; players without one come from the catalog. Cart rows without a lock are
// left out and reported in squadWarnings.
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { APP_ID } from '../utils/constants.js';
import { buildMarketPlayers, fetchRawPlayers } from '../utils/playerCatalog.js';

async function loadCatalogById() {
  const players = buildMarketPlayers(await fetchRawPlayers());
  return new Map(players.map(player => [String(player.Id), player]));
}

/**
 * Squad of one team from its locks. Pure, so the export rules are testable.
 * @param {Array<[string, object]>} ownedLocks [playerId, lock] of the team
 * @param {object[]} cart the team's cart rows
 * @param {Map<string, object>|null} catalogById
 */
export function buildDraftSquad(ownedLocks, cart, catalogById) {
  const cartById = new Map(cart.map(player => [String(player.Id), player]));
  const ownedIds = new Set(ownedLocks.map(([playerId]) => String(playerId)));
  const players = [];
  const squadWarnings = [];
  for (const [playerId, lock] of ownedLocks) {
    const data = cartById.get(String(playerId)) || catalogById?.get(String(playerId));
    if (!data) {
      squadWarnings.push(`Jugador ${playerId}: tiene lock pero no está en el catálogo; queda fuera.`);
      continue;
    }
    players.push({ ...data, isFranchise: Boolean(lock.isFranchise) });
  }
  for (const player of cart) {
    if (!ownedIds.has(String(player.Id))) {
      squadWarnings.push(`${player.Name || `Jugador ${player.Id}`}: está en el carrito pero no es del equipo; queda fuera.`);
    }
  }
  return { players, squadWarnings };
}

export async function loadDraftTeams({ loadCatalog = loadCatalogById } = {}) {
  const [publicSnaps, lockSnaps] = await Promise.all([
    getDocs(collection(db, `artifacts/${APP_ID}/public/data/teams`)),
    getDocs(collection(db, `artifacts/${APP_ID}/public/data/player_locks`)),
  ]);
  const locksByTeam = new Map();
  lockSnaps.docs.forEach(lockDoc => {
    const lock = lockDoc.data();
    if (!lock.lockedBy) return;
    if (!locksByTeam.has(lock.lockedBy)) locksByTeam.set(lock.lockedBy, []);
    locksByTeam.get(lock.lockedBy).push([lockDoc.id, lock]);
  });

  const rawTeams = await Promise.all(publicSnaps.docs.map(async teamDoc => {
    const userId = teamDoc.id;
    const [profileSnap, cartSnap] = await Promise.all([
      getDoc(doc(db, `artifacts/${APP_ID}/users/${userId}/profile`, 'data')),
      getDocs(collection(db, `artifacts/${APP_ID}/users/${userId}/cart`)),
    ]);
    return {
      userId,
      publicData: teamDoc.data(),
      profile: profileSnap.exists() ? profileSnap.data() : {},
      cart: cartSnap.docs.map(d => d.data()),
      ownedLocks: locksByTeam.get(userId) || [],
    };
  }));

  // The catalog (several MB) is downloaded only when some owned player has no cart copy.
  const needsCatalog = rawTeams.some(({ ownedLocks, cart }) => {
    const cartIds = new Set(cart.map(player => String(player.Id)));
    return ownedLocks.some(([playerId]) => !cartIds.has(String(playerId)));
  });
  const catalogById = needsCatalog ? await loadCatalog() : null;

  const teams = rawTeams.map(({ userId, publicData, profile, cart, ownedLocks }) => {
    const { players, squadWarnings } = buildDraftSquad(ownedLocks, cart, catalogById);
    return {
      id: userId,
      name: publicData.teamName || profile.teamName || 'Sin nombre',
      country: publicData.country || profile.country || 204,
      dorsals: profile.dorsals || {},
      formation: profile.formation || '4-3-3',
      lineup: profile.lineup || {},
      setPieces: profile.setPieces || {},
      tactics: profile.tactics || {},
      formationStates: profile.formationStates || null,
      advancedInstructions: profile.advancedInstructions || null,
      players,
      squadWarnings,
      inWhitelist: publicData.inWhitelist !== false,
    };
  });
  return teams.sort((a, b) => a.name.localeCompare(b.name));
}
