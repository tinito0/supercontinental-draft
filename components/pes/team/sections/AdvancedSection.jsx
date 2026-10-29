import React from 'react';
import { FieldInput } from '../../PesUi.jsx';
import { NAME_FIELDS } from '../../../../pes/draftTransfer.js';

// Fields shown in other sections, the record id, and the PES 2020 carry-over block (not meaningful to edit).
const ELSEWHERE = new Set(['id', 'country', 'stadium', 'coach', 'nameEmpty1', 'nameEmpty2', 'nameEmpty3', 'nameEmpty4',
  'shortNameLicensed', 'shortNameFake', ...NAME_FIELDS]);
const HIDDEN = /^(team2020|country2020|value2020)/i;

/** «Avanzado»: the remaining Team.bin flags (licences, fake, anthem). Unverified fields stay locked. */
export function AdvancedSection({ ws, teamId, access, isModified, apply }) {
  const bin = ws.bin?.tables.team;
  if (!bin?.has(teamId)) return <p className="text-sm text-ink-3">Este equipo no está en el Team.bin cargado.</p>;
  const fields = bin.fields.filter(f => !ELSEWHERE.has(f.name) && !HIDDEN.test(f.name));
  return (
    <div className="space-y-3">
      <p className="field-help mt-0">
        {access.data ? 'Banderas de Team.bin. Los campos con candado no tienen el significado verificado y son de solo lectura.' : 'Tu rol no puede editar los datos del equipo.'}
      </p>
      <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
        {fields.map(f => (
          <FieldInput key={f.name} field={f} value={bin.get(teamId, f.name)} readOnly={!access.data}
            modified={isModified('bin.team.set', f.name)}
            onCommit={value => apply(() => [{ type: 'bin.team.set', target: { teamId }, field: f.name, value }])} />
        ))}
      </div>
    </div>
  );
}
