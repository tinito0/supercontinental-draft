// Partidos que se pueden poner al aire en el overlay de OBS (broadcast/overlay) y cómo se traducen a
// los campos del overlay. Seleccionar un partido escribe SOLO en el documento del overlay: nunca toca el
// resultado guardado en el torneo.
import { CUP_DEFINITIONS, CUP_IDS, hasScore, isMatchCompleted, listCupMatches } from './bracketModel.js';

export const BROADCAST_SOURCES = {
  LEAGUE: 'league',
  ORO: CUP_IDS.ORO,
  PLATA: CUP_IDS.PLATA,
};

export const BROADCAST_SOURCE_LABELS = {
  [BROADCAST_SOURCES.LEAGUE]: 'Liga',
  [BROADCAST_SOURCES.ORO]: CUP_DEFINITIONS[CUP_IDS.ORO].name,
  [BROADCAST_SOURCES.PLATA]: CUP_DEFINITIONS[CUP_IDS.PLATA].name,
};

// Campos del overlay que describen el partido al aire (BroadcastOverlay los lee).
export const EMPTY_OVERLAY_MATCH = Object.freeze({
  matchId: '',
  homeTeamId: '',
  awayTeamId: '',
  homeTeamName: '',
  awayTeamName: '',
  homeScore: '0',
  awayScore: '0',
  roundLabel: '',
  clock: '00:00',
  matchStatus: 'EN VIVO',
});

const clean = value => String(value ?? '').trim();

/** Lista normalizada: partidos de liga + cruces de las dos copas que tengan al menos un equipo. */
export function listBroadcastMatches(tournamentData) {
  const league = (Array.isArray(tournamentData?.matches) ? tournamentData.matches : [])
    .filter(match => match && match.id)
    .map((match, order) => {
      const completed = match.status === 'completed' && hasScore(match.homeScore) && hasScore(match.awayScore);
      return {
        id: `league-${match.id}`,
        source: BROADCAST_SOURCES.LEAGUE,
        competition: BROADCAST_SOURCE_LABELS.league,
        round: clean(match.round) || 'Fecha a definir',
        homeTeam: clean(match.homeTeam),
        awayTeam: clean(match.awayTeam),
        homeScore: completed ? String(Number(match.homeScore)) : '',
        awayScore: completed ? String(Number(match.awayScore)) : '',
        date: clean(match.date),
        isCompleted: completed,
        order,
      };
    });

  const cups = [CUP_IDS.ORO, CUP_IDS.PLATA].flatMap(cupId => listCupMatches(cupId, tournamentData?.bracket)
    .filter(entry => clean(entry.match.teamA) || clean(entry.match.teamB))
    .map((entry, order) => {
      const completed = isMatchCompleted(entry.match);
      return {
        id: entry.key,
        source: cupId,
        competition: BROADCAST_SOURCE_LABELS[cupId],
        round: entry.title,
        homeTeam: clean(entry.match.teamA),
        awayTeam: clean(entry.match.teamB),
        homeScore: completed ? String(Number(entry.match.scoreA)) : '',
        awayScore: completed ? String(Number(entry.match.scoreB)) : '',
        date: '',
        isCompleted: completed,
        order: 1000 + order,
      };
    }));

  return [...league, ...cups];
}

/** Pendientes primero (por fecha, luego por orden de carga); después los finalizados. */
export function sortBroadcastMatches(matches) {
  return [...matches].sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
    if (a.date && b.date && a.date !== b.date) return a.date.localeCompare(b.date);
    if (Boolean(a.date) !== Boolean(b.date)) return a.date ? -1 : 1;
    return a.order - b.order;
  });
}

export function filterBroadcastMatches(matches, { query = '', status = 'all', source = 'all' } = {}) {
  const term = clean(query).toLowerCase();
  return matches.filter(match => {
    if (status === 'pending' && match.isCompleted) return false;
    if (status === 'completed' && !match.isCompleted) return false;
    if (source !== 'all' && match.source !== source) return false;
    if (!term) return true;
    return [match.homeTeam, match.awayTeam, match.round, match.competition]
      .some(value => value.toLowerCase().includes(term));
  });
}

/** Id del club en allTeams cuyo nombre coincide (sin distinguir mayúsculas ni espacios de borde). */
export function resolveTeamId(teamName, allTeams) {
  const target = clean(teamName).toLowerCase();
  if (!target || !allTeams) return '';
  const found = Object.entries(allTeams).find(([, team]) => clean(team?.teamName).toLowerCase() === target);
  return found ? found[0] : '';
}

export function formatRoundLabel(match) {
  return match.source === BROADCAST_SOURCES.LEAGUE ? match.round : `${match.competition} · ${match.round}`;
}

/** Campos del overlay para poner `match` al aire. Un partido finalizado entra con su resultado y "FINAL". */
export function buildOverlayPatchForMatch(match, allTeams) {
  return {
    matchId: match.id,
    homeTeamId: resolveTeamId(match.homeTeam, allTeams),
    awayTeamId: resolveTeamId(match.awayTeam, allTeams),
    homeTeamName: match.homeTeam,
    awayTeamName: match.awayTeam,
    homeScore: match.isCompleted ? match.homeScore : '0',
    awayScore: match.isCompleted ? match.awayScore : '0',
    roundLabel: formatRoundLabel(match),
    clock: match.isCompleted ? '' : '00:00',
    matchStatus: match.isCompleted ? 'FINAL' : 'EN VIVO',
  };
}

/**
 * Qué cambió en el torneo desde que el partido se puso al aire (equipos o resultado final),
 * para avisar en el panel en lugar de pisar el marcador en vivo sin que nadie lo pida.
 */
export function getOverlayMatchDrift(match, overlay) {
  if (!match || !overlay) return null;
  const teamsChanged = clean(overlay.homeTeamName) !== match.homeTeam || clean(overlay.awayTeamName) !== match.awayTeam;
  const resultChanged = match.isCompleted
    && (clean(overlay.homeScore) !== match.homeScore || clean(overlay.awayScore) !== match.awayScore);
  if (!teamsChanged && !resultChanged) return null;
  return { teamsChanged, resultChanged };
}

/** Nombres de los clubes que no están registrados (el overlay mostrará el escudo por defecto). */
export function getUnresolvedTeams(match, allTeams) {
  return [match.homeTeam, match.awayTeam].filter(name => name && !resolveTeamId(name, allTeams));
}

/**
 * Fusión de tres vías para el formulario del overlay: cada campo que el usuario no tocó (igual a `base`,
 * la versión remota sobre la que empezó a editar) toma el valor remoto nuevo; lo que sí editó se conserva.
 * Antes cada snapshot reemplazaba el formulario entero y borraba lo que se estaba escribiendo.
 */
export function rebaseOverlayForm(local, base, remote, fields = Object.keys(remote || {})) {
  const next = { ...local };
  fields.forEach(field => {
    const untouched = String(local?.[field] ?? '') === String(base?.[field] ?? '');
    if (untouched) next[field] = remote?.[field];
  });
  return next;
}

/** Campos editables del overlay que difieren de la versión guardada. */
export function getDirtyOverlayFields(form, saved, fields) {
  return fields.filter(field => String(form?.[field] ?? '') !== String(saved?.[field] ?? ''));
}
