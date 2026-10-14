import React, { useEffect, useState } from 'react';
import { Lock, UserRound } from 'lucide-react';
import { FieldInput, ConfidenceBadge } from '../PesUi.jsx';
import { fieldRange } from '../../../pes/core/fields.js';
import { getStatAndOvrColorClass, getPosColor, getPosColorClass, getFlagUrl } from '../../../utils/helpers.js';
import {
  POSITION_FIELDS, APTITUDE_LABEL, POSITION_OPTIONS, IDENTITY_FIELDS, FIELD_LABELS,
  positionName, statGroups, statLabel, statTone,
} from './playerFields.js';

const isLocked = (field, canEdit) => !canEdit || !field || field.confidence === 'unverified' || field.confidence === 'partial';

/** Player photo of the app (public/fotos_jugadores/<Id>.webp, same ids as Player.bin), silhouette when missing. */
export function PlayerPhoto({ id, name, className = '' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [id]);
  if (failed || id == null) {
    return (
      <span className={`flex items-center justify-center bg-raised text-ink-3 ${className}`} aria-hidden="true">
        <UserRound className="w-1/2 h-1/2" />
      </span>
    );
  }
  return (
    <img src={`/fotos_jugadores/${id}.webp`} alt={name ? `Foto de ${name}` : ''} loading="lazy" decoding="async"
      onError={() => setFailed(true)} className={`object-cover object-top bg-raised ${className}`} />
  );
}

/** Header in the style of PlayerModal: photo, OVR of the draft, name, position, nationality and body. */
export function ProfileHeader({ playerId, get, appPlayer, countryName }) {
  const name = get('name') || appPlayer?.Name || `Jugador ${playerId}`;
  const pos = positionName(get('registeredPosition'));
  const ovr = Number(appPlayer?.OVR_CALCULADO) || null;
  const country = get('country');
  const facts = [
    get('age') != null && `${get('age')} años`,
    get('height') != null && `${get('height')} cm`,
    get('weight') != null && `${get('weight')} kg`,
    get('strongFootLeft') != null && (get('strongFootLeft') ? 'Zurdo' : 'Diestro'),
  ].filter(Boolean);
  return (
    <header className="flex items-center gap-4 sm:gap-5">
      <div className="relative shrink-0">
        <PlayerPhoto id={playerId} name={name} className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border border-line/15" />
        {ovr && (
          <span className={`absolute -bottom-2 -right-2 min-w-11 h-11 px-1.5 rounded-xl flex items-center justify-center font-display num text-2xl font-bold shadow-lg ${getStatAndOvrColorClass(ovr)}`}
            title="Media del jugador en el draft">{ovr}</span>
        )}
      </div>
      <div className="min-w-0">
        <p className="eyebrow">Player.bin · id <span className="num">{playerId}</span></p>
        <h2 className="font-display text-3xl sm:text-4xl font-bold leading-none text-ink tracking-tight truncate mt-1">{name}</h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2.5 text-sm text-ink-2">
          <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${getPosColorClass(pos)}`}>{pos}</span>
          {country > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <img src={getFlagUrl(country)} alt="" width="20" height="15" className="rounded-[2px]" />
              {countryName(country)}
            </span>
          )}
          {facts.length > 0 && <span className="text-ink-3">{facts.join(' · ')}</span>}
        </div>
      </div>
    </header>
  );
}

/** Select that commits immediately; disabled when the field is locked. */
function SelectField({ label, field, value, options, canEdit, modified, onCommit }) {
  const locked = isLocked(field, canEdit);
  const known = options.some(o => o.id === value);
  return (
    <label className={`flex flex-col gap-1 text-xs ${modified ? 'text-accent-soft' : 'text-ink-2'}`}>
      <span className="flex items-center gap-1.5">
        {field?.confidence && <ConfidenceBadge confidence={field.confidence} />}{label}
        {modified && <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-label="modificado" />}
      </span>
      <select className={`select min-h-9 ${modified ? 'border-accent/50' : ''}`} value={value ?? ''} disabled={locked}
        onChange={e => { const v = field.kind === 'bool' ? e.target.value === '1' : Number(e.target.value); if (v !== value) onCommit(v); }}>
        {!known && <option value={value ?? ''}>{String(value ?? '—')}</option>}
        {options.map(o => <option key={o.id} value={field.kind === 'bool' ? (o.id ? '1' : '0') : o.id}>{o.label}</option>)}
      </select>
    </label>
  );
}

/** Identity form: names, nationality (with country names), body, foot and registered position. */
export function IdentityForm({ fieldOf, get, canEdit, isModified, commit, countries }) {
  const countryOptions = countries.map(c => ({ id: c.id, label: c.name }));
  const SELECTS = {
    country: [{ id: 0, label: 'Sin país' }, ...countryOptions],
    country2: [{ id: 0, label: 'Ninguna' }, ...countryOptions],
    strongFootLeft: [{ id: 0, label: 'Derecho' }, { id: 1, label: 'Izquierdo' }],
    registeredPosition: POSITION_OPTIONS,
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {IDENTITY_FIELDS.map(name => {
        const field = fieldOf(name);
        if (!field) return null;
        const options = SELECTS[name];
        const value = get(name);
        if (options && (name !== 'country' && name !== 'country2' || countries.length)) {
          return (
            <SelectField key={name} label={FIELD_LABELS[name]} field={field} options={options} canEdit={canEdit}
              value={field.kind === 'bool' ? (value ? 1 : 0) : value} modified={isModified(name)}
              onCommit={v => commit(name, field.kind === 'bool' ? Boolean(v) : v)} />
          );
        }
        return (
          <FieldInput key={name} field={field} value={value} readOnly={!canEdit} label={FIELD_LABELS[name]}
            modified={isModified(name)} onCommit={v => commit(name, v)} />
        );
      })}
    </div>
  );
}

/** Pitch map of the 13 aptitudes (PlayerModal layout). Clicking a position cycles C → B → A. */
export function PositionMap({ fieldOf, get, canEdit, isModified, commit }) {
  const registered = positionName(get('registeredPosition'));
  return (
    <div className="rounded-xl bg-canvas border border-line/10 p-3">
      <div className="grid grid-cols-3 grid-rows-7 gap-1.5 max-w-[15rem] mx-auto" role="group" aria-label="Aptitud por posición">
        {POSITION_FIELDS.map(({ field: name, pos, col, row }) => {
          const field = fieldOf(name);
          if (!field) return null;
          const apt = Number(get(name)) || 0;
          const { bgColor, textColor } = getPosColor(apt ? apt + 1 : 0);
          const locked = isLocked(field, canEdit) || pos === registered;
          const label = `${pos}: aptitud ${APTITUDE_LABEL[apt] || apt}${pos === registered ? ' (posición registrada)' : ''}`;
          return (
            <button key={name} type="button" disabled={locked} title={label} aria-label={locked ? label : `${label}. Cambiar`}
              onClick={() => commit(name, (apt + 1) % 3)}
              style={{ gridColumn: col, gridRow: row, backgroundColor: bgColor, color: textColor }}
              className={`relative min-h-9 rounded-lg text-[11px] font-bold transition-transform enabled:hover:scale-105 disabled:cursor-default
                ${pos === registered ? 'ring-2 ring-ink ring-offset-2 ring-offset-canvas' : ''} ${isModified(name) ? 'outline outline-2 outline-accent-soft' : ''}`}>
              {pos}<span className="ml-1 opacity-70">{APTITUDE_LABEL[apt]}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-center text-[11px] text-ink-3">A verde · B lima · C gris. Tocá una posición para cambiarla.</p>
    </div>
  );
}

/** One attribute: Spanish name, bar on the stat colour scale, number input. */
function StatRow({ field, value, canEdit, modified, onCommit }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  const locked = isLocked(field, canEdit);
  const { min, max } = fieldRange(field);
  const scaleMin = field.addend === 40 ? 40 : min;
  const scaleMax = field.addend === 40 ? 99 : max;
  const pct = Math.max(4, Math.min(100, ((Number(value) - scaleMin) / (scaleMax - scaleMin)) * 100));
  const tone = statTone(field.name, value, getStatAndOvrColorClass);
  const commit = () => { const v = Number(draft); if (Number.isFinite(v) && v !== value) onCommit(Math.max(min, Math.min(max, v))); else setDraft(value); };
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_3.25rem] items-center gap-x-3 py-1.5">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-sm text-ink-2">
          {locked && canEdit && <Lock className="w-3 h-3 text-ink-3 shrink-0" aria-label="Solo lectura: significado sin verificar" />}
          <span className={`truncate ${modified ? 'text-accent-soft' : ''}`}>{statLabel(field.name)}</span>
          {modified && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" aria-label="modificado" />}
        </div>
        <div className="mt-1 h-1 rounded-full bg-white/[0.06] overflow-hidden" aria-hidden="true">
          <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <input type="number" inputMode="numeric" min={min} max={max} value={draft ?? ''} disabled={locked}
        aria-label={`${statLabel(field.name)} (${min}–${max})`}
        onChange={e => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setDraft(value); }}
        className={`${tone} w-full h-8 rounded-md text-center font-display num text-base font-bold border-0 outline-none
          focus:ring-2 focus:ring-accent-soft disabled:opacity-80 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none`} />
    </div>
  );
}

/** Attribute groups of the player card (field players or goalkeepers). */
export function StatGroups({ fields, get, canEdit, isModified, commit, goalkeeper }) {
  const groups = statGroups(fields, goalkeeper);
  return (
    <div className="grid gap-x-8 gap-y-6 md:grid-cols-2 2xl:grid-cols-3">
      {groups.map(([title, list]) => (
        <section key={title} aria-label={title}>
          <h3 className="eyebrow pb-2 mb-1 border-b border-line/[0.08]">{title}</h3>
          {list.map(f => (
            <StatRow key={f.name} field={f} value={get(f.name)} canEdit={canEdit} modified={isModified(f.name)} onCommit={v => commit(f.name, v)} />
          ))}
        </section>
      ))}
    </div>
  );
}
