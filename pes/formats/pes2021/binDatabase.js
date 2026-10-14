// PES 2021 database (pesdb) reader/writer for the files with a verified layout:
// Team.bin, Player.bin, PlayerAssignment.bin and Coach.bin. Other pesdb files are recognised
// and carried through untouched, but cannot be edited.
//
// Edits are applied to a working copy of the decompressed payload; the source
// bytes are never mutated. Only modified files are re-serialized.
import { decodeWesys, encodeWesys } from '../../core/wesys.js';
import { readField, writeField, fieldByteSpan } from '../../core/fields.js';
import { PesFormatError, PesValidationError } from '../../core/errors.js';
import {
  TEAM_RECORD_SIZE, PLAYER_RECORD_SIZE, ASSIGNMENT_RECORD_SIZE,
  TEAM_FIELDS, PLAYER_FIELDS, ASSIGNMENT_FIELDS,
} from './binLayout.js';
import { COACH_RECORD_SIZE, COACH_FIELDS } from './coachLayout.js';

export const FORMAT_ID = 'pes2021-pesdb';

/** Table definitions for the supported files. */
export const BIN_TABLES = {
  team: { file: 'Team.bin', recordSize: TEAM_RECORD_SIZE, fields: TEAM_FIELDS },
  player: { file: 'Player.bin', recordSize: PLAYER_RECORD_SIZE, fields: PLAYER_FIELDS },
  assignment: { file: 'PlayerAssignment.bin', recordSize: ASSIGNMENT_RECORD_SIZE, fields: ASSIGNMENT_FIELDS },
  coach: { file: 'Coach.bin', recordSize: COACH_RECORD_SIZE, fields: COACH_FIELDS },
};

/** Known pesdb files that are recognised but not editable (layouts not verified). */
export const PASSTHROUGH_FILES = [
  'CoachDeleteList.bin', 'Competition.bin', 'CompetitionEntry.bin', 'CompetitionRegulation.bin',
  'Country.bin', 'Derby.bin', 'PlayerDeleteList.bin', 'Stadium.bin', 'Tactics.bin', 'TacticsFormation.bin', 'PlayerAppearance.bin',
];

const fieldMap = fields => new Map(fields.map(f => [f.name, f]));

/** A fixed-size record table with an id index. */
export class RecordTable {
  constructor(kind, def, container) {
    this.kind = kind;
    this.file = def.file;
    this.recordSize = def.recordSize;
    this.fields = def.fields;
    this.fieldByName = fieldMap(def.fields);
    this.idField = this.fieldByName.get('id');
    this.header = container.header;
    this.compressed = container.compressed;
    this.source = container.payload; // never mutated
    if (this.source.length % this.recordSize !== 0) {
      throw new PesFormatError('RECORD_SIZE_MISMATCH',
        `${this.file}: ${this.source.length} bytes no es múltiplo del registro de ${this.recordSize} bytes. Versión no soportada o archivo dañado.`,
        { file: this.file, size: this.source.length, recordSize: this.recordSize });
    }
    this.data = this.source.slice(); // working copy
    this.reindex();
  }

  get count() { return this.data.length / this.recordSize; }

  reindex() {
    this.index = new Map();
    this.duplicateIds = [];
    for (let i = 0; i < this.count; i++) {
      const id = readField(this.data, i * this.recordSize, this.idField);
      if (this.index.has(id)) this.duplicateIds.push(id); else this.index.set(id, i);
    }
  }

  has(id) { return this.index.has(id); }

  baseOf(id) {
    const i = this.index.get(id);
    if (i === undefined) throw new PesValidationError('NOT_FOUND', `${this.file}: no existe el registro con id ${id}.`, { file: this.file, id });
    return i * this.recordSize;
  }

  field(name) {
    const f = this.fieldByName.get(name);
    if (!f) throw new PesValidationError('UNKNOWN_FIELD', `${this.file}: el campo "${name}" no está soportado.`, { file: this.file, field: name });
    return f;
  }

  get(id, name) { return readField(this.data, this.baseOf(id), this.field(name)); }

  /** Reads every exposed field of one record. */
  read(id) {
    const base = this.baseOf(id);
    const out = {};
    for (const f of this.fields) out[f.name] = readField(this.data, base, f);
    return out;
  }

  /** All records as { id, index } in file order. */
  ids() {
    const out = [];
    for (let i = 0; i < this.count; i++) out.push(readField(this.data, i * this.recordSize, this.idField));
    return out;
  }

  set(id, name, value) {
    const f = this.field(name);
    if (f.confidence === 'unverified' || f.confidence === 'partial') {
      throw new PesValidationError('FIELD_READ_ONLY', `${this.file}: "${name}" es de solo lectura (su significado no está verificado).`, { file: this.file, field: name });
    }
    if (f === this.idField) {
      throw new PesValidationError('ID_IMMUTABLE', `${this.file}: el id no se puede cambiar (otras tablas lo referencian).`, { file: this.file });
    }
    const base = this.baseOf(id);
    const before = readField(this.data, base, f);
    writeField(this.data, base, f, value);
    return { before, after: readField(this.data, base, f) };
  }

  /** Appends a new record copied from a template record, with a new id. */
  appendFrom(templateId, newId) {
    if (this.index.has(newId)) throw new PesValidationError('ID_CONFLICT', `${this.file}: el id ${newId} ya existe.`, { file: this.file, id: newId });
    const src = this.data.subarray(this.baseOf(templateId), this.baseOf(templateId) + this.recordSize);
    const next = new Uint8Array(this.data.length + this.recordSize);
    next.set(this.data, 0);
    next.set(src, this.data.length);
    writeField(next, this.data.length, this.idField, newId);
    this.data = next;
    this.index.set(newId, this.count - 1);
  }

  remove(id) {
    const base = this.baseOf(id);
    const next = new Uint8Array(this.data.length - this.recordSize);
    next.set(this.data.subarray(0, base), 0);
    next.set(this.data.subarray(base + this.recordSize), base);
    this.data = next;
    this.reindex();
  }

  maxId() {
    let m = 0;
    for (const id of this.index.keys()) if (id > m) m = id;
    return m;
  }

  isModified() {
    if (this.data.length !== this.source.length) return true;
    for (let i = 0; i < this.data.length; i++) if (this.data[i] !== this.source[i]) return true;
    return false;
  }

  serialize() {
    return encodeWesys(this.data, { header: this.header, compressed: this.compressed });
  }
}

/** Byte spans written by a field inside a record (for output verification). */
export function spanOf(table, name) { return fieldByteSpan(table.field(name)); }

/**
 * Loads a set of pesdb files.
 * @param {Record<string, Uint8Array>} files map of file name -> raw file bytes
 */
export function loadBinDatabase(files) {
  const byLower = new Map(Object.keys(files).map(n => [baseName(n).toLowerCase(), n]));
  const tables = {};
  const passthrough = {};
  const unsupported = [];
  for (const [kind, def] of Object.entries(BIN_TABLES)) {
    const name = byLower.get(def.file.toLowerCase());
    if (!name) continue;
    tables[kind] = new RecordTable(kind, def, decodeWesys(files[name], def.file));
    byLower.delete(def.file.toLowerCase());
  }
  for (const [lower, name] of byLower) {
    const known = PASSTHROUGH_FILES.find(f => f.toLowerCase() === lower);
    if (known) {
      decodeWesys(files[name], known); // validates the container even if the content is opaque
      passthrough[known] = files[name];
    } else {
      unsupported.push(name);
    }
  }
  if (!Object.keys(tables).length) {
    throw new PesFormatError('NO_SUPPORTED_FILES', 'No se encontró Team.bin, Player.bin, PlayerAssignment.bin ni Coach.bin.', { unsupported });
  }
  return { format: FORMAT_ID, tables, passthrough, unsupported };
}

/** Re-serializes only the modified tables. */
export function serializeBinDatabase(db) {
  const out = {};
  for (const t of Object.values(db.tables)) if (t.isModified()) out[t.file] = t.serialize();
  return out;
}

function baseName(path) { return String(path).split(/[\\/]/).pop(); }
