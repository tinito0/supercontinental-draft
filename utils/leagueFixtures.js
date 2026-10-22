// Partidos de la liga en una sola forma para la web pública, el OBS y el admin. Puro; tests/leagueFixtures.test.js.
//
// Fuente de verdad: el torneo (tournament/official) dice qué partidos hay y cuáles tienen resultado oficial; los
// partidos del juego (live_matches, que sube el bridge) dicen solo cuál se está jugando ahora. Un partido está «en
// vivo» únicamente si su partido del juego está en vivo y el bridge subió datos hace poco: la hora programada nunca
// lo pone en vivo, y un resultado se muestra como final solo si está cargado en el torneo.

import { CUP_DEFINITIONS, CUP_IDS, buildCupRounds, hasScore, isMatchCompleted } from './bracketModel.js';
import { knockoutWinner, leagueMatchOutcome, teamKey } from './competitionRules.js';
import { minuteLabel } from './matchCenter.js';

/** Sin datos del bridge durante este tiempo, un partido «en vivo» pasa a «sin señal». */
export const LIVE_STALE_MS = 3 * 60 * 1000;

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const DATE_RE =/^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Fecha del fixture ('YYYY-MM-DD', día local: sin corrimiento por zona horaria) o null. */
export function fixtureDay(match) {
  const parts = DATE_RE.exec(String(match?.date || ''));
  if (!parts) return null;
  const day = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  return Number.isNaN(day.getTime()) ? null : day;
}

/** Hora de inicio cargada ('HH:mm') o ''. */
export function fixtureTime(match) {
  return TIME_RE.test(String(match?.time || '')) ? match.time : '';
}

/** «sáb 14/12 · 21:00», «sáb 14/12» o '' si no hay fecha. La hora sola no alcanza para mostrar algo. */
export function formatFixtureDate(match) {
  const day = fixtureDay(match);
  if (!day) return '';
  // A mano y no con toLocaleDateString: cada motor de ICU separa distinto (19/12 o 19-12).
  const pad = value => String(value).padStart(2, '0');
  const label = `${WEEKDAYS[day.getDay()]} ${pad(day.getDate())}/${pad(day.getMonth() + 1)}`;
  const time = fixtureTime(match);
  return time ? `${label} · ${time}` : label;
}

/**
 * Estado en vivo de un partido del juego (parseMatchDoc de utils/matchCenter.js).
 * @returns {'live'|'nosignal'|'finished'|'abandoned'|null}
 */
export function liveState(liveMatch, now = Date.now()) {
  const kind = liveMatch?.status?.kind;
  if (!kind) return null;
  if (kind !== 'live') return kind;
  const updated = liveMatch.updatedAtMs;
  return Number.isFinite(updated) && now - updated <= LIVE_STALE_MS ? 'live' : 'nosignal';
}

const COMPETITION_LABELS = { liga: 'Liga', [CUP_IDS.ORO]: CUP_DEFINITIONS[CUP_IDS.ORO].name, [CUP_IDS.PLATA]: CUP_DEFINITIONS[CUP_IDS.PLATA].name };
const roundIndex = label => Number(/(\d+)/.exec(String(label || ''))?.[1]) || 0;
const clean = value => String(value ?? '').trim();

function leagueFixture(match, order) {
  const completed = match.status === 'completed';
  const scored = completed && hasScore(match.homeScore) && hasScore(match.awayScore);
  const outcome = scored ? leagueMatchOutcome(match) : null;
  const pens = scored && hasScore(match.homePenalties) && hasScore(match.awayPenalties)
    ? { home: Number(match.homePenalties), away: Number(match.awayPenalties) } : null;
  return {
    id: `league-${match.id}`,
    sourceId: match.id,
    competition: 'liga',
    roundLabel: clean(match.round) || 'Fecha a definir',
    roundOrder: roundIndex(match.round),
    order,
    home: { name: clean(match.homeTeam) },
    away: { name: clean(match.awayTeam) },
    storedStatus: completed ? 'completed' : match.status === 'postponed' ? 'postponed' : 'scheduled',
    score: scored ? { home: Number(match.homeScore), away: Number(match.awayScore) } : null,
    pens,
    winner: outcome?.ok ? outcome.winner : null,
    date: match.date || '',
    time: fixtureTime(match),
    day: fixtureDay(match),
    mvp: clean(match.mvp),
    importedFrom: match.importedFrom || null,
    isFinal: false,
  };
}

function cupFixtures(cupId, bracket) {
  return buildCupRounds(cupId, bracket).flatMap((round, roundPosition) => round.matches
    .filter(entry => clean(entry.match.teamA) && clean(entry.match.teamB))
    .map(entry => {
      const scored = isMatchCompleted(entry.match);
      const pens = scored && hasScore(entry.match.penaltiesA) && hasScore(entry.match.penaltiesB)
        ? { home: Number(entry.match.penaltiesA), away: Number(entry.match.penaltiesB) } : null;
      const side = scored ? knockoutWinner(entry.match) : null;
      return {
        id: entry.key,
        sourceId: entry.key,
        competition: cupId,
        roundLabel: entry.title,
        roundOrder: 100 + roundPosition,
        order: entry.index,
        home: { name: clean(entry.match.teamA) },
        away: { name: clean(entry.match.teamB) },
        storedStatus: scored ? 'completed' : 'scheduled',
        score: scored ? { home: Number(entry.match.scoreA), away: Number(entry.match.scoreB) } : null,
        pens,
        winner: side === 'A' ? 'home' : side === 'B' ? 'away' : null,
        date: '',
        time: '',
        day: null,
        mvp: '',
        importedFrom: entry.match.importedFrom || null,
        isFinal: entry.isFinal,
      };
    }));
}

/**
 * Todos los partidos (liga y copas) con su estado real.
 * @param {{ tournament?: object, liveMatches?: object[], overlay?: object, predictions?: Record<string, object>,
 *           teamsById?: Record<string, { teamName: string }>, now?: number }} input
 *   liveMatches: docs ya pasados por parseMatchDoc; predictions: { [fixtureId]: doc de predictions } (opcional)
 * @returns {object[]} fixtures con `status`: 'live' | 'nosignal' | 'finished' | 'played' | 'abandoned' | 'postponed' | 'scheduled'
 *   ('played' = el juego lo terminó pero el resultado todavía no está cargado en el torneo)
 */
export function buildFixtures({ tournament, liveMatches = [], overlay = null, predictions = {}, teamsById = {}, now = Date.now() } = {}) {
  const fixtures = [
    ...(Array.isArray(tournament?.matches) ? tournament.matches : []).filter(match => match?.id).map(leagueFixture),
    ...cupFixtures(CUP_IDS.ORO, tournament?.bracket),
    ...cupFixtures(CUP_IDS.PLATA, tournament?.bracket),
  ];
  const liveByKey = new Map(liveMatches.filter(Boolean).map(match => [match.key, match]));
  const claimed = new Set();
  const take = key => {
    if (!key || !liveByKey.has(key) || claimed.has(key)) return null;
    claimed.add(key);
    return liveByKey.get(key);
  };

  // 1) importado del colector, 2) al aire en el overlay, 3) predicción vinculada por match-feed.
  const linked = new Map();
  for (const fixture of fixtures) {
    const live = take(fixture.importedFrom)
      || take(overlay?.matchId === fixture.id ? overlay?.liveMatchKey : null)
      || take(predictions?.[fixture.id]?.liveMatchKey);
    if (live) linked.set(fixture.id, live);
  }
  // 4) por los clubes del draft: un partido del juego sin vincular contra el único partido sin resultado de esos dos.
  const nameOf = id => clean(teamsById?.[id]?.teamName);
  for (const live of liveByKey.values()) {
    if (claimed.has(live.key)) continue;
    const pair = [nameOf(live.home?.draftTeamId), nameOf(live.away?.draftTeamId)];
    if (!pair[0] || !pair[1]) continue;
    const wanted = pair.map(teamKey).sort().join('|');
    const candidates = fixtures.filter(fixture => fixture.storedStatus !== 'completed' && !linked.has(fixture.id)
      && [teamKey(fixture.home.name), teamKey(fixture.away.name)].sort().join('|') === wanted);
    if (candidates.length !== 1) continue;
    claimed.add(live.key);
    linked.set(candidates[0].id, live);
  }

  return fixtures.map(fixture => {
    const live = linked.get(fixture.id) || null;
    const state = liveState(live, now);
    let status = fixture.storedStatus === 'completed' ? 'finished' : fixture.storedStatus;
    if (fixture.storedStatus !== 'completed' && state) status = state === 'finished' ? 'played' : state;
    // El local del juego puede ser el visitante del fixture: el marcador se da vuelta si hace falta.
    const liveHomeName = nameOf(live?.home?.draftTeamId) || live?.home?.name;
    const flipped = Boolean(live) && teamKey(liveHomeName) === teamKey(fixture.away.name);
    const liveScore = live && ['live', 'nosignal', 'played', 'abandoned'].includes(status)
      ? (flipped ? { home: live.away.score, away: live.home.score } : { home: live.home.score, away: live.away.score })
      : null;
    return {
      ...fixture,
      competitionLabel: COMPETITION_LABELS[fixture.competition],
      status,
      liveMatchKey: live?.key || null,
      liveScore,
      minute: status === 'live' ? (live?.status?.label || minuteLabel(live?.summary?.clock)) : '',
      isOnAir: Boolean(overlay?.matchId) && overlay.matchId === fixture.id,
    };
  });
}

const dayValue = fixture => fixture.day?.getTime() ?? null;

/**
 * Lo que muestra el centro de partidos: en vivo, últimos resultados, próximos y otros estados (sin señal,
 * suspendido, postergado). Resultados del más reciente al más viejo; próximos al revés, con el partido al aire primero.
 */
export function groupFixtures(fixtures) {
  // Primero el avance de la competencia (fecha 1…4, después las rondas de copa, que no tienen día cargado), después
  // el día y la hora dentro de la misma ronda.
  const byNewest = (a, b) => b.roundOrder - a.roundOrder || (dayValue(b) ?? -Infinity) - (dayValue(a) ?? -Infinity) || b.order - a.order;
  const bySoonest = (a, b) => a.roundOrder - b.roundOrder || (dayValue(a) ?? Infinity) - (dayValue(b) ?? Infinity)
    || (a.time || '99:99').localeCompare(b.time || '99:99') || a.order - b.order;
  return {
    live: fixtures.filter(f => f.status === 'live'),
    results: fixtures.filter(f => f.status === 'finished' || f.status === 'played').sort(byNewest),
    upcoming: fixtures.filter(f => f.status === 'scheduled').sort((a, b) => Number(b.isOnAir) - Number(a.isOnAir) || bySoonest(a, b)),
    other: fixtures.filter(f => ['nosignal', 'abandoned', 'postponed'].includes(f.status)),
  };
}

/**
 * Partidos de la fecha o ronda en curso (escena «Fecha» del OBS y bloque de la portada): la primera ronda con
 * partidos sin jugar (copas antes que la liga si ya empezaron); si todo está jugado, la última.
 * @returns {{ title: string, competitionLabel: string, fixtures: object[] }}
 */
export function currentRound(fixtures) {
  const rounds = new Map();
  for (const fixture of fixtures) {
    const key = `${fixture.competition}|${fixture.roundLabel}`;
    if (!rounds.has(key)) rounds.set(key, { key, competition: fixture.competition, competitionLabel: fixture.competitionLabel, title: fixture.roundLabel, order: fixture.roundOrder, fixtures: [] });
    rounds.get(key).fixtures.push(fixture);
  }
  const list = [...rounds.values()].sort((a, b) => a.order - b.order);
  const open = round => round.fixtures.some(f => !['finished', 'played'].includes(f.status));
  const cupsStarted = list.some(round => round.competition !== 'liga');
  const pick = (cupsStarted ? list.filter(round => round.competition !== 'liga').find(open) : null)
    || list.find(open)
    || list[list.length - 1];
  if (!pick) return { title: '', competitionLabel: '', fixtures: [] };
  return { title: pick.title, competitionLabel: pick.competitionLabel, fixtures: [...pick.fixtures].sort((a, b) => a.order - b.order) };
}

/**
 * Momento de la temporada para la portada, solo con lo guardado.
 * @returns {{ phase: 'preseason'|'league'|'league-done'|'cups'|'done', label: string, detail: string }}
 */
export function leagueStage(tournament, leagueRounds = 4) {
  const matches = Array.isArray(tournament?.matches) ? tournament.matches : [];
  const finalOro = tournament?.bracket?.final;
  if (clean(finalOro?.teamA) && clean(finalOro?.teamB) && isMatchCompleted(finalOro)) {
    const side = knockoutWinner(finalOro);
    const champion = side === 'A' ? finalOro.teamA : side === 'B' ? finalOro.teamB : '';
    return { phase: 'done', label: 'Temporada terminada', detail: champion ? `Campeón de la Copa de Oro: ${champion}` : 'Final de la Copa de Oro jugada' };
  }
  for (const cupId of [CUP_IDS.ORO, CUP_IDS.PLATA]) {
    const current = buildCupRounds(cupId, tournament?.bracket)
      .find(round => round.matches.some(entry => clean(entry.match.teamA) && clean(entry.match.teamB) && !isMatchCompleted(entry.match)));
    if (current) return { phase: 'cups', label: CUP_DEFINITIONS[cupId].name, detail: current.label };
  }
  const leagueMatches = matches.filter(match => /fecha\s*\d+/i.test(String(match?.round || '')));
  if (!leagueMatches.length) return { phase: 'preseason', label: 'Temporada por comenzar', detail: 'Todavía no hay fechas cargadas' };
  const last = Math.max(...leagueMatches.map(match => roundIndex(match.round)));
  const pending = leagueMatches.filter(match => roundIndex(match.round) === last && match.status !== 'completed').length;
  if (last >= leagueRounds && pending === 0) return { phase: 'league-done', label: 'Fase suiza terminada', detail: 'Se vienen las copas' };
  const left = pending ? ` · ${pending} ${pending === 1 ? 'partido por jugar' : 'partidos por jugar'}` : '';
  return { phase: 'league', label: 'Fase suiza', detail: `Fecha ${last} de ${leagueRounds}${left}` };
}
