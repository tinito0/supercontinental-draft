// Marketplace grid geometry from the list's own width (never the window): how many cards fit per row.
// Cards then share the row equally (CSS grid, real `gap`), so every card in a row has the same width.

const NARROW_WIDTH = 600; // below this the list is on a phone-sized column

const MIN_CARD_WIDTH = {
  comfortable: { narrow: 148, wide: 176 },
  compact: { narrow: 100, wide: 136 },
};

/**
 * @param {number} width list width in px
 * @param {'comfortable'|'compact'} density
 * @returns {{ columns: number, gap: number }}
 */
export function getGridMetrics(width, density = 'comfortable') {
  const isNarrow = width < NARROW_WIDTH;
  const gap = isNarrow ? 12 : 16;
  const sizes = MIN_CARD_WIDTH[density] || MIN_CARD_WIDTH.comfortable;
  const minCard = isNarrow ? sizes.narrow : sizes.wide;
  // At least two cards per row even on the smallest phones (a single column wastes the screen).
  const columns = Math.max(2, Math.floor((Math.max(0, width) + gap) / (minCard + gap)));
  return { columns, gap };
}

/** Splits players into rows of `columns` (the virtualizer renders one row per item). */
export function chunkRows(players, columns) {
  const rows = [];
  for (let i = 0; i < players.length; i += columns) rows.push(players.slice(i, i + columns));
  return rows;
}
