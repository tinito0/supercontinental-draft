// Server-rendered markup of the team workspace pieces (no DOM in the repo, see broadcastRender.test.jsx).
// SYNTHETIC rows only: they check states and wording, not layout; layout is checked with screenshots.
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TeamList } from '../../components/pes/team/TeamList.jsx';
import { TeamHeader } from '../../components/pes/team/TeamHeader.jsx';
import { TeamBadge } from '../../components/pes/team/TeamBadge.jsx';
import { TeamSaveBar } from '../../components/pes/team/TeamSaveBar.jsx';
import { kitLabel } from '../../components/pes/team/sections/KitsSection.jsx';

const row = (id, extra = {}) => ({ id, name: `Equipo ${id}`, abbr: 'EQU', national: false, colours: null, players: 23, inLeague: false, unsaved: 0, modified: false, hasBin: true, hasEdit: true, hasKits: true, ...extra });
const listProps = { loading: false, selectedId: null, onSelect: () => {}, hasLeague: true, kitManager: false, query: '', onQuery: () => {}, filter: 'all', onFilter: () => {}, sort: 'name', onSort: () => {} };

describe('TeamList markup', () => {
  it('shows one state per row: unsaved wins over out of league', () => {
    const html = renderToStaticMarkup(<TeamList {...listProps} kitManager rows={[row(1, { unsaved: 2 }), row(2), row(3, { inLeague: true })]} />);
    expect(html.match(/sin guardar<\/span>/g)).toHaveLength(1);
    expect(html.match(/solo lectura/g)).toHaveLength(1);
  });

  it('says when the list is capped instead of cutting it silently', () => {
    const rows = Array.from({ length: 205 }, (_, i) => row(i + 1));
    const html = renderToStaticMarkup(<TeamList {...listProps} rows={rows} />);
    expect(html).toContain('Mostrando 200 de 205');
    expect(html.match(/aria-current/g)).toBeNull();
  });

  it('marks the selected row and offers a way out of an empty search', () => {
    const selected = renderToStaticMarkup(<TeamList {...listProps} selectedId={2} rows={[row(1), row(2)]} />);
    expect(selected.match(/aria-current="true"/g)).toHaveLength(1);
    const empty = renderToStaticMarkup(<TeamList {...listProps} query="zzz" rows={[row(1)]} />);
    expect(empty).toContain('Ningún equipo coincide');
    expect(empty).toContain('Limpiar búsqueda');
  });

  it('renders skeleton rows while loading', () => {
    expect(renderToStaticMarkup(<TeamList {...listProps} loading rows={[]} />)).toContain('skeleton');
  });
});

describe('TeamHeader and badge markup', () => {
  it('shows identity, metadata and the access note; no gradient in the band', () => {
    const colours = { c1: '#ff0000', c2: '#ffffff' };
    const html = renderToStaticMarkup(
      <TeamHeader teamId={139} headingId="h" identity={{ name: 'Boca Juniors', abbr: 'BOC' }} colours={colours}
        meta={['Club', 'Argentina']} accessNote="Fuera de la liga: solo lectura para tu rol." saved="x" />,
    );
    expect(html).toContain('Boca Juniors');
    expect(html).toContain('139');
    expect(html).toContain('Club · Argentina'.split(' · ')[1]);
    expect(html).toContain('Fuera de la liga');
    expect(html).not.toContain('Reemplazar equipo');
    expect(html).not.toContain('gradient'); // badge and band are solid halves
    expect(html).toContain('clip-path');
  });

  it('falls back to a neutral badge without colours and picks readable text on light colours', () => {
    expect(renderToStaticMarkup(<TeamBadge abbr="" colours={null} />)).toContain('bg-raised');
    expect(renderToStaticMarkup(<TeamBadge abbr="ABC" colours={{ c1: '#ffffff', c2: '#eeeeee' }} />)).toContain('color:#0e1320');
  });

  it('save bar appears only with unsaved team changes and says saving covers everything', () => {
    expect(renderToStaticMarkup(<TeamSaveBar teamCount={0} totalCount={4} />)).toBe('');
    const html = renderToStaticMarkup(<TeamSaveBar teamCount={1} totalCount={4} />);
    expect(html).toContain('Guardar todo');
    expect(html).toContain('Descartar los de este equipo');
    expect(html).not.toContain('Sí, descartar'); // discarding asks first
  });
});

describe('kitLabel', () => {
  it('names Sider kit folders', () => {
    expect(kitLabel('p1', 'player')).toBe('Titular');
    expect(kitLabel('p4', 'player')).toBe('Cuarto kit');
    expect(kitLabel('g1', 'goalkeeper')).toBe('Arquero');
    expect(kitLabel('g2', 'goalkeeper')).toBe('Arquero alternativo');
    expect(kitLabel('p1-alt', 'player')).toBe('Kit de jugador');
  });
});
