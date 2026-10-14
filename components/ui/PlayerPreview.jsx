import React from 'react';
import { getFlagUrl, formatPriceShort } from '../../utils/helpers.js';

// Same scale as the stat badges (index.css .stat-c-*): stat colours are football semantics.
const getStatColor = (val) => {
  if (val >= 90) return 'text-[#1ec9a4]';
  if (val >= 80) return 'text-[#a0dd00]';
  if (val >= 70) return 'text-[#ffc400]';
  if (val >= 60) return 'text-[#ec7d22]';
  return 'text-ink-3';
};

const getOvrColorClass = (ovr) => {
  if (ovr >= 90) return 'bg-[#1ec9a4]/20 text-[#1ec9a4] border border-[#1ec9a4]/40';
  if (ovr >= 85) return 'bg-[#a0dd00]/20 text-[#a0dd00] border border-[#a0dd00]/40';
  if (ovr >= 75) return 'bg-[#ffc400]/20 text-[#ffc400] border border-[#ffc400]/40';
  if (ovr >= 65) return 'bg-[#ec7d22]/20 text-[#ec7d22] border border-[#ec7d22]/40';
  return 'bg-white/[0.06] text-ink-3 border border-line/25';
};

export function PlayerPreview({ player, isVisible, position, onOpenProfile }) {
  if (!player) return null;

  const isGK = player.POS_NOMBRE === 'PT';
  const flagUrl = getFlagUrl(player.Country1);

  const stats = isGK ? [
    { label: 'ATA', value: player.GKCatching },
    { label: 'DES', value: player.GKClearing },
    { label: 'REF', value: player.GKReflexes },
    { label: 'EST', value: player.GKReach },
    { label: 'COB', value: player.GKCoverage },
    { label: 'SAQ', value: player.GKParrying },
  ] : [
    { label: 'VEL', value: player.Speed },
    { label: 'TIR', value: player.Finishing },
    { label: 'PAS', value: player.LowPass },
    { label: 'REG', value: player.Dribbling },
    { label: 'DEF', value: player.BallWinning },
    { label: 'FIS', value: player.Stamina },
  ];

  return (
    <div
      className={`fixed z-50 bg-surface border border-line/[0.12] rounded-xl shadow-2xl p-3 w-56 transition-all duration-200 ${
        isVisible ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
      }`}
      style={{ top: position.top, left: position.left }}
    >
      <div className="flex items-center gap-3 border-b border-line/[0.12] pb-2 mb-2">
        <img
          src={`/fotos_jugadores/${player.Id}.webp`}
          alt={player.Name}
          className="w-12 h-12 object-cover rounded-full bg-black/20"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = `https://placehold.co/48x48/111/333?text=${player.Name?.substring(0, 2)}`;
          }}
        />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-ink truncate text-sm">{player.Name}</div>
          <div className="flex items-center gap-1.5 text-xs mt-0.5">
            <span className={`px-1 rounded text-[10px] font-bold ${getOvrColorClass(player.OVR_CALCULADO)}`}>
              {player.OVR_CALCULADO}
            </span>
            <span className="text-ink-3 font-semibold">{player.POS_NOMBRE}</span>
            <span className="text-ink-3">•</span>
            <span className="text-ink-3">{player.Age}</span>
            <img src={flagUrl} alt="" className="w-3.5 h-2.5 rounded-sm ml-0.5 opacity-90" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 mb-3">
        {stats.map((stat, i) => (
          <div key={i} className="flex justify-between items-center text-xs bg-white/5 px-2 py-1 rounded">
            <span className="text-ink-3 font-bold">{stat.label}</span>
            <span className={`font-bold ${getStatColor(stat.value)}`}>{stat.value || 0}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-line/[0.12]">
        <span className="text-success-soft font-bold text-sm tracking-tight">
          {formatPriceShort(player.Precio)}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onOpenProfile) onOpenProfile(player.Id);
          }}
          className="text-[10px] font-bold text-accent hover:text-accent-soft transition-colors uppercase tracking-wider"
        >
          Ver perfil completo →
        </button>
      </div>
    </div>
  );
}
