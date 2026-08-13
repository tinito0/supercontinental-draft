import React, { memo, useMemo, useCallback } from 'react';
import { getPitchPosColors, POSITION_COLORS, getStatAndOvrColorClass } from '../utils/helpers.js';

export const PitchSlot = memo(({ pos, x, y, index, onSlotClick, lineup, cartById, holdingPlayer, dorsals, isReadOnly, readOnlySlots, isCapturing }) => {
  const playerId = lineup[index];
  const player = cartById.get(String(playerId));
  const isHoldingThis = holdingPlayer?.from === 'slot' && holdingPlayer.fromSlotIndex === index;
  const dorsal = player ? dorsals?.[player.Id] : null;

  // Onclick estable por slot: no se recrea en cada render de Pitch (evita romper el memo())
  const handleClick = useCallback(() => {
    if (!isReadOnly) onSlotClick?.(index);
  }, [isReadOnly, onSlotClick, index]);

  // Use shared position color system from helpers.js
  const colors = player ? getPitchPosColors(player.POS_NOMBRE) : POSITION_COLORS.none;
  const emptyColors = getPitchPosColors(pos);

  // For read-only public view with embedded slot data
  const rawReadOnlySlot = readOnlySlots?.[index];
  const readOnlySlotName = String(rawReadOnlySlot?.name || '').trim().toLowerCase();
  const readOnlySlot = rawReadOnlySlot?.playerId
    && rawReadOnlySlot?.ovr > 0
    && readOnlySlotName
    && readOnlySlotName !== 'desconocido'
      ? rawReadOnlySlot
      : null;

  // Get last name, max 10 chars
  const getLastName = (name) => {
    if (!name) return '?';
    const parts = name.split(' ');
    const last = parts.length > 1 ? parts[parts.length - 1] : parts[0];
    return last.length > 10 ? last.substring(0, 9) + '.' : last;
  };

  const playerName = player ? getLastName(player.Name) : readOnlySlot ? getLastName(readOnlySlot.name) : null;
  const playerOvr = player ? player.OVR_CALCULADO : readOnlySlot?.ovr;
  const playerDorsal = dorsal || readOnlySlot?.dorsal;
  const playerImageId = player?.Id || readOnlySlot?.playerId;
  const hasPlayer = player || readOnlySlot;
  const ovrColorClass = getStatAndOvrColorClass(playerOvr);

  // Compute colors for readOnly slots based on position
  const slotColors = player ? colors : readOnlySlot ? getPitchPosColors(readOnlySlot.pos || pos) : POSITION_COLORS.none;

  return (
    <div
      onClick={!isReadOnly ? handleClick : undefined}
      className={`absolute flex flex-col items-center justify-center transition-all duration-200 z-20 group
        ${isHoldingThis ? 'opacity-30 scale-90' : ''}
        ${holdingPlayer && !isHoldingThis ? 'hover:scale-110' : ''}
        ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}
      `}
      style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)', width: '76px' }}
      title={player ? player.Name : readOnlySlot?.name || pos}
    >
      {hasPlayer ? (
        <div className="relative flex flex-col items-center">
          {/* Dorsal badge */}
          {playerDorsal && (
            <div className="absolute -top-1 -left-1.5 bg-white text-black font-black text-[9px] w-5 h-5 flex items-center justify-center rounded-full z-30 shadow-md border border-gray-200"
              style={{ textShadow: 'none' }}>
              {playerDorsal}
            </div>
          )}
          {/* Avatar circle */}
          <div
            className={`w-14 h-14 rounded-full overflow-hidden shadow-xl flex-shrink-0 flex items-center justify-center border-2 ${slotColors.ring}`}
            style={{ boxShadow: `0 4px 10px rgba(0,0,0,0.45), 0 0 14px ${slotColors.glow}` }}
          >
            {playerImageId && !isCapturing ? (
              <img
                src={`/fotos_jugadores/${playerImageId}.webp`}
                crossOrigin="anonymous"
                alt={player?.Name || readOnlySlot?.name || pos}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = `https://placehold.co/56x56/222/555?text=${(playerName || '?')[0]}`;
                }}
              />
            ) : (
              <div className={`w-full h-full ${slotColors.bg} flex items-center justify-center`}>
                <span className="text-white/80 font-black text-xl" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                  {playerName ? playerName[0].toUpperCase() : '?'}
                </span>
              </div>
            )}
          </div>
          {/* Position and OVR Row */}
          <div className="flex flex-row items-center justify-center gap-1 mt-1">
            <span className={`px-1.5 py-[2px] text-[9px] font-black rounded-md border ${slotColors.badge} text-white leading-none shadow-md`}
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}>
              {player?.POS_NOMBRE || readOnlySlot?.pos || pos}
            </span>
            {playerOvr && (
              <span className={`min-w-6 px-1.5 py-[2px] text-center text-[10px] font-black rounded-md leading-none shadow-md ${ovrColorClass}`}>
                {playerOvr}
              </span>
            )}
          </div>
          {/* Player name */}
          <span className="block mt-0.5 text-[11px] font-black text-white truncate max-w-[72px] text-center leading-none"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.5)' }}>
            {playerName}
          </span>
        </div>
      ) : (
        /* Empty slot — same total width, dashed circle, position label */
        <div className="flex flex-col items-center">
          <div className={`w-14 h-14 rounded-full border-2 border-dashed flex items-center justify-center
            transition-all
            ${holdingPlayer ? 'animate-pulse border-green-400/70 bg-green-500/15' : 'border-white/25 bg-white/5'}
            ${!isReadOnly ? 'group-hover:bg-white/15 group-hover:border-white/50' : ''}`}
          >
            <span className={`text-xs font-black ${emptyColors.text} ${!isReadOnly ? 'group-hover:text-white' : ''} transition-colors`}>
              {pos}
            </span>
          </div>
          {/* Spacer to match filled slot height */}
          <span className="block mt-1 text-[11px] font-bold text-white/30 leading-none"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
            {pos}
          </span>
          <div className="mt-0.5 h-[14px]"></div>
        </div>
      )}
    </div>
  );
});

export const Pitch = memo(function Pitch({ formation, lineup, cart, holdingPlayer, dorsals, isReadOnly, onSlotClick, pitchRef, readOnlySlots, isCapturing }) {
  // Se arma una sola vez por cambio de cart, en vez de un cart.find() O(n) dentro de cada uno de los 11 slots
  const cartById = useMemo(() => {
    const map = new Map();
    (cart || []).forEach(p => map.set(String(p.Id), p));
    return map;
  }, [cart]);

  return (
    <div 
      ref={pitchRef}
      className="relative w-full aspect-[3/4] bg-[#1a3a2a] rounded-lg overflow-hidden border-2 border-white/10 shadow-2xl"
      style={{
        backgroundImage: 'radial-gradient(circle at center, #2d5a3f 0%, #1a3a2a 100%)'
      }}
    >
      {/* Pitch Lines */}
      <div className="absolute inset-4 border border-white/20 pointer-events-none" />
      <div className="absolute inset-x-4 top-4 h-1/2 border-b border-white/20 pointer-events-none" />
      <div className="absolute left-1/2 top-4 -translate-x-1/2 w-32 h-16 border-x border-b border-white/20 pointer-events-none" />
      <div className="absolute left-1/2 bottom-4 -translate-x-1/2 w-32 h-16 border-x border-t border-white/20 pointer-events-none" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border border-white/20 rounded-full pointer-events-none" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-white/20 rounded-full pointer-events-none" />

      {/* Slots */}
      {formation?.layout?.map((slot, idx) => (
        <PitchSlot
          key={`${slot.pos}-${idx}`}
          {...slot}
          index={idx}
          lineup={lineup}
          cartById={cartById}
          holdingPlayer={holdingPlayer}
          dorsals={dorsals || {}}
          isReadOnly={isReadOnly}
          readOnlySlots={readOnlySlots}
          onSlotClick={onSlotClick}
          isCapturing={isCapturing}
        />
      ))}
    </div>
  );
});
