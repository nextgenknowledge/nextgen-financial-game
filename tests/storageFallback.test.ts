import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorld } from '@/game/world';
import { _resetDbForTests, deleteWorld, getGlobal, listWorlds, loadWorld, saveWorld, setGlobal, storageMode } from '@/save/db';

const mk = (name: string) => createWorld({ name, nickname: 'Fin', difficulty: 'entry', seed: 7 });

/** A localStorage stand-in; `quota` makes writes fail once it holds that many characters. */
function fakeStorage(quota = Infinity): Storage {
  const m = new Map<string, string>();
  const used = () => [...m.values()].reduce((n, v) => n + v.length, 0);
  return {
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (used() - (m.get(k)?.length ?? 0) + v.length > quota) throw new Error('QuotaExceededError');
      m.set(k, v);
    },
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  };
}

const blocked = () => {
  throw new Error('SecurityError: storage is blocked');
};

beforeEach(() => _resetDbForTests());
afterEach(() => vi.unstubAllGlobals());

describe('save storage when the browser blocks IndexedDB', () => {
  it('falls back to localStorage and still saves, lists, loads and deletes', async () => {
    vi.stubGlobal('indexedDB', undefined);
    vi.stubGlobal('window', { localStorage: fakeStorage() });
    const w = mk('Fallback');
    await saveWorld(w, null);
    expect(storageMode()).toBe('local');
    expect((await listWorlds()).map((m) => m.id)).toEqual([w.id]);
    expect((await loadWorld(w.id))?.name).toBe('Fallback');
    await setGlobal('settings', { a: 1 });
    expect(await getGlobal('settings')).toEqual({ a: 1 });
    await deleteWorld(w.id);
    expect(await listWorlds()).toEqual([]);
  });

  it('keeps playing in memory when every kind of storage is blocked', async () => {
    vi.stubGlobal('indexedDB', undefined);
    vi.stubGlobal('window', {
      get localStorage(): Storage {
        return blocked();
      },
    });
    const w = mk('Memory');
    await expect(saveWorld(w, null)).resolves.toBeUndefined();
    expect(storageMode()).toBe('memory');
    expect((await loadWorld(w.id))?.name).toBe('Memory');
  });

  it('moves to memory when localStorage fills up, keeping what was already saved', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const small = mk('Small');
    const ls = fakeStorage(JSON.stringify(small).length * 1.5);
    vi.stubGlobal('window', { localStorage: ls });
    await saveWorld(small, null);
    expect(storageMode()).toBe('local');
    const big = mk('Big');
    await saveWorld(big, null);
    expect(storageMode()).toBe('memory');
    expect((await listWorlds()).map((m) => m.name).sort()).toEqual(['Big', 'Small']);
  });
});
