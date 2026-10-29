// Marketplace card, list row and hover preview: structure and state rules from the visual audit.
// Synthetic player objects; this checks markup only, not the rendered layout (see the QA screenshots for that).
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PlayerCard } from '../components/PlayerCard.jsx';
import { PlayerListItem } from '../components/PlayerListItem.jsx';
import { PlayerPreview } from '../components/ui/PlayerPreview.jsx';
import { getPreviewPosition } from '../hooks/useHoverPreview.js';

const player = {
  Id: 101, Name: 'J. Álvarez', POS_NOMBRE: 'DC', OVR_CALCULADO: 82, Precio: 51.2, Age: 24, Height: 170, Country1: 9,
  Speed: 84, Finishing: 86, LowPass: 78, Dribbling: 83, BallWinning: 50, Stamina: 88,
};

const props = (overrides = {}) => ({
  player, onSelectPlayer: vi.fn(), onToggleWishlist: vi.fn(), onCompare: vi.fn(),
  isInMyCart: false, isLockedByOther: false, lockedTeamName: null, lockedTeamLogo: null, isWishlisted: false, isComparing: false,
  ...overrides,
});

const render = (Component, overrides) => renderToString(React.createElement(Component, props(overrides)));

/** Max depth of <button> nesting in an HTML string (1 = no button inside another button). */
function maxButtonDepth(html) {
  let depth = 0;
  let max = 0;
  for (const match of html.matchAll(/<(\/?)button\b/g)) {
    depth += match[1] ? -1 : 1;
    max = Math.max(max, depth);
  }
  return max;
}

describe.each([['PlayerCard', PlayerCard], ['PlayerListItem', PlayerListItem]])('%s', (_name, Component) => {
  it('never nests a button inside another button or a role="button"', () => {
    const html = render(Component);
    expect(maxButtonDepth(html)).toBe(1);
    expect(html).not.toContain('role="button"');
  });

  it('declares type="button" on every button', () => {
    for (const tag of render(Component).match(/<button\b[^>]*>/g)) expect(tag).toContain('type="button"');
  });

  it('keeps a player signed by another club openable (the sheet offers a transfer proposal)', () => {
    const html = render(Component, { isLockedByOther: true, lockedTeamName: 'Rival FC' });
    expect(html).toContain('Ver ficha de J. Álvarez');
    expect(html).toContain('fichado por Rival FC');
    expect(html).not.toContain('pointer-events-none opacity');
    expect(html).not.toContain('aria-disabled');
    // No compare for a player you cannot sign.
    expect(html).not.toContain('Comparar a J. Álvarez');
  });

  it('marks an owned player with text, not only colour', () => {
    expect(render(Component, { isInMyCart: true })).toContain('En tu plantel');
  });

  it('uses the shared stat colour scale for the OVR (82 → stat-c-80 everywhere)', () => {
    expect(render(Component)).toContain('stat-c-80');
  });

  it('exposes wishlist and compare as pressed toggles', () => {
    const html = render(Component, { isWishlisted: true, isComparing: true });
    expect(html).toMatch(/aria-label="Quitar a J\. Álvarez de favoritos"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*aria-label="Quitar a J\. Álvarez de favoritos"/);
    expect(html).toContain('Quitar a J. Álvarez del comparador');
  });
});

describe('PlayerPreview', () => {
  it('is informational only: no buttons, hidden from assistive tech, uses the shared stat colours', () => {
    const html = renderToString(React.createElement(PlayerPreview, { player, isVisible: true, position: { top: 0, left: 0 } }));
    expect(html).not.toContain('<button');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('pointer-events-none');
    expect(html).toContain('stat-c-80');
  });
});

describe('getPreviewPosition', () => {
  const viewport = { width: 1440, height: 900 };

  it('opens to the right of the card when it fits', () => {
    expect(getPreviewPosition({ left: 300, right: 480, top: 200 }, viewport)).toEqual({ top: 200, left: 488 });
  });

  it('opens to the left near the right edge', () => {
    expect(getPreviewPosition({ left: 1200, right: 1380, top: 200 }, viewport)).toEqual({ top: 200, left: 968 });
  });

  it('stays inside the window near the bottom and top edges', () => {
    expect(getPreviewPosition({ left: 300, right: 480, top: 850 }, viewport).top).toBe(652);
    expect(getPreviewPosition({ left: 300, right: 480, top: -40 }, viewport).top).toBe(8);
  });
});
