import React, { memo } from 'react';
import { X } from 'lucide-react';
import { Alert } from '../ui/Alert.jsx';
import { getPosColorClass } from '../../utils/helpers.js';
import { OUTFIELD_ROLES, zoneAt, rolesAt, roleUnavailableReason } from '../../utils/positionRules.js';

/**
 * Role choice for one slot of the tactical state being edited. Which roles are offered depends only on where the
 * slot stands (utils/positionRules.js); the others are shown disabled with the reason, as the game greys them out.
 * @param {{ slot: { pos: string, x: number, y: number }, player?: object, stateLabel: string, notice?: string,
 *   onChange: (role: string) => void, onClose: () => void }} props
 */
export const PositionPicker = memo(function PositionPicker({ slot, player, stateLabel, notice, onChange, onClose }) {
  const zone = zoneAt(slot);
  const allowed = rolesAt(slot);
  const who = player?.Name || 'Puesto vacío';
  return (
    <section aria-label={`Posición de ${who}`} className="mx-2 lg:mx-4 mt-2 rounded-xl border border-line/[0.14] bg-raised px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink truncate">
            {who}
            {player?.POS_NOMBRE && <span className="text-ink-3 font-normal"> · posición natural {player.POS_NOMBRE}</span>}
          </p>
          <p className="text-xs text-ink-3">{stateLabel} · zona: {zone.label}</p>
        </div>
        <button type="button" onClick={onClose} className="btn btn-ghost btn-icon btn-sm shrink-0" aria-label="Cerrar cambio de posición">
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Posiciones disponibles">
        {OUTFIELD_ROLES.map(role => {
          const reason = roleUnavailableReason(role.id, slot);
          const current = slot.pos === role.id;
          return (
            <button key={role.id} type="button" disabled={Boolean(reason)} aria-pressed={current}
              onClick={() => onChange(role.id)}
              title={reason || `${role.label} (${role.en})`}
              className={`min-h-11 min-w-11 px-2.5 rounded-lg border text-xs font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed
                ${current ? `${getPosColorClass(role.id)} border-accent ring-2 ring-accent` : 'border-line/20 bg-surface text-ink-2 enabled:hover:border-line/40 enabled:hover:text-ink'}`}>
              {role.id}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-ink-3">
        En esta zona el juego permite {allowed.join(' o ')}. Para otra posición, mové al jugador a su zona.
      </p>
      {notice && <Alert tone="warning" className="mt-2">{notice}</Alert>}
    </section>
  );
});
