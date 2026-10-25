/** Save storage. Everything stays on this device. */
import { openDB, type IDBPDatabase } from 'idb';
import type { WorldState } from '@/game/types';
import { migrateWorld } from '@/game/world';
import { duplicateOf, metaFor, parseWorldFile, serializeWorld, type WorldMeta } from './format';

const DB_NAME = 'fincity';
const DB_VERSION = 1;
const STORES = ['worlds', 'meta', 'global'] as const;
type Store = (typeof STORES)[number];

/*
 * Where saves live. IndexedDB first. Some browsers block it (Safari Lockdown Mode, some private
 * windows, "block all site data", some embedded pages) or never finish opening it, so the game
 * falls back to localStorage and, if that is blocked too, to memory for this visit only. Saving
 * never throws because of storage; `storageMode()` says how safe the saves are.
 */
interface Backend {
  get(store: Store, key: string): Promise<unknown>;
  getAll(store: Store): Promise<unknown[]>;
  put(store: Store, key: string, value: unknown): Promise<void>;
  /** Writes several entries together (a world and its meta). */
  putMany(entries: [Store, string, unknown][]): Promise<void>;
  del(entries: [Store, string][]): Promise<void>;
}

export type StorageMode = 'indexeddb' | 'local' | 'memory';

function idbBackend(d: IDBPDatabase): Backend {
  return {
    get: (store, key) => d.get(store, key),
    getAll: (store) => d.getAll(store),
    put: async (store, key, value) => {
      await d.put(store, value, key);
    },
    putMany: async (entries) => {
      const tx = d.transaction([...new Set(entries.map((e) => e[0]))], 'readwrite');
      await Promise.all([...entries.map(([st, k, v]) => tx.objectStore(st).put(v, k)), tx.done]);
    },
    del: async (entries) => {
      const tx = d.transaction([...new Set(entries.map((e) => e[0]))], 'readwrite');
      await Promise.all([...entries.map(([st, k]) => tx.objectStore(st).delete(k)), tx.done]);
    },
  };
}

function memoryBackend(seed?: Map<string, unknown>): Backend {
  const m = seed ?? new Map<string, unknown>();
  const k = (st: Store, key: string) => `${st}/${key}`;
  return {
    get: async (st, key) => structuredClone(m.get(k(st, key))),
    getAll: async (st) => [...m].filter(([key]) => key.startsWith(st + '/')).map(([, v]) => structuredClone(v)),
    put: async (st, key, v) => void m.set(k(st, key), structuredClone(v)),
    putMany: async (entries) => entries.forEach(([st, key, v]) => m.set(k(st, key), structuredClone(v))),
    del: async (entries) => entries.forEach(([st, key]) => m.delete(k(st, key))),
  };
}

const LS_PREFIX = 'fincity:';

function localBackend(ls: Storage): Backend {
  const k = (st: Store, key: string) => `${LS_PREFIX}${st}/${key}`;
  const read = (full: string) => {
    const raw = ls.getItem(full);
    return raw == null ? undefined : JSON.parse(raw);
  };
  return {
    get: async (st, key) => read(k(st, key)),
    getAll: async (st) => {
      const out: unknown[] = [];
      for (let i = 0; i < ls.length; i++) {
        const key = ls.key(i);
        if (key?.startsWith(`${LS_PREFIX}${st}/`)) out.push(read(key));
      }
      return out;
    },
    put: async (st, key, v) => ls.setItem(k(st, key), JSON.stringify(v)),
    putMany: async (entries) => {
      // Write everything or nothing, so a full storage never leaves a world without its meta
      const before = entries.map(([st, key]) => [k(st, key), ls.getItem(k(st, key))] as const);
      try {
        for (const [st, key, v] of entries) ls.setItem(k(st, key), JSON.stringify(v));
      } catch (e) {
        for (const [full, old] of before) {
          if (old == null) ls.removeItem(full);
          else ls.setItem(full, old);
        }
        throw e;
      }
    },
    del: async (entries) => entries.forEach(([st, key]) => ls.removeItem(k(st, key))),
  };
}

/** localStorage, if the browser lets this page use it. */
function usableLocalStorage(): Storage | null {
  try {
    const ls = window.localStorage;
    ls.setItem(LS_PREFIX + 'probe', '1');
    ls.removeItem(LS_PREFIX + 'probe');
    return ls;
  } catch {
    return null;
  }
}

let backendPromise: Promise<Backend> | null = null;
let mode: StorageMode = 'indexeddb';

/** How saves are kept right now: on this device ('indexeddb', 'local') or only until the tab closes ('memory'). */
export function storageMode(): StorageMode {
  return mode;
}

function fallback(): Backend {
  const ls = typeof window !== 'undefined' ? usableLocalStorage() : null;
  mode = ls ? 'local' : 'memory';
  return ls ? localBackend(ls) : memoryBackend();
}

async function openIdb(): Promise<Backend> {
  if (typeof indexedDB === 'undefined') throw new Error('no IndexedDB');
  const open = openDB(DB_NAME, DB_VERSION, {
    upgrade(d) {
      for (const st of STORES) if (!d.objectStoreNames.contains(st)) d.createObjectStore(st);
    },
  });
  // Some browsers never answer when storage is blocked; don't wait forever
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('IndexedDB timed out')), 5000));
  const d = await Promise.race([open, timeout]);
  // A database that opens but refuses reads (seen in locked-down browsers) counts as blocked
  await d.get('global', '__probe');
  return idbBackend(d);
}

function backend(): Promise<Backend> {
  if (!backendPromise) backendPromise = openIdb().catch(() => fallback());
  return backendPromise;
}

/** Copies whatever localStorage holds into memory, for when it fills up mid-visit. */
function localIntoMemory(): Map<string, unknown> {
  const seed = new Map<string, unknown>();
  const ls = usableLocalStorage();
  for (let i = 0; ls && i < ls.length; i++) {
    const key = ls.key(i);
    if (!key?.startsWith(LS_PREFIX)) continue;
    try {
      seed.set(key.slice(LS_PREFIX.length), JSON.parse(ls.getItem(key) ?? 'null'));
    } catch {
      // skip a damaged entry
    }
  }
  return seed;
}

/**
 * Runs a storage call. If the current storage fails (blocked part-way through a visit, or
 * full), moves one step down (IndexedDB, then localStorage, then memory) and retries there.
 */
async function withStore<T>(fn: (b: Backend) => Promise<T>): Promise<T> {
  const b = await backend();
  try {
    return await fn(b);
  } catch (e) {
    if (mode === 'memory') throw e;
    let next: Backend;
    if (mode === 'indexeddb') next = fallback();
    else {
      next = memoryBackend(localIntoMemory());
      mode = 'memory';
    }
    backendPromise = Promise.resolve(next);
    return fn(next);
  }
}

/** For tests: forget the cached connection and start from IndexedDB again. */
export function _resetDbForTests() {
  backendPromise = null;
  mode = 'indexeddb';
}

export async function listWorlds(): Promise<WorldMeta[]> {
  const metas = (await withStore((b) => b.getAll('meta'))) as WorldMeta[];
  return metas.sort((a, b) => b.lastPlayed - a.lastPlayed);
}

export async function loadWorld(id: string): Promise<WorldState | null> {
  const raw = await withStore((b) => b.get('worlds', id));
  return raw ? migrateWorld(raw) : null;
}

let askedToPersist = false;

export async function saveWorld(w: WorldState, thumbnail?: string | null): Promise<void> {
  // Ask the browser not to clear saves when space runs low or the site goes unvisited (Safari
  // clears site data after a week away unless the game is added to the Home Screen).
  if (!askedToPersist && typeof navigator !== 'undefined') {
    askedToPersist = true;
    navigator.storage?.persist?.().catch(() => {});
  }
  await withStore(async (b) => {
    const prev = (await b.get('meta', w.id)) as WorldMeta | undefined;
    const thumb = thumbnail === undefined ? (prev?.thumbnail ?? null) : thumbnail;
    await b.putMany([
      ['worlds', w.id, w],
      ['meta', w.id, metaFor(w, thumb)],
    ]);
  });
}

export async function deleteWorld(id: string): Promise<void> {
  await withStore((b) =>
    b.del([
      ['worlds', id],
      ['meta', id],
    ]),
  );
}

export async function renameWorld(id: string, name: string): Promise<void> {
  const w = await loadWorld(id);
  if (!w) return;
  w.name = name.trim().slice(0, 40) || w.name;
  await saveWorld(w);
}

export async function duplicateWorld(id: string): Promise<WorldState | null> {
  const w = await loadWorld(id);
  if (!w) return null;
  const meta = (await withStore((b) => b.get('meta', id))) as WorldMeta | undefined;
  const copy = duplicateOf(w);
  await saveWorld(copy, meta?.thumbnail ?? null);
  return copy;
}

export async function exportWorldText(id: string): Promise<{ text: string; world: WorldState } | null> {
  const w = await loadWorld(id);
  if (!w) return null;
  const meta = (await withStore((b) => b.get('meta', id))) as WorldMeta | undefined;
  return { text: serializeWorld(w, meta?.thumbnail ?? null), world: w };
}

export async function importWorldText(text: string): Promise<WorldState> {
  const existing = (await listWorlds()).map((m) => m.id);
  const { world, thumbnail } = parseWorldFile(text, existing);
  await saveWorld(world, thumbnail);
  return world;
}

export async function getGlobal<T>(key: string): Promise<T | undefined> {
  return (await withStore((b) => b.get('global', key))) as T | undefined;
}

export async function setGlobal<T>(key: string, value: T): Promise<void> {
  await withStore((b) => b.put('global', key, value));
}

export function downloadText(filename: string, text: string, mime = 'application/json') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
