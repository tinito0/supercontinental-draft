import React, { memo } from 'react';
import { Trophy } from 'lucide-react';
import { DEFAULT_LOGO } from '../../utils/constants.js';
import { TeamSelect } from './TournamentTeamsContext.jsx';

export const BracketFork = memo(function BracketFork({ height = 180, tone = 'slate' }) {
  const strokeColor = tone === 'gold' ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.18)';
  return (
    <div className="w-10 shrink-0 flex items-center justify-center relative self-stretch">
      <svg className="w-full h-full" viewBox="0 0 40 100" preserveAspectRatio="none" fill="none">
        <path
          d="M 0,25 H 20 V 75 H 0 M 20,50 H 40"
          stroke={strokeColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
});

export const MatchCard = memo(function MatchCard({
  match,
  stage,
  index,
  isFinal,
  isEditing,
  updateMatch,
  getTeamLogo,
  titleOverride,
  seedA,
  seedB,
}) {
  if (!match) {
    return (
      <div className="w-[240px] sm:w-[260px] h-24 bg-surface/80 border border-dashed border-line/[0.12] flex flex-col items-center justify-center text-ink-3 font-medium text-xs rounded-xl p-3 shadow-sm">
        <span className="text-[11px] font-semibold text-ink-3">Por definir</span>
        <span className="text-[9px] text-ink-3 mt-0.5">Cruce pendiente</span>
      </div>
    );
  }

  let cardTitle = titleOverride || '';
  if (!cardTitle) {
    if (isFinal) cardTitle = 'GRAN FINAL';
    else if (stage === 'semis') cardTitle = `SEMIFINAL ${index + 1}`;
    else if (stage === 'quarters') cardTitle = `CUARTOS ${index + 1}`;
    else if (stage === 'rep_r1') cardTitle = `PRELIMINAR ${index + 1}`;
    else if (stage === 'rep_r2') cardTitle = `CUARTOS PLATA ${index + 1}`;
    else if (stage === 'rep_semis') cardTitle = `SEMIFINAL PLATA ${index + 1}`;
    else if (stage === 'rep_final') cardTitle = 'GRAN FINAL PLATA';
  }

  const hasScoreA = match.scoreA !== '' && match.scoreA !== undefined && match.scoreA !== null;
  const hasScoreB = match.scoreB !== '' && match.scoreB !== undefined && match.scoreB !== null;
  const isCompleted = hasScoreA && hasScoreB;
  const numA = parseInt(match.scoreA) || 0;
  const numB = parseInt(match.scoreB) || 0;
  const teamAWon = isCompleted && numA > numB;
  const teamBWon = isCompleted && numB > numA;

  return (
    <div
      className={`w-[240px] sm:w-[260px] rounded-xl overflow-hidden bg-surface border transition-all duration-200 shadow-md ${
        isFinal
          ? 'border-warning/60 shadow-[0_0_24px_rgba(245,158,11,0.14)] ring-1 ring-amber-500/30'
          : 'border-line/[0.12] hover:border-white/[0.18]'
      }`}
    >
      {/* Top Header Bar */}
      <div
        className={`px-3 py-1.5 flex items-center justify-between border-b text-[10px] font-bold uppercase tracking-wider ${
          isFinal
            ? 'bg-amber-950/40 text-warning-soft border-warning/30'
            : 'bg-raised text-ink-3 border-line/[0.08]'
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          {isFinal && <Trophy className="w-3.5 h-3.5 text-warning-soft shrink-0" />}
          <span className="truncate">{cardTitle}</span>
        </div>
        <div>
          {isCompleted ? (
            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-success/15 text-success-soft border border-success/30">
              FIN
            </span>
          ) : (
            <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-white/[0.04] text-ink-3">
              PEND
            </span>
          )}
        </div>
      </div>

      {/* Teams Body */}
      <div className="flex flex-col divide-y divide-white/[0.05]">
        {[
          { key: 'teamA', scoreKey: 'scoreA', isWinner: teamAWon, isLoser: teamBWon, seed: seedA },
          { key: 'teamB', scoreKey: 'scoreB', isWinner: teamBWon, isLoser: teamAWon, seed: seedB },
        ].map(({ key, scoreKey, isWinner, isLoser, seed }) => {
          const name = match[key];
          const score = match[scoreKey];
          const logo = getTeamLogo ? getTeamLogo(name) : DEFAULT_LOGO;

          return (
            <div
              key={key}
              className={`flex items-center justify-between px-3 py-2 transition-colors ${
                isWinner ? 'bg-success/[0.08]' : ''
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {isWinner ? (
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-transparent shrink-0" />
                )}
                {seed && (
                  <span className="text-[10px] text-ink-3 font-mono font-bold shrink-0">{seed}</span>
                )}
                <img
                  src={logo}
                  alt=""
                  width={20}
                  height={20}
                  className="w-5 h-5 object-contain shrink-0 drop-shadow"
                  onError={(e) => { e.currentTarget.src = DEFAULT_LOGO; }}
                />
                {isEditing ? (
                  <TeamSelect
                    value={name}
                    onChange={(value) => updateMatch(stage, index, key, value)}
                    className="w-full px-2 py-0.5 text-xs font-semibold"
                  />
                ) : (
                  <span
                    className={`text-xs truncate tracking-wide ${
                      isWinner
                        ? 'font-bold text-ink'
                        : isLoser
                        ? 'text-ink-3 font-medium'
                        : 'text-ink-2 font-medium'
                    }`}
                    title={name || 'A definir'}
                  >
                    {name || 'A definir'}
                  </span>
                )}
              </div>

              {isEditing ? (
                <input
                  type="number"
                  value={score ?? ''}
                  onChange={(e) => updateMatch(stage, index, scoreKey, e.target.value)}
                  className="w-8 h-6 bg-surface text-center rounded text-ink text-xs border border-white/20 outline-none font-bold ml-2"
                />
              ) : (
                <div
                  className={`min-w-[24px] h-6 flex items-center justify-center rounded px-1.5 ml-2 font-mono text-xs font-bold tabular-nums ${
                    isWinner
                      ? 'bg-success/20 text-success-soft border border-success/30'
                      : isLoser
                      ? 'text-ink-3'
                      : 'text-ink-3'
                  }`}
                >
                  {score !== '' && score !== undefined && score !== null ? score : '-'}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default MatchCard;
