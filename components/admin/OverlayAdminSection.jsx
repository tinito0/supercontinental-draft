import React, { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import { Radio, RotateCcw, Save, Tv, X } from 'lucide-react';
import { serverTimestamp } from 'firebase/firestore';
import { DEFAULT_BROADCAST_OVERLAY } from '../BroadcastOverlay.jsx';
import { DEFAULT_LOGO } from '../../utils/constants.js';
import { Field } from '../ui/Field.jsx';
import { Alert } from '../ui/Alert.jsx';
import { BroadcastMatchPicker, teamLogoFor } from './BroadcastMatchPicker.jsx';
import {
  EMPTY_OVERLAY_MATCH,
  buildOverlayPatchForMatch,
  getDirtyOverlayFields,
  getOverlayMatchDrift,
  getUnresolvedTeams,
  listBroadcastMatches,
  rebaseOverlayForm,
} from '../../utils/broadcastMatches.js';

const OVERLAY_FIELDS = Object.keys(DEFAULT_BROADCAST_OVERLAY);

const SCENES = [
  { id: 'live', label: 'En vivo' },
  { id: 'previa', label: 'Previa' },
  { id: 'descanso', label: 'Descanso' },
  { id: 'final', label: 'Final' },
  { id: 'tabla', label: 'Tabla' },
  { id: 'bracket', label: 'Copa de Oro' },
  { id: 'repechaje', label: 'Copa de Plata' },
  { id: 'goleadores', label: 'Goleadores' },
];
const SCENE_LABEL = Object.fromEntries(SCENES.map(scene => [scene.id, scene.label]));

function pickOverlayFields(data) {
  const merged = { ...DEFAULT_BROADCAST_OVERLAY, ...(data || {}) };
  return Object.fromEntries(OVERLAY_FIELDS.map(field => [field, merged[field]]));
}

// Fuera del componente: definido adentro, cada tecla creaba un componente nuevo, React remontaba el
// <input> y se perdía el foco después de cada letra.
function OverlayInput({ label, field, value, onChange, placeholder, inputMode }) {
  return (
    <Field label={label}>
      <input
        type="text"
        value={value ?? ''}
        inputMode={inputMode}
        onChange={event => onChange(field, event.target.value)}
        placeholder={placeholder}
        className="input"
      />
    </Field>
  );
}

function OnAirTeam({ name, logo, align }) {
  return (
    <div className={`flex items-center gap-3 min-w-0 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      <img src={logo} alt="" width={44} height={44} className="w-11 h-11 object-contain shrink-0" onError={event => { event.currentTarget.src = DEFAULT_LOGO; }} />
      <span className="font-display text-xl font-bold text-ink truncate" title={name}>{name}</span>
    </div>
  );
}

export const OverlayAdminSection = memo(function OverlayAdminSection({
  allTeams,
  tournamentData,
  broadcastOverlayData,
  onUpdateBroadcastOverlay,
  showStatusMessage,
}) {
  const saved = useMemo(() => pickOverlayFields(broadcastOverlayData), [broadcastOverlayData]);
  const [form, setForm] = useState(saved);
  const baseRef = useRef(saved);
  const [isSaving, setIsSaving] = useState(false);
  const [busyMatchId, setBusyMatchId] = useState('');

  // Lo que llega de Firestore actualiza solo los campos que no se están editando.
  useEffect(() => {
    // La base se lee ahora: el updater de setForm corre más tarde, cuando baseRef ya apunta a `saved`.
    const base = baseRef.current;
    baseRef.current = saved;
    setForm(prev => rebaseOverlayForm(prev, base, saved, OVERLAY_FIELDS));
  }, [saved]);

  const dirtyFields = getDirtyOverlayFields(form, saved, OVERLAY_FIELDS);
  const isDirty = dirtyFields.length > 0;

  const teams = useMemo(() => Object.entries(allTeams || {})
    .map(([id, team]) => ({ id, name: team?.teamName || `Equipo ${id.slice(0, 5)}` }))
    .sort((a, b) => a.name.localeCompare(b.name)), [allTeams]);

  const matches = useMemo(() => listBroadcastMatches(tournamentData), [tournamentData]);
  const activeMatch = matches.find(match => match.id === saved.matchId) || null;
  const drift = getOverlayMatchDrift(activeMatch, saved);

  const updateField = useCallback((field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      // Cambiar un club a mano deja de ser "el partido X del torneo".
      if (field === 'homeTeamId' || field === 'awayTeamId') {
        next.matchId = '';
        next[field === 'homeTeamId' ? 'homeTeamName' : 'awayTeamName'] = '';
      }
      return next;
    });
  }, []);

  const persist = async (data, successMessage) => {
    if (!onUpdateBroadcastOverlay) return false;
    return onUpdateBroadcastOverlay({ ...data, updatedAt: serverTimestamp() }, successMessage);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await persist(form, 'Overlay OBS actualizado.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => setForm(saved);

  const handleReset = async () => {
    if (!window.confirm('¿Restablecer el overlay a los valores por defecto? OBS lo mostrará de inmediato: se pierden el partido al aire, el marcador y los rótulos.')) return;
    setIsSaving(true);
    try {
      if (await persist(DEFAULT_BROADCAST_OVERLAY, 'Overlay restablecido.')) setForm(pickOverlayFields(DEFAULT_BROADCAST_OVERLAY));
    } finally {
      setIsSaving(false);
    }
  };

  // Solo escribe los campos del partido (merge): no guarda otros cambios del formulario que estén a medias.
  const putOnAir = async (match) => {
    const unresolved = getUnresolvedTeams(match, allTeams);
    const patch = buildOverlayPatchForMatch(match, allTeams);
    setBusyMatchId(match.id);
    try {
      const label = `${match.homeTeam || 'A definir'} vs ${match.awayTeam || 'A definir'}`;
      const ok = await persist(patch, `Al aire: ${label}.`);
      // Los campos del partido pasan a ser los del nuevo partido aunque se hubieran editado a mano antes;
      // si no, el formulario quedaba mezclado y "Guardar overlay" pisaba el partido recién puesto al aire.
      if (ok) setForm(prev => ({ ...prev, ...patch }));
      if (ok && unresolved.length > 0) {
        showStatusMessage?.('warning', `${unresolved.join(' y ')} no ${unresolved.length > 1 ? 'tienen' : 'tiene'} club registrado: OBS mostrará el escudo por defecto.`);
      }
    } finally {
      setBusyMatchId('');
    }
  };

  const takeOffAir = async () => {
    setBusyMatchId(saved.matchId || 'clear');
    try {
      await persist(EMPTY_OVERLAY_MATCH, 'Partido quitado del marcador.');
    } finally {
      setBusyMatchId('');
    }
  };

  const onAirHome = saved.homeTeamId ? (allTeams?.[saved.homeTeamId]?.teamName || saved.homeTeamName) : saved.homeTeamName;
  const onAirAway = saved.awayTeamId ? (allTeams?.[saved.awayTeamId]?.teamName || saved.awayTeamName) : saved.awayTeamName;
  const hasTeamsOnAir = Boolean(onAirHome || onAirAway);
  const logoForSaved = (teamId, name) => (teamId && allTeams?.[teamId]?.logoUrl) || teamLogoFor(name, allTeams);

  return (
    <div className="space-y-6">
      {/* AL AIRE */}
      <section className="panel p-5 space-y-4" aria-labelledby="overlay-onair-title">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Tv className="w-5 h-5 text-accent-soft" aria-hidden="true" />
            <h3 id="overlay-onair-title" className="section-title">Al aire en OBS</h3>
          </div>
          <p className="text-xs text-ink-3">
            Escena del marcador: <span className="text-ink-2 font-semibold">{SCENE_LABEL[saved.scene] || saved.scene}</span>
          </p>
        </div>

        {hasTeamsOnAir ? (
          <div className="well p-4 space-y-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4">
              <OnAirTeam name={onAirHome || 'Local'} logo={logoForSaved(saved.homeTeamId, onAirHome)} />
              <div className="text-center">
                <div className="font-display num text-3xl font-bold text-ink">{saved.homeScore || 0} – {saved.awayScore || 0}</div>
                <div className="text-xs text-ink-3">{saved.clock || saved.matchStatus}</div>
              </div>
              <OnAirTeam name={onAirAway || 'Visitante'} logo={logoForSaved(saved.awayTeamId, onAirAway)} align="right" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-line/10">
              <p className="text-xs text-ink-3 min-w-0">
                {activeMatch
                  ? <>Partido del torneo{saved.roundLabel && <> · <span className="text-ink-2">{saved.roundLabel}</span></>}</>
                  : 'Marcador armado a mano (no está ligado a un partido del torneo).'}
              </p>
              <button type="button" className="btn btn-ghost btn-sm min-h-11" onClick={takeOffAir} disabled={Boolean(busyMatchId)}>
                <X className="w-4 h-4" aria-hidden="true" /> Quitar del marcador
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-3 well px-4 py-5 text-center">
            No hay ningún partido en el marcador. Elegí uno de la lista para ponerlo al aire.
          </p>
        )}

        {drift && activeMatch && (
          <Alert
            tone="warning"
            title="El partido cambió en el torneo"
            action={(
              <button type="button" className="btn btn-secondary btn-sm min-h-11" onClick={() => putOnAir(activeMatch)} disabled={Boolean(busyMatchId)}>
                Actualizar marcador
              </button>
            )}
          >
            {drift.teamsChanged ? 'Los equipos cargados ya no coinciden con los del marcador. ' : ''}
            {drift.resultChanged ? `Resultado final en el torneo: ${activeMatch.homeScore} – ${activeMatch.awayScore}.` : ''}
          </Alert>
        )}
      </section>

      {/* PARTIDOS */}
      <section className="panel p-5 space-y-4" aria-labelledby="overlay-matches-title">
        <div>
          <h3 id="overlay-matches-title" className="section-title flex items-center gap-2.5">
            <Radio className="w-5 h-5 text-accent-soft" aria-hidden="true" /> Partidos
          </h3>
          <p className="text-xs text-ink-3 mt-1">Liga, Copa de Oro y Copa de Plata. Los resultados se editan desde el gestor del torneo.</p>
        </div>
        <BroadcastMatchPicker
          matches={matches}
          activeMatchId={saved.matchId}
          busyMatchId={busyMatchId}
          allTeams={allTeams}
          isTournamentLoaded={tournamentData != null /* app.jsx arranca en null hasta el primer snapshot */}
          onSelect={putOnAir}
        />
      </section>

      {/* AJUSTES MANUALES */}
      <section className="panel p-5 space-y-5" aria-labelledby="overlay-manual-title">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 id="overlay-manual-title" className="section-title">Marcador y rótulos</h3>
          {isDirty && <span className="text-xs font-semibold text-warning-soft" role="status">Cambios sin guardar ({dirtyFields.length})</span>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Escena">
            <select value={form.scene} onChange={event => updateField('scene', event.target.value)} className="select">
              {SCENES.map(scene => <option key={scene.id} value={scene.id}>{scene.label}</option>)}
            </select>
          </Field>
          <Field label="Local">
            <select value={form.homeTeamId} onChange={event => updateField('homeTeamId', event.target.value)} className="select">
              <option value="">{form.homeTeamName || 'Sin club registrado'}</option>
              {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </Field>
          <Field label="Visitante">
            <select value={form.awayTeamId} onChange={event => updateField('awayTeamId', event.target.value)} className="select">
              <option value="">{form.awayTeamName || 'Sin club registrado'}</option>
              {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <OverlayInput label="Goles local" field="homeScore" value={form.homeScore} onChange={updateField} inputMode="numeric" />
          <OverlayInput label="Goles visitante" field="awayScore" value={form.awayScore} onChange={updateField} inputMode="numeric" />
          <OverlayInput label="Reloj" field="clock" value={form.clock} onChange={updateField} placeholder="45+2" />
          <OverlayInput label="Estado" field="matchStatus" value={form.matchStatus} onChange={updateField} placeholder="EN VIVO" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <OverlayInput label="Competición" field="competitionLabel" value={form.competitionLabel} onChange={updateField} />
          <OverlayInput label="Fase / fecha" field="roundLabel" value={form.roundLabel} onChange={updateField} placeholder="Fecha 3" />
          <OverlayInput label="Titular" field="headline" value={form.headline} onChange={updateField} />
          <OverlayInput label="Subtítulo" field="subheadline" value={form.subheadline} onChange={updateField} />
        </div>
        <OverlayInput label="Ticker" field="ticker" value={form.ticker} onChange={updateField} />

        <fieldset>
          <legend className="field-label">Visible en OBS</legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              ['showScoreboard', 'Marcador'],
              ['showLowerThird', 'Lower third'],
              ['showTicker', 'Ticker'],
            ].map(([field, label]) => (
              <label key={field} className={`flex items-center justify-between min-h-11 rounded-lg border px-4 cursor-pointer transition-colors ${form[field] ? 'bg-accent-deep/60 border-accent/60 text-ink' : 'bg-raised border-line/[0.16] text-ink-2 hover:border-line/30'}`}>
                <span className="text-sm font-semibold">{label}</span>
                <input type="checkbox" aria-label={`Mostrar ${label.toLowerCase()} en OBS`} checked={Boolean(form[field])} onChange={event => updateField(field, event.target.checked)} className="h-4 w-4 accent-[rgb(var(--c-accent))]" />
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-between pt-4 border-t border-line/10">
          <button type="button" className="btn btn-danger" onClick={handleReset} disabled={isSaving}>
            <RotateCcw className="w-4 h-4" aria-hidden="true" /> Restablecer
          </button>
          <div className="flex flex-col-reverse sm:flex-row gap-2">
            {isDirty && <button type="button" className="btn btn-ghost" onClick={handleDiscard} disabled={isSaving}>Descartar cambios</button>}
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={isSaving || !isDirty} title={!isDirty ? 'No hay cambios para guardar' : undefined}>
              <Save className="w-4 h-4" aria-hidden="true" /> {isSaving ? 'Guardando…' : 'Guardar overlay'}
            </button>
          </div>
        </div>
      </section>

    </div>
  );
});

export default OverlayAdminSection;
