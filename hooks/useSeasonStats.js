import { useEffect, useMemo, useState } from 'react';
import { loadMarketCatalog, useMatchLines, useTournament } from './useLeagueData.js';
import { importedMatchKeys, importedRounds } from '../utils/collectorImport.js';
import { buildSeasonStats } from '../utils/seasonStats.js';

/* Estadísticas de temporada del sitio de la liga: las líneas de match_lines de los partidos importados al torneo
   (los oficiales), sumadas por utils/seasonStats.js. Aparte de useLeagueData para no sumar collectorImport a todas
   las pantallas. */

/**
 * @returns {{ stats: object, docs: object[], officialKeys: Set<string>, rounds: Array<{ round: string, keys: string[] }>, loading: boolean, error: string }}
 */
export function useSeasonStats() {
  const lines = useMatchLines();
  const { tournament, loading: tournamentLoading, error: tournamentError } = useTournament();
  const officialKeys = useMemo(() => importedMatchKeys(tournament), [tournament]);
  const rounds = useMemo(() => importedRounds(tournament), [tournament]);
  const stats = useMemo(() => buildSeasonStats(lines.docs, { officialKeys }), [lines.docs, officialKeys]);
  return {
    stats,
    docs: lines.docs,
    officialKeys,
    rounds,
    loading: lines.loading || tournamentLoading,
    error: lines.error || tournamentError,
  };
}

/**
 * Catálogo del mercado (id → [precio, edad, OVR, nombre, posición, país]) para nombre, posición y OVR de un jugador.
 * null hasta que llega o si falla: la página funciona sin él.
 */
export function useMarketCatalog() {
  const [catalog, setCatalog] = useState(null);
  useEffect(() => {
    let active = true;
    loadMarketCatalog()
      .then(data => { if (active) setCatalog(data); })
      .catch(err => console.warn('[useMarketCatalog] sin catálogo:', err));
    return () => { active = false; };
  }, []);
  return catalog;
}

/** Ficha del catálogo de un jugador, o null. */
export function catalogEntry(catalog, playerId) {
  const row = catalog?.[playerId];
  if (!Array.isArray(row)) return null;
  const [, age, ovr, name, position] = row;
  return { age, ovr, name, position };
}
