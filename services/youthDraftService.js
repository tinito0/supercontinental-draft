// Admin writes of the youth-draft document (utils/youthDraft.js describes it). firestore.rules let only the admin
// (or the PES Super Admin) write config/*; picks go through the market function (services/marketService.js).
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { APP_ID } from '../utils/constants.js';
import { youthDraftPath } from '../utils/youthDraft.js';

const draftRef = () => doc(db, youthDraftPath(APP_ID));

// mergeFields: each field is replaced whole. With merge: true a removed candidate or team would stay in the map.
const write = (data) => setDoc(draftRef(), { ...data, updatedAt: serverTimestamp() }, { mergeFields: [...Object.keys(data), 'updatedAt'] });

/** Ids marked as prospects in the PES editor (not published yet). */
export const saveCandidates = (ids) => write({ candidates: [...new Set(ids.map(Number))] });

/** Publishes the pool built from the PES working copy. The market function reads `pool` from then on. */
export const publishPool = ({ pool, workspaceId }) => write({ pool, workspaceId: workspaceId || null, publishedAt: new Date().toISOString() });

/** Pick order, loaded by hand. */
export const saveOrder = (order) => write({ order: [...order] });

/** Opens the turn of one club (null closes it). */
export const setTurn = (teamId) => write({ turnTeamId: teamId || null });

/** Deletes the whole draft: pool, order and picks. Picked players keep their locks until the season reset. */
export const deleteYouthDraft = () => deleteDoc(draftRef());
