import React from 'react';
import { FieldInput, ModifiedDot } from '../PesUi.jsx';
import { EDIT_PLAYER_FIELDS } from '../../../pes/formats/pes2021/editLayout.js';
import { opKey } from '../opKeys.js';
import { fieldRange } from '../../../pes/core/fields.js';
import { SKILL_INFO } from '../../../utils/playerGlossary.js';
import { traitLabel, MOTION_LABELS } from './playerFields.js';

/** Skills or COM styles of Player.bin as toggles: pressed = the player has it. */
export function TraitToggles({ fields, get, canEdit, isModified, commit, label }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2" role="group" aria-label={label}>
      {fields.map(f => {
        const on = Boolean(get(f.name));
        const modified = isModified(f.name);
        return (
          <button key={f.name} type="button" aria-pressed={on} disabled={!canEdit} title={SKILL_INFO[f.csv]}
            onClick={() => commit(f.name, !on)}
            className={`relative min-h-11 rounded-lg px-3 py-2 text-sm font-semibold text-left border transition-[background-color,border-color,color,scale] duration-fast
              enabled:active:scale-[0.97] disabled:cursor-default
              ${on ? 'bg-accent/15 border-accent/50 text-ink' : 'bg-raised border-line/[0.14] text-ink-2 enabled:hover:border-line/30 enabled:hover:text-ink'}
              ${modified ? 'outline outline-2 outline-accent-soft' : ''}`}>
            <span className="flex items-center gap-1.5">{traitLabel(f)}{modified && <ModifiedDot />}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Motion types (1…n as the game numbers them) and the celebration id. */
export function MotionForm({ fields, get, canEdit, isModified, commit }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {fields.map(f => {
        const value = get(f.name);
        const modified = isModified(f.name);
        const label = MOTION_LABELS[f.name] || f.name;
        const { min, max } = fieldRange(f);
        if (max - min > 30) {
          return <FieldInput key={f.name} field={f} value={value} readOnly={!canEdit} label={label} modified={modified} onCommit={v => commit(f.name, v)} />;
        }
        const options = Array.from({ length: max - min + 1 }, (_, i) => min + i);
        return (
          <label key={f.name} className={`flex flex-col gap-1 text-xs ${modified ? 'text-accent-soft' : 'text-ink-2'}`}>
            <span className="flex items-center gap-1.5">{label}{modified && <ModifiedDot />}</span>
            <select className={`select ${modified ? 'border-accent/50' : ''}`} value={value ?? ''} disabled={!canEdit}
              onChange={e => { const v = Number(e.target.value); if (v !== value) commit(f.name, v); }}>
              {!options.includes(value) && <option value={value ?? ''}>{value == null ? 'Sin valor' : `Código ${value}`}</option>}
              {options.map(n => <option key={n} value={n}>Tipo {n}</option>)}
            </select>
          </label>
        );
      })}
    </div>
  );
}

const CELEBRATIONS = [['gc1', 'Festejo 1'], ['gc2', 'Festejo 2']];

/** The two celebrations of an EDIT player (gc1, gc2); writing one raises the EDIT motion flag. */
export function EditCelebrations({ edit, playerId, canEdit, modified, onApply }) {
  const values = edit.readPlayer(playerId);
  return (
    <div className="grid gap-3 sm:grid-cols-2 max-w-md">
      {CELEBRATIONS.map(([name, label]) => {
        const field = EDIT_PLAYER_FIELDS.find(f => f.name === name);
        return (
          <FieldInput key={name} field={field} value={values[name]} readOnly={!canEdit} label={label}
            modified={modified.has(opKey({ type: 'edit.player.set', target: { playerId }, field: name }))}
            onCommit={value => onApply([{ type: 'edit.player.set', target: { playerId }, field: name, value }])} />
        );
      })}
    </div>
  );
}
