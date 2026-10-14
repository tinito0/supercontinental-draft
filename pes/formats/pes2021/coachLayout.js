// Coach.bin (pesdb) record layout for PES 2021.
// Offsets: Coach table of the "PES 2020 Editor V0.12.8 by Ejogc327" Bin-mode layout (same decompiled
// source as binLayout.js; Coach.csv column order Id;Name;Country;JapName;Adaptability;…).
// Verified against vendor/UML_Database Coach.bin (1851 records × 100 bytes, no header):
//   - 5/5 coaches of the EJOGC team exports (Downloads/EQUIPOS PARA EXPORTAR) equal in name, country, adaptability;
//   - 706/706 coaches also present in EDIT00000000 equal in name and country;
//   - Team.bin `coach` references a Coach.bin id for 704/704 teams.
// Bytes not described here (u16 at 6, Japanese name at 8) are preserved untouched.

export const COACH_RECORD_SIZE = 100;

export const COACH_FIELDS = [
  { name: 'id', kind: 'uint', offset: 0, size: 4, evidence: 'ejogc coach#0; 1851 unique ids; referenced by Team.bin coach', confidence: 'verified' },
  { name: 'country', kind: 'bits', offset: 4, shift: 0, bits: 9, addend: 0, evidence: 'ejogc coach#2; 5/5 EJOGC exports, 706/706 EDIT coaches', confidence: 'verified' },
  { name: 'adaptability', kind: 'bits', offset: 5, shift: 1, bits: 7, addend: 40, evidence: 'ejogc coach#4; 5/5 EJOGC exports', confidence: 'verified' },
  { name: 'name', kind: 'string', offset: 54, length: 45, evidence: 'ejogc coach#1; 5/5 EJOGC exports, 706/706 EDIT coaches', confidence: 'verified' },
];
