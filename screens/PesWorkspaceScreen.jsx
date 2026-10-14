import React, { useMemo, useState } from 'react';
import { Database, Users, Shield, Shirt, ListChecks, KeyRound, LayoutGrid, Lock, ArrowRightLeft, FolderOpen } from 'lucide-react';
import { usePesWorkspace } from '../hooks/usePesWorkspace.js';
import { Card, Pill, ErrorText } from '../components/pes/PesUi.jsx';
import { Page } from '../components/ui/Page.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Tabs } from '../components/ui/Tabs.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { PesSourcesPanel } from '../components/pes/PesSourcesPanel.jsx';
import { PesTeamsPanel } from '../components/pes/PesTeamsPanel.jsx';
import { PesPlayersPanel } from '../components/pes/PesPlayersPanel.jsx';
import { PesKitsPanel } from '../components/pes/PesKitsPanel.jsx';
import { PesChangesPanel } from '../components/pes/PesChangesPanel.jsx';
import { PesRolesPanel } from '../components/pes/PesRolesPanel.jsx';
import { PesDraftPanel } from '../components/pes/PesDraftPanel.jsx';
import { modifiedKeys } from '../components/pes/opKeys.js';
import { ROLE_LABELS } from '../pes/permissions.js';

const TABS = [
  { id: 'sources', label: 'Fuentes', icon: Database, show: () => true },
  { id: 'overview', label: 'Resumen', icon: LayoutGrid, show: () => true },
  { id: 'draft', label: 'Draft → PES', icon: ArrowRightLeft, show: c => c.has('team.replace') },
  { id: 'teams', label: 'Equipos', icon: Shield, show: c => c.has('team.edit') || c.has('kit.edit') || c.has('workspace.read') },
  { id: 'players', label: 'Jugadores', icon: Users, show: c => c.has('workspace.read') && !c.has('kit.edit') || c.has('player.edit') },
  { id: 'kits', label: 'Kits', icon: Shirt, show: c => c.has('kit.read') },
  { id: 'changes', label: 'Cambios y exportación', icon: ListChecks, show: () => true },
  { id: 'roles', label: 'Roles', icon: KeyRound, show: c => c.has('roles.manage') },
];

/**
 * One line with what matters before exporting: unsaved drafts, validation and export state.
 * The rest (files, history) lives in «Resumen» and «Cambios».
 */
function StatusLine({ pes, modified }) {
  const { wsDoc, ws, drafts, validation, missing, caps } = pes;
  if (!wsDoc) return null;
  const files = [];
  if (ws?.bin) files.push(...Object.values(ws.bin.tables).map(t => t.file), ...Object.keys(ws.bin.passthrough));
  if (ws?.edit) files.push('EDIT00000000');
  if (ws?.kits) files.push(`kit-server (${ws.kits.configs.size} kits)`);
  const exportReady = caps.has('export') && validation?.passed && drafts.length === 0;
  const openWarnings = (validation?.warnings.length || 0) + (validation?.preexisting.length || 0);
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-line/[0.08] py-3 text-sm">
      <span className="text-ink-2 min-w-0">
        <span className="font-semibold text-ink">{wsDoc.name}</span>
        <span className="text-ink-3" title={files.join(', ')}> · <span className="num">{files.length}</span> archivo(s)</span>
      </span>
      {missing.length > 0 && <Pill tone="amber">{missing.length} fuente(s) sin cargar en este navegador</Pill>}
      <span className="text-ink-3"><span className="num text-ink-2">{modified.size}</span> campo(s) modificados</span>
      <Pill tone={drafts.length ? 'amber' : 'green'}>{drafts.length ? `${drafts.length} cambio(s) sin guardar` : 'Todo guardado'}</Pill>
      {validation && <Pill tone={validation.passed ? 'green' : 'red'}>{validation.passed ? 'Validación correcta' : `${validation.errors.length} error(es) de validación`}</Pill>}
      {openWarnings > 0 && <Pill tone="amber">{openWarnings} advertencia(s)</Pill>}
      {exportReady && <Pill tone="accent">Listo para exportar</Pill>}
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
  const [tab, setTab] = useState('sources');
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
  const roleLabel = ROLE_LABELS[pes.role.role];
  const roleText = pes.role.label && pes.role.label !== roleLabel ? `${roleLabel} (${pes.role.label})` : roleLabel;
  const needsWorkspace = ['draft', 'teams', 'players', 'kits'].includes(tab) && !pes.ws;

  return (
    <Page>
      <PageHeader eyebrow="Gestión" title="Editor PES 2021"
        description={`Base de datos, plantillas y kits del juego. Tu rol: ${roleText}.`}
        actions={(pes.busy || pes.loading) && <Spinner size="sm" label={pes.busy || pes.loadingMessage || 'Cargando copia de trabajo…'} />} />
      <StatusLine pes={pes} modified={modified} />
      <Tabs tabs={tabs} value={tab} onChange={setTab} label="Secciones del editor PES" />
      <ErrorText error={pes.error} />
      <ErrorText error={applyError} />
      {tab === 'sources' && <PesSourcesPanel pes={view} />}
      {tab === 'overview' && <Overview pes={view} />}
      {tab === 'draft' && pes.ws && <PesDraftPanel pes={view} />}
      {tab === 'teams' && pes.ws && <PesTeamsPanel pes={view} onApply={safeApply} />}
      {tab === 'players' && pes.ws && <PesPlayersPanel pes={view} onApply={safeApply} appPlayers={appPlayers} />}
      {tab === 'kits' && pes.ws && <PesKitsPanel pes={view} onApply={onApply} />}
      {tab === 'changes' && pes.wsDoc && <PesChangesPanel pes={view} />}
      {tab === 'roles' && <PesRolesPanel actorUid={userId} allTeams={allTeams} />}
      {needsWorkspace && (
        <EmptyState icon={FolderOpen} title="Primero cargá las fuentes" description="Elegí un espacio de trabajo y cargá sus archivos en «Fuentes»."
          actionLabel="Ir a Fuentes" onAction={() => setTab('sources')} />
      )}
    </Page>
  );
}
