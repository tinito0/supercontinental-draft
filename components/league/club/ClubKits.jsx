import React, { useState } from 'react';
import { Expand, ImageOff } from 'lucide-react';
import { Tabs, tabPanelProps } from '../../ui/Tabs.jsx';
import { clubKits } from '../../../utils/leagueContent.js';

/* Camisetas del club en su página (titular, suplente, alternativa), las que se suben en Administración → Web
   pública. Una a la vez, grande; con más de una se elige arriba. Cambiar de camiseta
   funde la imagen nueva (.kit-swap, --dur-base). Sin camisetas cargadas no se muestra nada. */

export function ClubKits({ profile, teamName }) {
  const kits = clubKits(profile);
  const [slot, setSlot] = useState(null);
  const [failed, setFailed] = useState(() => new Set());
  if (!kits.length) return null;
  const shown = kits.find(kit => kit.slot === slot) || kits[0];
  const broken = failed.has(shown.url);
  return (
    <section className="panel space-y-3 p-4" aria-labelledby="club-kits">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="club-kits" className="section-title">Camisetas</h2>
        {kits.length > 1 && (
          <Tabs label="Camiseta" nav idPrefix="club-kit-tabs" value={shown.slot} onChange={setSlot}
            tabs={kits.map(kit => ({ id: kit.slot, label: kit.label }))} />
        )}
      </div>
      <div {...(kits.length > 1 ? tabPanelProps('club-kit-tabs', shown.slot) : {})}>
      {broken ? (
        // A dead link (deleted upload, moved file) shows why, instead of the browser's broken-image box.
        <div className="grid aspect-[4/5] w-full place-content-center justify-items-center gap-2 rounded-xl bg-raised px-6 text-center">
          <ImageOff className="h-6 w-6 text-ink-3" aria-hidden="true" />
          <p className="text-sm text-ink-2">No se pudo cargar la camiseta {shown.label.toLowerCase()}.</p>
        </div>
      ) : (
        <a href={shown.url} target="_blank" rel="noopener noreferrer" className="group relative block overflow-hidden rounded-xl bg-raised"
          aria-label={`Camiseta ${shown.label.toLowerCase()} de ${teamName || 'el club'}, en grande, se abre en otra pestaña`}>
          <img key={shown.url} src={shown.url} alt={`Camiseta ${shown.label.toLowerCase()} de ${teamName || 'el club'}`}
            width="800" height="1000" loading="lazy" decoding="async" className="kit-swap aspect-[4/5] w-full object-contain"
            onError={() => setFailed(previous => new Set(previous).add(shown.url))} />
          <span className="absolute bottom-2 right-2 grid h-9 w-9 place-items-center rounded-lg bg-canvas/70 text-ink-2 transition-colors group-hover:text-ink" aria-hidden="true">
            <Expand className="h-4 w-4" />
          </span>
        </a>
      )}
      </div>
      {kits.length === 1 && <p className="text-sm text-ink-2">{shown.label}</p>}
    </section>
  );
}
