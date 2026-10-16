import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useElementSize } from '../../hooks/useElementSize.js';
import { getGridMetrics, chunkRows } from '../../utils/marketGrid.js';
import { PlayerCard } from '../PlayerCard.jsx';
import { PlayerListItem } from '../PlayerListItem.jsx';

// The marketplace results scroll with the page (#main-content), not inside a box of their own: the header,
// recommendations and toolbar scroll away (the toolbar sticks on md+) and the list always gets the screen.
// Only the rows near the viewport are mounted, so the whole catalogue (~27k players) can be passed in.

const LIST_ROW_ESTIMATE = 70;
const LIST_ROW_GAP = 8;
const CARD_INFO_ESTIMATE = { comfortable: 64, compact: 52 };

function lockInfo(player, playerLocks, userId, allTeams) {
  const lock = playerLocks[player.Id];
  const isInMyCart = Boolean(lock && lock.lockedBy === userId);
  const isLockedByOther = Boolean(lock && lock.lockedBy !== userId);
  return {
    isInMyCart,
    isLockedByOther,
    lockedTeamName: isLockedByOther ? lock.teamName : null,
    lockedTeamLogo: isLockedByOther ? allTeams?.[lock.lockedBy]?.logoUrl ?? null : null,
  };
}

/** Distance from the top of the scroll container's content to the list (kept current as the header changes). */
function useScrollMargin(listRef, scrollElement) {
  const [margin, setMargin] = useState(0);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || !scrollElement) return undefined;
    const update = () => {
      const offset = Math.round(list.getBoundingClientRect().top - scrollElement.getBoundingClientRect().top + scrollElement.scrollTop);
      setMargin(prev => (prev === offset ? prev : offset));
    };
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    // The list's parent grows when anything above the list changes height (recommendations, chips, alerts).
    const observer = new ResizeObserver(update);
    if (list.parentElement) observer.observe(list.parentElement);
    observer.observe(scrollElement);
    return () => observer.disconnect();
  }, [listRef, scrollElement]);
  return margin;
}

export function VirtualPlayerResults({
  players, viewMode, density, resetKey, scrollElementId = 'main-content',
  playerLocks, userId, allTeams, wishlistSet, comparingIdsSet,
  onSelectPlayer, onToggleWishlist, onCompare, onPlayerMouseEnter, onPlayerMouseLeave,
}) {
  const [listRef, { width }] = useElementSize();
  const [scrollElement, setScrollElement] = useState(null);
  useLayoutEffect(() => {
    setScrollElement(document.getElementById(scrollElementId));
  }, [scrollElementId]);
  const scrollMargin = useScrollMargin(listRef, scrollElement);

  const isList = viewMode === 'list';
  const { columns, gap } = isList ? { columns: 1, gap: LIST_ROW_GAP } : getGridMetrics(width, density);
  const rows = useMemo(() => (isList ? players.map(player => [player]) : chunkRows(players, columns)), [players, columns, isList]);
  const columnWidth = width > 0 ? (width - gap * (columns - 1)) / columns : 160;
  const estimate = isList ? LIST_ROW_ESTIMATE : Math.round(columnWidth + (CARD_INFO_ESTIMATE[density] || CARD_INFO_ESTIMATE.comfortable));

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => estimate,
    overscan: isList ? 8 : 3,
    gap,
    scrollMargin,
  });

  // Row heights depend on the column width: re-measure when the layout changes.
  useLayoutEffect(() => {
    virtualizer.measure();
  }, [virtualizer, columns, width, density, viewMode]);

  // A new search, filter or sort starts at the first result. Only when the list top is already scrolled past,
  // and only for those changes (resetKey): starring a player deep in the list must not jump back up.
  const lastResetKey = useRef(resetKey);
  useLayoutEffect(() => {
    if (lastResetKey.current === resetKey) return;
    lastResetKey.current = resetKey;
    if (!scrollElement) return;
    const toolbar = scrollElement.querySelector('[data-app-tour="search"]');
    const stickyOffset = toolbar && getComputedStyle(toolbar).position === 'sticky' ? toolbar.offsetHeight : 0;
    const target = Math.max(0, scrollMargin - stickyOffset - 8);
    if (scrollElement.scrollTop > target) scrollElement.scrollTop = target;
  }, [resetKey, scrollElement, scrollMargin]);

  const items = virtualizer.getVirtualItems();

  return (
    <div ref={listRef} id="player-list" data-app-tour="players" className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
      {width > 0 && items.map(item => {
        const row = rows[item.index];
        return (
          <div
            key={item.key}
            data-index={item.index}
            ref={virtualizer.measureElement}
            className="absolute left-0 top-0 w-full"
            style={{
              transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)`,
              ...(isList ? null : { display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap }),
            }}
          >
            {row.map(player => {
              const common = {
                player,
                onSelectPlayer,
                ...lockInfo(player, playerLocks, userId, allTeams),
                isWishlisted: wishlistSet.has(player.Id),
                onToggleWishlist,
                onCompare,
                isComparing: comparingIdsSet.has(player.Id),
              };
              if (isList) return <PlayerListItem key={player.Id} {...common} />;
              return (
                <div key={player.Id} className="min-w-0"
                  onMouseEnter={onPlayerMouseEnter ? (event) => onPlayerMouseEnter(event, player) : undefined}
                  onMouseLeave={onPlayerMouseLeave}>
                  <PlayerCard {...common} density={density} />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
