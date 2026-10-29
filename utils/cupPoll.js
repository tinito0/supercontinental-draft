// Encuesta «¿quién gana la copa?» desde el admin (components/admin/CupPollAdmin.jsx): opciones sugeridas desde el
// torneo y validación antes de guardar public/data/polls/{pollId}. Los votos los suma la función community-vote
// (supabase/functions/_shared/communityVote.js pollWindow). Puro; tests/cupPoll.test.js.

export const POLL_LIMITS = { TITLE: 80, NAME: 40, MIN_OPTIONS: 2, MAX_OPTIONS: 16 };

const teamsOf = matches => (Array.isArray(matches) ? matches : []).flatMap(match => [match?.teamA, match?.teamB]);
const cleanNames = names => [...new Set(names.filter(name => typeof name === 'string' && name.trim()).map(name => name.trim()))];
const isDrawn = matches => Array.isArray(matches) && matches.length > 0 && matches.every(match => match?.teamA && match?.teamB);

/** Id estable de una opción a partir del nombre del equipo («Gençlerbirliği» → «genclerbirligi»). */
export function pollOptionId(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Quiénes pueden ganar cada copa, sacado de las llaves (decisión del usuario, 2026-10-23: la encuesta tiene a todos
 * los equipos de esa copa y se habilita cuando se conocen los cruces).
 * - Oro: los 8 de cuartos, cuando los 4 cruces están armados.
 * - Plata: los 8 de los preliminares más los que pasaron los cuartos de Oro (los perdedores de semis de Oro caen a
 *   las semis de Plata), cuando los 4 preliminares están armados.
 * @returns {{ ready: true, teams: string[] } | { ready: false, teams: [], reason: string }}
 */
export function cupPollTeams(tournamentData, pollId) {
  const bracket = tournamentData?.bracket;
  if (pollId === 'copa-oro') {
    if (!isDrawn(bracket?.quarters)) return { ready: false, teams: [], reason: 'Se habilita cuando estén armados los cuartos de final de la Copa de Oro.' };
    return { ready: true, teams: cleanNames(teamsOf(bracket.quarters)) };
  }
  if (pollId === 'copa-plata') {
    if (!isDrawn(bracket?.repechaje?.r1)) return { ready: false, teams: [], reason: 'Se habilita cuando estén armados los preliminares de la Copa de Plata (después de los cuartos de Oro).' };
    return { ready: true, teams: cleanNames([...teamsOf(bracket.repechaje.r1), ...teamsOf(bracket.quarters)]) };
  }
  return { ready: false, teams: [], reason: 'Encuesta desconocida.' };
}

/** Si las opciones guardadas son exactamente esos equipos (sin importar el orden). */
export function pollMatchesTeams(poll, teams) {
  const saved = (poll?.options || []).map(option => pollOptionId(option.name)).sort();
  const wanted = teams.map(pollOptionId).sort();
  return saved.length === wanted.length && saved.every((id, index) => id === wanted[index]);
}

/**
 * Valida el formulario del admin y arma los campos a guardar (sin tocar los votos).
 * @returns {{ ok: true, poll: { title: string, open: boolean, options: { id: string, name: string }[] } } | { ok: false, reason: string }}
 */
export function buildPoll({ title, open, names }) {
  const cleanTitle = String(title ?? '').trim().slice(0, POLL_LIMITS.TITLE);
  if (!cleanTitle) return { ok: false, reason: 'Falta la pregunta.' };
  const options = [];
  for (const raw of names || []) {
    const name = String(raw ?? '').trim().slice(0, POLL_LIMITS.NAME);
    const id = pollOptionId(name);
    if (!id) continue;
    if (options.some(option => option.id === id)) return { ok: false, reason: `«${name}» está repetido.` };
    options.push({ id, name });
  }
  if (options.length < POLL_LIMITS.MIN_OPTIONS) return { ok: false, reason: `Elegí al menos ${POLL_LIMITS.MIN_OPTIONS} equipos.` };
  if (options.length > POLL_LIMITS.MAX_OPTIONS) return { ok: false, reason: `Máximo ${POLL_LIMITS.MAX_OPTIONS} equipos.` };
  return { ok: true, poll: { title: cleanTitle, open: Boolean(open), options } };
}
