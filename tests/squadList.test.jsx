// Server-rendered markup of the PES-style squad list and team strength, with synthetic players (no game data).
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SquadSection, SquadRow } from '../components/formation/SquadList.jsx';
import { TeamStrength } from '../components/formation/TeamStrength.jsx';

const player = { Id: 7, Name: 'Jugador de Prueba', POS_NOMBRE: 'MC', OVR_CALCULADO: 83, Precio: 12.5 };

describe('SquadRow', () => {
  it('leads with the role in its position colour and shows the OVR in the stat colour', () => {
    const html = renderToStaticMarkup(<ul><SquadRow role="MO" player={player} number="10" /></ul>);

    expect(html).toContain('pos-medio');
    expect(html).toContain('>MO<');
    expect(html).toContain('stat-c-80');
    expect(html).toContain('Natural MC');
    expect(html).toContain('$12.50M');
    expect(html).toContain('>10<');
  });

  it('is static without onSelect and a button with it', () => {
    expect(renderToStaticMarkup(<ul><SquadRow role="MC" player={player} /></ul>)).not.toContain('<button');

    const html = renderToStaticMarkup(<ul><SquadRow role="MC" player={player} onSelect={() => {}} selectLabel="Mover a Jugador de Prueba" isSelected /></ul>);
    expect(html).toContain('<button type="button"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-label="Mover a Jugador de Prueba"');
  });

  it('marks an empty slot without a position colour and explains a disabled pick', () => {
    const html = renderToStaticMarkup(<ul><SquadRow role="DC" player={null} onSelect={() => {}} disabledReason="Elegí primero un suplente" /></ul>);

    expect(html).toContain('Puesto vacío');
    expect(html).not.toContain('pos-delantero');
    expect(html).toContain('disabled=""');
    expect(html).toContain('title="Elegí primero un suplente"');
  });

  it('says Baja in text, not only in colour', () => {
    expect(renderToStaticMarkup(<ul><SquadRow role="MC" player={player} isUnavailable /></ul>)).toContain('>Baja<');
  });

  it('leaves the photo out when asked', () => {
    expect(renderToStaticMarkup(<ul><SquadRow role="MC" player={player} showPhoto={false} /></ul>)).not.toContain('<img');
  });
});

describe('SquadSection', () => {
  it('renders the title with its count and a list', () => {
    const html = renderToStaticMarkup(<SquadSection title="Suplentes" count={3}><li>x</li></SquadSection>);

    expect(html).toContain('Suplentes');
    expect(html).toContain('>3<');
    expect(html).toContain('<ul><li>x</li></ul>');
  });
});

describe('TeamStrength', () => {
  it('shows each line average and a dash for a line nobody plays', () => {
    const html = renderToStaticMarkup(<TeamStrength starters={[{ pos: 'DC', ovr: 88 }, { pos: 'DFC', ovr: 70 }]} />);

    expect(html).toContain('Ataque');
    expect(html).toContain('>88<');
    expect(html).toContain('>70<');
    expect(html).toContain('>–<');
    expect(html).toContain('>79<');
  });
});

describe('SquadRow franchise mark', () => {
  it('tags the franchise player in words', () => {
    const html = renderToStaticMarkup(<ul><SquadRow role="MC" player={player} isFranchise /></ul>);

    expect(html).toContain('>Franquicia<');
    expect(html).toContain('text-crest-soft');
  });

  it('leaves other players untagged', () => {
    expect(renderToStaticMarkup(<ul><SquadRow role="MC" player={player} /></ul>)).not.toContain('Franquicia');
  });
});
