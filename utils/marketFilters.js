// Active marketplace filters as removable chips: the single source for the toolbar chips, the "Filtros" count
// and the filters dialog. The name search is a search, not a filter, so it is never a chip or counted.
import { DETAILED_STAT_KEYS, PLAYER_SKILLS_MAP, STAT_NAMES_MAP } from './constants.js';

const DETAILED_STATS = Object.values(DETAILED_STAT_KEYS).flat();

const RANGE_CHIPS = [
  { id: 'ovr', minKey: 'ovrMin', maxKey: 'ovrMax', label: (min, max) => `OVR ${min || '0'}–${max || '99'}` },
  { id: 'age', minKey: 'ageMin', maxKey: 'ageMax', label: (min, max) => `Edad ${min || '15'}–${max || '45'}` },
  { id: 'price', minKey: 'priceMin', maxKey: 'priceMax', label: (min, max) => `Precio $${min || '0'}M–${max ? `$${max}M` : '∞'}` },
];

const VALUE_CHIPS = [
  ['pos', 'Posición'], ['foot', 'Pie'], ['country', 'País'], ['region', 'Región'], ['playingStyle', 'Estilo'],
];

/**
 * @param {object} filters marketplace filter state (see initialFilters in app.jsx)
 * @returns {{ id: string, label: string, clear: (prev: object) => object }[]} chips in display order
 */
export function getActiveFilterChips(filters) {
  const chips = [];
  RANGE_CHIPS.forEach(({ id, minKey, maxKey, label }) => {
    if (filters[minKey] || filters[maxKey]) {
      chips.push({ id, label: label(filters[minKey], filters[maxKey]), clear: prev => ({ ...prev, [minKey]: '', [maxKey]: '' }) });
    }
  });
  VALUE_CHIPS.forEach(([key, name]) => {
    if (filters[key]) chips.push({ id: key, label: `${name} ${filters[key]}`, clear: prev => ({ ...prev, [key]: '' }) });
  });
  Object.entries(filters.grupos || {}).forEach(([group, enabled]) => {
    if (enabled) chips.push({ id: `grupo-${group}`, label: group, clear: prev => ({ ...prev, grupos: { ...prev.grupos, [group]: false } }) });
  });
  Object.entries(filters.skills || {}).forEach(([skill, enabled]) => {
    if (enabled) {
      chips.push({ id: `skill-${skill}`, label: PLAYER_SKILLS_MAP[skill] || skill, clear: prev => ({ ...prev, skills: { ...prev.skills, [skill]: false } }) });
    }
  });
  DETAILED_STATS.forEach(stat => {
    const min = filters[`${stat}Min`];
    const max = filters[`${stat}Max`];
    if (min || max) {
      chips.push({
        id: `stat-${stat}`,
        label: `${STAT_NAMES_MAP[stat] || stat} ${min || '0'}–${max || '99'}`,
        clear: prev => ({ ...prev, [`${stat}Min`]: '', [`${stat}Max`]: '' }),
      });
    }
  });
  if (filters.wishlistOnly) chips.push({ id: 'wishlist', label: 'Solo favoritos', clear: prev => ({ ...prev, wishlistOnly: false }) });
  return chips;
}

/** Number shown on the "Filtros" button: every chip except "Solo favoritos", which has its own toggle. */
export function countActiveFilters(filters) {
  return getActiveFilterChips(filters).filter(chip => chip.id !== 'wishlist').length;
}

/** True when a min/max pair is inverted (both set and min > max). */
export function isInvertedRange(min, max) {
  if (min === '' || min == null || max === '' || max == null) return false;
  return Number(min) > Number(max);
}
