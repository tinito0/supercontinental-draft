import React, { useMemo, useRef, useState } from 'react';
import { Users } from 'lucide-react';
import { Card, Group, FieldInput } from './PesUi.jsx';
import { EmptyState } from '../ui/EmptyState.jsx';
import { EDIT_PLAYER_FIELDS, EDIT_LOCKED_FIELDS } from '../../pes/formats/pes2021/editLayout.js';
import { opKey } from './opKeys.js';
import { playerEditOps } from '../../pes/formats/pes2021/playerFieldSync.js';
import { useCountries } from './useCountries.js';
import { PesPlayerList } from './players/PesPlayerList.jsx';
import { ProfileHeader, IdentityForm, PositionMap, StatGroups } from './players/PesPlayerProfile.jsx';
import { POSITION_FIELDS, IDENTITY_FIELDS, FIELD_LABELS, TRAIT_GROUPS, fieldsInGroup, positionName, statGroups, statLabel } from './players/playerFields.js';
import { TraitToggles, MotionForm } from './players/PlayerTraits.jsx';
import { YouthDraftToggle } from './players/YouthDraftToggle.jsx';
import { useYouthDraft } from '../../hooks/useYouthDraft.js';
import { scrollBehavior } from '../../utils/scrollBehavior.js';

const MAX_RESULTS = 100;
const DEFAULT_RESULTS = 50;

/**
 * Player editor in the style of the app's player card: photo, position map and attributes with the
 * stat colour scale. Edits become `bin.player.set` / `edit.player.set` operations (unchanged).
 * @param {{ appPlayers?: object[] }} props appPlayers: draft players (same ids as Player.bin) for OVR.
 */
export function PesPlayersPanel({ pes, onApply, appPlayers = [] }) {
  const { ws, caps, version, modified } = pes;
  const [q, setQ] = useState('');
  const [playerId, setPlayerId] = useState(null);
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

  const index = useMemo(() => {
    const out = [];
    if (table) {
      for (const id of table.ids()) {
        out.push({ id, name: table.get(id, 'name'), src: 'bin', pos: positionName(table.get(id, 'registeredPosition')), ovr: Number(appById.get(id)?.OVR_CALCULADO) || 0 });
      }
    }
    if (ws?.edit) for (const id of ws.edit.players.keys()) out.push({ id, name: ws.edit.readPlayer(id).name, src: 'edit', ovr: Number(appById.get(id)?.OVR_CALCULADO) || 0 });
    return out;
  }, [ws, table, version, appById]);

  const { results, truncated } = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return { results: index.filter(p => p.src === 'edit').concat(index.slice(0, DEFAULT_RESULTS)), truncated: index.length > DEFAULT_RESULTS };
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
    if (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => profileRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' }));
    }
  };

  const inBin = playerId != null && table?.has(playerId);
  const inEdit = playerId != null && ws?.edit?.players.has(playerId);

  return (
    <div className="grid gap-4 lg:gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <PesPlayerList total={index.length} results={results} truncated={truncated} query={q} onQuery={setQ} selectedId={playerId} onSelect={select} />

      <div ref={profileRef} className="space-y-4 lg:space-y-6 min-w-0 scroll-mt-20">
        {playerId == null && (
          <EmptyState icon={Users} title="Elegí un jugador"
            description={canEdit ? 'Buscalo por nombre o id. Los cambios quedan como borrador hasta que los guardes en «Cambios y exportación».' : 'Tu rol puede ver los jugadores pero no editarlos.'} />
        )}
        {playerId != null && (
          // Keyed by player: the profile fades in, so picking another player reads as a new record, not an edit.
          <div key={playerId} className="animate-in fade-in space-y-4 lg:space-y-6">
            {inBin && (
              <BinPlayer table={table} playerId={playerId} fieldOf={fieldOf} canEdit={canEdit} modified={modified} onApply={onApply} inEdit={inEdit}
                appPlayer={appById.get(playerId)} countries={countries} countryName={countryName}
                youthDraft={canMarkProspects ? youthDraft : undefined} />
            )}
            {inEdit && <EditPlayer ws={ws} playerId={playerId} canEdit={canEdit} modified={modified} onApply={onApply} bare={!inBin} />}
          </div>
        )}
      </div>
    </div>
  );
}

function BinPlayer({ table, playerId, fieldOf, canEdit, modified, onApply, inEdit, appPlayer, countries, countryName, youthDraft }) {
  const get = name => table.get(playerId, name);
  const isModified = field => modified.has(opKey({ type: 'bin.player.set', target: { playerId }, field }));
  // A player that is also in the EDIT gets the same change there: the game reads the EDIT value of edited players.
  const commit = (field, value) => onApply(playerEditOps(playerId, field, value, { inEdit }));
  const goalkeeper = positionName(get('registeredPosition')) === 'PT';
  const shared = { fieldOf, get, canEdit, isModified, commit };

  const used = new Set(['id', ...IDENTITY_FIELDS, ...POSITION_FIELDS.map(p => p.field), ...statGroups(table.fields, goalkeeper).flatMap(([, l]) => l.map(f => f.name))]);
  const others = table.fields.filter(f => !used.has(f.name) && !TRAIT_GROUPS.includes(f.group));
  const skills = fieldsInGroup(table.fields, 'skill');
  const comStyles = fieldsInGroup(table.fields, 'comStyle');
  const motions = fieldsInGroup(table.fields, 'motion');
  const count = list => list.filter(f => get(f.name)).length;

  return (
    <>
      <Card>
        <ProfileHeader playerId={playerId} get={get} appPlayer={appPlayer} countryName={countryName} />
        {inEdit && <p className="mt-4 text-xs text-ink-2 max-w-[65ch]">También está en el EDIT: cada cambio se guarda en Player.bin y en el EDIT, salvo el festejo y las posiciones de defensa y arquero, que van solo a Player.bin.</p>}
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_17rem]">
          <Group title="Identidad">
            <IdentityForm {...shared} countries={countries} />
          </Group>
          <Group title="Posiciones" className="xl:border-t-0 xl:pt-0">
            <PositionMap {...shared} />
          </Group>
        </div>
      </Card>

      {youthDraft !== undefined && <YouthDraftToggle playerId={playerId} get={get} appPlayer={appPlayer} draft={youthDraft} />}

      <Card title="Atributos" description={goalkeeper ? 'Ficha de arquero. Los atributos de arquero están sin verificar en Player.bin: se muestran, no se editan.' : 'Valores 40–99 como en el juego. Enter o salir del campo para aplicar.'}>
        <StatGroups {...shared} fields={table.fields} goalkeeper={goalkeeper} />
      </Card>

      {skills.length > 0 && (
        <Card title="Habilidades" description={`Tiene ${count(skills)} de ${skills.length}. Tocá una para agregarla o sacarla.`}>
          <TraitToggles {...shared} fields={skills} label="Habilidades" />
        </Card>
      )}

      {comStyles.length > 0 && (
        <Card title="Estilos de juego COM" description={`Tiene ${count(comStyles)}. Cambian cómo juega cuando lo maneja la máquina.`}>
          <TraitToggles {...shared} fields={comStyles} label="Estilos de juego COM" />
        </Card>
      )}

      {motions.length > 0 && (
        <Card title="Movimientos y festejo" description="Tipos que usa el juego. El festejo va por número.">
          <MotionForm {...shared} fields={motions} />
        </Card>
      )}

      {others.length > 0 && (
        <Card title="Otros datos" description="Campos con el candado tienen significado sin verificar: solo lectura.">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {others.map(f => (
              <FieldInput key={f.name} field={f} value={get(f.name)} readOnly={!canEdit} label={FIELD_LABELS[f.name] || statLabel(f.name)}
                modified={isModified(f.name)} onCommit={v => commit(f.name, v)} />
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

function EditPlayer({ ws, playerId, canEdit, modified, onApply, bare }) {
  const p = ws.edit.readPlayer(playerId);
  return (
    <Card title={bare ? p.name || `Jugador ${playerId}` : 'Valores del EDIT'}
      description="Valores crudos del EDIT00000000 (formato 4ccEditor). Al cambiar un campo se marca como editado para que el juego use el valor del EDIT.">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {EDIT_PLAYER_FIELDS.filter(f => !EDIT_LOCKED_FIELDS.has(f.name)).map(f => (
          <FieldInput key={f.name} field={f} value={p[f.name]} readOnly={!canEdit}
            modified={modified.has(opKey({ type: 'edit.player.set', target: { playerId }, field: f.name }))}
            onCommit={value => onApply([{ type: 'edit.player.set', target: { playerId }, field: f.name, value }])} />
        ))}
      </div>
    </Card>
  );
}
