import React, { useMemo, useRef, useState } from 'react';
import { Users, Undo2, Search } from 'lucide-react';
import { Card, Group, FieldInput } from './PesUi.jsx';
import { EmptyState } from '../ui/EmptyState.jsx';
import { Alert } from '../ui/Alert.jsx';
import { Tabs, tabPanelProps } from '../ui/Tabs.jsx';
import { EDIT_PLAYER_FIELDS, EDIT_LOCKED_FIELDS, isModCelebration } from '../../pes/formats/pes2021/editLayout.js';
import { BIN_TO_EDIT, playerEditOps } from '../../pes/formats/pes2021/playerFieldSync.js';
import { opKey } from './opKeys.js';
import { useCountries } from './useCountries.js';
import { PesPlayerList } from './players/PesPlayerList.jsx';
import { ProfileHeader, IdentityForm, PositionMap, StatGroups } from './players/PesPlayerProfile.jsx';
import {
  POSITION_FIELDS, IDENTITY_FIELDS, FIELD_LABELS, TRAIT_GROUPS, EDIT_ONLY_GROUPS, fieldsInGroup, positionName, statGroups, statLabel,
} from './players/playerFields.js';
import { TraitToggles, SkillGroups, MotionForm, EditCelebrations } from './players/PlayerTraits.jsx';
import { fieldLabel, formatValue } from './players/playerLabels.js';
import { YouthDraftToggle } from './players/YouthDraftToggle.jsx';
import { useYouthDraft } from '../../hooks/useYouthDraft.js';
import { scrollBehavior } from '../../utils/scrollBehavior.js';

const MAX_RESULTS = 100;
const DEFAULT_RESULTS = 50;
const EDIT_BY_NAME = new Map(EDIT_PLAYER_FIELDS.map(f => [f.name, f]));
const LINKED_EDIT_FIELDS = new Set(Object.values(BIN_TO_EDIT).map(l => l.edit));
const isPlayerOp = (op, playerId) => (op.type === 'bin.player.set' || op.type === 'edit.player.set') && op.target?.playerId === playerId;

/**
 * Player editor in the style of the app's player card. A player that is in Player.bin and in the EDIT is one profile:
 * each edit goes to both files (playerFieldSync.js); the EDIT-only fields live in «Avanzado».
 * @param {{ appPlayers?: object[] }} props appPlayers: draft players (same ids as Player.bin) for OVR.
 */
export function PesPlayersPanel({ pes, onApply, appPlayers = [] }) {
  const { ws, caps, version, modified } = pes;
  const [q, setQ] = useState('');
  const [playerId, setPlayerId] = useState(null);
  // Phones: the list folds away once a player is picked, so the profile starts at the top of the screen.
  const [listOpen, setListOpen] = useState(true);
  const profileRef = useRef(null);
  const countries = useCountries();
  const canEdit = caps.has('player.edit');
  // Marking prospects writes config/youthDraft, which only the Super Admin (and the app admin) may write.
  const canMarkProspects = caps.has('roles.manage');
  const { draft: youthDraft } = useYouthDraft(canMarkProspects);
  const table = ws?.bin?.tables.player;

  const appById = useMemo(() => new Map(appPlayers.map(p => [Number(p.Id), p])), [appPlayers]);
  const countryName = useMemo(() => {
    const m = new Map(countries.map(c => [c.id, c.name]));
    return id => m.get(Number(id)) || `País ${id}`;
  }, [countries]);

  // One entry per player: the EDIT players first (the ones being worked on), then Player.bin in file order.
  const index = useMemo(() => {
    const editIds = ws?.edit ? [...ws.edit.players.keys()] : [];
    const inEdit = new Set(editIds);
    const ovr = id => Number(appById.get(id)?.OVR_CALCULADO) || 0;
    const first = editIds.map(id => (table?.has(id)
      ? { id, name: table.get(id, 'name'), pos: positionName(table.get(id, 'registeredPosition')), inEdit: true, inBin: true, ovr: ovr(id) }
      : { id, name: ws.edit.readPlayer(id).name, inEdit: true, inBin: false, ovr: ovr(id) }));
    const rest = table ? table.ids().filter(id => !inEdit.has(id)).map(id => ({ id, name: table.get(id, 'name'), pos: positionName(table.get(id, 'registeredPosition')), inBin: true, ovr: ovr(id) })) : [];
    return [...first, ...rest];
  }, [ws, table, version, appById]);

  const { results, truncated } = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return { results: index.slice(0, DEFAULT_RESULTS), truncated: index.length > DEFAULT_RESULTS };
    const all = index.filter(p => String(p.id) === s || (p.name || '').toLowerCase().includes(s));
    return { results: all.slice(0, MAX_RESULTS), truncated: all.length > MAX_RESULTS };
  }, [index, q]);

  const fieldOf = useMemo(() => {
    const m = new Map((table?.fields || []).map(f => [f.name, f]));
    return name => m.get(name);
  }, [table]);

  if (!table && !ws?.edit) {
    return <EmptyState icon={Users} title="Sin jugadores cargados" description="Cargá Player.bin o un EDIT00000000 en «Fuentes» para ver y editar jugadores." />;
  }

  const select = id => {
    setPlayerId(id);
    setListOpen(false);
    if (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => profileRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' }));
    }
  };

  const inBin = playerId != null && table?.has(playerId);
  const inEdit = playerId != null && Boolean(ws?.edit?.players.has(playerId));

  return (
    <div className="grid gap-4 lg:gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <div className={playerId != null && !listOpen ? 'hidden lg:block' : ''}>
        <PesPlayerList total={index.length} results={results} truncated={truncated} query={q} onQuery={setQ} selectedId={playerId} onSelect={select} />
      </div>
      {playerId != null && !listOpen && (
        <button type="button" className="btn btn-secondary w-full lg:hidden" onClick={() => setListOpen(true)}>
          <Search className="w-4 h-4" aria-hidden="true" /> Buscar otro jugador
        </button>
      )}

      <div ref={profileRef} className="min-w-0 scroll-mt-20">
        {playerId == null && (
          <EmptyState icon={Users} title="Elegí un jugador"
            description={canEdit ? 'Buscalo por nombre o id. Los cambios quedan como borrador hasta que los guardes en «Cambios y exportación».' : 'Tu rol puede ver los jugadores pero no editarlos.'} />
        )}
        {playerId != null && (
          // Keyed by player: the profile fades in, so picking another player reads as a new record, not an edit.
          <div key={playerId} className="animate-in fade-in">
            {inBin
              ? <PlayerEditor pes={pes} table={table} playerId={playerId} fieldOf={fieldOf} canEdit={canEdit} modified={modified} onApply={onApply}
                  inEdit={inEdit} appPlayer={appById.get(playerId)} countries={countries} countryName={countryName}
                  youthDraft={canMarkProspects ? youthDraft : undefined} />
              : <EditOnlyPlayer pes={pes} playerId={playerId} canEdit={canEdit} modified={modified} onApply={onApply} />}
          </div>
        )}
      </div>
    </div>
  );
}

/** Unsaved drafts of this player, with a button that drops them. */
function UndoPlayer({ pes, playerId }) {
  const indexes = (pes.drafts || []).map((op, i) => (isPlayerOp(op, playerId) ? i : -1)).filter(i => i >= 0);
  if (!indexes.length || !pes.discardDrafts) return null;
  // A Player.bin edit and its EDIT twin are one change for the user.
  const changes = indexes.filter(i => !(pes.drafts[i].type === 'edit.player.set' && LINKED_EDIT_FIELDS.has(pes.drafts[i].field))).length || indexes.length;
  return (
    <button type="button" className="btn btn-ghost btn-sm" onClick={() => pes.discardDrafts(indexes)}>
      <Undo2 className="w-4 h-4" aria-hidden="true" /> Deshacer {changes === 1 ? 'el cambio' : `los ${changes} cambios`} sin guardar
    </button>
  );
}

/** Linked fields whose EDIT value differs from Player.bin. The game uses the EDIT one. */
function editDifferences(table, edit, playerId) {
  const values = edit.readPlayer(playerId);
  const out = [];
  for (const [field, link] of Object.entries(BIN_TO_EDIT)) {
    if (!table.fieldByName.has(field)) continue;
    const binValue = table.get(playerId, field);
    const editValue = link.toBin(values[link.edit]);
    if (editValue !== binValue) out.push({ field, binValue, editValue });
  }
  return out;
}

function PlayerEditor({ pes, table, playerId, fieldOf, canEdit, modified, onApply, inEdit, appPlayer, countries, countryName, youthDraft }) {
  const [tab, setTab] = useState('ficha');
  const get = name => table.get(playerId, name);
  const isModified = field => modified.has(opKey({ type: 'bin.player.set', target: { playerId }, field }));
  // A player that is also in the EDIT gets the same change there: the game reads the EDIT value of edited players.
  const commit = (field, value) => onApply(playerEditOps(playerId, field, value, { inEdit }));
  const goalkeeper = positionName(get('registeredPosition')) === 'PT';
  const shared = { fieldOf, get, canEdit, isModified, commit };

  const skills = fieldsInGroup(table.fields, 'skill');
  const comStyles = fieldsInGroup(table.fields, 'comStyle');
  // The game takes celebrations from the EDIT only (owner, 2026-11-27): the Player.bin one is not shown.
  const motions = fieldsInGroup(table.fields, 'motion').filter(f => f.name !== 'celebration');
  const used = new Set(['id', ...IDENTITY_FIELDS, ...POSITION_FIELDS.map(p => p.field), ...statGroups(table.fields, goalkeeper).flatMap(([, l]) => l.map(f => f.name))]);
  // Goalkeeper attributes are read-only and say nothing about a field player: they only show on a goalkeeper's sheet.
  const others = table.fields.filter(f => !used.has(f.name) && !TRAIT_GROUPS.includes(f.group) && !/^gk[A-Z]/.test(f.name));
  const owned = skills.filter(f => get(f.name)).length;
  const differences = inEdit ? editDifferences(table, pes.ws.edit, playerId) : [];

  const tabs = [
    { id: 'ficha', label: 'Ficha' },
    { id: 'atributos', label: 'Atributos' },
    { id: 'habilidades', label: 'Habilidades', count: owned },
    { id: 'movimientos', label: 'Movimientos' },
    { id: 'avanzado', label: 'Avanzado' },
  ];
  const idPrefix = `pes-player-${playerId}`;

  return (
    <div className="space-y-4">
      <Card>
        <ProfileHeader playerId={playerId} get={get} appPlayer={appPlayer} countryName={countryName} />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-xs text-ink-2 max-w-[60ch]">
            {inEdit ? 'En Player.bin y en el EDIT: cada cambio se guarda en los dos.' : 'Solo en Player.bin.'}
          </p>
          <UndoPlayer pes={pes} playerId={playerId} />
        </div>
        {differences.length > 0 && (
          <Alert tone="warning" className="mt-3">
            <p>El EDIT tiene otros valores y el juego usa esos. Si editás el campo acá, quedan iguales en los dos archivos.</p>
            <ul className="mt-1.5 space-y-0.5">
              {differences.map(d => (
                <li key={d.field}>
                  <span className="font-semibold">{fieldLabel(d.field, table)}</span>: EDIT {formatValue(d.field, d.editValue)} · Player.bin {formatValue(d.field, d.binValue)}
                </li>
              ))}
            </ul>
          </Alert>
        )}
        <Tabs tabs={tabs} value={tab} onChange={setTab} label="Secciones del jugador" idPrefix={idPrefix} className="mt-5" />
      </Card>

      {youthDraft !== undefined && tab === 'ficha' && <YouthDraftToggle playerId={playerId} get={get} appPlayer={appPlayer} draft={youthDraft} />}

      <div {...tabPanelProps(idPrefix, tab)} className="space-y-4">
        {tab === 'ficha' && (
          <Card>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_17rem]">
              <Group title="Identidad"><IdentityForm {...shared} countries={countries} /></Group>
              <Group title="Posiciones" className="xl:border-t-0 xl:pt-0"><PositionMap {...shared} /></Group>
            </div>
          </Card>
        )}

        {tab === 'atributos' && (
          <Card description={goalkeeper ? 'Ficha de arquero. Los atributos de arquero se muestran pero no se editan: no está claro cuál es cuál en el archivo.' : 'Valores 40–99 como en el juego. Enter o salir del campo para aplicar.'}>
            <StatGroups {...shared} fields={table.fields} goalkeeper={goalkeeper} />
          </Card>
        )}

        {tab === 'habilidades' && (
          <>
            <Card title="Habilidades" description={`Tiene ${owned} de ${skills.length}. Tocá una para agregarla o sacarla.`}>
              <SkillGroups {...shared} fields={skills} />
            </Card>
            <Card title="Estilos de juego COM" description={`Tiene ${comStyles.filter(f => get(f.name)).length}. Cambian cómo juega cuando lo maneja la máquina.`}>
              <TraitToggles {...shared} fields={comStyles} label="Estilos de juego COM" />
            </Card>
          </>
        )}

        {tab === 'movimientos' && (
          <>
            <Card title="Movimientos" description="Tipos que usa el juego.">
              <MotionForm {...shared} fields={motions} />
            </Card>
            <Card title="Festejos" description={inEdit ? 'El juego los toma del EDIT. Número del festejo, hasta 255. Los que valen 0 o 1 los pone el mod y quedan como están.' : 'El juego toma los festejos del EDIT y este jugador no está en el EDIT.'}>
              {inEdit && <EditCelebrations edit={pes.ws.edit} playerId={playerId} canEdit={canEdit} modified={modified} onApply={onApply} />}
            </Card>
          </>
        )}

        {tab === 'avanzado' && (
          <>
            {others.length > 0 && (
              <Card title="Otros datos" description="Los campos con candado se muestran pero no se editan.">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {others.map(f => (
                    <FieldInput key={f.name} field={f} value={get(f.name)} readOnly={!canEdit} label={FIELD_LABELS[f.name] || statLabel(f.name)}
                      modified={isModified(f.name)} onCommit={v => commit(f.name, v)} />
                  ))}
                </div>
              </Card>
            )}
            {inEdit && <EditOnlyFields pes={pes} playerId={playerId} canEdit={canEdit} modified={modified} onApply={onApply} />}
          </>
        )}
      </div>
    </div>
  );
}

/** EDIT fields with no Player.bin counterpart, grouped and in Spanish. */
function EditOnlyFields({ pes, playerId, canEdit, modified, onApply }) {
  const values = pes.ws.edit.readPlayer(playerId);
  const groups = EDIT_ONLY_GROUPS
    .map(([title, labels]) => [title, Object.entries(labels).filter(([name]) => EDIT_BY_NAME.has(name) && !LINKED_EDIT_FIELDS.has(name))])
    .filter(([, list]) => list.length);
  return (
    <Card title="Datos solo del EDIT" description="No existen en Player.bin. Al cambiarlos, el EDIT los marca como editados.">
      <div className="space-y-6">
        {groups.map(([title, list]) => (
          <Group key={title} title={title}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {list.map(([name, label]) => (
                <FieldInput key={name} field={EDIT_BY_NAME.get(name)} value={values[name]} label={label} readOnly={!canEdit}
                  modified={modified.has(opKey({ type: 'edit.player.set', target: { playerId }, field: name }))}
                  onCommit={value => onApply([{ type: 'edit.player.set', target: { playerId }, field: name, value }])} />
              ))}
            </div>
          </Group>
        ))}
      </div>
    </Card>
  );
}

/** A player that is only in the EDIT (Player.bin not loaded, or he is not in it): every editable EDIT field, in Spanish. */
function EditOnlyPlayer({ pes, playerId, canEdit, modified, onApply }) {
  const p = pes.ws.edit.readPlayer(playerId);
  const fields = EDIT_PLAYER_FIELDS.filter(f => !EDIT_LOCKED_FIELDS.has(f.name));
  return (
    <Card title={p.name || `Jugador ${playerId}`} description="Solo está en el EDIT. Cargá Player.bin para editarlo con la ficha completa."
      actions={<UndoPlayer pes={pes} playerId={playerId} />}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {fields.map(f => (
          <FieldInput key={f.name} field={f} value={p[f.name]} label={fieldLabel(f.name, null, true)}
            readOnly={!canEdit || isModCelebration(f.name, p[f.name])}
            modified={modified.has(opKey({ type: 'edit.player.set', target: { playerId }, field: f.name }))}
            onCommit={value => onApply([{ type: 'edit.player.set', target: { playerId }, field: f.name, value }])} />
        ))}
      </div>
    </Card>
  );
}
