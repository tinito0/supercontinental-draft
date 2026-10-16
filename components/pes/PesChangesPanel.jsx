import React, { useState } from 'react';
import { Save, Undo2, ShieldCheck, Download, Trash2 } from 'lucide-react';
import { Card, Button, Pill, ErrorText, Issue, downloadBytes } from './PesUi.jsx';

const TYPE_LABEL = {
  'bin.team.set': 'Equipo (BIN)', 'bin.player.set': 'Jugador (BIN)', 'bin.assignment.set': 'Asignación', 'bin.assignment.add': 'Alta en plantel',
  'bin.assignment.remove': 'Baja de plantel', 'edit.team.set': 'Equipo (EDIT)', 'edit.player.set': 'Jugador (EDIT)', 'edit.roster.number': 'Dorsal (EDIT)',
  'edit.roster.player': 'Plantel (EDIT)', 'edit.team.squad': 'Plantel y táctica (EDIT)', 'edit.roster.remove': 'Baja (EDIT)',
  'bin.coach.set': 'Entrenador (BIN)', 'bin.team.tactics': 'Táctica (BIN)', 'edit.coach.set': 'Entrenador (EDIT)', 'kit.set': 'Kit', 'kit.add': 'Kit nuevo', 'kit.texture.set': 'Textura de kit',
};

const fmt = v => (v == null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

function describe(op) {
  const t = op.target || {};
  const where = t.playerId != null ? `jugador ${t.playerId}` : t.coachId != null ? `entrenador ${t.coachId}` : t.assignmentId != null ? `fila ${t.assignmentId}` : t.kit ? `equipo ${t.teamId} · ${t.kit}` : `equipo ${t.teamId}${t.slot != null ? ` · lugar ${t.slot}` : ''}`;
  const what = op.field || op.key || op.slot || '';
  return `${where}${what ? ` · ${what}` : ''}`;
}

/** One operation: what changed (type, target, before → after) and its row actions. */
function OpRow({ op, actions }) {
  const discarded = op.state === 'discarded';
  return (
    <li className="flex items-start gap-3 py-2.5 border-t border-line/[0.07] first:border-t-0 text-sm">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">
          {TYPE_LABEL[op.type] || op.type}{op.batch === 'team.replace' && ' · reemplazo de plantel'}{discarded && ' · descartado'}
        </p>
        <p className={`mt-0.5 truncate ${discarded ? 'line-through text-ink-3' : 'text-ink'}`}>{describe(op)}</p>
        <p className="text-xs text-ink-3 break-all">{fmt(op.before)} <span aria-hidden="true">→</span><span className="sr-only">pasa a</span> <span className="text-ink-2 font-semibold">{fmt(op.after ?? op.value)}</span></p>
      </div>
      {actions && <span className="flex gap-1 shrink-0">{actions}</span>}
    </li>
  );
}

function ValidationView({ v }) {
  if (!v) return <p className="text-sm text-ink-3">Todavía no se validó esta versión de la copia de trabajo.</p>;
  return (
    <div className="space-y-2 text-sm">
      <Issue tone={v.passed ? 'ok' : 'error'}>{v.passed ? 'Validación aprobada.' : `${v.errors.length} error(es) nuevos: la exportación está bloqueada.`}</Issue>
      {v.errors.map(i => <Issue key={i.key} tone="error">{i.message}</Issue>)}
      {v.warnings.map(i => <Issue key={i.key} tone="warning">{i.message}</Issue>)}
      {v.preexisting.length > 0 && (
        <details className="text-ink-3">
          <summary className="cursor-pointer min-h-10 flex items-center">{v.preexisting.length} problema(s) que ya venían en los archivos originales (no bloquean)</summary>
          <ul className="mt-1 max-h-48 overflow-y-auto space-y-1 text-xs">{v.preexisting.map(i => <li key={i.key}>{i.message}</li>)}</ul>
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
  // Discarding cannot be undone. One draft out of a batch (a squad replacement) leaves the rest half applied, and
  // a saved change is discarded for everyone, so those ask first.
  const confirmDiscardAll = () => window.confirm(`¿Descartar los ${drafts.length} cambios sin guardar? No se puede deshacer.`);
  const confirmDiscardDraft = op => !op.batch
    || window.confirm('Este cambio es parte de un reemplazo de plantel: descartar solo este deja el resto a medias. ¿Descartarlo igual?');
  const confirmDiscardSaved = op => window.confirm(`¿Descartar «${describe(op)}» del historial compartido? Deja de aplicarse para todo el equipo.`);

  const doExport = run(async () => {
    const { zip, manifest } = await pes.exportZip();
    downloadBytes(zip, `pes2021-export-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`);
    setLastExport(manifest);
  });

  const iconBtn = 'btn btn-ghost btn-icon btn-sm';

  return (
    <div className="grid gap-4 lg:gap-6 xl:grid-cols-2">
      <ErrorText error={error} />
      <Card title="Sin guardar" description="Viven en este navegador (sobreviven a recargar). «Guardar» los agrega al historial compartido."
        actions={<>
          <Button variant="danger" disabled={!drafts.length} onClick={run(() => confirmDiscardAll() && pes.discardDrafts())}><Undo2 className="w-4 h-4" aria-hidden="true" />Descartar todo</Button>
          <Button variant="primary" disabled={!drafts.length || Boolean(pes.busy)} onClick={run(pes.saveDrafts)}><Save className="w-4 h-4" aria-hidden="true" />Guardar {drafts.length > 0 && <span className="num">({drafts.length})</span>}</Button>
        </>}
        className="xl:order-first">
        {drafts.length === 0 ? <p className="text-sm text-ink-3">No hay cambios pendientes.</p> : (
          <ul>{drafts.map((op, i) => (
            <OpRow key={op.clientId || i} op={op} actions={(
              <button type="button" className={iconBtn} onClick={run(() => confirmDiscardDraft(op) && pes.discardDrafts([i]))} aria-label={`Descartar ${describe(op)}`} title="Descartar este cambio">
                <Undo2 className="w-4 h-4" aria-hidden="true" />
              </button>
            )} />
          ))}</ul>
        )}
      </Card>

      <Card title="Exportar ZIP" description="Trae solo los archivos generados (BIN modificados, EDIT, config.txt y texturas) más manifest.json. No se prueba dentro del juego."
        actions={caps.has('export') && (
          <Button variant="primary" disabled={!validation?.passed || drafts.length > 0 || Boolean(pes.busy)} onClick={doExport}><Download className="w-4 h-4" aria-hidden="true" />Exportar</Button>
        )}>
        {!caps.has('export') ? <p className="text-sm text-ink-3">Solo el Super Admin exporta.</p> : (
          <ul className="space-y-1.5 text-sm">
            <Issue as="li" tone={drafts.length ? 'error' : 'ok'}>{drafts.length ? 'Guardá o descartá los cambios pendientes.' : 'No hay cambios pendientes.'}</Issue>
            <Issue as="li" tone={validation?.passed ? 'ok' : 'error'}>{validation?.passed ? 'Validación aprobada.' : 'Validá la copia de trabajo (sin errores nuevos).'}</Issue>
          </ul>
        )}
        {lastExport && (
          <div className="mt-4 text-sm">
            <Pill tone="green">Exportado y verificado: {lastExport.files.length} archivo(s)</Pill>
            <ul className="mt-2 space-y-1 text-xs text-ink-3">{lastExport.verification.map(v => <li key={v.path}><code className="text-ink-2">{v.path}</code> — {v.check}</li>)}</ul>
          </div>
        )}
        {exportsList.length > 0 && (
          <details className="mt-4 text-xs text-ink-3">
            <summary className="cursor-pointer min-h-10 flex items-center">Exportaciones anteriores ({exportsList.length})</summary>
            <ul className="space-y-1">{exportsList.map(e => <li key={e.id}>{e.exportedAt?.toDate?.().toLocaleString() || '—'} · {(e.files || []).map(f => f.path).join(', ')}</li>)}</ul>
          </details>
        )}
      </Card>

      <Card title="Validación" actions={<Button onClick={run(pes.runValidation)}><ShieldCheck className="w-4 h-4" aria-hidden="true" />Validar</Button>}>
        <ValidationView v={validation} />
        {failures.length > 0 && (
          <div className="mt-4 text-sm">
            <p className="font-semibold text-danger-soft">{failures.length} cambio(s) del historial no se pudieron aplicar sobre las fuentes actuales:</p>
            <ul className="mt-1 space-y-1">{failures.slice(0, 20).map((f, i) => <Issue as="li" key={i} tone="error">{describe(f.op)}: {f.error.message}</Issue>)}</ul>
          </div>
        )}
      </Card>

      <Card title="Historial guardado" description={`${savedOps.length} cambio(s) compartidos con el equipo.`}>
        {savedOps.length === 0 ? <p className="text-sm text-ink-3">Sin cambios guardados.</p> : (
          <ul className="max-h-[50vh] overflow-y-auto overscroll-contain">{[...savedOps].reverse().map(op => (
            <OpRow key={op.id} op={op} actions={op.state !== 'discarded' && canDiscard(op) && (
              <button type="button" className={iconBtn} onClick={run(() => confirmDiscardSaved(op) && pes.discardSaved(op.id))} aria-label={`Descartar ${describe(op)}`} title="Descartar este cambio">
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            )} />
          ))}</ul>
        )}
      </Card>
    </div>
  );
}
