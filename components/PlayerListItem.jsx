import React, { memo } from 'react';
import { ArrowLeftRight, Lock, Star } from 'lucide-react';
import { getPosColorClass, getStatAndOvrColorClass, getFlagUrl, formatPriceShort, formatPriceCompact } from '../utils/helpers.js';
import { playerPlaceholder } from '../utils/playerPlaceholder.js';

const FIELD_STATS = [['VEL', 'Speed'], ['TIR', 'Finishing'], ['PAS', 'LowPass'], ['REG', 'Dribbling']];
const GK_STATS = [['ATA', 'GKCatching'], ['DES', 'GKClearing'], ['REF', 'GKReflexes'], ['EST', 'GKReach']];

const ICON_BUTTON = 'relative z-[2] min-w-11 min-h-11 rounded-lg flex items-center justify-center transition-colors';

/**
 * Marketplace list row. Like PlayerCard, the row is one "open" button with wishlist and compare as sibling
 * buttons above it. Players signed by another club stay openable (their sheet offers a transfer proposal).
 */
export const PlayerListItem = memo(function PlayerListItem({
  player, onSelectPlayer, isInMyCart, isLockedByOther, lockedTeamName, lockedTeamLogo, onCompare, isComparing, isWishlisted, onToggleWishlist,
}) {
  const ovr = player.OVR_CALCULADO || 0;
  const isGK = player.POS_NOMBRE === 'PT' || player.Grupo === 'Arqueros';
  const flagUrl = getFlagUrl(player.Country1);
  const stateLabel = isInMyCart ? 'en tu plantel' : isLockedByOther ? `fichado por ${lockedTeamName || 'otro club'}` : 'disponible';
  const frameClass = isInMyCart ? 'border-accent/70' : 'border-line/[0.12] hover:border-line/30';
  const ringClass = isComparing ? 'ring-2 ring-accent ring-offset-2 ring-offset-canvas' : '';

  return (
    <div data-market-row className={`group relative flex items-center gap-3 p-2 sm:p-2.5 rounded-xl border bg-surface hover:bg-raised transition-colors ${frameClass} ${ringClass}`}>
      <button
        type="button"
        onClick={() => onSelectPlayer?.(player.Id)}
        aria-label={`Ver ficha de ${player.Name}, ${player.POS_NOMBRE}, media ${ovr}, ${formatPriceShort(player.Precio)}, ${stateLabel}`}
        className="absolute inset-0 z-[1] rounded-xl"
      />

      <div className="relative shrink-0 pointer-events-none">
        <img
          src={`/fotos_jugadores/${player.Id}.webp`}
          alt=""
          loading="lazy"
          decoding="async"
          width={48}
          height={48}
          className={`w-12 h-12 object-cover object-top rounded-lg bg-raised ${isLockedByOther ? 'opacity-35 grayscale' : ''}`}
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = playerPlaceholder(player.Name?.substring(0, 1) ?? '?'); }}
        />
        <span className={`absolute -bottom-1.5 -right-1.5 min-w-7 h-6 px-1 rounded-md flex items-center justify-center font-display num text-sm font-bold leading-none ${getStatAndOvrColorClass(ovr)}`}>
          {ovr}
        </span>
      </div>

      <div className="flex-1 min-w-0 pl-1 pointer-events-none">
        <p className="text-sm sm:text-base font-semibold text-ink truncate">{player.Name}</p>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-ink-3 min-w-0">
          <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold leading-tight shrink-0 ${getPosColorClass(player.POS_NOMBRE)}`}>{player.POS_NOMBRE}</span>
          {/* On phones the price lives here, so the name keeps the row's width. */}
          <span className="sm:hidden font-display num text-sm font-semibold text-ink whitespace-nowrap">{formatPriceCompact(player.Precio)}</span>
          {isInMyCart ? (
            <span className="font-semibold text-accent-soft truncate">En tu plantel</span>
          ) : isLockedByOther ? (
            <span className="flex items-center gap-1 min-w-0">
              {lockedTeamLogo
                ? <img src={lockedTeamLogo} alt="" width={14} height={14} className="w-3.5 h-3.5 object-contain shrink-0" />
                : <Lock className="w-3 h-3 shrink-0" aria-hidden="true" />}
              <span className="truncate">{lockedTeamName || 'Fichado'}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 whitespace-nowrap min-w-0">
              {flagUrl && <img src={flagUrl} alt="" width={16} height={12} className="w-4 h-3 rounded-[2px] object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />}
              <span className="hidden sm:inline"><span className="num">{player.Age}</span> años</span>
              <span className="hidden sm:inline"><span className="num">{player.Height}</span> cm</span>
            </span>
          )}
        </div>
      </div>

      <dl className="hidden md:flex items-center gap-3 px-2 pointer-events-none" aria-label="Atributos principales">
        {(isGK ? GK_STATS : FIELD_STATS).map(([label, key]) => (
          <div key={key} className="flex flex-col items-center gap-0.5 w-10">
            <dt className="text-[11px] font-semibold text-ink-3">{label}</dt>
            <dd className={`min-w-8 px-1 rounded font-display num text-sm font-bold text-center ${getStatAndOvrColorClass(player[key])}`}>{player[key] ?? '–'}</dd>
          </div>
        ))}
      </dl>

      <span className="hidden sm:inline font-display num text-lg font-semibold text-ink whitespace-nowrap pointer-events-none">{formatPriceCompact(player.Precio)}</span>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onToggleWishlist?.(player.Id)}
          aria-label={isWishlisted ? `Quitar a ${player.Name} de favoritos` : `Agregar a ${player.Name} a favoritos`}
          aria-pressed={Boolean(isWishlisted)}
          title={isWishlisted ? 'Quitar de favoritos' : 'Agregar a favoritos'}
          className={`${ICON_BUTTON} ${isWishlisted ? 'text-warning-soft' : 'text-ink-3 hover:text-ink hover:bg-white/[0.05]'}`}
        >
          <Star className="w-5 h-5" fill={isWishlisted ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
        {!isLockedByOther ? (
          <button
            type="button"
            onClick={(event) => onCompare?.(player, event)}
            aria-label={isComparing ? `Quitar a ${player.Name} del comparador` : `Comparar a ${player.Name}`}
            aria-pressed={Boolean(isComparing)}
            title={isComparing ? 'Quitar del comparador' : 'Comparar'}
            className={`${ICON_BUTTON} ${isComparing ? 'bg-accent text-on-accent' : 'text-ink-3 hover:text-ink hover:bg-white/[0.05]'}`}
          >
            <ArrowLeftRight className="w-[18px] h-[18px]" aria-hidden="true" />
          </button>
        ) : (
          // Keeps price and star aligned with the other rows when compare is not offered.
          <span className="min-w-11" aria-hidden="true" />
        )}
      </div>
    </div>
  );
});
