import React, { useRef } from 'react';
import { nextRadioIndex } from '../../utils/scoutView.js';

/** How long a scout takes, as text: «30 min», «1 hora», «2 horas» (short: «30 min», «1 h»). */
export function scoutDurationLabel(scout, isShort = false) {
  const minutes = Math.round(Number(scout?.durationHours || 12) * 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  if (isShort) return `${hours} h`;
  return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
}

/** Radio group of scouts: one tab stop (the selected one), arrows/Home/End move the selection. */
export function ScoutPicker({ scouts, selectedId, onSelect, disabled }) {
  const refs = useRef({});

  const handleKeyDown = (event, index) => {
    const next = nextRadioIndex(event.key, index, scouts.length, () => disabled);
    if (next < 0) return;
    event.preventDefault();
    const scout = scouts[next];
    onSelect(scout.id);
    refs.current[scout.id]?.focus();
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3" role="radiogroup" aria-label="Ojeador">
      {scouts.map((scout, index) => {
        const selected = selectedId === scout.id;
        return (
          <button
            key={scout.id}
            ref={el => { refs.current[scout.id] = el; }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            title={disabled ? 'Ya usaste las búsquedas de este mes' : scout.description || undefined}
            onClick={() => onSelect(scout.id)}
            onKeyDown={event => handleKeyDown(event, index)}
            className={`min-h-[88px] rounded-xl border p-3 text-left transition-colors flex gap-3 overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed ${
              selected ? 'bg-accent/10 border-accent' : 'bg-raised border-line/[0.12] hover:border-line/30'
            }`}
          >
            <span className="w-14 h-14 rounded-lg overflow-hidden bg-surface flex-shrink-0 flex items-center justify-center">
              {scout.imageUrl ? (
                <img src={scout.imageUrl} alt="" width={56} height={56} className="w-full h-full object-cover object-top"
                  onError={e => {
                    if (e.currentTarget.src.endsWith('.webp')) e.currentTarget.src = '/scouts/fefe-farfan.png';
                    else e.currentTarget.style.display = 'none';
                  }} />
              ) : (
                <span className="font-display text-lg font-bold text-ink-2">{scout.name.slice(0, 2).toUpperCase()}</span>
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink truncate">{scout.name}</span>
              <span className="block text-xs text-ink-3 mt-0.5">Calidad <span className="num text-ink-2">{scout.quality}</span> · {scout.testDurationSeconds ? '1 seg' : scoutDurationLabel(scout, true)}</span>
              <span className="block text-xs text-ink-3 line-clamp-2 mt-0.5">{scout.specialty}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
