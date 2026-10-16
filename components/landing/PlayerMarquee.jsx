import React, { memo } from 'react';
import { getPosColorClass, getStatAndOvrColorClass } from '../../utils/helpers.js';
import { SHOWCASE_PLAYERS } from './sampleData.js';

const PlayerTile = memo(function PlayerTile({ player }) {
  return (
    <li className="w-40 shrink-0 sm:w-44">
      <div className="overflow-hidden rounded-xl border border-line/10 bg-surface">
        <div className="relative aspect-square bg-raised">
          <img
            src={`/fotos_jugadores/${player.id}.webp`}
            alt=""
            width="176"
            height="176"
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
          <div className="absolute left-2 top-2 flex gap-1">
            <span className={`${getStatAndOvrColorClass(player.ovr)} num rounded px-1.5 py-0.5 text-xs font-bold`}>{player.ovr}</span>
            <span className={`${getPosColorClass(player.pos)} rounded px-1.5 py-0.5 text-xs font-bold`}>{player.pos}</span>
          </div>
        </div>
        <div className="px-3 py-2.5">
          <p className="truncate text-sm font-semibold text-ink" title={player.card}>{player.card}</p>
          <p className="font-display num text-lg font-semibold text-ink-2">${player.price.toFixed(2)}M</p>
        </div>
      </div>
    </li>
  );
});

/**
 * One continuous strip of market players, the page's only marquee. The second copy exists for the
 * seamless loop, so it is hidden from assistive tech; with reduced motion it is not rendered at all
 * (CSS) and the strip scrolls by hand.
 */
export function PlayerMarquee() {
  return (
    <div className="landing-marquee" tabIndex={0} aria-label="Jugadores del mercado">
      <div className="landing-marquee__track">
        <ul className="flex gap-4 pr-4">
          {SHOWCASE_PLAYERS.map(p => <PlayerTile key={p.key} player={p} />)}
        </ul>
        <ul className="landing-marquee__copy flex gap-4 pr-4" aria-hidden="true">
          {SHOWCASE_PLAYERS.map(p => <PlayerTile key={p.key} player={p} />)}
        </ul>
      </div>
    </div>
  );
}

export default PlayerMarquee;
