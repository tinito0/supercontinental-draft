// Club share cards (scripts/clubCards.mjs) rendered from a synthetic crest: proves the card's size and that a new
// crest or name changes the image, not how WhatsApp shows it.
import path from 'node:path';
import sharp from 'sharp';
import { CARD, crestSource, nameFontSize, renderClubCard } from '../scripts/clubCards.mjs';

const dist = path.resolve('dist-test');
const crest = color => sharp({ create: { width: 120, height: 160, channels: 4, background: color } }).webp().toBuffer();

describe('crestSource', () => {
  it('reads local crests from dist, Windows separators included, and remote ones over https', () => {
    expect(crestSource('/Logos_equipos/talleres.webp', dist)).toEqual({ file: path.join(dist, 'Logos_equipos', 'talleres.webp') });
    expect(crestSource('\\Logos_equipos\\asp_calc.webp?x=1', dist)).toEqual({ file: path.join(dist, 'Logos_equipos', 'asp_calc.webp') });
    expect(crestSource('https://media.test/crest.png', dist)).toEqual({ url: 'https://media.test/crest.png' });
  });

  it('refuses empty values, other protocols and paths that leave dist', () => {
    expect(crestSource('', dist)).toBeNull();
    expect(crestSource('http://media.test/crest.png', dist)).toBeNull();
    expect(crestSource('data:image/png;base64,AAAA', dist)).toBeNull();
    expect(crestSource('/../secret.png', dist)).toBeNull();
  });
});

it('steps long names down so they fit in two lines', () => {
  expect(nameFontSize('Talleres de Balvanera')).toBe(92);
  expect(nameFontSize('Esportivo Lusitano do Recife')).toBe(76);
  expect(nameFontSize('Club Atlético Social y Deportivo Balvanera')).toBe(64);
});

it('renders a 1200x630 PNG that changes with the crest and the name', async () => {
  const red = await renderClubCard({ name: 'Talleres de Balvanera', crest: await crest('#c0392b') });
  const meta = await sharp(red).metadata();
  expect(meta).toMatchObject({ format: 'png', width: CARD.width, height: CARD.height });
  const blue = await renderClubCard({ name: 'Talleres de Balvanera', crest: await crest('#2b59c0') });
  const renamed = await renderClubCard({ name: 'Talleres', crest: await crest('#c0392b') });
  expect(blue.equals(red)).toBe(false);
  expect(renamed.equals(red)).toBe(false);
}, 30000);
