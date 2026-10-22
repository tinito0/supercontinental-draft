import React, { memo } from 'react';
import { Trash2 } from 'lucide-react';
import { DEFAULT_LOGO } from '../../utils/constants.js';
import { TournamentPanel, TournamentSectionTitle } from '../TournamentUI.jsx';
import { TeamSelect } from './TournamentTeamsContext.jsx';
import { teamMatchResult } from '../../utils/competitionRules.js';

const GOLD_CUP_PLACES = 8;
// Forma reciente: victoria en los 90', definido por penales (ganado o perdido), derrota, o empate sin la tanda cargada.
const FORM_STYLES = {
  win: { char: 'V', bg: 'bg-emerald-500 text-ink', label: 'Victoria' },
  shootoutWin: { char: 'P', bg: 'bg-amber-500 text-slate-950 font-bold', label: 'Ganó por penales' },
  shootoutLoss: { char: 'P', bg: 'bg-amber-700 text-ink font-bold', label: 'Perdió por penales' },
  loss: { char: 'D', bg: 'bg-rose-500 text-ink', label: 'Derrota' },
  draw: { char: 'E', bg: 'bg-slate-500 text-ink font-bold', label: 'Empate sin tanda cargada' },
};

export const LeagueTableView = memo(function LeagueTableView({
  localData,
  isEditing,
  isObsMode,
  userTeamName,
  getTeamLogo,
  updateLeagueTeam,
  clearLeagueSlot,
}) {
  return (
    <div className={`flex flex-col items-center w-full ${isObsMode ? 'h-full justify-start pt-8' : 'py-2'}`}>
      <TournamentSectionTitle title="SUPERCONTINENTAL LEAGUE" subtitle="TABLA GENERAL DE POSICIONES" compact={isObsMode} />
      <div className={`w-full ${isObsMode ? 'max-w-[1640px] px-12 mt-1' : 'max-w-5xl px-2 sm:px-4 mt-2'}`}>
        <TournamentPanel title="Clasificación Oficial (12 Equipos)" className="[&>div:last-child]:p-0">
          <div className="overflow-x-auto custom-scrollbar -mx-2 px-2">
            <table className="w-full text-left border-collapse min-w-[620px] text-sm">
              <thead className={`bg-raised text-ink-3 uppercase tracking-wider font-bold border-b border-line/[0.12] ${isObsMode ? 'text-sm' : 'text-xs'}`}>
                <tr>
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th className={isObsMode ? 'px-6 py-2.5' : 'px-4 py-3'}>Club</th>
                  <th className="px-2 text-center w-10 sm:w-12 py-3">PJ</th>
                  <th className="px-2 text-center w-10 sm:w-12 py-3 text-success-soft">G</th>
                  <th className="px-2 text-center w-10 sm:w-12 py-3 text-warning-soft">GP</th>
                  <th className="px-2 text-center w-10 sm:w-12 py-3 text-danger-soft">P</th>
                  <th className="px-2 text-center w-10 sm:w-12 py-3">GF</th>
                  <th className="px-2 text-center w-10 sm:w-12 py-3">GC</th>
                  <th className="px-2 text-center w-10 sm:w-12 py-3">DG</th>
                  <th className="px-2 text-center w-28 py-3 hidden md:table-cell">Forma</th>
                  <th className={`${isObsMode ? 'px-6 py-2.5' : 'px-4 py-3'} text-right text-ink font-bold w-14 sm:w-16 bg-white/[0.02]`}>PTS</th>
                </tr>
              </thead>
              <tbody className={`divide-y divide-white/[0.05] font-medium ${isObsMode ? 'text-base' : 'text-xs sm:text-sm'}`}>
                {(isEditing
                  ? localData.league
                  : localData.league.filter(team => team.name && team.name !== 'Club...')
                ).slice(0, 12).map((team, idx) => {
                  const isCurrentUser = userTeamName && userTeamName.trim().toLowerCase() === team.name?.trim().toLowerCase();
                  // Puestos 1-8: cuartos de la Copa de Oro; 9-12: Copa de Plata (bracketModel / competitionRules).
                  const isGold = idx < GOLD_CUP_PLACES;
                  const isSilver = idx >= GOLD_CUP_PLACES && idx < 12;
                  const qualificationBorder = isGold ? 'border-l-[4px] border-accent' : isSilver ? 'border-l-[4px] border-line/20' : 'border-l-[4px] border-transparent';
                  const rowHighlightClass = isCurrentUser ? 'bg-accent/10' : 'hover:bg-white/[0.03]';
                  const numberColor = isGold ? 'text-accent font-bold' : 'text-ink-3 font-bold';

                  // Forma reciente (últimos 5 partidos con resultado válido).
                  const formResults = (localData.matches || [])
                    .map(m => teamMatchResult(team.name, m))
                    .filter(Boolean)
                    .slice(-5)
                    .map(({ result, scored, conceded, opponent }) => ({ ...FORM_STYLES[result], title: `${FORM_STYLES[result].label} vs ${opponent} (${scored}-${conceded})` }));

                  // Rellenar hasta 5 con puntos neutrales
                  const paddedForm = [...formResults];
                  while (paddedForm.length < 5) {
                    paddedForm.push({ char: '•', bg: 'bg-transparent text-ink-3 font-bold', title: 'Por disputar' });
                  }

                  return (
                    <tr key={team.id || idx} className={`${qualificationBorder} ${rowHighlightClass} transition-colors h-11 text-ink-2`}>
                      <td className={`text-center text-xs font-mono tabular-nums ${numberColor}`}>
                        {idx + 1}
                      </td>
                      <td className={`flex items-center ${isObsMode ? 'gap-4 px-6 py-1.5' : 'gap-2.5 sm:gap-3 px-3 sm:px-4 py-2'}`}>
                        <img
                          src={getTeamLogo(team.name)}
                          alt=""
                          width={28}
                          height={28}
                          className="w-6 h-6 sm:w-7 sm:h-7 object-contain flex-shrink-0 drop-shadow"
                          onError={(e) => { e.currentTarget.src = DEFAULT_LOGO; }}
                        />
                        {isEditing ? (
                          <div className="flex items-center gap-1.5 w-full">
                            <TeamSelect
                              value={team.name === 'Club...' ? '' : team.name}
                              onChange={(value) => updateLeagueTeam(idx, 'name', value)}
                              className="w-full px-2 py-1 text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => clearLeagueSlot(idx)}
                              className="p-1 rounded text-ink-3 hover:text-danger-soft hover:bg-danger/10 transition shrink-0"
                              title="Vaciar este lugar"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ) : (
                          <span className={`whitespace-nowrap font-bold text-xs sm:text-sm tracking-wide ${isGold ? 'text-ink' : 'text-ink-2'}`}>
                            {team.name}
                          </span>
                        )}
                      </td>
                      <td className="px-2 text-center text-ink-3 tabular-nums">{team.pj}</td>
                      <td className="px-2 text-center font-bold text-success-soft tabular-nums">
                        {isEditing ? (
                          <input type="number" className="w-9 bg-surface border border-white/20 rounded text-center text-xs text-ink" value={team.pg} onChange={(e) => updateLeagueTeam(idx, 'pg', e.target.value)} />
                        ) : team.pg}
                      </td>
                      <td className="px-2 text-center font-bold text-warning-soft tabular-nums">
                        {isEditing ? (
                          <input type="number" className="w-9 bg-surface border border-white/20 rounded text-center text-xs text-ink" value={team.gpen} onChange={(e) => updateLeagueTeam(idx, 'gpen', e.target.value)} />
                        ) : team.gpen}
                      </td>
                      <td className="px-2 text-center font-bold text-danger-soft tabular-nums">
                        {isEditing ? (
                          <input type="number" className="w-9 bg-surface border border-white/20 rounded text-center text-xs text-ink" value={team.pp} onChange={(e) => updateLeagueTeam(idx, 'pp', e.target.value)} />
                        ) : team.pp}
                      </td>
                      <td className="px-2 text-center text-ink-3 tabular-nums">
                        {isEditing ? (
                          <input type="number" className="w-9 bg-surface border border-white/20 rounded text-center text-xs text-ink" value={team.gf} onChange={(e) => updateLeagueTeam(idx, 'gf', e.target.value)} />
                        ) : team.gf}
                      </td>
                      <td className="px-2 text-center text-ink-3 tabular-nums">
                        {isEditing ? (
                          <input type="number" className="w-9 bg-surface border border-white/20 rounded text-center text-xs text-ink" value={team.gc} onChange={(e) => updateLeagueTeam(idx, 'gc', e.target.value)} />
                        ) : team.gc}
                      </td>
                      <td className="px-2 text-center font-semibold text-ink-2 tabular-nums">{(Number(team.gf) || 0) - (Number(team.gc) || 0)}</td>
                      <td className="px-2 py-1 text-center hidden md:table-cell">
                        <div className="flex items-center justify-center gap-1">
                          {paddedForm.map((r, rIdx) => (
                            <span
                              key={rIdx}
                              title={r.title}
                              className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${r.bg} shadow-sm`}
                            >
                              {r.char}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className={`${isObsMode ? 'px-6 text-lg' : 'px-4 text-sm sm:text-base'} text-right font-bold text-ink tabular-nums bg-white/[0.02]`}>{team.pts}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Leyenda SofaScore */}
          <div className="p-3 border-t border-line/[0.08] bg-surface flex flex-wrap items-center justify-between gap-3 text-xs text-ink-3">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-accent" />
                <span className="font-semibold text-ink-2">Puestos 1-8: Copa de Oro (cuartos)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                <span className="font-semibold text-ink-2">Puestos 9-12: Copa de Plata</span>
              </div>
            </div>
            <div className="text-[11px] font-mono text-ink-3">
              PG = 2 pts • GPEN = 1 pt • PP = 0 pts
            </div>
          </div>
        </TournamentPanel>
      </div>
    </div>
  );
});

export default LeagueTableView;
