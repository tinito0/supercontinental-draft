// «Habilidades del jugador» in the player card lists player skills only, not the 7 COM playing styles (synthetic player).
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SkillsSection } from '../components/PlayerModal.jsx';

describe('SkillsSection', () => {
  test('leaves out the COM playing styles', () => {
    const html = renderToStaticMarkup(<SkillsSection player={{ Trickster: true, EarlyCross: true, LongRanger: true, Rabona: true, LongRangeDrive: true }} />);
    expect(html).not.toContain('Mago del balón');
    expect(html).not.toContain('Centrador');
    expect(html).toContain('Rabona');
    expect(html).toContain('Cañonero'); // LongRangeDrive is the skill «Cañonero»
    expect(html).toContain('2 activas');
  });
});
