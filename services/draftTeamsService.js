// Reads every draft team with the same data TemplateAdminSection used for the EJOGC CSV export:
// public team (name, country) + private profile (dorsals, formation, lineup, setPieces, tactics)
// + cart (players). Private profiles and carts are readable only by the app admin (firestore.rules).
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { APP_ID } from '../utils/constants.js';

export async function loadDraftTeams() {
  const publicSnaps = await getDocs(collection(db, `artifacts/${APP_ID}/public/data/teams`));
  const teams = await Promise.all(publicSnaps.docs.map(async teamDoc => {
    const publicData = teamDoc.data();
    const userId = teamDoc.id;
    const [profileSnap, cartSnap] = await Promise.all([
      getDoc(doc(db, `artifacts/${APP_ID}/users/${userId}/profile`, 'data')),
      getDocs(collection(db, `artifacts/${APP_ID}/users/${userId}/cart`)),
    ]);
    const profile = profileSnap.exists() ? profileSnap.data() : {};
    return {
      id: userId,
      name: publicData.teamName || profile.teamName || 'Sin nombre',
      country: publicData.country || profile.country || 204,
      dorsals: profile.dorsals || {},
      formation: profile.formation || '4-3-3',
      lineup: profile.lineup || {},
      setPieces: profile.setPieces || {},
      tactics: profile.tactics || {},
      players: cartSnap.docs.map(d => d.data()),
      inWhitelist: publicData.inWhitelist !== false,
    };
  }));
  return teams.sort((a, b) => a.name.localeCompare(b.name));
}
