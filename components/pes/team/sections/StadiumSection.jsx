import React, { useEffect, useState } from 'react';
import { Field } from '../../../ui/Field.jsx';
import { Group } from '../../PesUi.jsx';
import { EDIT_TEAM_FIELDS } from '../../../../pes/formats/pes2021/editLayout.js';
import { NO_RIVAL, stadiumOps, teamIdentity } from '../../../../pes/teamView.js';
import { TeamPicker } from '../TeamPicker.jsx';
import { CommitText } from './CommitText.jsx';

const BYTES = Object.fromEntries(EDIT_TEAM_FIELDS.filter(f => f.kind === 'string').map(f => [f.name, f.length - 1]));
const BANNER_CHARS = 15;

function StadiumNumber({ value, disabled, onCommit, ...aria }) {
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => { setDraft(value ?? ''); }, [value]);
  const commit = () => { if (draft !== '' && Number(draft) !== value) onCommit(draft); else setDraft(value ?? ''); };
  return (
    <input type="number" min={0} value={draft} disabled={disabled} {...aria} className="input num w-full"
      onChange={e => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setDraft(value ?? ''); }} />
  );
}

/** «Estadio y rivales»: stadium id and custom name, classic rivals and the fans' banners (EDIT). */
export function StadiumSection({ ws, teamId, access, isModified, apply, teams, leagueIds }) {
  const identity = teamIdentity(ws, teamId);
  const edit = ws.edit?.teams.has(teamId) ? ws.edit.readTeam(teamId) : null;
  const locked = access.data ? undefined : 'Tu rol no puede editar los datos del equipo.';
  const setEdit = (field, value) => apply(() => [{ type: 'edit.team.set', target: { teamId }, field, value }]);
  const mod = (field, label) => `${label}${isModified('edit.team.set', field) ? ' · modificado' : ''}`;

  return (
    <div className="space-y-5">
      <Group title="Estadio">
        <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          <Field label={`Estadio (id)${isModified('bin.team.set', 'stadium') || isModified('edit.team.set', 'stadium_id') ? ' · modificado' : ''}`}
            help={locked || 'Stadium.bin no se puede leer todavía: el estadio va por número.'}>
            <StadiumNumber value={identity.stadiumId} disabled={!access.data} onCommit={v => apply(() => stadiumOps(ws, teamId, v))} />
          </Field>
          {edit && (
            <Field label={mod('stadium_name', 'Nombre propio del estadio')} help={locked || 'Vacío = el nombre del juego.'}>
              <CommitText value={edit.stadium_name} maxBytes={BYTES.stadium_name} disabled={!access.data}
                modified={isModified('edit.team.set', 'stadium_name')} onCommit={v => setEdit('stadium_name', v.trim())} />
            </Field>
          )}
        </div>
      </Group>

      {!edit ? (
        <Group title="Rivales y banderas">
          <p className="text-sm text-ink-3">Este equipo no está en el EDIT cargado: el nombre del estadio, los rivales y las banderas se guardan solo ahí.</p>
        </Group>
      ) : (
        <>
          <Group title="Rivales clásicos" aside="El juego los usa para los clásicos y el ambiente del partido.">
            <div className="grid gap-4 sm:grid-cols-3">
              {['rival1', 'rival2', 'rival3'].map((f, i) => (
                <Field key={f} label={mod(f, `Rival ${i + 1}`)} help={locked}>
                  <TeamPicker value={edit[f]} teams={teams} leagueIds={leagueIds} noneValue={NO_RIVAL} excludeId={teamId}
                    disabled={!access.data} onChange={v => setEdit(f, v)} />
                </Field>
              ))}
            </div>
          </Group>
          <Group title="Banderas de la hinchada" aside={`Hasta ${BANNER_CHARS} caracteres cada una.`}>
            <div className="grid gap-4 sm:grid-cols-2">
              {['banner1', 'banner2', 'banner3', 'banner4'].map((f, i) => (
                <Field key={f} label={mod(f, `Bandera ${i + 1}`)} help={locked}>
                  <CommitText value={edit[f]} maxLength={BANNER_CHARS} maxBytes={BYTES[f]} disabled={!access.data}
                    modified={isModified('edit.team.set', f)} onCommit={v => setEdit(f, v.trim())} />
                </Field>
              ))}
            </div>
          </Group>
        </>
      )}
    </div>
  );
}
