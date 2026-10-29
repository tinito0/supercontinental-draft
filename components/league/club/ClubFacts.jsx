import React from 'react';
import { Armchair, Building2, Gamepad2, Palette, Shirt, UserRound } from 'lucide-react';

/* Ficha del club: estadio y quiénes lo manejan. Solo lo que el admin cargó, en un solo panel: etiqueta arriba y el
   valor grande (docs/DESIGN_SYSTEM.md: peso, no cajas). */

const FACTS = [
  { key: 'stadium', label: 'Estadio', icon: Building2, extra: profile => (profile.capacity ? `${profile.capacity} espectadores` : '') },
  { key: 'coach', label: 'Director técnico', icon: UserRound },
  { key: 'president', label: 'Presidente', icon: Armchair },
  { key: 'manager', label: 'Mánager en la liga', icon: Gamepad2, extra: () => 'Lo maneja cuando juega' },
  { key: 'captain', label: 'Capitán', icon: Shirt },
  { key: 'colors', label: 'Colores', icon: Palette },
];

/** Datos de la ficha que tienen valor, en orden. */
export function clubFacts(profile) {
  if (!profile) return [];
  return FACTS.filter(fact => String(profile[fact.key] || '').trim())
    .map(fact => ({ ...fact, value: profile[fact.key], detail: fact.extra?.(profile) || '' }));
}

export function ClubFacts({ profile }) {
  const facts = clubFacts(profile);
  if (!facts.length) return null;
  return (
    <dl className="panel grid grid-cols-2 gap-x-6 gap-y-5 p-5 sm:p-6 lg:grid-cols-3">
      {facts.map(({ key, label, icon: Icon, value, detail }) => (
        <div key={key} className="min-w-0">
          <dt className="flex items-center gap-1.5 text-sm font-medium text-ink-2">
            <Icon className="h-4 w-4 shrink-0 text-accent-soft" aria-hidden="true" />
            {label}
          </dt>
          <dd className="mt-1 font-display text-xl font-bold leading-tight text-ink [overflow-wrap:anywhere]">{value}</dd>
          {detail && <dd className="text-sm text-ink-2">{detail}</dd>}
        </div>
      ))}
    </dl>
  );
}

export default ClubFacts;
