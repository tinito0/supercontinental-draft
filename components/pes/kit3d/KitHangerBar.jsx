import React, { useEffect, useMemo, useState } from 'react';
import { Check, Download, Loader2, Upload } from 'lucide-react';
import { Button } from '../PesUi.jsx';
import { useLeagueTeams, usePesTeamMap } from '../../../hooks/useLeagueData.js';
import { fetchIsLeagueEditor } from '../../../services/leagueEditorService.js';
import { setClubKit, uploadClubKitImage } from '../../../services/clubKitService.js';
import { KIT_SLOTS } from '../../../utils/leagueContent.js';
import { teamKey } from '../../../utils/competitionRules.js';
import { HANGER_IMAGE } from './hangerRender.js';

/* Debajo del visor 3D: «Imagen en percha» descarga la camiseta en 4K colgada en una percha (hangerRender.js) y, para
   el admin o un editor de la web, la publica en la página del club elegido (titular, suplente o alternativa).
   El club se propone con la tabla equipo del juego → club (config/pesTeamMap) y la camiseta con la carpeta del kit. */

const SLOT_OF_KIT = { p1: 'home', p2: 'away', p3: 'third' };
const PUBLISHER_ROLES = new Set(['super_admin', 'draft_admin']);

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Si este usuario puede publicar en la web: rol del editor PES de admin, o editor de la web (league_editors). */
function useCanPublish(uid, role) {
  const [isEditor, setIsEditor] = useState(false);
  useEffect(() => {
    let alive = true;
    if (!uid || PUBLISHER_ROLES.has(role)) return undefined;
    fetchIsLeagueEditor(uid).then(result => { if (alive) setIsEditor(result); }).catch(() => {});
    return () => { alive = false; };
  }, [uid, role]);
  return PUBLISHER_ROLES.has(role) || isEditor;
}

function PublishRow({ teamId, kit, image }) {
  const { teams } = useLeagueTeams();
  const { data: teamMap } = usePesTeamMap();
  const mapped = useMemo(() => {
    const name = teamMap?.[teamId] || teamMap?.[String(teamId)];
    return name ? teams.find(team => teamKey(team.teamName) === teamKey(name))?.id || '' : '';
  }, [teamMap, teamId, teams]);
  const [clubId, setClubId] = useState('');
  const [slot, setSlot] = useState(SLOT_OF_KIT[String(kit).split('/').pop().toLowerCase()] || 'home');
  const [state, setState] = useState({ busy: false, error: '', done: '' });
  const chosen = clubId || mapped;
  useEffect(() => { setState({ busy: false, error: '', done: '' }); }, [image]);

  const publish = async () => {
    setState({ busy: true, error: '', done: '' });
    try {
      const url = await uploadClubKitImage(chosen, slot, image);
      await setClubKit(chosen, slot, url);
      const club = teams.find(team => team.id === chosen)?.teamName || 'el club';
      setState({ busy: false, error: '', done: `Publicada como camiseta ${KIT_SLOTS.find(([id]) => id === slot)[1].toLowerCase()} de ${club}.` });
    } catch (error) {
      console.error('[KitHangerBar] publish', error);
      const denied = error?.code === 'storage/unauthorized' || error?.code === 'permission-denied';
      setState({ busy: false, error: denied ? 'No tenés permiso para publicar en la web.' : (error?.message || 'No se pudo publicar.'), done: '' });
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-line/10 p-3">
      <p className="text-xs font-semibold text-ink">Publicar en la página del club</p>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <label className="min-w-0">
          <span className="sr-only">Club</span>
          <select className="input min-h-11 sm:min-h-9" value={chosen} onChange={event => setClubId(event.target.value)}>
            <option value="">Elegí el club…</option>
            {teams.map(team => <option key={team.id} value={team.id}>{team.teamName}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Camiseta</span>
          <select className="input min-h-11 sm:min-h-9" value={slot} onChange={event => setSlot(event.target.value)}>
            {KIT_SLOTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <Button onClick={publish} disabled={!chosen || state.busy} className="min-h-11 sm:min-h-9">
          {state.busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Upload className="w-3.5 h-3.5" aria-hidden="true" />}
          {state.busy ? 'Publicando…' : 'Publicar'}
        </Button>
      </div>
      {state.done && <p className="flex items-center gap-1.5 text-[11px] text-success-soft" role="status"><Check className="w-3.5 h-3.5" aria-hidden="true" />{state.done}</p>}
      {state.error && <p className="text-[11px] text-danger-soft" role="alert">{state.error}</p>}
    </div>
  );
}

/**
 * @param {{ teamId: number, kit: string, uid?: string, role?: string, disabled: boolean,
 *   onRender: () => Promise<{ png: Blob, compact: Blob }> }} props onRender: el visor dibuja la imagen (hangerRender.js)
 */
export function KitHangerBar({ teamId, kit, uid, role, disabled, onRender }) {
  const canPublish = useCanPublish(uid, role);
  const [state, setState] = useState({ busy: false, error: null, image: null });
  useEffect(() => { setState({ busy: false, error: null, image: null }); }, [teamId, kit]);
  const make = async () => {
    setState(s => ({ ...s, busy: true, error: null }));
    try {
      const { png, compact } = await onRender();
      download(png, `kit-${teamId}-${String(kit).replace(/[^\w-]+/g, '-')}-percha.png`);
      setState({ busy: false, error: null, image: compact });
    } catch (error) {
      setState({ busy: false, error, image: null });
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="text-[11px] text-ink-3 num">{HANGER_IMAGE.width}×{HANGER_IMAGE.height}</span>
        <Button onClick={make} disabled={disabled || state.busy} className="min-h-11 sm:min-h-9">
          {state.busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Download className="w-3.5 h-3.5" aria-hidden="true" />}
          {state.busy ? 'Generando…' : 'Imagen en percha'}
        </Button>
      </div>
      {state.error && <p className="text-[11px] text-danger-soft text-right" role="alert">No se pudo generar la imagen: {state.error.message}</p>}
      {state.image && canPublish && <PublishRow teamId={teamId} kit={kit} image={state.image} />}
    </div>
  );
}
