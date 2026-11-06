import React, { memo, useMemo, useCallback, useRef, useState } from 'react';
import { getPitchPosColors, POSITION_COLORS, getPosColorClass } from '../utils/helpers.js';
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
// Square photo, as PES 2021 shows players on the game-plan pitch. 10% of the width keeps a marker (photo, chip,
// name) shorter than the 16% gap between the back line and the keeper on a phone.
const AVATAR_SIZE = 'clamp(28px, 10cqw, 54px)';
// Chip and name text follow the pitch too, with a floor that stays legible on a 360px phone.
const CHIP_FONT = 'clamp(9px, 2.6cqw, 11px)';
const NAME_FONT = 'clamp(10px, 2.9cqw, 12px)';
// The game anchors a slot at the centre of its role chip: photo, 4px gap, then a chip of font size + 6px padding.
const MARKER_TRANSLATE = `-50% calc(-1 * (${AVATAR_SIZE} + 7px + ${CHIP_FONT} / 2))`;

// Field markings in a 75 × 100 box, the pitch's own 3:4 shape, so circles stay round. Real proportions
// (105 × 68 m) are scaled to a 69 × 94 field inside a 3-unit margin; utils/pitchGeometry.js maps game depth onto
// these lines as the game draws them (within about 1 m), so a slot sits next to the same line as in PES.
const FIELD = { x: 3, y: 3, w: 69, h: 94 };
const sx = m => (m / 68) * FIELD.w; // metres across the pitch
const sy = m => (m / 105) * FIELD.h; // metres along it
function PitchMarkings() {
  const cx = FIELD.x + FIELD.w / 2;
  const cy = FIELD.y + FIELD.h / 2;
  const box = (depth, width, top) => {
    const w = sx(width);
    const h = sy(depth);
    return <rect x={cx - w / 2} y={top ? FIELD.y : FIELD.y + FIELD.h - h} width={w} height={h} />;
  };
  const spot = sy(11);
  const r = sx(9.15);
  // The «D»: the part of the circle around the penalty spot that falls outside the box.
  const arc = top => {
    const boxEdge = sy(16.5);
    const dy = boxEdge - spot;
    const dx = Math.sqrt(r * r - dy * dy);
    const y = top ? FIELD.y + boxEdge : FIELD.y + FIELD.h - boxEdge;
    return <path d={`M ${cx - dx} ${y} A ${r} ${r} 0 0 ${top ? 0 : 1} ${cx + dx} ${y}`} />;
  };
  return (
    <svg viewBox="0 0 75 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
      <g fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.35">
        <rect x={FIELD.x} y={FIELD.y} width={FIELD.w} height={FIELD.h} />
        <line x1={FIELD.x} y1={cy} x2={FIELD.x + FIELD.w} y2={cy} />
        <circle cx={cx} cy={cy} r={r} />
        {box(16.5, 40.3, true)}
        {box(16.5, 40.3, false)}
        {box(5.5, 18.3, true)}
        {box(5.5, 18.3, false)}
        {arc(true)}
        {arc(false)}
      </g>
      <g fill="rgba(255,255,255,0.6)">
        <circle cx={cx} cy={cy} r="0.45" />
        <circle cx={cx} cy={FIELD.y + spot} r="0.4" />
        <circle cx={cx} cy={FIELD.y + FIELD.h - spot} r="0.4" />
      </g>
    </svg>
  );
}

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
        ${isDragging ? 'z-30 scale-105 cursor-grabbing drop-shadow-lg' : isNudging ? '' : 'transition-[left,top,transform,opacity] duration-move ease-out'}
        ${isHoldingThis ? 'opacity-30 scale-90' : ''}
        ${holdingPlayer && !isHoldingThis ? 'hover:scale-110' : ''}
        ${isReadOnly ? 'cursor-default' : canMove && !isDragging ? 'cursor-grab select-none' : 'cursor-pointer'}
        ${isRoleTarget ? 'ring-2 ring-accent ring-offset-2 ring-offset-[#2f6a33]' : ''}
      `}
      style={{ left: `${x}%`, top: `${y}%`, translate: MARKER_TRANSLATE, width: MARKER_WIDTH, touchAction: canMove ? 'none' : undefined }}
      title={player ? `${player.Name} · ${pos}${player.POS_NOMBRE && player.POS_NOMBRE !== pos ? ` (posición natural ${player.POS_NOMBRE})` : ''}` : readOnlySlot?.name || pos}
    >
      {hasPlayer ? (
        // PES 2021 game-plan card: square photo, the role chip with the OVR beside it, the surname under them.
        <div className="relative flex flex-col items-center w-full">
          <div className="relative shrink-0" style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}>
            <div className="w-full h-full rounded-md overflow-hidden bg-raised ring-1 ring-black/50 shadow-md">
              {playerImageId && !isCapturing ? (
                <img
                  src={`/fotos_jugadores/${playerImageId}.webp`}
                  crossOrigin="anonymous"
                  draggable={false}
                  alt={player?.Name || readOnlySlot?.name || pos}
                  width={54}
                  height={54}
                  className="w-full h-full object-cover object-top"
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
              <span className="absolute -top-1.5 -left-1.5 min-w-[18px] h-[18px] px-0.5 flex items-center justify-center rounded-sm bg-canvas/90 text-white font-display font-bold text-[10px] leading-none ring-1 ring-white/25 num">
                {playerDorsal}
              </span>
            )}
          </div>
          <span className="mt-1 flex items-stretch rounded-sm overflow-hidden shadow-sm leading-none" style={{ fontSize: CHIP_FONT }}>
            <span className={`px-1 py-[3px] font-bold ${getPosColorClass(player ? pos : readOnlySlot?.pos || pos)}`}>
              {player ? pos : readOnlySlot?.pos || pos}
            </span>
            {playerOvr && (
              <span className="px-1 py-[3px] font-display font-bold bg-canvas/85 text-white num">{playerOvr}</span>
            )}
          </span>
          <span className="block mt-0.5 font-display font-semibold uppercase text-white truncate max-w-full text-center leading-tight"
            style={{ fontSize: NAME_FONT, textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}>
            {playerName}
          </span>
        </div>
      ) : (
        /* Empty slot: a dashed square the size of a photo, with its role chip where a player's would be */
        <div className="flex flex-col items-center">
          <div className={`rounded-md border-2 border-dashed transition-colors duration-fast
            ${holdingPlayer ? 'border-success-soft bg-success/20' : 'border-white/40 bg-black/15'}
            ${!isReadOnly ? 'group-hover:bg-white/15 group-hover:border-white/70' : ''}`}
            style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
          />
          <span className={`mt-1 px-1 py-[3px] rounded-sm font-bold leading-none ${getPosColorClass(pos)}`} style={{ fontSize: CHIP_FONT }}>
            {pos}
          </span>
          {/* Same height as a filled marker's name line, so the square sits where a photo would */}
          <span className="block mt-0.5 leading-tight invisible" style={{ fontSize: NAME_FONT }} aria-hidden="true">·</span>
        </div>
      )}
    </div>
  );
});

/**
 * onSlotMove(index, { x, y }): when given, outfield markers can be dragged (mouse, touch, pen) or moved with the
 * arrow keys; positions are percentages of the pitch (utils/formationStates.js) and are committed on drop only.
 * previewRole(index, { x, y }): the role the slot would play there, shown on the marker while it is dragged.
 */
export const Pitch = memo(function Pitch({ formation, lineup, cart, holdingPlayer, dorsals, isReadOnly, onSlotClick, onSlotMove, previewRole, pitchRef, readOnlySlots, isCapturing, roleSlot = null }) {
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

  const layoutRef = useRef(formation?.layout);
  layoutRef.current = formation?.layout;

  const startDrag = useCallback((e, index) => {
    if (e.button > 0) return;
    // Keep the grab point under the pointer: the marker follows by its anchor plus this offset, so it never jumps.
    const rect = boxRef.current?.getBoundingClientRect();
    const slot = layoutRef.current?.[index];
    const dx = rect && slot ? e.clientX - (rect.left + (slot.x / 100) * rect.width) : 0;
    const dy = rect && slot ? e.clientY - (rect.top + (slot.y / 100) * rect.height) : 0;
    dragRef.current = { index, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, dx, dy, moved: false, last: null };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, []);
  const moveDrag = useCallback(e => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (!d.moved && Math.abs(e.clientX - d.x0) + Math.abs(e.clientY - d.y0) < DRAG_THRESHOLD_PX) return;
    d.moved = true;
    const p = clientToPitch(e.clientX - d.dx, e.clientY - d.dy, boxRef.current?.getBoundingClientRect());
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
      className="pitch-canvas-export-target relative w-full aspect-[3/4] rounded-xl overflow-hidden ring-1 ring-black/40 shadow-lg [container-type:inline-size]"
      style={{
        // Mown stripes as in the PES game-plan screen: ten bands, in percent so they follow the pitch size.
        backgroundColor: '#2f6a33',
        backgroundImage: 'repeating-linear-gradient(180deg, #33713a 0 10%, #2c6431 10% 20%)',
      }}
    >
      <PitchMarkings />
      {formation?.name && (
        <span className="absolute left-2 bottom-1.5 font-display font-bold text-white/90 num pointer-events-none"
          style={{ fontSize: 'clamp(12px, 3.6cqw, 16px)', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }} aria-hidden="true">
          {formation.name}
        </span>
      )}

      {/* Slots */}
      {formation?.layout?.map((slot, idx) => {
        const dragging = drag?.index === idx;
        return (
          <PitchSlot
            key={idx}
            {...slot}
            pos={dragging && previewRole ? previewRole(idx, drag) || slot.pos : slot.pos}
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
