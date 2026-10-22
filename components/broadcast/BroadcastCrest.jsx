import React, { useState } from 'react';
import { DEFAULT_LOGO } from '../../utils/constants.js';

/** Nombres que no entran a tamaño completo en una tarjeta («Esportivo Lusitano do Recife»): se achican un poco. */
export const isLongName = name => String(name || '').trim().length > 16;

const initialsOf = name => String(name || '')
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map(word => word[0])
  .join('')
  .toUpperCase();

/**
 * Escudo de un club en la transmisión. Sin escudo cargado (o si la imagen falla) muestra las iniciales del club en
 * vez del escudo genérico de la liga, que hacía que todos los clubes sin escudo parecieran el mismo.
 * @param {{ name?: string, logo?: string | null, className?: string }} props
 */
export function BroadcastCrest({ name, logo, className = '' }) {
  // Se recuerda qué imagen falló (no un booleano): si el escudo cambia, se vuelve a intentar.
  const [failedSrc, setFailedSrc] = useState(null);
  const hasLogo = Boolean(logo) && logo !== DEFAULT_LOGO && failedSrc !== logo;
  if (hasLogo) {
    return <img className={className} src={logo} alt="" onError={() => setFailedSrc(logo)} />;
  }
  const initials = initialsOf(name);
  // Lugar sin club todavía («A definir»): un hueco discreto, no un escudo.
  if (!initials) return <span className={`${className} scl-crest-empty`} aria-hidden="true" />;
  return (
    <span className={`${className} scl-crest-initials`} aria-hidden="true">
      {initials}
    </span>
  );
}

export default BroadcastCrest;
