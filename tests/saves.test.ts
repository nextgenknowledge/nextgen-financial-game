import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createWorld, migrateWorld } from '@/game/world';
import { parseWorldFile, serializeWorld, ImportError } from '@/save/format';
import {
  deleteWorld,
  duplicateWorld,
  exportWorldText,
  getGlobal,
  importWorldText,
  listWorlds,
  loadWorld,
  renameWorld,
  saveWorld,
  setGlobal,
} from '@/save/db';

const mk = (name: string) => createWorld({ name, nickname: 'Fin', difficulty: 'entry', seed: 42 });

describe('export/import format', () => {
  it('round-trips a world', () => {
    const w = mk('Round Trip');
    w.finance.cash = 1234;
    const text = serializeWorld(w, 'data:image/jpeg;base64,xx');
    const { world, thumbnail } = parseWorldFile(text);
    expect(world).toEqual(w);
    expect(thumbnail).toBe('data:image/jpeg;base64,xx');
  });
  it('rejects garbage and tampered files', () => {
    expect(() => parseWorldFile('not json')).toThrow(ImportError);
    expect(() => parseWorldFile('{"format":"other"}')).toThrow(ImportError);
    const w = mk('Tamper');
    const file = JSON.parse(serializeWorld(w));
    file.world.finance.cash = 999999;
    expect(() => parseWorldFile(JSON.stringify(file))).toThrow(/damaged/);
  });
  it('gives a new id when importing a world that already exists', () => {
    const w = mk('Dup');
    const { world } = parseWorldFile(serializeWorld(w), [w.id]);
    expect(world.id).not.toBe(w.id);
    expect(world.name).toContain('imported');
  });
  it('migrates old saves missing new fields', () => {
    const w = mk('Old') as unknown as Record<string, any>;
    delete w.progress.tickets;
    delete w.finance.goals;
    delete w.market.prices.FCX;
    const m = migrateWorld(w);
    expect(m.progress.tickets).toBe(0);
    expect(m.finance.goals).toEqual([]);
    expect(m.market.prices.FCX).toBeGreaterThan(0);
  });
});

describe('IndexedDB worlds', () => {
  it('save, list, load, rename, duplicate, delete', async () => {
    const a = mk('Alpha');
    a.lastPlayed = 1;
    const b = mk('Beta');
    b.lastPlayed = 2;
    await saveWorld(a, null);
    await saveWorld(b, 'thumb');
    let list = await listWorlds();
    expect(list.map((m) => m.name)).toEqual(['Beta', 'Alpha']);
    expect(list[0].thumbnail).toBe('thumb');

    const loaded = await loadWorld(a.id);
    expect(loaded?.name).toBe('Alpha');

    await renameWorld(a.id, 'Alpha Prime');
    expect((await loadWorld(a.id))?.name).toBe('Alpha Prime');

    const copy = await duplicateWorld(b.id);
    expect(copy).not.toBeNull();
    list = await listWorlds();
    expect(list).toHaveLength(3);
    expect(list.find((m) => m.id === copy!.id)?.thumbnail).toBe('thumb');

    await deleteWorld(a.id);
    expect(await loadWorld(a.id)).toBeNull();
    expect(await listWorlds()).toHaveLength(2);
  });

  it('export then import creates an equal world under a new id', async () => {
    const w = mk('Export Me');
    w.finance.savings = 777;
    await saveWorld(w, null);
    const exp = await exportWorldText(w.id);
    const imported = await importWorldText(exp!.text);
    expect(imported.id).not.toBe(w.id);
    expect(imported.finance.savings).toBe(777);
    expect(await loadWorld(imported.id)).not.toBeNull();
  });

  it('global settings store', async () => {
    await setGlobal('settings', { music: 0.5 });
    expect(await getGlobal('settings')).toEqual({ music: 0.5 });
  });
});
