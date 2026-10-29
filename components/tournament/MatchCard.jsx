import React, { memo } from 'react';
import { Trophy } from 'lucide-react';
import { DEFAULT_LOGO } from '../../utils/constants.js';
import { TeamSelect } from './TournamentTeamsContext.jsx';
import { getMatchWinner, isMatchCompleted, isTiedScore, shootoutLabel } from '../../utils/bracketModel.js';

export const BracketFork = memo(function BracketFork({ height = 180, tone = 'slate' }) {
  const strokeColor = tone === 'gold' ? 'rgba(147,176,242,0.5)' : 'rgba(255,255,255,0.18)';
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
  path,
}) {
  // `path` (ruta dentro de bracket) tiene prioridad sobre `stage` para guardar: lo usa el bracket compartido.
  const updateTarget = path || stage;
  if (!match) {
    return (
      <div className="w-full max-w-[260px] h-24 bg-surface/80 border border-dashed border-line/[0.12] flex flex-col items-center justify-center text-ink-3 font-medium text-xs rounded-xl p-3 shadow-sm">
        <span className="text-[11px] font-semibold text-ink-3">Por definir</span>
        <span className="text-xs text-ink-3 mt-0.5">Cruce pendiente</span>
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

  const isCompleted = isMatchCompleted(match);
  const winner = getMatchWinner(match);
  const teamAWon = winner === 'A';
  const teamBWon = winner === 'B';
  const isTied = isTiedScore(match);
  const penalties = shootoutLabel(match);

  return (
    <div
      className={`w-full max-w-[260px] rounded-xl overflow-hidden bg-surface border transition-[border-color,box-shadow] duration-base shadow-md ${
        isFinal
          ? 'border-accent-soft/50'
          : 'border-line/[0.12] hover:border-white/[0.18]'
      }`}
    >
      {/* Top Header Bar */}
      <div
        className={`px-3 py-1.5 flex items-center justify-between border-b text-xs font-bold uppercase tracking-wider ${
          isFinal
            ? 'bg-accent/15 text-accent-soft border-accent-soft/30'
            : 'bg-raised text-ink-3 border-line/[0.08]'
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          {isFinal && <Trophy className="w-3.5 h-3.5 text-accent-soft shrink-0" aria-hidden="true" />}
          <span className="truncate">{cardTitle}</span>
        </div>
        <div>
          {isCompleted ? (
            <span className="text-xs font-bold text-ink-2">Final</span>
          ) : (
            <span className="text-xs font-semibold text-ink-3">Por jugar</span>
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
                  <span className="text-xs text-ink-3 font-mono font-bold shrink-0">{seed}</span>
                )}
                <img
                  src={logo}
                  alt=""
                  width={20}
                  height={20}
                  className="w-5 h-5 object-contain shrink-0"
                  onError={(e) => { e.currentTarget.src = DEFAULT_LOGO; }}
                />
                {isEditing ? (
                  <TeamSelect
                    value={name}
                    onChange={(value) => updateMatch(updateTarget, index, key, value)}
                    aria-label={`${cardTitle}: ${key === 'teamA' ? 'equipo 1' : 'equipo 2'}`}
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
                  min="0"
                  inputMode="numeric"
                  value={score ?? ''}
                  aria-label={`${cardTitle}: goles de ${name || (key === 'teamA' ? 'equipo 1' : 'equipo 2')}`}
                  onChange={(e) => updateMatch(updateTarget, index, scoreKey, e.target.value)}
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

      {/* Empate: la tanda decide quién pasa (competitionRules.knockoutWinner). */}
      {isEditing && isTied && (
        <div className="flex items-center justify-between gap-2 border-t border-line/[0.08] bg-raised px-3 py-1.5 text-[11px] text-ink-3">
          <span>Penales</span>
          <span className="flex items-center gap-1">
            {['penaltiesA', 'penaltiesB'].map((field, i) => (
              <input
                key={field}
                type="number"
                min="0"
                inputMode="numeric"
                value={match[field] ?? ''}
                aria-label={`${cardTitle}: penales de ${match[i === 0 ? 'teamA' : 'teamB'] || `equipo ${i + 1}`}`}
                onChange={(e) => updateMatch(updateTarget, index, field, e.target.value)}
                className="w-8 h-6 bg-surface text-center rounded text-ink text-xs border border-white/20 outline-none font-bold"
              />
            ))}
          </span>
        </div>
      )}
      {!isEditing && penalties && (
        <div className="border-t border-line/[0.08] px-3 py-1 text-right text-xs font-semibold text-ink-3 tabular-nums">{penalties}</div>
      )}
      {!isEditing && isTied && !penalties && (
        <div className="border-t border-line/[0.08] px-3 py-1 text-right text-xs font-semibold text-warning-soft">Falta la tanda</div>
      )}
    </div>
  );
});

export default MatchCard;
