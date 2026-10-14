import React, { useState } from 'react';
import { Save, Undo2, ShieldCheck, Download, Trash2 } from 'lucide-react';
import { Card, Button, Pill, ErrorText, downloadBytes } from './PesUi.jsx';

const TYPE_LABEL = {
  'bin.team.set': 'Equipo (BIN)', 'bin.player.set': 'Jugador (BIN)', 'bin.assignment.set': 'Asignación', 'bin.assignment.add': 'Alta en plantel',
  'bin.assignment.remove': 'Baja de plantel', 'edit.team.set': 'Equipo (EDIT)', 'edit.player.set': 'Jugador (EDIT)', 'edit.roster.number': 'Dorsal (EDIT)',
  'edit.roster.player': 'Plantel (EDIT)', 'edit.team.squad': 'Plantel y táctica (EDIT)', 'edit.roster.remove': 'Baja (EDIT)',
  'bin.coach.set': 'Entrenador (BIN)', 'edit.coach.set': 'Entrenador (EDIT)', 'kit.set': 'Kit', 'kit.add': 'Kit nuevo', 'kit.texture.set': 'Textura de kit',
};

const fmt = v => (v == null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

function describe(op) {
  const t = op.target || {};
  const where = t.playerId != null ? `jugador ${t.playerId}` : t.coachId != null ? `entrenador ${t.coachId}` : t.assignmentId != null ? `fila ${t.assignmentId}` : t.kit ? `equipo ${t.teamId} · ${t.kit}` : `equipo ${t.teamId}${t.slot != null ? ` · lugar ${t.slot}` : ''}`;
  const what = op.field || op.key || op.slot || '';
  return `${where}${what ? ` · ${what}` : ''}`;
}

function OpRow({ op, actions }) {
  return (
    <li className="flex flex-wrap items-center gap-2 py-1.5 border-t border-white/[0.04] text-xs">
      <Pill tone={op.state === 'discarded' ? 'slate' : 'cyan'}>{TYPE_LABEL[op.type] || op.type}</Pill>
      <span className={op.state === 'discarded' ? 'line-through text-slate-500' : 'text-slate-200'}>{describe(op)}</span>
      <span className="text-slate-500">{fmt(op.before)} → <b className="text-slate-300">{fmt(op.after ?? op.value)}</b></span>
      {op.batch === 'team.replace' && <Pill tone="amber">reemplazo</Pill>}
      <span className="ml-auto flex gap-1">{actions}</span>
    </li>
  );
}

function ValidationView({ v }) {
  if (!v) return <p className="text-xs text-slate-400">Todavía no se validó esta versión de la copia de trabajo.</p>;
  return (
    <div className="space-y-2 text-xs">
      <p className={v.passed ? 'text-emerald-300' : 'text-red-300'}>{v.passed ? 'Validación aprobada.' : `${v.errors.length} error(es) nuevos: la exportación está bloqueada.`}</p>
      {v.errors.map(i => <p key={i.key} className="text-red-300">✕ {i.message}</p>)}
      {v.warnings.map(i => <p key={i.key} className="text-amber-300">⚠ {i.message}</p>)}
      {v.preexisting.length > 0 && (
        <details className="text-slate-400">
          <summary className="cursor-pointer">{v.preexisting.length} problema(s) que ya venían en los archivos originales (no bloquean)</summary>
          <ul className="mt-1 max-h-48 overflow-y-auto">{v.preexisting.map(i => <li key={i.key}>{i.message}</li>)}</ul>
        </details>
      )}
    </div>
  );
}

export function PesChangesPanel({ pes }) {
  const { drafts, savedOps, caps, validation, exportsList, failures, actor } = pes;
  const [error, setError] = useState(null);
  const [lastExport, setLastExport] = useState(null);
  const run = fn => async () => { setError(null); try { await fn(); } catch (e) { setError(e); } };
  const canDiscard = op => caps.has('workspace.manage') || op.actorUid === actor?.uid;

  const doExport = run(async () => {
    const { zip, manifest } = await pes.exportZip();
    downloadBytes(zip, `pes2021-export-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`);
    setLastExport(manifest);
  });

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card title={`Sin guardar (${drafts.length})`} actions={<>
        <Button variant="primary" disabled={!drafts.length || Boolean(pes.busy)} onClick={run(pes.saveDrafts)}><Save className="w-3.5 h-3.5" />Guardar</Button>
        <Button variant="danger" disabled={!drafts.length} onClick={run(() => pes.discardDrafts())}><Undo2 className="w-3.5 h-3.5" />Descartar todo</Button>
      </>}>
        {drafts.length === 0 && <p className="text-xs text-slate-400">No hay cambios pendientes.</p>}
        <ul>{drafts.map((op, i) => (
          <OpRow key={op.clientId || i} op={op} actions={<Button onClick={run(() => pes.discardDrafts([i]))}><Undo2 className="w-3 h-3" /></Button>} />
        ))}</ul>
        <p className="mt-2 text-[11px] text-slate-500">Los cambios sin guardar viven en este navegador (sobreviven a recargar). «Guardar» los agrega al historial compartido.</p>
      </Card>

      <Card title="Validación" actions={<Button onClick={run(pes.runValidation)}><ShieldCheck className="w-3.5 h-3.5" />Validar</Button>}>
        <ValidationView v={validation} />
        {failures.length > 0 && (
          <div className="mt-3 text-xs text-red-300">
            <p className="font-bold">{failures.length} cambio(s) del historial no se pudieron aplicar sobre las fuentes actuales:</p>
            <ul>{failures.slice(0, 20).map((f, i) => <li key={i}>✕ {describe(f.op)}: {f.error.message}</li>)}</ul>
          </div>
        )}
      </Card>

      <Card title={`Historial guardado (${savedOps.length})`}>
        {savedOps.length === 0 && <p className="text-xs text-slate-400">Sin cambios guardados.</p>}
        <ul className="max-h-[50vh] overflow-y-auto">{[...savedOps].reverse().map(op => (
          <OpRow key={op.id} op={op} actions={op.state !== 'discarded' && canDiscard(op) && (
            <Button title="Descartar este cambio" onClick={run(() => pes.discardSaved(op.id))}><Trash2 className="w-3 h-3" /></Button>
          )} />
        ))}</ul>
      </Card>

      <Card title="Exportar ZIP" actions={caps.has('export') && (
        <Button variant="primary" disabled={!validation?.passed || drafts.length > 0 || Boolean(pes.busy)} onClick={doExport}><Download className="w-3.5 h-3.5" />Exportar</Button>
      )}>
        {!caps.has('export') && <p className="text-xs text-slate-400">Solo el Super Admin exporta.</p>}
        {caps.has('export') && (
          <ul className="text-xs text-slate-400 space-y-1">
            <li>{drafts.length ? '✕ Guardá o descartá los cambios pendientes.' : '✓ No hay cambios pendientes.'}</li>
            <li>{validation?.passed ? '✓ Validación aprobada.' : '✕ Validá la copia de trabajo (sin errores nuevos).'}</li>
            <li>El ZIP trae solo los archivos generados (BIN modificados, EDIT, config.txt y texturas) más manifest.json. No se prueba dentro del juego.</li>
          </ul>
        )}
        {lastExport && (
          <div className="mt-3 text-xs text-emerald-300">
            <p>Exportado y verificado: {lastExport.files.length} archivo(s).</p>
            <ul className="text-slate-400">{lastExport.verification.map(v => <li key={v.path}><code>{v.path}</code> — {v.check}</li>)}</ul>
          </div>
        )}
        {exportsList.length > 0 && (
          <details className="mt-3 text-xs text-slate-400">
            <summary className="cursor-pointer">Exportaciones anteriores ({exportsList.length})</summary>
            <ul>{exportsList.map(e => <li key={e.id}>{e.exportedAt?.toDate?.().toLocaleString() || '—'} · {(e.files || []).map(f => f.path).join(', ')}</li>)}</ul>
          </details>
        )}
      </Card>
      <div className="xl:col-span-2"><ErrorText error={error} /></div>
    </div>
  );
}
