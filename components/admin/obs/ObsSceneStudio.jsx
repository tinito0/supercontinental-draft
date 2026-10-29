import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clapperboard, Radio, Save, Undo2 } from 'lucide-react';
import { serverTimestamp } from 'firebase/firestore';
import { DEFAULT_BROADCAST_OVERLAY } from '../../BroadcastOverlay.jsx';
import { BroadcastStage } from '../../broadcast/BroadcastStage.jsx';
import { BroadcastOverlayLive } from '../../broadcast/BroadcastOverlayLive.jsx';
import { OverlayPopupAdmin } from '../OverlayPopupAdmin.jsx';
import { CommunityLayerControl } from '../OverlaySceneControl.jsx';
import { MatchSettings, TextSettings, TournamentDataNote } from './SceneSettings.jsx';
import { ObsConnection, sourceShortLabel } from './ObsConnection.jsx';
import { FULLSCREEN_SCENES, MATCH_SCENES, OBS_SCENES, sceneLabel, sourcesShowingOnAir } from '../../../utils/obsScenes.js';
import { EMPTY_OVERLAY_MATCH, buildOverlayPatchForMatch, rebaseOverlayForm } from '../../../utils/broadcastMatches.js';
import { DEFAULT_TEXTS, DRAFT_FIELDS, buildScenePatch, dirtyDraftFields, draftFrom } from '../../../utils/sceneEditor.js';

/* Admin → Torneo y transmisión → Escenas de OBS.
   Elegir una escena la muestra en la vista previa (con los datos reales y los cambios sin guardar); OBS no cambia
   hasta «Mandar al aire». Los ajustes son un borrador: «Guardar» los publica sin cambiar la escena. Se escriben solo
   los campos cambiados, así un cambio de Macro Deck en el medio no se pisa. La capa de la comunidad (popup y
   tarjetas) se publica al instante, como los botones de Macro Deck. */

const GROUPS = [
  { id: 'partido', label: 'Partido' },
  { id: 'torneo', label: 'Torneo' },
];

/** «la fuente del juego, la fuente general o la fuente fija «Final»» */
function whereShown(sceneId) {
  const labels = sourcesShowingOnAir(sceneId).map(sourceShortLabel);
  return labels.length > 1 ? `${labels.slice(0, -1).join(', ')} o ${labels.at(-1)}` : labels[0];
}

const formatTime = date => date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

function SceneList({ selected, liveScene, onSelect }) {
  return (
    <nav aria-label="Escenas" className="panel space-y-4 p-3 lg:sticky lg:top-4">
      {GROUPS.map(group => (
        <div key={group.id}>
          <p className="eyebrow px-2 pb-1.5">{group.label}</p>
          <ul className="space-y-1">
            {OBS_SCENES.filter(scene => scene.group === group.id).map(scene => {
              const isSelected = scene.id === selected;
              const isLive = scene.id === liveScene;
              return (
                <li key={scene.id}>
                  <button type="button" onClick={() => onSelect(scene.id)} aria-current={isSelected ? 'true' : undefined}
                    className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-[background-color,transform] duration-fast ease-out active:scale-[0.97] ${isSelected ? 'bg-accent-deep/70 text-ink' : 'text-ink-2 hover:bg-white/[0.04]'}`}>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-base font-bold">{scene.label}</span>
                      <span className="block truncate text-xs text-ink-3">{scene.hint}</span>
                    </span>
                    {isLive && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded bg-danger/15 px-1.5 py-0.5 text-[11px] font-bold text-danger-soft">
                        <span className="h-1.5 w-1.5 rounded-full bg-danger" aria-hidden="true" />Al aire
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/**
 * @param {{ allTeams: object, tournamentData: object, broadcastOverlayData: object,
 *   onUpdateBroadcastOverlay: (patch: object, message: string) => Promise<boolean>, showStatusMessage?: Function,
 *   onOpenTournamentModal?: Function, view?: 'scenes'|'community' }} props
 * `view`: the scenes (with the OBS connection) or the community layer and popup; both share the draft and persist.
 */
export const ObsSceneStudio = memo(function ObsSceneStudio({ allTeams, tournamentData, broadcastOverlayData, onUpdateBroadcastOverlay, showStatusMessage, onOpenTournamentModal, view = 'scenes' }) {
  const overlay = useMemo(() => ({ ...DEFAULT_BROADCAST_OVERLAY, ...(broadcastOverlayData || {}) }), [broadcastOverlayData]);
  const liveScene = overlay.scene || 'live';
  const saved = useMemo(() => draftFrom(overlay), [overlay]);
  const [selected, setSelected] = useState(liveScene);
  const [draft, setDraft] = useState(saved);
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState(null);
  const baseRef = useRef(saved);

  // Lo que llega de Firestore (otra pestaña, Macro Deck, match-feed) entra en los campos que no se están editando.
  useEffect(() => {
    const base = baseRef.current;
    baseRef.current = saved;
    setDraft(prev => rebaseOverlayForm(prev, base, saved, DRAFT_FIELDS));
  }, [saved]);

  const dirty = dirtyDraftFields(draft, saved);
  const isDirty = dirty.length > 0;
  const isSelectedLive = selected === liveScene;

  // No perder cambios al cerrar o recargar la pestaña.
  useEffect(() => {
    if (!isDirty) return undefined;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const persist = useCallback(async (patch, message) => {
    if (!onUpdateBroadcastOverlay) return false;
    return onUpdateBroadcastOverlay({ ...patch, updatedAt: serverTimestamp(), updatedBy: 'admin' }, message);
  }, [onUpdateBroadcastOverlay]);

  const run = async (kind, patch, message) => {
    setBusy(kind);
    try {
      const ok = await persist(patch, message);
      setFeedback(ok ? { tone: 'success', text: `${message} ${formatTime(new Date())}` } : { tone: 'danger', text: 'No se pudo guardar. Tus cambios siguen acá; probá de nuevo.' });
    } finally {
      setBusy('');
    }
  };

  const goLive = () => {
    const patch = buildScenePatch(draft, saved, { scene: selected });
    if (!patch) return;
    run('live', patch, `Al aire: ${sceneLabel(selected)}.`);
  };
  const save = () => {
    const patch = buildScenePatch(draft, saved);
    if (patch) run('save', patch, 'Cambios guardados.');
  };
  const discard = () => setDraft(saved);

  const onChange = useCallback((field, value) => {
    setDraft(prev => {
      const next = { ...prev, [field]: value };
      // Cambiar un club a mano deja de ser «el partido X del torneo».
      if (field === 'homeTeamId' || field === 'awayTeamId') {
        next.matchId = '';
        next[field === 'homeTeamId' ? 'homeTeamName' : 'awayTeamName'] = '';
      }
      return next;
    });
  }, []);
  const pickMatch = useCallback(match => setDraft(prev => ({ ...prev, ...buildOverlayPatchForMatch(match, allTeams) })), [allTeams]);
  const clearMatch = useCallback(() => setDraft(prev => ({ ...prev, ...EMPTY_OVERLAY_MATCH })), []);
  const resetTexts = useCallback(() => setDraft(prev => ({ ...prev, ...DEFAULT_TEXTS })), []);

  const previewData = useMemo(() => ({ ...overlay, ...draft }), [overlay, draft]);
  const showsTexts = selected !== 'live' && !FULLSCREEN_SCENES.has(selected);
  const canGoLive = !isSelectedLive || isDirty;
  const sceneActions = (
    <>
      {isDirty && (
        <button type="button" className="btn btn-ghost min-h-11" onClick={discard} disabled={Boolean(busy)}>
          <Undo2 className="h-4 w-4" aria-hidden="true" /> Descartar
        </button>
      )}
      {isDirty && !isSelectedLive && (
        <button type="button" className="btn btn-secondary min-h-11" onClick={save} disabled={Boolean(busy)} title="Publica los ajustes sin cambiar la escena que está en OBS">
          <Save className="h-4 w-4" aria-hidden="true" /> {busy === 'save' ? 'Guardando…' : 'Guardar sin cambiar escena'}
        </button>
      )}
      <button type="button" className="btn btn-primary min-h-11" onClick={goLive} disabled={Boolean(busy) || !canGoLive}
        title={canGoLive ? undefined : 'Esta escena ya está en el aire y no hay cambios'}>
        <Radio className="h-4 w-4" aria-hidden="true" />
        {busy === 'live' ? 'Publicando…' : isSelectedLive ? 'Publicar cambios' : 'Mandar al aire'}
      </button>
    </>
  );

  if (view === 'community') {
    return (
      <div className="space-y-6">
        <section className="panel space-y-5 p-5" aria-labelledby="obs-community-title">
          <div>
            <h2 id="obs-community-title" className="section-title">Capa de la comunidad</h2>
            <p className="mt-1 text-xs text-ink-3">Va encima de cualquier escena y se publica al instante.</p>
          </div>
          <CommunityLayerControl overlay={broadcastOverlayData} onPersist={persist} />
        </section>
        <OverlayPopupAdmin savedPopup={broadcastOverlayData?.popup} onPersist={persist} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4" aria-labelledby="obs-studio-title">
        <div className="flex flex-col gap-1">
          <h2 id="obs-studio-title" className="section-title flex items-center gap-2.5">
            <Clapperboard className="h-5 w-5 text-accent-soft" aria-hidden="true" /> Escenas de OBS
          </h2>
          <p className="text-xs text-ink-3">Elegí una escena para verla y ajustarla. OBS no cambia hasta «Mandar al aire». Macro Deck sigue cambiando la escena al instante.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <SceneList selected={selected} liveScene={liveScene} onSelect={setSelected} />

          <div className="panel min-w-0 space-y-5 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="font-display text-2xl font-bold text-ink">{sceneLabel(selected)}</h3>
                <p className={`text-xs font-semibold ${isSelectedLive ? 'text-danger-soft' : 'text-ink-3'}`}>{isSelectedLive ? 'En el aire ahora' : `Vista previa · en el aire: ${sceneLabel(liveScene)}`}</p>
                <p className="text-xs text-ink-3">Al aire se ve en {whereShown(selected)} (Conectar OBS, abajo).</p>
                {isDirty && <p className="text-xs font-semibold text-warning-soft" role="status">{dirty.length === 1 ? '1 cambio sin guardar' : `${dirty.length} cambios sin guardar`}</p>}
              </div>
              <div className="flex flex-wrap gap-2 max-sm:hidden">{sceneActions}</div>
            </div>
            {feedback && <p role="status" className={`text-xs ${feedback.tone === 'success' ? 'text-success-soft' : 'text-danger-soft'}`}>{feedback.text}</p>}

            <div className="overflow-hidden rounded-xl border border-line/[0.12]">
              <BroadcastStage mode="contained" transparent={false} label={`Vista previa: ${sceneLabel(selected)}`}>
                <BroadcastOverlayLive overlayData={previewData} allTeams={allTeams} tournamentData={tournamentData} forcedScene={selected} />
              </BroadcastStage>
            </div>
            <p className="text-xs text-ink-3">Vista previa a escala de la fuente de 1920×1080, con los datos en vivo y tus cambios sin guardar.</p>

            {MATCH_SCENES.has(selected) && (
              <MatchSettings draft={draft} saved={saved} allTeams={allTeams} tournamentData={tournamentData}
                onChange={onChange} onPickMatch={pickMatch} onClearMatch={clearMatch} />
            )}
            {FULLSCREEN_SCENES.has(selected) && <TournamentDataNote onOpenTournamentModal={onOpenTournamentModal} />}
            {selected === 'live' && (
              <p className="text-sm text-ink-2">Durante el partido el overlay queda limpio: solo el popup con QR y las tarjetas de la comunidad. El juego ya muestra el marcador y el reloj.</p>
            )}
            {showsTexts && <TextSettings draft={draft} onChange={onChange} onResetTexts={resetTexts} />}
            {/* Phones: the same actions at the end of the panel, stuck to the bottom edge while the panel scrolls by. */}
            <div className="sm:hidden sticky bottom-0 z-10 -mx-4 -mb-4 flex flex-wrap justify-end gap-2 rounded-b-2xl border-t border-line/10 bg-surface/95 p-3 backdrop-blur-sm">{sceneActions}</div>
          </div>
        </div>
      </section>

      <ObsConnection showStatusMessage={showStatusMessage} />
    </div>
  );
});

export default ObsSceneStudio;
