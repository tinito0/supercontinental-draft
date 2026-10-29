import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/Button.jsx';
import { APP_NAME } from '../utils/constants.js';
import { Reveal } from '../components/landing/Reveal.jsx';
import { PlatformDemo } from '../components/landing/PlatformDemo.jsx';
import { PlayerMarquee } from '../components/landing/PlayerMarquee.jsx';
import { FollowLeague } from '../components/landing/FollowLeague.jsx';
import { MARKET_PLAYER_COUNT_LABEL } from '../components/landing/sampleData.js';
import { LEAGUE_NAME } from '../components/landing/leagueLinks.js';
import { RuleGroups } from '../components/landing/RuleGroups.jsx';
import { SectionHeading, SiteBrand, SiteFooter, SiteNav } from '../components/landing/SiteChrome.jsx';

/* One label for the one action of the page, used in the nav, the hero and the closing call. */
const ENTER_LABEL = 'Ingresar';
/* The full name does not fit next to the button at 360px. */
const SHORT_APP_NAME = 'SCL Draft';

const NAV_LINKS = [
  { href: '#plataforma', label: 'Plataforma' },
  { href: '#reglamento', label: 'Reglamento' },
  { href: '#seguinos', label: 'Seguinos' },
];

function LandingNav({ onEnter }) {
  return (
    <SiteNav
      brand={(
        <a href="#inicio" className="flex min-w-0 items-center gap-2.5">
          <SiteBrand shortName={SHORT_APP_NAME} name={APP_NAME} />
        </a>
      )}
    >
      <ul className="hidden items-center gap-1 md:flex">
        {NAV_LINKS.map(link => (
          <li key={link.href}>
            <a href={link.href} className="rounded-lg px-3 py-2 text-sm font-medium text-ink-2 transition-colors hover:text-ink">{link.label}</a>
          </li>
        ))}
      </ul>
      <Button variant="primary" onClick={onEnter} iconRight={ChevronRight}>{ENTER_LABEL}</Button>
    </SiteNav>
  );
}

function Hero({ onEnter }) {
  return (
    <section id="inicio" aria-labelledby="hero-title" className="overflow-hidden pt-16">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 md:min-h-[calc(100dvh-4rem)] md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] md:py-20">
        <div className="landing-enter">
          <p className="eyebrow mb-4 text-accent-soft">{LEAGUE_NAME}</p>
          <h1 id="hero-title" className="font-display text-[2.6rem] font-bold uppercase leading-[0.95] tracking-tight text-ink sm:text-6xl lg:text-7xl">
            Armá tu plantel. Ganá la Supercontinental.
          </h1>
          <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-ink-2">
            Mercado en tiempo real, pizarra táctica y exportación a PES 2021, para una liga hecha para jugar entre amigos.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="primary" size="lg" onClick={onEnter} iconRight={ChevronRight}>{ENTER_LABEL}</Button>
            <a href="#plataforma" className="btn btn-secondary btn-lg">Ver la plataforma</a>
          </div>
        </div>
        <div className="flex justify-center md:justify-end">
          <img
            src="/landing/crest.webp"
            alt={`Escudo de la ${LEAGUE_NAME}`}
            width="560"
            height="568"
            fetchpriority="high"
            className="landing-crest w-48 sm:w-64 md:w-full md:max-w-[420px]"
          />
        </div>
      </div>
    </section>
  );
}

export function LandingPage({ onEnter }) {
  return (
    <div className="landing-root min-h-[100dvh] overflow-x-hidden bg-canvas font-sans text-ink">
      <LandingNav onEnter={onEnter} />

      <main>
        <Hero onEnter={onEnter} />

        <section aria-labelledby="plataforma" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 md:py-24">
          <Reveal>
            <SectionHeading id="plataforma" title="La plataforma, por dentro">
              Probá una versión de muestra de las herramientas que usa cada manager.
            </SectionHeading>
          </Reveal>
          <Reveal delay={100}>
            <PlatformDemo />
          </Reveal>
          <p className="mt-5 text-sm text-ink-3">También incluye overlays para transmitir en OBS y un scout para encontrar reemplazos.</p>
        </section>

        <section aria-labelledby="figuras" className="py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal>
              <SectionHeading id="figuras" title="Figuras del mercado">
                {MARKET_PLAYER_COUNT_LABEL} jugadores con valoración, posición y precio, tomados de la base de datos de PES 2021.
              </SectionHeading>
            </Reveal>
          </div>
          <PlayerMarquee />
        </section>

        <section aria-labelledby="reglamento" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 md:py-24">
          <Reveal>
            <SectionHeading id="reglamento" title="Reglamento del draft">
              Las reglas que mantienen la liga pareja. El servidor las aplica en cada fichaje.
            </SectionHeading>
          </Reveal>
          <RuleGroups />
        </section>

        <section aria-labelledby="seguinos" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 md:py-24">
          <Reveal>
            <SectionHeading id="seguinos" title="Seguí la liga">
              Partidos en vivo, videos y novedades de la {LEAGUE_NAME}.
            </SectionHeading>
          </Reveal>
          <Reveal delay={100}>
            <FollowLeague />
          </Reveal>
        </section>

        <section aria-labelledby="cierre" className="border-t border-line/10">
          <Reveal className="mx-auto flex max-w-2xl flex-col items-center px-4 py-20 text-center sm:px-6 md:py-28">
            <img src="/landing/crest.webp" alt="" width="72" height="72" loading="lazy" className="mb-6 h-[72px] w-[72px]" />
            <h2 id="cierre" className="font-display text-3xl font-bold uppercase leading-none text-ink md:text-5xl">¿Listo para armar tu plantel?</h2>
            <p className="mt-4 text-lg text-ink-2">Entrá con tu cuenta y competí en la Supercontinental.</p>
            <Button variant="primary" size="lg" onClick={onEnter} iconRight={ChevronRight} className="mt-8">{ENTER_LABEL}</Button>
          </Reveal>
        </section>
      </main>

      <SiteFooter name={APP_NAME} />
    </div>
  );
}

export default LandingPage;
