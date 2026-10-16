import React, { useState } from 'react';
import { Play, X } from 'lucide-react';
import { Card, Button, ErrorText, Issue } from '../PesUi.jsx';
import { planTeamReplacement } from '../../../pes/teamReplacement.js';

/** Super Admin: replaces a game team's names and squad in one atomic batch, after showing the impact. */
export function ReplacementWizard({ ws, teamId, apply, onDone }) {
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
        <label className="text-xs text-ink-3 flex flex-col gap-1">Nombre nuevo (se aplica a los nombres en inglés/español/base)
          <input value={names} onChange={e => setNames(e.target.value)} className="input" />
        </label>
        <label className="text-xs text-ink-3 flex flex-col gap-1">Plantel nuevo: una línea por jugador, <code>idJugador:dorsal</code> (vacío = no tocar el plantel)
          <textarea value={roster} onChange={e => setRoster(e.target.value)} rows={6} className="input font-mono" />
        </label>
      </div>
      <div className="mt-3 flex gap-2"><Button variant="primary" onClick={buildPlan}><Play className="w-3.5 h-3.5" />Calcular impacto</Button></div>
      <ErrorText error={error} />
      {plan && (
        <div className="mt-3 space-y-2 text-xs text-ink-2">
          <p>Cambios de datos: {plan.impact.fieldChanges} · filas reutilizadas {plan.impact.rowsReused} · agregadas {plan.impact.rowsAdded} · quitadas {plan.impact.rowsRemoved}</p>
          <p>Salen {plan.impact.playersOut.length} jugadores · entran {plan.impact.playersIn.length}</p>
          {plan.impact.otherClubs.length > 0 && <p className="text-warning-soft">Siguen asignados a otro club: {plan.impact.otherClubs.map(o => `${o.playerId} (equipo ${o.teamIds.join('/')})`).join(', ')}</p>}
          {plan.warnings.map(w => <Issue key={w} tone="warning">{w}</Issue>)}
          {plan.errors.map(e => <Issue key={e} tone="error">{e}</Issue>)}
          <Button variant="primary" disabled={!plan.ok || !plan.ops.length} onClick={run}>Aplicar {plan.ops.length} operaciones</Button>
          <p className="text-ink-3">Se aplican todas juntas o ninguna. Quedan como cambios sin guardar hasta que toques «Guardar».</p>
        </div>
      )}
    </Card>
  );
}
