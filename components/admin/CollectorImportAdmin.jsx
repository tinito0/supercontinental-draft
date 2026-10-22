import React, { memo, useMemo, useState } from 'react';
import { Download, Gamepad2 } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase.js';
import { APP_ID } from '../../utils/constants.js';
import { useLiveMatches, usePesTeamMap } from '../../hooks/useLeagueData.js';
import { applyCollectorImport, gameTeamIds, planCollectorImport } from '../../utils/collectorImport.js';
import { buildAutomaticTournamentReport, rankLeague } from '../tournament/tournamentEngine.js';
import { Alert } from '../ui/Alert.jsx';

// Partidos del juego → torneo (docs/TOURNAMENT_DATA_FLOW_AUDIT.md, punto 4): lista los partidos terminados que subió
// el bridge, propone a qué partido de liga o cruce de copa van (utils/collectorImport.js) y, con el OK del admin, los
// guarda con el mismo flujo del gestor del torneo (tabla recalculada y noticia). Nunca pisa un resultado cargado.
// La primera vez el admin elige a qué club del torneo corresponde cada equipo del juego (public/data/config/pesTeamMap).

const PAGE = 8;
const TEAM_MAP_PATH = `artifacts/${APP_ID}/public/data/config/pesTeamMap`;
const formatDate = date => (date ? date.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

function TeamMapper({ match, missing, leagueNames, onSave }) {
  const ids = gameTeamIds(match);
  const [choice, setChoice] = useState({});
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await onSave(Object.fromEntries(missing.map(side => [ids[side], choice[side]])));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <p className="text-xs text-ink-3">¿A qué club del torneo corresponde cada equipo del juego? Queda guardado para los próximos partidos.</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {missing.map(side => (
          <label key={side} className="block text-xs text-ink-3">
            <span className="mb-1 block">{match[side].name} (juego)</span>
            <select className="input min-h-11" value={choice[side] || ''} onChange={event => setChoice(prev => ({ ...prev, [side]: event.target.value }))}>
              <option value="">Elegí un club…</option>
              {leagueNames.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
        ))}
      </div>
      <button type="button" className="btn btn-ghost min-h-11" disabled={busy || missing.some(side => !choice[side])} onClick={save}>
        Guardar equipos
      </button>
    </div>
  );
}

function Preview({ plan }) {
  const u = plan.update;
  const isLeague = plan.kind === 'league';
  const [home, away] = isLeague ? [u.homeScore, u.awayScore] : [u.scoreA, u.scoreB];
  const pens = isLeague ? (u.homePenalties != null ? `${u.homePenalties}-${u.awayPenalties}` : '') : (u.penaltiesA != null ? `${u.penaltiesA}-${u.penaltiesB}` : '');
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
      <dt className="text-ink-3">Va a</dt><dd className="text-ink-2 font-semibold">{plan.label}</dd>
      <dt className="text-ink-3">Resultado</dt><dd className="num text-ink-2">{home}-{away}{pens && ` (${pens} pen.)`}</dd>
      {isLeague && (u.homeGoals || u.awayGoals) && <><dt className="text-ink-3">Goles</dt><dd className="text-ink-2">{[u.homeGoals, u.awayGoals].filter(Boolean).join(' · ')}</dd></>}
      {isLeague && (u.homeAssists || u.awayAssists) && <><dt className="text-ink-3">Asistencias</dt><dd className="text-ink-2">{[u.homeAssists, u.awayAssists].filter(Boolean).join(' · ')}</dd></>}
    </dl>
  );
}

/** @param {{ tournamentData: object, onUpdateTournament: (data: object) => Promise<boolean>, showStatusMessage?: Function }} props */
export const CollectorImportAdmin = memo(function CollectorImportAdmin({ tournamentData, onUpdateTournament, showStatusMessage }) {
  const { matches, loading, error } = useLiveMatches();
  const { data: teamMapDoc } = usePesTeamMap();
  const teamMap = teamMapDoc?.teams || {};
  const [shown, setShown] = useState(PAGE);
  const [busyKey, setBusyKey] = useState('');
  const [warnings, setWarnings] = useState([]);
  const leagueNames = useMemo(() => (tournamentData?.league || []).map(team => team?.name).filter(name => name && name !== 'Club...').sort((a, b) => a.localeCompare(b)), [tournamentData]);
  const finished = useMemo(() => matches.filter(match => match.status.kind === 'finished'), [matches]);

  const saveTeams = async (entries) => {
    try {
      await setDoc(doc(db, TEAM_MAP_PATH), { teams: entries }, { merge: true });
      showStatusMessage?.('success', 'Equipos del juego guardados.');
    } catch (err) {
      console.error('[CollectorImportAdmin]', err);
      showStatusMessage?.('error', 'No se pudieron guardar los equipos.');
    }
  };

  const importMatch = async (match, plan) => {
    if (!window.confirm(`¿Importar ${match.home.name} ${match.home.score}-${match.away.score} ${match.away.name} a ${plan.label}?`)) return;
    setBusyKey(match.key);
    try {
      const { data, issues } = buildAutomaticTournamentReport(applyCollectorImport(tournamentData, plan));
      const { league, unresolvedTies } = rankLeague(data.league);
      const saved = await onUpdateTournament({ ...data, league });
      if (saved !== false) {
        setWarnings([
          ...issues.map(issue => `${issue.label}: ${issue.reason}`),
          ...unresolvedTies.map(group => `Empate en la tabla sin desempate posible: ${group.join(', ')}.`),
        ]);
      }
    } finally {
      setBusyKey('');
    }
  };

  return (
    <section className="panel p-5 space-y-4" aria-labelledby="collector-import-title">
      <div className="flex flex-col gap-1">
        <h3 id="collector-import-title" className="section-title flex items-center gap-2.5">
          <Gamepad2 className="h-5 w-5 text-accent-soft" aria-hidden="true" /> Partidos del juego
        </h3>
        <p className="text-xs text-ink-3">Los partidos que registró el colector. Importalos al fixture o a la copa: se revisa antes de guardar y nunca pisa un resultado cargado.</p>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      {warnings.length > 0 && (
        <Alert tone="warning" title="Revisá la tabla"><ul className="list-disc space-y-0.5 pl-4">{warnings.map(item => <li key={item}>{item}</li>)}</ul></Alert>
      )}
      {loading ? (
        <div className="skeleton h-24 rounded-xl" aria-label="Cargando" />
      ) : finished.length === 0 ? (
        <p className="text-sm text-ink-3">Todavía no hay partidos terminados del colector.</p>
      ) : (
        <ul className="space-y-3">
          {finished.slice(0, shown).map(match => {
            const plan = planCollectorImport({ match, tournamentData, teamMap });
            const isImported = !plan.ok && /Ya está importado/.test(plan.reason);
            return (
              <li key={match.key} className={`well p-4 space-y-3 ${isImported ? 'opacity-70' : ''}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm text-ink">
                    {match.home.name} <span className="num font-display text-base">{match.home.score}-{match.away.score}</span> {match.away.name}
                    {match.shootout && <span className="num ml-1 text-xs text-ink-3">({match.shootout.home}-{match.shootout.away} pen.)</span>}
                  </span>
                  <span className="text-xs text-ink-3">{match.competition} · {formatDate(match.startedAt)}</span>
                </div>
                {plan.ok ? (
                  <>
                    <Preview plan={plan} />
                    <button type="button" className="btn btn-primary min-h-11" disabled={Boolean(busyKey)} onClick={() => importMatch(match, plan)}>
                      <Download className="h-4 w-4" aria-hidden="true" /> {busyKey === match.key ? 'Importando…' : 'Importar'}
                    </button>
                  </>
                ) : plan.missingTeams ? (
                  <TeamMapper match={match} missing={plan.missingTeams} leagueNames={leagueNames} onSave={saveTeams} />
                ) : (
                  <p className={`text-xs ${isImported ? 'text-success-soft' : 'text-ink-3'}`}>{plan.reason}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {finished.length > shown && (
        <button type="button" className="btn btn-ghost min-h-11 w-full" onClick={() => setShown(count => count + PAGE)}>Ver más</button>
      )}
    </section>
  );
});

export default CollectorImportAdmin;
