import React, { memo } from 'react';
import { FILTER_SKILL_KEYS, PLAYER_SKILLS_MAP } from '../../utils/constants.js';
import { OWN_SUMMARY_SKILLS, PLAYING_STYLE_GROUPS, PLAYING_STYLE_INFO, PLAYING_STYLE_POSITIONS, SKILL_INFO } from '../../utils/playerGlossary.js';

function Entry({ name, aka, tag, positions, children }) {
  return (
    <div className="py-3 sm:grid sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
      <dt className="text-base font-semibold text-ink">
        {name}
        {aka && <span className="block text-sm font-medium text-ink-2">También: {aka}</span>}
        {tag && <span className="block text-sm font-medium text-ink-2">{tag}</span>}
        {positions && (
          <span className="block text-sm font-medium text-ink-2 num">
            <span className="sr-only">Posiciones: </span>{positions.join(' · ')}
          </span>
        )}
      </dt>
      <dd className="mt-1 sm:mt-0 sm:max-w-[62ch] space-y-1.5">{children}</dd>
    </div>
  );
}

function StyleText({ summary, detail, warning, examples }) {
  return (
    <>
      <p className="text-base font-medium leading-relaxed text-ink">{summary}</p>
      {detail && <p className="text-base leading-relaxed text-ink-2">{detail}</p>}
      {warning && <p className="text-base leading-relaxed text-ink-2"><span className="font-semibold text-ink">Ojo:</span> {warning}</p>}
      {examples?.length > 0 && <p className="text-sm text-ink-2"><span className="font-semibold text-ink">Ejemplos:</span> {examples.join(', ')}.</p>}
    </>
  );
}

function Group({ title, note, children }) {
  return (
    <div>
      <h5 className="eyebrow eyebrow-strong">{title}</h5>
      {note && <p className="text-sm text-ink-2 mt-1">{note}</p>}
      <dl className="mt-2 divide-y divide-line/10">{children}</dl>
    </div>
  );
}

const skillEntries = keys => keys.map(key => (
  <Entry key={key} name={PLAYER_SKILLS_MAP[key]} tag={OWN_SUMMARY_SKILLS.includes(key) ? 'Resumen propio' : undefined}>
    <p className="text-base leading-relaxed text-ink">{SKILL_INFO[key]}</p>
  </Entry>
));

/**
 * What each playing style (`PlayingStyle` field) and each skill does, in the order the filters list them.
 * Static content: memo keeps the ~70 entries from re-rendering on every filter click in the dialog.
 */
export const PlayerGlossary = memo(function PlayerGlossary() {
  return (
    <div className="space-y-8">
      <section aria-labelledby="glossary-styles" className="space-y-5">
        <h4 id="glossary-styles" className="section-title">Estilos de juego</h4>
        {PLAYING_STYLE_GROUPS.map(group => (
          <Group key={group.title} title={group.title}>
            {group.styles.map(style => {
              const info = PLAYING_STYLE_INFO[style];
              return (
                <Entry key={style} name={style} aka={info.aka} positions={PLAYING_STYLE_POSITIONS[style]}>
                  <StyleText {...info} />
                </Entry>
              );
            })}
          </Group>
        ))}
      </section>

      <section aria-labelledby="glossary-skills" className="space-y-5">
        <div>
          <h4 id="glossary-skills" className="section-title">Habilidades</h4>
          <p className="text-sm text-ink-2 mt-1">Textos del juego. Los marcados «Resumen propio» todavía no se compararon con el juego.</p>
        </div>
        <dl className="divide-y divide-line/10">{skillEntries(FILTER_SKILL_KEYS)}</dl>
      </section>
    </div>
  );
});
