import React, { memo, useMemo } from 'react';
import { RotateCcw, Trophy, X } from 'lucide-react';
import { Field } from '../../ui/Field.jsx';
import { Alert } from '../../ui/Alert.jsx';
import { BroadcastMatchPicker } from '../BroadcastMatchPicker.jsx';
import { getOverlayMatchDrift, listBroadcastMatches } from '../../../utils/broadcastMatches.js';

/* Ajustes de cada escena en el editor de OBS (ObsSceneStudio). Todo cambia el borrador: no llega a OBS hasta
   «Mandar al aire» o «Guardar». */

function TextInput({ label, field, draft, onChange, placeholder, inputMode, help }) {
  return (
    <Field label={label} help={help}>
      <input type="text" className="input" value={draft[field] ?? ''} inputMode={inputMode} placeholder={placeholder}
        onChange={event => onChange(field, event.target.value)} />
    </Field>
  );
}

/** Partido al aire de las escenas Previa, Entretiempo y Final. */
export const MatchSettings = memo(function MatchSettings({ draft, saved, allTeams, tournamentData, onChange, onPickMatch, onClearMatch }) {
  const matches = useMemo(() => listBroadcastMatches(tournamentData), [tournamentData]);
  const teams = useMemo(() => Object.entries(allTeams || {})
    .map(([id, team]) => ({ id, name: team?.teamName || `Equipo ${id.slice(0, 5)}` }))
    .sort((a, b) => a.name.localeCompare(b.name)), [allTeams]);
  const draftMatch = matches.find(match => match.id === draft.matchId) || null;
  const savedMatch = matches.find(match => match.id === saved.matchId) || null;
  const drift = getOverlayMatchDrift(savedMatch, saved);
  const home = draft.homeTeamName || allTeams?.[draft.homeTeamId]?.teamName || draftMatch?.homeTeam || '';
  const away = draft.awayTeamName || allTeams?.[draft.awayTeamId]?.teamName || draftMatch?.awayTeam || '';

  return (
    <section className="space-y-4" aria-labelledby="scene-match-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="scene-match-title" className="section-title">Partido</h3>
        {home || away ? (
          <button type="button" className="btn btn-ghost btn-sm min-h-11" onClick={onClearMatch}>
            <X className="h-4 w-4" aria-hidden="true" /> Quitar partido
          </button>
        ) : null}
      </div>
      <p className="text-sm text-ink-2">
        {home || away
          ? <><span className="font-semibold text-ink">{home || 'A definir'}</span> vs <span className="font-semibold text-ink">{away || 'A definir'}</span>{draftMatch ? <span className="text-ink-3"> · {draft.roundLabel}</span> : <span className="text-ink-3"> · armado a mano</span>}</>
          : 'Elegí el partido de la lista. Al mandarlo al aire se abre la predicción del público para ese partido.'}
      </p>
      {saved.matchId && !savedMatch && tournamentData != null && (
        <Alert tone="warning" title="El partido al aire ya no está en el torneo"
          action={draft.matchId === saved.matchId ? <button type="button" className="btn btn-secondary btn-sm min-h-11" onClick={onClearMatch}>Quitar partido</button> : null}>
          Quedó de antes (otra temporada o un cruce que se rehízo). La web no abre la predicción para un partido que no está en el torneo: elegí uno de la lista o quitalo.
        </Alert>
      )}
      {drift && savedMatch && (
        <Alert tone="warning" title="El partido cambió en el torneo"
          action={<button type="button" className="btn btn-secondary btn-sm min-h-11" onClick={() => onPickMatch(savedMatch)}>Actualizar en el borrador</button>}>
          {drift.teamsChanged ? 'Los equipos ya no coinciden con los del overlay. ' : ''}
          {drift.resultChanged ? `Resultado final en el torneo: ${savedMatch.homeScore} – ${savedMatch.awayScore}.` : ''}
        </Alert>
      )}
      <BroadcastMatchPicker
        matches={matches}
        activeMatchId={draft.matchId}
        busyMatchId=""
        allTeams={allTeams}
        isTournamentLoaded={tournamentData != null}
        onSelect={onPickMatch}
      />
      <details className="border-t border-line/10 pt-3">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-ink-2">Ajustes a mano (marcador, reloj, fase)</summary>
        <div className="grid grid-cols-1 gap-4 pt-3 md:grid-cols-2">
          <Field label="Local">
            <select className="select" value={draft.homeTeamId} onChange={event => onChange('homeTeamId', event.target.value)}>
              <option value="">{draft.homeTeamName || 'Sin club registrado'}</option>
              {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </Field>
          <Field label="Visitante">
            <select className="select" value={draft.awayTeamId} onChange={event => onChange('awayTeamId', event.target.value)}>
              <option value="">{draft.awayTeamName || 'Sin club registrado'}</option>
              {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <TextInput label="Goles local" field="homeScore" draft={draft} onChange={onChange} inputMode="numeric" />
            <TextInput label="Goles visitante" field="awayScore" draft={draft} onChange={onChange} inputMode="numeric" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <TextInput label="Reloj" field="clock" draft={draft} onChange={onChange} placeholder="45+2" />
            <TextInput label="Estado" field="matchStatus" draft={draft} onChange={onChange} placeholder="EN VIVO" />
          </div>
          <TextInput label="Fase / fecha" field="roundLabel" draft={draft} onChange={onChange} placeholder="Fecha 3" />
        </div>
        <p className="pt-2 text-xs text-ink-3">Con el colector conectado, el marcador del juego reemplaza al cargado a mano en Entretiempo y Final.</p>
      </details>
    </section>
  );
});

/** Lower third y ticker: textos y si se muestran. */
export const TextSettings = memo(function TextSettings({ draft, onChange, onResetTexts }) {
  return (
    <section className="space-y-4" aria-labelledby="scene-text-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="scene-text-title" className="section-title">Rótulos</h3>
        <button type="button" className="btn btn-ghost btn-sm min-h-11" onClick={onResetTexts} title="Vuelve los cuatro textos a los de fábrica, en el borrador">
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> Restablecer textos
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {[['showLowerThird', 'Lower third'], ['showTicker', 'Ticker']].map(([field, label]) => (
          <label key={field} className={`flex min-h-11 cursor-pointer items-center justify-between rounded-lg border px-4 transition-colors ${draft[field] ? 'border-accent/60 bg-accent-deep/60 text-ink' : 'border-line/[0.16] bg-raised text-ink-2 hover:border-line/30'}`}>
            <span className="text-sm font-semibold">{label}</span>
            <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--c-accent))]" checked={Boolean(draft[field])}
              onChange={event => onChange(field, event.target.checked)} aria-label={`Mostrar ${label.toLowerCase()}`} />
          </label>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextInput label="Titular del lower third" field="headline" draft={draft} onChange={onChange} />
        <TextInput label="Subtítulo" field="subheadline" draft={draft} onChange={onChange} />
        <TextInput label="Competición" field="competitionLabel" draft={draft} onChange={onChange} help="Arriba del título en Previa, Entretiempo, Final y Goleadores." />
        <TextInput label="Ticker" field="ticker" draft={draft} onChange={onChange} />
      </div>
    </section>
  );
});

/** Escenas del torneo: se dibujan con los datos guardados, no tienen ajustes propios. */
export function TournamentDataNote({ onOpenTournamentModal }) {
  return (
    <section className="flex flex-col gap-3 border-t border-line/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-ink-2">Esta escena muestra la tabla, las copas, la fecha o los goleadores tal como están guardados en el torneo, y se actualiza sola.</p>
      {onOpenTournamentModal && (
        <button type="button" className="btn btn-secondary min-h-11 shrink-0" onClick={onOpenTournamentModal}>
          <Trophy className="h-4 w-4" aria-hidden="true" /> Abrir gestor del torneo
        </button>
      )}
    </section>
  );
}
