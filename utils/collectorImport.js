// Importar al torneo un partido terminado que registró el colector (live_matches, docs/MATCH_FEED.md): decide a qué
// partido del fixture o cruce de copa va y qué campos se escriben. No escribe nada: el admin ve la vista previa y
// confirma (components/admin/CollectorImportAdmin.jsx). Nunca pisa un resultado cargado. Puro; tests/collectorImport.test.js.
//
// Destino (docs/TOURNAMENT_DATA_FLOW_AUDIT.md, plan punto 4):
// - Konami Cup (tournament_id 48) → cruce sin jugar entre esos dos equipos, en Oro o en la final de Plata.
// - Amistoso → partido sin jugar del fixture de liga con esos dos equipos; si no hay, cruce sin jugar de la Copa de
//   Plata (la Plata se juega como amistoso salvo la final).
import { toTournamentFields } from '../pes-collector/collector/matchSummary.js';
import { buildCupRounds, CUP_IDS } from './bracketModel.js';
import { placeCupResult } from './competitionRules.js';
import { playerName } from './matchCenter.js';

const sameName = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

/** Ids de equipo del juego de un partido (live_matches → parseMatchDoc). */
export function gameTeamIds(match) {
  return { home: match?.summary?.match?.homeTeamId ?? null, away: match?.summary?.match?.awayTeamId ?? null };
}

/** Nombres del torneo de los dos equipos según la tabla del admin (public/data/config/pesTeamMap). */
export function resolveTeams(match, teamMap) {
  const ids = gameTeamIds(match);
  return { home: teamMap?.[ids.home] || null, away: teamMap?.[ids.away] || null };
}

/** Dónde quedó importado ya este partido (importedFrom), o null. */
export function findImported(tournamentData, matchKey) {
  const league = (tournamentData?.matches || []).find(match => match?.importedFrom === matchKey);
  if (league) return `${league.round || 'Liga'}: ${league.homeTeam} vs ${league.awayTeam}`;
  for (const cupId of [CUP_IDS.ORO, CUP_IDS.PLATA]) {
    for (const round of buildCupRounds(cupId, tournamentData?.bracket)) {
      const slot = round.matches.find(entry => entry.match?.importedFrom === matchKey);
      if (slot) return slot.title;
    }
  }
  return null;
}

function leagueTarget(tournamentData, home, away) {
  return (tournamentData?.matches || []).filter(match => match.status !== 'completed'
    && ((sameName(match.homeTeam, home) && sameName(match.awayTeam, away)) || (sameName(match.homeTeam, away) && sameName(match.awayTeam, home))));
}

function swapSides(fields) {
  return {
    ...fields,
    homeTeam: fields.awayTeam, awayTeam: fields.homeTeam,
    homeScore: fields.awayScore, awayScore: fields.homeScore,
    homeGoals: fields.awayGoals, awayGoals: fields.homeGoals,
    homeAssists: fields.awayAssists, awayAssists: fields.homeAssists,
    ...('homePenalties' in fields ? { homePenalties: fields.awayPenalties, awayPenalties: fields.homePenalties } : {}),
  };
}

function cupRounds(tournamentData, { plataFinalOnly, plataBeforeFinal }) {
  const plata = buildCupRounds(CUP_IDS.PLATA, tournamentData?.bracket)
    .filter(round => (plataFinalOnly ? round.isFinal : plataBeforeFinal ? !round.isFinal : true));
  const oro = plataBeforeFinal ? [] : buildCupRounds(CUP_IDS.ORO, tournamentData?.bracket);
  return [...oro.map(round => ({ ...round, cupId: CUP_IDS.ORO })), ...plata.map(round => ({ ...round, cupId: CUP_IDS.PLATA }))];
}

/**
 * @param {{ match: ReturnType<import('./matchCenter.js').parseMatchDoc>, tournamentData: object, teamMap: Record<string, string> }} input
 * @returns {{ ok: false, reason: string, missingTeams?: ('home'|'away')[] }
 *   | { ok: true, kind: 'league', matchId: string, label: string, update: object }
 *   | { ok: true, kind: 'cup', cupId: string, path: string[], index: number, isFinal: boolean, label: string, update: object }}
 */
export function planCollectorImport({ match, tournamentData, teamMap }) {
  if (!match?.summary) return { ok: false, reason: 'El partido no tiene resumen del colector.' };
  if (match.status?.kind !== 'finished') return { ok: false, reason: 'Solo se importan partidos terminados.' };
  const imported = findImported(tournamentData, match.key);
  if (imported) return { ok: false, reason: `Ya está importado en ${imported}.` };
  const teams = resolveTeams(match, teamMap);
  const missingTeams = ['home', 'away'].filter(side => !teams[side]);
  if (missingTeams.length) return { ok: false, reason: 'Elegí a qué equipo del torneo corresponde cada equipo del juego.', missingTeams };

  const summary = match.summary;
  const shootout = summary.shootout || null;
  const isCupMatch = summary.match?.tournamentId === 48;

  if (!isCupMatch) {
    const candidates = leagueTarget(tournamentData, teams.home, teams.away);
    if (candidates.length > 1) return { ok: false, reason: `Hay ${candidates.length} partidos sin jugar entre ${teams.home} y ${teams.away} en el fixture: cargalo a mano.` };
    if (candidates.length === 1) {
      const [target] = candidates;
      const fields = toTournamentFields(summary, { playerName: id => playerName(summary, id), homeTeam: teams.home, awayTeam: teams.away });
      const withShootout = shootout ? { ...fields, homePenalties: shootout.home, awayPenalties: shootout.away } : fields;
      const oriented = sameName(target.homeTeam, teams.home) ? withShootout : swapSides(withShootout);
      return {
        ok: true, kind: 'league', matchId: target.id,
        label: `${target.round || 'Liga'}: ${target.homeTeam} vs ${target.awayTeam}`,
        update: { ...oriented, homeTeam: target.homeTeam, awayTeam: target.awayTeam, importedFrom: match.key },
      };
    }
  }

  // Copa: Konami Cup → Oro o final de Plata; amistoso sin partido de liga → Plata antes de la final.
  const rounds = cupRounds(tournamentData, isCupMatch ? { plataFinalOnly: true } : { plataBeforeFinal: true });
  const placed = placeCupResult(rounds, { homeName: teams.home, awayName: teams.away, score: summary.score, shootout });
  if (!placed.ok) {
    return { ok: false, reason: isCupMatch ? placed.reason : `Ningún partido de liga ni cruce de Plata sin jugar entre ${teams.home} y ${teams.away}.` };
  }
  const round = rounds.find(item => item.id === placed.roundId && item.matches.some(entry => entry.path === placed.path || entry.path.join('/') === placed.path.join('/')));
  const slot = round?.matches[placed.index];
  return {
    ok: true, kind: 'cup', cupId: round?.cupId, path: placed.path, index: placed.index, isFinal: placed.isFinal,
    label: slot?.title || placed.roundId,
    update: { ...placed.update, importedFrom: match.key },
  };
}

/**
 * El torneo con el resultado importado (copia; no muta). La tabla se recalcula después con el motor
 * (tournamentEngine.buildAutomaticTournamentReport), igual que al guardar desde el gestor del torneo.
 */
export function applyCollectorImport(tournamentData, plan) {
  if (plan.kind === 'league') {
    return {
      ...tournamentData,
      matches: (tournamentData.matches || []).map(match => (match.id === plan.matchId ? { ...match, ...plan.update } : match)),
    };
  }
  const bracket = { ...(tournamentData.bracket || {}) };
  const [first, second] = plan.path;
  const parent = second ? { ...(bracket[first] || {}) } : bracket;
  const key = second || first;
  if (plan.isFinal) {
    parent[key] = { ...(parent[key] || {}), ...plan.update };
  } else {
    const list = [...(Array.isArray(parent[key]) ? parent[key] : [])];
    list[plan.index] = { ...(list[plan.index] || {}), ...plan.update };
    parent[key] = list;
  }
  if (second) bracket[first] = parent;
  return { ...tournamentData, bracket };
}
