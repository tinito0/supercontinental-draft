// Encuesta «¿quién gana la copa?» desde el admin (components/admin/CupPollAdmin.jsx): opciones sugeridas desde el
// torneo y validación antes de guardar public/data/polls/{pollId}. Los votos los suma la función community-vote
// (supabase/functions/_shared/communityVote.js pollWindow). Puro; tests/cupPoll.test.js.

export const POLL_LIMITS = { TITLE: 80, NAME: 40, MIN_OPTIONS: 2, MAX_OPTIONS: 16 };

const ROUND_FOR_POLL = { 'copa-oro': ['quarters'], 'copa-plata': ['repechaje', 'r1'] };

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
 * Equipos sugeridos: los de la primera ronda de esa copa (cuartos de Oro, preliminares de Plata); si todavía no está
 * armada, toda la tabla de la liga.
 * @returns {string[]}
 */
export function suggestedPollTeams(tournamentData, pollId) {
  const path = ROUND_FOR_POLL[pollId] || [];
  const round = path.reduce((node, key) => node?.[key], tournamentData?.bracket);
  const fromCup = (Array.isArray(round) ? round : []).flatMap(match => [match?.teamA, match?.teamB]);
  const names = fromCup.filter(name => typeof name === 'string' && name.trim());
  const source = names.length ? names : (tournamentData?.league || []).map(row => row?.name);
  return [...new Set(source.filter(Boolean).map(name => name.trim()))];
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
