import React, { memo } from 'react';
import { getPosColorClass, getStatAndOvrColorClass, formatPriceShort } from '../../utils/helpers.js';
import { playerPlaceholder } from '../../utils/playerPlaceholder.js';

/**
 * Squad list in the shape of PES's game plan: one row per player, led by the role he plays in its position colour,
 * then shirt number, photo, name and OVR. Starters come first in pitch order, then the substitutes. Used read-only by
 * the public club page (screens/TeamScreen.jsx) and with controls by the tactics board (components/FormationModal.jsx).
 */
export function SquadSection({ title, count, hint, action, children }) {
  return (
    <section className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1 pt-4 pb-2 border-b border-line/[0.12]">
        <h3 className="eyebrow">
          {title}
          {count != null && <span className="num ml-1.5 text-ink-2">{count}</span>}
        </h3>
        {hint && <p className="text-xs text-ink-3">{hint}</p>}
        {action}
      </div>
      <ul>{children}</ul>
    </section>
  );
}

const priceOf = player => Number(player?.Precio || player?.Valor || player?.Price) || 0;

function rowMeta(player, role, isUnavailable) {
  const parts = [];
  if (player?.POS_NOMBRE && player.POS_NOMBRE !== role) parts.push(`Natural ${player.POS_NOMBRE}`);
  if (priceOf(player) > 0) parts.push(formatPriceShort(priceOf(player)));
  return { text: parts.join(' · '), isUnavailable };
}

/**
 * `role`: the slot's role for a starter, the natural position for a substitute. `number`: the shirt number column
 * (left out when the number is edited in `trailing`). `onSelect` makes the player part of the row a button.
 */
export const SquadRow = memo(function SquadRow({
  role, player, number, isUnavailable = false, isFranchise = false, isSelected = false, onSelect, selectLabel,
  disabledReason, trailing, emptyLabel = 'Puesto vacío', showPhoto = true,
}) {
  const ovr = Number(player?.OVR_CALCULADO) || 0;
  const meta = rowMeta(player, role, isUnavailable);
  const body = (
    <>
      {!showPhoto ? null : player ? (
        <img
          src={`/fotos_jugadores/${player.Id}.webp`}
          alt=""
          width={36}
          height={36}
          loading="lazy"
          className="w-9 h-9 shrink-0 rounded-md object-cover object-top bg-raised"
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = playerPlaceholder(player.Name?.[0] || '?'); }}
        />
      ) : (
        <span className="w-9 h-9 shrink-0 rounded-md border border-dashed border-line/30" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1">
        <span title={player?.Name} className={`block truncate text-sm font-semibold leading-tight ${player ? 'text-ink' : 'text-ink-3'}`}>
          {player ? player.Name : emptyLabel}
        </span>
        {(meta.text || isUnavailable || isFranchise) && (
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3 min-w-0">
            {/* The league's mark (crest lavender): he cannot be sold or transferred. */}
            {isFranchise && (
              <span className="shrink-0 rounded-md border border-crest/60 px-1.5 font-semibold leading-[1.15rem] text-crest-soft">Franquicia</span>
            )}
            {meta.text && <span className="num truncate">{meta.text}</span>}
            {isUnavailable && <span className="font-semibold text-danger-soft shrink-0">Baja</span>}
          </span>
        )}
      </span>
      {ovr > 0 && (
        <span className={`w-9 h-7 shrink-0 rounded-md flex items-center justify-center font-display num text-base font-bold ${getStatAndOvrColorClass(ovr)}`}>
          <span className="sr-only">OVR </span>{ovr}
        </span>
      )}
    </>
  );

  return (
    <li className={`flex items-center gap-2 min-h-12 px-1 py-1 border-b border-line/[0.07] last:border-b-0 transition-colors
      ${isSelected ? 'bg-accent/15 ring-1 ring-inset ring-accent/60 rounded-lg' : 'hover:bg-white/[0.025]'}`}>
      <span className={`w-10 shrink-0 rounded-md py-1 text-center font-display text-sm font-bold leading-none
        ${player ? getPosColorClass(role) : 'border border-line/30 text-ink-2'}`}>
        {role}
      </span>
      {number !== undefined && (
        <span className="w-7 shrink-0 flex justify-center font-display num text-base font-semibold text-ink-2">{number}</span>
      )}
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={isSelected}
          aria-label={selectLabel}
          disabled={Boolean(disabledReason)}
          title={disabledReason}
          className="flex items-center gap-2.5 min-w-0 flex-1 min-h-11 rounded-md text-left disabled:cursor-not-allowed"
        >
          {body}
        </button>
      ) : (
        <div className="flex items-center gap-2.5 min-w-0 flex-1 min-h-11">{body}</div>
      )}
      {trailing}
    </li>
  );
});
