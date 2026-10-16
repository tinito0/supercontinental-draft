import React, { useMemo } from 'react';
import { Search } from 'lucide-react';
import { PageHeader } from '../ui/PageHeader.jsx';
import { Alert } from '../ui/Alert.jsx';
import { EmptyState } from '../ui/EmptyState.jsx';
import { PlayerPreview } from '../ui/PlayerPreview.jsx';
import { SearchBar } from '../SearchBar.jsx';
import { RecommendationsAccordion } from '../RecommendationsAccordion.jsx';
import { VirtualPlayerResults } from './VirtualPlayerResults.jsx';
import { FranchiseMarketNotice } from './FranchiseMarketNotice.jsx';
import { useHoverPreview } from '../../hooks/useHoverPreview.js';

const SKELETON_COUNT = 12;

function ResultsSkeleton({ viewMode }) {
  return (
    <div className="space-y-3" role="status" aria-label="Cargando jugadores">
      <p className="text-xs text-ink-3">Cargando la base de datos de PES 2021…</p>
      {viewMode === 'list' ? (
        <div className="space-y-2" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-[70px] rounded-xl" />)}
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-[repeat(auto-fill,minmax(148px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(176px,1fr))]" aria-hidden="true">
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <div key={i} className="rounded-xl border border-line/[0.12] bg-surface overflow-hidden">
              <div className="skeleton aspect-square rounded-none" />
              <div className="p-2.5 space-y-2"><div className="skeleton h-3.5 w-3/4" /><div className="skeleton h-4 w-1/2" /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Marketplace tab ("Mercado de pases"): header, toolbar, alerts, recommendations and the virtualized results.
 * The page (#main-content) is the only scroller; state lives in app.jsx.
 */
export function MarketplaceView({
  isActive, isMobileViewport,
  filters, setFilters, resetFilters, onClearSearchAndFilters, onOpenFilters,
  sortConfig, setSortConfig, viewMode, setViewMode, density, setDensity,
  players, isCatalogLoading, playersLoadError, countriesLoadError, onRetryCatalog,
  budgetPercent, recommendations, showBudgetExhausted,
  isFranchiseMarket = false, hasUsedFranchise = false, franchisePlayerName = null,
  playerLocks, userId, allTeams, wishlistSet, comparingIdsSet,
  onSelectPlayer, onToggleWishlist, onCompare,
}) {
  const hoverPreview = useHoverPreview(400);
  const showPreview = !isMobileViewport && viewMode === 'grid';
  const resetKey = useMemo(() => JSON.stringify([filters, sortConfig]), [filters, sortConfig]);

  return (
    <div data-app-tour="marketplace" className={isActive ? 'animate-in fade-in' : 'hidden'}>
      <PageHeader eyebrow="Mercado" title="Mercado de pases" className="mb-5"
        description="Buscá, compará y fichá jugadores. Los que tienen candado ya son de otro club." />
      {isFranchiseMarket && (
        <FranchiseMarketNotice hasUsedFranchise={hasUsedFranchise} franchisePlayerName={franchisePlayerName} className="mb-5" />
      )}
      <SearchBar
        filters={filters}
        setFilters={setFilters}
        resetFilters={resetFilters}
        setIsFiltrosModalVisible={onOpenFilters}
        sortConfig={sortConfig}
        setSortConfig={setSortConfig}
        viewMode={viewMode}
        setViewMode={setViewMode}
        density={density}
        setDensity={setDensity}
        totalCount={players.length}
      />

      {(playersLoadError || countriesLoadError) && (
        <div className="mb-4 space-y-2">
          {playersLoadError && (
            <Alert tone="danger" title="No se pudo cargar la base de jugadores"
              action={<button type="button" onClick={onRetryCatalog} className="btn btn-danger btn-sm">Reintentar</button>}>
              {playersLoadError}
            </Alert>
          )}
          {countriesLoadError && <Alert tone="warning">{countriesLoadError}</Alert>}
        </div>
      )}

      {budgetPercent <= 20 && budgetPercent > 0 && (
        <Alert tone={budgetPercent <= 10 ? 'danger' : 'warning'} className="mb-4">
          Te queda menos del <span className="num">{budgetPercent <= 10 ? 10 : 20}%</span> del presupuesto: el saldo exacto está arriba, junto al escudo.
        </Alert>
      )}

      {recommendations.length > 0 && (
        <RecommendationsAccordion recommendations={recommendations} onSelectPlayer={onSelectPlayer} />
      )}
      {showBudgetExhausted && (
        <Alert tone="info" title="Tu presupuesto no alcanza para más fichajes" className="mb-5">
          Liberá jugadores o negociá ventas desde «Plantel y finanzas» para ampliar el saldo.
        </Alert>
      )}

      {isCatalogLoading ? (
        <ResultsSkeleton viewMode={viewMode} />
      ) : players.length === 0 ? (
        <EmptyState icon={Search} title="No se encontraron jugadores" className="my-6"
          description={filters.name ? `Ningún jugador coincide con «${filters.name}» y los filtros actuales.` : 'Ningún jugador coincide con los filtros actuales.'}>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
            <button type="button" onClick={onClearSearchAndFilters} className="btn btn-primary">
              {filters.name ? 'Borrar búsqueda y filtros' : 'Restablecer filtros'}
            </button>
            <button type="button" onClick={onOpenFilters} className="btn btn-secondary">Ajustar filtros</button>
          </div>
        </EmptyState>
      ) : (
        <VirtualPlayerResults
          players={players}
          resetKey={resetKey}
          viewMode={viewMode}
          density={density}
          playerLocks={playerLocks}
          userId={userId}
          allTeams={allTeams}
          wishlistSet={wishlistSet}
          comparingIdsSet={comparingIdsSet}
          onSelectPlayer={onSelectPlayer}
          onToggleWishlist={onToggleWishlist}
          onCompare={onCompare}
          onPlayerMouseEnter={showPreview ? hoverPreview.show : undefined}
          onPlayerMouseLeave={showPreview ? hoverPreview.hide : undefined}
        />
      )}

      {showPreview && (
        <PlayerPreview player={hoverPreview.player} isVisible={hoverPreview.isVisible} position={hoverPreview.position} />
      )}
    </div>
  );
}
