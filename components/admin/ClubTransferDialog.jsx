import React, { useMemo, useState } from 'react';
import { UserCog } from 'lucide-react';
import { BaseModal } from '../ui/BaseModal.jsx';
import { Field } from '../ui/Field.jsx';
import { Alert } from '../ui/Alert.jsx';
import { confirmAction } from '../ui/ConfirmDialog.jsx';
import { transferClub } from '../../services/marketService.js';

// Same limit as «Mánager en la liga» on the club card (utils/leagueContent.js) and the server (market.js).
const MANAGER_MAX = 80;

/**
 * «Cambiar manager»: gives an existing club to the pending, empty team of a new manager who just signed in.
 * The move itself runs on the server (supabase/functions/_shared/market.js transferClub), admin only, in one
 * transaction. docs/GUIA_ADMIN_LIGA.md §3 explains the flow.
 */
export function ClubTransferDialog({ target, teams, onClose, onDone, showStatusMessage }) {
  const clubs = useMemo(
    () => teams.filter(team => team.uid !== target.uid && !team.pendingApproval),
    [teams, target.uid],
  );
  const [fromUid, setFromUid] = useState('');
  const [managerName, setManagerName] = useState('');
  const [error, setError] = useState('');
  const [isMoving, setIsMoving] = useState(false);
  const club = clubs.find(team => team.uid === fromUid);

  const handleTransfer = async () => {
    if (!club) {
      setError('Elegí qué club pasa a esta cuenta.');
      return;
    }
    const confirmed = await confirmAction({
      title: `¿Pasar ${club.teamName} a la cuenta nueva?`,
      message: `El manager anterior ya no va a poder entrar a ${club.teamName}. El club sigue igual: plantel, presupuesto, ofertas e historia.`,
      confirmLabel: 'Pasar el club',
      irreversible: true,
    });
    if (!confirmed) return;
    setIsMoving(true);
    setError('');
    try {
      const result = await transferClub({ fromUid: club.uid, toUid: target.uid, managerName: managerName.trim() });
      const players = result?.players ?? 0;
      showStatusMessage('success', `${club.teamName} ya es de la cuenta nueva (${players} ${players === 1 ? 'jugador' : 'jugadores'}).`);
      onDone();
    } catch (err) {
      setError(err?.message || 'No se pudo pasar el club. Reintentá en unos instantes.');
      setIsMoving(false);
    }
  };

  const footer = (
    <>
      <button type="button" onClick={onClose} className="btn btn-ghost" disabled={isMoving}>Cancelar</button>
      <button type="button" onClick={handleTransfer} className="btn btn-primary" disabled={isMoving || !fromUid}
        title={!fromUid ? 'Elegí primero el club' : undefined}>
        {isMoving ? 'Pasando el club…' : 'Pasar el club'}
      </button>
    </>
  );

  return (
    <BaseModal
      isOpen
      onClose={isMoving ? () => {} : onClose}
      title="Cambiar manager"
      subtitle={`Cuenta nueva: ${target.email || target.teamName}`}
      icon={UserCog}
      footer={footer}
      size="lg"
    >
      <div className="space-y-5">
        <p className="text-sm text-ink-2">
          Esta cuenta entró hace poco y está vacía. Elegí el club que va a manejar: pasa entero, con su plantel,
          presupuesto, ofertas, traspasos, formación, historia y ficha de la web, y su lugar en Draft → PES.
        </p>

        <Field label="Club que pasa a esta cuenta" required>
          <select className="select" value={fromUid} onChange={e => { setFromUid(e.target.value); setError(''); }}>
            <option value="">Elegí un club</option>
            {clubs.map(team => (
              <option key={team.uid} value={team.uid}>
                {team.teamName} · {team.playerCount} {team.playerCount === 1 ? 'jugador' : 'jugadores'}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Nombre del manager nuevo" help="Se escribe en la ficha del club, en «Mánager en la liga». Si lo dejás vacío, queda el que estaba.">
          <input type="text" className="input" value={managerName} maxLength={MANAGER_MAX}
            onChange={e => setManagerName(e.target.value)} placeholder="Opcional" autoComplete="off" />
        </Field>

        <div className="border-t border-line/10 pt-4">
          <h3 className="eyebrow eyebrow-strong">No se mueve</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-ink-2 list-disc pl-5">
            <li>Los mensajes del chat y los votos del manager anterior: quedan a su nombre.</li>
            <li>Sus permisos de administrador o del editor PES, si tenía.</li>
          </ul>
          <p className="mt-3 text-sm text-ink-2">
            La cuenta anterior queda bloqueada: si vuelve a entrar ve «Tu club pasó a otro manager» y no se le crea
            un club nuevo.
          </p>
        </div>

        {error && <Alert tone="danger" title="No se pasó el club">{error}</Alert>}
      </div>
    </BaseModal>
  );
}

export default ClubTransferDialog;
