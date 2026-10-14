import React, { memo } from 'react';
import { Lock, ArrowLeftRight, Star } from 'lucide-react';
import { getPosColorClass, getStatAndOvrColorClass, getFlagUrl, formatPriceShort } from '../utils/helpers.js';

const getStatTextColor = (val) => {
  const v = Number(val);
  if (v >= 90) return 'text-accent';
  if (v >= 80) return 'text-success-soft';
  if (v >= 70) return 'text-warning-soft';
  if (v >= 60) return 'text-orange-400';
  return 'text-danger-soft';
};

const StatItem = ({ label, value }) => (
  <div className="flex flex-col items-center justify-center w-12 group/stat cursor-default">
    <span className={`text-base font-bold leading-none mb-0.5 drop-shadow-md transition-transform group-hover/stat:scale-110 duration-200 ${getStatTextColor(value)}`}>
      {value}
    </span>
    <span className="text-[8px] text-ink-3 font-bold uppercase tracking-widest group-hover/stat:text-ink-2 transition-colors">
      {label}
    </span>
  </div>
);

const VerticalDivider = () => <div className="w-px h-5 bg-overlay/50 mx-0.5" />;

export const PlayerListItem = memo(function PlayerListItem({ player, countryMap, onSelectPlayer, isInMyCart, isLockedByOther, lockedTeamName, lockedTeamLogo, onCompare, isComparing, isWishlisted, onToggleWishlist }) {
  const posClass = getPosColorClass(player.POS_NOMBRE);
  const ovrColorClass = getStatAndOvrColorClass(player.OVR_CALCULADO);
  const countryFlagUrl = getFlagUrl(player.Country1);

  const isGK = player.POS_NOMBRE === 'PT' || player.Grupo === 'Arqueros';

  return (
    <button
      type="button"
      onClick={() => onSelectPlayer?.(player.Id)}
      aria-label={`Ver detalles de ${player.Name}, posición ${player.POS_NOMBRE}, valoración ${player.OVR_CALCULADO}`}
      title={isLockedByOther ? 'Este jugador ya fue fichado por otro manager' : undefined}
      aria-disabled={isLockedByOther ? "true" : undefined}
      className={`
        w-full text-left
        group flex items-center justify-between p-2.5 rounded-xl transition-all duration-200 cursor-pointer relative overflow-hidden bg-surface
        active:scale-[0.98] active:bg-raised focus:outline-none focus:ring-1 focus:ring-accent
        ${isLockedByOther ? 'opacity-50 grayscale-[0.5] pointer-events-none' : isInMyCart ? 'bg-emerald-950/20 border border-success/30 shadow-[0_0_12px_rgba(16,185,129,0.1)]' : 'border border-line/[0.12] hover:border-white/[0.18] hover:bg-raised hover:-translate-y-px'}`}
    >

      {/* SECCIÓN IZQUIERDA: FOTO E INFO */}
      <div className="flex items-center space-x-3 flex-1 min-w-0 relative z-10">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleWishlist?.(player.Id); }}
          className={`min-w-[42px] min-h-[42px] p-2 flex items-center justify-center rounded-full transition-all duration-200 shrink-0
            ${isWishlisted ? 'text-warning-soft hover:text-warning-soft' : 'text-ink-3 hover:text-ink'}`}
          title={isWishlisted ? "Quitar de Favoritos" : "Añadir a Favoritos"}
          aria-label={isWishlisted ? `Quitar a ${player.Name} de Favoritos` : `Añadir a ${player.Name} a Favoritos`}
        >
          <Star className="w-5 h-5" fill={isWishlisted ? "currentColor" : "none"} />
        </button>

        <div className="relative flex-shrink-0">
          <img
            src={`/fotos_jugadores/${player.Id}.webp`}
            alt={player.Name}
            loading="lazy"
            decoding="async"
            className={`w-11 h-11 object-cover rounded-lg bg-surface transition-colors shadow ${isInMyCart ? 'ring-1 ring-emerald-500/40' : ''}`}
            onError={(e) => e.target.src = `https://placehold.co/44x44/111/333?text=${player.Name.substring(0, 1)}`}
          />
          <div className={`absolute -bottom-1.5 -right-1.5 w-6 h-6 flex items-center justify-center rounded-full font-bold text-[10px] !text-black shadow-md ring-2 ring-slate-800 ${ovrColorClass}`}>
            {player.OVR_CALCULADO}
          </div>
        </div>

        <div className="min-w-0 pl-1">
          <div className="flex items-center space-x-2 mb-0.5">
            <span className="font-bold text-ink truncate text-sm sm:text-base group-hover:text-accent transition-colors">{player.Name}</span>
            <img src={countryFlagUrl} className="w-3.5 h-2.5 rounded-sm shadow-sm opacity-90 hidden sm:block" onError={(e) => e.target.style.display = 'none'} />
          </div>
          <div className="flex items-center space-x-2 text-[10px] sm:text-xs text-ink-3 font-medium">
            <span className={`font-bold px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] !text-black shadow-sm tracking-wide ${posClass}`}>
              {player.POS_NOMBRE}
            </span>
            <span className="hidden sm:inline text-ink-3">•</span>
            <span className="hidden sm:inline">{player.Age} años</span>
            <span className="hidden sm:inline text-ink-3">•</span>
            <span className="hidden sm:inline">{player.Height}cm</span>
          </div>
        </div>
      </div>

      {/* SECCIÓN CENTRAL: STATS */}
      <div className="hidden md:flex items-center px-4 mx-3 bg-black/30 rounded-xl py-1.5 border border-line/[0.12] shadow-inner">
        {isGK ? (
          <>
            <StatItem label="ATA" value={player.GKCatching} /><VerticalDivider />
            <StatItem label="DES" value={player.GKClearing} /><VerticalDivider />
            <StatItem label="REF" value={player.GKReflexes} /><VerticalDivider />
            <StatItem label="EST" value={player.GKReach} />
          </>
        ) : (
          <>
            <StatItem label="VEL" value={player.Speed} /><VerticalDivider />
            <StatItem label="TIR" value={player.Finishing} /><VerticalDivider />
            <StatItem label="PAS" value={player.LowPass} /><VerticalDivider />
            <StatItem label="REG" value={player.Dribbling} />
          </>
        )}
      </div>

      {/* SECCIÓN DERECHA: PRECIO Y ACCIONES */}
      <div className="flex items-center space-x-4 flex-shrink-0 relative z-10 pl-2">
        <div className="text-right flex flex-col items-end justify-center">
          <div className="text-success-soft font-bold text-lg sm:text-xl tracking-tighter drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            {formatPriceShort(player.Precio)}
          </div>
          {isLockedByOther && (
            <div className="flex items-center justify-end text-[9px] text-danger-soft bg-red-900/40 px-1.5 py-0.5 rounded mt-0.5 border border-red-900/50 backdrop-blur-sm -mr-1">
              {lockedTeamLogo ? (
                <img src={lockedTeamLogo} alt={lockedTeamName} width={12} height={12} className="w-3 h-3 object-contain mr-1 opacity-80" />
              ) : (
                <Lock size={8} className="mr-1" />
              )}
              <span className="truncate max-w-[70px] uppercase font-bold tracking-wider">{lockedTeamName}</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onCompare && onCompare(player); }}
          className={`min-w-[42px] min-h-[42px] p-2 flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer ${isComparing ? 'bg-accent text-slate-950 shadow-[0_0_15px_rgba(58, 102, 196,0.5)] scale-105 border border-accent' : 'bg-raised text-ink-3 hover:bg-overlay hover:text-ink border border-line/20 hover:border-slate-500'}`}
          title="Comparar"
          aria-label={`Comparar estadísticas de ${player.Name}`}
        >
          <ArrowLeftRight size={17} strokeWidth={2.5} />
        </button>
      </div>
    </button>
  );
});
