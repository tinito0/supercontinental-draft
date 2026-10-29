import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, Play, Save, RefreshCw } from 'lucide-react';
import { Card, Button, Pill, ErrorText, Issue, Disclosure, plural } from './PesUi.jsx';
import { Alert } from '../ui/Alert.jsx';
import { useCountries } from './useCountries.js';
import { loadDraftTeams } from '../../services/draftTeamsService.js';
import { planDraftTransfer, coachNameOfTeam } from '../../pes/draftTransfer.js';
import { FORMATIONS, DEFAULT_TACTICS } from '../../utils/constants.js';

// Suggestions read "377 · Club name"; the id before the separator is what gets stored.
const SEPARATOR = ' · ';

/** Game teams for the picker: Team.bin names when loaded, otherwise EDIT names. */
function gameTeams(ws) {
  if (ws.bin?.tables.team) {
    const t = ws.bin.tables.team;
    return t.ids().map(id => ({ id, name: t.get(id, 'nameEnglish'), national: t.get(id, 'national') }));
  }
  return ws.edit ? [...ws.edit.teams.keys()].map(id => ({ id, name: ws.edit.readTeam(id).name, national: false })) : [];
}

/** Free-text team picker: commits on blur or when a suggestion is chosen. */
function TargetInput({ value, label, onCommit }) {
  const [text, setText] = useState(value);
  useEffect(() => { setText(value); }, [value]);
  return (
    <input list="pes-game-teams" value={text} placeholder="id o nombre del equipo del juego" aria-label={label}
      onChange={e => { setText(e.target.value); if (e.target.value.includes(SEPARATOR)) onCommit(e.target.value); }}
      onBlur={() => onCommit(text)}
      className="w-full min-w-56 input" />
  );
}

/** Coach of one draft team: empty name keeps the game team's coach. */
function CoachInput({ team, value, current, countries, onChange }) {
  const name = value?.name || '';
  const country = Number(value?.country) || Number(team.country) || 0;
  return (
    <div className="flex flex-wrap gap-2">
      <input value={name} maxLength={44} aria-label={`Nombre del DT de ${team.name}`}
        placeholder={current ? `Mantiene a ${current}` : 'Mantiene el DT del juego'}
        onChange={e => onChange({ name: e.target.value, country })}
        className="w-44 input" />
      {name.trim() && (
        <select value={country} aria-label={`Nacionalidad del DT de ${team.name}`} onChange={e => onChange({ name, country: Number(e.target.value) })}
          className="animate-in fade-in w-36 select">
          {!countries.some(c => c.id === country) && <option value={country}>País {country}</option>}
          {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
    </div>
  );
}

function RemovedList({ removed }) {
  const byClub = new Map();
  for (const r of removed) {
    const key = `${r.teamName} (${r.teamId})`;
    if (!byClub.has(key)) byClub.set(key, new Map());
    const entry = byClub.get(key).get(r.playerId) || { name: r.playerName, files: [], sub: null, empty: false };
    entry.files.push(r.file);
    if (r.substituteName) entry.sub = r.substituteName;
    if (r.emptyPosition) entry.empty = true;
    byClub.get(key).set(r.playerId, entry);
  }
  if (!removed.length) return <p className="text-sm text-ink-3">Ningún fichado estaba en otro club.</p>;
  return (
    <Disclosure className="text-sm text-ink-2" summary={`${byClub.size} ${plural(byClub.size, 'club pierde', 'clubes pierden')} jugadores fichados`}>
      <ul className="mt-2 space-y-1.5 max-h-72 overflow-y-auto overscroll-contain text-xs">
        {[...byClub].map(([club, players]) => (
          <li key={club}>
            <span className="font-semibold text-ink">{club}</span>: {[...players.values()].map(p => `${p.name}${p.sub ? ` (entra ${p.sub})` : ''}${p.empty ? ' (queda el puesto vacío)' : ''}`).join(', ')}
          </li>
        ))}
      </ul>
    </Disclosure>
  );
}

function SkeletonTable() {
  return (
    <ul className="space-y-2" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => <li key={i} className="skeleton h-11" />)}
    </ul>
  );
}

export function PesDraftPanel({ pes }) {
  const { ws, wsDoc } = pes;
  const [teams, setTeams] = useState(null);
  const [map, setMap] = useState(() => ({ ...(wsDoc?.draftMap || {}) }));
  const [coaches, setCoaches] = useState(() => ({ ...(wsDoc?.draftCoaches || {}) }));
  const countries = useCountries();
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setMap({ ...(wsDoc?.draftMap || {}) }); }, [wsDoc?.draftMap]);
  useEffect(() => { setCoaches({ ...(wsDoc?.draftCoaches || {}) }); }, [wsDoc?.draftCoaches]);
  const options = useMemo(() => (ws ? gameTeams(ws) : []), [ws]);
  const nameOf = id => options.find(o => o.id === Number(id))?.name;

  const load = async () => {
    setError(null);
    setBusy(true);
    try { setTeams(await loadDraftTeams()); } catch (e) {
      setError(/permission|insufficient/i.test(e.message) ? new Error('No se pudieron leer los planteles: hace falta la cuenta admin de la app.') : e);
    } finally { setBusy(false); }
  };
  useEffect(() => { load(); }, []);

  const setTarget = (teamId, value) => {
    setPlan(null);
    setMap(m => {
      const next = { ...m };
      const raw = String(value).trim();
      const id = Number(raw.split(/\s/)[0]);
      if (!raw || !Number.isInteger(id) || !options.some(o => o.id === id)) delete next[teamId]; else next[teamId] = id;
      return next;
    });
  };

  const saveMap = async () => {
    setError(null);
    const named = Object.fromEntries(Object.entries(coaches).filter(([, c]) => c?.name?.trim()).map(([k, c]) => [k, { name: c.name.trim(), country: Number(c.country) || null }]));
    try { await pes.setDraftMap(map, named); setNotice('Asignación guardada.'); } catch (e) { setError(e); }
  };

  const calculate = () => {
    setError(null);
    setNotice(null);
    try { setPlan(planDraftTransfer(ws, teams, map, { formations: FORMATIONS, defaultTactics: DEFAULT_TACTICS, coaches })); } catch (e) { setError(e); setPlan(null); }
  };

  const apply = async () => {
    setError(null);
    setBusy(true);
    try {
      await pes.apply(plan.ops);
      setNotice(`Listo: ${plan.ops.length} cambios aplicados a la copia de trabajo (sin guardar). Seguí en «Cambios y exportación»: Guardar, Validar y Exportar.`);
      setPlan(null);
    } catch (e) { setError(e); } finally { setBusy(false); }
  };

  if (!ws) return <Card><p className="text-sm text-ink-3">Cargá el espacio de trabajo (base y EDIT) primero.</p></Card>;
  const mapped = Object.keys(map).length;

  return (
    <div className="space-y-4">
      <Card title="Equipos del draft a equipos del juego"
        description="Cada equipo del draft reemplaza al equipo del juego que elijas: nombre, abreviatura, país, plantel con dorsales, 11 titular, formación, estrategia, capitán y pateadores. Se escribe en la base (Team.bin, PlayerAssignment.bin) y en el EDIT. Los fichados salen de su club original (las selecciones no se tocan). Si escribís un DT, se renombra el entrenador del equipo reemplazado; vacío, queda el del juego. Nada se modifica hasta que tocás «Aplicar»."
        actions={<>
          <Button onClick={load} disabled={busy}><RefreshCw className={`w-4 h-4 ${busy && !teams ? 'animate-spin' : ''}`} aria-hidden="true" />Recargar equipos</Button>
          <Button onClick={saveMap}><Save className="w-4 h-4" aria-hidden="true" />Guardar asignación</Button>
          <Button variant="primary" disabled={!teams || !mapped} title={!mapped ? 'Elegí al menos un equipo del juego' : undefined} onClick={calculate}>
            <Calculator className="w-4 h-4" aria-hidden="true" />Calcular
          </Button>
        </>}>
        <datalist id="pes-game-teams">{options.map(o => <option key={o.id} value={`${o.id}${SEPARATOR}${o.name}${o.national ? ' (selección)' : ''}`} />)}</datalist>
        <div className="space-y-3">
          {!teams && !error && <SkeletonTable />}
          {teams && teams.length === 0 && <p className="text-sm text-ink-3">El draft no tiene equipos todavía.</p>}
          {teams && teams.length > 0 && (
            <div className="overflow-x-auto -mx-4 sm:-mx-5">
              <table className="data-table min-w-[44rem]">
                <thead>
                  <tr>
                    <th scope="col">Equipo del draft</th>
                    <th scope="col" className="text-right">Jugadores</th>
                    <th scope="col">Reemplaza a</th>
                    <th scope="col">DT</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map(t => {
                    const badSize = t.players.length < 11 || t.players.length > 40;
                    return (
                      <tr key={t.id}>
                        <td>
                          <span className="font-semibold text-ink">{t.name}</span>
                          {!t.inWhitelist && <span className="block"><Pill tone="amber">fuera de la lista</Pill></span>}
                        </td>
                        <td className={`num text-right ${badSize ? 'text-danger-soft font-semibold' : ''}`} title={badSize ? 'Un plantel necesita entre 11 y 40 jugadores' : undefined}>
                          {t.players.length}
                        </td>
                        <td>
                          <TargetInput value={map[t.id] ? `${map[t.id]}${SEPARATOR}${nameOf(map[t.id]) || ''}` : ''} label={`Equipo del juego para ${t.name}`}
                            onCommit={v => setTarget(t.id, v)} />
                        </td>
                        <td>
                          <CoachInput team={t} value={coaches[t.id]} countries={countries} current={map[t.id] ? coachNameOfTeam(ws, Number(map[t.id])) : null}
                            onChange={c => { setPlan(null); setCoaches(prev => ({ ...prev, [t.id]: c })); }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {notice && <Alert tone="success">{notice}</Alert>}
          <ErrorText error={error} />
        </div>
      </Card>

      {plan && (
        <div className="animate-in fade-in slide-in-from-top">
          <Card title="Resultado del cálculo" actions={(
            <Button variant="primary" disabled={!plan.ok || busy} onClick={apply}><Play className="w-4 h-4" aria-hidden="true" />Aplicar {plan.ops.length} cambios</Button>
          )}>
            <div className="space-y-3">
              {plan.errors.length > 0 && (
                <div className="text-sm text-danger-soft space-y-1">
                  <p className="font-semibold">Hay que corregir esto antes de aplicar:</p>
                  {plan.errors.map(e => <Issue key={e} tone="error">{e}</Issue>)}
                </div>
              )}
              {plan.ok && (
                <div className="overflow-x-auto -mx-4 sm:-mx-5">
                  <table className="data-table min-w-[32rem]">
                    <thead><tr><th scope="col">Equipo del draft</th><th scope="col">Reemplaza a</th><th scope="col" className="text-right">Plantel</th><th scope="col">DT</th></tr></thead>
                    <tbody>{plan.teams.map(t => (
                      <tr key={t.draftTeamId}>
                        <td className="font-semibold text-ink">{t.name}</td>
                        <td>{nameOf(t.pesTeamId)} <span className="num text-ink-3">({t.pesTeamId})</span></td>
                        <td className="num text-right">{t.players}</td>
                        <td>{t.coachName || <span className="text-ink-3">{coachNameOfTeam(ws, t.pesTeamId) || 'sin cambios'}</span>}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
              {plan.ok && <RemovedList removed={plan.removed} />}
              {plan.warnings.length > 0 && (
                <Disclosure className="text-sm text-warning-soft" summary={`${plan.warnings.length} ${plural(plan.warnings.length, 'aviso', 'avisos')}`}>
                  <ul className="mt-1 space-y-1 max-h-60 overflow-y-auto overscroll-contain text-xs">{plan.warnings.map(w => <Issue as="li" key={w} tone="warning">{w}</Issue>)}</ul>
                </Disclosure>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
