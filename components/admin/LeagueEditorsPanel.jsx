import React, { memo, useEffect, useMemo, useState } from 'react';
import { PenLine, UserMinus, UserPlus } from 'lucide-react';
import { auth } from '../../config/firebase.js';
import { Field } from '../ui/Field.jsx';
import { Alert } from '../ui/Alert.jsx';
import { isTeamApproved } from '../../supabase/functions/_shared/membership.js';
import { grantLeagueEditor, revokeLeagueEditor, subscribeLeagueEditors } from '../../services/leagueEditorService.js';
import { confirmAction } from '../ui/ConfirmDialog.jsx';

/* Administración → Web pública (solo admin): quién más puede editar los textos de la web. Un editor entra a
   /draft/admin y ve únicamente esta sección; firestore.rules no le dejan tocar nada más. */

export const LeagueEditorsPanel = memo(function LeagueEditorsPanel({ allTeams, showStatusMessage }) {
  const [editors, setEditors] = useState(null);
  const [error, setError] = useState('');
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => subscribeLeagueEditors(
    list => { setEditors(list); setError(''); },
    err => { console.error('[LeagueEditorsPanel]', err); setError('No se pudo leer la lista de editores.'); },
  ), []);

  const editorIds = useMemo(() => new Set((editors || []).map(editor => editor.uid)), [editors]);
  const candidates = useMemo(() => Object.entries(allTeams || {})
    .map(([uid, team]) => ({ uid, teamName: String(team?.teamName || '').trim(), approved: isTeamApproved(team) }))
    .filter(team => team.teamName && team.approved && !editorIds.has(team.uid))
    .sort((a, b) => a.teamName.localeCompare(b.teamName, 'es')), [allTeams, editorIds]);

  const run = async (key, action, success) => {
    setBusy(key);
    try {
      await action();
      showStatusMessage?.('success', success);
      return true;
    } catch (err) {
      console.error('[LeagueEditorsPanel]', err);
      showStatusMessage?.('error', 'No se pudo guardar el cambio de permisos. Probá de nuevo.');
      return false;
    } finally {
      setBusy('');
    }
  };

  const grant = async () => {
    const team = candidates.find(item => item.uid === choice);
    if (!team) return;
    const ok = await run(team.uid, () => grantLeagueEditor(team.uid, team.teamName, auth?.currentUser?.uid), `${team.teamName} ya puede editar la web pública.`);
    if (ok) setChoice('');
  };

  const revoke = async editor => {
    const name = editor.teamName || allTeams?.[editor.uid]?.teamName || 'Este manager';
    const isConfirmed = await confirmAction({
      title: `¿Quitarle a ${name} el permiso de edición?`,
      message: 'Deja de poder editar los textos de la web pública. Se lo podés volver a dar cuando quieras.',
      confirmLabel: 'Quitar permiso',
    });
    if (!isConfirmed) return;
    run(editor.uid, () => revokeLeagueEditor(editor.uid), `${name} ya no edita la web pública.`);
  };

  return (
    <div className="well space-y-3 p-4" aria-labelledby="league-editors-title">
      <div>
        <h3 id="league-editors-title" className="flex items-center gap-2 text-sm font-semibold text-ink">
          <PenLine className="h-4 w-4 text-accent-soft" aria-hidden="true" /> Editores de la web
        </h3>
        <p className="mt-1 text-xs text-ink-3">
          Managers que pueden editar estos textos sin ser admin. Entran por Administración y ven solo esta sección: no pueden tocar el mercado, el torneo ni la transmisión.
        </p>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      {editors === null && !error ? (
        <div className="skeleton h-11 rounded-lg" aria-label="Cargando editores" />
      ) : (
        <ul className="space-y-2">
          {(editors || []).length === 0 && <li className="text-xs text-ink-3">Por ahora solo el admin edita la web.</li>}
          {(editors || []).map(editor => (
            <li key={editor.uid} className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-3">
              <span className="truncate text-sm text-ink">{allTeams?.[editor.uid]?.teamName || editor.teamName || editor.uid}</span>
              <button type="button" className="btn btn-ghost btn-sm min-h-11" disabled={Boolean(busy)} onClick={() => revoke(editor)}>
                <UserMinus className="h-4 w-4" aria-hidden="true" /> {busy === editor.uid ? 'Quitando…' : 'Quitar'}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Field label="Sumar editor" className="flex-1">
          <select className="select" value={choice} onChange={event => setChoice(event.target.value)} disabled={!candidates.length}>
            <option value="">{candidates.length ? 'Elegí el club de su manager…' : 'No quedan clubes aprobados para sumar'}</option>
            {candidates.map(team => <option key={team.uid} value={team.uid}>{team.teamName}</option>)}
          </select>
        </Field>
        <button type="button" className="btn btn-secondary min-h-11" disabled={!choice || Boolean(busy)} onClick={grant}>
          <UserPlus className="h-4 w-4" aria-hidden="true" /> {busy && busy === choice ? 'Guardando…' : 'Dar permiso'}
        </button>
      </div>
    </div>
  );
});

export default LeagueEditorsPanel;
