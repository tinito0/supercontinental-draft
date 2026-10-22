import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { APP_ID } from '../utils/constants.js';
import { mergeTournamentEdit } from '../utils/tournamentModel.js';
import { finalizeTournament, getMatchesWithNewResults, getRevertedResults } from '../components/tournament/tournamentEngine.js';

/* Único lugar que escribe el torneo (artifacts/{APP_ID}/public/data/tournament/official): el gestor del torneo, la
   importación de partidos del colector y el cambio de nombre de un club pasan por acá.

   En una transacción: lee la última versión, aplica solo lo que este editor cambió (utils/tournamentModel.js),
   recalcula todo (tournamentEngine.finalizeTournament: tabla, desempates, fecha suiza automática, avance de copas)
   y escribe el torneo junto con las noticias de los resultados. Si otro guardado entra en el medio, Firestore
   reintenta con la versión nueva, así que nada se pisa y la fecha suiza se genera una sola vez.

   Las reglas no pueden exigir esto (el catch-all de firestore.rules le da al admin escritura total), así que todo
   guardado del torneo tiene que pasar por esta función. */

export const tournamentRef = () => doc(db, `artifacts/${APP_ID}/public/data/tournament/official`);
const newsRef = matchId => doc(db, `artifacts/${APP_ID}/public/data/news`, `match-${matchId}`);

const scoreOrNull = value => (value === '' || value == null || !Number.isFinite(Number(value)) ? null : Number(value));

function newsFor(match) {
  return {
    type: 'match_result',
    matchId: match.id,
    round: match.round || 'Partido de torneo',
    homeTeam: match.homeTeam || 'Local',
    awayTeam: match.awayTeam || 'Visitante',
    homeScore: scoreOrNull(match.homeScore),
    awayScore: scoreOrNull(match.awayScore),
    homePenalties: scoreOrNull(match.homePenalties),
    awayPenalties: scoreOrNull(match.awayPenalties),
    mvp: match.mvp || '',
    publishedAt: serverTimestamp(),
  };
}

// Firestore rechaza undefined: se sacan antes de escribir.
const clean = value => JSON.parse(JSON.stringify(value));

/**
 * Guarda una edición del torneo.
 * @param {{ base: object|null, edited: object }} edit `base`: el torneo como estaba al empezar a editar
 *   (null = la versión guardada actual, p. ej. una importación hecha recién sobre los datos en pantalla)
 * @returns {Promise<{ ok: true, data: object, issues: string[], unresolvedTies: string[][], warnings: string[],
 *   generatedRound: string|null, cupChanges: string[] } | { ok: false, error: string, conflicts?: string[] }>}
 */
export async function saveTournamentEdit({ base, edited }) {
  return runTransaction(db, async transaction => {
    const snapshot = await transaction.get(tournamentRef());
    const latest = snapshot.exists() ? snapshot.data() : {};
    const { data: merged, conflicts } = mergeTournamentEdit(base ?? latest, edited, latest);
    if (conflicts.length) {
      return { ok: false, conflicts, error: 'Otro admin guardó cambios en lo mismo mientras editabas. No se guardó nada: recargá el torneo y volvé a aplicar tus cambios.' };
    }
    const result = finalizeTournament(merged);
    if (!result.ok) return result;
    const { updatedAt: _ignored, ...rest } = clean(result.data);
    const data = { ...rest, updatedAt: serverTimestamp() };
    transaction.set(tournamentRef(), data, { mergeFields: Object.keys(data) });
    for (const match of getMatchesWithNewResults(latest.matches, result.data.matches)) {
      transaction.set(newsRef(match.id), newsFor(match), { merge: true });
    }
    for (const matchId of getRevertedResults(latest.matches, result.data.matches)) {
      transaction.delete(newsRef(matchId));
    }
    return result;
  });
}
