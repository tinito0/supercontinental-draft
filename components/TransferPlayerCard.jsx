import React, { memo, useState } from 'react';
import { ArrowRight, BadgeDollarSign } from 'lucide-react';
import { DEFAULT_LOGO } from '../utils/constants.js';
import { formatPriceShort, getFlagUrl } from '../utils/helpers.js';

function getOvrBadgeClass(ovr) {
  const value = Number(ovr) || 0;
  if (value >= 90) return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
  if (value >= 85) return 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30';
  if (value >= 80) return 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30';
  return 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30';
}

const TeamLogo = memo(function TeamLogo({ logo, name }) {
  return (
    <span className="h-6 w-6 shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
      <img
        src={logo || DEFAULT_LOGO}
        alt={name || 'Equipo'}
        loading="lazy"
        className="h-full w-full object-contain"
        onError={(event) => { event.currentTarget.src = DEFAULT_LOGO; }}
      />
    </span>
  );
});

export const TransferPlayerCard = memo(function TransferPlayerCard({
  transfer,
  player,
  allTeams,
  compact = false,
}) {
  const [imgError, setImgError] = useState(false);
  const fromTeam = allTeams?.[transfer?.fromTeamId] || {};
  const toTeam = allTeams?.[transfer?.teamId] || {};
  const playerId = transfer?.playerId || player?.Id;
  const playerName = transfer?.playerName || player?.Name || 'Jugador';
  const ovr = transfer?.playerOvr || player?.OVR_CALCULADO || 0;
  const position = transfer?.playerPosition || player?.POS_NOMBRE || '--';
  const country = transfer?.playerCountry || player?.Country1;
  const fromTeamName = transfer?.fromTeamName || fromTeam.teamName || 'Equipo rival';
  const toTeamName = transfer?.teamName || toTeam.teamName || 'Equipo comprador';
  const fromLogo = transfer?.fromTeamLogo || fromTeam.logoUrl;
  const toLogo = transfer?.teamLogo || toTeam.logoUrl;
  const ovrBadgeStyle = getOvrBadgeClass(ovr);
  const photoSrc = imgError
    ? `https://placehold.co/220x260/101318/4b5563?text=${encodeURIComponent(playerName.slice(0, 2))}`
    : `/fotos_jugadores/${playerId}.webp`;

  return (
    <article
      className={`relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f141f] shadow-sm transition-all hover:shadow-md ${
        compact ? 'max-w-none' : 'mx-auto max-w-[340px]'
      }`}
    >
      {/* Top Banner Status */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Traspaso Oficial
          </span>
        </div>
        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
          {formatPriceShort(Number(transfer?.price) || 0)}
        </span>
      </div>

      <div className="p-3">
        {/* Player Header Info */}
        <div className="flex items-start gap-3">
          <div className="relative w-12 h-14 rounded-lg bg-slate-100 dark:bg-slate-800/60 overflow-hidden flex-shrink-0 border border-slate-200 dark:border-slate-700/60">
            <img
              src={photoSrc}
              alt={playerName}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover object-top"
              onError={() => setImgError(true)}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border tabular-nums ${ovrBadgeStyle}`}>
                {ovr || '--'}
              </span>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                {position}
              </span>
              {country && (
                <img
                  src={getFlagUrl(country)}
                  alt=""
                  className="h-3 w-4 rounded-sm object-cover ml-auto"
                  onError={(event) => { event.currentTarget.style.display = 'none'; }}
                />
              )}
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {playerName}
            </h3>
          </div>
        </div>

        {/* Club Movement */}
        <div className="mt-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center justify-between gap-2 min-w-0 text-xs">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <TeamLogo logo={fromLogo} name={fromTeamName} />
              <span className="truncate font-medium text-slate-600 dark:text-slate-400">{fromTeamName}</span>
            </div>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end text-right">
              <span className="truncate font-semibold text-slate-900 dark:text-white">{toTeamName}</span>
              <TeamLogo logo={toLogo} name={toTeamName} />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
});
