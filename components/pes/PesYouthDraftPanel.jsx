import React, { useMemo, useState } from 'react';
import { Sprout } from 'lucide-react';
import { Card, ErrorText } from './PesUi.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Alert.jsx';
import { EmptyState } from '../ui/EmptyState.jsx';
import { Spinner } from '../ui/Spinner.jsx';
import { confirmAction } from '../ui/ConfirmDialog.jsx';
import { getPosColorClass, getStatAndOvrColorClass } from '../../utils/helpers.js';
import { isTeamApproved } from '../../supabase/functions/_shared/membership.js';
import { useYouthDraft } from '../../hooks/useYouthDraft.js';
import {
  candidateCheck, editedRating, isEditedOvrInRange, isPoolLocked, originalOvrOf, poolEntryFromSheet, publishCheck,
  YOUTH_DRAFT_EDITED_MIN_OVR, YOUTH_DRAFT_EDITED_MAX_OVR,
} from '../../utils/youthDraft.js';
import { publishPool, saveCandidates } from '../../services/youthDraftService.js';
import { positionName } from './players/playerFields.js';

/** One candidate as this working copy sees it: the sheet, its rating and whether it can be published. */
function readCandidate(id, table, appById) {
  const appPlayer = appById.get(id);
  if (!table?.has(id)) return { id, name: appPlayer?.Name || `Jugador ${id}`, problem: 'No está en el Player.bin de este espacio de trabajo.' };
  const get = field => table.get(id, field);
  const check = candidateCheck(appPlayer);
  const rating = editedRating(get);
  const position = positionName(get('registeredPosition'));
  return {
    id,
    name: get('name') || appPlayer?.Name || `Jugador ${id}`,
    position,
    age: appPlayer?.Age,
    originalOvr: originalOvrOf(appPlayer),
    rating,
    problem: !check.eligible ? check.reason : rating == null ? 'No se pudo calcular la media de la ficha.' : '',
    entry: check.eligible && rating != null ? poolEntryFromSheet({ id, get, appPlayer, position }) : null,
  };
}

/**
 * Editor PES → Promesas (Super Admin): the players marked as «Promesa del draft» on their sheet, with the rating of
 * the sheet as it is now, and «Publicar al draft», which copies those sheets to config/youthDraft. From then on the
 * market shows them with these sheets and keeps them out of regular signings. After the first pick it is locked.
 */
export function PesYouthDraftPanel({ pes, appPlayers = [], allTeams }) {
  const { draft } = useYouthDraft();
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState(null);
  const table = pes.ws?.bin?.tables.player;
  const appById = useMemo(() => new Map(appPlayers.map(p => [Number(p.Id), p])), [appPlayers]);
  const candidateIds = useMemo(() => (Array.isArray(draft?.candidates) ? draft.candidates.map(Number) : []), [draft]);
  // pes.version changes when an edit lands in the working copy, so the ratings follow the sheets.
  const rows = useMemo(() => candidateIds.map(id => readCandidate(id, table, appById)), [candidateIds, table, appById, pes.version]);
  const teamCount = Object.values(allTeams || {}).filter(isTeamApproved).length;

  if (draft === undefined) return <Spinner center label="Cargando el draft de promesas…" />;

  const valid = rows.filter(row => row.entry);
  const gate = publishCheck({ validCount: valid.length, teamCount });
  const locked = isPoolLocked(draft);
  const publishedCount = Array.isArray(draft?.pool) ? draft.pool.length : 0;

  const remove = async (id) => {
    setError(null);
    try { await saveCandidates(candidateIds.filter(candidate => candidate !== id)); } catch (e) { setError(e); }
  };

  const publish = async () => {
    const outOfRange = valid.filter(row => !isEditedOvrInRange(row.rating));
    const isConfirmed = await confirmAction({
      title: `¿Publicar ${valid.length} promesas al draft?`,
      message: publishedCount
        ? 'Reemplaza el grupo publicado. Las promesas que saques vuelven al mercado común.'
        : 'Desde ahora el mercado las muestra con estas fichas y no se pueden fichar fuera del draft.',
      details: outOfRange.map(row => `${row.name}: media ${row.rating}, por debajo de ${YOUTH_DRAFT_EDITED_MIN_OVR}`),
      confirmLabel: 'Publicar al draft',
      tone: 'primary',
    });
    if (!isConfirmed) return;
    setPublishing(true);
    setError(null);
    try {
      await publishPool({ pool: valid.map(row => row.entry), workspaceId: pes.wsDoc?.id });
    } catch (e) {
      setError(e);
    } finally {
      setPublishing(false);
    }
  };

  if (!rows.length && !publishedCount) {
    return (
      <EmptyState icon={Sprout} title="Ninguna promesa marcada"
        description="Abrí la ficha de cada jugador en «Jugadores» y tocá «Marcar como promesa». Tienen que tener 17 a 21 años y media de 50 o más en el juego original." />
    );
  }

  return (
    <div className="space-y-4">
      {pes.drafts?.length > 0 && (
        <Alert tone="warning" title="Hay cambios sin guardar">
          Se publica la ficha como la ves ahora. Guardá también esos cambios en «Cambios y exportación» para que la exportación al juego sea la misma.
        </Alert>
      )}
      {locked && (
        <Alert tone="info" title="El draft ya empezó">
          Un club ya eligió: el grupo publicado no se puede cambiar. Para rehacerlo, borrá el draft en Administración → Draft de promesas.
        </Alert>
      )}

      <Card title="Promesas marcadas"
        description={`${valid.length} válidas de ${rows.length} marcadas · ${publishedCount} publicadas · hace falta al menos una por club (${teamCount}).`}
        actions={(
          <Button variant="primary" className="min-h-11" loading={publishing} disabled={!gate.ok || locked}
            title={locked ? 'El draft ya empezó' : gate.reason || undefined} onClick={publish}>
            Publicar al draft
          </Button>
        )}>
        {!gate.ok && !locked && <p className="mb-3 text-sm text-warning-soft">{gate.reason}</p>}
        <ul className="divide-y divide-line/[0.08] border-t border-line/[0.08]">
          {rows.map(row => (
            <li key={row.id} className="flex items-center gap-3 py-2.5">
              {row.position && <span className={`px-1.5 py-0.5 rounded-md text-2xs font-bold shrink-0 ${getPosColorClass(row.position)}`}>{row.position}</span>}
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink truncate">{row.name}</span>
                <span className={`block text-xs ${row.problem ? 'text-danger-soft' : 'text-ink-3'}`}>
                  {row.problem || <>id <span className="num">{row.id}</span> · <span className="num">{row.age}</span> años · media original <span className="num">{row.originalOvr}</span>
                    {!isEditedOvrInRange(row.rating) && <> · por debajo de {YOUTH_DRAFT_EDITED_MIN_OVR}</>}</>}
                </span>
              </span>
              {row.rating != null && (
                <span className={`min-w-10 h-10 px-1 rounded-lg flex items-center justify-center font-display num text-lg font-bold shrink-0 ${getStatAndOvrColorClass(row.rating)}`}
                  title="Media con la ficha editada">{row.rating}</span>
              )}
              {!locked && <Button size="sm" variant="ghost" className="min-h-11 shrink-0" onClick={() => remove(row.id)}>Quitar</Button>}
            </li>
          ))}
        </ul>
        <ErrorText error={error} className="mt-3" />
      </Card>
    </div>
  );
}

export default PesYouthDraftPanel;
