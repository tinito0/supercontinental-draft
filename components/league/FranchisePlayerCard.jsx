import React from 'react';
import { Link } from 'react-router-dom';
import { getPosColorClass, getStatAndOvrColorClass } from '../../utils/helpers.js';
import { playerPlaceholder } from '../../utils/playerPlaceholder.js';
import { teamCrestUrl } from '../../utils/teamCrest.js';
import { DEFAULT_LOGO } from '../../utils/constants.js';

/* Jugador Franquicia de un club (hooks/useLeagueData.js useFranchisePlayers): la foto grande con OVR y puesto, como
   una carta del juego. El borde lavanda del escudo es la marca de la competición (docs/DESIGN_SYSTEM.md): solo la
   llevan los jugadores franquicia. Con `team` muestra el club y lleva a su página. */

function Photo({ player }) {
  return (
    <div className="relative aspect-square bg-raised">
      <img
        src={`/fotos_jugadores/${player.playerId}.webp`}
        alt=""
        width="240"
        height="240"
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover object-top"
        onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = playerPlaceholder(player.name?.[0] || '?'); }}
      />
      {(player.ovr || player.pos) && (
        <div className="absolute left-2 top-2 flex flex-col items-center gap-1">
          {player.ovr && (
            <span className={`grid h-9 w-10 place-items-center rounded-md font-display text-xl font-bold num ${getStatAndOvrColorClass(player.ovr)}`}>
              <span className="sr-only">OVR </span>{player.ovr}
            </span>
          )}
          {player.pos && (
            <span className={`w-10 rounded-md py-0.5 text-center font-display text-sm font-bold leading-tight ${getPosColorClass(player.pos)}`}>{player.pos}</span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * @param {{ player: { playerId: string, name: string, pos: string, ovr: number|null, age: number|null },
 *   team?: object|null, className?: string }} props
 */
export function FranchisePlayerCard({ player, team = null, className = '' }) {
  const name = player.name || 'Jugador franquicia';
  // On the club page (no `team`) it sits in a sidebar: photo beside the data instead of a full-width square.
  if (!team) {
    return (
      <div className={`flex items-center gap-4 overflow-hidden rounded-2xl border border-crest/50 bg-surface p-3 ${className}`}>
        <img
          src={`/fotos_jugadores/${player.playerId}.webp`}
          alt=""
          width="96"
          height="96"
          loading="lazy"
          className="h-24 w-24 shrink-0 rounded-xl bg-raised object-cover object-top"
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = playerPlaceholder(player.name?.[0] || '?'); }}
        />
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-bold uppercase leading-tight text-ink [overflow-wrap:anywhere]">{name}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {player.ovr && (
              <span className={`grid h-8 w-10 place-items-center rounded-md font-display text-lg font-bold num ${getStatAndOvrColorClass(player.ovr)}`}>
                <span className="sr-only">OVR </span>{player.ovr}
              </span>
            )}
            {player.pos && <span className={`w-10 rounded-md py-1 text-center font-display text-sm font-bold leading-tight ${getPosColorClass(player.pos)}`}>{player.pos}</span>}
            {player.age && <span className="text-sm text-ink-2"><span className="num">{player.age}</span> años</span>}
          </div>
        </div>
      </div>
    );
  }
  const body = (
    <>
      <Photo player={player} />
      <div className="border-t border-crest/50 p-3">
        <p className="truncate font-display text-lg font-bold uppercase leading-tight text-ink" title={name}>{name}</p>
        <p className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-ink-2">
          <img src={teamCrestUrl(team)} alt="" width="20" height="20" loading="lazy" className="h-5 w-5 shrink-0 object-contain"
            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_LOGO; }} />
          <span className="truncate">{team.teamName}</span>
        </p>
      </div>
    </>
  );
  return (
    <Link
      to={`/equipos/${team.id}`}
      aria-label={`${name}, jugador franquicia de ${team.teamName}`}
      className={`block overflow-hidden rounded-2xl border border-crest/50 bg-surface ${className} transition-[border-color,background-color] duration-fast hover:border-crest hover:bg-raised`}
    >
      {body}
    </Link>
  );
}

export default FranchisePlayerCard;
