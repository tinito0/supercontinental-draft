import React, { useEffect, useRef, useState } from 'react';
import { ImageOff, Loader2, Shirt, Trash2, Upload } from 'lucide-react';
import { KIT_SLOTS, MAX_PHOTO_URL_LENGTH, cleanPhotoUrl } from '../../utils/leagueContent.js';
import { uploadClubKitImage } from '../../services/leagueMediaService.js';

/* Administración → Web pública → Clubes: las camisetas que muestra la página del club (titular, suplente y
   alternativa). Cada una es una imagen: se sube desde la compu o el celular, o se pega un link. */

function KitPreview({ url }) {
  const clean = cleanPhotoUrl(url);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [clean]);
  if (!url) {
    return (
      <span className="grid aspect-[4/5] w-full place-items-center rounded-lg border border-dashed border-line/30 bg-raised text-ink-3">
        <Shirt className="h-8 w-8" aria-hidden="true" />
      </span>
    );
  }
  if (clean === null || failed) {
    return (
      <span className="grid aspect-[4/5] w-full place-items-center rounded-lg bg-raised p-3 text-center text-xs text-warning-soft">
        <span><ImageOff className="mx-auto mb-1 h-5 w-5" aria-hidden="true" />{clean === null ? 'Tiene que ser un link https://' : 'No se pudo abrir la imagen'}</span>
      </span>
    );
  }
  return <img src={clean} alt="" className="aspect-[4/5] w-full rounded-lg bg-raised object-contain" onError={() => setFailed(true)} />;
}

function KitSlot({ teamId, slot, label, url, onChange }) {
  const inputRef = useRef(null);
  const [state, setState] = useState({ busy: false, error: '', note: '' });
  const upload = async file => {
    if (!file) return;
    setState({ busy: true, error: '', note: '' });
    try {
      const link = await uploadClubKitImage(teamId, slot, file);
      onChange(link);
      setState({ busy: false, error: '', note: 'Imagen subida. Guardá para publicarla.' });
    } catch (error) {
      console.error('[ClubKitsEditor] upload', error);
      setState({ busy: false, error: error?.message || 'No se pudo subir la imagen.', note: '' });
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };
  const fieldId = `kit-${slot}-url`;
  return (
    <div className="min-w-0 space-y-2">
      <p className="text-sm font-semibold text-ink">{label}</p>
      <KitPreview url={url} />
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" id={`kit-${slot}-file`}
        onChange={event => upload(event.target.files?.[0])} />
      <div className="flex gap-2">
        <label htmlFor={`kit-${slot}-file`} className={`btn btn-secondary min-h-11 flex-1 ${state.busy ? 'pointer-events-none opacity-60' : ''}`}>
          {state.busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
          {state.busy ? 'Subiendo…' : 'Subir imagen'}
        </label>
        {url && (
          <button type="button" className="btn btn-ghost min-h-11 min-w-11 px-3" onClick={() => onChange('')} aria-label={`Sacar la camiseta ${label.toLowerCase()}`}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <label htmlFor={fieldId} className="sr-only">Link de la camiseta {label.toLowerCase()}</label>
      <input id={fieldId} className="input" type="url" inputMode="url" value={url} maxLength={MAX_PHOTO_URL_LENGTH}
        placeholder="o pegá un link https://…" onChange={event => onChange(event.target.value)} />
      {state.note && <p className="text-xs text-success-soft" role="status">{state.note}</p>}
      {state.error && <p className="text-xs text-danger-soft" role="alert">{state.error}</p>}
    </div>
  );
}

/**
 * @param {{ teamId: string, kits: Record<string, string>, onChange: (slot: string, url: string) => void }} props
 */
export function ClubKitsEditor({ teamId, kits, onChange }) {
  return (
    <fieldset className="space-y-3">
      <legend className="section-title">Camisetas</legend>
      <p className="text-sm text-ink-2">
        Se muestran en la página del club. Subí una imagen (PNG, JPG o WEBP, hasta 12 MB) o pegá un link.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {KIT_SLOTS.map(([slot, label]) => (
          <KitSlot key={slot} teamId={teamId} slot={slot} label={label} url={kits?.[slot] || ''} onChange={url => onChange(slot, url)} />
        ))}
      </div>
    </fieldset>
  );
}
