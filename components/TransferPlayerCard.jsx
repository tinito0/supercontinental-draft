import React, { memo, useMemo, useState } from 'react';
import { ArrowRight, BadgeDollarSign } from 'lucide-react';
import { DEFAULT_LOGO } from '../utils/constants.js';
import { formatPriceShort, getFlagUrl } from '../utils/helpers.js';

function getTier(ovr) {
  const value = Number(ovr) || 0;
  if (value >= 90) return {
    frame: 'linear-gradient(145deg, #f9d56e, #f59e0b 42%, #7c3aed 100%)',
    glow: 'rgba(245, 158, 11, 0.28)',
    text: '#fde68a',
  };
  if (value >= 85) return {
    frame: 'linear-gradient(145deg, #22d3ee, #8b5cf6 48%, #f59e0b 100%)',
    glow: 'rgba(34, 211, 238, 0.24)',
    text: '#67e8f9',
  };
  return {
    frame: 'linear-gradient(145deg, #64748b, #22c55e 52%, #38bdf8 100%)',
    glow: 'rgba(56, 189, 248, 0.2)',
    text: '#bae6fd',
  };
}

const TeamLogo = memo(function TeamLogo({ logo, name }) {
  return (
    <span className="h-7 w-7 shrink-0 overflow-hidden rounded-lg bg-black/30 p-1 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.045)]">
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
  const tier = useMemo(() => getTier(ovr), [ovr]);
  const photoSrc = imgError
    ? `https://placehold.co/220x260/101318/4b5563?text=${encodeURIComponent(playerName.slice(0, 2))}`
    : `/fotos_jugadores/${playerId}.webp`;

  return (
    <article
      className={`relative isolate overflow-hidden rounded-[18px] p-[2px] ${compact ? 'max-w-none' : 'mx-auto max-w-[340px]'}`}
      style={{ background: tier.frame, boxShadow: `0 18px 44px ${tier.glow}` }}
    >
      <div className="relative overflow-hidden rounded-[16px] bg-[#090a0d]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_16%,rgba(255,255,255,0.16),transparent_34%),linear-gradient(160deg,rgba(15,23,42,0.2),rgba(2,6,23,0.92))]" />
        <div className="relative z-10 grid grid-cols-[76px_1fr] gap-3 p-3">
          <div className="pt-1">
            <p className="text-4xl font-black leading-none text-white">{ovr || '--'}</p>
            <p className="mt-1 text-lg font-black leading-none" style={{ color: tier.text }}>{position}</p>
            {country && (
              <img
                src={getFlagUrl(country)}
                alt=""
                className="mt-2 h-[18px] w-6 rounded-[3px] object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
                onError={(event) => { event.currentTarget.style.display = 'none'; }}
              />
            )}
          </div>

          <div className="relative min-h-[150px]">
            <img
              src={photoSrc}
              alt={playerName}
              loading="lazy"
              decoding="async"
              className="absolute inset-x-0 bottom-0 mx-auto h-[168px] w-full object-contain object-bottom drop-shadow-[0_20px_22px_rgba(0,0,0,0.72)]"
              onError={() => setImgError(true)}
            />
          </div>
        </div>

        <div className="relative z-10 px-3 pb-3">
          <div className="rounded-xl bg-black/42 px-3 py-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="min-w-0 truncate text-lg font-black uppercase italic tracking-wide text-white">
                {playerName}
              </h3>
              <span className="shrink-0 rounded-lg bg-purple-500/16 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-purple-200 shadow-[inset_0_0_0_1px_rgba(168,85,247,0.16)]">
                Traspaso
              </span>
            </div>

            <div className="mt-3 flex items-center gap-2 min-w-0">
              <TeamLogo logo={fromLogo} name={fromTeamName} />
              <span className="min-w-0 truncate text-[10px] font-black uppercase text-gray-500">{fromTeamName}</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-purple-200" />
              <TeamLogo logo={toLogo} name={toTeamName} />
              <span className="min-w-0 truncate text-[10px] font-black uppercase text-gray-100">{toTeamName}</span>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500">
                <BadgeDollarSign className="h-3.5 w-3.5 text-emerald-300" />
                Monto
              </span>
              <span className="text-sm font-black text-emerald-300">{formatPriceShort(Number(transfer?.price) || 0)}</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
});
