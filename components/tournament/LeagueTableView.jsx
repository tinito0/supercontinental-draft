import React, { memo } from 'react';
import { Trash2 } from 'lucide-react';
import { DEFAULT_LOGO } from '../../utils/constants.js';
import { TournamentPanel, TournamentSectionTitle } from '../TournamentUI.jsx';
import { TeamSelect } from './TournamentTeamsContext.jsx';

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
              <thead className={`bg-[#111722] text-slate-400 uppercase tracking-wider font-bold border-b border-white/[0.08] ${isObsMode ? 'text-sm' : 'text-xs'}`}>
                <tr>
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th className={isObsMode ? 'px-6 py-2.5' : 'px-4 py-3'}>Club</th>
                  <th className="px-2 text-center w-10 sm:w-12 py-3">PJ</th>
                  <th className="px-2 text-center w-10 sm:w-12 py-3 text-emerald-400">G</th>
                  <th className="px-2 text-center w-10 sm:w-12 py-3 text-amber-400">GP</th>
                  <th className="px-2 text-center w-10 sm:w-12 py-3 text-rose-400">P</th>
                  <th className="px-2 text-center w-10 sm:w-12 py-3">GF</th>
                  <th className="px-2 text-center w-10 sm:w-12 py-3">GC</th>
                  <th className="px-2 text-center w-10 sm:w-12 py-3">DG</th>
                  <th className="px-2 text-center w-28 py-3 hidden md:table-cell">Forma</th>
                  <th className={`${isObsMode ? 'px-6 py-2.5' : 'px-4 py-3'} text-right text-white font-black w-14 sm:w-16 bg-white/[0.02]`}>PTS</th>
                </tr>
              </thead>
              <tbody className={`divide-y divide-white/[0.05] font-medium ${isObsMode ? 'text-base' : 'text-xs sm:text-sm'}`}>
                {(isEditing
                  ? localData.league
                  : localData.league.filter(team => team.name && team.name !== 'Club...')
                ).slice(0, 12).map((team, idx) => {
                  const isCurrentUser = userTeamName && userTeamName.trim().toLowerCase() === team.name?.trim().toLowerCase();
                  const isTop4 = idx < 4;
                  const isSilver = idx >= 4 && idx < 12;
                  const qualificationBorder = isTop4 ? 'border-l-[4px] border-[#00b4d8]' : isSilver ? 'border-l-[4px] border-slate-600' : 'border-l-[4px] border-transparent';
                  const rowHighlightClass = isCurrentUser ? 'bg-[#00b4d8]/10' : 'hover:bg-white/[0.03]';
                  const numberColor = isTop4 ? 'text-[#00b4d8] font-black' : 'text-slate-400 font-bold';

                  // Derivar forma reciente (últimos 5 partidos)
                  const teamNameLower = team.name?.trim().toLowerCase();
                  const teamMatches = (localData.matches || [])
                    .filter(m => m.status === 'completed' && (
                      m.homeTeam?.trim().toLowerCase() === teamNameLower ||
                      m.awayTeam?.trim().toLowerCase() === teamNameLower
                    ));
                  const recentTeamMatches = teamMatches.slice(-5);
                  const formResults = recentTeamMatches.map(m => {
                    const isHome = m.homeTeam?.trim().toLowerCase() === teamNameLower;
                    const myScore = Number(isHome ? m.homeScore : m.awayScore) || 0;
                    const oppScore = Number(isHome ? m.awayScore : m.homeScore) || 0;
                    const oppName = isHome ? m.awayTeam : m.homeTeam;
                    if (myScore > oppScore) return { char: 'V', bg: 'bg-emerald-500 text-white', title: `Victoria vs ${oppName} (${myScore}-${oppScore})` };
                    if (myScore === oppScore) return { char: 'P', bg: 'bg-amber-500 text-slate-950 font-black', title: `Penales vs ${oppName} (${myScore}-${oppScore})` };
                    return { char: 'D', bg: 'bg-rose-500 text-white', title: `Derrota vs ${oppName} (${myScore}-${oppScore})` };
                  });

                  // Rellenar hasta 5 con puntos neutrales
                  const paddedForm = [...formResults];
                  while (paddedForm.length < 5) {
                    paddedForm.push({ char: '•', bg: 'bg-transparent text-slate-600 font-bold', title: 'Por disputar' });
                  }

                  return (
                    <tr key={team.id || idx} className={`${qualificationBorder} ${rowHighlightClass} transition-colors h-11 text-slate-200`}>
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
                              className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition shrink-0"
                              title="Vaciar este lugar"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ) : (
                          <span className={`whitespace-nowrap font-bold text-xs sm:text-sm tracking-wide ${isTop4 ? 'text-white' : 'text-slate-300'}`}>
                            {team.name}
                          </span>
                        )}
                      </td>
                      <td className="px-2 text-center text-slate-400 tabular-nums">{team.pj}</td>
                      <td className="px-2 text-center font-bold text-emerald-400 tabular-nums">
                        {isEditing ? (
                          <input type="number" className="w-9 bg-slate-900 border border-white/20 rounded text-center text-xs text-white" value={team.pg} onChange={(e) => updateLeagueTeam(idx, 'pg', e.target.value)} />
                        ) : team.pg}
                      </td>
                      <td className="px-2 text-center font-bold text-amber-400 tabular-nums">
                        {isEditing ? (
                          <input type="number" className="w-9 bg-slate-900 border border-white/20 rounded text-center text-xs text-white" value={team.gpen} onChange={(e) => updateLeagueTeam(idx, 'gpen', e.target.value)} />
                        ) : team.gpen}
                      </td>
                      <td className="px-2 text-center font-bold text-rose-400 tabular-nums">
                        {isEditing ? (
                          <input type="number" className="w-9 bg-slate-900 border border-white/20 rounded text-center text-xs text-white" value={team.pp} onChange={(e) => updateLeagueTeam(idx, 'pp', e.target.value)} />
                        ) : team.pp}
                      </td>
                      <td className="px-2 text-center text-slate-400 tabular-nums">
                        {isEditing ? (
                          <input type="number" className="w-9 bg-slate-900 border border-white/20 rounded text-center text-xs text-white" value={team.gf} onChange={(e) => updateLeagueTeam(idx, 'gf', e.target.value)} />
                        ) : team.gf}
                      </td>
                      <td className="px-2 text-center text-slate-400 tabular-nums">
                        {isEditing ? (
                          <input type="number" className="w-9 bg-slate-900 border border-white/20 rounded text-center text-xs text-white" value={team.gc} onChange={(e) => updateLeagueTeam(idx, 'gc', e.target.value)} />
                        ) : team.gc}
                      </td>
                      <td className="px-2 text-center font-semibold text-slate-300 tabular-nums">{(Number(team.gf) || 0) - (Number(team.gc) || 0)}</td>
                      <td className="px-2 py-1 text-center hidden md:table-cell">
                        <div className="flex items-center justify-center gap-1">
                          {paddedForm.map((r, rIdx) => (
                            <span
                              key={rIdx}
                              title={r.title}
                              className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black ${r.bg} shadow-sm`}
                            >
                              {r.char}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className={`${isObsMode ? 'px-6 text-lg' : 'px-4 text-sm sm:text-base'} text-right font-black text-white tabular-nums bg-white/[0.02]`}>{team.pts}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Leyenda SofaScore */}
          <div className="p-3 border-t border-white/[0.06] bg-[#0c1017] flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00b4d8]" />
                <span className="font-semibold text-slate-300">Puestos 1-4: Cuartos de Final (Oro)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                <span className="font-semibold text-slate-300">Puestos 5-12: Repechaje (Copa de Plata)</span>
              </div>
            </div>
            <div className="text-[11px] font-mono text-slate-500">
              PG = 2 pts • GPEN = 1 pt • PP = 0 pts
            </div>
          </div>
        </TournamentPanel>
      </div>
    </div>
  );
});

export default LeagueTableView;
