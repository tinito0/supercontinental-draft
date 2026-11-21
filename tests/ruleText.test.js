// Synthetic chapter texts plus the real Season 3 file: the structure the rules page draws from plain text.
import { readFileSync } from 'node:fs';
import { splitLabel, toRuleBlocks } from '../utils/ruleText.js';

describe('splitLabel', () => {
  it('splits short labels, parentheses included', () => {
    expect(splitLabel('Localía: es local el que menos fue')).toEqual({ label: 'Localía', text: 'es local el que menos fue' });
    expect(splitLabel('Comisión de la liga (15%): se cobra')).toEqual({ label: 'Comisión de la liga (15%)', text: 'se cobra' });
  });

  it('leaves clauses and lead-ins alone', () => {
    expect(splitLabel('Cuartos de final, según la tabla:').label).toBe('');
    expect(splitLabel('Si dos o más equipos terminan con los mismos puntos y nadie desempata: decide').label).toBe('');
    expect(splitLabel('Sin dos puntos acá').label).toBe('');
  });
});

describe('toRuleBlocks', () => {
  it('reads subtitles, numbered and bullet lists', () => {
    const blocks = toRuleBlocks('Desempate\nSi empatan:\n1. Diferencia de gol.\nIV. Goles a favor.\n\n• Rondas: 1.\n• Impacto: ninguno.\n\nTexto suelto.');
    expect(blocks).toEqual([
      { type: 'subtitle', text: 'Desempate' },
      { type: 'paragraph', label: '', text: 'Si empatan:' },
      { type: 'numbered', items: [{ marker: '1.', label: '', text: 'Diferencia de gol.' }, { marker: 'IV.', label: '', text: 'Goles a favor.' }] },
      { type: 'bullets', items: [{ label: 'Rondas', text: '1.' }, { label: 'Impacto', text: 'ninguno.' }] },
      { type: 'paragraph', label: '', text: 'Texto suelto.' },
    ]);
  });

  it('does not take a one-line paragraph or a sentence as a subtitle', () => {
    expect(toRuleBlocks('Los partidos duran 8 minutos')[0].type).toBe('paragraph');
    expect(toRuleBlocks('Termina con punto.\nSegunda línea.')[0].type).toBe('paragraph');
  });

  it('starts a new list after a blank line', () => {
    expect(toRuleBlocks('1. Uno.\n\n1. Otro.').filter(block => block.type === 'numbered')).toHaveLength(2);
  });

  it('finds the structure of the Season 3 rules', () => {
    const { chapters } = JSON.parse(readFileSync(new URL('../content/reglamento-temporada-3.json', import.meta.url), 'utf8'));
    const liga = toRuleBlocks(chapters.find(chapter => chapter.id === 'liga').body);
    expect(liga.filter(block => block.type === 'subtitle').map(block => block.text)).toEqual(['Puntuación', 'Desempate']);
    expect(liga.find(block => block.type === 'numbered').items).toHaveLength(3);
  });
});
