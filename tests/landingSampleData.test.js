// The public landing shows hardcoded sample players, lineups, export files and league links. These checks
// use the real public/jugadores.json, utils/pesExport.js and public/ assets, so the landing cannot drift.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  SAMPLE_PLAYERS, EXPORT_FILES, MARKET_PLAYER_COUNT_LABEL, DEMO_LINEUPS,
} from '../components/landing/sampleData.js';
import { FEATURED_VIDEO, STREAM_CHANNEL, SOCIAL_LINKS } from '../components/landing/leagueLinks.js';
import { FORMATIONS } from '../utils/constants.js';

const ROOT = path.resolve(__dirname, '..');
const players = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/jugadores.json'), 'utf8'));
const byId = new Map(players.map(p => [Number(p.Id), p]));
const publicFile = url => path.join(ROOT, 'public', url);

describe('landing sample data', () => {
  it.each(Object.entries(SAMPLE_PLAYERS))('%s matches jugadores.json', (_key, sample) => {
    const real = byId.get(sample.id);
    expect(real, `id ${sample.id} missing from jugadores.json`).toBeDefined();
    expect(sample.ovr).toBe(Number(real.OVR_CALCULADO));
    expect(sample.pos).toBe(real.POS_NOMBRE);
    expect(sample.price).toBe(Number(real.Precio));
    expect(fs.existsSync(publicFile(`fotos_jugadores/${sample.id}.webp`))).toBe(true);
  });

  it.each(Object.entries(DEMO_LINEUPS))('%s lineup fills every slot with a distinct sample player', (key, { lineup }) => {
    expect(FORMATIONS[key], `${key} missing from FORMATIONS`).toBeDefined();
    expect(lineup).toHaveLength(FORMATIONS[key].layout.length);
    expect(new Set(lineup).size).toBe(lineup.length);
    lineup.forEach(playerKey => expect(SAMPLE_PLAYERS[playerKey], playerKey).toBeDefined());
  });

  it('lists exactly the files pesExport puts in the ZIP', () => {
    const source = fs.readFileSync(path.join(ROOT, 'utils/pesExport.js'), 'utf8');
    const zipped = [...source.matchAll(/zip\.file\('([^']+)'/g)].map(m => m[1]);
    expect(EXPORT_FILES.map(f => f.name)).toEqual(zipped);
  });

  it('player count label is not above the real market size', () => {
    const claimed = Number(MARKET_PLAYER_COUNT_LABEL.replace(/\D/g, ''));
    expect(players.length).toBeGreaterThan(claimed);
  });
});

describe('landing league links', () => {
  it('every link is https and every image is in public/', () => {
    const links = [FEATURED_VIDEO, STREAM_CHANNEL, ...SOCIAL_LINKS];
    links.forEach(link => expect(new URL(link.url).protocol).toBe('https:'));
    [FEATURED_VIDEO.thumbnail, STREAM_CHANNEL.logo, ...SOCIAL_LINKS.map(s => s.logo)]
      .forEach(url => expect(fs.existsSync(publicFile(url)), url).toBe(true));
  });
});
