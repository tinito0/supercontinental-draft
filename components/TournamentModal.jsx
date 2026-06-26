import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import { X, Save, Edit2, Trophy, ShieldAlert, LayoutGrid, Crown, User, Star } from 'lucide-react';
import { DEFAULT_LOGO } from '../utils/constants.js';
import { normalizeTournamentView } from '../utils/tournamentViews.js';
import { TournamentActionButton, TournamentPanel, TournamentSectionTitle, TournamentTabButton, tournamentBackdropClass, tournamentShellClass } from './TournamentUI.jsx';

const MatchCard = memo(({ match, stage, index, isFinal, isEditing, updateMatch, getTeamLogo, titleOverride }) => {
  if (!match) return <div className="w-[400px] h-48 bg-gray-900/50 border border-red-900/50 flex items-center justify-center text-red-500 font-mono text-xs">Error Data Match</div>;

  let cardTitle = titleOverride || "";
  if (!cardTitle) {
    if (isFinal) cardTitle = "GRAN FINAL";
    else if (stage === 'semis') cardTitle = "SEMIFINAL";
    else if (stage === 'quarters') cardTitle = "CUARTOS DE FINAL";
    else if (stage === 'rep_r1') cardTitle = (index === 0 || index === 2) ? "PRELIMINAR" : "REPECHAJE QF";
    else if (stage === 'rep_r2') cardTitle = "FASE FUSIÓN";
    else if (stage === 'rep_semis') cardTitle = "SEMIFINAL PLATA";
    else if (stage === 'rep_final') cardTitle = "GRAN FINAL PLATA";
  }

  let widthClass = 'w-[400px]', heightClass = 'h-48', textTitleSize = 'text-sm tracking-widest', textNameSize = 'text-2xl', logoSize = 'w-16 h-16';
  if (stage === 'final') { widthClass = 'w-[650px]'; heightClass = 'h-80'; textTitleSize = 'text-xl tracking-[0.5em]'; textNameSize = 'text-3xl'; logoSize = 'w-28 h-28'; }
  else if (['semis', 'quarters', 'rep_final'].includes(stage)) { widthClass = 'w-[480px]'; heightClass = 'h-56'; textNameSize = 'text-xl'; }

  const scaleClass = isFinal ? 'scale-105 z-30' : 'z-10';
  const containerClass = isFinal ? 'bg-[#0f172a] border border-yellow-500/60 shadow-[0_0_120px_rgba(234,179,8,0.4)]' : 'bg-[#1e293b] border border-slate-600/50 shadow-2xl';
  const headerClass = isFinal ? 'bg-gradient-to-r from-yellow-900/70 to-amber-900/70 text-yellow-100 border-b border-yellow-600/30' : 'bg-[#020617]/60 text-slate-300 border-b border-slate-700/50';

  return (
    <div className={`relative flex flex-col rounded-3xl overflow-hidden transition-transform duration-300 hover:scale-[1.02] ${widthClass} ${heightClass} ${containerClass} ${scaleClass}`}>
      <div className={`py-2 px-4 text-center font-black uppercase ${textTitleSize} ${headerClass}`}>{cardTitle}</div>
      <div className="flex-1 flex flex-col justify-center px-6 gap-3">
        {['teamA', 'teamB'].map((teamKey) => {
          const name = match[teamKey];
          const scoreKey = teamKey === 'teamA' ? 'scoreA' : 'scoreB';
          const score = match[scoreKey];
          const logo = getTeamLogo ? getTeamLogo(name) : DEFAULT_LOGO;
          const opponentScore = match[teamKey === 'teamA' ? 'scoreB' : 'scoreA'];
          const isWinner = score !== '' && opponentScore !== '' && parseInt(score) > parseInt(opponentScore);
          const isLoser = score !== '' && opponentScore !== '' && parseInt(score) < parseInt(opponentScore);
          const rowStyle = isLoser ? 'opacity-40 grayscale bg-black/20' : isWinner ? 'bg-gradient-to-r from-white/10 to-transparent shadow-inner' : '';
          const textStyle = isWinner ? 'text-[#4ade80] drop-shadow-[0_0_15px_rgba(74,222,128,0.7)]' : isLoser ? 'text-slate-500' : 'text-slate-200';

          return (
            <div key={teamKey} className={`flex justify-between items-center h-full max-h-28 rounded-2xl px-4 transition-all border border-transparent ${rowStyle}`}>
              <div className="flex items-center gap-6 overflow-hidden w-full">
                <div className="relative flex-shrink-0">
                  <div className={`absolute inset-0 bg-white/10 blur-xl rounded-full ${isWinner ? 'opacity-60' : 'opacity-0'}`}></div>
                  <img src={logo} className={`${logoSize} object-contain relative z-10 drop-shadow-xl ${!name || name === 'TBD' ? 'opacity-30' : ''}`} onError={(e) => e.target.src = DEFAULT_LOGO} />
                </div>
                {isEditing ? (
                  <input type="text" value={name} onChange={(e) => updateMatch(stage, index, teamKey, e.target.value)} className="bg-black/50 text-white w-full px-2 py-1 rounded text-lg border border-slate-600 outline-none font-bold" />
                ) : (
                  <span className={`${textNameSize} font-black truncate tracking-tight ${textStyle} leading-none pb-1`}>{name || 'TBD'}</span>
                )}
              </div>
              {isEditing ? (
                <input type="number" value={score} onChange={(e) => updateMatch(stage, index, scoreKey, e.target.value)} className="w-16 h-14 bg-black/50 text-center rounded text-white text-3xl border border-slate-600 outline-none font-bold" />
              ) : (
                <div className={`w-14 flex items-center justify-center font-mono font-black text-5xl ${isWinner ? 'text-[#4ade80]' : 'text-slate-600'}`}>{score !== '' ? score : '-'}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

const BracketPair = memo(({ matchTop, matchBottom, stage, idxTop, idxBottom, isEditing, updateGeneric, getTeamLogo, side = 'left', gap = 'gap-80', connectorHeight = '6.5rem' }) => {
  const isLeft = side === 'left';
  const handleUpdate = (s, index, field, value) => {
    updateGeneric(stage, index, field, value);
  };

  return (
    <div className={`flex flex-col justify-center ${gap} relative`}>
      <div className="relative z-10">
        <MatchCard match={matchTop} stage={stage} index={idxTop} isEditing={isEditing} updateMatch={handleUpdate} getTeamLogo={getTeamLogo} />
      </div>
      <div className="relative z-10">
        <MatchCard match={matchBottom} stage={stage} index={idxBottom} isEditing={isEditing} updateMatch={handleUpdate} getTeamLogo={getTeamLogo} />
      </div>
      <div className={`absolute w-16 border-slate-600/50 pointer-events-none ${isLeft ? 'right-0 border-r-4 rounded-r-3xl translate-x-full' : 'left-0 border-l-4 rounded-l-3xl -translate-x-full'}`} style={{ top: connectorHeight, bottom: connectorHeight }}>
        <div className={`absolute top-1/2 w-12 h-1 bg-slate-600/50 ${isLeft ? 'right-0 translate-x-full' : 'left-0 -translate-x-full'}`}></div>
      </div>
    </div>
  );
});

const SilverBranch = memo(({ side, matchesR1, matchR2, matchSemi, isEditing, updateGeneric, getTeamLogo }) => {
  const isLeft = side === 'left';
  const r1Idx = isLeft ? [0, 1] : [2, 3];
  const r2Idx = isLeft ? 0 : 1;
  const semiIdx = isLeft ? 0 : 1;

  return (
    <div className={`flex items-center gap-20 ${!isLeft ? 'flex-row-reverse' : ''}`}>
      <BracketPair
        matchTop={matchesR1[0]}
        matchBottom={matchesR1[1]}
        stage="rep_r1"
        idxTop={r1Idx[0]}
        idxBottom={r1Idx[1]}
        side={side}
        isEditing={isEditing}
        updateGeneric={(stage, index, field, value) => updateGeneric(['repechaje', 'r1'], index, field, value)}
        getTeamLogo={getTeamLogo}
        gap="gap-[28rem]"
        connectorHeight="6rem"
      />
      <div className="relative z-10">
        <MatchCard
          match={matchR2}
          stage="rep_r2"
          index={r2Idx}
          isEditing={isEditing}
          updateMatch={(stage, index, field, value) => updateGeneric(['repechaje', 'r2'], index, field, value)}
          getTeamLogo={getTeamLogo}
        />
        <div className={`absolute top-1/2 w-20 h-1 bg-slate-600/50 -z-10 ${isLeft ? '-right-20' : '-left-20'}`}></div>
      </div>
      <div className="relative z-10">
        <MatchCard
          match={matchSemi}
          stage="rep_semis"
          index={semiIdx}
          isEditing={isEditing}
          updateMatch={(stage, index, field, value) => updateGeneric(['repechaje', 'semis'], index, field, value)}
          getTeamLogo={getTeamLogo}
        />
        <div className={`absolute top-1/2 w-20 h-1 bg-slate-600/50 -z-10 ${isLeft ? '-right-20' : '-left-20'}`}></div>
      </div>
    </div>
  );
});

export const TournamentModal = memo(function TournamentModal({ isVisible, isPage, onClose, tournamentData, isAdmin, onUpdateTournament, allTeams, initialTab = 'groups', userTeamName }) {
  const [activeTab, setActiveTab] = useState(() => normalizeTournamentView(initialTab));
  const [isEditing, setIsEditing] = useState(false);
  const [localData, setLocalData] = useState(null);
  const isObsMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'obs';

  useEffect(() => {
    setActiveTab(normalizeTournamentView(initialTab));
  }, [initialTab]);

  // Close on Escape key
  useEffect(() => {
    if (!isVisible && !isPage) return;
    const handleEsc = (e) => { if (e.key === 'Escape' && onClose) onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isVisible, isPage, onClose]);

  useEffect(() => {
    if (tournamentData && !isEditing) {
      const safeData = JSON.parse(JSON.stringify(tournamentData));
      if (!safeData.league) safeData.league = [];
      while (safeData.league.length < 12) {
        safeData.league.push({ id: crypto.randomUUID(), name: 'Club...', pj: 0, pg: 0, gpen: 0, pp: 0, pts: 0, gf: 0, gc: 0 });
      }
      safeData.league.forEach(t => { if (!t.id) t.id = crypto.randomUUID(); });

      if (!safeData.bracket) safeData.bracket = { quarters: [], semis: [], final: {}, repechaje: { r1: [], r2: [], semis: [], final: {} } };
      if (!safeData.bracket.repechaje) safeData.bracket.repechaje = { r1: [], r2: [], semis: [], final: {} };

      const fillArray = (arr, requiredLength) => {
        if (!Array.isArray(arr)) arr = [];
        while (arr.length < requiredLength) {
          arr.push({ teamA: '', teamB: '', scoreA: '', scoreB: '' });
        }
        return arr;
      };

      safeData.bracket.repechaje.r1 = fillArray(safeData.bracket.repechaje.r1, 4);
      safeData.bracket.repechaje.r2 = fillArray(safeData.bracket.repechaje.r2, 2);
      safeData.bracket.repechaje.semis = fillArray(safeData.bracket.repechaje.semis, 2);
      safeData.bracket.quarters = fillArray(safeData.bracket.quarters, 4);
      safeData.bracket.semis = fillArray(safeData.bracket.semis, 2);

      // Estadísticas
      if (!safeData.topScorers) safeData.topScorers = Array(5).fill(null).map(() => ({ name: '', team: '', goals: '' }));
      if (!safeData.topAssisters) safeData.topAssisters = Array(5).fill(null).map(() => ({ name: '', team: '', assists: '' }));

      setLocalData(safeData);
    } else if (!tournamentData && !localData) {
      setLocalData({
        league: Array(12).fill(null).map(() => ({ id: crypto.randomUUID(), name: 'Club...', pj: 0, pg: 0, gpen: 0, pp: 0, pts: 0, gf: 0, gc: 0 })),
        bracket: {
          quarters: Array(4).fill(null).map(() => ({ teamA: '', teamB: '', scoreA: '', scoreB: '' })),
          semis: Array(2).fill(null).map(() => ({ teamA: '', teamB: '', scoreA: '', scoreB: '' })),
          final: { teamA: '', teamB: '', scoreA: '', scoreB: '' },
          repechaje: {
            r1: Array(4).fill(null).map(() => ({ teamA: '', teamB: '', scoreA: '', scoreB: '' })),
            r2: Array(2).fill(null).map(() => ({ teamA: '', teamB: '', scoreA: '', scoreB: '' })),
            semis: Array(2).fill(null).map(() => ({ teamA: '', teamB: '', scoreA: '', scoreB: '' })),
            final: { teamA: '', teamB: '', scoreA: '', scoreB: '' }
          }
        },
        topScorers: Array(5).fill(null).map(() => ({ name: '', team: '', goals: '' })),
        topAssisters: Array(5).fill(null).map(() => ({ name: '', team: '', assists: '' }))
      });
    }
  }, [tournamentData, isEditing]);

  const getTeamLogo = useCallback((teamName) => {
    if (!teamName || !allTeams) return DEFAULT_LOGO;
    const target = teamName.trim().toLowerCase();
    const foundId = Object.keys(allTeams).find(id => allTeams[id].teamName.trim().toLowerCase() === target);
    return foundId ? allTeams[foundId].logoUrl : DEFAULT_LOGO;
  }, [allTeams]);

  const sortLeague = (data) => {
    const sorted = { ...data };
    sorted.league.sort((a, b) => {
      if (a.name === 'Club...') return 1;
      if (b.name === 'Club...') return -1;
      const ptsA = Number(a.pts) || 0;
      const ptsB = Number(b.pts) || 0;
      if (ptsB !== ptsA) return ptsB - ptsA;
      const dgA = (Number(a.gf) || 0) - (Number(a.gc) || 0);
      const dgB = (Number(b.gf) || 0) - (Number(b.gc) || 0);
      if (dgB !== dgA) return dgB - dgA;
      return (Number(b.gf) || 0) - (Number(a.gf) || 0);
    });
    return sorted;
  };

  const handleSave = () => {
    const sortedData = sortLeague(localData);
    setLocalData(sortedData);
    onUpdateTournament(sortedData);
    setIsEditing(false);
  };

  const updateMatchGeneric = useCallback((path, index, field, value) => {
    setLocalData(prev => {
      const newData = { ...prev };
      let currentBracket = newData.bracket = { ...prev.bracket };
      let target = currentBracket;
      for (let i = 0; i < path.length; i++) {
        const key = path[i];
        if (i === path.length - 1) break;
        if (Array.isArray(target[key])) target[key] = [...target[key]];
        else target[key] = { ...target[key] };
        target = target[key];
      }
      if (Array.isArray(target)) {
        while (target.length <= index) target.push({ teamA: '', teamB: '', scoreA: '', scoreB: '' });
        target[index] = { ...target[index], [field]: value };
      } else target[field] = value;
      return newData;
    });
  }, []);

  const updateGeneric = useCallback((s, i, f, v) => {
    const path = Array.isArray(s) ? s : [s];
    updateMatchGeneric(path, i, f, v);
  }, [updateMatchGeneric]);

  const updateLeagueTeam = (index, field, value) => {
    const newLeague = [...localData.league];
    const updatedTeam = { ...newLeague[index], [field]: value };
    if (['pg', 'gpen', 'pp'].includes(field)) {
      const pg = Number(updatedTeam.pg) || 0;
      const gpen = Number(updatedTeam.gpen) || 0;
      const pp = Number(updatedTeam.pp) || 0;
      updatedTeam.pj = pg + gpen + pp;
      updatedTeam.pts = (pg * 2) + (gpen * 1);
    }
    newLeague[index] = updatedTeam;
    setLocalData({ ...localData, league: newLeague });
  };

  const updateStat = (type, index, field, value) => {
    setLocalData(prev => {
      const newData = { ...prev };
      const list = [...newData[type]];
      list[index] = { ...list[index], [field]: value };
      newData[type] = list;
      return newData;
    });
  };

  const handleCopyObsLink = (view) => {
    const url = `${window.location.origin}/torneo?mode=obs&view=${view}`;
    navigator.clipboard.writeText(url);
    alert(`Enlace OBS de ${view} copiado al portapapeles!`);
  };

  if ((!isVisible && !isPage) || !localData) return null;

  return (
    <div
      className={isPage ? `w-full h-full animate-in fade-in duration-300 ${tournamentShellClass}` : `fixed inset-0 z-[100] animate-in fade-in duration-300 ${tournamentShellClass}`}
      onClick={!isPage && !isObsMode ? onClose : undefined}
    >
      <div className={`${tournamentBackdropClass} z-0`}></div>
      <div className="relative z-10 w-full h-full flex flex-col" onClick={e => e.stopPropagation()}>
        {!isObsMode && (
          <div className="flex justify-between items-center p-4 bg-slate-900/80 backdrop-blur border-b border-white/5 shrink-0">
            <div className="flex items-center gap-3">
              <img src={DEFAULT_LOGO} className="w-8 h-8 object-contain" alt="Logo" onError={(e) => e.target.style.display = 'none'} />
              <span className="font-bold text-white tracking-widest text-sm">SCL DATA HUB</span>
            </div>
            <div className="flex gap-1 bg-black/20 p-1 rounded-lg">
              <TournamentTabButton id="groups" label="Tabla" icon={LayoutGrid} activeTab={activeTab} onClick={setActiveTab} />
              <TournamentTabButton id="bracket" label="Brackets" icon={Trophy} activeTab={activeTab} onClick={setActiveTab} />
              {isAdmin && <TournamentTabButton id="repechaje" label="Plata (Admin)" icon={ShieldAlert} activeTab={activeTab} onClick={setActiveTab} />}
              {isAdmin && <TournamentTabButton id="stats" label="Goleadores (Admin)" icon={Star} activeTab={activeTab} onClick={setActiveTab} />}
            </div>
            <div className="flex gap-2">
              {isPage && (
                <>
                  <TournamentActionButton onClick={() => handleCopyObsLink('groups')}>
                    Link OBS Tabla
                  </TournamentActionButton>
                  <TournamentActionButton onClick={() => handleCopyObsLink('bracket')}>
                    Link OBS Bracket
                  </TournamentActionButton>
                  <TournamentActionButton tone="yellow" onClick={() => { const url = `${window.location.origin}/torneo?mode=obs&view=goleadores`; navigator.clipboard.writeText(url); alert('Enlace OBS Goleadores copiado!'); }}>
                    Link OBS Goleadores
                  </TournamentActionButton>
                  <TournamentActionButton tone="slate" onClick={() => { const url = `${window.location.origin}/torneo?mode=obs&view=bracket&tournament=copa-plata`; navigator.clipboard.writeText(url); alert('Enlace OBS Copa de Plata copiado!'); }}>
                    Link OBS Plata
                  </TournamentActionButton>
                </>
              )}
              {isAdmin && (
                <TournamentActionButton tone="green" onClick={() => isEditing ? handleSave() : setIsEditing(true)}>
                  {isEditing ? <><Save className="w-4 h-4 mr-2" /> Guardar</> : <><Edit2 className="w-4 h-4 mr-2" /> Editar</>}
                </TournamentActionButton>
              )}
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white transition" title="Cerrar"><X size={24} /></button>
            </div>
          </div>
        )}

        <div className="flex-grow flex flex-col items-center justify-center p-0 overflow-hidden relative">
          <div className={`w-[1920px] h-[1080px] flex flex-col items-center justify-center transition-transform duration-500 origin-center ${isObsMode ? 'scale-[0.85]' : 'scale-[0.80]'}`}>

            {activeTab === 'groups' && (
              <div className="flex flex-col items-center w-full h-full justify-center scale-100">
                <TournamentSectionTitle title="SUPERCONTINENTAL LEAGUE" subtitle="TABLA GENERAL" />
                <div className="w-full max-w-[1400px] px-8 mt-8">
                  <TournamentPanel title="Clasificación" className="[&>div:last-child]:p-0">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-black/40 text-slate-400 text-lg uppercase tracking-wider font-bold">
                        <tr>
                          <th className="px-8 py-4">Club</th>
                          <th className="px-2 py-4 text-center w-16">PJ</th>
                          <th className="px-2 py-4 text-center w-16 text-green-400">G</th>
                          <th className="px-2 py-4 text-center w-16 text-yellow-400">GP</th>
                          <th className="px-2 py-4 text-center w-16 text-red-400">P</th>
                          <th className="px-2 py-4 text-center w-16">GF</th>
                          <th className="px-2 py-4 text-center w-16">GC</th>
                          <th className="px-2 py-4 text-center w-16 text-blue-400">DG</th>
                          <th className="px-8 py-4 text-right text-white w-24">PTS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/30 text-xl font-medium">
                        {(isEditing ? localData.league : localData.league.filter(team => team.name && team.name !== 'Club...')).map((team, idx) => {
                          const isCurrentUser = userTeamName && userTeamName.trim().toLowerCase() === team.name?.trim().toLowerCase();
                          const isTop4 = idx < 4;
                          const isBottom3 = idx >= 9;
                          const rowHighlightClass = isCurrentUser ? 'bg-cyan-500/20 shadow-[inset_0_0_20px_rgba(6,182,212,0.3)] border-b-2 border-cyan-500' : 
                                                    isTop4 ? 'bg-green-500/5' : 
                                                    isBottom3 ? 'bg-red-500/5' : 'bg-slate-500/5';
                          const numberBg = isTop4 ? 'bg-green-600 text-black' : isBottom3 ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-500';
                          return (
                          <tr key={team.id || idx} className={`${rowHighlightClass} hover:bg-white/10 transition-colors`}>
                            <td className="px-8 py-3 flex items-center gap-6">
                              <div className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-sm font-black ${numberBg}`}>{idx + 1}</div>
                              <img src={getTeamLogo(team.name)} className="w-10 h-10 object-contain flex-shrink-0" onError={(e) => e.target.src = DEFAULT_LOGO} />
                              {isEditing ? <input type="text" className="bg-black/50 text-white w-full px-2 py-1 rounded border border-slate-600 outline-none" value={team.name} onChange={(e) => updateLeagueTeam(idx, 'name', e.target.value)} /> : <span className={`whitespace-nowrap font-bold ${isTop4 ? 'text-white' : 'text-slate-300'}`}>{team.name}</span>}
                            </td>
                            <td className="px-2 text-center text-slate-400">{team.pj}</td>
                            <td className="px-2 text-center text-green-500/80">{isEditing ? <input type="number" className="w-10 bg-black/50 text-center" value={team.pg} onChange={(e) => updateLeagueTeam(idx, 'pg', e.target.value)} /> : team.pg}</td>
                            <td className="px-2 text-center text-yellow-500/80">{isEditing ? <input type="number" className="w-10 bg-black/50 text-center" value={team.gpen} onChange={(e) => updateLeagueTeam(idx, 'gpen', e.target.value)} /> : team.gpen}</td>
                            <td className="px-2 text-center text-red-500/80">{isEditing ? <input type="number" className="w-10 bg-black/50 text-center" value={team.pp} onChange={(e) => updateLeagueTeam(idx, 'pp', e.target.value)} /> : team.pp}</td>
                            <td className="px-2 text-center text-slate-500">{isEditing ? <input type="number" className="w-10 bg-black/50 text-center" value={team.gf} onChange={(e) => updateLeagueTeam(idx, 'gf', e.target.value)} /> : team.gf}</td>
                            <td className="px-2 text-center text-slate-500">{isEditing ? <input type="number" className="w-10 bg-black/50 text-center" value={team.gc} onChange={(e) => updateLeagueTeam(idx, 'gc', e.target.value)} /> : team.gc}</td>
                            <td className="px-2 text-center font-bold text-blue-400">{(Number(team.gf) || 0) - (Number(team.gc) || 0)}</td>
                            <td className="px-8 text-right font-black text-2xl text-white">{team.pts}</td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {!isEditing && localData.league.filter(team => team.name && team.name !== 'Club...').length === 0 && (
                      <div className="p-12 text-center border-t border-slate-700/40">
                        <p className="text-2xl font-black text-white italic uppercase tracking-wider">Sin tabla cargada</p>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-[0.35em] mt-3">Carga equipos desde el panel del torneo</p>
                      </div>
                    )}
                  </TournamentPanel>
                </div>
              </div>
            )}

            {activeTab === 'bracket' && (
              <div className="flex flex-col items-center justify-center h-full">
                <TournamentSectionTitle title="SUPERCONTINENTAL LEAGUE" subtitle="ELIMINATORIAS ORO" />
                <div className="flex items-center justify-center gap-16 w-full mt-8">
                  {/* LEFT QUARTERS */}
                  <BracketPair matchTop={localData.bracket.quarters[0]} matchBottom={localData.bracket.quarters[1]} stage="quarters" idxTop={0} idxBottom={1} side="left" isEditing={isEditing} updateGeneric={updateGeneric} getTeamLogo={getTeamLogo} />
                  {/* LEFT SEMI */}
                  <div className="flex flex-col items-center justify-center z-10 relative">
                    <MatchCard match={localData.bracket.semis[0]} stage="semis" index={0} isEditing={isEditing} updateMatch={updateGeneric} getTeamLogo={getTeamLogo} />
                    <div className={`absolute top-1/2 w-16 h-1 bg-slate-600/50 -z-10 -right-16`}></div>
                  </div>
                  {/* FINAL */}
                  <div className="flex flex-col items-center justify-center z-20 px-4 relative -mt-16">
                    <div className="text-yellow-500 animate-pulse mb-6 drop-shadow-[0_0_50px_rgba(234,179,8,0.6)]"><Crown size={120} strokeWidth={1.5} /></div>
                    <MatchCard match={localData.bracket.final} stage="final" index={0} isFinal={true} isEditing={isEditing} updateMatch={updateGeneric} getTeamLogo={getTeamLogo} />
                  </div>
                  {/* RIGHT SEMI */}
                  <div className="flex flex-col items-center justify-center z-10 relative">
                    <MatchCard match={localData.bracket.semis[1]} stage="semis" index={1} isEditing={isEditing} updateMatch={updateGeneric} getTeamLogo={getTeamLogo} />
                    <div className={`absolute top-1/2 w-16 h-1 bg-slate-600/50 -z-10 -left-16`}></div>
                  </div>
                  {/* RIGHT QUARTERS */}
                  <BracketPair matchTop={localData.bracket.quarters[2]} matchBottom={localData.bracket.quarters[3]} stage="quarters" idxTop={2} idxBottom={3} side="right" isEditing={isEditing} updateGeneric={updateGeneric} getTeamLogo={getTeamLogo} />
                </div>
              </div>
            )}

            {activeTab === 'repechaje' && (
              <div className="flex flex-col items-center justify-center h-full w-full">
                <TournamentSectionTitle title="SUPERCONTINENTAL LEAGUE" subtitle="COPA DE PLATA" />
                <div className="flex items-center justify-center gap-24 w-full mt-12">
                  <SilverBranch side="left" matchesR1={[localData.bracket.repechaje.r1[0], localData.bracket.repechaje.r1[1]]} matchR2={localData.bracket.repechaje.r2[0]} matchSemi={localData.bracket.repechaje.semis[0]} isEditing={isEditing} updateGeneric={updateGeneric} getTeamLogo={getTeamLogo} />
                  <div className="flex flex-col items-center z-20 px-4 -mt-32">
                    <div className="text-slate-500 opacity-60 mb-8 drop-shadow-2xl"><Trophy size={130} strokeWidth={1} /></div>
                    <MatchCard match={localData.bracket.repechaje.final} stage="rep_final" index={0} isFinal={true} isEditing={isEditing} updateMatch={(s, i, f, v) => updateGeneric(['repechaje', 'final'], i, f, v)} getTeamLogo={getTeamLogo} />
                  </div>
                  <SilverBranch side="right" matchesR1={[localData.bracket.repechaje.r1[2], localData.bracket.repechaje.r1[3]]} matchR2={localData.bracket.repechaje.r2[1]} matchSemi={localData.bracket.repechaje.semis[1]} isEditing={isEditing} updateGeneric={updateGeneric} getTeamLogo={getTeamLogo} />
                </div>
              </div>
            )}

            {activeTab === 'stats' && (
              <div className="flex flex-col items-center w-full h-full justify-center scale-100 px-20">
                <TournamentSectionTitle title="LÍDERES INDIVIDUALES" subtitle="ESTADÍSTICAS REALES" />
                <div className="grid grid-cols-2 gap-20 w-full max-w-[1500px] mt-10">
                  {/* GOLEADORES */}
                  <div className="bg-[#0f172a] rounded-3xl border border-slate-700/50 overflow-hidden shadow-2xl">
                    <div className="bg-gradient-to-r from-yellow-600/20 to-transparent p-6 border-b border-slate-700/50 flex items-center gap-4">
                       <Trophy className="text-yellow-500 w-8 h-8" />
                       <h3 className="text-3xl font-black text-white italic tracking-wider">MÁXIMOS GOLEADORES</h3>
                    </div>
                    <div className="p-4 space-y-4">
                      {localData.topScorers.map((player, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-black/30 p-4 rounded-2xl border border-white/5">
                           <div className="flex items-center gap-4">
                             <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center font-black text-slate-400">{idx+1}</div>
                             <div className="flex flex-col">
                               {isEditing ? (
                                 <>
                                   <input placeholder="Nombre" value={player.name} onChange={e => updateStat('topScorers', idx, 'name', e.target.value)} className="bg-black/50 text-white px-2 py-1 mb-1 rounded border border-slate-700 text-sm"/>
                                   <input placeholder="Club" value={player.team} onChange={e => updateStat('topScorers', idx, 'team', e.target.value)} className="bg-black/50 text-slate-400 px-2 py-1 rounded border border-slate-700 text-xs"/>
                                 </>
                               ) : (
                                 <>
                                   <span className="text-xl font-black text-white uppercase">{player.name || '---'}</span>
                                   <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">{player.team || '---'}</span>
                                 </>
                               )}
                             </div>
                           </div>
                           <div className="flex items-center gap-3">
                             {isEditing ? (
                               <input type="number" value={player.goals} onChange={e => updateStat('topScorers', idx, 'goals', e.target.value)} className="w-16 bg-blue-600/20 text-blue-400 text-center font-black text-2xl rounded p-2" />
                             ) : (
                               <div className="text-4xl font-black text-blue-400">{player.goals || 0}</div>
                             )}
                             <span className="text-[10px] font-black text-slate-600 uppercase vertical-lr tracking-widest">GOLES</span>
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ASISTIDORES */}
                  <div className="bg-[#0f172a] rounded-3xl border border-slate-700/50 overflow-hidden shadow-2xl">
                    <div className="bg-gradient-to-r from-blue-600/20 to-transparent p-6 border-b border-slate-700/50 flex items-center gap-4">
                       <Star className="text-blue-500 w-8 h-8" />
                       <h3 className="text-3xl font-black text-white italic tracking-wider">MÁXIMOS ASISTIDORES</h3>
                    </div>
                    <div className="p-4 space-y-4">
                      {localData.topAssisters.map((player, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-black/30 p-4 rounded-2xl border border-white/5">
                           <div className="flex items-center gap-4">
                             <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center font-black text-slate-400">{idx+1}</div>
                             <div className="flex flex-col">
                               {isEditing ? (
                                 <>
                                   <input placeholder="Nombre" value={player.name} onChange={e => updateStat('topAssisters', idx, 'name', e.target.value)} className="bg-black/50 text-white px-2 py-1 mb-1 rounded border border-slate-700 text-sm"/>
                                   <input placeholder="Club" value={player.team} onChange={e => updateStat('topAssisters', idx, 'team', e.target.value)} className="bg-black/50 text-slate-400 px-2 py-1 rounded border border-slate-700 text-xs"/>
                                 </>
                               ) : (
                                 <>
                                   <span className="text-xl font-black text-white uppercase">{player.name || '---'}</span>
                                   <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">{player.team || '---'}</span>
                                 </>
                               )}
                             </div>
                           </div>
                           <div className="flex items-center gap-3">
                             {isEditing ? (
                               <input type="number" value={player.assists} onChange={e => updateStat('topAssisters', idx, 'assists', e.target.value)} className="w-16 bg-emerald-600/20 text-emerald-400 text-center font-black text-2xl rounded p-2" />
                             ) : (
                               <div className="text-4xl font-black text-emerald-400">{player.assists || 0}</div>
                             )}
                             <span className="text-[10px] font-black text-slate-600 uppercase vertical-lr tracking-widest">ASIST</span>
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
