import React, { useEffect, useState } from 'react';
import { FolderOpen, FileUp, Database, Plus, RefreshCw, CloudUpload, Trash2, Replace } from 'lucide-react';
import { Card, Button, Pill, ErrorText, ConfirmAction, plural } from './PesUi.jsx';
import { Field } from '../ui/Field.jsx';
import { Alert } from '../ui/Alert.jsx';

const KIND_LABEL = { pesdb: 'Base pesdb (BIN)', edit: 'EDIT00000000', kits: 'Kit-server (Sider)' };

/** "101, 102 377" → [101, 102, 377]; throws on anything that is not a team id (before: "abc" saved NaN). */
function parseLeagueIds(text) {
  const parts = text.split(/[\s,;]+/).filter(Boolean);
  const invalid = parts.filter(part => !/^\d+$/.test(part));
  if (invalid.length) throw new Error(`No son IDs de equipo: ${invalid.join(', ')}.`);
  return [...new Set(parts.map(Number))];
}

/** One source: kind, size, hash and at most one state (missing here, or not shared yet). */
function SourceSummary({ s, missing }) {
  const detail = s.kind === 'pesdb' ? `${Object.keys(s.files || {}).length} archivos` : s.kind === 'kits' ? `${s.configs} kits · ${s.teams} equipos` : `${(s.size / 1048576).toFixed(1)} MB`;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0 text-sm text-ink-2">
      <span className="font-semibold text-ink">{KIND_LABEL[s.kind]}</span>
      <span className="text-ink-3">{detail}</span>
      <code className="num text-[11px] text-ink-3" title={s.sha256}>{s.sha256.slice(0, 12)}…</code>
      {missing ? <Pill tone="amber">no está en este navegador</Pill> : !s.stored && <Pill tone="amber">sin compartir</Pill>}
    </div>
  );
}

/** Irreversible for everyone: asks to type the workspace name before deleting. */
function DeleteWorkspace({ workspace, busy, onDelete }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  if (!open) {
    return (
      <Button variant="danger" disabled={busy} onClick={() => { setTyped(''); setOpen(true); }}>
        <Trash2 className="w-4 h-4" aria-hidden="true" />Eliminar espacio
      </Button>
    );
  }
  const matches = typed.trim() === workspace.name;
  return (
    <div role="group" aria-label="Confirmar eliminación del espacio"
      onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}
      className="animate-in fade-in space-y-3 rounded-xl border border-danger/30 bg-danger/[0.07] p-3">
      <p className="text-sm text-ink-2">
        Se borra para todos: el historial de cambios, las exportaciones y los archivos compartidos en Supabase.
        No se puede deshacer. Escribí <span className="font-semibold text-ink">{workspace.name}</span> para confirmar.
      </p>
      <input value={typed} onChange={e => setTyped(e.target.value)} className="input" aria-label="Nombre del espacio a eliminar" autoFocus />
      <div className="flex flex-wrap gap-2">
        <Button variant="quiet" disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button>
        <Button variant="danger" disabled={!matches || busy} title={matches ? undefined : 'Escribí el nombre exacto del espacio'}
          onClick={async () => { await onDelete(workspace); setOpen(false); }}>
          <Trash2 className="w-4 h-4" aria-hidden="true" />Eliminar definitivamente
        </Button>
      </div>
    </div>
  );
}

/** File pickers: pesdb folder, EDIT file, kit-server folder. */
function Pickers({ onFiles, disabled }) {
  const pick = (dir, accept) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    if (dir) input.webkitdirectory = true;
    if (accept) input.accept = accept;
    input.onchange = () => input.files?.length && onFiles(input.files);
    input.click();
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Button disabled={disabled} onClick={() => pick(true)}><FolderOpen className="w-4 h-4" aria-hidden="true" />Carpeta pesdb</Button>
      <Button disabled={disabled} onClick={() => pick(false)}><FileUp className="w-4 h-4" aria-hidden="true" />Archivo EDIT00000000</Button>
      <Button disabled={disabled} onClick={() => pick(true)}><FolderOpen className="w-4 h-4" aria-hidden="true" />Carpeta kit-server</Button>
    </div>
  );
}

export function PesSourcesPanel({ pes }) {
  const { caps, workspaces, activeId, wsDoc, missing } = pes;
  const [pending, setPending] = useState([]);
  const [name, setName] = useState('Liga Supercontinental');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [league, setLeague] = useState('');
  // The field starts with the saved league (it started empty, and "Guardar" then opened every team).
  const savedLeague = (wsDoc?.leagueTeamIds || []).join(', ');
  useEffect(() => { setLeague(savedLeague); }, [wsDoc?.id, savedLeague]);
  const [leagueError, setLeagueError] = useState(null);
  const [leagueNotice, setLeagueNotice] = useState(null);
  const [wsError, setWsError] = useState(null);
  const [wsNotice, setWsNotice] = useState(null);
  const canManage = caps.has('workspace.manage');
  const isBusy = Boolean(pes.busy);

  const refresh = async () => {
    setWsError(null);
    setWsNotice(null);
    try {
      await pes.refreshAll();
      setWsNotice('Actualizado: lista de espacios, cambios y copia de trabajo recargados.');
    } catch (e) { setWsError(e); }
  };

  const remove = async workspace => {
    setWsError(null);
    setWsNotice(null);
    try {
      const { warnings } = await pes.removeWorkspace(workspace.id);
      setWsNotice([`Se eliminó «${workspace.name}».`, ...warnings].join(' '));
    } catch (e) { setWsError(e); }
  };

  const handleFiles = async files => {
    setError(null);
    setNotice(null);
    try {
      const { sources, ignored } = await pes.importFiles(files);
      if (!sources.length) throw new Error('Ninguno de los archivos elegidos es una base PES 2021, un EDIT o un kit-server.');
      const ignoredText = ignored.length ? ` ${ignored.length} ${plural(ignored.length, 'archivo ignorado', 'archivos ignorados')} (no son de la base, el EDIT ni el kit-server).` : '';
      if (wsDoc) {
        // Same content as the workspace source: just restores it on this machine.
        const matches = sources.filter(s => (wsDoc.sources || []).some(w => w.sha256 === s.sha256));
        const different = sources.filter(s => !matches.includes(s));
        setPending(different);
        const matched = matches.length
          ? `${matches.length} ${plural(matches.length, 'fuente coincide', 'fuentes coinciden')} con el espacio de trabajo y ${plural(matches.length, 'quedó cargada', 'quedaron cargadas')}.`
          : '';
        const differs = different.length ? ` ${different.length} ${plural(different.length, 'es distinta', 'son distintas')}: confirmá si reemplaza${different.length === 1 ? '' : 'n'} la fuente.` : '';
        setNotice(`${matched}${differs}${ignoredText}`.trim());
        if (matches.length) pes.reload();
      } else {
        setPending(prev => [...prev.filter(p => !sources.some(s => s.kind === p.kind)), ...sources]);
        if (ignored.length) setNotice(ignoredText.trim());
      }
    } catch (e) { setError(e); }
  };

  const create = async () => {
    setError(null);
    try {
      const ids = parseLeagueIds(league);
      await pes.createFromSources(name.trim() || 'Espacio PES', pending, ids);
      setPending([]);
    } catch (e) { setError(e); }
  };

  // The saved changes are re-applied over the new file; the ones that no longer fit fail (Validación lists them).
  const replace = async s => {
    setError(null);
    try { await pes.replaceSource(s); setPending(p => p.filter(x => x !== s)); } catch (e) { setError(e); }
  };

  const saveLeague = async () => {
    setLeagueError(null);
    setLeagueNotice(null);
    try {
      await pes.setLeagueTeams(parseLeagueIds(league));
      setLeagueNotice('Equipos de la liga guardados.');
    } catch (e) { setLeagueError(e); }
  };
  // Empty opens every team to the Kit Managers: that has to be on purpose.
  const clearsLeague = !league.trim() && (wsDoc?.leagueTeamIds || []).length > 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2 items-start">
      <Card title="Espacio de trabajo" actions={(
        <Button disabled={isBusy} onClick={refresh} title={isBusy ? pes.busy : 'Recargar la lista, los cambios y la copia de trabajo'}>
          <RefreshCw className={`w-4 h-4 ${pes.busy === 'Actualizando…' ? 'animate-spin' : ''}`} aria-hidden="true" />Actualizar
        </Button>
      )}>
        {wsNotice && <Alert tone="success" className="mb-3">{wsNotice}</Alert>}
        <ErrorText error={wsError} className="mb-3" />
        {workspaces.length === 0 && <p className="text-sm text-ink-3">Todavía no hay espacios de trabajo.{canManage ? ' Creá el primero con los archivos del juego, a la derecha.' : ''}</p>}
        <ul className="space-y-1">
          {workspaces.map(w => {
            const active = w.id === activeId;
            return (
              <li key={w.id}>
                <button type="button" onClick={() => pes.selectWorkspace(w.id)} aria-current={active || undefined}
                  className={`w-full flex items-center gap-3 min-h-11 px-3 py-2 rounded-lg text-left transition-colors ${active ? 'bg-accent-deep text-ink' : 'text-ink-2 hover:bg-overlay hover:text-ink'}`}>
                  <Database className={`w-4 h-4 shrink-0 ${active ? 'text-accent-soft' : 'text-ink-3'}`} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{w.name}</span>
                    <span className="block truncate text-xs text-ink-3">{(w.sources || []).map(s => KIND_LABEL[s.kind]).join(' · ') || 'Sin fuentes'}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {wsDoc && (
          <div className="mt-5 pt-4 border-t border-line/[0.08] space-y-3">
            <h3 className="eyebrow">Fuentes de «{wsDoc.name}»</h3>
            <ul className="space-y-2">
              {(wsDoc.sources || []).map(s => <li key={s.sha256}><SourceSummary s={s} missing={missing.some(m => m.sha256 === s.sha256)} /></li>)}
            </ul>
            {missing.some(m => m.stored) && (
              <Alert tone="warning">No se pudo descargar la base compartida. Revisá tu conexión y que tu usuario tenga rol (npm run pes:claims) y volvé a entrar.</Alert>
            )}
            {missing.some(m => !m.stored) && (
              <Alert tone="warning">Hay fuentes que el Super Admin todavía no compartió.{canManage ? ' Si las tenés en este navegador, tocá «Compartir fuentes».' : ''}</Alert>
            )}
            {canManage && (wsDoc.sources || []).some(x => !x.stored) && (
              <Button variant="primary" disabled={isBusy} onClick={async () => { setError(null); try { await pes.shareSources(); } catch (e) { setError(e); } }}>
                <CloudUpload className="w-4 h-4" aria-hidden="true" />Compartir fuentes
              </Button>
            )}
            {canManage && (
              <div className="pt-3 border-t border-line/[0.08]">
                <DeleteWorkspace workspace={wsDoc} busy={isBusy} onDelete={remove} />
              </div>
            )}
          </div>
        )}
      </Card>

      <Card title={wsDoc ? 'Cargar archivos' : 'Nuevo espacio de trabajo'}
        description="Al crear el espacio, los archivos originales se suben una sola vez a Supabase y todos trabajan sobre esa misma copia (se descarga sola y se verifica). Las ediciones se guardan como historial en la app; nunca se sobrescriben los archivos del juego.">
        <div className="space-y-3">
          <Pickers onFiles={handleFiles} disabled={isBusy} />
          {notice && <Alert tone="info">{notice}</Alert>}
          {pending.length > 0 && (
            <ul className="space-y-2">
              {pending.map(s => (
                <li key={s.sha256} className="flex flex-wrap items-center justify-between gap-2 border-t border-line/[0.08] pt-2 first:border-t-0 first:pt-0">
                  <SourceSummary s={s.summary} />
                  {wsDoc && canManage && (
                    <ConfirmAction label="Reemplazar fuente" icon={Replace} confirmLabel="Sí, reemplazar" disabled={isBusy}
                      question="Los cambios guardados se vuelven a aplicar sobre el archivo nuevo; los que ya no encajen van a fallar y aparecen en «Cambios»."
                      onConfirm={() => replace(s)} />
                  )}
                </li>
              ))}
            </ul>
          )}
          {pending.length > 0 && !wsDoc && canManage && (
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Nombre del espacio" className="flex-1 min-w-48">
                <input value={name} onChange={e => setName(e.target.value)} className="input" />
              </Field>
              <Button variant="primary" disabled={isBusy} onClick={create}><Plus className="w-4 h-4" aria-hidden="true" />Crear espacio</Button>
            </div>
          )}
          {!canManage && !wsDoc && <p className="text-sm text-ink-3">Solo el Super Admin crea espacios de trabajo.</p>}
          <ErrorText error={error} />
        </div>
      </Card>

      {canManage && wsDoc && (
        <Card title="Equipos de la liga" description="Los Kit Managers solo editan los kits de estos equipos. Vacío: pueden editar los de todos.">
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <Field label="IDs de equipo, separados por coma" help={`Guardado: ${savedLeague || 'todos los equipos'}.`} className="flex-1 min-w-48">
                <input value={league} onChange={e => { setLeague(e.target.value); setLeagueNotice(null); }} placeholder="101, 102, 377" className="input num" inputMode="numeric" />
              </Field>
              <ConfirmAction label="Guardar" confirmLabel="Sí, abrir todos" needsConfirm={clearsLeague} disabled={isBusy} variant="primary"
                question="Sin IDs, los Kit Managers van a poder editar los kits de todos los equipos. ¿Guardar así?"
                onConfirm={saveLeague} />
            </div>
            {leagueNotice && <Alert tone="success">{leagueNotice}</Alert>}
            <ErrorText error={leagueError} />
          </div>
        </Card>
      )}
    </div>
  );
}
