import React, { useMemo, useRef, useState, useLayoutEffect } from 'react';
import { List, Grid } from 'react-window';
import { PlayerListItem } from './PlayerListItem.jsx';
import { PlayerCard } from './PlayerCard.jsx';

// ─────────────────────────────────────────────────────────────────────────
// Por qué NO usamos react-virtualized-auto-sizer:
// AutoSizer mide el tamaño disponible con un mecanismo viejo basado en
// "resize-triggers" (divs absolutos + eventos de scroll), no ResizeObserver
// puro. En este árbol de flexbox (varios niveles de flex-1/min-h-0 anidados)
// ese mecanismo se quedaba pegado en 0×0 de forma persistente — confirmado
// inspeccionando el DOM real (el div interno de AutoSizer medía
// `height: 0px; width: 0px` incluso con el contenedor padre teniendo una
// altura real y no-cero). Como AutoSizer por diseño NO renderiza sus hijos
// cuando mide 0, el resultado era "no aparecen los jugadores" sin ningún
// error en consola.
// Este hook hace lo mismo pero con ResizeObserver nativo del browser,
// sin capas de compatibilidad legacy de por medio.
// ─────────────────────────────────────────────────────────────────────────
function useElementSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      setSize(prev => (prev.width === rect.width && prev.height === rect.height)
        ? prev
        : { width: rect.width, height: rect.height });
    };

    updateSize();

    if (typeof ResizeObserver === 'undefined') {
      // Fallback muy defensivo por si el navegador no soporta ResizeObserver
      // (prácticamente ninguno moderno, pero por las dudas no dejar la UI muda).
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }

    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, size];
}

// ─────────────────────────────────────────────────────────────────────────
// Por qué existe este archivo:
// Antes, el marketplace renderizaba TODOS los jugadores visibles (hasta
// `displayCount`, con "Cargar Más") como nodos DOM reales de una vez.
// react-window solo monta las filas/celdas que entran en el viewport (+ un
// margen de "overscan"), así que ahora `filteredPlayers` completo (miles de
// jugadores si no hay filtro) se puede pasar directo, sin paginación manual,
// y el scroll se mantiene fluido porque el DOM nunca tiene más de ~20-30
// player-cards montadas al mismo tiempo.
// ─────────────────────────────────────────────────────────────────────────

// Alto de fila fijo (incluye el gap) — coherente con el alto real de PlayerListItem.
const LIST_ROW_HEIGHT = 84;
const LIST_ROW_GAP = 10;

function buildLockInfo(player, playerLocks, userId, allTeams) {
  const lockInfo = playerLocks[player.Id];
  const isInMyCart = Boolean(lockInfo && lockInfo.lockedBy === userId);
  const isLockedByOther = Boolean(lockInfo && lockInfo.lockedBy !== userId);
  const lockedTeam = isLockedByOther && allTeams ? allTeams[lockInfo.lockedBy] : null;
  return {
    isInMyCart,
    isLockedByOther,
    lockedTeamName: isLockedByOther ? lockInfo.teamName : null,
    lockedTeamLogo: lockedTeam ? lockedTeam.logoUrl : null,
  };
}

function ListRow({ index, style, players, playerLocks, userId, allTeams, countryMap, wishlistSet, comparingIdsSet, onSelectPlayer, onToggleWishlist, onCompare }) {
  const player = players[index];
  if (!player) return null;
  const { isInMyCart, isLockedByOther, lockedTeamName, lockedTeamLogo } = buildLockInfo(player, playerLocks, userId, allTeams);

  return (
    <div style={{ ...style, paddingBottom: LIST_ROW_GAP, boxSizing: 'border-box' }}>
      <PlayerListItem
        player={player}
        countryMap={countryMap}
        onSelectPlayer={onSelectPlayer}
        isInMyCart={isInMyCart}
        isLockedByOther={isLockedByOther}
        lockedTeamName={lockedTeamName}
        lockedTeamLogo={lockedTeamLogo}
        isWishlisted={wishlistSet.has(player.Id)}
        onToggleWishlist={onToggleWishlist}
        onCompare={onCompare}
        isComparing={comparingIdsSet.has(player.Id)}
      />
    </div>
  );
}

export function VirtualizedPlayerList({ players, playerLocks, userId, allTeams, countryMap, wishlistSet, comparingIdsSet, onSelectPlayer, onToggleWishlist, onCompare, overscanCount = 6 }) {
  const [containerRef, { width, height }] = useElementSize();

  const rowProps = useMemo(() => ({
    players, playerLocks, userId, allTeams, countryMap, wishlistSet, comparingIdsSet, onSelectPlayer, onToggleWishlist, onCompare,
  }), [players, playerLocks, userId, allTeams, countryMap, wishlistSet, comparingIdsSet, onSelectPlayer, onToggleWishlist, onCompare]);

  return (
    <div ref={containerRef} style={{ height: '100%', width: '100%' }}>
      {width > 0 && height > 0 && (
        <List
          rowComponent={ListRow}
          rowCount={players.length}
          rowHeight={LIST_ROW_HEIGHT}
          rowProps={rowProps}
          overscanCount={overscanCount}
          style={{ height, width }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Grid: react-window necesita un número de columnas fijo por render (no
// puede "wrappear" solo, como hace CSS grid). `columnCount` se calcula
// afuera (en app.jsx) replicando exactamente los mismos breakpoints de
// Tailwind que antes tenía `gridColumnClass`, para que no cambie el layout
// visual — solo cómo se monta/desmonta el DOM.
// ─────────────────────────────────────────────────────────────────────────

const GRID_ROW_GAP = 12;
const GRID_COLUMN_GAP = 12;
// El alto real de una card lo define `.market-player-card-shell` en index.css
// (height: clamp(124px, 31vw, 238px) — tope de 238px en desktop). Acá se usa
// ese mismo tope + el gap, para que la fila del Grid no le quede de más
// (antes eran 340px fijos, mucho más alto que la card real, y encima se
// forzaba height:100% sobre el shell, pisando su propio clamp() y
// estirándolo — combinación que dejaba un montón de aire vacío debajo de
// la foto).
const GRID_CARD_ASPECT_HEIGHT = 238 + GRID_ROW_GAP;

function GridCell({ columnIndex, rowIndex, style, players, columnCount, playerLocks, userId, allTeams, countryMap, wishlistSet, comparingIdsSet, onSelectPlayer, onToggleWishlist, onCompare }) {
  const index = rowIndex * columnCount + columnIndex;
  const player = players[index];
  if (!player) return <div style={style} />;
  const { isInMyCart, isLockedByOther, lockedTeamName, lockedTeamLogo } = buildLockInfo(player, playerLocks, userId, allTeams);

  return (
    <div
      style={{
        ...style,
        paddingRight: columnIndex < columnCount - 1 ? GRID_COLUMN_GAP : 0,
        paddingBottom: GRID_ROW_GAP,
        boxSizing: 'border-box',
      }}
    >
      <div className="market-player-card-shell">
        <PlayerCard
          player={player}
          countryMap={countryMap}
          onSelectPlayer={onSelectPlayer}
          isInMyCart={isInMyCart}
          isLockedByOther={isLockedByOther}
          lockedTeamName={lockedTeamName}
          lockedTeamLogo={lockedTeamLogo}
          isWishlisted={wishlistSet.has(player.Id)}
          onToggleWishlist={onToggleWishlist}
          onCompare={onCompare}
          isComparing={comparingIdsSet.has(player.Id)}
        />
      </div>
    </div>
  );
}

export function VirtualizedPlayerGrid({ players, columnCount, playerLocks, userId, allTeams, countryMap, wishlistSet, comparingIdsSet, onSelectPlayer, onToggleWishlist, onCompare, overscanCount = 2 }) {
  const [containerRef, { width, height }] = useElementSize();
  const rowCount = Math.ceil(players.length / Math.max(1, columnCount));

  const cellProps = useMemo(() => ({
    players, columnCount, playerLocks, userId, allTeams, countryMap, wishlistSet, comparingIdsSet, onSelectPlayer, onToggleWishlist, onCompare,
  }), [players, columnCount, playerLocks, userId, allTeams, countryMap, wishlistSet, comparingIdsSet, onSelectPlayer, onToggleWishlist, onCompare]);

  return (
    <div ref={containerRef} style={{ height: '100%', width: '100%' }}>
      {width > 0 && height > 0 && (
        <Grid
          cellComponent={GridCell}
          cellProps={cellProps}
          columnCount={columnCount}
          columnWidth={width / Math.max(1, columnCount)}
          rowCount={rowCount}
          rowHeight={GRID_CARD_ASPECT_HEIGHT}
          overscanCount={overscanCount}
          style={{ height, width }}
        />
      )}
    </div>
  );
}
