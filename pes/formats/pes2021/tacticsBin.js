// Team tactics in the base database: Tactics.bin (two strategy presets per team) and
// TacticsFormation.bin (3 formations × 11 players per preset). See tacticsLayout.js for the evidence.
import { PesValidationError } from '../../core/errors.js';
import { TACTICS_STRATEGY, formationRowKey } from './tacticsLayout.js';

const FORMATIONS = 3, SLOTS = 11;

/** Tactics ids of a team, in file order (preset S1, S2). */
export function tacticsIdsOfTeam(tables, teamId) {
  const t = tables.tactics;
  return t.ids().filter(id => t.get(id, 'teamId') === teamId);
}

/** Strategy and formations of every preset of a team. */
export function readTeamTactics(tables, teamId) {
  return tacticsIdsOfTeam(tables, teamId).map(id => ({
    id,
    strategy: Object.fromEntries(Object.keys(TACTICS_STRATEGY).map(k => [k, tables.tactics.get(id, k)])),
    formations: Array.from({ length: FORMATIONS }, (_, f) => Array.from({ length: SLOTS }, (_, s) => {
      const key = formationRowKey(id, f, s);
      if (!tables.tacticsFormation?.has(key)) return null;
      return { role: tables.tacticsFormation.get(key, 'role'), depth: tables.tacticsFormation.get(key, 'depth'), lateral: tables.tacticsFormation.get(key, 'lateral') };
    })),
  }));
}

/** Throws before anything is written if the spec is not a valid strategy + formation. */
export function validateTeamTactics({ strategy = {}, formation } = {}) {
  const fail = msg => { throw new PesValidationError('TACTICS', `Táctica: ${msg}`); };
  for (const [k, v] of Object.entries(strategy)) {
    const r = TACTICS_STRATEGY[k];
    if (!r) fail(`opción desconocida "${k}".`);
    if (!Number.isInteger(v) || v < r[0] || v > r[1]) fail(`${k} fuera de rango (${r[0]}–${r[1]}).`);
  }
  if (formation) {
    const { roles, pos } = formation;
    if (!Array.isArray(roles) || roles.length !== SLOTS || !Array.isArray(pos) || pos.length !== SLOTS) fail('la formación necesita 11 puestos.');
    if (roles[0] !== 0) fail('el primer puesto debe ser el arquero.');
    roles.forEach((r, i) => { if (!Number.isInteger(r) || r < 0 || r > 12 || (i > 0 && r === 0)) fail(`puesto inválido (${r}).`); });
    pos.forEach(p => { if (!Array.isArray(p) || p.length !== 2 || !p.every(v => Number.isInteger(v) && v >= 0 && v <= 100)) fail('posición fuera de la cancha.'); });
  }
}

/**
 * Writes the same strategy and formation into every preset of a team (like pesExport's Formation.csv,
 * which repeats the app's S1 in every preset and formation).
 * @param {{ strategy?: Record<string, number>, formation?: { roles: number[], pos: number[][] } }} spec
 */
export function writeTeamTactics(tables, teamId, spec) {
  if (!tables.tactics) throw new PesValidationError('NO_TABLE', 'Falta Tactics.bin.');
  if (spec.formation && !tables.tacticsFormation) throw new PesValidationError('NO_TABLE', 'Falta TacticsFormation.bin.');
  validateTeamTactics(spec);
  const ids = tacticsIdsOfTeam(tables, teamId);
  if (!ids.length) throw new PesValidationError('NO_TACTICS', `Tactics.bin no tiene tácticas para el equipo ${teamId}.`, { teamId });
  for (const id of ids) for (let f = 0; f < FORMATIONS; f++) for (let s = 0; s < SLOTS; s++) {
    if (spec.formation && !tables.tacticsFormation.has(formationRowKey(id, f, s))) {
      throw new PesValidationError('NO_TACTICS', `TacticsFormation.bin: falta la fila ${f + 1}/${s + 1} de la táctica ${id}.`, { id });
    }
  }
  const before = readTeamTactics(tables, teamId);
  for (const id of ids) {
    for (const [k, v] of Object.entries(spec.strategy || {})) tables.tactics.set(id, k, v);
    if (!spec.formation) continue;
    for (let f = 0; f < FORMATIONS; f++) for (let s = 0; s < SLOTS; s++) {
      const key = formationRowKey(id, f, s);
      tables.tacticsFormation.set(key, 'role', spec.formation.roles[s]);
      tables.tacticsFormation.set(key, 'depth', spec.formation.pos[s][0]);
      tables.tacticsFormation.set(key, 'lateral', spec.formation.pos[s][1]);
    }
  }
  return { before, after: spec };
}
