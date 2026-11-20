import React from 'react';
import { Reveal } from '../../components/landing/Reveal.jsx';
import { SectionHeading } from '../../components/landing/SiteChrome.jsx';
import { SeasonStatsPanel } from '../../components/league/season/SeasonStatsView.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

/* /estadisticas: los mejores jugadores de la temporada en cada estadística, con los datos que graba el PES en cada
   partido oficial (antes era la pestaña /torneo?tab=estadisticas, que ahora redirige acá). */

export default function LeagueStatsScreen() {
  useDocumentTitle('Estadísticas');
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
      <Reveal>
        <SectionHeading as="h1" title="Estadísticas">
          Los mejores de la temporada en goles, asistencias, tiros, pases, quites y más, con los datos del juego de cada partido oficial.
        </SectionHeading>
      </Reveal>
      <SeasonStatsPanel />
    </section>
  );
}
