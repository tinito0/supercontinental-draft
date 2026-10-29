import React, { memo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clapperboard, Maximize2, Trophy, Users } from 'lucide-react';
import { ObsSceneStudio } from './obs/ObsSceneStudio.jsx';
import { CollectorImportAdmin } from './CollectorImportAdmin.jsx';
import { Tabs } from '../ui/Tabs.jsx';

// Matchday from the phone: scenes first, one job per view (it used to be one long scroll of four).
const VIEWS = [
  { id: 'scenes', label: 'Escenas', icon: Clapperboard },
  { id: 'community', label: 'Capa y popup', icon: Users },
  { id: 'tournament', label: 'Torneo', icon: Trophy },
];
const VIEW_KEY = 'scl.admin.broadcastView';
const readView = () => {
  try { return VIEWS.some(v => v.id === sessionStorage.getItem(VIEW_KEY)) ? sessionStorage.getItem(VIEW_KEY) : 'scenes'; } catch { return 'scenes'; }
};

// "Torneo y transmisión", en tres vistas: Escenas (editor de escenas de OBS, components/admin/obs/ObsSceneStudio.jsx,
// con las fuentes para OBS y la guía de Macro Deck), Comunidad (capa y popup) y Torneo (resumen y partidos del colector).

function TournamentSummary({ tournamentData, onOpenTournamentModal }) {
  const navigate = useNavigate();
  const leagueTeams = tournamentData?.league?.filter(team => team.name && team.name !== 'Club...').length || 0;
  const matches = Array.isArray(tournamentData?.matches) ? tournamentData.matches : [];
  const completed = matches.filter(match => match.status === 'completed').length;
  const topScorer = tournamentData?.topScorers?.find(scorer => scorer?.name);

  return (
    <section className="panel p-5 space-y-4" aria-labelledby="tournament-summary-title">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Trophy className="w-5 h-5 text-accent-soft shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <h2 id="tournament-summary-title" className="section-title">Torneo</h2>
            <p className="text-xs text-ink-3">Resultados, tabla, copas y goleadores se cargan en el gestor del torneo.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={() => (onOpenTournamentModal ? onOpenTournamentModal() : navigate('/torneo'))}>
            <Trophy className="w-4 h-4" aria-hidden="true" /> Abrir gestor del torneo
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/torneo')}>
            <Maximize2 className="w-4 h-4" aria-hidden="true" /> Pantalla completa
          </button>
        </div>
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-line/10">
        <div>
          <dt className="eyebrow">Equipos en la tabla</dt>
          <dd className="font-display num text-2xl font-bold text-ink">{leagueTeams}</dd>
        </div>
        <div>
          <dt className="eyebrow">Partidos jugados</dt>
          <dd className="font-display num text-2xl font-bold text-ink">{completed}<span className="text-base text-ink-3"> / {matches.length}</span></dd>
        </div>
        <div className="min-w-0">
          <dt className="eyebrow">Goleador</dt>
          <dd className="text-sm font-semibold text-ink-2 truncate mt-1.5">
            {topScorer ? <>{topScorer.name} · <span className="num">{topScorer.goals || 0}</span></> : 'Sin goles cargados'}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export const TournamentBroadcastAdminSection = memo(function TournamentBroadcastAdminSection({
  tournamentData,
  allTeams,
  broadcastOverlayData,
  onUpdateBroadcastOverlay,
  onOpenTournamentModal,
  onUpdateTournament,
  showStatusMessage,
}) {
  const [view, setView] = useState(readView);
  const changeView = (next) => {
    setView(next);
    try { sessionStorage.setItem(VIEW_KEY, next); } catch { /* sin sessionStorage */ }
  };

  return (
    <div className="space-y-6">
      <Tabs tabs={VIEWS} value={view} onChange={changeView} label="Torneo y transmisión" />
      {view === 'tournament' ? (
        <>
          <TournamentSummary tournamentData={tournamentData} onOpenTournamentModal={onOpenTournamentModal} />
          {onUpdateTournament && (
            <CollectorImportAdmin tournamentData={tournamentData} onUpdateTournament={onUpdateTournament} showStatusMessage={showStatusMessage} />
          )}
        </>
      ) : (
        <ObsSceneStudio
          view={view}
          allTeams={allTeams}
          tournamentData={tournamentData}
          broadcastOverlayData={broadcastOverlayData}
          onUpdateBroadcastOverlay={onUpdateBroadcastOverlay}
          showStatusMessage={showStatusMessage}
          onOpenTournamentModal={onOpenTournamentModal}
        />
      )}
    </div>
  );
});

export default TournamentBroadcastAdminSection;
