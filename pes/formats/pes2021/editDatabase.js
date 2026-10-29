// EDIT00000000 (PES 2020/2021 save data) reader/writer.
// Players, teams, rosters (squad slots + shirt numbers) are editable. Every other
// byte of the decrypted data section, plus the description/logo/serial sections,
// is preserved exactly.
import { decryptEdit, encryptEdit } from './editCrypto.js';
import { EDIT_LAYOUT, EDIT_PLAYER_FIELDS, EDIT_TEAM_FIELDS, EDIT_COACH, EDIT_COACH_FIELDS, EDIT_LOCKED_FIELDS, EDIT_TACTICS, EDIT_STRATEGY, EDIT_ADVANCED_CODES, editFlagsFor } from './editLayout.js';
import { readField, writeField } from '../../core/fields.js';
import { PesFormatError, PesValidationError } from '../../core/errors.js';

export const FORMAT_ID = 'pes2021-edit';

const u32 = (d, o) => (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24)) >>> 0;
const u16 = (d, o) => d[o] | (d[o + 1] << 8);
const w32 = (d, o, v) => { d[o] = v & 255; d[o + 1] = (v >>> 8) & 255; d[o + 2] = (v >>> 16) & 255; d[o + 3] = (v >>> 24) & 255; };
const w16 = (d, o, v) => { d[o] = v & 255; d[o + 1] = (v >> 8) & 255; };

const byName = fields => new Map(fields.map(f => [f.name, f]));
const PLAYER_BY_NAME = byName(EDIT_PLAYER_FIELDS);
const TEAM_BY_NAME = byName(EDIT_TEAM_FIELDS);
const COACH_BY_NAME = byName(EDIT_COACH_FIELDS);
const COACH_FLAG = { name: 'e_name', country: 'e_country' };

export class EditDatabase {
  /** @param {Uint8Array} bytes raw EDIT00000000 file */
  constructor(bytes) {
    this.source = bytes; // never mutated
    this.container = decryptEdit(bytes);
    if (this.container.type !== 'EDIT') {
      throw new PesFormatError('NOT_EDIT', `El archivo es de tipo "${this.container.type}", no EDIT.`);
    }
    if (this.container.game !== '2021') {
      throw new PesFormatError('UNSUPPORTED_VERSION', `EDIT de PES ${this.container.game}: solo se admite PES 2021.`, { game: this.container.game });
    }
    this.game = this.container.game;
    this.layout = EDIT_LAYOUT[this.game];
    this.originalData = this.container.data.slice();
    this.data = this.container.data; // working copy (decrypted)
    this.reindex();
  }

  reindex() {
    const d = this.data;
    const L = EDIT_LAYOUT;
    this.nPlayers = u16(d, L.playerCountOffset);
    this.nTeams = u16(d, L.teamCountOffset);
    if (L.playerStart + this.nPlayers * L.playerSize > L.teamStart || L.teamStart + this.nTeams * this.layout.teamSize > d.length) {
      throw new PesFormatError('CORRUPT_EDIT', `Cantidades imposibles en el EDIT (${this.nPlayers} jugadores, ${this.nTeams} equipos).`);
    }
    this.players = new Map();
    for (let i = 0; i < this.nPlayers; i++) {
      const base = L.playerStart + i * L.playerSize;
      this.players.set(u32(d, base), base);
    }
    this.teams = new Map();
    const teamOrder = [];
    for (let i = 0; i < this.nTeams; i++) {
      const base = L.teamStart + i * this.layout.teamSize;
      const id = u32(d, base);
      this.teams.set(id, { base, rosterBase: null, tacticsBase: null });
      teamOrder.push(id);
    }
    for (let i = 0; i < this.nTeams; i++) {
      const rb = this.layout.roster + i * L.rosterSize;
      const t = this.teams.get(u32(d, rb));
      if (t) t.rosterBase = rb;
      const tb = this.layout.tactics + i * L.tacticsSize;
      const tt = this.teams.get(u32(d, tb));
      if (tt) tt.tacticsBase = tb;
    }
    this.teamOrder = teamOrder;
    this.coaches = new Map();
    const nCoaches = u16(d, EDIT_COACH.countOffset);
    if (nCoaches > EDIT_COACH.max) throw new PesFormatError('CORRUPT_EDIT', `Cantidad imposible de entrenadores en el EDIT (${nCoaches}).`);
    for (let i = 0; i < nCoaches; i++) {
      const base = EDIT_COACH.start + i * EDIT_COACH.size;
      this.coaches.set(u32(d, base), base);
    }
  }

  info() {
    return { format: FORMAT_ID, game: this.game, version: this.container.version, players: this.nPlayers, teams: this.nTeams };
  }

  playerBase(id) {
    const b = this.players.get(id);
    if (b === undefined) throw new PesValidationError('NOT_FOUND', `EDIT: el jugador ${id} no está en el EDIT.`, { id });
    return b;
  }

  team(id) {
    const t = this.teams.get(id);
    if (!t) throw new PesValidationError('NOT_FOUND', `EDIT: el equipo ${id} no existe.`, { id });
    return t;
  }

  readPlayer(id) {
    const base = this.playerBase(id);
    return Object.fromEntries(EDIT_PLAYER_FIELDS.map(f => [f.name, readField(this.data, base, f)]));
  }

  readTeam(id) {
    const t = this.team(id);
    return Object.fromEntries(EDIT_TEAM_FIELDS.map(f => [f.name, readField(this.data, t.base, f)]));
  }

  coachBase(id) {
    const b = this.coaches.get(id);
    if (b === undefined) throw new PesValidationError('NOT_FOUND', `EDIT: el entrenador ${id} no está en el EDIT.`, { id });
    return b;
  }

  readCoach(id) {
    const base = this.coachBase(id);
    return Object.fromEntries(EDIT_COACH_FIELDS.map(f => [f.name, readField(this.data, base, f)]));
  }

  /** Coach of a team (EDIT team `manager_id`). */
  coachOfTeam(teamId) {
    return readField(this.data, this.team(teamId).base, TEAM_BY_NAME.get('manager_id'));
  }

  /** Sets a coach's name or country and raises the matching "edited" flag. */
  setCoachField(id, field, value) {
    const f = COACH_BY_NAME.get(field);
    if (!COACH_FLAG[field]) throw new PesValidationError('FIELD_READ_ONLY', `EDIT: el campo "${field}" del entrenador no es editable.`, { field });
    if (field === 'country' && !(Number.isInteger(value) && value > 0 && value < 512)) throw new PesValidationError('OUT_OF_RANGE', `País de entrenador inválido (${value}).`);
    const base = this.coachBase(id);
    const before = readField(this.data, base, f);
    writeField(this.data, base, f, value);
    writeField(this.data, base, COACH_BY_NAME.get(COACH_FLAG[field]), true);
    return { before, after: readField(this.data, base, f), flags: [COACH_FLAG[field]] };
  }

  setPlayerField(id, field, value) {
    return this.#set('player', this.playerBase(id), PLAYER_BY_NAME, field, value);
  }

  setTeamField(id, field, value) {
    return this.#set('team', this.team(id).base, TEAM_BY_NAME, field, value);
  }

  #set(entity, base, fields, field, value) {
    const f = fields.get(field);
    if (!f) throw new PesValidationError('UNKNOWN_FIELD', `EDIT: el campo "${field}" no existe para ${entity}.`, { field });
    if (EDIT_LOCKED_FIELDS.has(field)) throw new PesValidationError('FIELD_READ_ONLY', `EDIT: "${field}" es un identificador o marca interna.`, { field });
    const before = readField(this.data, base, f);
    writeField(this.data, base, f, value);
    const flags = editFlagsFor(entity, field, value);
    for (const flag of flags) writeField(this.data, base, fields.get(flag), 1);
    return { before, after: readField(this.data, base, f), flags };
  }

  /** Squad of a team; `data` defaults to the working copy (pass originalData to read the source). */
  roster(teamId, data = this.data) {
    const t = this.team(teamId);
    if (t.rosterBase == null) return [];
    const out = [];
    for (let slot = 0; slot < EDIT_LAYOUT.rosterSlots; slot++) {
      const pid = u32(data, t.rosterBase + 4 + slot * 4);
      if (!pid) continue;
      out.push({ slot, playerId: pid, number: u16(data, t.rosterBase + 4 + 160 + slot * 2) });
    }
    return out;
  }

  setRosterNumber(teamId, slot, number) {
    const t = this.#rosterTeam(teamId, slot);
    if (!Number.isInteger(number) || number < 1 || number > 99) throw new PesValidationError('OUT_OF_RANGE', 'Dorsal fuera de rango (1–99).', { number });
    const clash = this.roster(teamId).find(r => r.slot !== slot && r.number === number);
    if (clash) throw new PesValidationError('DUPLICATE_NUMBER', `El dorsal ${number} ya lo usa el jugador ${clash.playerId}.`, { number, playerId: clash.playerId });
    const o = t.rosterBase + 4 + 160 + slot * 2;
    const before = u16(this.data, o);
    w16(this.data, o, number);
    return { before, after: number };
  }

  setRosterPlayer(teamId, slot, playerId) {
    const t = this.#rosterTeam(teamId, slot);
    if (!Number.isInteger(playerId) || playerId < 0 || playerId > 0xffffffff) throw new PesValidationError('TYPE', 'Id de jugador inválido.');
    if (playerId && this.roster(teamId).some(r => r.slot !== slot && r.playerId === playerId)) {
      throw new PesValidationError('DUPLICATE_IN_ROSTER', `El jugador ${playerId} ya está en el plantel.`, { playerId });
    }
    const o = t.rosterBase + 4 + slot * 4;
    const before = u32(this.data, o);
    w32(this.data, o, playerId);
    return { before, after: playerId };
  }

  #tacticsTeam(teamId) {
    const t = this.team(teamId);
    if (t.rosterBase == null || t.tacticsBase == null) throw new PesValidationError('NO_TACTICS', `EDIT: el equipo ${teamId} no tiene plantel/táctica en el EDIT.`);
    return t;
  }

  /** Order (40 slots), captain, takers, plan 0 formation (variant 0 and all 3 variants), strategy and instructions. */
  readTactics(teamId) {
    const t = this.#tacticsTeam(teamId);
    const T = EDIT_TACTICS, d = this.data, tb = t.tacticsBase;
    const o = tb + T.planBase;
    const variant = v => {
      const vo = o + v * T.variantSize;
      return { roles: [0, ...d.subarray(vo + 1, vo + 11)], pos: Array.from({ length: 11 }, (_, i) => [d[vo + 11 + i * 2], d[vo + 12 + i * 2]]) };
    };
    return {
      order: Array.from(d.subarray(tb + T.order, tb + T.order + 40)),
      takers: Array.from(d.subarray(tb + T.takers, tb + T.takers + T.takerCount)),
      captain: d[tb + T.captain],
      formation: variant(0),
      variants: Array.from({ length: T.variants }, (_, v) => variant(v)),
      strategy: Object.fromEntries(Object.entries(EDIT_STRATEGY).map(([k, s]) => [k, d[o + s.offset]])),
      advanced: T.advanced.map(off => d[o + off]),
    };
  }

  /**
   * Replaces a team's whole squad and game plan.
   * @param {{ players: {playerId:number, number:number}[], lineup: number[], formation: {roles:number[], pos:number[][]},
   *           variants?: {roles:number[], pos:number[][]}[], advanced?: number[],
   *           strategy: Record<string, number>, captain: number, takers: number[] }} spec
   *   players: roster in slot order (≤ 40); lineup: 11 roster slots (GK first, then formation entries 1..10);
   *   variants: the 3 formation variants (base, with ball, without ball: fluid formation); default `formation` in all 3;
   *   advanced: instruction codes [attack 1, attack 2, defence 1, defence 2] (0 = none); default none;
   *   captain/takers: roster slots or 255 (none).
   */
  setSquad(teamId, spec) {
    const t = this.#tacticsTeam(teamId);
    validateSquadSpec(spec);
    const T = EDIT_TACTICS, d = this.data, tb = t.tacticsBase;
    const before = { roster: this.roster(teamId), tactics: this.readTactics(teamId) };
    for (let slot = 0; slot < EDIT_LAYOUT.rosterSlots; slot++) {
      const p = spec.players[slot];
      w32(d, t.rosterBase + 4 + slot * 4, p ? p.playerId : 0);
      w16(d, t.rosterBase + 4 + 160 + slot * 2, p ? p.number : 0);
    }
    const bench = [];
    for (let s = 0; s < 40; s++) if (!spec.lineup.includes(s)) bench.push(s);
    d.set([...spec.lineup, ...bench], tb + T.order); // bench slots < players.length come first, then unused slots
    d[tb + T.captain] = spec.captain;
    spec.takers.forEach((s, k) => { d[tb + T.takers + k] = s; });
    for (let plan = 0; plan < T.plans; plan++) {
      const pb = tb + T.planBase + plan * T.planSize;
      for (let v = 0; v < T.variants; v++) {
        const o = pb + v * T.variantSize, f = spec.variants?.[v] || spec.formation;
        d[o] = 0;
        for (let i = 1; i <= 10; i++) d[o + i] = f.roles[i];
        for (let i = 0; i < 11; i++) { d[o + 11 + i * 2] = f.pos[i][0]; d[o + 12 + i * 2] = f.pos[i][1]; }
      }
      for (const [k, s] of Object.entries(EDIT_STRATEGY)) if (spec.strategy[k] != null) d[pb + s.offset] = spec.strategy[k];
      // Advanced instructions chosen for the new squad (none when not given); man-marking referred to the
      // previous squad's players, so it goes back to automatic.
      T.advanced.forEach((off, k) => { d[pb + off] = spec.advanced?.[k] || 0; });
      d.fill(0xff, pb + T.marking, pb + T.marking + T.markingCount);
    }
    return { before, after: spec };
  }

  /**
   * Removes a player from a team's EDIT roster like a transfer (adapted from PES Editor Rebuilt
   * rosterRemove/vacate): a starter is replaced by the first substitute; captain and takers pass to
   * another starter; later slots shift down and the order/captain/takers are renumbered.
 * Without substitutes the position is left pointing to an empty slot (reported as emptyPosition).
   */
  removeFromRoster(teamId, playerId) {
    const t = this.#tacticsTeam(teamId);
    const T = EDIT_TACTICS, d = this.data, tb = t.tacticsBase;
    const roster = this.roster(teamId);
    const entry = roster.find(r => r.playerId === playerId);
    if (!entry) throw new PesValidationError('NOT_IN_ROSTER', `EDIT: el jugador ${playerId} no está en el equipo ${teamId}.`);
    const slot = entry.slot, n = roster.length;
    let order = Array.from(d.subarray(tb + T.order, tb + T.order + 40));
    const i = order.indexOf(slot);
    let substitute = null, emptyPosition = false;
    if (i >= 0 && i < 11) {
      let j = order.findIndex((v, k) => k >= 11 && v < n && v !== slot);
      if (j >= 0) {
        substitute = roster.find(r => r.slot === order[j])?.playerId ?? null;
      } else {
        // No substitute left: the position points to an empty roster slot (the team cannot field 11).
        j = order.findIndex((v, k) => k >= 11 && v >= n && v !== 255);
        emptyPosition = true;
      }
      if (j >= 0) [order[i], order[j]] = [order[j], order[i]];
    }
    const starters = order.slice(0, 11).filter(v => v !== slot && v < n);
    const repl = starters.find((v, k) => k > 0) ?? starters[0] ?? 0;
    if (d[tb + T.captain] === slot) d[tb + T.captain] = repl;
    for (let k = 0; k < T.takerCount; k++) if (d[tb + T.takers + k] === slot) d[tb + T.takers + k] = repl;
    // Shift roster slots down.
    const ids = [], nums = [];
    for (let k = 0; k < 40; k++) { ids.push(u32(d, t.rosterBase + 4 + k * 4)); nums.push(u16(d, t.rosterBase + 4 + 160 + k * 2)); }
    ids.splice(slot, 1); ids.push(0); nums.splice(slot, 1); nums.push(0);
    for (let k = 0; k < 40; k++) { w32(d, t.rosterBase + 4 + k * 4, ids[k]); w16(d, t.rosterBase + 4 + 160 + k * 2, nums[k]); }
    order = order.filter(v => v !== slot).map(v => (v > slot && v !== 255 ? v - 1 : v));
    order.push(39);
    d.set(order, tb + T.order);
    const fix = off => { const v = d[tb + off]; if (v !== 255 && v > slot) d[tb + off] = v - 1; };
    fix(T.captain);
    for (let k = 0; k < T.takerCount; k++) fix(T.takers + k);
    return { before: entry, after: null, substitute, emptyPosition };
  }

  #rosterTeam(teamId, slot) {
    const t = this.team(teamId);
    if (t.rosterBase == null) throw new PesValidationError('NO_ROSTER', `EDIT: el equipo ${teamId} no tiene plantel en el EDIT.`);
    if (!Number.isInteger(slot) || slot < 0 || slot >= EDIT_LAYOUT.rosterSlots) throw new PesValidationError('OUT_OF_RANGE', `Lugar de plantel inválido (${slot}).`);
    return t;
  }

  isModified() {
    for (let i = 0; i < this.data.length; i++) if (this.data[i] !== this.originalData[i]) return true;
    return false;
  }

  serialize() {
    return encryptEdit({ ...this.container, data: this.data });
  }
}

const isSlot = (v, n) => Number.isInteger(v) && v >= 0 && v < n;

/** Validates a squad spec before anything is written (see EditDatabase#setSquad). */
export function validateSquadSpec(spec) {
  const fail = (code, msg) => { throw new PesValidationError(code, `Plantel: ${msg}`); };
  const { players, lineup, formation, strategy = {}, captain, takers } = spec;
  if (!Array.isArray(players) || players.length < 11 || players.length > 40) fail('SQUAD_SIZE', `entre 11 y 40 jugadores (tiene ${players?.length ?? 0}).`);
  const ids = new Set(), nums = new Set();
  for (const p of players) {
    if (!Number.isInteger(p.playerId) || p.playerId <= 0) fail('TYPE', `id de jugador inválido (${p.playerId}).`);
    if (ids.has(p.playerId)) fail('DUPLICATE_IN_ROSTER', `el jugador ${p.playerId} está dos veces.`);
    if (!Number.isInteger(p.number) || p.number < 1 || p.number > 99) fail('OUT_OF_RANGE', `dorsal inválido (${p.number}) para ${p.playerId}.`);
    if (nums.has(p.number)) fail('DUPLICATE_NUMBER', `dorsal ${p.number} repetido.`);
    ids.add(p.playerId); nums.add(p.number);
  }
  const n = players.length;
  if (!Array.isArray(lineup) || lineup.length !== 11 || new Set(lineup).size !== 11 || !lineup.every(s => isSlot(s, n))) fail('LINEUP', 'el 11 titular debe tener 11 jugadores distintos del plantel.');
  const checkFormation = f => {
    if (!f || f.roles?.length !== 11 || f.pos?.length !== 11) fail('FORMATION', 'formación incompleta.');
    for (let i = 1; i <= 10; i++) if (!Number.isInteger(f.roles[i]) || f.roles[i] < 1 || f.roles[i] > 12) fail('FORMATION', `puesto inválido (${f.roles[i]}).`);
    for (const [a, b] of f.pos) if (![a, b].every(v => Number.isInteger(v) && v >= 0 && v <= 100)) fail('FORMATION', 'posición fuera de la cancha.');
  };
  checkFormation(formation);
  if (spec.variants != null) {
    if (!Array.isArray(spec.variants) || spec.variants.length !== EDIT_TACTICS.variants) fail('FORMATION', `hacen falta ${EDIT_TACTICS.variants} variantes de formación.`);
    // Each variant has its own roles (a full back pushed up with the ball plays LMF/RMF): 338 of the 348 fluid
    // plans in the game's own EDIT data change roles between variants. The players are the same in the three.
    for (const f of spec.variants) checkFormation(f);
  }
  if (spec.advanced != null) {
    const { attack, defense } = EDIT_ADVANCED_CODES;
    if (!Array.isArray(spec.advanced) || spec.advanced.length !== EDIT_TACTICS.advanced.length) fail('ADVANCED', 'hacen falta 4 instrucciones avanzadas (0 = ninguna).');
    spec.advanced.forEach((c, k) => {
      if (c !== 0 && !(k < 2 ? attack : defense).includes(c)) fail('ADVANCED', `instrucción avanzada ${c} no válida en ${k < 2 ? 'ataque' : 'defensa'}.`);
    });
    for (const pair of [spec.advanced.slice(0, 2), spec.advanced.slice(2)]) if (pair[0] && pair[0] === pair[1]) fail('ADVANCED', `instrucción avanzada ${pair[0]} repetida.`);
  }
  for (const [k, v] of Object.entries(strategy)) {
    const s = EDIT_STRATEGY[k];
    if (!s) fail('STRATEGY', `opción desconocida "${k}".`);
    if (!Number.isInteger(v) || v < s.min || v > s.max) fail('STRATEGY', `${k} fuera de rango (${s.min}–${s.max}).`);
  }
  if (!(captain === 255 || isSlot(captain, n))) fail('CAPTAIN', 'capitán inválido.');
  if (!Array.isArray(takers) || takers.length !== EDIT_TACTICS.takerCount || !takers.every(s => s === 255 || isSlot(s, n))) fail('TAKERS', 'pateadores inválidos.');
}

export function loadEditDatabase(bytes) {
  return new EditDatabase(bytes);
}
