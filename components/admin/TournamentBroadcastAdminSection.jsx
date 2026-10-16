import React, { memo, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, ExternalLink, Maximize2, Radio, Trophy } from 'lucide-react';
import { OverlayAdminSection } from './OverlayAdminSection.jsx';

// "Torneo y transmisión": el resumen del torneo, el control del marcador de OBS y las fuentes de navegador
// en una sola pestaña. Antes eran dos ("Torneo y OBS" y "Marcador en vivo") con los enlaces repetidos.

const OBS_SOURCE_GROUPS = [
  {
    title: 'Marcador y escenas',
    help: 'Transparentes: van encima de la imagen del partido. Muestran lo que se controla arriba.',
    sources: [
      { id: 'live', title: 'Marcador en vivo', desc: 'Marcador, reloj, escudos, lower third y ticker.', path: '/overlay?scene=live' },
      { id: 'previa', title: 'Previa', desc: 'Rótulo de previa con los dos equipos.', path: '/overlay?scene=previa' },
      { id: 'descanso', title: 'Entretiempo', desc: 'Rótulo de descanso con el marcador.', path: '/overlay?scene=descanso' },
      { id: 'final', title: 'Post-partido', desc: 'Rótulo de final con el resultado.', path: '/overlay?scene=final' },
    ],
  },
  {
    title: 'Pantallas del torneo',
    help: 'De pantalla completa. Se actualizan solas con los datos guardados en el gestor del torneo.',
    sources: [
      { id: 'groups', title: 'Tabla de posiciones', desc: 'Clasificación de la fase regular.', path: '/torneo?mode=obs&view=groups' },
      { id: 'oro', title: 'Copa de Oro', desc: 'Bracket de cuartos, semifinales y final.', path: '/torneo?mode=obs&view=bracket' },
      { id: 'plata', title: 'Copa de Plata', desc: 'Bracket del repechaje.', path: '/torneo?mode=obs&view=repechaje' },
      { id: 'goleadores', title: 'Goleadores', desc: 'Ranking de goleadores y asistidores.', path: '/torneo?mode=obs&view=goleadores' },
    ],
  },
];

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
            <h3 id="tournament-summary-title" className="section-title">Torneo</h3>
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

function ObsSources({ showStatusMessage }) {
  const [copiedId, setCopiedId] = useState('');
  const timerRef = useRef(null);
  useEffect(() => () => clearTimeout(timerRef.current), []);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const copy = async (source) => {
    const url = `${origin}${source.path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(source.id);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopiedId(''), 2000);
    } catch {
      showStatusMessage?.('error', `No se pudo copiar. Enlace: ${url}`);
    }
  };

  return (
    <section className="panel p-5 space-y-5" aria-labelledby="obs-sources-title">
      <div>
        <h3 id="obs-sources-title" className="section-title flex items-center gap-2.5">
          <Radio className="w-5 h-5 text-accent-soft" aria-hidden="true" /> Fuentes de navegador para OBS
        </h3>
        <p className="text-xs text-ink-3 mt-1">Agregá cada enlace en OBS como «Navegador» a 1920×1080. Todas se ajustan al tamaño real de la fuente.</p>
      </div>
      {OBS_SOURCE_GROUPS.map(group => (
        <div key={group.title} className="space-y-2">
          <div>
            <h4 className="text-sm font-semibold text-ink">{group.title}</h4>
            <p className="text-xs text-ink-3">{group.help}</p>
          </div>
          <ul className="divide-y divide-line/10 rounded-xl border border-line/[0.12] bg-raised/40">
            {group.sources.map(source => {
              const url = `${origin}${source.path}`;
              const isCopied = copiedId === source.id;
              return (
                <li key={source.id} className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 px-4 py-3">
                  <div className="min-w-0 md:w-56 shrink-0">
                    <p className="text-sm font-semibold text-ink">{source.title}</p>
                    <p className="text-xs text-ink-3">{source.desc}</p>
                  </div>
                  <input readOnly value={url} aria-label={`Enlace de ${source.title}`} onFocus={event => event.target.select()} className="input font-mono text-xs flex-1 min-w-0" />
                  <div className="flex gap-2 shrink-0">
                    <button type="button" className={`btn btn-sm min-h-11 ${isCopied ? 'btn-success' : 'btn-secondary'}`} onClick={() => copy(source)} aria-live="polite">
                      {isCopied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                      {isCopied ? 'Copiado' : 'Copiar'}
                    </button>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm min-h-11" aria-label={`Ver ${source.title} en otra pestaña`}>
                      <ExternalLink className="w-4 h-4" aria-hidden="true" /> Ver
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}

export const TournamentBroadcastAdminSection = memo(function TournamentBroadcastAdminSection({
  tournamentData,
  allTeams,
  broadcastOverlayData,
  onUpdateBroadcastOverlay,
  onOpenTournamentModal,
  showStatusMessage,
}) {
  return (
    <div className="space-y-6">
      <TournamentSummary tournamentData={tournamentData} onOpenTournamentModal={onOpenTournamentModal} />
      <OverlayAdminSection
        allTeams={allTeams}
        tournamentData={tournamentData}
        broadcastOverlayData={broadcastOverlayData}
        onUpdateBroadcastOverlay={onUpdateBroadcastOverlay}
        showStatusMessage={showStatusMessage}
      />
      <ObsSources showStatusMessage={showStatusMessage} />
    </div>
  );
});

export default TournamentBroadcastAdminSection;
