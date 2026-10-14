import React, { memo } from 'react';
import { Trophy } from 'lucide-react';
import { TournamentSectionTitle } from '../TournamentUI.jsx';
import { MatchCard } from './MatchCard.jsx';

export const BracketView = memo(function BracketView({
  localData,
  isEditing,
  isObsMode,
  getTeamLogo,
  updateGeneric,
}) {
  return (
    <div className={`flex flex-col items-center justify-center ${isObsMode ? 'h-full' : 'py-4 w-full'}`}>
      <TournamentSectionTitle title="SUPERCONTINENTAL LEAGUE" subtitle="ELIMINATORIAS ORO" />
      <div className={`w-full ${isObsMode ? 'flex items-center justify-center gap-4 mt-6' : 'overflow-x-auto overflow-y-visible pb-12 pt-4 custom-scrollbar -mx-2 px-2'}`}>
        <div className={`${isObsMode ? 'flex items-center justify-center' : 'min-w-[1240px] flex items-center justify-center py-4 px-6 mx-auto'}`}>
          {/* WING LEFT: Cuartos 1 y 2 */}
          <div className="flex flex-col gap-10">
            <MatchCard
              match={localData.bracket.quarters[0]}
              stage="quarters"
              index={0}
              seedA="1°"
              seedB="8°"
              titleOverride="CUARTOS 1 (1° vs 8°)"
              isEditing={isEditing}
              updateMatch={updateGeneric}
              getTeamLogo={getTeamLogo}
            />
            <MatchCard
              match={localData.bracket.quarters[1]}
              stage="quarters"
              index={1}
              seedA="4°"
              seedB="5°"
              titleOverride="CUARTOS 2 (4° vs 5°)"
              isEditing={isEditing}
              updateMatch={updateGeneric}
              getTeamLogo={getTeamLogo}
            />
          </div>

          {/* SVG Fork Left to Semi 1 */}
          <div className="w-10 shrink-0 self-stretch flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 40 100" preserveAspectRatio="none" fill="none">
              <path d="M 0,25 H 20 V 75 H 0 M 20,50 H 40" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* Left Semifinal */}
          <div className="flex flex-col justify-center">
            <MatchCard
              match={localData.bracket.semis[0]}
              stage="semis"
              index={0}
              titleOverride="SEMIFINAL 1"
              isEditing={isEditing}
              updateMatch={updateGeneric}
              getTeamLogo={getTeamLogo}
            />
          </div>

          {/* Connector Semi 1 to Final */}
          <div className="w-10 shrink-0 self-stretch flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 40 100" preserveAspectRatio="none" fill="none">
              <path d="M 0,50 H 40" stroke="rgba(245,158,11,0.5)" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>

          {/* GRAN FINAL (CENTER) */}
          <div className="flex flex-col items-center z-10 px-2">
            <div className="flex items-center gap-2 px-3.5 py-1 mb-2.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-black uppercase tracking-wider shadow-lg">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Gran Final Oro</span>
            </div>
            <MatchCard
              match={localData.bracket.final}
              stage="final"
              index={0}
              isFinal={true}
              titleOverride="CAMPEÓN ORO"
              isEditing={isEditing}
              updateMatch={updateGeneric}
              getTeamLogo={getTeamLogo}
            />
          </div>

          {/* Connector Final to Semi 2 */}
          <div className="w-10 shrink-0 self-stretch flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 40 100" preserveAspectRatio="none" fill="none">
              <path d="M 0,50 H 40" stroke="rgba(245,158,11,0.5)" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>

          {/* Right Semifinal */}
          <div className="flex flex-col justify-center">
            <MatchCard
              match={localData.bracket.semis[1]}
              stage="semis"
              index={1}
              titleOverride="SEMIFINAL 2"
              isEditing={isEditing}
              updateMatch={updateGeneric}
              getTeamLogo={getTeamLogo}
            />
          </div>

          {/* SVG Fork Semi 2 to Cuartos 3 y 4 (reversed) */}
          <div className="w-10 shrink-0 self-stretch flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 40 100" preserveAspectRatio="none" fill="none">
              <path d="M 40,25 H 20 V 75 H 40 M 20,50 H 0" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* WING RIGHT: Cuartos 3 y 4 */}
          <div className="flex flex-col gap-10">
            <MatchCard
              match={localData.bracket.quarters[2]}
              stage="quarters"
              index={2}
              seedA="2°"
              seedB="7°"
              titleOverride="CUARTOS 3 (2° vs 7°)"
              isEditing={isEditing}
              updateMatch={updateGeneric}
              getTeamLogo={getTeamLogo}
            />
            <MatchCard
              match={localData.bracket.quarters[3]}
              stage="quarters"
              index={3}
              seedA="3°"
              seedB="6°"
              titleOverride="CUARTOS 4 (3° vs 6°)"
              isEditing={isEditing}
              updateMatch={updateGeneric}
              getTeamLogo={getTeamLogo}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

export default BracketView;
