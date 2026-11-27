import React, { memo, useEffect, useState } from 'react';
import { Check, Copy, MonitorPlay } from 'lucide-react';
import { draftUrl } from '../../../utils/siteRoutes.js';
import { DEFAULT_OBS_SCENE_NAMES } from '../../../utils/obsAutoScene.js';

/* Automatic scenes and the remote control of OBS: match-feed moves the overlay (En partido at kickoff, Final at the
   end, Tabla two minutes later) and the control source (?control=obs) switches the real OBS scene to match.
   Settings live in the overlay doc: autoScenes and obsScenes (utils/obsAutoScene.js). */

const SCENE_FIELDS = [
  ['partido', 'Escena del juego', 'En partido, Previa, Entretiempo y Final'],
  ['tabla', 'Tabla', 'Entre partidos, dos minutos después del final'],
  ['partidos', 'Fecha', ''],
  ['bracket', 'Copa de Oro', ''],
  ['repechaje', 'Copa de Plata', ''],
  ['goleadores', 'Goleadores', ''],
  ['jugador1', 'Cámara Jugador 1', 'El local del partido'],
  ['jugador2', 'Cámara Jugador 2', 'El visitante'],
  ['relator', 'Cámara Relator', 'En el Final: Jugador 1, Jugador 2 y queda el relator (12 s cada una)'],
];

const STEPS = [
  'En OBS, en cualquier escena, agregá una fuente «Navegador» con el link de abajo (puede quedar oculta o fuera de cuadro).',
  'En las propiedades de esa fuente, «Permisos de página»: «Acceso avanzado a OBS». Sin eso no puede cambiar escenas.',
  'Dejá destildado «Apagar la fuente cuando no esté visible», así sigue funcionando en cualquier escena.',
  'Poné a las escenas de OBS los nombres de la lista, o escribí acá los que ya usás.',
  'Agregá la fuente «Escena del juego» también a las escenas de las cámaras, así la tira y el lower third se ven en todas.',
];

export const ObsRemoteControl = memo(function ObsRemoteControl({ overlay, onSave }) {
  const [names, setNames] = useState(() => ({ ...DEFAULT_OBS_SCENE_NAMES, ...(overlay?.obsScenes || {}) }));
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setNames({ ...DEFAULT_OBS_SCENE_NAMES, ...(overlay?.obsScenes || {}) }); }, [overlay?.obsScenes]);
  const autoScenes = overlay?.autoScenes !== false;
  const url = draftUrl('/overlay?control=obs');
  const saved = { ...DEFAULT_OBS_SCENE_NAMES, ...(overlay?.obsScenes || {}) };
  const isDirty = SCENE_FIELDS.some(([id]) => (names[id] || '').trim() !== (saved[id] || '').trim());

  const save = async () => {
    setSaving(true);
    const clean = Object.fromEntries(SCENE_FIELDS.map(([id]) => [id, (names[id] || '').trim() || DEFAULT_OBS_SCENE_NAMES[id]]));
    await onSave({ obsScenes: clean }, 'Nombres de escenas guardados.');
    setSaving(false);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* the field stays selectable */ }
  };

  return (
    <section className="panel space-y-4 p-5" aria-labelledby="obs-remote-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="obs-remote-title" className="section-title flex items-center gap-2.5">
            <MonitorPlay className="h-5 w-5 text-accent-soft" aria-hidden="true" /> Escenas automáticas
          </h2>
          <p className="mt-1 max-w-[70ch] text-sm text-ink-2">
            Al arrancar un partido pasa a «En partido»; al terminar, a «Final» con el siguiente partido en el lower third, y a los dos minutos a «Tabla». Con la fuente de control, OBS cambia de escena solo, estés donde estés.
          </p>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-ink">
          <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--c-accent))]" checked={autoScenes}
            onChange={event => onSave({ autoScenes: event.target.checked }, event.target.checked ? 'Escenas automáticas activadas.' : 'Escenas automáticas apagadas.')} />
          Automáticas
        </label>
      </div>

      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-2 marker:text-ink-3">
        {STEPS.map(step => <li key={step}>{step}</li>)}
      </ol>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input readOnly value={url} aria-label="Link de la fuente de control" onFocus={event => event.target.select()} className="input min-w-0 flex-1 font-mono text-xs" />
        <button type="button" className={`btn btn-sm min-h-11 ${copied ? 'btn-success' : 'btn-secondary'}`} onClick={copy} aria-live="polite">
          {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />} {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>

      <div className="space-y-3 border-t border-line/10 pt-4">
        <h3 className="text-sm font-semibold text-ink">Nombres de tus escenas en OBS</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {SCENE_FIELDS.map(([id, label, hint]) => (
            <label key={id} className="block space-y-1">
              <span className="text-sm font-medium text-ink">{label}</span>
              {hint && <span className="block text-xs text-ink-3">{hint}</span>}
              <input className="input" value={names[id] || ''} maxLength={60} onChange={event => setNames(prev => ({ ...prev, [id]: event.target.value }))} />
            </label>
          ))}
        </div>
        <div className="flex justify-end">
          <button type="button" className="btn btn-primary min-h-11" disabled={!isDirty || saving} onClick={save}>
            {saving ? 'Guardando…' : 'Guardar nombres'}
          </button>
        </div>
      </div>
    </section>
  );
});

export default ObsRemoteControl;
