import React, { useEffect, useState } from 'react';
import { UserPlus, Trash2 } from 'lucide-react';
import { Card, Button, Pill, ErrorText } from './PesUi.jsx';
import { listPesRoles, setPesRole, removePesRole } from '../../services/pesWorkspaceService.js';
import { ROLE_LABELS } from '../../pes/permissions.js';

const PRESETS = [
  { role: 'kit_manager', label: 'Lusitano' },
  { role: 'kit_manager', label: 'Talleres de Balvanera' },
  { role: 'draft_admin', label: 'Admin del Draft' },
  { role: 'super_admin', label: 'Super Admin' },
];

/** Super Admin only: assigns PES roles to existing users of the app. */
export function PesRolesPanel({ actorUid, allTeams = {} }) {
  const [roles, setRoles] = useState([]);
  const [uid, setUid] = useState('');
  const [preset, setPreset] = useState(0);
  const [error, setError] = useState(null);

  const load = () => listPesRoles().then(setRoles).catch(setError);
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
    if (!window.confirm(`¿Quitarle el rol del editor PES a ${nameOf(id) || id}? Deja de ver el editor.`)) return;
    setError(null);
    try { await removePesRole(id); await load(); } catch (e) { setError(e); }
  };

  return (
    <Card title="Roles del editor PES">
      <p className="text-xs text-ink-3 mb-3 [&_code]:text-accent-soft">
        Sin rol, un usuario no ve el editor (sigue usando el mercado y el resto de la app). Los admins actuales de la app son Super Admin automáticamente. Los permisos se controlan también en las reglas de Firestore. Después de cambiar roles, corré <code>node scripts/sync-pes-claims.mjs --apply</code> para que Supabase (texturas) reconozca el rol.
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        <select value={uid} onChange={e => setUid(e.target.value)} aria-label="Usuario" className="select min-h-9 min-w-48">
          <option value="">Elegí un usuario…</option>
          {users.map(u => <option key={u.uid} value={u.uid}>{u.name} ({u.uid.slice(0, 6)}…)</option>)}
        </select>
        <select value={preset} onChange={e => setPreset(Number(e.target.value))} aria-label="Rol" className="select min-h-9">
          {PRESETS.map((p, i) => <option key={p.label} value={i}>{p.label} — {ROLE_LABELS[p.role]}</option>)}
        </select>
        <Button variant="primary" onClick={assign}><UserPlus className="w-3.5 h-3.5" />Asignar</Button>
      </div>
      <ul className="space-y-1">
        {roles.map(r => (
          <li key={r.uid} className="flex items-center gap-2 text-xs text-ink-2">
            <Pill tone={r.role === 'super_admin' ? 'red' : r.role === 'kit_manager' ? 'cyan' : 'slate'}>{ROLE_LABELS[r.role] || r.role}</Pill>
            <span className="font-bold">{r.label}</span>
            <span className="text-ink-3">{r.displayName || nameOf(r.uid)} · {r.uid}</span>
            {r.uid !== actorUid && <Button className="ml-auto" variant="danger" onClick={() => remove(r.uid)} aria-label={`Quitar el rol a ${r.displayName || nameOf(r.uid) || r.uid}`}><Trash2 className="w-3 h-3" aria-hidden="true" /></Button>}
          </li>
        ))}
      </ul>
      <ErrorText error={error} />
    </Card>
  );
}
