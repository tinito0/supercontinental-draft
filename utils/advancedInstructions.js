// Advanced tactical instructions (PES 2021): two attacking and two defensive slots per game plan.
//
// Codes, names and the attack/defence split are those of PES Editor Rebuilt js/extras.js (ADV, ADV_CODES,
// ADV_SLOTS), verified in the game on an EDIT: the codes are the bytes the game stores at plan +0x6C/+0x74
// (attack) and +0x7C/+0x84 (defence), see pes/formats/pes2021/editLayout.js EDIT_TACTICS.advanced.
// Code 15 is marked "probable" there: the game shows it as "No" until a forward is assigned in-game.
import { EDIT_ADVANCED_CODES } from '../pes/formats/pes2021/editLayout.js';

/** @typedef {{ code: number, name: string, description: string, verified: boolean }} Instruction */

export const MAX_PER_SIDE = 2;

/** @type {{ attack: Instruction[], defense: Instruction[] }} */
export const ADVANCED_INSTRUCTIONS = {
  attack: [
    { code: 1, name: 'Ensanchar la cancha', description: 'Los jugadores de banda juegan pegados a la línea lateral para abrir la defensa rival.', verified: true },
    { code: 2, name: 'Falso nueve', description: 'El delantero centro baja a recibir y deja espacio para que lleguen los de segunda línea.', verified: true },
    { code: 3, name: 'Falsos laterales', description: 'Los laterales se cierran hacia el medio para ayudar en la creación.', verified: true },
    { code: 4, name: 'Laterales ofensivos', description: 'Los laterales suben con frecuencia para sumarse al ataque.', verified: true },
    { code: 5, name: 'Rotación en banda', description: 'Los jugadores de banda intercambian posiciones para desordenar la marca.', verified: true },
    { code: 6, name: 'Tiqui-taca', description: 'Pases cortos y movimiento constante para tener la pelota y desordenar al rival.', verified: true },
    { code: 7, name: 'Centros al área', description: 'Varios jugadores entran al área cuando se centra desde la banda.', verified: true },
    { code: 9, name: 'Falso extremo', description: 'El extremo se cierra hacia el medio y deja la banda libre para el lateral.', verified: true },
  ],
  defense: [
    { code: 11, name: 'Poblar el área', description: 'Cuando el rival centra, varios jugadores vuelven a defender dentro del área.', verified: true },
    { code: 12, name: 'Defensiva atrasada', description: 'La línea defensiva se queda atrás para cubrir el espacio a su espalda.', verified: true },
    { code: 13, name: 'Presión alta', description: 'Se presiona en campo rival para recuperar la pelota rápido. Exige mucha resistencia.', verified: true },
    { code: 14, name: 'Marcaje estrecho', description: 'Se marca muy de cerca al rival que recibe la pelota.', verified: true },
    { code: 15, name: 'Delantero liberado', description: 'Un delantero no baja a defender y espera arriba para salir de contraataque. En el juego aparece como "No" si no tiene un delantero asignado.', verified: false },
    { code: 16, name: 'Carrilero', description: 'Los de banda bajan a defender su costado como carrileros.', verified: true },
  ],
};

export const SIDES = ['attack', 'defense'];
// The format layer's list is the source of truth for what may be written; the catalog above only names it
// (tests/formationStates.test.js checks both match).
const CODES = { attack: new Set(EDIT_ADVANCED_CODES.attack), defense: new Set(EDIT_ADVANCED_CODES.defense) };

export const EMPTY_INSTRUCTIONS = Object.freeze({ attack: [], defense: [] });

export function instructionByCode(code) {
  return ADVANCED_INSTRUCTIONS.attack.find(i => i.code === code) || ADVANCED_INSTRUCTIONS.defense.find(i => i.code === code) || null;
}

/**
 * Stored value (Firestore) → { attack: code[], defense: code[] }: known codes of the right side only, no
 * duplicates, at most two per side. Missing or legacy data → nothing selected.
 */
export function normalizeAdvancedInstructions(raw) {
  const side = key => {
    const out = [];
    for (const v of Array.isArray(raw?.[key]) ? raw[key] : []) {
      const code = Number(v);
      if (CODES[key].has(code) && !out.includes(code) && out.length < MAX_PER_SIDE) out.push(code);
    }
    return out;
  };
  return { attack: side('attack'), defense: side('defense') };
}

/**
 * Selects or deselects one instruction. A third pick on a full side is refused (`rejected: 'full'`) instead of
 * silently dropping a previous choice; use replaceInstruction for that.
 * @returns {{ next: { attack: number[], defense: number[] }, rejected: null | 'full' | 'wrong-side' }}
 */
export function toggleInstruction(current, side, code) {
  const cur = normalizeAdvancedInstructions(current);
  if (!CODES[side]?.has(code)) return { next: cur, rejected: 'wrong-side' };
  if (cur[side].includes(code)) return { next: { ...cur, [side]: cur[side].filter(c => c !== code) }, rejected: null };
  if (cur[side].length >= MAX_PER_SIDE) return { next: cur, rejected: 'full' };
  return { next: { ...cur, [side]: [...cur[side], code] }, rejected: null };
}

/** Puts `code` in slot `index` (0 or 1) of a side, replacing what was there. */
export function replaceInstruction(current, side, index, code) {
  const cur = normalizeAdvancedInstructions(current);
  if (!CODES[side]?.has(code) || index < 0 || index >= MAX_PER_SIDE) return cur;
  const list = cur[side].filter(c => c !== code);
  const at = Math.min(index, list.length);
  list.splice(at, at < list.length ? 1 : 0, code);
  return { ...cur, [side]: list.slice(0, MAX_PER_SIDE) };
}

/** The four EDIT bytes in slot order (attack 1, attack 2, defence 1, defence 2); 0 = none. */
export function instructionSlots(ai) {
  const a = normalizeAdvancedInstructions(ai);
  return [a.attack[0] || 0, a.attack[1] || 0, a.defense[0] || 0, a.defense[1] || 0];
}

/** Codes allowed in each of the four slots, for validating raw slot bytes. */
export function isValidSlotCode(slot, code) {
  if (code === 0) return true;
  return (slot < 2 ? CODES.attack : CODES.defense).has(code);
}
