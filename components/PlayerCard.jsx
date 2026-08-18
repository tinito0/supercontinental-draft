import React, { memo, useState } from 'react';
import { Lock, DollarSign, ArrowLeftRight, Check, Star } from 'lucide-react';
import { getFlagUrl, formatPriceShort, getPosColorClass } from '../utils/helpers.js';

/* ── Position accent colors ── */
const POS_COLOR = {
  DC: '#ef4444', SD: '#ef4444', EI: '#ef4444', ED: '#ef4444',
  MC: '#22c55e', MCD: '#22c55e', MO: '#22c55e', MI: '#22c55e', MD: '#22c55e',
  DFC: '#3b82f6', LI: '#3b82f6', LD: '#3b82f6',
  PT: '#eab308',
};

/* ── OVR color tiers (static thresholds, zero-alloc) ──
   Antes eran verdes neón puros (#19ffb2, #32f718) — quedaban "sucios"/chillones.
   Ahora usan la misma paleta que ya tienen las píldoras de stats (.stat-c-* en
   index.css), para que se vea consistente en toda la card. */
const OVR_COLOR_THRESHOLDS = [
  [90, '#1ec9a4'],
  [85, '#a0dd00'],
  [75, '#ffc400'],
  [65, '#ec7d22'],
];
const OVR_COLOR_DEFAULT = '#9ca3af';
function getOvrColor(ovr) {
  for (let i = 0; i < OVR_COLOR_THRESHOLDS.length; i++) {
    if (ovr >= OVR_COLOR_THRESHOLDS[i][0]) return OVR_COLOR_THRESHOLDS[i][1];
  }
  return OVR_COLOR_DEFAULT;
}

/* ── Cache de fotos que ya sabemos que fallan (404) ──
   Persiste entre remounts/re-renders de la card (scroll, virtualización,
   cambios de filtro) para no volver a intentar cargar la foto real ni
   mostrar el spinner de nuevo — eso era lo que causaba el parpadeo. */
const brokenImageIds = new Set();

export const PlayerCard = memo(function PlayerCard({
  player,
  onSelectPlayer,
  isInMyCart,
  isLockedByOther,
  lockedTeamName,
  onCompare,
  isComparing,
  isWishlisted,
  onToggleWishlist,
  lockedTeamLogo,
}) {
  const ovr = player.OVR_CALCULADO || 0;
  const ovrColor = getOvrColor(ovr);
  const [imgState, setImgState] = useState(() => {
    const knownBroken = brokenImageIds.has(player.Id);
    return { loaded: knownBroken, error: knownBroken };
  });
  const posColor = POS_COLOR[player.POS_NOMBRE] || '#9ca3af';
  const flagUrl = getFlagUrl(player.Country1);

  /* ── Dynamic card border ── */
  const borderColor = isInMyCart
    ? 'rgba(16,185,129,0.5)'
    : isComparing
      ? 'rgba(99,102,241,0.6)'
      : 'rgba(255,255,255,0.07)';

  const cardBg = isInMyCart
    ? 'linear-gradient(168deg, #062a1a 0%, #021a11 100%)'
    : 'linear-gradient(168deg, #1a1a1f 0%, #0c0c0e 100%)';

  return (
    <div
      onClick={() => onSelectPlayer?.(player.Id)}
      className={`player-card ${isLockedByOther ? 'player-card--locked' : ''} ${isInMyCart ? 'player-card--owned' : ''} ${isComparing ? 'player-card--comparing' : ''}`}
      style={{
        '--pos-accent': posColor,
        '--ovr-color': ovrColor,
        background: cardBg,
        border: `1px solid ${borderColor}`,
        width: '100%',
        height: '100%',
        contentVisibility: 'auto',
        containIntrinsicSize: '260px 360px',
        boxShadow: isInMyCart
          ? 'inset 0 1px 0 rgba(16,185,129,0.08)'
          : 'none',
      }}
    >
      {/* ═══════════ PRICE HEADER (TOP) ═══════════ */}
      <div className="player-card__price-header">
        <DollarSign className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
        <span className="player-card__price">
          {formatPriceShort(player.Precio)}
        </span>
      </div>

      {/* ═══════════ PHOTO AREA ═══════════ */}
      <div className="player-card__photo-wrapper">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleWishlist?.(player.Id); }}
          className={`absolute top-2 right-2 z-20 p-1.5 rounded-full transition-all duration-200 backdrop-blur-sm
            ${isWishlisted ? 'bg-yellow-500/20 text-yellow-400' : 'bg-black/30 text-white/50 hover:bg-black/50 hover:text-white'}`}
          title={isWishlisted ? "Quitar de Favoritos" : "Añadir a Favoritos"}
        >
          <Star className="w-4 h-4" fill={isWishlisted ? "currentColor" : "none"} />
        </button>
        {/* Subtle position-colored glow behind the player */}
        <div
          className="player-card__glow"
          style={{
            background: `radial-gradient(ellipse at 50% 70%, ${posColor}30 0%, transparent 65%)`,
          }}
        />

        {!imgState.loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-gray-600 border-t-emerald-500 rounded-full animate-spin opacity-50"></div>
          </div>
        )}
        <img
          src={imgState.error ? `https://placehold.co/200x240/111/333?text=${player.Name?.substring(0, 2) ?? '?'}` : `/fotos_jugadores/${player.Id}.webp`}
          alt={player.Name}
          loading="lazy"
          decoding="async"
          width="200"
          height="240"
          fetchPriority="low"
          onLoad={() => setImgState({ loaded: true, error: false })}
          onError={() => {
            brokenImageIds.add(player.Id);
            setImgState({ loaded: true, error: true });
          }}
          className="player-card__photo"
          style={{
            filter: isLockedByOther
              ? 'grayscale(0.7) brightness(0.5)'
              : 'none',
            opacity: imgState.loaded ? 1 : 0,
            transition: 'opacity 0.2s ease-in',
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            objectPosition: 'center bottom'
          }}
        />

        {/* Bottom gradient fade over photo — ensures info legibility */}
        <div className="player-card__photo-fade" />

        {/* ═══════════ INFO STRIP — OVR + Flag + Position ═══════════ */}
        <div className="player-card__info-strip">
          {/* OVR Badge */}
          <div className="player-card__ovr-badge" style={{ background: `${ovrColor}22`, borderColor: `${ovrColor}60` }}>
            <span className="player-card__ovr" style={{ color: ovrColor }}>
              {ovr}
            </span>
          </div>

          {/* Flag */}
          <img
            src={flagUrl}
            alt=""
            className="player-card__flag"
            onError={e => (e.target.style.display = 'none')}
          />

          {/* Position Badge */}
          <span
            className="player-card__pos"
            style={{
              color: '#181818ff',
              background: posColor,
              boxShadow: `0 2px 8px ${posColor}50`,
            }}
          >
            {player.POS_NOMBRE}
          </span>
        </div>

        {/* ── COMPARE BUTTON (centered, hover reveal) ── */}
        {!isLockedByOther && (
          <button
            onClick={(e) => { e.stopPropagation(); onCompare?.(player, e); }}
            className={`player-card__compare-btn ${isComparing ? 'player-card__compare-btn--active' : ''}`}
            title="Comparar"
            aria-label="Comparar jugador"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>
        )}

        {/* ── LOCKED OVERLAY — VENDIDO badge ── */}
        {isLockedByOther && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-red-900/50 backdrop-blur-[1px] rounded-none">
            {lockedTeamLogo ? (
              <img src={lockedTeamLogo} alt="Vendido" className="w-16 h-16 object-contain drop-shadow-xl" />
            ) : (
              <div className="bg-red-600/90 text-white font-black text-xs uppercase tracking-[0.2em] px-4 py-1.5 rounded-lg shadow-lg border border-red-400/30 rotate-[-8deg]">
                VENDIDO
              </div>
            )}
          </div>
        )}

        {/* ── OWNED INDICATOR — EN TU EQUIPO badge ── */}
        {isInMyCart && !isLockedByOther && (
          <>
            <div className="player-card__owned-stripe" />
            <div className="absolute top-2 left-2 z-30 bg-cyan-500/90 text-black font-black text-[8px] uppercase tracking-wider px-2 py-1 rounded shadow-lg border border-cyan-300/40">
              EN TU EQUIPO
            </div>
          </>
        )}
      </div>

      {/* ═══════════ NAME FOOTER (BOTTOM) ═══════════ */}
      <div className="player-card__name-bar">
        <h3 className="player-card__name">{player.Name}</h3>
      </div>
    </div>
  );
});
