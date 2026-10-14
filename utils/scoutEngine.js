import { getRegionById } from './helpers.js';

export const RESULT_COUNT_MIN = 3;
export const RESULT_COUNT_MAX = 5;

export const positionGroups = {
  Delantero: ['DC', 'SD', 'EI', 'ED'],
  Mediocampista: ['MC', 'MCD', 'MO', 'MI', 'MD'],
  Defensor: ['DFC', 'LI', 'LD'],
  Arquero: ['PT'],
};

function matchRange(value, min, max, variance = 0) {
  const numberValue = Number(value) || 0;
  const minValue = min === '' || min == null ? null : Number(min) - variance;
  const maxValue = max === '' || max == null ? null : Number(max) + variance;
  if (minValue != null && numberValue < minValue) return false;
  if (maxValue != null && numberValue > maxValue) return false;
  return true;
}

/**
 * Genera candidatos de scouting filtrando y ponderando según calidad del ojeador y criterios.
 */
export function buildResults({ allPlayers, criteria, scout, playerLocks }) {
  if (!Array.isArray(allPlayers) || allPlayers.length === 0) return [];

  const quality = Number(scout?.quality) || 65;
  const variance = Math.max(0, Math.round((100 - quality) / 9));
  const lockedIds = new Set(Object.keys(playerLocks || {}).map(String));
  const wantedStats = criteria.stats || [];
  const wantedTraits = criteria.traits || [];
  const wantedPositions = criteria.positions || [];
  const groupPositions = criteria.positionGroup ? positionGroups[criteria.positionGroup] || [] : [];
  const considerBudget = criteria.considerBudget !== 'ignorar';
  const budgetMax = criteria.budgetMax === '' || criteria.budgetMax == null ? null : Number(criteria.budgetMax);

  const matchesPosition = (player) => {
    if (wantedPositions.length > 0) {
      return wantedPositions.some(pos => player.POS_NOMBRE === pos || Number(player[`Aptitude${pos}`] || 0) >= 2);
    }
    if (groupPositions.length > 0) {
      return groupPositions.includes(player.POS_NOMBRE) || groupPositions.some(pos => Number(player[`Aptitude${pos}`] || 0) >= 2);
    }
    return true;
  };

  const strict = allPlayers.filter(player => {
    if (lockedIds.has(String(player.Id))) return false;
    if (!matchesPosition(player)) return false;
    if (considerBudget && budgetMax != null && Number(player.Precio || 0) > budgetMax + variance) return false;
    if (criteria.countryId && String(player.Country1) !== String(criteria.countryId) && String(player.Country2) !== String(criteria.countryId)) return false;
    if (criteria.region && getRegionById(player.Country1) !== criteria.region) return false;
    if (!matchRange(player.Age, criteria.minAge, criteria.maxAge, variance)) return false;
    if (!matchRange(player.OVR_CALCULADO, criteria.minOvr, criteria.maxOvr, variance)) return false;
    if (!wantedStats.every(item => Number(player[item.key] || 0) >= Number(item.min || 0) - variance)) return false;
    if (!wantedTraits.every(key => Boolean(player[key]))) return false;
    return true;
  });

  const pool = strict.length >= RESULT_COUNT_MIN
    ? strict
    : allPlayers.filter(player => !lockedIds.has(String(player.Id)));

  const scored = pool.map(player => {
    let score = 0;
    if (wantedPositions.includes(player.POS_NOMBRE)) score += 34;
    else if (matchesPosition(player)) score += 22;
    if (criteria.countryId && (String(player.Country1) === String(criteria.countryId) || String(player.Country2) === String(criteria.countryId))) score += 15;
    if (criteria.region && getRegionById(player.Country1) === criteria.region) score += 12;
    if (considerBudget && budgetMax != null) score -= Math.max(0, Number(player.Precio || 0) - budgetMax) * 2;
    if (criteria.minOvr !== '') score -= Math.abs(Number(player.OVR_CALCULADO) - Number(criteria.minOvr)) * 0.8;
    if (criteria.maxOvr !== '') score -= Math.max(0, Number(player.OVR_CALCULADO) - Number(criteria.maxOvr));
    if (criteria.minAge !== '') score -= Math.max(0, Number(criteria.minAge) - Number(player.Age)) * 0.5;
    if (criteria.maxAge !== '') score -= Math.max(0, Number(player.Age) - Number(criteria.maxAge)) * 0.5;
    wantedStats.forEach(item => {
      score += Math.min(18, Math.max(-10, Number(player[item.key] || 0) - Number(item.min || 0)));
    });
    wantedTraits.forEach(key => {
      if (player[key]) score += 8;
    });
    if (criteria.attention === 'overall') score += Number(player.OVR_CALCULADO || 0) * 0.35;
    if (criteria.attention === 'skill') score += wantedStats.reduce((sum, item) => sum + Number(player[item.key] || 0), 0) * 0.08;
    if (criteria.attention === 'potential') score += Math.max(0, 30 - Number(player.Age || 99));
    score += Math.random() * (110 - quality);
    return { player, score };
  }).sort((a, b) => b.score - a.score);

  const amount = Math.min(scored.length, RESULT_COUNT_MIN + Math.floor(Math.random() * (RESULT_COUNT_MAX - RESULT_COUNT_MIN + 1)));
  return scored.slice(0, amount).map(({ player }) => ({
    Id: player.Id,
    Name: player.Name,
    POS_NOMBRE: player.POS_NOMBRE,
    Age: player.Age,
    OVR_CALCULADO: player.OVR_CALCULADO,
    Precio: player.Precio,
    Country1: player.Country1,
    Speed: player.Speed,
    Finishing: player.Finishing,
    BallControl: player.BallControl,
  }));
}

/**
 * Versión asíncrona no bloqueante que resuelve el cálculo de scouting
 * en tiempo ocioso del hilo principal (requestIdleCallback con fallback de setTimeout).
 */
export function buildResultsAsync(params) {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        resolve(buildResults(params));
      }, { timeout: 250 });
    } else {
      setTimeout(() => {
        resolve(buildResults(params));
      }, 0);
    }
  });
}
