import React, { useEffect, useState } from 'react';
import { UserPlus, Trash2 } from 'lucide-react';
import { Card, Button, ErrorText, ConfirmAction } from './PesUi.jsx';
import { Field } from '../ui/Field.jsx';
import { listPesRoles, setPesRole, removePesRole } from '../../services/pesWorkspaceService.js';
import { ROLE_LABELS } from '../../pes/permissions.js';

const PRESETS = [
  { role: 'kit_manager', label: 'Lusitano' },
  { role: 'kit_manager', label: 'Talleres de Balvanera' },
  { role: 'draft_admin', label: 'Admin del Draft' },
  { role: 'super_admin', label: 'Super Admin' },
];

function SkeletonRows() {
  return (
    <ul className="space-y-2" aria-hidden="true">
      {[0, 1, 2].map(i => <li key={i} className="skeleton h-11" />)}
    </ul>
  );
}

/** Super Admin only: assigns PES roles to existing users of the app. */
export function PesRolesPanel({ actorUid, allTeams = {} }) {
  const [roles, setRoles] = useState(null);
  const [uid, setUid] = useState('');
  const [preset, setPreset] = useState(0);
  const [error, setError] = useState(null);

  const load = () => listPesRoles().then(setRoles).catch(e => { setError(e); setRoles(r => r || []); });
  useEffect(() => { load(); }, []);

  // allTeams is keyed by user id (public team docs use the uid as document id).
  const users = Object.entries(allTeams || {}).map(([id, t]) => ({ uid: id, name: t?.teamName || id }));
  const nameOf = id => users.find(u => u.uid === id)?.name || '';

  const assign = async () => {
    setError(null);
    try {
      if (!uid) throw new Error('Elegí un usuario.');
      const p = PRESETS[preset];
      await setPesRole(uid, { role: p.role, label: p.label, displayName: nameOf(uid) }, actorUid);
      setUid('');
      await load();
    } catch (e) { setError(e); }
  };
  const remove = async id => {
    setError(null);
    try { await removePesRole(id); await load(); } catch (e) { setError(e); }
  };

  return (
    <Card title="Roles del editor PES"
      description="Sin rol, un usuario no ve el editor (sigue usando el mercado y el resto de la app). Los admins de la app son Super Admin automáticamente. Los permisos también se controlan en las reglas de Firestore.">
      <div className="space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Usuario" className="flex-1 min-w-48">
            <select value={uid} onChange={e => setUid(e.target.value)} className="select">
              <option value="">Elegí un usuario…</option>
              {users.map(u => <option key={u.uid} value={u.uid}>{u.name} ({u.uid.slice(0, 6)}…)</option>)}
            </select>
          </Field>
          <Field label="Rol" className="flex-1 min-w-48">
            <select value={preset} onChange={e => setPreset(Number(e.target.value))} className="select">
              {PRESETS.map((p, i) => <option key={p.label} value={i}>{p.label} ({ROLE_LABELS[p.role]})</option>)}
            </select>
          </Field>
          <Button variant="primary" disabled={!uid} title={uid ? undefined : 'Elegí un usuario primero'} onClick={assign}>
            <UserPlus className="w-4 h-4" aria-hidden="true" />Asignar
          </Button>
        </div>
        <p className="text-xs text-ink-3 [&_code]:text-accent-soft">
          Después de cambiar roles, corré <code>node scripts/sync-pes-claims.mjs --apply</code> para que Supabase (texturas) reconozca el rol.
        </p>
        <ErrorText error={error} />

        {roles == null ? <SkeletonRows /> : roles.length === 0 ? (
          <p className="text-sm text-ink-3">Nadie tiene rol todavía. Elegí un usuario y un rol arriba.</p>
        ) : (
          <ul className="border-t border-line/[0.08]">
            {roles.map(r => {
              const who = r.displayName || nameOf(r.uid);
              return (
                <li key={r.uid} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 border-b border-line/[0.07]">
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="flex flex-wrap items-center gap-x-2 text-sm">
                      <span className="font-semibold text-ink">{r.label}</span>
                      <span className="text-xs text-ink-3">{ROLE_LABELS[r.role] || r.role}</span>
                    </p>
                    <p className="text-xs text-ink-3 break-all">{who ? `${who} · ` : ''}<span className="num">{r.uid}</span></p>
                  </div>
                  {r.uid !== actorUid && (
                    <ConfirmAction iconOnly icon={Trash2} label={`Quitar el rol a ${who || r.uid}`} title="Quitar el rol" confirmLabel="Sí, quitar"
                      question={`¿Quitarle el rol del editor PES a ${who || r.uid}? Deja de ver el editor.`}
                      onConfirm={() => remove(r.uid)} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
