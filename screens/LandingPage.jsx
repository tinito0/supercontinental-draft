import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/Button.jsx';
import { APP_NAME, FRANCHISE_MIN_AGE, FRANCHISE_MIN_OVR, FRANCHISE_MAX_OVR } from '../utils/constants.js';
import { Reveal } from '../components/landing/Reveal.jsx';
import { PlatformDemo } from '../components/landing/PlatformDemo.jsx';
import { PlayerMarquee } from '../components/landing/PlayerMarquee.jsx';
import { FollowLeague, SocialLinks } from '../components/landing/FollowLeague.jsx';
import { MARKET_PLAYER_COUNT_LABEL } from '../components/landing/sampleData.js';
import { LEAGUE_NAME } from '../components/landing/leagueLinks.js';

/* One label for the one action of the page, used in the nav, the hero and the closing call. */
const ENTER_LABEL = 'Ingresar';
/* The full name does not fit next to the button at 360px. */
const SHORT_APP_NAME = 'SCL Draft';

const NAV_LINKS = [
  { href: '#plataforma', label: 'Plataforma' },
  { href: '#reglamento', label: 'Reglamento' },
  { href: '#seguinos', label: 'Seguinos' },
];

/* Each rule matches what the market Edge Function enforces (supabase/functions/_shared/market.js). */
const RULE_GROUPS = [
  {
    title: 'Mercado',
    rules: [
      { title: 'Presupuesto asignado', desc: 'Cada manager arranca con el presupuesto que fija la administración. Ningún fichaje ni oferta puede dejarlo en negativo.' },
      { title: 'Bloqueo inmediato', desc: 'Cuando fichás a un jugador, queda bloqueado al instante para el resto de los managers.' },
      { title: 'Ventas al 100%', desc: 'Podés liberar a un jugador cuando quieras y recuperás todo lo que pagaste para volver a invertir.' },
    ],
  },
  {
    title: 'Plantel',
    rules: [
      { title: 'Centro de traspasos', desc: 'Proponé intercambios, ofertas de dinero o contraofertas directas a otros managers.' },
      { title: 'Jugador franquicia', desc: `Un fichaje gratis por manager: un jugador de ${FRANCHISE_MIN_AGE} años o más con OVR entre ${FRANCHISE_MIN_OVR} y ${FRANCHISE_MAX_OVR}.` },
      { title: 'Alineaciones obligatorias', desc: 'Antes de cada fecha, todo equipo tiene que tener guardados su 11, los suplentes y la estrategia S1.' },
    ],
  },
];

function SectionHeading({ id, title, children }) {
  return (
    <div className="mb-8 max-w-[65ch] md:mb-10">
      <h2 id={id} className="font-display text-3xl font-bold uppercase leading-none tracking-tight text-ink md:text-4xl">{title}</h2>
      {children && <p className="mt-3 text-base leading-relaxed text-ink-2">{children}</p>}
    </div>
  );
}

function LandingNav({ onEnter }) {
  return (
    <header className="landing-nav fixed inset-x-0 top-0 z-sticky border-b border-line/10">
      <nav aria-label="Principal" className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <a href="#inicio" className="flex min-w-0 items-center gap-2.5">
          <img src="/landing/crest.webp" alt="" width="32" height="32" className="h-8 w-8" />
          <span className="truncate font-display text-lg font-bold uppercase tracking-wide text-ink">
            <span className="sm:hidden">{SHORT_APP_NAME}</span>
            <span className="hidden sm:inline">{APP_NAME}</span>
          </span>
        </a>
        <ul className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map(link => (
            <li key={link.href}>
              <a href={link.href} className="rounded-lg px-3 py-2 text-sm font-medium text-ink-2 transition-colors hover:text-ink">{link.label}</a>
            </li>
          ))}
        </ul>
        <Button variant="primary" onClick={onEnter} iconRight={ChevronRight}>{ENTER_LABEL}</Button>
      </nav>
    </header>
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

function Rules() {
  return (
    <div className="grid gap-10 md:grid-cols-2 md:gap-14">
      {RULE_GROUPS.map((group, gi) => (
        <Reveal key={group.title} delay={gi * 100}>
          <h3 className="section-title border-b border-line/[0.14] pb-3 text-accent-soft">{group.title}</h3>
          <dl className="mt-2">
            {group.rules.map(rule => (
              <div key={rule.title} className="py-4">
                <dt className="font-display text-xl font-semibold text-ink">{rule.title}</dt>
                <dd className="mt-1 text-ink-2">{rule.desc}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      ))}
    </div>
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
          <Rules />
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

      <footer className="border-t border-line/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <img src="/landing/crest.webp" alt="" width="24" height="24" loading="lazy" className="h-6 w-6" />
              <span className="font-display font-bold uppercase tracking-wide text-ink">{APP_NAME}</span>
            </div>
            <p className="mt-2 text-sm text-ink-3">
              © {new Date().getFullYear()} {LEAGUE_NAME}. Una liga de eFootball PES 2021 hecha para disfrutar con amigos.
            </p>
          </div>
          <SocialLinks />
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
