import React, { useEffect, useMemo, useState } from 'react';
import { Issue } from '../../PesUi.jsx';
import { opKey } from '../../opKeys.js';

function DorsalInput({ value, label, disabled, modified, onCommit }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  const commit = () => { if (Number(draft) !== value && draft !== '') onCommit(Number(draft)); else setDraft(value); };
  return (
    <input type="number" min={1} max={99} value={draft} disabled={disabled} aria-label={label}
      onChange={e => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setDraft(value); }}
      className={`input num w-20 min-h-10 text-center ${modified ? 'border-accent/50 text-accent-soft' : ''}`} />
  );
}

/** One row per player, with the dorsal of each file that lists them (Team.bin assignment, EDIT roster). */
export function squadRows(ws, teamId) {
  const byPlayer = new Map();
  const row = pid => byPlayer.get(pid) || byPlayer.set(pid, { playerId: pid, bin: null, edit: null }).get(pid);
  const assignments = ws.bin?.tables.assignment;
  if (assignments) {
    for (const id of assignments.ids()) {
      if (assignments.get(id, 'teamId') !== teamId) continue; // one field per row instead of a full read of ~20k rows
      const r = assignments.read(id);
      row(r.playerId).bin = { assignmentId: r.id, number: r.shirtNumber };
    }
  }
  if (ws.edit?.teams.has(teamId)) for (const r of ws.edit.roster(teamId)) row(r.playerId).edit = { slot: r.slot, number: r.number };
  return [...byPlayer.values()].sort((a, b) => (a.bin?.number ?? a.edit?.number ?? 999) - (b.bin?.number ?? b.edit?.number ?? 999));
}

function duplicates(rows, key) {
  const seen = new Map();
  for (const r of rows) { const n = r[key]?.number; if (n != null) seen.set(n, (seen.get(n) || 0) + 1); }
  return [...seen].filter(([, c]) => c > 1).map(([n]) => n);
}

/** «Plantel»: dorsals per file. Adding or removing players stays in «Reemplazar equipo» and «Draft → PES». */
export function SquadSection({ ws, version, teamId, access, modified, apply }) {
  // `version` marks changes inside the (mutable) working copy, so it is a dependency although unused.
  const rows = useMemo(() => squadRows(ws, teamId), [ws, version, teamId]);
  const hasBin = Boolean(ws.bin?.tables.assignment);
  const hasEdit = Boolean(ws.edit?.teams.has(teamId));
  const nameOf = id => (ws.bin?.tables.player?.has(id) ? ws.bin.tables.player.get(id, 'name') : ws.edit?.players.has(id) ? ws.edit.readPlayer(id).name : `#${id}`);
  const dupBin = duplicates(rows, 'bin');
  const dupEdit = duplicates(rows, 'edit');

  if (!rows.length) return <p className="text-sm text-ink-3">Este equipo no tiene jugadores en los archivos cargados.</p>;
  return (
    <div className="space-y-3">
      {!access.data && <p className="field-help mt-0">Tu rol no puede editar dorsales.</p>}
      {dupBin.length > 0 && <Issue tone="warning">Dorsales repetidos en Team.bin: {dupBin.join(', ')}.</Issue>}
      {dupEdit.length > 0 && <Issue tone="warning">Dorsales repetidos en el EDIT: {dupEdit.join(', ')}.</Issue>}
      <div className="overflow-x-auto max-h-[70vh] -mx-4 sm:-mx-5">
        <table className="data-table min-w-[30rem]">
          <thead>
            <tr>
              {hasBin && <th scope="col" className="sticky left-0 z-[2]">Dorsal BIN</th>}
              {hasEdit && <th scope="col">Dorsal EDIT</th>}
              <th scope="col">Jugador</th>
              <th scope="col">Id</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const name = nameOf(r.playerId);
              return (
                <tr key={r.playerId}>
                  {hasBin && (
                    <td className="sticky left-0 bg-surface">
                      {r.bin ? (
                        <DorsalInput value={r.bin.number} label={`Dorsal de ${name} en Team.bin`} disabled={!access.data}
                          modified={modified.has(opKey({ type: 'bin.assignment.set', target: { assignmentId: r.bin.assignmentId }, field: 'shirtNumber' }))}
                          onCommit={value => apply(() => [{ type: 'bin.assignment.set', target: { assignmentId: r.bin.assignmentId }, field: 'shirtNumber', value }])} />
                      ) : <span className="text-ink-3" title="No figura en este archivo">no figura</span>}
                    </td>
                  )}
                  {hasEdit && (
                    <td>
                      {r.edit ? (
                        <DorsalInput value={r.edit.number} label={`Dorsal de ${name} en el EDIT`} disabled={!access.data}
                          modified={modified.has(opKey({ type: 'edit.roster.number', target: { teamId, slot: r.edit.slot } }))}
                          onCommit={value => apply(() => [{ type: 'edit.roster.number', target: { teamId, slot: r.edit.slot }, value }])} />
                      ) : <span className="text-ink-3" title="No figura en este archivo">no figura</span>}
                    </td>
                  )}
                  <td className="text-ink font-medium">{name}</td>
                  <td className="num text-ink-3">{r.playerId}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
