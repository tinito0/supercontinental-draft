// Confidence of the binLayout.js player fields after the same-season check (PLAYER_FIELD_CHECKS, generated from the
// owner's Player.bin and the EJOGC export of that file, 2026-11-27). gen_layout.cjs could only compare with another
// season's export, so fields whose values drift between seasons stayed «structural».
// - structural → verified when the field equals the export on at least 99.99 % of players. Playing style misses one
//   player (K. Yonekura, 22 in Player.bin, past the 0–21 list; the export caps it at 21).
// - unverified → verified only with an independent second source: form, injury resistance and reputation equal the
//   EDIT fields form / injury / star of 4ccEditor (value − 1) on the 17 players of the owner's EDIT.
// - The 5 goalkeeper attributes take EJOGC's names (owner's decision, 2026-11-27: EJOGC reads the game files, PES Editor
//   Rebuilt names those offsets differently). Independent check: gkReach is the only one that rises with height
//   (r = 0.37 over 3 051 goalkeepers; the others −0.02…0.06), as reach does in the game.
import { PLAYER_FIELD_CHECKS } from './playerExtraLayout.js';

const GOALKEEPER = /^gk(Awareness|Catching|Clearing|Reflexes|Reach)$/;
const GOALKEEPER_EVIDENCE = 'EJOGC names kept (owner, 2026-11-27); gkReach alone correlates with height over 3 051 goalkeepers';
const SECOND_SOURCE = { form: 'form', injuryResistance: 'injury', reputation: 'star' };

export function withSameSeasonEvidence(fields, checks = PLAYER_FIELD_CHECKS) {
  return fields.map(f => {
    const check = checks[f.name];
    if (!check || f.confidence === 'verified') return f;
    if (check.equal / check.total < 0.9999) return f;
    if (GOALKEEPER.test(f.name)) return { ...f, confidence: 'verified', evidence: `${f.evidence}; same-season export: ${check.equal}/${check.total} equal; ${GOALKEEPER_EVIDENCE}` };
    if (f.confidence === 'unverified' && !SECOND_SOURCE[f.name]) return f;
    const second = SECOND_SOURCE[f.name] ? `; EDIT ${SECOND_SOURCE[f.name]} (4ccEditor) equals value − 1 on 17/17 players` : '';
    return { ...f, confidence: 'verified', evidence: `${f.evidence}; same-season export: ${check.equal}/${check.total} equal${second}` };
  });
}
