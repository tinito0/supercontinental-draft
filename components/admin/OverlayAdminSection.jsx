import React, { useState, useEffect, useMemo, memo } from 'react';
import { Eye, Trophy, FileText, Save } from 'lucide-react';
import { serverTimestamp } from 'firebase/firestore';
import { DEFAULT_BROADCAST_OVERLAY } from '../BroadcastOverlay.jsx';
import {
  TournamentActionButton,
  TournamentField,
  TournamentPanel,
  TournamentSectionTitle,
  tournamentBackdropClass,
  tournamentControlClass,
  tournamentShellClass,
} from '../TournamentUI.jsx';

export const OverlayAdminSection = memo(function OverlayAdminSection({
  allTeams,
  broadcastOverlayData,
  onUpdateBroadcastOverlay,
  showStatusMessage,
}) {
  const [form, setForm] = useState({ ...DEFAULT_BROADCAST_OVERLAY, ...(broadcastOverlayData || {}) });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setForm({ ...DEFAULT_BROADCAST_OVERLAY, ...(broadcastOverlayData || {}) });
  }, [broadcastOverlayData]);

  const teams = useMemo(() => {
    return Object.entries(allTeams || {})
      .map(([id, team]) => ({ id, name: team.teamName || `Equipo ${id.slice(0, 5)}` }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allTeams]);

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const saveOverlay = async (nextForm = form) => {
    if (!onUpdateBroadcastOverlay) return;
    setIsSaving(true);
    try {
      await onUpdateBroadcastOverlay({
        ...nextForm,
        updatedAt: serverTimestamp(),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const resetOverlay = () => {
    const next = { ...DEFAULT_BROADCAST_OVERLAY };
    setForm(next);
    saveOverlay(next);
  };

  const copyObsLink = async (scene = form.scene) => {
    const tournamentViews = {
      tabla: 'groups',
      llaves: 'bracket',
      bracket: 'bracket',
      repechaje: 'repechaje',
      goleadores: 'goleadores',
    };
    const tournamentView = tournamentViews[scene];
    const url = tournamentView
      ? `${window.location.origin}/torneo?mode=obs&view=${tournamentView}`
      : `${window.location.origin}/overlay?scene=${scene}`;
    try {
      await navigator.clipboard.writeText(url);
      showStatusMessage('success', 'Link OBS copiado.');
    } catch (error) {
      showStatusMessage('error', url);
    }
  };

  const Input = ({ label, field, placeholder, type = 'text' }) => (
    <TournamentField label={label}>
      <input
        type={type}
        value={form[field] ?? ''}
        onChange={(event) => updateField(field, event.target.value)}
        placeholder={placeholder}
        className={tournamentControlClass}
      />
    </TournamentField>
  );

  return (
    <div className={`-m-4 sm:-m-6 min-h-full ${tournamentShellClass}`}>
      <div className={tournamentBackdropClass}></div>
      <div className="relative z-10 p-5 sm:p-8 space-y-8">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5">
          <TournamentSectionTitle title="Overlay OBS" subtitle="Control de transmision" compact />
          <div className="flex flex-wrap gap-2 justify-center xl:justify-end shrink-0">
            <TournamentActionButton onClick={() => copyObsLink('live')}>Copiar Live</TournamentActionButton>
            <TournamentActionButton onClick={() => copyObsLink('tabla')}>Copiar Tabla</TournamentActionButton>
            <TournamentActionButton onClick={() => copyObsLink('llaves')}>Copiar Llaves</TournamentActionButton>
            <TournamentActionButton onClick={() => copyObsLink('repechaje')}>Copiar Repechaje</TournamentActionButton>
            <TournamentActionButton tone="slate" onClick={() => copyObsLink(form.scene)}>Copiar Escena</TournamentActionButton>
          </div>
        </div>

        <TournamentPanel title="Escena" icon={Eye} compact>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <TournamentField label="Escena">
              <select
                value={form.scene}
                onChange={(event) => updateField('scene', event.target.value)}
                className={tournamentControlClass}
              >
                <option value="live">En vivo</option>
                <option value="previa">Previa</option>
                <option value="descanso">Descanso</option>
                <option value="final">Final</option>
                <option value="tabla">Tabla</option>
                <option value="bracket">Llaves</option>
                <option value="repechaje">Repechaje</option>
                <option value="goleadores">Goleadores</option>
              </select>
            </TournamentField>

            <TournamentField label="Local">
              <select
                value={form.homeTeamId}
                onChange={(event) => updateField('homeTeamId', event.target.value)}
                className={tournamentControlClass}
              >
                <option value="">LOCAL</option>
                {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </TournamentField>

            <TournamentField label="Visitante">
              <select
                value={form.awayTeamId}
                onChange={(event) => updateField('awayTeamId', event.target.value)}
                className={tournamentControlClass}
              >
                <option value="">VISITANTE</option>
                {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </TournamentField>
          </div>
        </TournamentPanel>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <TournamentPanel title="Marcador" icon={Trophy} compact>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Input label="Goles Local" field="homeScore" />
                <Input label="Goles Visitante" field="awayScore" />
                <Input label="Reloj" field="clock" placeholder="45+2" />
                <Input label="Estado" field="matchStatus" placeholder="EN VIVO" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input label="Competicion" field="competitionLabel" />
                <Input label="Fase / Grupo" field="roundLabel" placeholder="GRUPO A" />
              </div>
            </div>
          </TournamentPanel>

          <TournamentPanel title="Rotulos" icon={FileText} compact>
            <div className="space-y-4">
              <Input label="Titular" field="headline" />
              <Input label="Subtitulo" field="subheadline" />
              <Input label="Ticker" field="ticker" />
            </div>
          </TournamentPanel>
        </div>

        <TournamentPanel title="Visibilidad" icon={Eye} accent="slate" compact>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              ['showScoreboard', 'Marcador'],
              ['showLowerThird', 'Lower third'],
              ['showTicker', 'Ticker'],
            ].map(([field, label]) => (
              <label key={field} className={`flex items-center justify-between rounded-xl border px-4 py-3 cursor-pointer transition ${form[field] ? 'bg-blue-500/10 border-blue-500/50 text-white' : 'bg-black/30 border-slate-700/70 text-slate-400 hover:bg-white/5'}`}>
                <span className="font-semibold text-sm text-slate-200">{label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(form[field])}
                  onChange={(event) => updateField(field, event.target.checked)}
                  className="h-4 w-4 accent-blue-500"
                />
              </label>
            ))}
          </div>
        </TournamentPanel>

        <div className="flex flex-col sm:flex-row gap-3 justify-end">
          <TournamentActionButton tone="slate" onClick={resetOverlay} disabled={isSaving}>Reset</TournamentActionButton>
          <TournamentActionButton tone="green" onClick={() => saveOverlay()} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" /> {isSaving ? 'Guardando...' : 'Guardar Overlay'}
          </TournamentActionButton>
        </div>
      </div>
    </div>
  );
});

export default OverlayAdminSection;
