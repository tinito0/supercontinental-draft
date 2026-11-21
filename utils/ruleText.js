// Structure of a season rules chapter, read from its plain text (utils/leagueContent.js keeps it plain text).
// Paragraphs are split on blank lines; inside one:
//   - a short first line without final punctuation, followed by more lines, is a subtitle ("Desempate");
//   - lines starting with "• " or "- " are a bullet list; with "1. " or "IV. " a numbered list (the marker is kept);
//   - "Label: text" with a short label is split so the label can stand out.
// Nothing becomes HTML: the page renders the returned strings as text. Pure; tests/ruleText.test.js.

const BULLET = /^[•\-–]\s+(.*)$/;
const NUMBERED = /^((?:\d{1,2}|[IVX]{1,4})\.)\s+(.*)$/;
const SUBTITLE_MAX = 50;

/** "Localía: es local el club…" → { label: 'Localía', text: 'es local el club…' }; plain text otherwise. */
export function splitLabel(line) {
  const match = /^([^:]{2,45}):\s+(\S.*)$/.exec(line);
  if (!match) return { label: '', text: line };
  const label = match[1].trim();
  // A label is a name, not a clause: few words, no comma or sentence break.
  if (label.split(/\s+/).length > 6 || /[,.;]/.test(label)) return { label: '', text: line };
  return { label, text: match[2] };
}

const isSubtitle = line => line.length <= SUBTITLE_MAX && !/[.:;,?!)]$/.test(line) && !BULLET.test(line) && !NUMBERED.test(line);

/**
 * @returns {Array<
 *   { type: 'subtitle', text: string } |
 *   { type: 'paragraph', label: string, text: string } |
 *   { type: 'bullets', items: Array<{ label: string, text: string }> } |
 *   { type: 'numbered', items: Array<{ marker: string, label: string, text: string }> }
 * >}
 */
export function toRuleBlocks(body) {
  const blocks = [];
  const paragraphs = String(body || '').replace(/\r\n?/g, '\n').split(/\n\s*\n/);
  for (const paragraph of paragraphs) {
    const lines = paragraph.split('\n').map(line => line.trim()).filter(Boolean);
    lines.forEach((line, index) => {
      const last = blocks[blocks.length - 1];
      if (index === 0 && lines.length > 1 && isSubtitle(line)) {
        blocks.push({ type: 'subtitle', text: line });
        return;
      }
      const bullet = BULLET.exec(line);
      if (bullet) {
        const item = splitLabel(bullet[1]);
        if (last?.type === 'bullets' && index > 0) last.items.push(item);
        else blocks.push({ type: 'bullets', items: [item] });
        return;
      }
      const numbered = NUMBERED.exec(line);
      if (numbered) {
        const item = { marker: numbered[1], ...splitLabel(numbered[2]) };
        if (last?.type === 'numbered' && index > 0) last.items.push(item);
        else blocks.push({ type: 'numbered', items: [item] });
        return;
      }
      blocks.push({ type: 'paragraph', ...splitLabel(line) });
    });
  }
  return blocks;
}
