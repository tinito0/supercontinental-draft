import React, { useState } from 'react';
import { Save, Undo2, ShieldCheck, Download, Trash2 } from 'lucide-react';
import { Card, Button, Pill, ErrorText, Issue, ConfirmAction, Disclosure, downloadBytes, plural } from './PesUi.jsx';

const TYPE_LABEL = {
  'bin.team.set': 'Equipo (BIN)', 'bin.player.set': 'Jugador (BIN)', 'bin.assignment.set': 'Asignación', 'bin.assignment.add': 'Alta en plantel',
  'bin.assignment.remove': 'Baja de plantel', 'edit.team.set': 'Equipo (EDIT)', 'edit.player.set': 'Jugador (EDIT)', 'edit.roster.number': 'Dorsal (EDIT)',
  'edit.roster.player': 'Plantel (EDIT)', 'edit.team.squad': 'Plantel y táctica (EDIT)', 'edit.roster.remove': 'Baja (EDIT)',
  'bin.coach.set': 'Entrenador (BIN)', 'bin.team.tactics': 'Táctica (BIN)', 'edit.coach.set': 'Entrenador (EDIT)', 'kit.set': 'Kit', 'kit.add': 'Kit nuevo', 'kit.texture.set': 'Textura de kit',
};

const fmt = v => (v == null ? 'vacío' : typeof v === 'object' ? JSON.stringify(v) : String(v));

function describe(op) {
  const t = op.target || {};
  const where = t.playerId != null ? `jugador ${t.playerId}` : t.coachId != null ? `entrenador ${t.coachId}` : t.assignmentId != null ? `fila ${t.assignmentId}` : t.kit ? `equipo ${t.teamId} · ${t.kit}` : `equipo ${t.teamId}${t.slot != null ? ` · lugar ${t.slot}` : ''}`;
  const what = op.field || op.key || op.slot || '';
  return `${where}${what ? ` · ${what}` : ''}`;
}

/** One operation: what changed (type, target, before → after) and its row action. */
function OpRow({ op, action }) {
  const discarded = op.state === 'discarded';
  return (
    <li className="flex flex-wrap items-start gap-x-3 gap-y-2 py-2.5 border-t border-line/[0.07] first:border-t-0 text-sm">
      <div className="min-w-0 flex-1">
        <p className="eyebrow">
          {TYPE_LABEL[op.type] || op.type}{op.batch === 'team.replace' && ' · reemplazo de plantel'}{discarded && ' · descartado'}
        </p>
        <p className={`mt-0.5 truncate ${discarded ? 'line-through text-ink-3' : 'text-ink'}`}>{describe(op)}</p>
        <p className="text-xs text-ink-3 break-all">{fmt(op.before)} <span aria-hidden="true">→</span><span className="sr-only">pasa a</span> <span className="text-ink-2 font-semibold">{fmt(op.after ?? op.value)}</span></p>
      </div>
      {action}
    </li>
  );
}

function ValidationView({ v }) {
  if (!v) return <p className="text-sm text-ink-3">Todavía no se validó esta versión de la copia de trabajo. Tocá «Validar».</p>;
  return (
    <div className="space-y-2 text-sm">
      <Issue tone={v.passed ? 'ok' : 'error'}>{v.passed ? 'Validación aprobada.' : `${v.errors.length} ${plural(v.errors.length, 'error nuevo', 'errores nuevos')}: la exportación está bloqueada.`}</Issue>
      {v.errors.map(i => <Issue key={i.key} tone="error">{i.message}</Issue>)}
      {v.warnings.map(i => <Issue key={i.key} tone="warning">{i.message}</Issue>)}
      {v.preexisting.length > 0 && (
        <Disclosure className="text-ink-3" summary={`${v.preexisting.length} ${plural(v.preexisting.length, 'problema que ya venía', 'problemas que ya venían')} en los archivos originales (no bloquean)`}>
          <ul className="mt-1 max-h-48 overflow-y-auto overscroll-contain space-y-1 text-xs">{v.preexisting.map(i => <li key={i.key}>{i.message}</li>)}</ul>
        </Disclosure>
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
  const busy = Boolean(pes.busy);

  const doExport = run(async () => {
    const { zip, manifest } = await pes.exportZip();
    downloadBytes(zip, `pes2021-export-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`);
    setLastExport(manifest);
  });

  return (
    <div className="grid gap-4 lg:gap-6 xl:grid-cols-2 items-start">
      <ErrorText error={error} className="xl:col-span-2" />
      {/* Discarding cannot be undone, so every discard asks in place first. */}
      <Card title="Sin guardar" description="Viven en este navegador (sobreviven a recargar). «Guardar» los agrega al historial compartido."
        actions={<>
          {drafts.length > 0 && (
            <ConfirmAction label="Descartar todo" icon={Undo2} confirmLabel="Sí, descartar todo" disabled={busy}
              question={`¿Descartar los ${drafts.length} cambios sin guardar? No se puede deshacer.`}
              onConfirm={run(() => pes.discardDrafts())} />
          )}
          <Button variant="primary" disabled={!drafts.length || busy} onClick={run(pes.saveDrafts)}>
            <Save className="w-4 h-4" aria-hidden="true" />Guardar{drafts.length > 0 && <span className="num">({drafts.length})</span>}
          </Button>
        </>}
        className="xl:order-first">
        {drafts.length === 0 ? <p className="text-sm text-ink-3">No hay cambios pendientes. Lo que edites en equipos, jugadores o kits aparece acá.</p> : (
          <ul>{drafts.map((op, i) => (
            <OpRow key={op.clientId || i} op={op} action={(
              <ConfirmAction iconOnly icon={Undo2} label={`Descartar ${describe(op)}`} title="Descartar este cambio" confirmLabel="Sí, descartar"
                needsConfirm={Boolean(op.batch)} disabled={busy}
                question="Este cambio es parte de un reemplazo de plantel: descartar solo este deja el resto a medias."
                onConfirm={run(() => pes.discardDrafts([i]))} />
            )} />
          ))}</ul>
        )}
      </Card>

      <Card title="Exportar ZIP" description="Trae solo los archivos generados (BIN modificados, EDIT, config.txt y texturas) más manifest.json. No se prueba dentro del juego."
        actions={caps.has('export') && (
          <Button variant="primary" disabled={!validation?.passed || drafts.length > 0 || busy} onClick={doExport}><Download className="w-4 h-4" aria-hidden="true" />Exportar</Button>
        )}>
        {!caps.has('export') ? <p className="text-sm text-ink-3">Solo el Super Admin exporta.</p> : (
          <ul className="space-y-1.5 text-sm">
            <Issue as="li" tone={drafts.length ? 'error' : 'ok'}>{drafts.length ? 'Guardá o descartá los cambios pendientes.' : 'No hay cambios pendientes.'}</Issue>
            <Issue as="li" tone={validation?.passed ? 'ok' : 'error'}>{validation?.passed ? 'Validación aprobada.' : 'Validá la copia de trabajo (sin errores nuevos).'}</Issue>
          </ul>
        )}
        {lastExport && (
          <div className="animate-in fade-in mt-4 text-sm">
            <Pill tone="green">Exportado y verificado: {lastExport.files.length} {plural(lastExport.files.length, 'archivo', 'archivos')}</Pill>
            <ul className="mt-2 space-y-1 text-xs text-ink-3">{lastExport.verification.map(v => <li key={v.path}><code className="text-ink-2">{v.path}</code>: {v.check}</li>)}</ul>
          </div>
        )}
        {exportsList.length > 0 && (
          <Disclosure className="mt-4 text-xs text-ink-3" summary={`Exportaciones anteriores (${exportsList.length})`}>
            <ul className="space-y-1">{exportsList.map(e => <li key={e.id}>{e.exportedAt?.toDate?.().toLocaleString('es-AR') || 'Sin fecha'} · {(e.files || []).map(f => f.path).join(', ')}</li>)}</ul>
          </Disclosure>
        )}
      </Card>

      <Card title="Validación" actions={<Button disabled={busy} onClick={run(pes.runValidation)}><ShieldCheck className="w-4 h-4" aria-hidden="true" />Validar</Button>}>
        <ValidationView v={validation} />
        {failures.length > 0 && (
          <div className="mt-4 text-sm">
            <p className="font-semibold text-danger-soft">{failures.length} {plural(failures.length, 'cambio del historial no se pudo aplicar', 'cambios del historial no se pudieron aplicar')} sobre las fuentes actuales:</p>
            <ul className="mt-1 space-y-1">{failures.slice(0, 20).map((f, i) => <Issue as="li" key={i} tone="error">{describe(f.op)}: {f.error.message}</Issue>)}</ul>
          </div>
        )}
      </Card>

      <Card title="Historial guardado" description={`${savedOps.length} ${plural(savedOps.length, 'cambio compartido', 'cambios compartidos')} con el equipo.`}>
        {savedOps.length === 0 ? <p className="text-sm text-ink-3">Sin cambios guardados todavía.</p> : (
          <ul className="max-h-[50vh] overflow-y-auto overscroll-contain">{[...savedOps].reverse().map(op => (
            <OpRow key={op.id} op={op} action={op.state !== 'discarded' && canDiscard(op) && (
              <ConfirmAction iconOnly icon={Trash2} label={`Descartar ${describe(op)}`} title="Descartar este cambio" confirmLabel="Sí, descartar" disabled={busy}
                question={`¿Descartar «${describe(op)}» del historial compartido? Deja de aplicarse para todo el equipo.`}
                onConfirm={run(() => pes.discardSaved(op.id))} />
            )} />
          ))}</ul>
        )}
      </Card>
    </div>
  );
}
