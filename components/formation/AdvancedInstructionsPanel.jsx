import React, { memo, useState } from 'react';
import { Shield, Zap, X, ArrowLeftRight } from 'lucide-react';
import { ADVANCED_INSTRUCTIONS, MAX_PER_SIDE, instructionByCode } from '../../utils/advancedInstructions.js';

const SIDE_META = {
  attack: { title: 'Instrucciones avanzadas de ataque', icon: Zap, slot: 'Ataque' },
  defense: { title: 'Instrucciones avanzadas de defensa', icon: Shield, slot: 'Defensa' },
};

/**
 * Two attacking and two defensive advanced instructions (the game's slots). Picking a third on a full side is
 * refused with a message; "Cambiar" on a chosen one lets the next pick replace it.
 * @param {{ value: { attack: number[], defense: number[] }, onToggle: (side, code) => void,
 *   onReplace: (side, index, code) => void }} props
 */
export const AdvancedInstructionsPanel = memo(function AdvancedInstructionsPanel({ value, onToggle, onReplace }) {
  const [replacing, setReplacing] = useState(null); // { side, index }
  const [notice, setNotice] = useState(null); // { side, text }

  const pick = (side, code) => {
    setNotice(null);
    if (replacing?.side === side) { onReplace(side, replacing.index, code); setReplacing(null); return; }
    const chosen = value[side];
    if (!chosen.includes(code) && chosen.length >= MAX_PER_SIDE) {
      setNotice({ side, text: `Ya elegiste ${MAX_PER_SIDE}. Quitá una o tocá «Cambiar» para reemplazarla.` });
      return;
    }
    onToggle(side, code);
  };

  return (
    <div className="space-y-5 pt-4 border-t border-line/[0.08]">
      {['attack', 'defense'].map(side => {
        const { title, icon: Icon, slot } = SIDE_META[side];
        const chosen = value[side];
        const full = chosen.length >= MAX_PER_SIDE;
        return (
          <section key={side} className="space-y-2" aria-labelledby={`adv-${side}`}>
            <div className="flex items-center justify-between gap-2">
              <h3 id={`adv-${side}`} className="eyebrow flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" aria-hidden="true" />{title}</h3>
              <span className="text-[11px] text-ink-3 num" aria-live="polite">{chosen.length} de {MAX_PER_SIDE}</span>
            </div>

            <ol className="grid grid-cols-2 gap-1.5">
              {Array.from({ length: MAX_PER_SIDE }, (_, i) => {
                const ins = chosen[i] != null ? instructionByCode(chosen[i]) : null;
                const isReplacing = replacing?.side === side && replacing.index === i;
                return (
                  <li key={i} className={`min-h-14 rounded-lg border px-2 py-1.5 text-xs ${isReplacing ? 'border-warning/60 bg-warning/10' : ins ? 'border-accent/40 bg-accent/10' : 'border-dashed border-line/20 text-ink-3'}`}>
                    <span className="block text-[11px] uppercase tracking-wide text-ink-3">{slot} {i + 1}</span>
                    {ins ? (
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-semibold text-ink leading-tight">{ins.name}</span>
                        <span className="flex shrink-0">
                          <button type="button" onClick={() => setReplacing(isReplacing ? null : { side, index: i })} aria-pressed={isReplacing}
                            className="p-1 rounded hover:bg-white/10" aria-label={`Cambiar ${ins.name}`} title="Cambiar por otra"><ArrowLeftRight className="w-3.5 h-3.5" /></button>
                          <button type="button" onClick={() => { onToggle(side, ins.code); setReplacing(null); }}
                            className="p-1 rounded hover:bg-white/10" aria-label={`Quitar ${ins.name}`} title="Quitar"><X className="w-3.5 h-3.5" /></button>
                        </span>
                      </div>
                    ) : <span>Sin elegir</span>}
                    {isReplacing && <span className="block mt-0.5 text-[11px] text-warning-soft">Elegí la instrucción que la reemplaza.</span>}
                  </li>
                );
              })}
            </ol>

            <div className="grid gap-1.5">
              {ADVANCED_INSTRUCTIONS[side].map(ins => {
                const selected = chosen.includes(ins.code);
                const blocked = full && !selected && replacing?.side !== side;
                return (
                  <button key={ins.code} type="button" onClick={() => pick(side, ins.code)} aria-pressed={selected} aria-disabled={blocked}
                    className={`text-left rounded-lg border px-2.5 py-2 transition-colors ${selected ? 'border-accent/60 bg-accent/15' : blocked ? 'border-line/[0.08] opacity-50' : 'border-line/[0.12] hover:border-line/30'}`}>
                    <span className="flex items-center justify-between gap-2 text-sm font-medium text-ink">
                      {ins.name}
                      {!ins.verified && <span className="chip text-[11px]" title="PES Editor Rebuilt lo marca como probable">probable</span>}
                    </span>
                    <span className="block text-[11px] text-ink-3 leading-snug mt-0.5">{ins.description}</span>
                  </button>
                );
              })}
            </div>
            {notice?.side === side && <p role="status" className="text-[11px] text-warning-soft">{notice.text}</p>}
          </section>
        );
      })}
      <p className="text-[11px] text-ink-3 leading-relaxed">
        Se guardan con tu equipo y se escriben en el EDIT al pasar el draft al juego (dos de ataque y dos de defensa, como en PES 2021).
        «Delantero liberado» necesita que elijas el delantero dentro del juego; sin eso el juego la muestra como «No».
      </p>
    </div>
  );
});
