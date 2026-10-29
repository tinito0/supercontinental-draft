import React from 'react';

// Team mark built from data the working copy has: the two team colours (EDIT, else the first kit) and the
// abbreviation. Emblems live in the game's CPKs and are not editable here, so no crest image is faked.
// Team colours are runtime data, the only place besides ColourField where an inline colour is allowed.

const luminance = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Text colour that reads on both halves of the badge. */
function inkOn(colours) {
  const avg = (luminance(colours.c1) + luminance(colours.c2)) / 2;
  return avg > 0.55 ? '#0e1320' : '#ffffff';
}

const SIZES = {
  sm: 'w-8 h-8 text-[11px]',
  lg: 'w-14 h-14 text-base',
};

// Lower-right triangle: the second colour as a hard diagonal half (no gradient).
const SECOND_HALF = 'polygon(100% 0, 100% 100%, 0 100%)';

export function TeamBadge({ abbr, colours, size = 'sm', className = '' }) {
  const label = abbr || '?';
  return (
    <span aria-hidden="true" style={colours ? { color: inkOn(colours) } : undefined}
      className={`relative overflow-hidden inline-flex items-center justify-center shrink-0 rounded-md font-display font-bold tracking-wide border border-line/[0.16] ${colours ? '' : 'bg-raised text-ink-2'} ${SIZES[size] || SIZES.sm} ${className}`}>
      {colours && (
        <>
          <span className="absolute inset-0" style={{ background: colours.c1 }} />
          <span className="absolute inset-0" style={{ background: colours.c2, clipPath: SECOND_HALF }} />
        </>
      )}
      <span className="relative">{label}</span>
    </span>
  );
}

/** Header band: the two team colours as solid halves (no fade). */
export function TeamColourBand({ colours }) {
  if (!colours) return <div className="h-1 bg-line/[0.12]" aria-hidden="true" />;
  return (
    <div className="flex h-1" aria-hidden="true">
      <span className="flex-1" style={{ background: colours.c1 }} />
      <span className="flex-1" style={{ background: colours.c2 }} />
    </div>
  );
}
