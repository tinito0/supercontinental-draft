import React, { useId } from 'react';
import { Pipette } from 'lucide-react';
import { Field } from '../../../ui/Field.jsx';
import { Group, FieldInput } from '../../PesUi.jsx';
import { NAME_FIELDS, coachNameOfTeam, coachOfTeam } from '../../../../pes/draftTransfer.js';
import {
  ABBR_LENGTH, cleanAbbreviation, colourOps, countryOps, editColourHex, nameByteLimit, nameOps, abbreviationOps,
  primaryKitColours, teamIdentity,
} from '../../../../pes/teamView.js';
import { ColourField } from '../ColourField.jsx';
import { CommitText } from './CommitText.jsx';

const EXTRA_NAME_FIELDS = ['nameEmpty1', 'nameEmpty2', 'nameEmpty3', 'nameEmpty4', 'shortNameLicensed', 'shortNameFake'];

function lockedHelp(access) {
  return access.data ? undefined : 'Tu rol no puede editar los datos del equipo.';
}

function NameGroup({ ws, teamId, access, isModified, apply }) {
  const identity = teamIdentity(ws, teamId);
  const nameModified = isModified('edit.team.set', 'name') || NAME_FIELDS.some(f => isModified('bin.team.set', f));
  const abbrModified = isModified('edit.team.set', 'short') || isModified('bin.team.set', 'shortNameLicensed');
  const limit = nameByteLimit(ws, teamId);
  return (
    <Group title="Nombre">
      <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
        <Field label={`Nombre${nameModified ? ' · modificado' : ''}`} help={lockedHelp(access) || `Se escribe en el EDIT y en los ${NAME_FIELDS.length} idiomas de Team.bin. El nombre de base de datos se corta más corto.`}>
          <CommitText value={identity.name} maxBytes={limit} disabled={!access.data} modified={nameModified}
            onCommit={v => apply(() => nameOps(ws, teamId, v))} />
        </Field>
        <Field label={`Abreviatura${abbrModified ? ' · modificada' : ''}`} help={access.data ? `${ABBR_LENGTH} letras o números.` : undefined}>
          <CommitText value={identity.abbr} maxLength={ABBR_LENGTH} disabled={!access.data} modified={abbrModified}
            transform={cleanAbbreviation} className="uppercase num"
            onCommit={v => apply(() => abbreviationOps(ws, teamId, v))} />
        </Field>
      </div>
    </Group>
  );
}

function ColourGroup({ ws, teamId, access, isModified, apply, onPreviewColour }) {
  const helpId = useId();
  if (!ws.edit?.teams.has(teamId)) {
    return (
      <Group title="Colores">
        <p className="text-sm text-ink-3">Este equipo no está en el EDIT cargado: los colores del equipo se guardan solo ahí.</p>
      </Group>
    );
  }
  const t = ws.edit.readTeam(teamId);
  const kit = primaryKitColours(ws, teamId);
  const fromKit = () => apply(() => [...colourOps(ws, teamId, 1, kit.c1), ...colourOps(ws, teamId, 2, kit.c2)]);
  const help = access.colours
    ? 'El EDIT guarda cada canal en 6 bits: el color se redondea al más cercano.'
    : access.outOfLeague ? 'Fuera de la liga: solo lectura para tu rol.' : 'Tu rol no puede editar los colores.';
  return (
    <Group title="Colores" aside={kit && access.colours && (
      <button type="button" className="btn btn-ghost btn-sm" onClick={fromKit}>
        <Pipette className="w-4 h-4" aria-hidden="true" />Usar colores del kit {kit.kit}
      </button>
    )}>
      <p id={helpId} className="field-help mt-0 mb-2">{help}</p>
      <div className="flex flex-wrap gap-x-8 gap-y-2">
        {[1, 2].map(n => (
          <ColourField key={n} label={n === 1 ? 'Color principal' : 'Color secundario'} value={editColourHex(t, n)}
            disabled={!access.colours} describedBy={helpId}
            modified={['r', 'g', 'b'].some(c => isModified('edit.team.set', `c${n}${c}`))}
            onPreview={hex => onPreviewColour(n, hex)}
            onCommit={hex => apply(() => colourOps(ws, teamId, n, hex))} />
        ))}
      </div>
    </Group>
  );
}

function OriginGroup({ ws, teamId, access, isModified, apply, countries }) {
  const identity = teamIdentity(ws, teamId);
  const known = countries.some(c => c.id === identity.country);
  const coach = coachOfTeam(ws, teamId);
  const coachId = coach.edit ?? coach.bin;
  const coachName = coachNameOfTeam(ws, teamId);
  return (
    <Group title="Origen">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={`País${isModified('bin.team.set', 'country') || isModified('edit.team.set', 'country') ? ' · modificado' : ''}`}
          help={lockedHelp(access) || (countries.length ? undefined : 'Cargando la lista de países…')}>
          <select value={identity.country ?? ''} disabled={!access.data || !countries.length} className="select w-full"
            onChange={e => apply(() => countryOps(ws, teamId, e.target.value))}>
            {!known && identity.country != null && <option value={identity.country}>Código {identity.country}</option>}
            {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <div>
          <p className="field-label">Entrenador</p>
          <p className="min-h-10 flex items-center text-sm text-ink">
            {coachName || (coachId != null ? `ID ${coachId}` : 'Sin entrenador')}
            {coachName && coachId != null && <span className="num ml-2 text-xs text-ink-3">{coachId}</span>}
          </p>
          <p className="field-help">Se cambia desde «Draft → PES».</p>
        </div>
      </div>
    </Group>
  );
}

function LanguageNames({ ws, teamId, access, isModified, apply }) {
  const bin = ws.bin?.tables.team;
  if (!bin?.has(teamId)) return null;
  const fields = [...NAME_FIELDS, ...EXTRA_NAME_FIELDS].map(n => bin.field(n));
  return (
    <details className="border-t border-line/[0.08] pt-4 group">
      <summary className="eyebrow cursor-pointer min-h-11 flex items-center">Nombres por idioma ({fields.length})</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {fields.map(f => (
          <FieldInput key={f.name} field={f} value={bin.get(teamId, f.name)} readOnly={!access.data}
            modified={isModified('bin.team.set', f.name)}
            onCommit={value => apply(() => [{ type: 'bin.team.set', target: { teamId }, field: f.name, value }])} />
        ))}
      </div>
    </details>
  );
}

/** «Identidad»: name, abbreviation, colours, country and coach, the per-language names folded away. */
export function IdentitySection(props) {
  return (
    <div className="space-y-5">
      <NameGroup {...props} />
      <ColourGroup {...props} />
      <OriginGroup {...props} />
      <LanguageNames {...props} />
    </div>
  );
}
