import React from 'react';
import { createPortal } from 'react-dom';
import { getFlagUrl, formatPriceShort, getPosColorClass, getStatAndOvrColorClass } from '../../utils/helpers.js';
import { playerPlaceholder } from '../../utils/playerPlaceholder.js';

const FIELD_STATS = [['VEL', 'Speed'], ['TIR', 'Finishing'], ['PAS', 'LowPass'], ['REG', 'Dribbling'], ['DEF', 'BallWinning'], ['FIS', 'Stamina']];
const GK_STATS = [['ATA', 'GKCatching'], ['DES', 'GKClearing'], ['REF', 'GKReflexes'], ['EST', 'GKReach'], ['COB', 'GKCoverage'], ['SAQ', 'GKParrying']];

/**
 * Hover preview for marketplace cards (desktop, grid view). Informational only: it never takes the pointer
 * (moving towards it would close it), so it has no buttons; clicking the card opens the full sheet.
 * Rendered on document.body: an animated (transformed) ancestor would make `position: fixed` relative to it.
 */
export function PlayerPreview({ player, isVisible, position }) {
  if (!player) return null;
  const preview = <PreviewCard player={player} isVisible={isVisible} position={position} />;
  return typeof document === 'undefined' ? preview : createPortal(preview, document.body);
}

function PreviewCard({ player, isVisible, position }) {
  const isGK = player.POS_NOMBRE === 'PT';
  const flagUrl = getFlagUrl(player.Country1);

  return (
    <div
      aria-hidden="true"
      className={`fixed z-50 w-56 p-3 rounded-xl bg-surface border border-line/[0.16] shadow-lg pointer-events-none transition-opacity duration-fast ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      style={{ top: position.top, left: position.left }}
    >
      <div className="flex items-center gap-3 pb-2 mb-2 border-b border-line/[0.12]">
        <img
          src={`/fotos_jugadores/${player.Id}.webp`}
          alt=""
          width={48}
          height={48}
          className="w-12 h-12 object-cover object-top rounded-lg bg-raised"
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = playerPlaceholder(player.Name?.substring(0, 2)); }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink truncate">{player.Name}</p>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-ink-3">
            <span className={`min-w-7 px-1 rounded font-display num text-sm font-bold text-center ${getStatAndOvrColorClass(player.OVR_CALCULADO)}`}>{player.OVR_CALCULADO}</span>
            <span className={`px-1.5 rounded text-[11px] font-bold ${getPosColorClass(player.POS_NOMBRE)}`}>{player.POS_NOMBRE}</span>
            <span><span className="num">{player.Age}</span> años</span>
            {flagUrl && <img src={flagUrl} alt="" width={16} height={12} className="w-4 h-3 rounded-[2px] object-cover" />}
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {(isGK ? GK_STATS : FIELD_STATS).map(([label, key]) => (
          <div key={key} className="flex items-center justify-between text-xs">
            <dt className="font-semibold text-ink-3">{label}</dt>
            <dd className={`min-w-7 px-1 rounded font-display num text-sm font-bold text-center ${getStatAndOvrColorClass(player[key])}`}>{player[key] ?? '–'}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-2 pt-2 border-t border-line/[0.12] flex items-baseline justify-between">
        <span className="text-xs text-ink-3">Precio</span>
        <span className="font-display num text-base font-semibold text-ink">{formatPriceShort(player.Precio)}</span>
      </p>
    </div>
  );
}
