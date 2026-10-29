import React, { memo, useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Plug } from 'lucide-react';
import { draftUrl } from '../../../utils/siteRoutes.js';
import { OBS_SCENES, OBS_SOURCES, sceneLabel } from '../../../utils/obsScenes.js';
import { MacroDeckGuide } from '../OverlaySceneControl.jsx';
import { Alert } from '../../ui/Alert.jsx';

/* Cómo se conecta OBS. Una fuente por escena de OBS: la del juego sigue las escenas del partido y las del torneo
   (tabla, copas…) van fijas en su propia escena. utils/obsScenes.js sceneForSource decide qué dibuja cada una. */

const SOURCE_TEXT = {
  partido: { title: 'Escena del juego', desc: 'Va encima del PES. Muestra En partido, Previa, Entretiempo o Final según lo que mandes al aire; si al aire hay una escena del torneo, queda limpia.' },
  general: { title: 'Una sola fuente para todo', desc: 'Muestra cualquier escena que mandes al aire, también la tabla y las copas.' },
};

const sourceTitle = source => SOURCE_TEXT[source.id]?.title || `Fija: ${sceneLabel(source.id)}`;

/** Nombre corto de cada fuente para el editor de escenas («se ve en …»). */
export const sourceShortLabel = id => (id === 'partido' ? 'la fuente del juego' : id === 'general' ? 'la fuente general' : `la fuente fija «${sceneLabel(id)}»`);

const SOURCES = OBS_SOURCES.map(source => ({
  ...source,
  title: sourceTitle(source),
  desc: SOURCE_TEXT[source.id]?.desc || `Siempre «${sceneLabel(source.id)}», sin importar cuál esté al aire. Para su propia escena de OBS.`,
}));
const byId = id => SOURCES.find(source => source.id === id);
const TOURNAMENT_SOURCES = OBS_SCENES.filter(scene => scene.group === 'torneo').map(scene => byId(scene.id));
const OTHER_SOURCES = [byId('general'), ...OBS_SCENES.filter(scene => scene.group === 'partido').map(scene => byId(scene.id))];

function SourceRow({ source, copiedId, onCopy }) {
  const url = draftUrl(source.path);
  const isCopied = copiedId === source.id;
  return (
    <li className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:gap-4">
      <div className="min-w-0 shrink-0 md:w-56">
        <p className={`text-sm font-semibold ${source.id === 'partido' ? 'text-accent-soft' : 'text-ink'}`}>{source.title}</p>
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

  return (
    <section className="panel space-y-4 p-5" aria-labelledby="obs-connection-title">
      <div>
        <h2 id="obs-connection-title" className="section-title flex items-center gap-2.5">
          <Plug className="h-5 w-5 text-accent-soft" aria-hidden="true" /> Conectar OBS
        </h2>
        <p className="mt-1 text-xs text-ink-3">En OBS: fuente «Navegador», 1920×1080. Una fuente por escena de OBS. Si algo falla, la fuente queda transparente y se reintenta sola.</p>
      </div>
      <Alert tone="warning" title="Si la escena del juego usa …/overlay?scene=live">
        Esa fuente queda fija en «En partido»: Previa, Entretiempo y Final nunca se ven. Cambiala por la de abajo.
      </Alert>
      <ul className="divide-y divide-line/10 rounded-xl border border-line/[0.12] bg-raised/40">
        <SourceRow source={byId('partido')} copiedId={copiedId} onCopy={copy} />
      </ul>
      <div className="space-y-2">
        <p className="eyebrow">Escenas del torneo, cada una en su escena de OBS</p>
        <ul className="divide-y divide-line/10 rounded-xl border border-line/[0.12] bg-raised/40">
          {TOURNAMENT_SOURCES.map(source => <SourceRow key={source.id} source={source} copiedId={copiedId} onCopy={copy} />)}
        </ul>
        <p className="text-xs text-ink-3">Las fuentes que ya tenés con los enlaces viejos de la tabla y las copas siguen andando.</p>
      </div>
      <details className="border-t border-line/10 pt-3">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-ink-2">Otras fuentes</summary>
        <ul className="mt-2 divide-y divide-line/10">
          {OTHER_SOURCES.map(source => <SourceRow key={source.id} source={source} copiedId={copiedId} onCopy={copy} />)}
        </ul>
      </details>
      <MacroDeckGuide />
    </section>
  );
});

export default ObsConnection;
