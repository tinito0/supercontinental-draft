import React, { useMemo, useState } from 'react';
import { Card, FieldInput, SearchInput, Pill } from './PesUi.jsx';
import { EDIT_PLAYER_FIELDS, EDIT_LOCKED_FIELDS } from '../../pes/formats/pes2021/editLayout.js';
import { opKey } from './opKeys.js';

const BIN_GROUPS = [
  ['Identidad', f => ['name', 'japName', 'shirt', 'shirtNational', 'country', 'country2', 'height', 'weight', 'age', 'strongFootLeft', 'playingStyle', 'registeredPosition'].includes(f.name)],
  ['Posiciones', f => f.name.startsWith('pos')],
  ['Habilidades', f => f.kind === 'bits' && f.addend === 40 && !f.name.startsWith('gk')],
  ['Arquero', f => f.name.startsWith('gk')],
  ['Otros', () => true],
];

function groupFields(fields) {
  const used = new Set(['id']);
  return BIN_GROUPS.map(([label, test]) => {
    const list = fields.filter(f => !used.has(f.name) && test(f));
    list.forEach(f => used.add(f.name));
    return [label, list];
  }).filter(([, list]) => list.length);
}

export function PesPlayersPanel({ pes, onApply }) {
  const { ws, caps, version, modified } = pes;
  const [q, setQ] = useState('');
  const [playerId, setPlayerId] = useState(null);
  const canEdit = caps.has('player.edit');
  const table = ws?.bin?.tables.player;

  const index = useMemo(() => {
    const out = [];
    if (table) for (const id of table.ids()) out.push({ id, name: table.get(id, 'name'), src: 'bin' });
    if (ws?.edit) for (const id of ws.edit.players.keys()) out.push({ id, name: ws.edit.readPlayer(id).name, src: 'edit' });
    return out;
  }, [ws, table, version]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return index.filter(p => p.src === 'edit').concat(index.slice(0, 50));
    return index.filter(p => String(p.id) === s || (p.name || '').toLowerCase().includes(s)).slice(0, 100);
  }, [index, q]);

  const groups = useMemo(() => (table ? groupFields(table.fields) : []), [table]);
  if (!table && !ws?.edit) return <Card><p className="text-xs text-slate-400">Cargá Player.bin o un EDIT para ver jugadores.</p></Card>;

  const inBin = playerId != null && table?.has(playerId);
  const inEdit = playerId != null && ws?.edit?.players.has(playerId);

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      <Card title={`Jugadores (${index.length})`}>
        <SearchInput value={q} onChange={setQ} placeholder="Nombre o id" />
        <ul className="mt-2 max-h-[60vh] overflow-y-auto space-y-0.5">
          {results.map(p => (
            <li key={`${p.src}-${p.id}`}>
              <button type="button" onClick={() => setPlayerId(p.id)}
                className={`w-full text-left px-2 py-1.5 rounded text-xs ${p.id === playerId ? 'bg-cyan-500/15 text-white' : 'text-slate-300 hover:bg-white/[0.04]'}`}>
                <span className="text-slate-500 mr-2">{p.id}</span>{p.name}{p.src === 'edit' && <Pill tone="cyan">EDIT</Pill>}
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <div className="space-y-4">
        {playerId == null && <Card><p className="text-xs text-slate-400">Elegí un jugador.{!canEdit && ' Tu rol puede ver pero no editar jugadores.'}</p></Card>}
        {inBin && groups.map(([label, fields]) => (
          <Card key={label} title={`Player.bin · ${label}`}>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {fields.map(f => (
                <FieldInput key={f.name} field={f} value={table.get(playerId, f.name)} readOnly={!canEdit}
                  modified={modified.has(opKey({ type: 'bin.player.set', target: { playerId }, field: f.name }))}
                  onCommit={value => onApply([{ type: 'bin.player.set', target: { playerId }, field: f.name, value }])} />
              ))}
            </div>
          </Card>
        ))}
        {inEdit && (
          <Card title="EDIT00000000 · jugador editado">
            <p className="text-[11px] text-slate-500 mb-2">Valores crudos del EDIT (formato 4ccEditor). Al cambiar un campo se marca como editado para que el juego use el valor del EDIT.</p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {EDIT_PLAYER_FIELDS.filter(f => !EDIT_LOCKED_FIELDS.has(f.name)).map(f => (
                <FieldInput key={f.name} field={f} value={ws.edit.readPlayer(playerId)[f.name]} readOnly={!canEdit}
                  modified={modified.has(opKey({ type: 'edit.player.set', target: { playerId }, field: f.name }))}
                  onCommit={value => onApply([{ type: 'edit.player.set', target: { playerId }, field: f.name, value }])} />
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
