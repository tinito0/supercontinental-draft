import React, { useMemo, useState } from 'react';
import { Replace, Play, X } from 'lucide-react';
import { Card, Button, Pill, FieldInput, SearchInput, ErrorText } from './PesUi.jsx';
import { EDIT_TEAM_FIELDS, EDIT_LOCKED_FIELDS, from6bit, to6bit } from '../../pes/formats/pes2021/editLayout.js';
import { EDIT_TEAM_KIT_FIELDS } from '../../pes/permissions.js';
import { planTeamReplacement } from '../../pes/teamReplacement.js';
import { opKey } from './opKeys.js';

const hex2 = v => from6bit(v).toString(16).padStart(2, '0');

function TeamColours({ edit, teamId, canEdit, onApply }) {
  const t = edit.readTeam(teamId);
  const colour = (r, g, b) => `#${hex2(t[r])}${hex2(t[g])}${hex2(t[b])}`;
  const setColour = (prefix, value) => {
    const [r, g, b] = [1, 3, 5].map(i => to6bit(parseInt(value.slice(i, i + 2), 16)));
    onApply([['r', r], ['g', g], ['b', b]]
      .filter(([c, v]) => t[`${prefix}${c}`] !== v)
      .map(([c, v]) => ({ type: 'edit.team.set', target: { teamId }, field: `${prefix}${c}`, value: v })));
  };
  return (
    <div className="flex flex-wrap gap-4">
      {[['c1', 'Color 1', colour('c1r', 'c1g', 'c1b')], ['c2', 'Color 2', colour('c2r', 'c2g', 'c2b')]].map(([p, label, value]) => (
        <label key={p} className="flex items-center gap-2 text-xs text-slate-300">
          <input type="color" value={value} disabled={!canEdit} onChange={e => setColour(p, e.target.value)} className="w-9 h-9 rounded bg-transparent" />
          {label} <code className="text-slate-500">{value}</code>
        </label>
      ))}
      <p className="w-full text-[11px] text-slate-500">El EDIT guarda cada canal en 6 bits: el color se redondea al más cercano.</p>
    </div>
  );
}

function ReplacementWizard({ ws, teamId, apply, onDone }) {
  const [names, setNames] = useState('');
  const [roster, setRoster] = useState('');
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);

  const buildPlan = () => {
    setError(null);
    try {
      const fields = {};
      if (names.trim()) for (const f of ['nameEnglish', 'nameSpanish', 'nameLatamSpanish', 'nameUSEnglish', 'nameDatabase']) fields[f] = names.trim();
      const lines = roster.split(/\n/).map(l => l.trim()).filter(Boolean);
      const parsed = lines.map(l => {
        const m = l.match(/^(\d+)\s*[:;,\s]\s*(\d+)$/);
        if (!m) throw new Error(`Línea inválida: "${l}" (formato: idJugador:dorsal)`);
        return { playerId: Number(m[1]), shirtNumber: Number(m[2]) };
      });
      setPlan(planTeamReplacement(ws.bin, { teamId, fields, roster: parsed.length ? parsed : undefined }, { kits: ws.kits }));
    } catch (e) { setError(e); }
  };

  const run = async () => {
    try { await apply(plan.ops); setPlan(null); onDone(); } catch (e) { setError(e); }
  };

  return (
    <Card title="Reemplazar equipo" actions={<Button onClick={onDone}><X className="w-3.5 h-3.5" />Cerrar</Button>}>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs text-slate-400 flex flex-col gap-1">Nombre nuevo (se aplica a los nombres en inglés/español/base)
          <input value={names} onChange={e => setNames(e.target.value)} className="bg-[#111722] border border-white/[0.08] rounded-md px-2 py-1.5 text-white" />
        </label>
        <label className="text-xs text-slate-400 flex flex-col gap-1">Plantel nuevo: una línea por jugador, <code>idJugador:dorsal</code> (vacío = no tocar el plantel)
          <textarea value={roster} onChange={e => setRoster(e.target.value)} rows={6} className="bg-[#111722] border border-white/[0.08] rounded-md px-2 py-1.5 text-white font-mono" />
        </label>
      </div>
      <div className="mt-3 flex gap-2"><Button variant="primary" onClick={buildPlan}><Play className="w-3.5 h-3.5" />Calcular impacto</Button></div>
      <ErrorText error={error} />
      {plan && (
        <div className="mt-3 space-y-2 text-xs text-slate-300">
          <p>Cambios de datos: {plan.impact.fieldChanges} · filas reutilizadas {plan.impact.rowsReused} · agregadas {plan.impact.rowsAdded} · quitadas {plan.impact.rowsRemoved}</p>
          <p>Salen {plan.impact.playersOut.length} jugadores · entran {plan.impact.playersIn.length}</p>
          {plan.impact.otherClubs.length > 0 && <p className="text-amber-300">Siguen asignados a otro club: {plan.impact.otherClubs.map(o => `${o.playerId} (equipo ${o.teamIds.join('/')})`).join(', ')}</p>}
          {plan.warnings.map(w => <p key={w} className="text-amber-300">⚠ {w}</p>)}
          {plan.errors.map(e => <p key={e} className="text-red-300">✕ {e}</p>)}
          <Button variant="primary" disabled={!plan.ok || !plan.ops.length} onClick={run}>Aplicar {plan.ops.length} operaciones</Button>
          <p className="text-slate-500">Se aplican todas juntas o ninguna. Quedan como cambios sin guardar hasta que toques «Guardar».</p>
        </div>
      )}
    </Card>
  );
}

export function PesTeamsPanel({ pes, onApply }) {
  const { ws, caps, version, modified } = pes;
  const [q, setQ] = useState('');
  const [teamId, setTeamId] = useState(null);
  const [replacing, setReplacing] = useState(false);
  const canEditTeam = caps.has('team.edit');
  const canEditColours = canEditTeam || caps.has('kit.edit');

  const teams = useMemo(() => {
    if (!ws) return [];
    if (ws.bin?.tables.team) {
      const t = ws.bin.tables.team;
      return t.ids().map(id => ({ id, name: t.get(id, 'nameEnglish') || t.get(id, 'nameDatabase'), national: t.get(id, 'national') }));
    }
    if (ws.edit) return [...ws.edit.teams.keys()].map(id => ({ id, name: ws.edit.readTeam(id).name }));
    return [];
  }, [ws, version]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (s ? teams.filter(t => String(t.id) === s || (t.name || '').toLowerCase().includes(s)) : teams).slice(0, 200);
  }, [teams, q]);

  if (!ws?.bin?.tables.team && !ws?.edit) return <Card><p className="text-xs text-slate-400">Cargá Team.bin o un EDIT para ver equipos.</p></Card>;

  const binTeam = teamId != null && ws.bin?.tables.team?.has(teamId) ? ws.bin.tables.team : null;
  const editHasTeam = teamId != null && ws.edit?.teams.has(teamId);
  const squad = binTeam && ws.bin.tables.assignment
    ? ws.bin.tables.assignment.ids().map(id => ws.bin.tables.assignment.read(id)).filter(r => r.teamId === teamId)
    : [];
  const playerName = id => (ws.bin?.tables.player?.has(id) ? ws.bin.tables.player.get(id, 'name') : ws.edit?.players.has(id) ? ws.edit.readPlayer(id).name : `#${id}`);

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      <Card title={`Equipos (${teams.length})`}>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar por nombre o id" />
        <ul className="mt-2 max-h-[60vh] overflow-y-auto space-y-0.5">
          {filtered.map(t => (
            <li key={t.id}>
              <button type="button" onClick={() => { setTeamId(t.id); setReplacing(false); }}
                className={`w-full text-left px-2 py-1.5 rounded text-xs ${t.id === teamId ? 'bg-cyan-500/15 text-white' : 'text-slate-300 hover:bg-white/[0.04]'}`}>
                <span className="text-slate-500 mr-2">{t.id}</span>{t.name}{t.national && <Pill>selección</Pill>}
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <div className="space-y-4">
        {teamId == null && <Card><p className="text-xs text-slate-400">Elegí un equipo.</p></Card>}

        {binTeam && (
          <Card title={`Team.bin · ${binTeam.get(teamId, 'nameEnglish')}`} actions={caps.has('team.replace') && ws.bin.tables.assignment && ws.bin.tables.player &&
            <Button variant="danger" onClick={() => setReplacing(true)}><Replace className="w-3.5 h-3.5" />Reemplazar equipo</Button>}>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {binTeam.fields.filter(f => f.name !== 'id' && !/^(team2020|country2020|value2020)/i.test(f.name)).map(f => (
                <FieldInput key={f.name} field={f} value={binTeam.get(teamId, f.name)} readOnly={!canEditTeam}
                  modified={modified.has(opKey({ type: 'bin.team.set', target: { teamId }, field: f.name }))}
                  onCommit={value => onApply([{ type: 'bin.team.set', target: { teamId }, field: f.name, value }])} />
              ))}
            </div>
          </Card>
        )}

        {replacing && binTeam && <ReplacementWizard ws={ws} teamId={teamId} apply={onApply} onDone={() => setReplacing(false)} />}

        {binTeam && squad.length > 0 && (
          <Card title={`Plantel en PlayerAssignment.bin (${squad.length})`}>
            <table className="w-full text-xs text-slate-300">
              <thead><tr className="text-left text-slate-500"><th className="py-1">Dorsal</th><th>Jugador</th><th>Id</th><th>Fila</th></tr></thead>
              <tbody>
                {squad.sort((a, b) => a.shirtNumber - b.shirtNumber).map(r => (
                  <tr key={r.id} className="border-t border-white/[0.04]">
                    <td className="py-1 w-20">
                      <FieldInput field={ws.bin.tables.assignment.field('shirtNumber')} value={r.shirtNumber} label=" " readOnly={!canEditTeam}
                        modified={modified.has(opKey({ type: 'bin.assignment.set', target: { assignmentId: r.id }, field: 'shirtNumber' }))}
                        onCommit={value => onApply([{ type: 'bin.assignment.set', target: { assignmentId: r.id }, field: 'shirtNumber', value }])} />
                    </td>
                    <td>{playerName(r.playerId)}</td><td className="text-slate-500">{r.playerId}</td><td className="text-slate-600">{r.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {editHasTeam && (
          <Card title="EDIT00000000 · colores del equipo">
            <TeamColours edit={ws.edit} teamId={teamId} canEdit={canEditColours} onApply={onApply} />
          </Card>
        )}

        {editHasTeam && (
          <Card title="EDIT00000000 · datos del equipo">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {EDIT_TEAM_FIELDS.filter(f => !EDIT_LOCKED_FIELDS.has(f.name) && !EDIT_TEAM_KIT_FIELDS.includes(f.name)).map(f => (
                <FieldInput key={f.name} field={f} value={ws.edit.readTeam(teamId)[f.name]} readOnly={!canEditTeam}
                  modified={modified.has(opKey({ type: 'edit.team.set', target: { teamId }, field: f.name }))}
                  onCommit={value => onApply([{ type: 'edit.team.set', target: { teamId }, field: f.name, value }])} />
              ))}
            </div>
            <h4 className="mt-4 mb-1 text-[11px] font-bold uppercase text-slate-400">Plantel en el EDIT</h4>
            <table className="w-full text-xs text-slate-300">
              <tbody>
                {ws.edit.roster(teamId).map(r => (
                  <tr key={r.slot} className="border-t border-white/[0.04]">
                    <td className="py-1 w-20">
                      <FieldInput field={{ name: 'dorsal', kind: 'bits', offset: 0, shift: 0, bits: 7, addend: 0 }} value={r.number} label=" " readOnly={!canEditTeam}
                        modified={modified.has(opKey({ type: 'edit.roster.number', target: { teamId, slot: r.slot } }))}
                        onCommit={value => onApply([{ type: 'edit.roster.number', target: { teamId, slot: r.slot }, value }])} />
                    </td>
                    <td>{playerName(r.playerId)}</td><td className="text-slate-500">{r.playerId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
