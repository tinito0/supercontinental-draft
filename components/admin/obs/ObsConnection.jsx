import React, { memo, useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Plug } from 'lucide-react';
import { draftUrl } from '../../../utils/siteRoutes.js';
import { OBS_SCENES } from '../../../utils/obsScenes.js';
import { MacroDeckGuide } from '../OverlaySceneControl.jsx';

/* Cómo se conecta OBS: una sola fuente que sigue la escena elegida (la recomendada) o fuentes fijas por escena. */

const SOURCES = [
  { id: 'overlay', title: 'Overlay (recomendada)', desc: 'Una sola fuente: muestra la escena que mandes al aire desde acá o desde Macro Deck.', path: '/overlay', recommended: true },
  ...OBS_SCENES.map(scene => ({ id: scene.id, title: scene.label, desc: `Siempre la escena «${scene.label}», sin importar cuál esté al aire.`, path: `/overlay?scene=${scene.id}` })),
];

function SourceRow({ source, copiedId, onCopy }) {
  const url = draftUrl(source.path);
  const isCopied = copiedId === source.id;
  return (
    <li className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:gap-4">
      <div className="min-w-0 shrink-0 md:w-56">
        <p className={`text-sm font-semibold ${source.recommended ? 'text-accent-soft' : 'text-ink'}`}>{source.title}</p>
        <p className="text-xs text-ink-3">{source.desc}</p>
      </div>
      <input readOnly value={url} aria-label={`Enlace de ${source.title}`} onFocus={event => event.target.select()} className="input min-w-0 flex-1 font-mono text-xs" />
      <div className="flex shrink-0 gap-2">
        <button type="button" className={`btn btn-sm min-h-11 ${isCopied ? 'btn-success' : 'btn-secondary'}`} onClick={() => onCopy(source, url)} aria-live="polite">
          {isCopied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          {isCopied ? 'Copiado' : 'Copiar'}
        </button>
        <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm min-h-11" aria-label={`Ver ${source.title} en otra pestaña`}>
          <ExternalLink className="h-4 w-4" aria-hidden="true" /> Ver
        </a>
      </div>
    </li>
  );
}

export const ObsConnection = memo(function ObsConnection({ showStatusMessage }) {
  const [copiedId, setCopiedId] = useState('');
  const timerRef = useRef(null);
  useEffect(() => () => clearTimeout(timerRef.current), []);
  const copy = async (source, url) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(source.id);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopiedId(''), 2000);
    } catch {
      showStatusMessage?.('error', `No se pudo copiar. Enlace: ${url}`);
    }
  };
  const [recommended, ...fixed] = SOURCES;

  return (
    <section className="panel space-y-4 p-5" aria-labelledby="obs-connection-title">
      <div>
        <h3 id="obs-connection-title" className="section-title flex items-center gap-2.5">
          <Plug className="h-5 w-5 text-accent-soft" aria-hidden="true" /> Conectar OBS
        </h3>
        <p className="mt-1 text-xs text-ink-3">En OBS: fuente «Navegador», 1920×1080. Todas las escenas se ajustan solas si la fuente es más chica.</p>
      </div>
      <ul className="divide-y divide-line/10 rounded-xl border border-line/[0.12] bg-raised/40">
        <SourceRow source={recommended} copiedId={copiedId} onCopy={copy} />
      </ul>
      <details className="well px-4 py-3">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-ink-2">Fuentes fijas por escena</summary>
        <ul className="mt-2 divide-y divide-line/10">
          {fixed.map(source => <SourceRow key={source.id} source={source} copiedId={copiedId} onCopy={copy} />)}
        </ul>
      </details>
      <MacroDeckGuide />
    </section>
  );
});

export default ObsConnection;
