import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  COMPACT_CATALOG_URL,
  LEGACY_CATALOG_URL,
  buildMarketPlayers,
  decodePlayersCompact,
  encodePlayersCompact,
  fetchRawPlayers,
} from '../utils/playerCatalog.js';
import { isGlitchedPlayer, processPlayersData } from '../utils/helpers.js';
import { playerPlaceholder } from '../utils/playerPlaceholder.js';

const glitched = { Id: 3, Name: 'Bug', Trickster: false, Finishing: 80, DefensiveAwareness: 80, Speed: 80, BallControl: 80, LowPass: 80, Precio: 1 };
const synthetic = [
  { Id: 1, Name: 'Ángel Di María', Precio: '12', Age: 30, OVR_CALCULADO: 84, Trickster: true, Finishing: 80, Grupo: 'Delanteros' },
  { Id: 2, Name: 'E. Kawashima', Precio: 3, Age: '38', OVR_CALCULADO: 73, Trickster: false, Finishing: 40, Grupo: 'Arqueros', Extra: 'x' },
  glitched,
];

describe('compact player catalog (synthetic data)', () => {
  it('round-trips values, booleans and ids exactly; missing fields come back as null', () => {
    const compact = encodePlayersCompact(synthetic);
    expect(compact.booleanFields).toEqual(['Trickster']);
    expect(compact.rows[0]).toContain(1);
    const decoded = decodePlayersCompact(JSON.parse(JSON.stringify(compact)));
    expect(decoded[0]).toMatchObject(synthetic[0]);
    expect(decoded[1]).toMatchObject(synthetic[1]);
    expect(decoded[0].Extra).toBeNull();
    expect(decoded[0].Trickster).toBe(true);
  });

  it('rejects an unknown format', () => {
    expect(() => decodePlayersCompact({ version: 99, fields: [], rows: [] })).toThrow();
    expect(() => decodePlayersCompact(null)).toThrow();
  });

  it('buildMarketPlayers = glitch filter + processPlayersData in one pass', () => {
    const fresh = () => JSON.parse(JSON.stringify(synthetic));
    const expected = processPlayersData(fresh().filter(p => !isGlitchedPlayer(p)));
    expect(buildMarketPlayers(fresh())).toEqual(expected);
    expect(buildMarketPlayers(fresh())[0]).toMatchObject({ searchableName: expect.any(String), Precio: 12 });
  });

  it('fetchRawPlayers uses the compact file and falls back to jugadores.json', async () => {
    const compact = encodePlayersCompact(synthetic);
    const ok = body => ({ ok: true, status: 200, json: async () => body });
    const missing = { ok: false, status: 404, json: async () => ({}) };
    const compactFetch = vi.fn(async url => (url === COMPACT_CATALOG_URL ? ok(compact) : missing));
    expect((await fetchRawPlayers(compactFetch))[1].Name).toBe('E. Kawashima');
    expect(compactFetch).toHaveBeenCalledTimes(1);

    const legacyFetch = vi.fn(async url => (url === LEGACY_CATALOG_URL ? ok(synthetic) : missing));
    expect(await fetchRawPlayers(legacyFetch)).toEqual(synthetic);

    await expect(fetchRawPlayers(async () => missing)).rejects.toThrow(/no disponible/);
  });
});

// Real game data: public/jugadores.json (skips when the file is not present).
const realCatalog = path.resolve('public/jugadores.json');
describe.skipIf(!fs.existsSync(realCatalog))('compact player catalog (real public/jugadores.json)', () => {
  it('decodes to exactly the same market players as the old JSON pipeline', () => {
    const text = fs.readFileSync(realCatalog, 'utf8');
    const oldPipeline = processPlayersData(JSON.parse(text).filter(p => !isGlitchedPlayer(p)));
    const compact = JSON.parse(JSON.stringify(encodePlayersCompact(JSON.parse(text))));
    const newPipeline = buildMarketPlayers(decodePlayersCompact(compact));
    expect(newPipeline.length).toBe(oldPipeline.length);
    expect(JSON.stringify(newPipeline)).toBe(JSON.stringify(oldPipeline));
  });
});

describe('playerPlaceholder', () => {
  it('builds a local SVG with escaped initials (no network request)', () => {
    const uri = playerPlaceholder('kylian');
    expect(uri.startsWith('data:image/svg+xml')).toBe(true);
    expect(decodeURIComponent(uri)).toContain('>KY<');
    expect(decodeURIComponent(playerPlaceholder('<s'))).not.toContain('<s<');
    expect(playerPlaceholder('')).toBe(playerPlaceholder(undefined));
  });
});
