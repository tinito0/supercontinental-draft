import { describe, it, expect } from 'vitest';
import { KitWorkspace, insertInOrder } from '../../pes/kits/kitWorkspace.js';
import { applyOperations } from '../../pes/operations.js';
import { authorize } from '../../pes/permissions.js';
import { getKitValue } from '../../pes/kits/kitConfig.js';
import { syntheticKitServer } from './fixtures.js';

const fresh = () => { const { texts, all } = syntheticKitServer(); return { kits: new KitWorkspace(texts, all), meta: {} }; };
const admin = { uid: 'a', role: 'super_admin' };

describe('order.ini editing', () => {
  it('adds a kit at the end of a section and keeps the rest of the file', () => {
    const text = '[buli]\r\np1\r\np2\r\n\r\n[uefa]\r\nuefa/p1\r\n';
    expect(insertInOrder(text, 'buli', 'p5')).toBe('[buli]\r\np1\r\np2\r\np5\r\n\r\n[uefa]\r\nuefa/p1\r\n');
    expect(insertInOrder(text, 'uefa', 'p5')).toBe('[buli]\r\np1\r\np2\r\n\r\n[uefa]\r\nuefa/p1\r\np5\r\n');
    expect(insertInOrder('p1\n', 'default', 'p2')).toBe('p1\np2\n');
    expect(insertInOrder('p1\n', 'retro', 'p2')).toBe('p1\n\n[retro]\np2\n');
  });
});

describe('new kits', () => {
  it('copies a kit into the next free folder and lists it in order.ini', () => {
    const ws = fresh();
    expect(ws.kits.nextKitName(9999, 'player')).toBe('p2');
    applyOperations(ws, [{ type: 'kit.add', target: { teamId: 9999 }, value: { kit: 'p2', from: 'p1' } }], admin);
    expect(ws.kits.kitsOf(9999).map(k => [k.kit, k.inOrder])).toEqual([['g1', true], ['p1', true], ['p2', true]]);
    expect(getKitValue(ws.kits.getConfig(9999, 'p2'), 'KitFile')).toBe('u9999p1');
    const out = ws.kits.modifiedFiles();
    expect(Object.keys(out).sort()).toEqual(['content/kit-server/Test League/Test FC/order.ini', 'content/kit-server/Test League/Test FC/p2/config.txt']);
    expect(out['content/kit-server/Test League/Test FC/order.ini']).toBe('p1\r\np2\r\n');
    expect(ws.kits.nextKitName(9999, 'player')).toBe('p3');
  });

  it('keeps a new kit exported even if its values equal the template', () => {
    const ws = fresh();
    applyOperations(ws, [{ type: 'kit.add', target: { teamId: 9999 }, value: { kit: 'p2', from: 'p1' } }], admin);
    const v = getKitValue(ws.kits.getConfig(9999, 'p2'), 'Collar');
    applyOperations(ws, [{ type: 'kit.set', target: { teamId: 9999, kit: 'p2' }, key: 'Collar', value: v }], admin);
    expect(Object.keys(ws.kits.modifiedFiles())).toContain('content/kit-server/Test League/Test FC/p2/config.txt');
  });

  it('adds goalkeeper kits to gk_order.ini and rejects mismatched templates', () => {
    const ws = fresh();
    applyOperations(ws, [{ type: 'kit.add', target: { teamId: 9999 }, value: { kit: 'g2', from: 'g1' } }], admin);
    expect(ws.kits.texts.get('Test League/Test FC/gk_order.ini')).toBe('g1\r\ng2\r\n');
    expect(() => applyOperations(ws, [{ type: 'kit.add', target: { teamId: 9999 }, value: { kit: 'g3', from: 'p1' } }], admin))
      .toThrow(expect.objectContaining({ code: 'KIT_CATEGORY' }));
  });

  it('rolls back the order file when a batch fails', () => {
    const ws = fresh();
    expect(() => applyOperations(ws, [
      { type: 'kit.add', target: { teamId: 9999 }, value: { kit: 'p2', from: 'p1' } },
      { type: 'kit.add', target: { teamId: 9999 }, value: { kit: 'p2', from: 'p1' } },
    ], admin)).toThrow(expect.objectContaining({ code: 'KIT_EXISTS' }));
    expect(ws.kits.kitsOf(9999).map(k => k.kit)).toEqual(['g1', 'p1']);
    expect(ws.kits.modifiedFiles()).toEqual({});
  });

  it('rejects invalid kit names', () => {
    const ws = fresh();
    expect(() => applyOperations(ws, [{ type: 'kit.add', target: { teamId: 9999 }, value: { kit: '../x', from: 'p1' } }], admin))
      .toThrow(expect.objectContaining({ code: 'INVALID_KIT_NAME' }));
  });

  it('lets a Kit Manager add kits only to league teams', () => {
    const km = { uid: 'k', role: 'kit_manager' };
    const op = { type: 'kit.add', target: { teamId: 9999 }, value: { kit: 'p2', from: 'p1' } };
    expect(() => authorize(km, op, { leagueTeamIds: [9999] })).not.toThrow();
    expect(() => authorize(km, op, { leagueTeamIds: [8888] })).toThrow(expect.objectContaining({ code: 'TEAM_NOT_IN_LEAGUE' }));
    expect(() => authorize({ uid: 'd', role: 'draft_admin' }, op)).toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
  });
});
