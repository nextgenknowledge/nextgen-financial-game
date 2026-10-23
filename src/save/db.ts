/** IndexedDB persistence. Everything stays on this device. */
import { openDB, type IDBPDatabase } from 'idb';
import type { WorldState } from '@/game/types';
import { migrateWorld } from '@/game/world';
import { duplicateOf, metaFor, parseWorldFile, serializeWorld, type WorldMeta } from './format';

const DB_NAME = 'fincity';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains('worlds')) d.createObjectStore('worlds');
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
        if (!d.objectStoreNames.contains('global')) d.createObjectStore('global');
      },
    });
  }
  return dbPromise;
}

/** For tests: forget the cached connection. */
export function _resetDbForTests() {
  dbPromise = null;
}

export async function listWorlds(): Promise<WorldMeta[]> {
  const d = await db();
  const metas = (await d.getAll('meta')) as WorldMeta[];
  return metas.sort((a, b) => b.lastPlayed - a.lastPlayed);
}

export async function loadWorld(id: string): Promise<WorldState | null> {
  const d = await db();
  const raw = await d.get('worlds', id);
  return raw ? migrateWorld(raw) : null;
}

export async function saveWorld(w: WorldState, thumbnail?: string | null): Promise<void> {
  const d = await db();
  const prev = (await d.get('meta', w.id)) as WorldMeta | undefined;
  const thumb = thumbnail === undefined ? (prev?.thumbnail ?? null) : thumbnail;
  const tx = d.transaction(['worlds', 'meta'], 'readwrite');
  await Promise.all([tx.objectStore('worlds').put(w, w.id), tx.objectStore('meta').put(metaFor(w, thumb), w.id), tx.done]);
}

export async function deleteWorld(id: string): Promise<void> {
  const d = await db();
  const tx = d.transaction(['worlds', 'meta'], 'readwrite');
  await Promise.all([tx.objectStore('worlds').delete(id), tx.objectStore('meta').delete(id), tx.done]);
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
  const d = await db();
  const meta = (await d.get('meta', id)) as WorldMeta | undefined;
  const copy = duplicateOf(w);
  await saveWorld(copy, meta?.thumbnail ?? null);
  return copy;
}

export async function exportWorldText(id: string): Promise<{ text: string; world: WorldState } | null> {
  const w = await loadWorld(id);
  if (!w) return null;
  const d = await db();
  const meta = (await d.get('meta', id)) as WorldMeta | undefined;
  return { text: serializeWorld(w, meta?.thumbnail ?? null), world: w };
}

export async function importWorldText(text: string): Promise<WorldState> {
  const existing = (await listWorlds()).map((m) => m.id);
  const { world, thumbnail } = parseWorldFile(text, existing);
  await saveWorld(world, thumbnail);
  return world;
}

export async function getGlobal<T>(key: string): Promise<T | undefined> {
  const d = await db();
  return (await d.get('global', key)) as T | undefined;
}

export async function setGlobal<T>(key: string, value: T): Promise<void> {
  const d = await db();
  await d.put('global', value, key);
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
