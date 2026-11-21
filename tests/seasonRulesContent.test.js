// The season rules files in content/ (real league text) must pass the same validation as the admin editor.
import { readdirSync, readFileSync } from 'node:fs';
import { normalizeSeasonRules } from '../utils/leagueContent.js';

const files = readdirSync(new URL('../content/', import.meta.url)).filter(name => /^reglamento-.*\.json$/.test(name));

describe.each(files)('%s', name => {
  const data = JSON.parse(readFileSync(new URL(`../content/${name}`, import.meta.url), 'utf8'));

  it('is valid and keeps every chapter', () => {
    const normalized = normalizeSeasonRules(data);
    expect(normalized.ok).toBe(true);
    expect(normalized.value.chapters).toHaveLength(data.chapters.length);
  });

  it('has unique chapter ids and publishes no Drive links', () => {
    const ids = data.chapters.map(chapter => chapter.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(JSON.stringify(data)).not.toMatch(/drive\.google\.com/);
  });
});
