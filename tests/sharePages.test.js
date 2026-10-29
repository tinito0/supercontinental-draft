// Vistas previas de links por página (utils/sharePages.js), con datos sintéticos.
import { describe, it, expect } from 'vitest';
import { STATIC_PAGES, SHARE_END, SHARE_START, absoluteUrl, clubPage, pageFile, renderSharePage, shareTags } from '../utils/sharePages.js';

const SITE = 'https://example.test';
const html = `<head>\n  ${SHARE_START}\n  <title>Viejo</title>\n  ${SHARE_END}\n  <script src="/boot.js"></script>\n</head>`;

describe('pageFile', () => {
  it('maps routes to the files cleanUrls serves', () => {
    expect(pageFile('/')).toBe('index.html');
    expect(pageFile('/torneo')).toBe('torneo.html');
    expect(pageFile('/equipos/u01')).toBe('equipos/u01.html');
  });

  it('refuses ids that could escape dist/', () => {
    expect(pageFile('/equipos/../x')).toBeNull();
    expect(pageFile('/equipos/a b')).toBeNull();
    expect(pageFile('')).toBeNull();
  });
});

describe('absoluteUrl', () => {
  it('completes relative paths and keeps only https', () => {
    expect(absoluteUrl('/escudos/a.png', SITE)).toBe('https://example.test/escudos/a.png');
    expect(absoluteUrl('https://cdn.test/x.jpg', SITE)).toBe('https://cdn.test/x.jpg');
    expect(absoluteUrl('http://cdn.test/x.jpg', SITE)).toBeNull();
    expect(absoluteUrl('', SITE)).toBeNull();
  });
});

describe('clubPage', () => {
  const team = { id: 'u01', teamName: 'Talleres de Balvanera', logoUrl: '/escudos/talleres.png' };

  it('describes the club from its card and uses the stadium photo as a large image', () => {
    const page = clubPage(team, { profile: { nickname: 'La T', stadium: 'Miserere', city: 'Buenos Aires', country: 'Argentina', stadiumPhotoUrl: 'https://img.test/estadio.jpg' } }, SITE);
    expect(page.path).toBe('/equipos/u01');
    expect(page.title).toBe('Talleres de Balvanera · SuperContinental League');
    expect(page.description).toContain('«La T» · Estadio Miserere · Buenos Aires, Argentina');
    expect(page).toMatchObject({ image: 'https://img.test/estadio.jpg', largeImage: true });
  });

  it('uses the club card as a large image when there is no stadium photo', () => {
    const page = clubPage(team, null, SITE, { card: '/og/clubs/u01.png' });
    expect(page).toMatchObject({ image: 'https://example.test/og/clubs/u01.png', largeImage: true });
  });

  it('falls back to the history and the crest in a small card', () => {
    const page = clubPage(team, { body: 'Nació en 1914 en la plaza Miserere.\n\nSegundo párrafo.' }, SITE);
    expect(page.description).toBe('Nació en 1914 en la plaza Miserere.');
    expect(page).toMatchObject({ image: 'https://example.test/escudos/talleres.png', largeImage: false });
  });

  it('clips long descriptions', () => {
    const page = clubPage(team, { body: 'palabra '.repeat(80) }, SITE);
    expect(page.description.length).toBeLessThanOrEqual(160);
    expect(page.description.endsWith('…')).toBe(true);
  });
});

describe('shareTags and renderSharePage', () => {
  it('uses the league image with a large card when the page has none', () => {
    const tags = shareTags(STATIC_PAGES.find(page => page.path === '/torneo'), SITE);
    expect(tags).toContain('<meta property="og:url" content="https://example.test/torneo">');
    expect(tags).toContain('content="https://example.test/og/liga.png"');
    expect(tags).toContain('<meta name="twitter:card" content="summary_large_image">');
  });

  it('escapes text so a club name cannot break out of the attribute', () => {
    const tags = shareTags({ path: '/equipos/x', title: 'Club "A" <b>', description: 'a & b', image: null }, SITE);
    expect(tags).toContain('content="Club &quot;A&quot; &lt;b&gt;"');
    expect(tags).toContain('content="a &amp; b"');
    expect(tags).not.toContain('<b>');
  });

  it('replaces only the block between the markers', () => {
    const out = renderSharePage(html, STATIC_PAGES[0], SITE);
    expect(out).not.toContain('Viejo');
    expect(out).toContain('<script src="/boot.js"></script>');
    expect(out.indexOf(SHARE_START)).toBeLessThan(out.indexOf('<title>'));
    expect(renderSharePage('<head></head>', STATIC_PAGES[0], SITE)).toBeNull();
  });
});
