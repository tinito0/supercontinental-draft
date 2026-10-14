// firestore.rules duplicates the permission lists (rules cannot import JS). This test fails
// when the two drift apart.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { KIT_EDITABLE_KEYS } from '../../pes/kits/kitConfig.js';
import { EDIT_TEAM_KIT_FIELDS, OP_TYPES } from '../../pes/permissions.js';
import { TEXTURE_SLOT_IDS } from '../../pes/kits/kitTextures.js';

const rules = fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8');
const listOf = fn => {
  const m = rules.match(new RegExp(`function ${fn}\\(\\) \\{\\s*return \\[([\\s\\S]*?)\\];`));
  if (!m) throw new Error(`firestore.rules: no se encontró ${fn}()`);
  return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
};

describe('firestore.rules ↔ engine permission lists', () => {
  it('kit keys match', () => expect(listOf('pesKitKeys').sort()).toEqual([...KIT_EDITABLE_KEYS].sort()));
  it('texture slots match', () => expect(listOf('pesTextureSlots').sort()).toEqual([...TEXTURE_SLOT_IDS].sort()));
  it('team colour fields match', () => expect(listOf('pesTeamColorFields').sort()).toEqual([...EDIT_TEAM_KIT_FIELDS].sort()));
  it('operation types match', () => expect(listOf('pesOpTypes').sort()).toEqual(Object.keys(OP_TYPES).sort()));
});
