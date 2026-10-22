import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { teamCrestUrl } from '../../utils/teamCrest.js';
import { LEAGUE_NAME } from '../landing/leagueLinks.js';

const DEFAULT_RING_SIZE = 480;

/**
 * The league crest at the exact centre of a ring of club crests; each crest links to its club page.
 * Still on purpose (no looping motion): hover or focus enlarges a crest and shows its name.
 */
export function CrestRing({ teams }) {
  const ringRef = useRef(null);
  const [ringSize, setRingSize] = useState(DEFAULT_RING_SIZE);

  useEffect(() => {
    const el = ringRef.current;
    if (!el) return undefined;
    const update = () => setRingSize(el.getBoundingClientRect().width || DEFAULT_RING_SIZE);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const radius = (ringSize / 2) * 0.8;
  const crestSize = Math.max(36, Math.min(64, Math.round(ringSize * 0.12)));
  const total = Math.max(teams.length, 1);

  return (
    <div ref={ringRef} className="relative mx-auto aspect-square w-full max-w-[480px]">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-line/15"
        style={{ width: radius * 2, height: radius * 2 }}
        aria-hidden="true"
      />

      {/* Centred by grid, not by translate: the entry animation (landing-crest) animates `transform`, which
          would otherwise override a translate-based centring. */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <img
          src="/landing/crest.webp"
          alt={`Escudo de la ${LEAGUE_NAME}`}
          width="560"
          height="568"
          fetchpriority="high"
          className="landing-crest h-auto w-[42%]"
        />
      </div>

      <ul aria-label="Clubes de la liga">
        {teams.map((team, index) => {
          const angle = ((360 / total) * index - 90) * (Math.PI / 180);
          return (
            <li
              key={team.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `calc(50% + ${Math.cos(angle) * radius}px)`,
                top: `calc(50% + ${Math.sin(angle) * radius}px)`,
                width: crestSize,
                height: crestSize,
              }}
            >
              <Link
                to={`/equipos/${team.id}`}
                aria-label={team.teamName}
                className="group relative flex h-full w-full items-center justify-center rounded-lg"
              >
                <img
                  src={teamCrestUrl(team)}
                  alt=""
                  width={crestSize}
                  height={crestSize}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-contain transition-transform duration-150 ease-out group-hover:scale-110 group-focus-visible:scale-110 motion-reduce:transition-none"
                />
                <span
                  className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-line/20 bg-overlay px-2 py-1 text-xs font-semibold text-ink opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                  aria-hidden="true"
                >
                  {team.teamName}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default CrestRing;
