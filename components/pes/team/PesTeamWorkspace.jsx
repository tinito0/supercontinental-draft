import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Shield, BadgeInfo, Landmark, Users, Shirt, SlidersHorizontal } from 'lucide-react';
import { Tabs } from '../../ui/Tabs.jsx';
import { Alert } from '../../ui/Alert.jsx';
import { EmptyState } from '../../ui/EmptyState.jsx';
import { useMediaQuery } from '../../../hooks/useMediaQuery.js';
import { opKey } from '../opKeys.js';
import { useCountries } from '../useCountries.js';
import { coachNameOfTeam } from '../../../pes/draftTransfer.js';
import { draftIndexesForTeam, listTeams, teamAccess, teamColours, teamIdentity } from '../../../pes/teamView.js';
import { TeamList } from './TeamList.jsx';
import { TeamHeader } from './TeamHeader.jsx';
import { TeamSaveBar } from './TeamSaveBar.jsx';
import { ReplacementWizard } from './ReplacementWizard.jsx';
import { IdentitySection } from './sections/IdentitySection.jsx';
import { StadiumSection } from './sections/StadiumSection.jsx';
import { SquadSection } from './sections/SquadSection.jsx';
import { KitsSection } from './sections/KitsSection.jsx';
import { AdvancedSection } from './sections/AdvancedSection.jsx';

export const TEAM_SECTIONS = ['identity', 'stadium', 'squad', 'kits', 'advanced'];

function headerMeta(ws, teamId, identity, countries, draftTeamName) {
  const meta = [identity.national ? 'Selección' : 'Club'];
  const country = countries.find(c => c.id === identity.country)?.name;
  if (country) meta.push(country);
  const coach = coachNameOfTeam(ws, teamId);
  if (coach) meta.push(`DT ${coach}`);
  if (identity.stadiumName) meta.push(identity.stadiumName);
  else if (identity.stadiumId != null) meta.push(`Estadio ${identity.stadiumId}`);
  if (draftTeamName) meta.push(`Draft: ${draftTeamName}`);
  return meta;
}

function accessNote(access) {
  if (access.outOfLeague) return 'Fuera de la liga: solo lectura para tu rol.';
  if (!access.data && !access.colours) return 'Solo lectura para tu rol.';
  if (!access.data) return 'Tu rol edita los colores y los kits de este equipo.';
  return null;
}

/**
 * Team workspace of the PES editor: team list, identity header, editing sections and save bar for one
 * team. Selection and section come from the URL (owned by PesWorkspaceScreen).
 */
export function PesTeamWorkspace({ pes, teamId, onTeamChange, section, onSectionChange, allTeams = {} }) {
  const { ws, wsDoc, caps, drafts, savedOps, version, modified } = pes;
  const headingId = useId();
  const countries = useCountries();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [query, setQuery] = useState('');
  // A Kit Manager only edits league teams: start on those instead of 800 read-only rows.
  const [filter, setFilter] = useState(() => (caps.has('kit.edit') && !caps.has('team.edit') && wsDoc?.leagueTeamIds?.length ? 'league' : 'all'));
  const [sort, setSort] = useState('name');
  const [announce, setAnnounce] = useState('');
  const [mobileList, setMobileList] = useState(teamId == null);
  // Master/detail on phones: focus follows the view so keyboard and screen reader users are not left on <body>.
  const focusOnShow = useRef(null);

  const leagueIds = useMemo(() => wsDoc?.leagueTeamIds || [], [wsDoc?.leagueTeamIds]);
  const rows = useMemo(() => listTeams(ws, { leagueTeamIds: leagueIds, drafts, savedOps }), [ws, version, drafts, savedOps, leagueIds]);
  const kitManager = caps.has('kit.edit') && !caps.has('team.edit');
  const row = rows.find(r => r.id === teamId) || null;

  const select = id => {
    onTeamChange(id);
    setMobileList(false);
    if (!isDesktop) focusOnShow.current = 'team';
  };
  const back = () => {
    setMobileList(true);
    focusOnShow.current = 'list';
  };

  useEffect(() => {
    const target = focusOnShow.current;
    if (!target) return;
    focusOnShow.current = null;
    const el = target === 'team'
      ? document.getElementById(headingId)
      : document.querySelector('nav[aria-label="Equipos"] [aria-current="true"]') || document.querySelector('nav[aria-label="Equipos"] input');
    el?.focus({ preventScroll: target === 'list' });
  }, [mobileList, teamId, headingId]);

  const list = (
    <TeamList rows={rows} loading={pes.loading && !ws} selectedId={teamId} onSelect={select}
      hasLeague={leagueIds.length > 0} kitManager={kitManager}
      query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} sort={sort} onSort={setSort} />
  );
  const showList = isDesktop || mobileList || !row;
  const showTeam = Boolean(row) && (isDesktop || !mobileList);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] items-start">
      {showList && list}
      {teamId != null && !row && ws && (
        <Alert tone="warning" className={isDesktop ? '' : 'order-first'}>No hay un equipo con id {teamId} en este espacio de trabajo. Elegí otro de la lista.</Alert>
      )}
      {isDesktop && teamId == null && (
        <EmptyState icon={Shield} title="Elegí un equipo" description="Buscalo en la lista por nombre, abreviatura o id. Sus datos, plantel y kits se editan acá." />
      )}
      {showTeam && (
        <TeamDetail key={teamId} pes={pes} teamId={teamId} row={row} headingId={headingId} countries={countries}
          allTeams={allTeams} rows={rows} leagueIds={leagueIds} section={section} onSectionChange={onSectionChange}
          setAnnounce={setAnnounce} modified={modified} onBack={isDesktop ? undefined : back} />
      )}
      <p className="sr-only" role="status">{announce}</p>
    </div>
  );
}

/** One team. Keyed by teamId, so wizard, colour preview and errors never carry over to another team. */
function TeamDetail({
  pes, teamId, row, headingId, countries, allTeams, rows, leagueIds, section, onSectionChange, setAnnounce, modified, onBack,
}) {
  const { ws, wsDoc, caps, drafts } = pes;
  const [replacing, setReplacing] = useState(false);
  const [preview, setPreview] = useState({});
  const [error, setError] = useState(null);
  // Bumped when a commit changes nothing or fails: remounts the section so inputs show the stored values again.
  const [resetKey, setResetKey] = useState(0);
  const access = teamAccess(caps, leagueIds, teamId);
  const identity = teamIdentity(ws, teamId);
  const base = teamColours(ws, teamId);
  const colours = base && (preview[1] || preview[2]) ? { ...base, c1: preview[1] || base.c1, c2: preview[2] || base.c2 } : base;
  const draftUid = Object.entries(wsDoc?.draftMap || {}).find(([, id]) => Number(id) === teamId)?.[0];
  const teamDrafts = draftIndexesForTeam(ws, drafts, teamId);
  const isModified = (type, field) => modified.has(opKey({ type, target: { teamId }, field }));
  const canReplace = caps.has('team.replace') && ws.bin?.tables.assignment && ws.bin?.tables.player && row.hasBin;
  const kitCount = ws.kits?.map.has(teamId) ? ws.kits.kitsOf(teamId).length : null;

  const apply = async build => {
    setError(null);
    try {
      const ops = typeof build === 'function' ? build() : build;
      if (!ops.length) { setResetKey(k => k + 1); return; }
      await pes.apply(ops);
      setAnnounce(`${ops.length} cambio${ops.length === 1 ? '' : 's'} aplicado${ops.length === 1 ? '' : 's'}, sin guardar.`);
    } catch (e) {
      setError(e);
      setResetKey(k => k + 1);
    }
  };

  const tabs = [
    { id: 'identity', label: 'Identidad', icon: BadgeInfo },
    { id: 'stadium', label: 'Estadio y rivales', icon: Landmark },
    { id: 'squad', label: 'Plantel', icon: Users, count: row.players },
    { id: 'kits', label: 'Kits', icon: Shirt, count: kitCount, hidden: !caps.has('kit.read') },
    { id: 'advanced', label: 'Avanzado', icon: SlidersHorizontal, hidden: !row.hasBin },
  ];
  const visible = tabs.filter(t => !t.hidden).map(t => t.id);
  const current = visible.includes(section) ? section : 'identity';
  const props = { ws, version: pes.version, teamId, access, isModified, modified, apply, countries, teams: rows, leagueIds };

  return (
    <section aria-labelledby={headingId} className="min-w-0 space-y-4">
      <TeamHeader teamId={teamId} headingId={headingId} identity={identity} colours={colours}
        meta={headerMeta(ws, teamId, identity, countries, draftUid && allTeams[draftUid]?.teamName)}
        accessNote={accessNote(access)}
        saved={teamDrafts.length ? 'Hay cambios sin guardar en este equipo.' : 'Sin cambios pendientes en este equipo.'}
        onBack={onBack} onReplace={canReplace && !replacing ? () => setReplacing(true) : undefined} />
      {replacing && <ReplacementWizard ws={ws} teamId={teamId} apply={pes.apply} onDone={() => setReplacing(false)} />}
      <Tabs tabs={tabs} value={current} onChange={onSectionChange} label="Secciones del equipo" />
      {error && <Alert tone="danger">{error.message || String(error)}</Alert>}
      {current === 'kits' ? <KitsSection key={teamId} pes={pes} teamId={teamId} access={access} onApply={pes.apply} /> : (
        <div key={resetKey} className="panel-flat p-4 sm:p-5">
          {current === 'identity' && <IdentitySection {...props} onPreviewColour={(n, hex) => setPreview(p => ({ ...p, [n]: hex }))} />}
          {current === 'stadium' && <StadiumSection {...props} />}
          {current === 'squad' && <SquadSection {...props} />}
          {current === 'advanced' && <AdvancedSection {...props} />}
        </div>
      )}
      <TeamSaveBar teamCount={teamDrafts.length} totalCount={drafts.length} busy={pes.busy}
        onSave={pes.saveDrafts} onDiscard={() => pes.discardDrafts(teamDrafts)} />
    </section>
  );
}
