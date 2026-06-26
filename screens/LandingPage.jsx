import React, { useState, useEffect, useRef, memo, useMemo } from 'react';
import { 
  ChevronRight, Shield, Users, Zap, BarChart2, Trophy, 
  ArrowLeftRight, Sparkles, Target, Lock, Globe, MessageCircle,
  BookOpen, ChevronDown, ExternalLink
} from 'lucide-react';
import { APP_NAME } from '../utils/constants.js';

/* ═══════════════════════════════════════════════════════════════════
   SHOWCASE PLAYERS — real player data for the carousel
   ═══════════════════════════════════════════════════════════════════ */
const SHOWCASE_PLAYERS = [
  { id: 110718, name: 'K. MBAPPÉ',         ovr: 91, pos: 'DC',  price: 62.02, posColor: '#ef4444' },
  { id: 110815, name: 'RODRI',             ovr: 91, pos: 'MCD', price: 58.03, posColor: '#22c55e' },
  { id: 44383,  name: 'T. COURTOIS',       ovr: 91, pos: 'PT',  price: 45.94, posColor: '#eab308' },
  { id: 133543, name: 'E. HAALAND',        ovr: 90, pos: 'DC',  price: 58.44, posColor: '#ef4444' },
  { id: 117047, name: 'VINÍCIUS JR.',      ovr: 90, pos: 'EI',  price: 58.44, posColor: '#ef4444' },
  { id: 47287,  name: 'H. KANE',           ovr: 90, pos: 'DC',  price: 52.41, posColor: '#ef4444' },
  { id: 132933, name: 'J. BELLINGHAM',     ovr: 89, pos: 'MO',  price: 48.23, posColor: '#22c55e' },
  { id: 57123,  name: 'M. SALAH',          ovr: 89, pos: 'ED',  price: 48.13, posColor: '#ef4444' },
  { id: 44840,  name: 'V. VAN DIJK',       ovr: 89, pos: 'DFC', price: 34.72, posColor: '#3b82f6' },
  { id: 108657, name: 'LAUTARO MARTÍNEZ',  ovr: 89, pos: 'DC',  price: 55.01, posColor: '#ef4444' },
  { id: 7511,   name: 'L. MESSI',          ovr: 88, pos: 'SD',  price: 37.53, posColor: '#ef4444' },
  { id: 44379,  name: 'K. DE BRUYNE',      ovr: 88, pos: 'MO',  price: 35.90, posColor: '#22c55e' },
];

/* ═══════════════════════════════════════════════════════════════════
   MINI PLAYER CARD — for the carousel
   ═══════════════════════════════════════════════════════════════════ */
const MiniCard = memo(function MiniCard({ player }) {
  function getOvrColor(ovr) {
    if (ovr >= 90) return '#facc15';
    if (ovr >= 85) return '#4ade80';
    return '#a3e635';
  }
  const ovrColor = getOvrColor(player.ovr);

  return (
    <div className="landing-card">
      <div className="landing-card__photo-wrap">
        <div className="landing-card__glow" style={{ background: `radial-gradient(ellipse at 50% 70%, ${player.posColor}30 0%, transparent 65%)` }} />
        <img
          src={`/fotos_jugadores/${player.id}.webp`}
          alt={player.name}
          className="landing-card__photo"
          loading="lazy"
          decoding="async"
          width="180"
          height="220"
          onError={e => { e.target.onerror = null; e.target.src = `https://placehold.co/200x240/111/333?text=${player.name.substring(0, 2)}`; }}
        />
        <div className="landing-card__fade" />
        <div className="landing-card__info-strip">
          <div className="landing-card__ovr-badge" style={{ background: `${ovrColor}22`, borderColor: `${ovrColor}60` }}>
            <span style={{ color: ovrColor, fontSize: '1.5rem', fontWeight: 900, lineHeight: 1, textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>{player.ovr}</span>
          </div>
          <span className="landing-card__pos" style={{ background: player.posColor, color: '#fff', boxShadow: `0 2px 8px ${player.posColor}50` }}>
            {player.pos}
          </span>
        </div>
      </div>
      <div className="landing-card__bottom">
        <h4 className="landing-card__name">{player.name}</h4>
        <span className="landing-card__price">${player.price.toFixed(2)}M</span>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════════
   ANIMATED COUNTER — counts up on scroll
   ═══════════════════════════════════════════════════════════════════ */
function AnimatedCounter({ end, suffix = '', prefix = '' }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !hasAnimated.current) {
        hasAnimated.current = true;
        let start = 0;
        const duration = 1800;
        const startTime = performance.now();
        const animate = (now) => {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setCount(Math.round(eased * end));
          if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
      }
    }, { threshold: 0.3 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [end]);

  return <span ref={ref}>{prefix}{count}{suffix}</span>;
}

/* ═══════════════════════════════════════════════════════════════════
   SCROLL REVEAL WRAPPER
   ═══════════════════════════════════════════════════════════════════ */
function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { threshold: 0.15 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(30px)',
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN LANDING PAGE
   ═══════════════════════════════════════════════════════════════════ */
const HERO_PLAYERS = SHOWCASE_PLAYERS.slice(0, 5);

function HeroPitchPreview() {
  return (
    <div className="landing-hero__pitch" aria-hidden="true">
      <div className="landing-hero__pitch-line landing-hero__pitch-line--box" />
      <div className="landing-hero__pitch-line landing-hero__pitch-line--mid" />
      {HERO_PLAYERS.map((player, index) => (
        <div key={player.id} className={`landing-hero__player landing-hero__player--${index + 1}`}>
          <img
            src={`/fotos_jugadores/${player.id}.webp`}
            alt=""
            loading={index < 2 ? 'eager' : 'lazy'}
            decoding="async"
            width="64"
            height="64"
          />
          <span className="landing-hero__player-meta">
            <b style={{ background: player.posColor }}>{player.pos}</b>
            <strong>{player.ovr}</strong>
          </span>
        </div>
      ))}
    </div>
  );
}

export function LandingPage({ onEnter }) {
  // Duplicate cards for infinite scroll illusion
  const carouselCards = useMemo(() => [...SHOWCASE_PLAYERS, ...SHOWCASE_PLAYERS], []);

  return (
    <div className="landing-root">

      {/* ═══════════ HERO ═══════════ */}
      <section className="landing-hero">
        {/* Background effects */}
        <div className="landing-hero__bg">
          <div className="landing-hero__grid" />
        </div>

        <div className="landing-hero__content">
          {/* Logo */}
          <div className="landing-hero__logo-wrap">
            <div className="landing-hero__logo-glow" />
            <img src="/logo.webp" alt="SCL Logo" className="landing-hero__logo" width="140" height="140" decoding="async" />
          </div>

          <h1 className="landing-hero__title">
            {APP_NAME} <span className="landing-hero__dot">.</span>
          </h1>
          <p className="landing-hero__subtitle">
            Armá tu equipo soñado. Competí en tiempo real contra tus amigos.
          </p>
          <p className="landing-hero__season">
            Volvemos en verano de 2027
          </p>

          <HeroPitchPreview />

          <button onClick={onEnter} className="landing-hero__cta">
            <span>Ingresar al Draft</span>
            <ChevronRight className="landing-hero__cta-icon" />
          </button>

          {/* Scroll hint */}
          <div className="landing-hero__scroll-hint">
            <ChevronDown className="landing-hero__scroll-icon" />
          </div>
        </div>
      </section>

      {/* ═══════════ PLAYER CAROUSEL ═══════════ */}
      <section className="landing-section landing-carousel-section">
        <Reveal>
          <h2 className="landing-section__title">
            <Sparkles className="landing-section__title-icon" style={{ color: '#facc15' }} />
            Los Mejores del Mundo
          </h2>
          <p className="landing-section__desc">Más de 1000 jugadores con stats detalladas estilo PES esperan tu fichaje.</p>
        </Reveal>

        <div className="landing-carousel">
          <div className="landing-carousel__track">
            {carouselCards.map((player, i) => (
              <MiniCard key={`${player.id}-${i}`} player={player} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <section className="landing-section">
        <Reveal>
          <h2 className="landing-section__title">
            <Target className="landing-section__title-icon" style={{ color: '#60a5fa' }} />
            ¿Cómo Funciona?
          </h2>
        </Reveal>

        <div className="landing-steps">
          <Reveal delay={100} className="landing-step">
            <div className="landing-step__num">1</div>
            <div className="landing-step__icon-wrap" style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)' }}>
              <Shield className="landing-step__icon" style={{ color: '#34d399' }} />
            </div>
            <h3 className="landing-step__title">Presupuesto Inicial</h3>
            <p className="landing-step__desc">
              Cada equipo tiene un presupuesto designado por la presidencia. Administrá cada peso como un verdadero director deportivo.
            </p>
          </Reveal>

          <Reveal delay={250} className="landing-step">
            <div className="landing-step__num">2</div>
            <div className="landing-step__icon-wrap" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' }}>
              <Lock className="landing-step__icon" style={{ color: '#f87171' }} />
            </div>
            <h3 className="landing-step__title">Mercado en Tiempo Real</h3>
            <p className="landing-step__desc">
              Fichá jugadores antes que tus rivales. Cada fichaje es definitivo y se bloquea al instante para todos los demás.
            </p>
          </Reveal>

          <Reveal delay={400} className="landing-step">
            <div className="landing-step__num">3</div>
            <div className="landing-step__icon-wrap" style={{ background: 'rgba(99,102,241,0.1)', borderColor: 'rgba(99,102,241,0.3)' }}>
              <Trophy className="landing-step__icon" style={{ color: '#818cf8' }} />
            </div>
            <h3 className="landing-step__title">Competí con tu Liga</h3>
            <p className="landing-step__desc">
              Usá comparadores, tácticas y formaciones para armar el equipo más fuerte y dominar la Supercontinental.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ FEATURES ═══════════ */}
      <section className="landing-section">
        <Reveal>
          <h2 className="landing-section__title">
            <Zap className="landing-section__title-icon" style={{ color: '#f59e0b' }} />
            Herramientas de Manager
          </h2>
        </Reveal>

        <div className="landing-features">
          {[
            { icon: BarChart2, color: '#38bdf8', title: 'Stats Detalladas', desc: 'Radar, heatmap y más de 25 atributos por jugador, estilo PES.' },
            { icon: ArrowLeftRight, color: '#a78bfa', title: 'Comparador 1v1', desc: 'Enfrentá dos jugadores para tomar la mejor decisión de fichaje.' },
            { icon: Sparkles, color: '#fbbf24', title: 'IA Scout', desc: '¿Jugador bloqueado? La IA te sugiere alternativas similares automáticamente.' },
            { icon: Shield, color: '#34d399', title: 'Formación Táctica', desc: 'Armá tu 11 ideal con +15 formaciones y exportá la imagen.' },
            { icon: Users, color: '#fb7185', title: 'Multiplayer en Vivo', desc: 'Mercado compartido entre todos los managers. Cada segundo cuenta.' },
            { icon: Globe, color: '#22d3ee', title: '6 Regiones', desc: 'Jugadores de Sudamérica, Europa, Asia, África y más.' },
          ].map((f, i) => (
            <Reveal key={f.title} delay={i * 100} className="landing-feature">
              <div className="landing-feature__icon-wrap" style={{ background: `${f.color}15`, border: `1px solid ${f.color}30` }}>
                <f.icon style={{ color: f.color, width: 22, height: 22 }} />
              </div>
              <h3 className="landing-feature__title">{f.title}</h3>
              <p className="landing-feature__desc">{f.desc}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══════════ RULES ═══════════ */}
      <section className="landing-section">
        <Reveal>
          <h2 className="landing-section__title">
            <BookOpen className="landing-section__title-icon" style={{ color: '#c084fc' }} />
            Reglas del Draft
          </h2>
        </Reveal>

        <Reveal delay={100}>
          <div className="landing-rules">
            {[
              'Cada manager comienza con un presupuesto asignado por la administración.',
              'Los fichajes son en tiempo real: si fichás a un jugador, se bloquea para todos.',
              'Podés vender un jugador en cualquier momento y recuperar el 100% de su valor.',
              'Existe la opción de proponer traspasos a otros managers con ofertas y contraofertas.',
              'El Jugador Franquicia es una ficha especial que se puede usar una vez por temporada.',
              'El mercado abre y cierra según lo defina la administración. ¡Estén atentos!',
            ].map((rule, i) => (
              <div key={i} className="landing-rule">
                <span className="landing-rule__num">{i + 1}</span>
                <p className="landing-rule__text">{rule}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ═══════════ STATS ═══════════ */}
      <section className="landing-section">
        <div className="landing-stats">
          <Reveal delay={0} className="landing-stat">
            <div className="landing-stat__value"><AnimatedCounter end={1000} prefix="+" /></div>
            <div className="landing-stat__label">Jugadores disponibles</div>
          </Reveal>
          <Reveal delay={150} className="landing-stat">
            <div className="landing-stat__value"><AnimatedCounter end={15} prefix="+" /></div>
            <div className="landing-stat__label">Formaciones tácticas</div>
          </Reveal>
          <Reveal delay={300} className="landing-stat">
            <div className="landing-stat__value"><AnimatedCounter end={6} /></div>
            <div className="landing-stat__label">Regiones del mundo</div>
          </Reveal>
          <Reveal delay={450} className="landing-stat">
            <div className="landing-stat__value"><AnimatedCounter end={25} prefix="+" /></div>
            <div className="landing-stat__label">Stats por jugador</div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ LINKS / COMMUNITY ═══════════ */}
      <section className="landing-section">
        <Reveal>
          <h2 className="landing-section__title">
            <MessageCircle className="landing-section__title-icon" style={{ color: '#34d399' }} />
            Comunidad
          </h2>
          <p className="landing-section__desc">Mantenete conectado con los otros managers de la liga.</p>
        </Reveal>

        <Reveal delay={100}>
          <div className="landing-links">
            <a href="https://chat.whatsapp.com" target="_blank" rel="noopener noreferrer" className="landing-link landing-link--whatsapp">
              <div className="landing-link__icon-wrap">
                <MessageCircle style={{ width: 24, height: 24 }} />
              </div>
              <div>
                <h3 className="landing-link__title">Grupo de WhatsApp</h3>
                <p className="landing-link__desc">Coordiná fichajes y novedades</p>
              </div>
              <ExternalLink className="landing-link__arrow" />
            </a>

            <a href="https://discord.gg" target="_blank" rel="noopener noreferrer" className="landing-link landing-link--discord">
              <div className="landing-link__icon-wrap">
                <Globe style={{ width: 24, height: 24 }} />
              </div>
              <div>
                <h3 className="landing-link__title">Servidor de Discord</h3>
                <p className="landing-link__desc">Chat en vivo y anuncios</p>
              </div>
              <ExternalLink className="landing-link__arrow" />
            </a>
          </div>
        </Reveal>
      </section>

      {/* ═══════════ FINAL CTA ═══════════ */}
      <section className="landing-section landing-final-cta">
        <Reveal>
          <img src="/logo.webp" alt="" className="landing-final-cta__logo" width="80" height="80" loading="lazy" decoding="async" />
          <h2 className="landing-final-cta__title">¿Listo para armar tu equipo?</h2>
          <p className="landing-final-cta__desc">
            El mercado te espera. Cada segundo cuenta.
          </p>
          <button onClick={onEnter} className="landing-hero__cta" style={{ marginTop: '2rem' }}>
            <span>Ingresar al Draft</span>
            <ChevronRight className="landing-hero__cta-icon" />
          </button>
        </Reveal>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="landing-footer">
        <p>© 2025 – 2027 Supercontinental Draft. Todos los derechos reservados.</p>
        <p className="landing-footer__sub">Hecho con ⚽ para amigos que aman el fútbol.</p>
      </footer>
    </div>
  );
}
