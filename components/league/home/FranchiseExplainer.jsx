import React from 'react';
import { FRANCHISE_MIN_AGE, FRANCHISE_MIN_OVR, FRANCHISE_MAX_OVR } from '../../../supabase/functions/_shared/marketConstants.js';

/* Qué es el Jugador Franquicia, contado como la regla propia de la liga. Cada dato repite una regla que el mercado
   aplica (supabase/functions/_shared/market.js, franchise.js, budget.js; utils/seasonReset.js): si cambia una
   constante, cambia el texto. Las cifras grandes en lavanda son la marca de la competición (docs/DESIGN_SYSTEM.md). */

const FACTS = [
  {
    figure: '1',
    label: 'por club y por temporada',
    text: 'Cada mánager elige uno solo. Con la temporada nueva, el cupo vuelve.',
  },
  {
    figure: `${FRANCHISE_MIN_AGE}+`,
    label: `años, OVR ${FRANCHISE_MIN_OVR} a ${FRANCHISE_MAX_OVR}`,
    text: `Un jugador con recorrido y jerarquía. Las figuras de más de ${FRANCHISE_MAX_OVR} quedan afuera.`,
  },
  {
    figure: '$0',
    label: 'de presupuesto',
    text: 'Se ficha gratis: no descuenta nada de la plata del club.',
  },
  {
    figure: 'Fijo',
    label: 'toda la temporada',
    text: 'No se vende, no se transfiere y no se libera. Es la cara del club.',
  },
];

export function FranchiseExplainer({ headingId }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12">
      <div className="max-w-[46ch]">
        <p className="eyebrow text-crest-soft">La regla de la casa</p>
        <h2 id={headingId} className="mt-3 font-display text-4xl font-bold uppercase leading-[0.95] tracking-tight text-ink [text-wrap:balance] md:text-5xl">
          Jugadores franquicia
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-ink-2 [text-wrap:pretty]">
          Lo que hace distinta a esta liga. Cada club elige a su referente: un jugador que
          se queda toda la temporada y que nadie le puede sacar.
        </p>
        <p className="mt-3 text-base leading-relaxed text-ink-2 [text-wrap:pretty]">
          Se ficha en el <strong className="font-semibold text-ink">Mercado Franquicia</strong>, una ventana en la que
          solo se puede elegir a él.
        </p>
      </div>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
        {FACTS.map(fact => (
          <div key={fact.label} className="border-t-2 border-crest/60 pt-4">
            <dt>
              <span className="block font-display text-5xl font-bold leading-none text-crest-soft num">{fact.figure}</span>
              <span className="mt-2 block text-sm font-semibold text-ink">{fact.label}</span>
            </dt>
            <dd className="mt-1.5 text-sm leading-relaxed text-ink-2">{fact.text}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default FranchiseExplainer;
