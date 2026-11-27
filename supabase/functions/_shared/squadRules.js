// Copy of the pure squad rules in utils/squadRules.js: the Edge Function only ships files under
// supabase/functions. tests/squadRulesShared.test.js fails if the two drift apart.
// The bench is every squad player outside the saved starting XI; its average is exact, never rounded.

export const DEFAULT_BENCH_MIN_AVG_OVR = 73;
export const BENCH_MIN_LIMIT = 40;
export const BENCH_MAX_LIMIT = 99;
export const SQUAD_MIN_PLAYERS = 21;
export const LOCAL_MIN_PLAYERS = 7;
export const STARTERS_COUNT = 11;

/**
 * The one set of names for the three squad rules: `short` heads a table column and joins a list («plantel, banco»),
 * `long` is the rule's own name, `description` says what it asks. The admin board, Mi Equipo, the teams modal and the
 * public rules read it (docs/DESIGN_SYSTEM.md, Glosario).
 */
export const SQUAD_RULE_LABELS = Object.freeze({
  squad: { short: 'Plantel', long: 'Plantel mínimo', description: `Al menos ${SQUAD_MIN_PLAYERS} jugadores fichados.` },
  bench: { short: 'Banco', long: 'Nivel mínimo del banco', description: 'Media de los jugadores fuera del once.' },
  locals: { short: 'Locales', long: 'Jugadores locales', description: `Al menos ${LOCAL_MIN_PLAYERS} del país del club.` },
});

/** Firestore path of the admin-editable squad rules document ({ benchMinAvgOvr }). */
export const squadRulesConfigPath = appId => `artifacts/${appId}/public/data/config/squadRules`;

/** Integer bench floor inside the allowed range; anything unusable falls back to the default. */
export function normalizeBenchMin(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return DEFAULT_BENCH_MIN_AVG_OVR;
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_BENCH_MIN_AVG_OVR;
  return Math.min(BENCH_MAX_LIMIT, Math.max(BENCH_MIN_LIMIT, Math.round(number)));
}

const idOf = player => String(player?.Id ?? player?.id ?? player?.playerId ?? '');

/** Ids of the starters in a lineup map ({ slot: playerId }) that are still in the squad. */
export function starterIds(lineup, squad) {
  const inSquad = new Set((squad || []).map(idOf).filter(Boolean));
  return new Set(Object.values(lineup || {}).map(String).filter(id => inSquad.has(id)));
}

/** The squad players outside the starting XI. */
export function benchPlayers(squad, lineup) {
  const starters = starterIds(lineup, squad);
  return (squad || []).filter(player => idOf(player) && !starters.has(idOf(player)));
}

/** Exact average OVR, or null for an empty list. */
export function averageOvr(players) {
  if (!players?.length) return null;
  return players.reduce((sum, player) => sum + (Number(player.OVR_CALCULADO) || 0), 0) / players.length;
}

/** «72,6»: the bench average as the reglamento reads it. */
export function formatAverage(value) {
  return value == null ? '–' : value.toFixed(1).replace('.', ',');
}

/** Born in or holding the nationality of the club's country (first or second nationality). */
export function isLocalPlayer(player, teamCountry) {
  if (teamCountry == null || teamCountry === '') return false;
  const country = String(teamCountry);
  return String(player?.Country1 ?? '') === country || String(player?.Country2 ?? '') === country;
}

/**
 * The bench rule for one lineup. It is measured only with a full XI and a squad at the reglamento minimum:
 * before that the bench is still being built and blocking a save would stop the draft itself.
 * `missingCount`: locked players without a catalog record; they count toward the squad size but have no OVR to average.
 * @returns {{ applies: boolean, ok: boolean, average: number|null, benchCount: number, reason: string|null, min: number }}
 */
export function checkBench(squad, lineup, { benchMin = DEFAULT_BENCH_MIN_AVG_OVR, missingCount = 0 } = {}) {
  const min = normalizeBenchMin(benchMin);
  const size = (squad?.length || 0) + missingCount;
  const startersCount = starterIds(lineup, squad).size;
  const bench = benchPlayers(squad, lineup);
  const average = averageOvr(bench);
  if (size < SQUAD_MIN_PLAYERS) {
    return { applies: false, ok: true, average, benchCount: bench.length, reason: `Se mide desde los ${SQUAD_MIN_PLAYERS} jugadores`, min };
  }
  if (startersCount < STARTERS_COUNT) {
    return { applies: false, ok: true, average, benchCount: bench.length, reason: 'Se mide con el once completo', min };
  }
  const ok = average != null && average >= min;
  return { applies: true, ok, average, benchCount: bench.length, reason: null, min };
}

/**
 * The three squad rules for a team, in reglamento order.
 * `missingCount`: locked players the catalog has no record of (squadsFromLocks). They count toward the squad
 * size, but their OVR and country are unknown, so the bench and local figures only cover the players that do load.
 * @param {{ squad: object[], lineup: object, teamCountry: number|string, benchMin?: number, missingCount?: number }} team
 * @returns {{ ok: boolean, missingCount: number, rules: Array<{ id: string, label: string, ok: boolean, applies: boolean, value: string, target: string, detail: string }> }}
 */
export function evaluateSquadRules({ squad, lineup, teamCountry, benchMin = DEFAULT_BENCH_MIN_AVG_OVR, missingCount = 0 }) {
  const players = squad || [];
  const ownedCount = players.length + missingCount;
  const bench = checkBench(players, lineup, { benchMin, missingCount });
  const locals = players.filter(player => isLocalPlayer(player, teamCountry)).length;
  const hasCountry = teamCountry != null && teamCountry !== '';

  const rules = [
    {
      id: 'squad',
      label: SQUAD_RULE_LABELS.squad.long,
      ok: ownedCount >= SQUAD_MIN_PLAYERS,
      applies: true,
      value: String(ownedCount),
      target: String(SQUAD_MIN_PLAYERS),
      detail: ownedCount >= SQUAD_MIN_PLAYERS
        ? 'Cumple'
        : `Faltan ${SQUAD_MIN_PLAYERS - ownedCount}`,
    },
    {
      id: 'bench',
      label: SQUAD_RULE_LABELS.bench.long,
      ok: bench.ok,
      applies: bench.applies,
      value: formatAverage(bench.average),
      target: String(bench.min),
      detail: !bench.applies ? bench.reason : bench.ok ? 'Cumple' : 'Por debajo del mínimo',
    },
    {
      id: 'locals',
      label: SQUAD_RULE_LABELS.locals.long,
      ok: hasCountry && locals >= LOCAL_MIN_PLAYERS,
      applies: hasCountry,
      value: String(locals),
      target: String(LOCAL_MIN_PLAYERS),
      detail: !hasCountry
        ? 'Club sin país cargado'
        : locals >= LOCAL_MIN_PLAYERS ? 'Cumple' : `Faltan ${LOCAL_MIN_PLAYERS - locals}`,
    },
  ];
  return { ok: rules.every(rule => rule.ok), missingCount, rules };
}

/** Every club's squad from player_locks in one pass: Map<userId, { players, missingIds, missingCount }>. */
export function squadsFromLocks(playerLocks, playersById) {
  const squads = new Map();
  Object.entries(playerLocks || {}).forEach(([playerId, lock]) => {
    if (!lock?.lockedBy) return;
    if (!squads.has(lock.lockedBy)) squads.set(lock.lockedBy, { players: [], missingIds: [], missingCount: 0 });
    const squad = squads.get(lock.lockedBy);
    const player = playersById.get(String(playerId));
    if (player) squad.players.push(player);
    else squad.missingIds.push(String(playerId));
  });
  squads.forEach(squad => { squad.missingCount = squad.missingIds.length; });
  return squads;
}

/** Message shown when a lineup cannot be saved because of the bench rule. */
export function benchBlockMessage(check, { benchMin = check.min } = {}) {
  return `El banco queda en ${formatAverage(check.average)} de media y el mínimo es ${normalizeBenchMin(benchMin)}. Mandá al banco a un jugador de más media o reemplazá a un suplente.`;
}

/**
 * Squad size, bench and locals for every approved club, as they stand now. The reglamento checks squad size and
 * locals at the matchday deadline, not on each signing, so this reports them instead of blocking actions.
 * @param {Record<string, object>} teams  teams/{uid} documents by uid
 * @param {Record<string, { lockedBy?: string }>} locks  player_locks by player id (the ownership record)
 * @param {Map<string, object>} players  player data by id; locks of unknown players count only toward the squad size
 * @param {{ benchMinAvgOvr?: unknown }} config  the config/squadRules document
 * @returns {Array<{ teamId: string, teamName: string, ok: boolean, missingCount: number, rules: object[] }>} failing first, then by name
 */
export function evaluateMatchdayCompliance(teams, locks, players, config) {
  const benchMin = normalizeBenchMin(config?.benchMinAvgOvr);
  const squads = squadsFromLocks(locks, players);
  return Object.entries(teams || {})
    .filter(([, team]) => team && team.approved !== false)
    .map(([teamId, team]) => {
      const owned = squads.get(teamId) || { players: [], missingCount: 0 };
      const result = evaluateSquadRules({ squad: owned.players, lineup: team.lineup, teamCountry: team.country, benchMin, missingCount: owned.missingCount });
      return { teamId, teamName: team.teamName || 'Sin nombre', ok: result.ok, missingCount: result.missingCount, rules: result.rules };
    })
    .sort((a, b) => Number(a.ok) - Number(b.ok) || a.teamName.localeCompare(b.teamName));
}
