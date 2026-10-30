// El «¿Qué es?» de Filtros explica cada estilo de juego y cada habilidad. Estos checks usan el
// public/jugadores.json real y PLAYER_SKILLS_MAP, así que una habilidad o un estilo nuevo sin texto falla acá.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PLAYER_SKILLS_MAP } from '../utils/constants.js';
import { COM_STYLE_KEYS, PLAYING_STYLE_GROUPS, PLAYING_STYLE_INFO, SKILL_INFO } from '../utils/playerGlossary.js';

const ROOT = path.resolve(__dirname, '..');
const players = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/jugadores.json'), 'utf8'));
const marketStyles = [...new Set(players.map(p => p.PlayingStyle).filter(Boolean))];

describe('player glossary', () => {
  it.each(marketStyles)('explains the playing style «%s»', style => {
    expect(PLAYING_STYLE_INFO[style], `falta el estilo ${style}`).toBeTruthy();
  });

  it('lists every playing style in exactly one group, and only styles that exist', () => {
    const listed = PLAYING_STYLE_GROUPS.flatMap(g => g.styles);
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual(Object.keys(PLAYING_STYLE_INFO).sort());
  });

  it.each(Object.keys(PLAYER_SKILLS_MAP))('explains the skill %s', key => {
    expect(SKILL_INFO[key], `falta la habilidad ${key}`).toBeTruthy();
  });

  it('has no description for a skill that is not in the filters', () => {
    expect(Object.keys(SKILL_INFO).sort()).toEqual(Object.keys(PLAYER_SKILLS_MAP).sort());
  });

  it('keeps the COM styles inside the skill map', () => {
    COM_STYLE_KEYS.forEach(key => expect(PLAYER_SKILLS_MAP[key]).toBeTruthy());
  });
});
