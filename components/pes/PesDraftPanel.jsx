import React, { useEffect, useMemo, useState } from 'react';
import { Users, Calculator, Play, Save, RefreshCw } from 'lucide-react';
import { Card, Button, Pill, ErrorText } from './PesUi.jsx';
import { loadDraftTeams } from '../../services/draftTeamsService.js';
import { planDraftTransfer, coachNameOfTeam } from '../../pes/draftTransfer.js';
import { FORMATIONS, DEFAULT_TACTICS } from '../../utils/constants.js';

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
      onChange={e => { setText(e.target.value); if (/ — /.test(e.target.value)) onCommit(e.target.value); }}
      onBlur={() => onCommit(text)}
      className="w-full max-w-sm bg-[#111722] border border-white/[0.08] rounded-md px-2 py-1 text-xs text-white" />
  );
}

/** Country list of the app (public/paises.json, same as the EJOGC exporter). */
function useCountries() {
  const [countries, setCountries] = useState([]);
  useEffect(() => {
    let alive = true;
    fetch('/paises.json')
      .then(r => (r.ok ? r.json() : {}))
      .then(data => {
        if (!alive) return;
        setCountries(Object.entries(data).map(([id, name]) => ({ id: Number(id), name }))
          .filter(c => c.id > 0 && c.name && c.name !== 'N/A').sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => { if (alive) setCountries([]); });
    return () => { alive = false; };
  }, []);
  return countries;
}

/** Coach of one draft team: empty name keeps the game team's coach. */
function CoachInput({ team, value, current, countries, onChange }) {
  const name = value?.name || '';
  const country = Number(value?.country) || Number(team.country) || 0;
  return (
    <div className="flex flex-wrap gap-1">
      <input value={name} maxLength={44} aria-label={`Nombre del DT de ${team.name}`}
        placeholder={current ? `Mantiene a ${current}` : 'Mantiene el DT del juego'}
        onChange={e => onChange({ name: e.target.value, country })}
        className="w-40 bg-[#111722] border border-white/[0.08] rounded-md px-2 py-1 text-xs text-white" />
      {name.trim() && (
        <select value={country} aria-label={`Nacionalidad del DT de ${team.name}`} onChange={e => onChange({ name, country: Number(e.target.value) })}
          className="w-32 bg-[#111722] border border-white/[0.08] rounded-md px-1 py-1 text-xs text-white">
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
  return (
    <details className="text-xs text-slate-300">
      <summary className="cursor-pointer">{removed.length ? `${byClub.size} club(es) pierden jugadores fichados` : 'Ningún fichado estaba en otro club'}</summary>
      <ul className="mt-2 space-y-1 max-h-72 overflow-y-auto">
        {[...byClub].map(([club, players]) => (
          <li key={club}>
            <b>{club}</b>: {[...players.values()].map(p => `${p.name}${p.sub ? ` (entra ${p.sub})` : ''}${p.empty ? ' (queda el puesto vacío)' : ''}`).join(', ')}
          </li>
        ))}
      </ul>
    </details>
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
      setNotice(`Listo: ${plan.ops.length} cambios aplicados a la copia de trabajo (sin guardar). Seguí en «Cambios y exportación»: Guardar → Validar → Exportar.`);
      setPlan(null);
    } catch (e) { setError(e); } finally { setBusy(false); }
  };

  if (!ws) return <Card><p className="text-xs text-slate-400">Cargá el espacio de trabajo (base y EDIT) primero.</p></Card>;
  const mapped = Object.keys(map).length;

  return (
    <div className="space-y-4">
      <Card title="Equipos del draft → equipos del juego" actions={<>
        <Button onClick={load} disabled={busy}><RefreshCw className="w-3.5 h-3.5" />Recargar equipos</Button>
        <Button onClick={saveMap}><Save className="w-3.5 h-3.5" />Guardar asignación</Button>
        <Button variant="primary" disabled={!teams || !mapped} onClick={calculate}><Calculator className="w-3.5 h-3.5" />Calcular</Button>
      </>}>
        <p className="text-xs text-slate-400 mb-3">
          Cada equipo del draft reemplaza al equipo del juego que elijas: nombre, abreviatura, país, plantel con dorsales, 11 titular, formación,
          estrategia, capitán y pateadores. Se escribe en la base (Team.bin, PlayerAssignment.bin) y en el EDIT. Los fichados salen de su club original
          (las selecciones no se tocan). Si escribís un DT, se renombra el entrenador del equipo reemplazado (Coach.bin y EDIT); vacío, queda el del juego.
          Nada se modifica hasta que tocás «Aplicar».
        </p>
        <datalist id="pes-game-teams">{options.map(o => <option key={o.id} value={`${o.id} — ${o.name}${o.national ? ' (selección)' : ''}`} />)}</datalist>
        {!teams && !error && <p className="text-xs text-slate-400">Cargando equipos del draft…</p>}
        {teams && (
          <table className="w-full text-xs text-slate-300">
            <thead><tr className="text-left text-slate-500"><th className="py-1">Equipo del draft</th><th>Jugadores</th><th>Reemplaza a</th><th>DT</th></tr></thead>
            <tbody>
              {teams.map(t => (
                <tr key={t.id} className="border-t border-white/[0.04]">
                  <td className="py-1.5"><Users className="inline w-3.5 h-3.5 mr-1 text-slate-500" />{t.name}{!t.inWhitelist && <Pill>fuera de la lista</Pill>}</td>
                  <td className={t.players.length < 11 || t.players.length > 40 ? 'text-red-300' : ''}>{t.players.length}</td>
                  <td className="py-1">
                    <TargetInput value={map[t.id] ? `${map[t.id]} — ${nameOf(map[t.id]) || ''}` : ''} label={`Equipo del juego para ${t.name}`}
                      onCommit={v => setTarget(t.id, v)} />
                  </td>
                  <td className="py-1">
                    <CoachInput team={t} value={coaches[t.id]} countries={countries} current={map[t.id] ? coachNameOfTeam(ws, Number(map[t.id])) : null}
                      onChange={c => { setPlan(null); setCoaches(prev => ({ ...prev, [t.id]: c })); }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {notice && <p className="text-xs text-emerald-300 mt-3">{notice}</p>}
        <ErrorText error={error} />
      </Card>

      {plan && (
        <Card title="Resultado del cálculo" actions={<Button variant="primary" disabled={!plan.ok || busy} onClick={apply}><Play className="w-3.5 h-3.5" />Aplicar {plan.ops.length} cambios</Button>}>
          {plan.errors.length > 0 && (
            <div className="mb-3 text-xs text-red-300 space-y-1">
              <p className="font-bold">Hay que corregir esto antes de aplicar:</p>
              {plan.errors.map(e => <p key={e}>✕ {e}</p>)}
            </div>
          )}
          {plan.ok && (
            <table className="w-full text-xs text-slate-300 mb-3">
              <thead><tr className="text-left text-slate-500"><th className="py-1">Equipo del draft</th><th>Reemplaza a</th><th>Plantel</th><th>DT</th></tr></thead>
              <tbody>{plan.teams.map(t => (
                <tr key={t.draftTeamId} className="border-t border-white/[0.04]"><td className="py-1">{t.name}</td><td>{nameOf(t.pesTeamId)} ({t.pesTeamId})</td><td>{t.players}</td><td>{t.coachName || <span className="text-slate-500">{coachNameOfTeam(ws, t.pesTeamId) || 'sin cambios'}</span>}</td></tr>
              ))}</tbody>
            </table>
          )}
          {plan.ok && <RemovedList removed={plan.removed} />}
          {plan.warnings.length > 0 && (
            <details className="mt-2 text-xs text-amber-300">
              <summary className="cursor-pointer">{plan.warnings.length} aviso(s)</summary>
              <ul className="mt-1 space-y-0.5 max-h-60 overflow-y-auto">{plan.warnings.map(w => <li key={w}>⚠ {w}</li>)}</ul>
            </details>
          )}
        </Card>
      )}
    </div>
  );
}
