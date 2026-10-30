// The «¿Qué es?» list in Filtros explains every playing style and skill. These checks use the real
// public/jugadores.json and PLAYER_SKILLS_MAP, so a new style or skill without a text fails here.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { COM_STYLE_KEYS, FILTER_SKILL_KEYS, PLAYER_SKILLS_MAP } from '../utils/constants.js';
import { OWN_SUMMARY_SKILLS, PLAYING_STYLE_GROUPS, PLAYING_STYLE_INFO, PLAYING_STYLE_POSITIONS, SKILL_INFO } from '../utils/playerGlossary.js';

const ROOT = path.resolve(__dirname, '..');
const players = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/jugadores.json'), 'utf8'));
const marketPositions = new Set(players.map(p => p.POS_NOMBRE));
const marketStyles = [...new Set(players.map(p => p.PlayingStyle).filter(Boolean))];

describe('player glossary', () => {
  it.each(marketStyles)('explains the playing style «%s»', style => {
    expect(PLAYING_STYLE_INFO[style]?.summary, `falta el estilo ${style}`).toBeTruthy();
  });

  it('gives every playing style except «Ninguno» an explanation and real examples', () => {
    Object.entries(PLAYING_STYLE_INFO).filter(([style]) => style !== 'Ninguno').forEach(([style, info]) => {
      expect(info.detail, `${style} sin explicación`).toBeTruthy();
      expect(info.examples?.length, `${style} sin ejemplos`).toBeGreaterThan(0);
    });
  });

  it('lists every playing style in exactly one group, and only styles that exist', () => {
    const listed = PLAYING_STYLE_GROUPS.flatMap(g => g.styles);
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual(Object.keys(PLAYING_STYLE_INFO).sort());
  });

  it.each(FILTER_SKILL_KEYS)('explains the skill %s', key => {
    expect(SKILL_INFO[key], `falta la habilidad ${key}`).toBeTruthy();
  });

  it('describes exactly the filterable skills, no COM style', () => {
    expect(Object.keys(SKILL_INFO).sort()).toEqual([...FILTER_SKILL_KEYS].sort());
    COM_STYLE_KEYS.forEach(key => expect(SKILL_INFO[key], key).toBeUndefined());
  });

  it('marks as own summary only skills that exist', () => {
    OWN_SUMMARY_SKILLS.forEach(key => expect(SKILL_INFO[key], key).toBeTruthy());
  });

  it('leaves the COM styles in the skill map, so the player card still lists them', () => {
    COM_STYLE_KEYS.forEach(key => expect(PLAYER_SKILLS_MAP[key]).toBeTruthy());
    expect(FILTER_SKILL_KEYS.length).toBe(Object.keys(PLAYER_SKILLS_MAP).length - COM_STYLE_KEYS.length);
  });

  it('gives every playing style its positions, using the market position codes', () => {
    const withPositions = Object.keys(PLAYING_STYLE_INFO).filter(style => style !== 'Ninguno');
    expect(Object.keys(PLAYING_STYLE_POSITIONS).sort()).toEqual(withPositions.sort());
    Object.entries(PLAYING_STYLE_POSITIONS).forEach(([style, positions]) => {
      positions.forEach(pos => expect(marketPositions.has(pos), `${style}: ${pos} no existe en el mercado`).toBe(true));
    });
  });
});
