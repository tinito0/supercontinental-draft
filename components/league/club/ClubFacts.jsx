import React from 'react';
import { Armchair, Building2, Gamepad2, Palette, Shirt, UserRound } from 'lucide-react';

/* Ficha del club: estadio y quiénes lo manejan. Solo lo que el admin cargó; cada dato es una tarjeta con su etiqueta
   arriba y el valor grande, legible de un vistazo. */

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
    <dl className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
      {facts.map(({ key, label, icon: Icon, value, detail }) => (
        <div key={key} className="flex items-start gap-3 rounded-2xl border border-line/10 bg-surface p-3 sm:p-4">
          <span className="hidden h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-deep text-accent-soft sm:grid" aria-hidden="true">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <dt className="text-sm font-medium text-ink-2">{label}</dt>
            <dd className="mt-0.5 font-display text-lg font-bold sm:text-xl leading-tight text-ink [overflow-wrap:anywhere]">{value}</dd>
            {detail && <dd className="mt-0.5 text-sm text-ink-2">{detail}</dd>}
          </div>
        </div>
      ))}
    </dl>
  );
}

export default ClubFacts;
