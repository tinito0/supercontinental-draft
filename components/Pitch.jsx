import React, { memo, useMemo, useCallback, useRef, useState } from 'react';
import { getPitchPosColors, POSITION_COLORS, getStatAndOvrColorClass } from '../utils/helpers.js';
import { clientToPitch, clampPosition, isGoalkeeperSlot } from '../utils/formationStates.js';
import { playerPlaceholder } from '../utils/playerPlaceholder.js';

/** Pixels the pointer must travel before a press on a marker becomes a drag (below it, it is a click). */
const DRAG_THRESHOLD_PX = 5;
/** A click that arrives this soon after a drop belongs to the drag, not to a new selection. */
const CLICK_AFTER_DRAG_MS = 400;
const KEY_STEP = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
const preventNativeDrag = e => e.preventDefault();
// Markers scale with the pitch (container query units on the pitch box), not with the viewport: the pitch is narrow
// both on phones and on short desktop screens. 17% of the width is the gap between neighbours in a back five.
const MARKER_WIDTH = 'min(76px, 17cqw)';
const AVATAR_SIZE = 'clamp(34px, 12.5cqw, 56px)';

// Get last name, max 10 chars
const getLastName = (name) => {
  if (!name) return '?';
  const parts = name.split(' ');
  const last = parts.length > 1 ? parts[parts.length - 1] : parts[0];
  return last.length > 10 ? last.substring(0, 9) + '.' : last;
};

export const PitchSlot = memo(({ pos, x, y, index, onSlotClick, lineup, cartById, holdingPlayer, dorsals, isReadOnly, readOnlySlots, isCapturing, canMove, isDragging, onDragStart, onKeyMove, isRoleTarget }) => {
  const playerId = lineup[index];
  const player = cartById.get(String(playerId));
  // While an arrow key moves the marker it follows each step at once: with the 220 ms glide, holding the key
  // left it trailing behind. The glide stays for formation changes.
  const [isNudging, setIsNudging] = useState(false);
  const isHoldingThis = holdingPlayer?.from === 'slot' && holdingPlayer.fromSlotIndex === index;
  const dorsal = player ? dorsals?.[player.Id] : null;

  // Onclick estable por slot: no se recrea en cada render de Pitch (evita romper el memo())
  const handleClick = useCallback(() => {
    if (!isReadOnly) onSlotClick?.(index);
  }, [isReadOnly, onSlotClick, index]);
  const handlePointerDown = useCallback(e => { if (canMove) onDragStart?.(e, index); }, [canMove, onDragStart, index]);
  const handleKeyDown = useCallback(e => {
    if (isReadOnly) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSlotClick?.(index); return; }
    const step = KEY_STEP[e.key];
    if (step && canMove) {
      e.preventDefault();
      setIsNudging(true);
      const k = e.shiftKey ? 5 : 1;
      onKeyMove?.(index, { x: x + step[0] * k, y: y + step[1] * k });
    }
  }, [isReadOnly, onSlotClick, canMove, onKeyMove, index, x, y]);
  const stopNudging = useCallback(() => setIsNudging(false), []);

  // Use shared position color system from helpers.js. The marker shows the role the slot plays (what the export
  // writes, utils/positionRules.js); the player's natural position goes in the tooltip.
  const colors = player ? getPitchPosColors(pos) : POSITION_COLORS.none;
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
      onPointerDown={canMove ? handlePointerDown : undefined}
      // The browser's own image drag would cancel the pointer stream (pointercancel) right after it starts.
      onDragStart={canMove ? preventNativeDrag : undefined}
      onKeyDown={!isReadOnly ? handleKeyDown : undefined}
      onKeyUp={isNudging ? stopNudging : undefined}
      onBlur={isNudging ? stopNudging : undefined}
      role={!isReadOnly ? 'button' : undefined}
      tabIndex={!isReadOnly ? 0 : undefined}
      aria-label={!isReadOnly ? `${player ? player.Name : 'Puesto vacío'} (${pos})${canMove ? '. Arrastrá o usá las flechas para moverlo.' : ''}` : undefined}
      aria-pressed={isRoleTarget || undefined}
      className={`absolute flex flex-col items-center justify-center z-20 group rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent
        ${isDragging ? 'z-30 opacity-90 cursor-grabbing' : isNudging ? '' : 'transition-[left,top,transform,opacity] duration-move ease-in-out'}
        ${isHoldingThis ? 'opacity-30 scale-90' : ''}
        ${holdingPlayer && !isHoldingThis ? 'hover:scale-110' : ''}
        ${isReadOnly ? 'cursor-default' : canMove && !isDragging ? 'cursor-grab select-none' : 'cursor-pointer'}
        ${isRoleTarget ? 'ring-2 ring-accent ring-offset-2 ring-offset-[#183624]' : ''}
      `}
      style={{ left: `${x}%`, top: `${y}%`, translate: '-50% -50%', width: MARKER_WIDTH, touchAction: canMove ? 'none' : undefined }}
      title={player ? `${player.Name} · ${pos}${player.POS_NOMBRE && player.POS_NOMBRE !== pos ? ` (posición natural ${player.POS_NOMBRE})` : ''}` : readOnlySlot?.name || pos}
    >
      {hasPlayer ? (
        <div className="relative flex flex-col items-center">
          {/* Avatar with the dorsal (top left), OVR (top right) and role (bottom) pinned to it: the marker stays
              about one avatar tall, so the rows of a formation do not run into each other on small pitches. */}
          <div className="relative shrink-0" style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}>
            <div
              className={`w-full h-full rounded-full overflow-hidden flex items-center justify-center border-2 ${slotColors.ring}`}
              style={{ boxShadow: '0 4px 10px rgba(0,0,0,0.35)' }}
            >
              {playerImageId && !isCapturing ? (
                <img
                  src={`/fotos_jugadores/${playerImageId}.webp`}
                  crossOrigin="anonymous"
                  draggable={false}
                  alt={player?.Name || readOnlySlot?.name || pos}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = playerPlaceholder((playerName || '?')[0]);
                  }}
                />
              ) : (
                <div className={`w-full h-full ${slotColors.bg} flex items-center justify-center`}>
                  <span className="text-white/90 font-bold text-lg">
                    {playerName ? playerName[0].toUpperCase() : '?'}
                  </span>
                </div>
              )}
            </div>
            {playerDorsal && (
              <span className="absolute -top-1 -left-1.5 bg-white text-black font-bold text-[9px] w-[18px] h-[18px] flex items-center justify-center rounded-full shadow-md num"
                style={{ textShadow: 'none' }}>
                {playerDorsal}
              </span>
            )}
            {playerOvr && (
              <span className={`absolute -top-1 -right-2 min-w-[20px] px-1 py-[2px] text-center text-[10px] font-bold rounded leading-none shadow-sm num ${ovrColorClass}`}>
                {playerOvr}
              </span>
            )}
            <span className={`absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 px-1.5 py-[2px] text-[9px] font-bold rounded border ${slotColors.badge} text-ink leading-none shadow-sm whitespace-nowrap`}>
              {player ? pos : readOnlySlot?.pos || pos}
            </span>
          </div>
          <span className="block mt-2 text-[11px] font-bold text-ink truncate max-w-full text-center leading-none"
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.85)' }}>
            {playerName}
          </span>
        </div>
      ) : (
        /* Empty slot: dashed circle the size of an avatar, with the role inside */
        <div className="flex flex-col items-center">
          <div className={`rounded-full border-2 border-dashed flex items-center justify-center
            transition-colors
            ${holdingPlayer ? 'animate-pulse border-emerald-400/80 bg-success/20' : 'border-white/30 bg-white/5'}
            ${!isReadOnly ? 'group-hover:bg-white/15 group-hover:border-white/60' : ''}`}
            style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
          >
            <span className={`text-xs font-bold ${emptyColors.text} ${!isReadOnly ? 'group-hover:text-ink' : ''} transition-colors`}>
              {pos}
            </span>
          </div>
          {/* Same height as a filled marker's name line, so the circle sits where an avatar would */}
          <span className="block mt-2 h-[11px]" aria-hidden="true" />
        </div>
      )}
    </div>
  );
});

/**
 * onSlotMove(index, { x, y }): when given, outfield markers can be dragged (mouse, touch, pen) or moved with the
 * arrow keys; positions are percentages of the pitch (utils/formationStates.js) and are committed on drop only.
 */
export const Pitch = memo(function Pitch({ formation, lineup, cart, holdingPlayer, dorsals, isReadOnly, onSlotClick, onSlotMove, pitchRef, readOnlySlots, isCapturing, roleSlot = null }) {
  // Se arma una sola vez por cambio de cart, en vez de un cart.find() O(n) dentro de cada uno de los 11 slots
  const cartById = useMemo(() => {
    const map = new Map();
    (cart || []).forEach(p => map.set(String(p.Id), p));
    return map;
  }, [cart]);

  const boxRef = useRef(null);
  const dragRef = useRef(null);
  const clickBlockedUntil = useRef(0);
  const [drag, setDrag] = useState(null); // { index, x, y } while a marker follows the pointer
  const setBox = useCallback(el => { boxRef.current = el; if (pitchRef) pitchRef.current = el; }, [pitchRef]);
  const canMove = Boolean(onSlotMove) && !isReadOnly;

  const startDrag = useCallback((e, index) => {
    if (e.button > 0) return;
    dragRef.current = { index, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, last: null };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, []);
  const moveDrag = useCallback(e => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (!d.moved && Math.abs(e.clientX - d.x0) + Math.abs(e.clientY - d.y0) < DRAG_THRESHOLD_PX) return;
    d.moved = true;
    const p = clientToPitch(e.clientX, e.clientY, boxRef.current?.getBoundingClientRect());
    if (p) { d.last = p; setDrag({ index: d.index, ...p }); }
  }, []);
  const endDrag = useCallback(e => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    if (!d.moved) return; // a plain press: the click handler picks/places the player as before
    clickBlockedUntil.current = performance.now() + CLICK_AFTER_DRAG_MS;
    setDrag(null);
    if (e.type === 'pointerup' && d.last) onSlotMove?.(d.index, d.last);
  }, [onSlotMove]);
  const handleSlotClick = useCallback(index => {
    if (performance.now() < clickBlockedUntil.current) return;
    onSlotClick?.(index);
  }, [onSlotClick]);
  const handleKeyMove = useCallback((index, p) => onSlotMove?.(index, clampPosition(p)), [onSlotMove]);

  return (
    <div
      ref={setBox}
      onPointerMove={canMove ? moveDrag : undefined}
      onPointerUp={canMove ? endDrag : undefined}
      onPointerCancel={canMove ? endDrag : undefined}
      className="pitch-canvas-export-target relative w-full aspect-[3/4] bg-[#183624] rounded-xl overflow-hidden border border-emerald-900/40 shadow-xl [container-type:inline-size]"
      style={{
        backgroundImage: 'repeating-linear-gradient(0deg, #1b3d2b, #1b3d2b 32px, #163222 32px, #163222 64px)'
      }}
    >
      {/* Pitch Lines */}
      <div className="absolute inset-4 border border-white/25 pointer-events-none" />
      <div className="absolute inset-x-4 top-4 h-1/2 border-b border-white/25 pointer-events-none" />
      <div className="absolute left-1/2 top-4 -translate-x-1/2 w-36 h-18 border-x border-b border-white/25 pointer-events-none" />
      <div className="absolute left-1/2 bottom-4 -translate-x-1/2 w-36 h-18 border-x border-t border-white/25 pointer-events-none" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border border-white/25 rounded-full pointer-events-none" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white/30 rounded-full pointer-events-none" />

      {/* Slots */}
      {formation?.layout?.map((slot, idx) => {
        const dragging = drag?.index === idx;
        return (
          <PitchSlot
            key={idx}
            {...slot}
            x={dragging ? drag.x : slot.x}
            y={dragging ? drag.y : slot.y}
            index={idx}
            lineup={lineup}
            cartById={cartById}
            holdingPlayer={holdingPlayer}
            dorsals={dorsals || {}}
            isReadOnly={isReadOnly}
            readOnlySlots={readOnlySlots}
            onSlotClick={canMove ? handleSlotClick : onSlotClick}
            isCapturing={isCapturing}
            canMove={canMove && !isGoalkeeperSlot(slot)}
            isDragging={dragging}
            onDragStart={startDrag}
            onKeyMove={handleKeyMove}
            isRoleTarget={roleSlot === idx}
          />
        );
      })}
    </div>
  );
});
