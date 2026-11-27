import React, { useMemo, useState } from 'react';
import { UserRound } from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { confirmAction } from '../ui/ConfirmDialog.jsx';
import { getPosColorClass, getStatAndOvrColorClass } from '../../utils/helpers.js';
import { nextTeamToPick } from '../../utils/youthDraft.js';
import { pickYouthDraft } from '../../services/marketService.js';

function ProspectPhoto({ id, name }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className="w-12 h-12 rounded-lg bg-raised text-ink-3 flex items-center justify-center shrink-0" aria-hidden="true">
        <UserRound className="w-6 h-6" />
      </span>
    );
  }
  return (
    <img src={`/fotos_jugadores/${id}.webp`} alt={`Foto de ${name}`} width={48} height={48} loading="lazy" decoding="async"
      onError={() => setFailed(true)} className="w-12 h-12 rounded-lg object-cover object-top bg-raised shrink-0" />
  );
}

/** The line that says what the manager can do now. */
function turnLine({ draft, userId, myPick, teamName }) {
  if (myPick) return <>Tu promesa: <strong className="text-ink font-semibold">{myPick.name}</strong>.</>;
  if (draft.turnTeamId === userId) return <strong className="text-accent-soft font-semibold">Es tu turno: elegí una promesa.</strong>;
  if (draft.turnTeamId) return <>Elige <strong className="text-ink font-semibold">{teamName(draft.turnTeamId)}</strong>.</>;
  return 'Esperando que el administrador abra el próximo turno.';
}

/**
 * Draft de promesas in the marketplace: the published pool with the sheets the admin edited, who picked whom, and
 * «Elegir» only for the club whose turn is open. The pick runs on the server (market.js pickYouthDraft). Hidden when
 * there is no pool or every club of the order already picked.
 */
export function YouthDraftPanel({ draft, playerById, userId, allTeams, onSelectPlayer, showStatusMessage }) {
  const [pendingId, setPendingId] = useState(null);
  const pool = Array.isArray(draft?.pool) ? draft.pool : [];
  const picks = draft?.picks && typeof draft.picks === 'object' ? draft.picks : {};
  const pickedBy = useMemo(() => new Map(Object.entries(picks).map(([teamId, playerId]) => [String(playerId), teamId])), [picks]);
  const rows = useMemo(() => [...pool].sort((a, b) => (Number(b.ovr) || 0) - (Number(a.ovr) || 0)), [pool]);

  const order = Array.isArray(draft?.order) ? draft.order : [];
  const isFinished = order.length > 0 && !draft?.turnTeamId && nextTeamToPick(draft) === null;
  if (!pool.length || isFinished) return null;

  const teamName = teamId => allTeams?.[teamId]?.teamName || 'Otro club';
  const myPickId = userId ? picks[userId] : undefined;
  const myPick = myPickId !== undefined ? pool.find(entry => String(entry.id) === String(myPickId)) : null;
  const canPick = Boolean(userId) && draft.turnTeamId === userId && myPickId === undefined;

  const handlePick = async (entry) => {
    const isConfirmed = await confirmAction({
      title: `¿Elegir a ${entry.name}?`,
      message: 'Pasa a tu plantel sin costo. Las promesas no se venden ni se liberan.',
      player: { Id: entry.id, Name: entry.name, POS_NOMBRE: entry.position, OVR_CALCULADO: entry.ovr },
      confirmLabel: 'Elegir promesa',
      tone: 'primary',
    });
    if (!isConfirmed) return;
    setPendingId(entry.id);
    try {
      await pickYouthDraft({ playerId: entry.id });
      showStatusMessage?.('success', `${entry.name} es tu promesa.`);
    } catch (error) {
      showStatusMessage?.('error', error?.message || 'No se pudo elegir la promesa. Reintentá.');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <section aria-labelledby="youth-draft-title" className="mb-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="youth-draft-title" className="section-title">Draft de promesas</h2>
        <p className="text-xs text-ink-3"><span className="num">{Object.keys(picks).length}</span> de <span className="num">{order.length || '—'}</span> clubes eligieron</p>
      </div>
      <p className="mt-1 text-sm text-ink-2" role="status">{turnLine({ draft, userId, myPick, teamName })}</p>

      <ul className="mt-3 grid gap-x-6 sm:grid-cols-2 xl:grid-cols-3 border-t border-line/[0.08]">
        {rows.map(entry => {
          const owner = pickedBy.get(String(entry.id));
          const player = playerById?.get(String(entry.id));
          return (
            <li key={entry.id} className="flex items-center gap-3 py-2.5 border-b border-line/[0.08] min-w-0">
              <ProspectPhoto id={entry.id} name={entry.name} />
              <button type="button" onClick={() => onSelectPlayer?.(player || entry.id)}
                className="min-w-0 flex-1 text-left min-h-11 rounded-md focus-visible:ring-2 focus-visible:ring-accent-soft">
                <span className="flex items-center gap-2 min-w-0">
                  <span className={`px-1.5 py-0.5 rounded-md text-[11px] font-bold shrink-0 ${getPosColorClass(entry.position)}`}>{entry.position}</span>
                  <span className="font-semibold text-ink truncate">{entry.name}</span>
                </span>
                <span className="block mt-0.5 text-xs text-ink-3">
                  <span className="num">{entry.age}</span> años · media original <span className="num">{entry.originalOvr}</span>
                  {owner && <> · {owner === userId ? 'tu promesa' : teamName(owner)}</>}
                </span>
              </button>
              <span className={`min-w-10 h-10 px-1 rounded-lg flex items-center justify-center font-display num text-lg font-bold shrink-0 ${getStatAndOvrColorClass(entry.ovr)}`}
                title="Media con la ficha editada">{entry.ovr}</span>
              {canPick && !owner && (
                <Button variant="primary" size="sm" className="min-h-11 shrink-0" loading={pendingId === entry.id}
                  disabled={pendingId !== null} onClick={() => handlePick(entry)}>
                  Elegir
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default YouthDraftPanel;
