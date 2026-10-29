import React, { memo, useState } from 'react';
import { ArrowLeftRight, Lock, Star } from 'lucide-react';
import { getFlagUrl, formatPriceShort, formatPriceCompact, getPosColorClass, getStatAndOvrColorClass } from '../utils/helpers.js';
import { playerPlaceholder } from '../utils/playerPlaceholder.js';

// Photos that already failed (404) stay on the placeholder across remounts while scrolling the virtual grid.
const brokenImageIds = new Set();

const ICON_BUTTON = 'relative w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-colors before:absolute before:-inset-1.5 before:content-[""]';

/**
 * Marketplace player card (docs/DESIGN_SYSTEM.md: square photo, OVR in the stat colour, position colour).
 * The whole card is one "open" button; wishlist and compare are sibling buttons above it, never nested.
 * States: owned = accent border + "En tu plantel"; comparing = accent ring; locked = dimmed photo + buyer crest.
 */
export const PlayerCard = memo(function PlayerCard({
  player,
  onSelectPlayer,
  isInMyCart,
  isLockedByOther,
  lockedTeamName,
  lockedTeamLogo,
  onCompare,
  isComparing,
  isWishlisted,
  onToggleWishlist,
  density = 'comfortable',
}) {
  const [hasPhotoError, setHasPhotoError] = useState(() => brokenImageIds.has(player.Id));
  const ovr = player.OVR_CALCULADO || 0;
  const isCompact = density === 'compact';
  const flagUrl = getFlagUrl(player.Country1);

  const stateLabel = isInMyCart ? 'en tu plantel' : isLockedByOther ? `fichado por ${lockedTeamName || 'otro club'}` : 'disponible';
  const frameClass = isInMyCart
    ? 'border-accent/70'
    : 'border-line/[0.12] hover:border-line/30';
  const ringClass = isComparing ? 'ring-2 ring-accent ring-offset-2 ring-offset-canvas' : '';

  const compareButton = (
    <button
      type="button"
      onClick={(event) => onCompare?.(player, event)}
      aria-label={isComparing ? `Quitar a ${player.Name} del comparador` : `Comparar a ${player.Name}`}
      aria-pressed={Boolean(isComparing)}
      title={isComparing ? 'Quitar del comparador' : 'Comparar'}
      className={`${ICON_BUTTON} ${isComparing ? 'bg-accent text-on-accent' : 'bg-canvas/80 text-ink-2 hover:text-ink hover:bg-canvas'}`}
    >
      <ArrowLeftRight className="w-4 h-4" aria-hidden="true" />
    </button>
  );

  return (
    <article data-market-card className={`group relative flex flex-col h-full rounded-xl border bg-surface hover:bg-raised transition-colors ${frameClass} ${ringClass}`}>
      <button
        type="button"
        onClick={() => onSelectPlayer?.(player.Id)}
        aria-label={`Ver ficha de ${player.Name}, ${player.POS_NOMBRE}, media ${ovr}, ${formatPriceShort(player.Precio)}, ${stateLabel}`}
        className="absolute inset-0 z-[1] rounded-xl"
      />

      <div className="relative aspect-square overflow-hidden rounded-t-[11px] bg-raised pointer-events-none">
        <img
          src={hasPhotoError ? playerPlaceholder(player.Name?.substring(0, 2) ?? '?') : `/fotos_jugadores/${player.Id}.webp`}
          alt=""
          loading="lazy"
          decoding="async"
          width="200"
          height="200"
          onError={() => { brokenImageIds.add(player.Id); setHasPhotoError(true); }}
          className={`w-full h-full object-cover object-top ${isLockedByOther ? 'opacity-35 grayscale' : ''}`}
        />
        <span data-card-ovr className={`absolute left-1.5 top-1.5 min-w-8 h-8 px-1 rounded-md flex items-center justify-center font-display num text-lg font-bold leading-none ${getStatAndOvrColorClass(ovr)}`}>
          {ovr}
        </span>
        <span data-card-pos className={`absolute left-1.5 bottom-1.5 px-1.5 py-0.5 rounded text-[11px] font-bold leading-tight ${getPosColorClass(player.POS_NOMBRE)}`}>
          {player.POS_NOMBRE}
        </span>
        {isLockedByOther && (
          <div className="absolute inset-0 flex items-center justify-center">
            {lockedTeamLogo
              ? <img src={lockedTeamLogo} alt="" width={56} height={56} className="w-1/3 aspect-square object-contain" />
              : <Lock className="w-1/4 h-auto text-ink-2" aria-hidden="true" />}
          </div>
        )}
      </div>

      <div className="absolute right-1.5 top-1.5 z-[2] flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => onToggleWishlist?.(player.Id)}
          aria-label={isWishlisted ? `Quitar a ${player.Name} de favoritos` : `Agregar a ${player.Name} a favoritos`}
          aria-pressed={Boolean(isWishlisted)}
          title={isWishlisted ? 'Quitar de favoritos' : 'Agregar a favoritos'}
          className={`${ICON_BUTTON} bg-canvas/80 ${isWishlisted ? 'text-warning-soft' : 'text-ink-2 hover:text-ink hover:bg-canvas'}`}
        >
          <Star className="w-4 h-4" fill={isWishlisted ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
        {!isLockedByOther && !isCompact && compareButton}
      </div>

      <div className="flex-1 flex flex-col justify-between gap-1 p-2 sm:p-2.5 min-w-0 pointer-events-none">
        <h3 data-card-name className="text-sm font-semibold text-ink truncate">{player.Name}</h3>
        <div className="flex items-center justify-between gap-2 min-w-0">
          <span data-card-price className="font-display num text-base font-semibold text-ink whitespace-nowrap">{formatPriceCompact(player.Precio)}</span>
          {/* Compact cards are ~100 px wide on phones: compare sits here instead of stacking over the photo. */}
          {isCompact && !isLockedByOther && <span className="relative z-[2] pointer-events-auto">{compareButton}</span>}
          {!isCompact && (
            isInMyCart ? (
              <span className="text-xs font-semibold text-accent-soft truncate">En tu plantel</span>
            ) : isLockedByOther ? (
              <span className="flex items-center gap-1 text-xs text-ink-3 min-w-0">
                <Lock className="w-3 h-3 shrink-0" aria-hidden="true" /><span className="truncate">{lockedTeamName || 'Fichado'}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-ink-3 whitespace-nowrap">
                {flagUrl && <img src={flagUrl} alt="" width={16} height={12} className="w-4 h-3 rounded-[2px] object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                <span className="num">{player.Age}</span> años
              </span>
            )
          )}
        </div>
      </div>
    </article>
  );
});
