import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Database, Users, Shield, ListChecks, KeyRound, LayoutGrid, Lock, ArrowRightLeft, FolderOpen } from 'lucide-react';
import { usePesWorkspace } from '../hooks/usePesWorkspace.js';
import { Card, Pill, StatePill, ErrorText, plural } from '../components/pes/PesUi.jsx';
import { SoftValue } from '../components/ui/SoftValue.jsx';
import { Page } from '../components/ui/Page.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Tabs } from '../components/ui/Tabs.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { PesSourcesPanel } from '../components/pes/PesSourcesPanel.jsx';
import { PesTeamWorkspace } from '../components/pes/team/PesTeamWorkspace.jsx';
import { PesPlayersPanel } from '../components/pes/PesPlayersPanel.jsx';
import { PesChangesPanel } from '../components/pes/PesChangesPanel.jsx';
import { PesRolesPanel } from '../components/pes/PesRolesPanel.jsx';
import { PesDraftPanel } from '../components/pes/PesDraftPanel.jsx';
import { modifiedKeys } from '../components/pes/opKeys.js';
import { ROLE_LABELS } from '../pes/permissions.js';

const TABS = [
  { id: 'sources', label: 'Fuentes', icon: Database, show: () => true },
  { id: 'overview', label: 'Resumen', icon: LayoutGrid, show: () => true },
  { id: 'draft', label: 'Draft → PES', icon: ArrowRightLeft, show: c => c.has('team.replace') },
  // One workspace per team (data, squad, kits): the former «Kits» tab is its «Kits» section.
  { id: 'teams', label: 'Equipos', icon: Shield, show: c => c.has('team.edit') || c.has('kit.edit') || c.has('kit.read') || c.has('workspace.read') },
  { id: 'players', label: 'Jugadores', icon: Users, show: c => c.has('workspace.read') && !c.has('kit.edit') || c.has('player.edit') },
  { id: 'changes', label: 'Cambios y exportación', icon: ListChecks, show: () => true },
  { id: 'roles', label: 'Roles', icon: KeyRound, show: c => c.has('roles.manage') },
];

/** The one state that matters most right now, most urgent first. The other facts stay plain text. */
function primaryState({ drafts, validation, missing, caps }) {
  const n = drafts.length;
  if (validation && !validation.passed) {
    const e = validation.errors.length;
    return { tone: 'red', text: `${e} ${plural(e, 'error', 'errores')} de validación` };
  }
  if (n) return { tone: 'amber', text: `${n} ${plural(n, 'cambio sin guardar', 'cambios sin guardar')}` };
  if (missing.length) return { tone: 'amber', text: `${missing.length} ${plural(missing.length, 'fuente sin cargar', 'fuentes sin cargar')}` };
  if (caps.has('export') && validation?.passed) return { tone: 'accent', text: 'Listo para exportar' };
  return { tone: 'green', text: 'Todo guardado' };
}

/**
 * One line with what matters before exporting: a single state (it steps to the next one in place) and plain counts.
 * The rest (files, history) lives in «Resumen» and «Cambios».
 */
function StatusLine({ pes, modified }) {
  const { wsDoc, ws, validation } = pes;
  if (!wsDoc) return null;
  const files = [];
  if (ws?.bin) files.push(...Object.values(ws.bin.tables).map(t => t.file), ...Object.keys(ws.bin.passthrough));
  if (ws?.edit) files.push('EDIT00000000');
  if (ws?.kits) files.push(`kit-server (${ws.kits.configs.size} kits)`);
  const openWarnings = (validation?.warnings.length || 0) + (validation?.preexisting.length || 0);
  const state = primaryState(pes);
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-line/[0.08] py-3 text-sm">
      <span className="text-ink-2 min-w-0">
        <span className="font-semibold text-ink">{wsDoc.name}</span>
        <span className="text-ink-3" title={files.join(', ')}> · <span className="num">{files.length}</span> {plural(files.length, 'archivo', 'archivos')}</span>
      </span>
      <span className="text-ink-3">
        <SoftValue value={modified.size} className="num text-ink-2" /> {plural(modified.size, 'campo modificado', 'campos modificados')}
      </span>
      {openWarnings > 0 && (
        <span className="text-ink-3"><span className="num text-ink-2">{openWarnings}</span> {plural(openWarnings, 'advertencia', 'advertencias')}</span>
      )}
      <span role="status" className="sm:ml-auto"><StatePill tone={state.tone}>{state.text}</StatePill></span>
    </div>
  );
}

function Overview({ pes }) {
  const { ws, wsDoc } = pes;
  if (!wsDoc) return <EmptyState icon={FolderOpen} title="Sin espacio de trabajo" description="Elegí o creá un espacio de trabajo en «Fuentes»." />;
  if (!ws) return <EmptyState icon={FolderOpen} title="Fuentes sin cargar" description="Cargá las fuentes del espacio de trabajo en este navegador desde «Fuentes»." />;
  const rows = [];
  if (ws.bin) {
    for (const t of Object.values(ws.bin.tables)) rows.push([t.file, `${t.count.toLocaleString('es-AR')} registros de ${t.recordSize} bytes`, t.isModified() ? 'modificado' : 'sin cambios']);
    for (const f of Object.keys(ws.bin.passthrough)) rows.push([f, 'Reconocido, no editable (formato sin verificar)', 'se conserva']);
  }
  if (ws.edit) { const i = ws.edit.info(); rows.push(['EDIT00000000', `PES ${i.game} · ${i.players} jugador(es) editados · ${i.teams} equipos`, ws.edit.isModified() ? 'modificado' : 'sin cambios']); }
  if (ws.kits) rows.push(['kit-server', `${ws.kits.map.size} equipos · ${ws.kits.configs.size} config.txt`, ws.kits.modified.size || ws.kits.assets.size ? `${ws.kits.modified.size} config · ${ws.kits.assets.size} texturas` : 'sin cambios']);
  return (
    <Card title="Archivos del espacio de trabajo" flush
      description="eFootball PES 2021 SEASON UPDATE (PC): base pesdb en contenedor WESYS, EDIT00000000 y config.txt del kit-server de Sider. Detalle técnico en docs/PES_ENGINE.md.">
      <div className="overflow-x-auto">
        <table className="data-table min-w-[36rem]">
          <thead><tr><th scope="col">Archivo</th><th scope="col">Contenido</th><th scope="col">Estado</th></tr></thead>
          <tbody>
            {rows.map(([file, info, state]) => {
              const changed = state === 'modificado' || /config/.test(state);
              return (
                <tr key={file}>
                  <td className="font-semibold text-ink whitespace-nowrap">{file}</td>
                  <td className="text-ink-3">{info}</td>
                  <td>{changed ? <Pill tone="accent">{state}</Pill> : <span className="text-ink-3">{state}</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** PES 2021 database & kit workspace. Only users with a PES role reach this screen. */
export default function PesWorkspaceScreen({ userId, isAdmin, allTeams, appPlayers = [] }) {
  const pes = usePesWorkspace({ userId, isAdmin });
  // Tab, team and section live in the URL, so a reload or a shared link reopens the same team.
  // ?tab=kits (links from before the merge) opens the team workspace on its «Kits» section.
  const [params, setParams] = useSearchParams();
  const legacyKits = params.get('tab') === 'kits';
  const requestedTab = legacyKits ? 'teams' : params.get('tab') || 'sources';
  const teamParam = Number(params.get('team'));
  const teamId = params.get('team') && Number.isInteger(teamParam) ? teamParam : null;
  const section = legacyKits ? 'kits' : params.get('section') || 'identity';
  const setParam = (changes, push = false) => setParams(prev => {
    const next = new URLSearchParams(prev);
    for (const [k, v] of Object.entries(changes)) if (v == null) next.delete(k); else next.set(k, String(v));
    return next;
  }, { replace: !push });
  const setTab = id => setParam({ tab: id });
  const [applyError, setApplyError] = useState(null);
  const modified = useMemo(() => modifiedKeys(pes.savedOps, pes.drafts), [pes.savedOps, pes.drafts]);
  const view = { ...pes, modified };

  if (pes.role === undefined) return <Page><Spinner center label="Cargando permisos…" /></Page>;
  if (!pes.role) {
    return <Page><EmptyState icon={Lock} title="Sin acceso al editor PES" description="Un administrador tiene que asignarte un rol del editor (Roles)." /></Page>;
  }

  const onApply = async ops => {
    setApplyError(null);
    try { await pes.apply(ops); } catch (e) { setApplyError(e); throw e; }
  };
  const safeApply = ops => onApply(ops).catch(() => {});
  const tabs = TABS.filter(t => t.show(pes.caps));
  // A link can name a tab this role does not have: fall back to «Fuentes» instead of rendering it.
  const tab = tabs.some(t => t.id === requestedTab) ? requestedTab : 'sources';
  const roleLabel = ROLE_LABELS[pes.role.role];
  const roleText = pes.role.label && pes.role.label !== roleLabel ? `${roleLabel} (${pes.role.label})` : roleLabel;
  const needsWorkspace = ['draft', 'teams', 'players'].includes(tab) && !pes.ws;

  return (
    <Page className="pes-editor">
      <PageHeader eyebrow="Gestión" title="Editor PES 2021"
        description={`Base de datos, plantillas y kits del juego. Tu rol: ${roleText}.`}
        actions={(pes.busy || pes.loading) && <Spinner size="sm" label={pes.busy || pes.loadingMessage || 'Cargando copia de trabajo…'} />} />
      <StatusLine pes={pes} modified={modified} />
      <Tabs tabs={tabs} value={tab} onChange={setTab} label="Secciones del editor PES" />
      <ErrorText error={pes.error} />
      <ErrorText error={applyError} />
      {/* Keyed by tab: the new view fades in, so a tab change reads as "this content was replaced". */}
      <div key={tab} className="animate-in fade-in">
        {tab === 'sources' && <PesSourcesPanel pes={view} />}
        {tab === 'overview' && <Overview pes={view} />}
        {tab === 'draft' && pes.ws && <PesDraftPanel pes={view} />}
        {tab === 'teams' && pes.ws && (
          <PesTeamWorkspace pes={view} allTeams={allTeams} teamId={teamId} section={section}
            onTeamChange={id => setParam({ team: id, section: null, tab: 'teams' }, true)}
            onSectionChange={id => setParam({ section: id, tab: 'teams' })} />
        )}
        {tab === 'players' && pes.ws && <PesPlayersPanel pes={view} onApply={safeApply} appPlayers={appPlayers} />}
        {tab === 'changes' && pes.wsDoc && <PesChangesPanel pes={view} />}
        {tab === 'roles' && <PesRolesPanel actorUid={userId} allTeams={allTeams} />}
        {needsWorkspace && (
          <EmptyState icon={FolderOpen} title="Primero cargá las fuentes" description="Elegí un espacio de trabajo y cargá sus archivos en «Fuentes»."
            actionLabel="Ir a Fuentes" onAction={() => setTab('sources')} />
        )}
      </div>
    </Page>
  );
}
