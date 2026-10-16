import React, { useEffect, useState } from 'react';
import { FolderOpen, FileUp, Database, Plus, RefreshCw, CloudUpload, Trash2 } from 'lucide-react';
import { Card, Button, Pill, ErrorText } from './PesUi.jsx';

const KIND_LABEL = { pesdb: 'Base pesdb (BIN)', edit: 'EDIT00000000', kits: 'Kit-server (Sider)' };

/** "101, 102 377" → [101, 102, 377]; throws on anything that is not a team id (before: "abc" saved NaN). */
function parseLeagueIds(text) {
  const parts = text.split(/[\s,;]+/).filter(Boolean);
  const invalid = parts.filter(part => !/^\d+$/.test(part));
  if (invalid.length) throw new Error(`No son IDs de equipo: ${invalid.join(', ')}.`);
  return [...new Set(parts.map(Number))];
}

function SourceSummary({ s, missing }) {
  const detail = s.kind === 'pesdb' ? `${Object.keys(s.files || {}).length} archivos` : s.kind === 'kits' ? `${s.configs} kits · ${s.teams} equipos` : `${(s.size / 1048576).toFixed(1)} MB`;
  return (
    <li className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
      <Pill tone={missing ? 'amber' : 'green'}>{missing ? 'no disponible' : 'cargado'}</Pill>
      <Pill tone={s.stored ? 'cyan' : 'amber'}>{s.stored ? 'compartido' : 'sin compartir'}</Pill>
      <span className="font-bold">{KIND_LABEL[s.kind]}</span>
      <span className="text-ink-3">{detail}</span>
      <code className="text-[10px] text-ink-3" title={s.sha256}>{s.sha256.slice(0, 12)}…</code>
    </li>
  );
}

/** Irreversible for everyone: asks to type the workspace name before deleting. */
function DeleteWorkspace({ workspace, busy, onDelete }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  if (!open) {
    return (
      <Button variant="danger" disabled={busy} onClick={() => { setTyped(''); setOpen(true); }}>
        <Trash2 className="w-3.5 h-3.5" />Eliminar espacio
      </Button>
    );
  }
  const matches = typed.trim() === workspace.name;
  return (
    <div role="alertdialog" aria-label="Confirmar eliminación del espacio" className="space-y-2 rounded-xl border border-danger/30 bg-danger/[0.07] p-3">
      <p className="text-xs text-ink-2">
        Se borra para todos: el historial de cambios, las exportaciones y los archivos compartidos en Supabase.
        No se puede deshacer. Escribí <span className="font-bold text-ink">{workspace.name}</span> para confirmar.
      </p>
      <input value={typed} onChange={e => setTyped(e.target.value)} className="input min-h-9 w-full" aria-label="Nombre del espacio a eliminar" autoFocus />
      <div className="flex flex-wrap gap-2">
        <Button variant="danger" disabled={!matches || busy} title={matches ? undefined : 'Escribí el nombre exacto del espacio'}
          onClick={async () => { await onDelete(workspace); setOpen(false); }}>
          <Trash2 className="w-3.5 h-3.5" />Eliminar definitivamente
        </Button>
        <Button disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button>
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
      <Button disabled={disabled} onClick={() => pick(true)}><FolderOpen className="w-3.5 h-3.5" />Carpeta pesdb</Button>
      <Button disabled={disabled} onClick={() => pick(false)}><FileUp className="w-3.5 h-3.5" />Archivo EDIT00000000</Button>
      <Button disabled={disabled} onClick={() => pick(true)}><FolderOpen className="w-3.5 h-3.5" />Carpeta kit-server</Button>
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
      if (wsDoc) {
        // Same content as the workspace source: just restores it on this machine.
        const matches = sources.filter(s => (wsDoc.sources || []).some(w => w.sha256 === s.sha256));
        const different = sources.filter(s => !matches.includes(s));
        setPending(different);
        setNotice(`${matches.length} fuente(s) coinciden con el espacio de trabajo y quedaron cargadas.${different.length ? ` ${different.length} son distintas: confirmá si reemplazan la fuente.` : ''}${ignored.length ? ` ${ignored.length} archivo(s) ignorados.` : ''}`);
        if (matches.length) pes.reload();
      } else {
        setPending(prev => [...prev.filter(p => !sources.some(s => s.kind === p.kind)), ...sources]);
        if (ignored.length) setNotice(`${ignored.length} archivo(s) ignorados (no son de la base, el EDIT ni el kit-server).`);
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

  const replace = async s => {
    setError(null);
    // The saved changes are re-applied over the new file; the ones that no longer fit fail (Validación lists them).
    if (!window.confirm('¿Reemplazar esta fuente por el archivo nuevo? Los cambios guardados se vuelven a aplicar sobre él y los que ya no encajen van a fallar.')) return;
    try { await pes.replaceSource(s); setPending(p => p.filter(x => x !== s)); } catch (e) { setError(e); }
  };

  const saveLeague = async () => {
    setError(null);
    try {
      const ids = parseLeagueIds(league);
      // Vacío abre todos los equipos a los Kit Managers: que sea a propósito.
      if (!ids.length && (wsDoc?.leagueTeamIds || []).length
        && !window.confirm('Sin IDs, los Kit Managers van a poder editar los kits de TODOS los equipos. ¿Guardar así?')) return;
      await pes.setLeagueTeams(ids);
      setNotice('Equipos de la liga guardados.');
    } catch (e) { setError(e); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Espacio de trabajo" actions={(
        <Button disabled={isBusy} onClick={refresh} title={isBusy ? pes.busy : 'Recargar la lista, los cambios y la copia de trabajo'}>
          <RefreshCw className={`w-3.5 h-3.5 ${pes.busy === 'Actualizando…' ? 'animate-spin' : ''}`} aria-hidden="true" />Actualizar
        </Button>
      )}>
        {wsNotice && <p role="status" className="text-xs text-accent-soft mb-3">{wsNotice}</p>}
        {wsError && <div className="mb-3"><ErrorText error={wsError} /></div>}
        {workspaces.length === 0 && <p className="text-xs text-ink-3">Todavía no hay espacios de trabajo.</p>}
        <ul className="space-y-1">
          {workspaces.map(w => (
            <li key={w.id}>
              <button type="button" onClick={() => pes.selectWorkspace(w.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition ${w.id === activeId ? 'border-accent/50 bg-accent/10 text-ink' : 'border-line/[0.08] text-ink-2 hover:bg-white/[0.04]'}`}>
                <Database className="inline w-3.5 h-3.5 mr-1.5" />{w.name}
                <span className="ml-2 text-ink-3">{(w.sources || []).map(s => KIND_LABEL[s.kind]).join(' · ')}</span>
              </button>
            </li>
          ))}
        </ul>
        {wsDoc && (
          <div className="mt-4 space-y-2">
            <h4 className="text-[11px] font-bold uppercase text-ink-3">Fuentes de «{wsDoc.name}»</h4>
            <ul className="space-y-1">{(wsDoc.sources || []).map(s => <SourceSummary key={s.sha256} s={s} missing={missing.some(m => m.sha256 === s.sha256)} />)}</ul>
            {missing.some(m => m.stored) && <p className="text-xs text-warning-soft">No se pudo descargar la base compartida. Revisá tu conexión y que tu usuario tenga rol (npm run pes:claims) y volvé a entrar.</p>}
            {missing.some(m => !m.stored) && <p className="text-xs text-warning-soft">Hay fuentes que el Super Admin todavía no compartió.{canManage ? ' Si las tenés en este navegador, tocá «Compartir fuentes».' : ''}</p>}
            {canManage && (wsDoc.sources || []).some(x => !x.stored) && (
              <Button variant="primary" disabled={isBusy} onClick={async () => { setError(null); try { await pes.shareSources(); } catch (e) { setError(e); } }}>
                <CloudUpload className="w-3.5 h-3.5" />Compartir fuentes
              </Button>
            )}
            {canManage && (
              <div className="pt-3 mt-3 border-t border-line/10">
                <DeleteWorkspace workspace={wsDoc} busy={isBusy} onDelete={remove} />
              </div>
            )}
          </div>
        )}
      </Card>

      <Card title={wsDoc ? 'Cargar archivos' : 'Nuevo espacio de trabajo'}>
        <p className="text-xs text-ink-3 mb-3">
          Al crear el espacio, los archivos originales se suben una sola vez a Supabase y todos trabajan sobre esa misma copia (se descarga sola y se verifica). Las ediciones se guardan como historial en la app; nunca se sobrescriben los archivos del juego.
        </p>
        <Pickers onFiles={handleFiles} disabled={Boolean(pes.busy)} />
        {notice && <p className="text-xs text-accent-soft mt-3">{notice}</p>}
        {pending.length > 0 && (
          <div className="mt-3 space-y-2">
            <ul className="space-y-1">{pending.map(s => (
              <li key={s.sha256} className="flex items-center justify-between gap-2">
                <SourceSummary s={s.summary} />
                {wsDoc && canManage && <Button variant="danger" onClick={() => replace(s)}>Reemplazar fuente</Button>}
              </li>
            ))}</ul>
            {!wsDoc && canManage && (
              <div className="flex flex-wrap items-center gap-2">
                <input value={name} onChange={e => setName(e.target.value)} className="flex-1 min-w-40 input min-h-9" aria-label="Nombre del espacio de trabajo" />
                <Button variant="primary" onClick={create}><Plus className="w-3.5 h-3.5" />Crear espacio</Button>
              </div>
            )}
            {wsDoc && <p className="text-[11px] text-warning-soft">Reemplazar una fuente cambia la base sobre la que se aplican los cambios guardados. Los cambios que no apliquen a la nueva fuente aparecerán como errores en «Cambios».</p>}
          </div>
        )}
        {!canManage && !wsDoc && <p className="text-xs text-ink-3 mt-3">Solo el Super Admin crea espacios de trabajo.</p>}
        <ErrorText error={error} />
      </Card>

      {canManage && wsDoc && (
        <Card title="Equipos de la liga (Kit Managers)">
          <p className="text-xs text-ink-3 mb-2">IDs de equipo separados por coma. Vacío = los Kit Managers pueden editar los kits de todos los equipos. Actual: {(wsDoc.leagueTeamIds || []).join(', ') || 'todos'}.</p>
          <div className="flex gap-2">
            <input value={league} onChange={e => setLeague(e.target.value)} placeholder="101, 102, 377" className="flex-1 input min-h-9" aria-label="IDs de equipos de la liga" />
            <Button variant="primary" onClick={saveLeague}>Guardar</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
