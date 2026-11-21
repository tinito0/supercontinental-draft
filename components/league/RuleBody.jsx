import React from 'react';
import { toRuleBlocks } from '../../utils/ruleText.js';

/** "Label: text" with the label in full ink; the rest keeps the body colour. */
function Labeled({ label, text }) {
  if (!label) return text;
  return <><strong className="font-semibold text-ink">{label}:</strong> {text}</>;
}

/** A rules chapter's text with its subtitles and lists (utils/ruleText.js); always rendered as text, never HTML. */
export function RuleBody({ body }) {
  return (
    <div className="max-w-[68ch] space-y-4 text-base leading-[1.7] text-ink/[0.88] sm:text-[17px]">
      {toRuleBlocks(body).map((block, index) => {
        if (block.type === 'subtitle') {
          return <h3 key={index} className="!mt-9 font-display text-[22px] font-bold leading-tight tracking-wide text-ink first:!mt-0">{block.text}</h3>;
        }
        if (block.type === 'bullets') {
          return (
            <ul key={index} className="list-disc space-y-2 pl-5 marker:text-accent-soft">
              {block.items.map((item, i) => <li key={i} className="pl-1"><Labeled {...item} /></li>)}
            </ul>
          );
        }
        if (block.type === 'numbered') {
          return (
            <ol key={index} className="space-y-2">
              {block.items.map((item, i) => (
                <li key={i} className="grid grid-cols-[2.25rem_minmax(0,1fr)]">
                  <span className="num font-semibold text-accent-soft" aria-hidden="true">{item.marker}</span>
                  <span><span className="sr-only">{item.marker} </span><Labeled {...item} /></span>
                </li>
              ))}
            </ol>
          );
        }
        return <p key={index}><Labeled {...block} /></p>;
      })}
    </div>
  );
}
