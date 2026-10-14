import React, { useState, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Radio, Eye } from 'lucide-react';

export const TorneoAdminSection = memo(function TorneoAdminSection({
  tournamentData,
  allTeams,
  onOpenTournamentModal,
  showStatusMessage,
}) {
  const [copiedKey, setCopiedKey] = useState(null);
  const navigate = useNavigate();

  const handleNavigate = (path) => {
    try {
      navigate(path);
    } catch {
      window.location.href = path;
    }
  };

  const copyUrl = async (key, url) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(key);
      showStatusMessage('success', 'Enlace copiado al portapapeles.');
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      showStatusMessage('error', 'Error al copiar.');
    }
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const obsLinks = [
    {
      key: 'live',
      title: 'Overlay Marcador En Vivo',
      desc: 'Marcador, tiempo, escudos, lower third y ticker para la transmisión en directo.',
      url: `${origin}/overlay?scene=live`,
      badge: 'Transmisión',
      badgeColor: 'bg-success/10 text-success-soft border-success/20',
    },
    {
      key: 'groups',
      title: 'Tabla General de Posiciones',
      desc: 'Tabla de clasificación en vivo con puntos, DG y partidos jugados en 1080p.',
      url: `${origin}/torneo?mode=obs&view=groups`,
      badge: 'Fase Regular',
      badgeColor: 'bg-accent/10 text-accent border-accent/20',
    },
    {
      key: 'bracket',
      title: 'Llaves Eliminatorias (Oro)',
      desc: 'Bracket de cuartos, semifinales y Gran Final de la SuperContinental League.',
      url: `${origin}/torneo?mode=obs&view=bracket`,
      badge: 'Playoffs',
      badgeColor: 'bg-warning/10 text-warning-soft border-warning/20',
    },
    {
      key: 'repechaje',
      title: 'Copa de Plata (Repechaje)',
      desc: 'Cuadro de eliminación para los equipos de fase de repechaje.',
      url: `${origin}/torneo?mode=obs&view=repechaje`,
      badge: 'Repechaje',
      badgeColor: 'bg-accent/10 text-accent-soft border-accent/20',
    },
    {
      key: 'goleadores',
      title: 'Líderes de Goleo',
      desc: 'Ranking individual con los máximos goleadores del torneo.',
      url: `${origin}/torneo?mode=obs&view=goleadores`,
      badge: 'Estadísticas',
      badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    },
    {
      key: 'previa',
      title: 'Escena Previa',
      desc: 'Rótulo de previa de transmisión con titular y subtítulo personalizable.',
      url: `${origin}/overlay?scene=previa`,
      badge: 'Previa',
      badgeColor: 'bg-slate-500/10 text-ink-3 border-slate-500/20',
    },
    {
      key: 'descanso',
      title: 'Escena Entretiempo',
      desc: 'Rótulo de descanso/medio tiempo con marcador fijado.',
      url: `${origin}/overlay?scene=descanso`,
      badge: 'Entretiempo',
      badgeColor: 'bg-slate-500/10 text-ink-3 border-slate-500/20',
    },
    {
      key: 'final',
      title: 'Escena Post-Partido',
      desc: 'Rótulo de finalización con estadísticas y resultado definitivo.',
      url: `${origin}/overlay?scene=final`,
      badge: 'Post-Partido',
      badgeColor: 'bg-slate-500/10 text-ink-3 border-slate-500/20',
    },
  ];

  const leagueTeamsCount = tournamentData?.league?.filter(t => t.name && t.name !== 'Club...')?.length || 0;
  const matchesCount = tournamentData?.matches?.length || 0;
  const completedMatches = tournamentData?.matches?.filter(m => m.status === 'completed')?.length || 0;
  const topScorer = tournamentData?.topScorers?.[0];

  return (
    <div className="space-y-6">
      {/* HUB BANNER & LAUNCHER */}
      <div className="panel p-6 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-accent/10 border border-accent/20 text-accent">
                <Trophy className="w-5 h-5" />
              </span>
              <h3 className="text-base font-bold text-ink uppercase tracking-wider">Centro de Control de Torneo & OBS</h3>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-accent/10 border border-accent/25 text-accent">
                ADMIN EXCLUSIVE
              </span>
            </div>
            <p className="text-xs text-ink-3 max-w-xl leading-relaxed mt-1">
              El módulo de torneos está optimizado exclusivamente para transmisiones OBS y gestión del administrador. Usa los enlaces directos transparentes para tus escenas o abre el gestor para editar cruces y partidos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (onOpenTournamentModal) {
                  onOpenTournamentModal();
                } else {
                  handleNavigate('/torneo');
                }
              }}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-ink font-semibold text-xs flex items-center gap-2 transition cursor-pointer"
            >
              <Trophy className="w-4 h-4" /> Abrir Gestor de Torneo
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('/torneo')}
              className="px-3.5 py-2 rounded-lg bg-raised hover:bg-overlay border border-line/20 text-ink-2 hover:text-ink font-medium text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              Pantalla Completa ↗
            </button>
          </div>
        </div>

        {/* METRICS STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-line/[0.12] relative z-10">
          <div className="bg-black/30 rounded-xl p-3 border border-line/[0.08]">
            <span className="text-[10px] font-bold text-ink-3 uppercase block">Equipos en Tabla</span>
            <span className="text-lg font-bold text-ink font-mono">{leagueTeamsCount}</span>
          </div>
          <div className="bg-black/30 rounded-xl p-3 border border-line/[0.08]">
            <span className="text-[10px] font-bold text-ink-3 uppercase block">Partidos Jugados</span>
            <span className="text-lg font-bold text-success-soft font-mono">{completedMatches} <span className="text-xs text-ink-3">/ {matchesCount}</span></span>
          </div>
          <div className="bg-black/30 rounded-xl p-3 border border-line/[0.08]">
            <span className="text-[10px] font-bold text-ink-3 uppercase block">Goleador Actual</span>
            <span className="text-sm font-bold text-accent truncate block">{topScorer?.name ? `${topScorer.name} (${topScorer.goals || 0})` : 'Sin datos'}</span>
          </div>
          <div className="bg-black/30 rounded-xl p-3 border border-line/[0.08]">
            <span className="text-[10px] font-bold text-ink-3 uppercase block">Modo OBS</span>
            <span className="text-sm font-bold text-warning-soft flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> 1080p Activo
            </span>
          </div>
        </div>
      </div>

      {/* OBS DIRECT LINKS GRID */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-xs font-bold text-ink-2 uppercase tracking-wider flex items-center gap-2">
            <Radio className="w-4 h-4 text-accent" /> Fuentes de Navegador para OBS Studio
          </h4>
          <span className="text-[11px] text-ink-3">Resolución recomendada: 1920x1080 (Fondo Transparente)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {obsLinks.map((link) => {
            const isCopied = copiedKey === link.key;
            return (
              <div
                key={link.key}
                className="bg-surface hover:bg-[#101724] p-4 rounded-xl border border-line/[0.12] hover:border-accent/30 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-sm font-bold text-ink group-hover:text-accent transition-colors">
                      {link.title}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${link.badgeColor}`}>
                      {link.badge}
                    </span>
                  </div>
                  <p className="text-xs text-ink-3 leading-relaxed mb-3">
                    {link.desc}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-line/[0.08]">
                  <input
                    type="text"
                    readOnly
                    value={link.url}
                    className="flex-1 bg-black/40 border border-line/[0.08] rounded-lg px-2.5 py-1.5 text-[11px] text-ink-3 font-mono truncate select-all focus:outline-none"
                  />
                  <button
                    onClick={() => copyUrl(link.key, link.url)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 ${
                      isCopied
                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                        : 'bg-white/[0.06] hover:bg-accent hover:text-slate-950 text-ink-2'
                    }`}
                  >
                    {isCopied ? '¡Copiado!' : 'Copiar'}
                  </button>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-ink-3 hover:text-ink transition"
                    title="Previsualizar escena"
                  >
                    <Eye size={14} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

export default TorneoAdminSection;
