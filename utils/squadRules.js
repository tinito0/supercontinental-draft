// Squad rules of the season reglamento (T3): bench average, squad minimum and local players.
// The bench is every squad player outside the saved starting XI. Its average is exact (one decimal shown):
// rounding would let a 72.6 bench pass a 73 floor.

/** Default bench floor; the admin overrides it in `squadRulesConfigPath` (read live by hooks/useSquadRulesConfig.js). */
export const DEFAULT_BENCH_MIN_AVG_OVR = 73;
/** Old name of the default, kept for importers that only need the reglamento's starting value. */
export const BENCH_MIN_AVG_OVR = DEFAULT_BENCH_MIN_AVG_OVR;
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
 * `missingCount`: locked players the catalog has no record of (see squadFromLocks). They count toward the squad
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

/** «2 jugadores sin ficha»: locked players the catalog does not know; null when there are none. */
export function missingPlayersNote(count) {
  if (!count || count < 1) return null;
  return `${count} ${count === 1 ? 'jugador sin ficha' : 'jugadores sin ficha'}`;
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

/**
 * A club's squad from player_locks, the ownership record: the players found in the catalog plus how many locks the
 * catalog does not know (`missingCount`). Squad views read this so none of them drops an owned player.
 * @param {Record<string, { lockedBy?: string }>} playerLocks
 * @param {string} userId
 * @param {Map<string, object>} playersById catalog keyed by String(Id)
 * @returns {{ players: object[], missingIds: string[], missingCount: number }}
 */
export function squadFromLocks(playerLocks, userId, playersById) {
  return squadsFromLocks(playerLocks, playersById).get(userId) || { players: [], missingIds: [], missingCount: 0 };
}

/** Message shown when a lineup cannot be saved because of the bench rule. */
export function benchBlockMessage(check, { benchMin = check.min } = {}) {
  return `El banco queda en ${formatAverage(check.average)} de media y el mínimo es ${normalizeBenchMin(benchMin)}. Mandá al banco a un jugador de más media o reemplazá a un suplente.`;
}

const sortRuleRows = rows => [...rows].sort((a, b) => Number(a.result.ok) - Number(b.result.ok) || a.teamName.localeCompare(b.teamName));

/**
 * One row per approved club for the admin board: its squad (from player_locks, the ownership record), its saved
 * lineup and country, and the rules result. Failing clubs first, then by name. `inputs` keeps what the result was
 * computed from, so the same rows can be re-evaluated with another bench minimum (rowsWithBenchMin).
 */
export function buildTeamRuleRows(allTeams, playerLocks, playersById, { benchMin = DEFAULT_BENCH_MIN_AVG_OVR } = {}) {
  const squads = squadsFromLocks(playerLocks, playersById);
  const rows = Object.entries(allTeams || {})
    .filter(([, team]) => team && team.approved !== false)
    .map(([userId, team]) => {
      const owned = squads.get(userId) || { players: [], missingCount: 0 };
      const inputs = { squad: owned.players, lineup: team.lineup, teamCountry: team.country, missingCount: owned.missingCount };
      return { userId, teamName: team.teamName || 'Sin nombre', logoUrl: team.logoUrl, inputs, result: evaluateSquadRules({ ...inputs, benchMin }) };
    });
  return sortRuleRows(rows);
}

/** The same rows evaluated with another bench minimum (for the admin's preview before saving). */
export function rowsWithBenchMin(rows, benchMin) {
  return sortRuleRows(rows.map(row => ({ ...row, result: evaluateSquadRules({ ...row.inputs, benchMin }) })));
}

/**
 * Who changes bench status if the minimum moves from `currentMin` to `draftMin`. Only clubs whose bench is measured
 * count: a club that is not measured yet stays so whatever the number.
 * @returns {{ stopMeeting: string[], startMeeting: string[] }} club names
 */
export function benchMinImpact(rows, currentMin, draftMin) {
  const benchOf = row => row.result.rules.find(rule => rule.id === 'bench');
  const before = new Map(rowsWithBenchMin(rows, currentMin).map(row => [row.userId, benchOf(row)]));
  const stopMeeting = [];
  const startMeeting = [];
  rowsWithBenchMin(rows, draftMin).forEach(row => {
    const now = benchOf(row);
    const was = before.get(row.userId);
    if (!now.applies || !was.applies || now.ok === was.ok) return;
    (now.ok ? startMeeting : stopMeeting).push(row.teamName);
  });
  return { stopMeeting, startMeeting };
}

const clubsPhrase = (names, singular, plural) => {
  const shown = names.slice(0, 3).join(', ');
  const rest = names.length > 3 ? ` y ${names.length - 3} más` : '';
  const one = names.length === 1;
  return `${names.length} ${one ? 'club' : 'clubes'} ${one ? singular : plural} (${shown}${rest})`;
};

/** «Con 80, 2 clubes dejarían de cumplir (A, B).» for the bench minimum preview. */
export function benchMinImpactText(draftMin, { stopMeeting, startMeeting }) {
  if (stopMeeting.length === 0 && startMeeting.length === 0) return `Con ${draftMin}, ningún club cambia de estado.`;
  const parts = [];
  if (stopMeeting.length) parts.push(clubsPhrase(stopMeeting, 'dejaría de cumplir', 'dejarían de cumplir'));
  if (startMeeting.length) parts.push(clubsPhrase(startMeeting, 'pasaría a cumplir', 'pasarían a cumplir'));
  return `Con ${draftMin}, ${parts.join(' y ')}.`;
}

/**
 * How the board's clubs stand: `failing` break a measured rule, `unmeasured` break none but have a rule that is not
 * measured yet, `compliant` have every rule measured and met. Always adds up to `total`.
 */
export function summarizeRuleRows(rows) {
  const breaks = row => row.result.rules.some(rule => rule.applies && !rule.ok);
  const failing = rows.filter(breaks).length;
  const unmeasured = rows.filter(row => !breaks(row) && row.result.rules.some(rule => !rule.applies)).length;
  return { total: rows.length, failing, unmeasured, compliant: rows.length - failing - unmeasured };
}
