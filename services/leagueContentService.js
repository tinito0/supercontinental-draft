import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { APP_ID } from '../utils/constants.js';
import {
  LEAGUE_CONTENT_COLLECTION,
  LEAGUE_HISTORY_DOC,
  SEASON_RULES_DOC,
  clubStoryDocId,
  normalizeClub,
  normalizeSeasonRules,
  normalizeStory,
} from '../utils/leagueContent.js';

/* Writes of the league site's texts (admin only, firestore.rules). Each document is owned by one editor and
   replaced whole on save, so a removed chapter or an emptied text really disappears. */

export function leagueContentRef(docId) {
  return doc(db, `artifacts/${APP_ID}/public/data/${LEAGUE_CONTENT_COLLECTION}`, docId);
}

async function save(docId, value, userId) {
  await setDoc(leagueContentRef(docId), { ...value, updatedAt: serverTimestamp(), updatedBy: userId || null });
}

/** @returns {Promise<{ ok: true } | { ok: false, error: string }>} */
async function saveNormalized(docId, normalized, userId) {
  if (!normalized.ok) return normalized;
  await save(docId, normalized.value, userId);
  return { ok: true };
}

export const saveLeagueHistory = (body, userId) => saveNormalized(LEAGUE_HISTORY_DOC, normalizeStory(body), userId);
/** History and card of a club, saved together: the document is replaced whole, so neither can wipe the other. */
export const saveClub = (teamId, club, userId) => saveNormalized(clubStoryDocId(teamId), normalizeClub(club), userId);
export const saveSeasonRules = (rules, userId) => saveNormalized(SEASON_RULES_DOC, normalizeSeasonRules(rules), userId);
