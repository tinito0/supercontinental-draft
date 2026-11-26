import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Sprout, X } from 'lucide-react';
import { Button, IconButton } from '../ui/Button.jsx';
import { EmptyState } from '../ui/EmptyState.jsx';
import { Alert } from '../ui/Alert.jsx';
import { confirmAction } from '../ui/ConfirmDialog.jsx';
import { DEFAULT_LOGO } from '../../utils/constants.js';
import { isTeamApproved } from '../../supabase/functions/_shared/membership.js';
import { useYouthDraft } from '../../hooks/useYouthDraft.js';
import { nextTeamToPick } from '../../utils/youthDraft.js';
import { deleteYouthDraft, saveOrder, setTurn } from '../../services/youthDraftService.js';
import { undoYouthDraftPick } from '../../services/marketService.js';

function Crest({ team }) {
  return (
    <img src={team?.logoUrl || DEFAULT_LOGO} alt="" width={32} height={32} className="w-8 h-8 object-contain shrink-0"
      onError={(e) => { e.currentTarget.src = DEFAULT_LOGO; }} />
  );
}

/**
 * Administración → Draft de promesas. The draft runs on a call: the admin loads the pick order by hand, opens the
 * turn of one club, that manager picks in the marketplace (market.js pickYouthDraft), and the turn closes by itself.
 * A mistaken pick is undone here and the turn goes back to that club. The pool is published from Editor PES → Promesas.
 */
export function YouthDraftAdminSection({ allTeams, showStatusMessage }) {
  const { draft } = useYouthDraft();
  const [busy, setBusy] = useState(null);
  const [addId, setAddId] = useState('');

  const pool = Array.isArray(draft?.pool) ? draft.pool : [];
  const order = Array.isArray(draft?.order) ? draft.order : [];
  const picks = draft?.picks && typeof draft.picks === 'object' ? draft.picks : {};
  const poolById = useMemo(() => new Map(pool.map(entry => [String(entry.id), entry])), [pool]);
  const approvedTeams = useMemo(() => Object.entries(allTeams || {})
    .filter(([, team]) => isTeamApproved(team))
    .map(([uid, team]) => ({ uid, ...team }))
    .sort((a, b) => String(a.teamName || '').localeCompare(String(b.teamName || ''), 'es')), [allTeams]);
  const missingTeams = approvedTeams.filter(team => !order.includes(team.uid));

  const run = async (key, action, success) => {
    setBusy(key);
    try {
      await action();
      if (success) showStatusMessage?.('success', success);
    } catch (error) {
      showStatusMessage?.('error', error?.message || 'No se pudo guardar. Reintentá.');
    } finally {
      setBusy(null);
    }
  };

  if (draft === undefined) {
    return <div className="skeleton h-64 rounded-2xl" aria-label="Cargando el draft de promesas" />;
  }

  const teamName = uid => allTeams?.[uid]?.teamName || 'Club sin nombre';
  const move = (index, delta) => {
    const next = [...order];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    run('order', () => saveOrder(next));
  };
  const removeFromOrder = uid => run('order', () => saveOrder(order.filter(id => id !== uid)));
  const addToOrder = uid => { if (uid) run('order', () => saveOrder([...order, uid])); setAddId(''); };

  const undo = async (uid) => {
    const entry = poolById.get(String(picks[uid]));
    const isConfirmed = await confirmAction({
      title: `¿Deshacer el pick de ${teamName(uid)}?`,
      message: `${entry?.name || 'La promesa'} vuelve al draft y ${teamName(uid)} recupera el turno.`,
      confirmLabel: 'Deshacer pick',
      tone: 'danger',
    });
    if (isConfirmed) run(`undo-${uid}`, () => undoYouthDraftPick({ teamId: uid }), 'Pick deshecho: el turno volvió a ese club.');
  };

  const removeDraft = async () => {
    const isConfirmed = await confirmAction({
      title: '¿Borrar el draft de promesas?',
      message: 'Se borran el grupo publicado, el orden y los turnos. Los jugadores ya elegidos siguen en sus planteles hasta el reseteo de temporada.',
      confirmLabel: 'Borrar draft',
      tone: 'danger',
      irreversible: true,
    });
    if (isConfirmed) run('delete', deleteYouthDraft, 'Draft de promesas borrado.');
  };

  const suggested = nextTeamToPick(draft);
  const pickedCount = Object.keys(picks).length;

  return (
    <section aria-labelledby="youth-draft-admin-title" className="space-y-5">
      <div>
        <h2 id="youth-draft-admin-title" className="section-title">Draft de promesas</h2>
        <p className="mt-1 text-sm text-ink-2">
          Una ronda, sin costo de presupuesto. Cargá el orden (inverso a la tabla de la temporada pasada), abrí el turno
          del club que está en la llamada y ese mánager elige desde el mercado. El turno se cierra solo al elegir.
        </p>
      </div>

      {pool.length === 0 ? (
        <EmptyState icon={Sprout} title="Todavía no hay promesas publicadas"
          description="Marcalas en Editor PES → Jugadores (ficha del jugador) y publicalas desde Editor PES → Promesas." />
      ) : (
        <p className="text-sm text-ink-3">
          <span className="num text-ink-2">{pool.length}</span> promesas publicadas ·{' '}
          <span className="num text-ink-2">{pickedCount}</span> elegidas · las que nadie elija quedan fuera del mercado toda la temporada.
        </p>
      )}

      {draft?.turnTeamId && (
        <Alert tone="info" title={`Turno abierto: ${teamName(draft.turnTeamId)}`}
          action={<Button size="sm" className="min-h-11" loading={busy === 'turn'} onClick={() => run('turn', () => setTurn(null))}>Cerrar turno</Button>}>
          Ese club ve el botón «Elegir» en el mercado.
        </Alert>
      )}

      <div>
        <h3 className="eyebrow pb-2 border-b border-line/[0.08]">Orden de elección</h3>
        {order.length === 0 && <p className="py-3 text-sm text-ink-3">Agregá los clubes en el orden en que eligen.</p>}
        <ol className="divide-y divide-line/[0.08]">
          {order.map((uid, index) => {
            const pickId = picks[uid];
            const entry = pickId !== undefined ? poolById.get(String(pickId)) : null;
            const hasTurn = draft?.turnTeamId === uid;
            return (
              <li key={uid} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                <span className="w-6 text-right font-display num text-lg font-bold text-ink-3">{index + 1}</span>
                <Crest team={allTeams?.[uid]} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink truncate">{teamName(uid)}</span>
                  <span className="block text-xs text-ink-3">
                    {entry ? `Eligió a ${entry.name} (OVR ${entry.ovr})` : hasTurn ? 'Eligiendo ahora' : uid === suggested ? 'Le toca' : 'Pendiente'}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  {entry ? (
                    <Button size="sm" variant="ghost" className="min-h-11" loading={busy === `undo-${uid}`} onClick={() => undo(uid)}>Deshacer pick</Button>
                  ) : (
                    !hasTurn && pool.length > 0 && (
                      <Button size="sm" variant={uid === suggested ? 'primary' : 'secondary'} className="min-h-11" loading={busy === `turn-${uid}`}
                        onClick={() => run(`turn-${uid}`, () => setTurn(uid), `Turno abierto para ${teamName(uid)}.`)}>
                        Dar turno
                      </Button>
                    )
                  )}
                  <IconButton icon={ArrowUp} label={`Subir a ${teamName(uid)}`} disabled={index === 0 || busy === 'order'} onClick={() => move(index, -1)} />
                  <IconButton icon={ArrowDown} label={`Bajar a ${teamName(uid)}`} disabled={index === order.length - 1 || busy === 'order'} onClick={() => move(index, 1)} />
                  {!entry && <IconButton icon={X} label={`Quitar a ${teamName(uid)} del orden`} disabled={busy === 'order'} onClick={() => removeFromOrder(uid)} />}
                </span>
              </li>
            );
          })}
        </ol>

        {missingTeams.length > 0 && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 min-w-0 flex-1 sm:flex-none sm:w-72">
              <span className="field-label">Agregar club</span>
              <select className="select min-h-11" value={addId} onChange={e => addToOrder(e.target.value)} disabled={busy === 'order'}>
                <option value="">Elegí un club…</option>
                {missingTeams.map(team => <option key={team.uid} value={team.uid}>{team.teamName || 'Club sin nombre'}</option>)}
              </select>
            </label>
            {order.length === 0 && (
              <Button className="min-h-11" loading={busy === 'order'} onClick={() => run('order', () => saveOrder(approvedTeams.map(team => team.uid)))}>
                Agregar los {approvedTeams.length} aprobados
              </Button>
            )}
          </div>
        )}
      </div>

      {draft && (
        <div className="pt-4 border-t border-line/[0.08]">
          <Button variant="danger" size="sm" className="min-h-11" loading={busy === 'delete'} onClick={removeDraft}>Borrar draft</Button>
        </div>
      )}
    </section>
  );
}

export default YouthDraftAdminSection;
