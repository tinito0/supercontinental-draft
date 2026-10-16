import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { APP_NAME } from '../../utils/constants.js';
import { LEAGUE_NAME } from '../landing/leagueLinks.js';

/* The full name does not fit next to the button at 360px (same rule as the landing nav). */
const SHORT_APP_NAME = 'SCL Draft';

function Brand() {
  return (
    <>
      <img src="/landing/crest.webp" alt="" width="32" height="32" className="h-8 w-8" />
      <span className="truncate font-display text-lg font-bold uppercase tracking-wide text-ink">
        <span className="sm:hidden">{SHORT_APP_NAME}</span>
        <span className="hidden sm:inline">{APP_NAME}</span>
      </span>
    </>
  );
}

/**
 * Frame for the sign-in screens (login, Google account linking). It repeats the public landing
 * (screens/LandingPage.jsx): same nav, hero grid, crest and footer, so entering feels like the next step of
 * that page instead of another product.
 */
export function AuthLayout({ onBack, title, description, children }) {
  return (
    <div className="landing-root flex min-h-[100dvh] flex-col overflow-x-hidden bg-canvas font-sans text-ink">
      <header className="landing-nav sticky top-0 z-sticky border-b border-line/10">
        <nav aria-label="Principal" className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          {onBack ? (
            <button type="button" onClick={onBack} className="flex min-w-0 items-center gap-2.5" aria-label={`${APP_NAME}: volver al inicio`}>
              <Brand />
            </button>
          ) : (
            <div className="flex min-w-0 items-center gap-2.5"><Brand /></div>
          )}
          {onBack && <Button variant="ghost" icon={ArrowLeft} onClick={onBack}>Volver al inicio</Button>}
        </nav>
      </header>

      <main className="flex flex-1 items-center">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] md:py-16">
          <div className="landing-enter w-full max-w-md">
            <p className="eyebrow mb-4 text-accent-soft">{LEAGUE_NAME}</p>
            <h1 className="font-display text-[2.4rem] font-bold uppercase leading-[0.95] tracking-tight text-ink sm:text-5xl">{title}</h1>
            {description && <p className="mt-4 max-w-[46ch] text-base leading-relaxed text-ink-2">{description}</p>}
            <div className="mt-8">{children}</div>
          </div>
          <div className="hidden justify-end md:flex">
            <img
              src="/landing/crest.webp"
              alt={`Escudo de la ${LEAGUE_NAME}`}
              width="560"
              height="568"
              fetchpriority="high"
              className="landing-crest w-full max-w-[380px]"
            />
          </div>
        </div>
      </main>

      <footer className="border-t border-line/10">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-6 sm:px-6">
          <img src="/landing/crest.webp" alt="" width="24" height="24" loading="lazy" className="h-6 w-6" />
          <p className="text-sm text-ink-3">© {new Date().getFullYear()} {LEAGUE_NAME}. Una liga de eFootball PES 2021 hecha para disfrutar con amigos.</p>
        </div>
      </footer>
    </div>
  );
}

/** Google sign-in button: the primary action, with Google's "G" on its own white badge (brand guideline). */
export function GoogleButton({ onClick, loading, children }) {
  return (
    <Button variant="primary" size="lg" onClick={onClick} loading={loading} className="w-full">
      {!loading && (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white" aria-hidden="true">
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
        </span>
      )}
      {children}
    </Button>
  );
}
