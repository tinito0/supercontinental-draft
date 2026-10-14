import React, { useMemo, useState } from 'react';
import { Database, Users, Shield, Shirt, ListChecks, KeyRound, LayoutGrid, Loader2, Lock, ArrowRightLeft } from 'lucide-react';
import { usePesWorkspace } from '../hooks/usePesWorkspace.js';
import { Card, Pill, ErrorText } from '../components/pes/PesUi.jsx';
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

function StatusBar({ pes, modified }) {
  const { wsDoc, ws, drafts, savedOps, validation, missing, caps } = pes;
  if (!wsDoc) return null;
  const files = [];
  if (ws?.bin) files.push(...Object.values(ws.bin.tables).map(t => t.file), ...Object.keys(ws.bin.passthrough));
  if (ws?.edit) files.push('EDIT00000000');
  if (ws?.kits) files.push(`kit-server (${ws.kits.configs.size} kits)`);
  const activeSaved = savedOps.filter(o => o.state !== 'discarded').length;
  const exportReady = caps.has('export') && validation?.passed && drafts.length === 0;
  const openWarnings = (validation?.warnings.length || 0) + (validation?.preexisting.length || 0);
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300 rounded-xl bg-[#0c1017] border border-white/[0.06] px-3 py-2" role="status">
      <span className="font-black text-white">{wsDoc.name}</span>
      <span className="text-slate-500" title={files.join(', ')}>{files.length} archivo(s) cargados</span>
      {missing.length > 0 && <Pill tone="amber">{missing.length} fuente(s) sin cargar</Pill>}
      <Pill tone={modified.size ? 'cyan' : 'slate'}>{modified.size} campo(s) modificados</Pill>
      <Pill tone={drafts.length ? 'amber' : 'green'}>{drafts.length ? `${drafts.length} sin guardar` : 'todo guardado'}</Pill>
      <Pill>{activeSaved} en el historial</Pill>
      <Pill tone={!validation ? 'slate' : validation.passed ? 'green' : 'red'}>{!validation ? 'sin validar' : validation.passed ? 'validación OK' : `${validation.errors.length} error(es)`}</Pill>
      {openWarnings > 0 && <Pill tone="amber">{openWarnings} advertencia(s)</Pill>}
      <Pill tone={exportReady ? 'green' : 'slate'}>{exportReady ? 'exportable' : 'exportación no disponible'}</Pill>
    </div>
  );
}

function Overview({ pes }) {
  const { ws, wsDoc } = pes;
  if (!wsDoc) return <Card><p className="text-xs text-slate-400">Elegí o creá un espacio de trabajo en «Fuentes».</p></Card>;
  if (!ws) return <Card><p className="text-xs text-slate-400">Cargá las fuentes del espacio de trabajo en este navegador.</p></Card>;
  const rows = [];
  if (ws.bin) {
    for (const t of Object.values(ws.bin.tables)) rows.push([t.file, `${t.count} registros de ${t.recordSize} bytes`, t.isModified() ? 'modificado' : 'sin cambios']);
    for (const f of Object.keys(ws.bin.passthrough)) rows.push([f, 'reconocido, no editable (formato sin verificar)', 'se conserva']);
  }
  if (ws.edit) { const i = ws.edit.info(); rows.push(['EDIT00000000', `PES ${i.game} · ${i.players} jugador(es) editados · ${i.teams} equipos`, ws.edit.isModified() ? 'modificado' : 'sin cambios']); }
  if (ws.kits) rows.push(['kit-server', `${ws.kits.map.size} equipos · ${ws.kits.configs.size} config.txt`, ws.kits.modified.size || ws.kits.assets.size ? `${ws.kits.modified.size} config · ${ws.kits.assets.size} texturas` : 'sin cambios']);
  return (
    <Card title="Archivos del espacio de trabajo">
      <table className="w-full text-xs text-slate-300">
        <tbody>{rows.map(([a, b, c]) => <tr key={a} className="border-t border-white/[0.04]"><td className="py-1.5 font-bold">{a}</td><td className="text-slate-400">{b}</td><td><Pill tone={c === 'modificado' || /config/.test(c) ? 'cyan' : 'slate'}>{c}</Pill></td></tr>)}</tbody>
      </table>
      <p className="mt-3 text-[11px] text-slate-500">Formato soportado: eFootball PES 2021 SEASON UPDATE (PC). Base pesdb descomprimida en contenedor WESYS (Team.bin, Player.bin, PlayerAssignment.bin y Coach.bin editables), EDIT00000000 de PES 2021 y config.txt del kit-server de Sider. Ver docs/PES_ENGINE.md.</p>
    </Card>
  );
}

/** PES 2021 database & kit workspace. Only users with a PES role reach this screen. */
export default function PesWorkspaceScreen({ userId, isAdmin, allTeams }) {
  const pes = usePesWorkspace({ userId, isAdmin });
  const [tab, setTab] = useState('sources');
  const [applyError, setApplyError] = useState(null);
  const modified = useMemo(() => modifiedKeys(pes.savedOps, pes.drafts), [pes.savedOps, pes.drafts]);
  const view = { ...pes, modified };

  if (pes.role === undefined) return <div className="p-8 flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" />Cargando permisos…</div>;
  if (!pes.role) {
    return (
      <div className="p-8"><Card><p className="flex items-center gap-2 text-sm text-slate-300"><Lock className="w-4 h-4" />No tenés acceso al editor PES.</p></Card></div>
    );
  }

  const onApply = async ops => {
    setApplyError(null);
    try { await pes.apply(ops); } catch (e) { setApplyError(e); throw e; }
  };
  const safeApply = ops => onApply(ops).catch(() => {});
  const tabs = TABS.filter(t => t.show(pes.caps));

  return (
    <div className="p-4 md:p-6 space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-black text-white tracking-tight">Editor PES 2021</h1>
          <p className="text-xs text-slate-400">Base de datos, plantillas y kits · {ROLE_LABELS[pes.role.role]}{pes.role.label && pes.role.label !== ROLE_LABELS[pes.role.role] ? ` (${pes.role.label})` : ''}</p>
        </div>
        {pes.busy && <span className="flex items-center gap-2 text-xs text-cyan-300"><Loader2 className="w-3.5 h-3.5 animate-spin" />{pes.busy}</span>}
        {pes.loading && <span className="flex items-center gap-2 text-xs text-slate-400"><Loader2 className="w-3.5 h-3.5 animate-spin" />{pes.loadingMessage || 'Cargando copia de trabajo…'}</span>}
      </header>
      <StatusBar pes={pes} modified={modified} />
      <nav className="flex flex-wrap gap-1" aria-label="Secciones del editor PES">
        {tabs.map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition ${tab === t.id ? 'bg-cyan-500 text-slate-950' : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'}`}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </nav>
      <ErrorText error={pes.error} />
      <ErrorText error={applyError} />
      {tab === 'sources' && <PesSourcesPanel pes={view} />}
      {tab === 'overview' && <Overview pes={view} />}
      {tab === 'draft' && pes.ws && <PesDraftPanel pes={view} />}
      {tab === 'teams' && pes.ws && <PesTeamsPanel pes={view} onApply={safeApply} />}
      {tab === 'players' && pes.ws && <PesPlayersPanel pes={view} onApply={safeApply} />}
      {tab === 'kits' && pes.ws && <PesKitsPanel pes={view} onApply={onApply} />}
      {tab === 'changes' && pes.wsDoc && <PesChangesPanel pes={view} />}
      {tab === 'roles' && <PesRolesPanel actorUid={userId} allTeams={allTeams} />}
      {['draft', 'teams', 'players', 'kits'].includes(tab) && !pes.ws && <Card><p className="text-xs text-slate-400">Primero elegí un espacio de trabajo y cargá sus fuentes.</p></Card>}
    </div>
  );
}
