import React, { memo } from 'react';
import { Copy, RotateCcw, Shuffle } from 'lucide-react';
import { TACTICAL_STATES } from '../../utils/formationStates.js';

/**
 * Inicio de partido / Con pelota / Sin pelota selector with the fluid-formation switch. With the switch off
 * the team keeps the starting formation all match (as in PES 2021), so the other two states are not editable.
 * "Cambiar posiciones" turns the markers into role pickers (components/formation/PositionPicker.jsx).
 */
export const TacticalStateBar = memo(function TacticalStateBar({ active, fluid, onSelect, onFluidChange, onCopyBase, onReset, movedCount, roleMode = false, onRoleModeChange }) {
  return (
    <div className="flex flex-col gap-2 px-2 lg:px-4 pt-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="tab-list flex-1 min-w-0" role="tablist" aria-label="Estado táctico">
          {TACTICAL_STATES.map(s => {
            const enabled = s.id === 'base' || fluid;
            return (
              <button key={s.id} type="button" role="tab" aria-selected={active === s.id} disabled={!enabled} onClick={() => onSelect(s.id)}
                title={enabled ? undefined : 'Activá la formación fluida para usar este estado'}
                className="tab flex-1 justify-center text-xs sm:text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                <span className="sm:hidden">{s.short}</span><span className="hidden sm:inline">{s.label}</span>
              </button>
            );
          })}
        </div>
        <label className="inline-flex items-center gap-2 text-xs font-medium text-ink-2 cursor-pointer select-none">
          <input type="checkbox" role="switch" aria-checked={fluid} checked={fluid} onChange={e => onFluidChange(e.target.checked)} className="accent-[rgb(var(--c-accent))] w-4 h-4" />
          Formación fluida
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-3">
        <p className="hidden sm:block">
          {fluid
            ? roleMode
              ? `Tocá un jugador para cambiar su posición en «${TACTICAL_STATES.find(s => s.id === active)?.label}».`
              : `Editando «${TACTICAL_STATES.find(s => s.id === active)?.label}». Arrastrá a los jugadores; cada estado guarda sus posiciones y roles.`
            : roleMode
              ? 'Tocá un jugador para cambiar su posición.'
              : 'Sin formación fluida el equipo juega todo el partido con la formación de inicio.'}
        </p>
        <div className="flex gap-1 ml-auto">
          {onRoleModeChange && (
            <button type="button" onClick={() => onRoleModeChange(!roleMode)} aria-pressed={roleMode}
              className={`btn btn-sm ${roleMode ? 'btn-primary' : 'btn-ghost'}`}>
              <Shuffle className="w-3.5 h-3.5" aria-hidden="true" />{roleMode ? 'Listo' : 'Cambiar posiciones'}
            </button>
          )}
          {fluid && active !== 'base' && (
            <button type="button" onClick={onCopyBase} className="btn btn-ghost btn-sm"><Copy className="w-3.5 h-3.5" aria-hidden="true" />Copiar de Inicio</button>
          )}
          <button type="button" onClick={onReset} disabled={!movedCount} className="btn btn-ghost btn-sm disabled:opacity-40">
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />Restablecer
          </button>
        </div>
      </div>
    </div>
  );
});
