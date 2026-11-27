// Lineup saves and the squad-rules report, run by the Edge Function `market`. The browser cannot write
// `lineup` or `matchBench` (firestore.rules): the bench rule of the reglamento is checked here, against the
// squad in player_locks and the bench minimum in config/squadRules.
import { MarketError, marketPaths, getCatalogPlayer } from './market.js';
import { checkBench, benchBlockMessage, normalizeBenchMin, squadRulesConfigPath, evaluateMatchdayCompliance, STARTERS_COUNT } from './squadRules.js';

export const LINEUP_ACTIONS = new Set(['saveLineup', 'squadCompliance']);

const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const PLAYER_ID = /^\d{1,10}$/;
const SLOT = /^\d{1,2}$/;
const MAX_FORMATION_LENGTH = 40;
// Far above a real board (formation states with three variants are ~10 kB); stops oversized documents.
const MAX_PAYLOAD_CHARS = 100_000;

// Board fields saved with the lineup, so one save stays one atomic write. Each replaces the stored field whole.
const BOARD_FIELDS = {
  formation: value => typeof value === 'string' && value.length > 0 && value.length <= MAX_FORMATION_LENGTH,
  dorsals: value => isPlainObject(value),
  setPieces: value => isPlainObject(value),
  tactics: value => isPlainObject(value),
  availability: value => isPlainObject(value),
  formationStates: value => value === null || isPlainObject(value),
  advancedInstructions: value => value === null || isPlainObject(value),
};

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const invalid = message => new MarketError(message, 400, { code: 'lineup-invalid' });

/** Slot → player id as strings. Throws on a malformed map or a player in two slots. */
export function parseLineup(raw) {
  if (!isPlainObject(raw)) throw invalid('Formación inválida.');
  const entries = Object.entries(raw);
  if (entries.length > STARTERS_COUNT) throw invalid('El once tiene más de 11 jugadores.');
  const lineup = {};
  const seen = new Set();
  for (const [slot, playerId] of entries) {
    const id = String(playerId ?? '');
    if (!SLOT.test(slot) || Number(slot) >= STARTERS_COUNT || !PLAYER_ID.test(id)) throw invalid('Formación inválida.');
    if (seen.has(id)) throw invalid('Un jugador figura dos veces en el once.');
    seen.add(id);
    lineup[slot] = id;
  }
  return lineup;
}

/** The optional board fields of the request, validated. Unknown fields are refused, not dropped. */
export function parseBoardFields(body) {
  const { action, teamId, lineup, ...rest } = body || {};
  const fields = {};
  for (const [key, value] of Object.entries(rest)) {
    const isValid = BOARD_FIELDS[key];
    if (!isValid) throw invalid(`Campo no permitido: ${key}.`);
    if (value === undefined) continue;
    if (!isValid(value)) throw invalid(`Campo inválido: ${key}.`);
    fields[key] = value;
  }
  return fields;
}

/**
 * Saves a club's lineup and board after checking the bench rule on the server. Starters the club no longer owns
 * are dropped (they come back in `dropped`); `matchBench` is the owned squad outside the XI. Both the private
 * profile (read by the exports) and the public team (read by the Reglas board) get the same fields.
 */
export async function saveLineup({ tx, appId, catalog, user, teamId, lineup, fields = {} }) {
  if (teamId !== user.uid && !user.isAdmin) {
    throw new MarketError('Solo podés guardar la formación de tu club.', 403, { code: 'forbidden' });
  }
  const paths = marketPaths(appId);
  const [team, config, locks] = await Promise.all([
    tx.get(paths.team(teamId)),
    tx.get(squadRulesConfigPath(appId)),
    tx.query(paths.locks, [['lockedBy', '==', teamId]]),
  ]);
  if (!team) throw new MarketError('El club no existe.', 404, { code: 'team-not-found' });

  const squad = locks.map(lock => getCatalogPlayer(catalog, lock.id)).filter(Boolean);
  const owned = new Set(squad.map(player => String(player.Id)));
  const kept = Object.fromEntries(Object.entries(lineup).filter(([, id]) => owned.has(id)));
  const dropped = Object.values(lineup).filter(id => !owned.has(id));

  const benchMin = normalizeBenchMin(config?.data?.benchMinAvgOvr);
  const check = checkBench(squad, kept, { benchMin, missingCount: locks.length - squad.length });
  if (check.applies && !check.ok) {
    throw new MarketError(benchBlockMessage(check), 409, {
      code: 'bench-below-minimum',
      details: { average: check.average, min: check.min, benchCount: check.benchCount },
    });
  }

  const starters = new Set(Object.values(kept));
  const matchBench = [...owned].filter(id => !starters.has(id)).sort((a, b) => Number(a) - Number(b));
  const saved = { ...fields, lineup: kept, matchBench };
  const mask = Object.keys(saved);
  tx.set(paths.profile(teamId), saved, { mask });
  tx.set(paths.team(teamId), saved, { mask });
  return {
    teamId,
    saved,
    dropped,
    bench: { applies: check.applies, average: check.average, min: check.min, benchCount: check.benchCount },
  };
}

/** Admin report: squad size, bench and locals of every approved club (squadRules.js evaluateMatchdayCompliance). */
export async function squadCompliance({ tx, appId, catalog }) {
  const paths = marketPaths(appId);
  const [teams, locks, config] = await Promise.all([
    tx.query(`artifacts/${appId}/public/data/teams`),
    tx.query(paths.locks),
    tx.get(squadRulesConfigPath(appId)),
  ]);
  const players = new Map();
  locks.forEach(lock => {
    const player = getCatalogPlayer(catalog, lock.id);
    if (player) players.set(lock.id, player);
  });
  const teamsById = Object.fromEntries(teams.map(team => [team.id, team.data]));
  const locksById = Object.fromEntries(locks.map(lock => [lock.id, lock.data]));
  return { benchMin: normalizeBenchMin(config?.data?.benchMinAvgOvr), teams: evaluateMatchdayCompliance(teamsById, locksById, players, config?.data) };
}

/** Entry point for LINEUP_ACTIONS, shared by the Edge Function and the tests. */
export async function handleLineupAction({ firestore, appId, catalog, user, body }) {
  const action = body?.action;
  if (action === 'saveLineup') {
    if (JSON.stringify(body).length > MAX_PAYLOAD_CHARS) throw invalid('La formación es demasiado grande.');
    const teamId = body.teamId === undefined ? user.uid : String(body.teamId);
    if (!UID_PATTERN.test(teamId)) throw invalid('Club inválido.');
    const lineup = parseLineup(body.lineup);
    const fields = parseBoardFields(body);
    return firestore.runTransaction(tx => saveLineup({ tx, appId, catalog, user, teamId, lineup, fields }));
  }
  if (action === 'squadCompliance') {
    if (!user?.isAdmin) throw new MarketError('Solo el administrador puede ver el control de reglas.', 403, { code: 'forbidden' });
    return firestore.runTransaction(tx => squadCompliance({ tx, appId, catalog }));
  }
  throw new MarketError('Acción desconocida.');
}
