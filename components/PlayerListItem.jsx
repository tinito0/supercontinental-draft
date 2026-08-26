import React, { memo } from 'react';
import { Lock, ArrowLeftRight, Star } from 'lucide-react';
import { getPosColorClass, getStatAndOvrColorClass, getFlagUrl, formatPriceShort } from '../utils/helpers.js';

const getStatTextColor = (val) => {
  const v = Number(val);
  if (v >= 90) return 'text-cyan-400';
  if (v >= 80) return 'text-green-400';
  if (v >= 70) return 'text-yellow-400';
  if (v >= 60) return 'text-orange-400';
  return 'text-red-400';
};

const StatItem = ({ label, value }) => (
  <div className="flex flex-col items-center justify-center w-12 group/stat cursor-default">
    <span className={`text-base font-black leading-none mb-0.5 drop-shadow-md transition-transform group-hover/stat:scale-110 duration-200 ${getStatTextColor(value)}`}>
      {value}
    </span>
    <span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest group-hover/stat:text-gray-300 transition-colors">
      {label}
    </span>
  </div>
);

const VerticalDivider = () => <div className="w-px h-5 bg-gray-700/50 mx-0.5" />;

export const PlayerListItem = memo(function PlayerListItem({ player, countryMap, onSelectPlayer, isInMyCart, isLockedByOther, lockedTeamName, lockedTeamLogo, onCompare, isComparing, isWishlisted, onToggleWishlist }) {
  const posClass = getPosColorClass(player.POS_NOMBRE);
  const ovrColorClass = getStatAndOvrColorClass(player.OVR_CALCULADO);
  const countryFlagUrl = getFlagUrl(player.Country1);

  const isGK = player.POS_NOMBRE === 'PT' || player.Grupo === 'Arqueros';

  return (
    <div
      onClick={() => onSelectPlayer?.(player.Id)}
      className={`
        group flex items-center justify-between p-2.5 rounded-xl transition-all duration-200 cursor-pointer relative overflow-hidden
        ${isLockedByOther ? 'opacity-50 grayscale-[0.5]' : isInMyCart ? 'bg-emerald-900/10 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.1)]' : 'border border-white/5 hover:bg-white/[0.04] hover:-translate-y-px'}`}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

      {/* SECCIÓN IZQUIERDA: FOTO E INFO */}
      <div className="flex items-center space-x-3 flex-1 min-w-0 relative z-10">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleWishlist?.(player.Id); }}
          className={`p-1.5 rounded-full transition-all duration-200 shrink-0
            ${isWishlisted ? 'text-yellow-400 hover:text-yellow-300' : 'text-gray-500 hover:text-white'}`}
          title={isWishlisted ? "Quitar de Favoritos" : "Añadir a Favoritos"}
        >
          <Star className="w-5 h-5" fill={isWishlisted ? "currentColor" : "none"} />
        </button>

        <div className="relative flex-shrink-0">
          <img
            src={`/fotos_jugadores/${player.Id}.webp`}
            alt={player.Name}
            loading="lazy"
            decoding="async"
            className={`w-11 h-11 object-cover rounded-lg bg-gray-900 transition-colors shadow ${isInMyCart ? 'ring-1 ring-emerald-500/40' : ''}`}
            onError={(e) => e.target.src = `https://placehold.co/44x44/111/333?text=${player.Name.substring(0, 1)}`}
          />
          <div className={`absolute -bottom-1.5 -right-1.5 w-6 h-6 flex items-center justify-center rounded-full font-black text-[10px] !text-black shadow-md ring-2 ring-gray-800 ${ovrColorClass}`}>
            {player.OVR_CALCULADO}
          </div>
        </div>

        <div className="min-w-0 pl-1">
          <div className="flex items-center space-x-2 mb-0.5">
            <span className="font-bold text-white truncate text-sm sm:text-base group-hover:text-blue-200 transition-colors">{player.Name}</span>
            <img src={countryFlagUrl} className="w-3.5 h-2.5 rounded-sm shadow-sm opacity-90 hidden sm:block" onError={(e) => e.target.style.display = 'none'} />
          </div>
          <div className="flex items-center space-x-2 text-[10px] sm:text-xs text-gray-400 font-medium">
            <span className={`font-black px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] !text-black shadow-sm tracking-wide ${posClass}`}>
              {player.POS_NOMBRE}
            </span>
            <span className="hidden sm:inline text-gray-500">•</span>
            <span className="hidden sm:inline">{player.Age} años</span>
            <span className="hidden sm:inline text-gray-500">•</span>
            <span className="hidden sm:inline">{player.Height}cm</span>
          </div>
        </div>
      </div>

      {/* SECCIÓN CENTRAL: STATS */}
      <div className="hidden md:flex items-center px-4 mx-3 bg-black/30 rounded-xl py-1.5 border border-white/5 shadow-inner">
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
          <div className="text-emerald-400 font-black text-lg sm:text-xl tracking-tighter drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            {formatPriceShort(player.Precio)}
          </div>
          {isLockedByOther && (
            <div className="flex items-center justify-end text-[9px] text-red-300 bg-red-900/40 px-1.5 py-0.5 rounded mt-0.5 border border-red-900/50 backdrop-blur-sm -mr-1">
              {lockedTeamLogo ? (
                <img src={lockedTeamLogo} alt={lockedTeamName} className="w-3 h-3 object-contain mr-1 opacity-80" />
              ) : (
                <Lock size={8} className="mr-1" />
              )}
              <span className="truncate max-w-[70px] uppercase font-bold tracking-wider">{lockedTeamName}</span>
            </div>
          )}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onCompare && onCompare(player); }}
          className={`p-2.5 rounded-xl transition-all duration-200 ${isComparing ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] scale-110 border border-blue-500' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700 hover:border-gray-500'}`}
          title="Comparar"
        >
          <ArrowLeftRight size={16} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
});
