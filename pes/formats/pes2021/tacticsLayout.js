// Tactics.bin and TacticsFormation.bin (pesdb) record layouts for PES 2021.
// Offsets: tactics tables of the "PES 2020 Editor V0.12.8 by Ejogc327" PES 2021 Bin layout (decompiled class
// _2056, same source as binLayout.js), matched to the Formation.csv columns that EJOGC imports/exports and
// that utils/pesExport.js generates. Verified on vendor/UML_Database against the EJOGC exports of 5 teams
// (Downloads/EQUIPOS PARA EXPORTAR: Dortmund 126, River 138, Inter 119, Inter Miami 5738, Internacional 1252).
//
// Tactics.bin: 1408 × 12 bytes = two strategy presets per team (Formation.csv S1, S2; S3 is not stored).
// Values are the app's own values (components/FormationModal.jsx TacticsPanel): pressuring 1 = aggressive,
// numbers in attack/defence 0..2, ranges 1..10.
export const TACTICS_RECORD_SIZE = 12;

const ev = n => `ejogc tactics#${n}; 10/10 equal (5 teams × 2 presets) in Formation.csv S1/S2`;
export const TACTICS_FIELDS = [
  { name: 'id', kind: 'uint', offset: 0, size: 4, evidence: '1408 unique ids; every TacticsFormation row references one', confidence: 'verified' },
  { name: 'teamId', kind: 'uint', offset: 4, size: 4, evidence: '704 teams × 2 records; equals Formation.csv Id', confidence: 'verified', locked: true },
  { name: 'attackingStyles', kind: 'bits', offset: 10, shift: 9, bits: 1, addend: 0, evidence: ev(2), confidence: 'verified' },
  { name: 'buildUp', kind: 'bits', offset: 10, shift: 14, bits: 1, addend: 0, evidence: ev(3), confidence: 'verified' },
  { name: 'attackingArea', kind: 'bits', offset: 10, shift: 12, bits: 1, addend: 0, evidence: ev(4), confidence: 'verified' },
  { name: 'positioning', kind: 'bits', offset: 10, shift: 7, bits: 1, addend: 0, evidence: ev(5), confidence: 'verified' },
  { name: 'supportRange', kind: 'bits', offset: 8, shift: 4, bits: 4, addend: 1, evidence: ev(6), confidence: 'verified' },
  { name: 'numbersInAttack', kind: 'bits', offset: 10, shift: 3, bits: 2, addend: 0, evidence: ev(7), confidence: 'verified' },
  { name: 'defensiveStyles', kind: 'bits', offset: 10, shift: 13, bits: 1, addend: 0, evidence: ev(8), confidence: 'verified' },
  { name: 'containmentArea', kind: 'bits', offset: 10, shift: 11, bits: 1, addend: 0, evidence: ev(9), confidence: 'verified' },
  { name: 'pressuring', kind: 'bits', offset: 10, shift: 10, bits: 1, addend: 0, evidence: ev(10), confidence: 'verified' },
  { name: 'defensiveLine', kind: 'bits', offset: 9, shift: 0, bits: 4, addend: 1, evidence: ev(11), confidence: 'verified' },
  { name: 'compactness', kind: 'bits', offset: 8, shift: 0, bits: 4, addend: 1, evidence: ev(12), confidence: 'verified' },
  { name: 'numbersInDefense', kind: 'bits', offset: 10, shift: 5, bits: 2, addend: 0, evidence: ev(13), confidence: 'verified' },
];

/** Strategy fields with the ranges the app (and the game menus) use. */
export const TACTICS_STRATEGY = {
  attackingStyles: [0, 1], buildUp: [0, 1], attackingArea: [0, 1], positioning: [0, 1], supportRange: [1, 10], numbersInAttack: [0, 2],
  defensiveStyles: [0, 1], containmentArea: [0, 1], pressuring: [0, 1], defensiveLine: [1, 10], compactness: [1, 10], numbersInDefense: [0, 2],
};

// TacticsFormation.bin: 46464 × 12 bytes = 33 rows per Tactics id (3 formations × 11 players), in index order.
// Row = tactics id, role (0 GK … 12 CF, same codes as the EDIT), depth (3 = own goal) and lateral position
// (same coordinates as the EDIT and as pesExport LocationX/LocationY), index byte = formation << 4 | slot.
// 330/330 rows equal Formation.csv Position/LocationX/LocationY{slot}F{f}S{s} for the 5 exported teams.
export const TACTICS_FORMATION_RECORD_SIZE = 12;
const fev = c => `Formation.csv ${c}; 330/330 rows equal (5 teams × 2 presets × 3 formations × 11)`;
export const TACTICS_FORMATION_FIELDS = [
  { name: 'tacticsId', kind: 'uint', offset: 0, size: 4, evidence: 'references Tactics.bin id for 46464/46464 rows', confidence: 'verified', locked: true },
  { name: 'role', kind: 'uint', offset: 4, size: 4, evidence: fev('Position'), confidence: 'verified' },
  { name: 'depth', kind: 'uint', offset: 8, size: 1, evidence: fev('LocationX'), confidence: 'verified' },
  { name: 'lateral', kind: 'uint', offset: 9, size: 1, evidence: fev('LocationY'), confidence: 'verified' },
  { name: 'slot', kind: 'bits', offset: 10, shift: 0, bits: 4, addend: 0, evidence: 'values 0..10, rows in order in all 1408 groups', confidence: 'verified', locked: true },
  { name: 'formation', kind: 'bits', offset: 10, shift: 4, bits: 4, addend: 0, evidence: 'values 0..2 (Formation.csv F1..F3)', confidence: 'verified', locked: true },
];

/** Composite key of a TacticsFormation row: tactics id and index byte. */
export const formationRowKey = (tacticsId, formation, slot) => tacticsId * 256 + formation * 16 + slot;
