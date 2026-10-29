import React, { useMemo, useRef, useState } from 'react';
import { Users } from 'lucide-react';
import { Card, Group, FieldInput } from './PesUi.jsx';
import { EmptyState } from '../ui/EmptyState.jsx';
import { EDIT_PLAYER_FIELDS, EDIT_LOCKED_FIELDS } from '../../pes/formats/pes2021/editLayout.js';
import { opKey } from './opKeys.js';
import { useCountries } from './useCountries.js';
import { PesPlayerList } from './players/PesPlayerList.jsx';
import { ProfileHeader, IdentityForm, PositionMap, StatGroups } from './players/PesPlayerProfile.jsx';
import { POSITION_FIELDS, IDENTITY_FIELDS, FIELD_LABELS, positionName, statGroups, statLabel } from './players/playerFields.js';

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
      requestAnimationFrame(() => profileRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
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
              <BinPlayer table={table} playerId={playerId} fieldOf={fieldOf} canEdit={canEdit} modified={modified} onApply={onApply}
                appPlayer={appById.get(playerId)} countries={countries} countryName={countryName} />
            )}
            {inEdit && <EditPlayer ws={ws} playerId={playerId} canEdit={canEdit} modified={modified} onApply={onApply} bare={!inBin} />}
          </div>
        )}
      </div>
    </div>
  );
}

function BinPlayer({ table, playerId, fieldOf, canEdit, modified, onApply, appPlayer, countries, countryName }) {
  const get = name => table.get(playerId, name);
  const isModified = field => modified.has(opKey({ type: 'bin.player.set', target: { playerId }, field }));
  const commit = (field, value) => onApply([{ type: 'bin.player.set', target: { playerId }, field, value }]);
  const goalkeeper = positionName(get('registeredPosition')) === 'PT';
  const shared = { fieldOf, get, canEdit, isModified, commit };

  const used = new Set(['id', ...IDENTITY_FIELDS, ...POSITION_FIELDS.map(p => p.field), ...statGroups(table.fields, goalkeeper).flatMap(([, l]) => l.map(f => f.name))]);
  const others = table.fields.filter(f => !used.has(f.name));

  return (
    <>
      <Card>
        <ProfileHeader playerId={playerId} get={get} appPlayer={appPlayer} countryName={countryName} />
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_17rem]">
          <Group title="Identidad">
            <IdentityForm {...shared} countries={countries} />
          </Group>
          <Group title="Posiciones" className="xl:border-t-0 xl:pt-0">
            <PositionMap {...shared} />
          </Group>
        </div>
      </Card>

      <Card title="Atributos" description={goalkeeper ? 'Ficha de arquero. Los atributos de arquero están sin verificar en Player.bin: se muestran, no se editan.' : 'Valores 40–99 como en el juego. Enter o salir del campo para aplicar.'}>
        <StatGroups {...shared} fields={table.fields} goalkeeper={goalkeeper} />
      </Card>

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
