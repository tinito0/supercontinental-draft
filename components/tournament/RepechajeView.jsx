import React, { memo } from 'react';
import { Trophy } from 'lucide-react';
import { TournamentSectionTitle } from '../TournamentUI.jsx';
import { MatchCard } from './MatchCard.jsx';

export const RepechajeView = memo(function RepechajeView({
  localData,
  isEditing,
  isObsMode,
  getTeamLogo,
  updateGeneric,
}) {
  return (
    <div className={`flex flex-col items-center justify-center ${isObsMode ? 'h-full w-full' : 'py-4 w-full'}`}>
      <TournamentSectionTitle title="SUPERCONTINENTAL LEAGUE" subtitle="COPA DE PLATA — REPECHAJE" />
      <div className={`w-full ${isObsMode ? 'flex items-center justify-center gap-4 mt-6' : 'overflow-x-auto overflow-y-visible pb-12 pt-4 custom-scrollbar -mx-2 px-2'}`}>
        <div className={`${isObsMode ? 'flex items-center justify-center' : 'min-w-[1440px] flex items-center justify-center py-4 px-6 mx-auto'}`}>
          {/* WING LEFT: Preliminares 1 y 2 */}
          <div className="flex flex-col gap-12">
            <MatchCard
              match={localData.bracket.repechaje.r1[0]}
              stage="rep_r1"
              index={0}
              titleOverride="PRELIMINAR 1"
              isEditing={isEditing}
              updateMatch={(s, i, f, v) => updateGeneric(['repechaje', 'r1'], i, f, v)}
              getTeamLogo={getTeamLogo}
            />
            <MatchCard
              match={localData.bracket.repechaje.r1[1]}
              stage="rep_r1"
              index={1}
              titleOverride="PRELIMINAR 2"
              isEditing={isEditing}
              updateMatch={(s, i, f, v) => updateGeneric(['repechaje', 'r1'], i, f, v)}
              getTeamLogo={getTeamLogo}
            />
          </div>

          {/* SVG Fork Left to Fase Fusión 1 */}
          <div className="w-10 shrink-0 self-stretch flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 40 100" preserveAspectRatio="none" fill="none">
              <path d="M 0,25 H 20 V 75 H 0 M 20,50 H 40" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* Fase Fusión 1 */}
          <div className="flex flex-col justify-center">
            <MatchCard
              match={localData.bracket.repechaje.r2[0]}
              stage="rep_r2"
              index={0}
              titleOverride="CUARTOS PLATA 1"
              isEditing={isEditing}
              updateMatch={(s, i, f, v) => updateGeneric(['repechaje', 'r2'], i, f, v)}
              getTeamLogo={getTeamLogo}
            />
          </div>

          {/* Line Fusión 1 to Semifinal Plata 1 */}
          <div className="w-8 shrink-0 self-stretch flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 40 100" preserveAspectRatio="none" fill="none">
              <path d="M 0,50 H 40" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>

          {/* Semifinal Plata 1 */}
          <div className="flex flex-col justify-center">
            <MatchCard
              match={localData.bracket.repechaje.semis[0]}
              stage="rep_semis"
              index={0}
              titleOverride="SEMIFINAL PLATA 1"
              isEditing={isEditing}
              updateMatch={(s, i, f, v) => updateGeneric(['repechaje', 'semis'], i, f, v)}
              getTeamLogo={getTeamLogo}
            />
          </div>

          {/* Connector Semifinal Plata 1 to Final Plata */}
          <div className="w-10 shrink-0 self-stretch flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 40 100" preserveAspectRatio="none" fill="none">
              <path d="M 0,50 H 40" stroke="rgba(148,163,184,0.6)" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>

          {/* FINAL COPA DE PLATA (CENTER) */}
          <div className="flex flex-col items-center z-10 px-2">
            <div className="flex items-center gap-2 px-3.5 py-1 mb-2.5 rounded-full bg-raised border border-line/20 text-ink-2 text-xs font-bold uppercase tracking-wider shadow-lg">
              <Trophy className="w-4 h-4 text-ink-3" />
              <span>Final Copa de Plata</span>
            </div>
            <MatchCard
              match={localData.bracket.repechaje.final}
              stage="rep_final"
              index={0}
              isFinal={true}
              titleOverride="CAMPEÓN PLATA"
              isEditing={isEditing}
              updateMatch={(s, i, f, v) => updateGeneric(['repechaje', 'final'], i, f, v)}
              getTeamLogo={getTeamLogo}
            />
          </div>

          {/* Connector Final Plata to Semifinal Plata 2 */}
          <div className="w-10 shrink-0 self-stretch flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 40 100" preserveAspectRatio="none" fill="none">
              <path d="M 0,50 H 40" stroke="rgba(148,163,184,0.6)" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>

          {/* Semifinal Plata 2 */}
          <div className="flex flex-col justify-center">
            <MatchCard
              match={localData.bracket.repechaje.semis[1]}
              stage="rep_semis"
              index={1}
              titleOverride="SEMIFINAL PLATA 2"
              isEditing={isEditing}
              updateMatch={(s, i, f, v) => updateGeneric(['repechaje', 'semis'], i, f, v)}
              getTeamLogo={getTeamLogo}
            />
          </div>

          {/* Line Semifinal Plata 2 to Fusión 2 */}
          <div className="w-8 shrink-0 self-stretch flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 40 100" preserveAspectRatio="none" fill="none">
              <path d="M 0,50 H 40" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>

          {/* Fase Fusión 2 */}
          <div className="flex flex-col justify-center">
            <MatchCard
              match={localData.bracket.repechaje.r2[1]}
              stage="rep_r2"
              index={1}
              titleOverride="CUARTOS PLATA 2"
              isEditing={isEditing}
              updateMatch={(s, i, f, v) => updateGeneric(['repechaje', 'r2'], i, f, v)}
              getTeamLogo={getTeamLogo}
            />
          </div>

          {/* SVG Fork Fusión 2 to Preliminares 3 y 4 (reversed) */}
          <div className="w-10 shrink-0 self-stretch flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 40 100" preserveAspectRatio="none" fill="none">
              <path d="M 40,25 H 20 V 75 H 40 M 20,50 H 0" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* WING RIGHT: Preliminares 3 y 4 */}
          <div className="flex flex-col gap-12">
            <MatchCard
              match={localData.bracket.repechaje.r1[2]}
              stage="rep_r1"
              index={2}
              titleOverride="PRELIMINAR 3"
              isEditing={isEditing}
              updateMatch={(s, i, f, v) => updateGeneric(['repechaje', 'r1'], i, f, v)}
              getTeamLogo={getTeamLogo}
            />
            <MatchCard
              match={localData.bracket.repechaje.r1[3]}
              stage="rep_r1"
              index={3}
              titleOverride="PRELIMINAR 4"
              isEditing={isEditing}
              updateMatch={(s, i, f, v) => updateGeneric(['repechaje', 'r1'], i, f, v)}
              getTeamLogo={getTeamLogo}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

export default RepechajeView;
