import { COUNTRY_CODE_MAP, REGION_COUNTRIES } from './constants.js';

export const currencyFormatter = new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
  style: 'decimal',
});

export function formatPrice(priceInMillions) {
  if (typeof priceInMillions !== 'number' || isNaN(priceInMillions)) return "0";
  return currencyFormatter.format(priceInMillions * 1000000);
}

export function formatPriceShort(priceInMillions) {
  if (typeof priceInMillions !== 'number' || isNaN(priceInMillions)) return "$0M";
  return `$${priceInMillions.toFixed(2)}M`;
}

export function formatBudget(amount) {
  return currencyFormatter.format(amount);
}

export const getRegionById = (countryId) => {
  const id = parseInt(countryId, 10);
  if (isNaN(id)) return 'Otras';
  
  for (const [region, ids] of Object.entries(REGION_COUNTRIES)) {
    if (ids.includes(id)) return region;
  }
  
  return 'Otras';
};

export function normalizarString(text) {
  if (typeof text !== 'string') return "";
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function processPlayersData(playersData) {
  return playersData.map(p => ({
    ...p,
    searchableName: p.Name ? normalizarString(p.Name) : "",
    Precio: Number(p.Precio) || 0,
    Age: Number(p.Age) || 0,
    OVR_CALCULADO: Number(p.OVR_CALCULADO) || 0
  }));
}

export function getPosColorClass(posNombre) {
  switch (posNombre) {
    case 'DC':
    case 'SD':
    case 'EI':
    case 'ED':
      return 'pos-delantero';
    case 'MC':
    case 'MCD':
    case 'MO':
    case 'MI':
    case 'MD':
      return 'pos-medio';
    case 'DFC':
    case 'LI':
    case 'LD':
      return 'pos-defensa';
    case 'PT':
      return 'pos-portero';
    default:
      return 'pos-default';
  }
}

// ── Shared position color system (single source of truth) ──────────────
// Used by: Pitch.jsx, PlayerCard, PlayerModal, FormationViewScreen
export const POSITION_COLORS = {
  forward:  { ring: 'border-red-400',    bg: 'bg-red-900/80',    badge: 'bg-red-700 border-red-500',    text: 'text-red-400',    glow: 'rgba(248,113,113,0.4)' },
  midfield: { ring: 'border-green-400',  bg: 'bg-green-900/80',  badge: 'bg-green-700 border-green-500',text: 'text-green-400',  glow: 'rgba(74,222,128,0.4)' },
  defense:  { ring: 'border-blue-400',   bg: 'bg-blue-900/80',   badge: 'bg-blue-700 border-blue-500',  text: 'text-blue-400',   glow: 'rgba(96,165,250,0.4)' },
  keeper:   { ring: 'border-yellow-400', bg: 'bg-yellow-900/80', badge: 'bg-yellow-600 border-yellow-400',text: 'text-yellow-400',glow: 'rgba(250,204,21,0.4)' },
  none:     { ring: 'border-gray-600',   bg: 'bg-gray-800',      badge: 'bg-gray-700 border-gray-500',  text: 'text-gray-400',   glow: 'rgba(156,163,175,0.2)' },
};

export function getPosCategory(posName) {
  if (['DC', 'SD', 'EI', 'ED'].includes(posName)) return 'forward';
  if (['MC', 'MCD', 'MO', 'MI', 'MD'].includes(posName)) return 'midfield';
  if (['DFC', 'LI', 'LD'].includes(posName)) return 'defense';
  if (posName === 'PT') return 'keeper';
  return 'none';
}

export function getPitchPosColors(posName) {
  return POSITION_COLORS[getPosCategory(posName)] || POSITION_COLORS.none;
}

export function getOvrBadgeColor(ovr) {
  const v = Number(ovr) || 0;
  if (v >= 85) return 'bg-emerald-500';
  if (v >= 70) return 'bg-yellow-500';
  return 'bg-orange-500';
}

export function getStatAndOvrColorClass(value) {
  const val = parseInt(value, 10);
  if (val >= 90) return 'stat-c-90';
  if (val >= 80) return 'stat-c-80';
  if (val >= 70) return 'stat-c-70';
  if (val >= 60) return 'stat-c-60';
  if (val >= 50) return 'stat-c-50';
  return 'stat-c-default';
}

export function getPosColor(valorAptitud) {
  const apt = Number(valorAptitud);
  if (apt === 3) return { bgColor: '#00b34a', textColor: '#ffffff' };
  if (apt === 2) return { bgColor: '#a0dd00', textColor: '#1e1e1e' };
  if (apt === 1) return { bgColor: '#ffc400', textColor: '#1e1e1e' };
  return { bgColor: '#333', textColor: '#777' };
}

export function getFlagCode(countryId) {
  if (!countryId) return 'NA';
  const isoCode = COUNTRY_CODE_MAP[String(countryId)];
  return isoCode ? isoCode.toLowerCase() : 'NA';
}

export function getFlagUrl(countryId) {
  const code = getFlagCode(countryId);
  if (code === 'na' || code === 'NA') {
    return "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMCAyMCI+PHJlY3Qgd2lkdGg9IjMwIiBoZWlnaHQ9IjIwIiBmaWxsPSIjNzc3NzciLz48cGF0aCBkPSJNMCAxNSBoMzAgbDAgNSBoLTMwIHoiIGZpbGw9IiM0NDQiLz48L3N2Zy>";
  }
  return `https://flagcdn.com/24x18/${code}.png`;
}
