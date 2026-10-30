import React from 'react';
import { PLAYER_SKILLS_MAP } from '../../utils/constants.js';
import { COM_STYLE_KEYS, PLAYING_STYLE_GROUPS, PLAYING_STYLE_INFO, SKILL_INFO } from '../../utils/playerGlossary.js';

function Entry({ name, text }) {
  return (
    <div className="py-2.5 sm:grid sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm font-semibold text-ink">{name}</dt>
      <dd className="text-sm text-ink-2 mt-0.5 sm:mt-0">{text}</dd>
    </div>
  );
}

function Group({ title, note, children }) {
  return (
    <div>
      <h5 className="eyebrow">{title}</h5>
      {note && <p className="text-xs text-ink-3 mt-1">{note}</p>}
      <dl className="mt-2 divide-y divide-line/10">{children}</dl>
    </div>
  );
}

const skillEntries = keys => keys.map(key => <Entry key={key} name={PLAYER_SKILLS_MAP[key]} text={SKILL_INFO[key]} />);

/** Qué hace cada estilo de juego (campo `PlayingStyle`) y cada habilidad, en el orden en que aparecen los filtros. */
export function PlayerGlossary() {
  const comKeys = COM_STYLE_KEYS.filter(key => PLAYER_SKILLS_MAP[key]);
  const skillKeys = Object.keys(PLAYER_SKILLS_MAP).filter(key => !COM_STYLE_KEYS.includes(key));
  return (
    <div className="space-y-8">
      <section aria-labelledby="glossary-styles" className="space-y-5">
        <h4 id="glossary-styles" className="section-title">Estilos de juego</h4>
        {PLAYING_STYLE_GROUPS.map(group => (
          <Group key={group.title} title={group.title}>
            {group.styles.map(style => <Entry key={style} name={style} text={PLAYING_STYLE_INFO[style]} />)}
          </Group>
        ))}
      </section>

      <section aria-labelledby="glossary-skills" className="space-y-5">
        <h4 id="glossary-skills" className="section-title">Habilidades</h4>
        <Group title="Habilidades del jugador">{skillEntries(skillKeys)}</Group>
        <Group title="Estilos COM" note="Los marca el juego en la ficha y se filtran junto con las habilidades.">
          {skillEntries(comKeys)}
        </Group>
      </section>
    </div>
  );
}
