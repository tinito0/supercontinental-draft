import React, { useState } from 'react';
import { Expand } from 'lucide-react';
import { Tabs } from '../../ui/Tabs.jsx';
import { clubKits } from '../../../utils/leagueContent.js';

/* Camisetas del club en su página (titular, suplente, alternativa), las que se suben en Administración → Web
   pública. Una a la vez, grande; con más de una se elige arriba. Cambiar de camiseta
   funde la imagen nueva (.kit-swap, --dur-base). Sin camisetas cargadas no se muestra nada. */

export function ClubKits({ profile, teamName }) {
  const kits = clubKits(profile);
  const [slot, setSlot] = useState(null);
  if (!kits.length) return null;
  const shown = kits.find(kit => kit.slot === slot) || kits[0];
  return (
    <section className="panel space-y-3 p-4" aria-labelledby="club-kits">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="club-kits" className="section-title">Camisetas</h2>
        {kits.length > 1 && (
          <Tabs label="Camiseta" value={shown.slot} onChange={setSlot}
            tabs={kits.map(kit => ({ id: kit.slot, label: kit.label }))} />
        )}
      </div>
      <a href={shown.url} target="_blank" rel="noopener noreferrer" className="group relative block overflow-hidden rounded-xl bg-raised"
        aria-label={`Camiseta ${shown.label.toLowerCase()} de ${teamName || 'el club'}, en grande`}>
        <img key={shown.url} src={shown.url} alt={`Camiseta ${shown.label.toLowerCase()} de ${teamName || 'el club'}`}
          width="800" height="1000" loading="lazy" decoding="async" className="kit-swap aspect-[4/5] w-full object-contain" />
        <span className="absolute bottom-2 right-2 grid h-9 w-9 place-items-center rounded-lg bg-canvas/70 text-ink-2 transition-colors group-hover:text-ink" aria-hidden="true">
          <Expand className="h-4 w-4" />
        </span>
      </a>
      {kits.length === 1 && <p className="text-sm text-ink-2">{shown.label}</p>}
    </section>
  );
}
