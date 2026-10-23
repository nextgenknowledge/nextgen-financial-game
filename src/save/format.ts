import { hashString } from '@/game/rng';
import type { WorldState } from '@/game/types';
import { migrateWorld, uid } from '@/game/world';
import { netWorth } from '@/game/finance/netWorth';

export const EXPORT_FORMAT = 'fincity-world';

export interface WorldMeta {
  id: string;
  name: string;
  nickname: string;
  difficulty: WorldState['difficulty'];
  netWorth: number;
  level: number;
  lastPlayed: number;
  createdAt: number;
  thumbnail: string | null;
  month: number;
}

export function metaFor(w: WorldState, thumbnail: string | null): WorldMeta {
  return {
    id: w.id,
    name: w.name,
    nickname: w.nickname,
    difficulty: w.difficulty,
    netWorth: Math.round(netWorth(w).total),
    level: w.progress.level,
    lastPlayed: w.lastPlayed,
    createdAt: w.createdAt,
    thumbnail,
    month: w.time.month,
  };
}

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: number;
  checksum: number;
  thumbnail?: string | null;
  world: WorldState;
}

export function serializeWorld(w: WorldState, thumbnail: string | null = null): string {
  const body = JSON.stringify(w);
  const file: ExportFile = {
    format: EXPORT_FORMAT,
    version: w.version,
    exportedAt: Date.now(),
    checksum: hashString(body),
    thumbnail,
    world: w,
  };
  return JSON.stringify(file);
}

export class ImportError extends Error {}

/**
 * Parses an exported world file. Verifies format and checksum, migrates old versions,
 * and gives the world a fresh id when `existingIds` already contains it.
 */
export function parseWorldFile(text: string, existingIds: string[] = []): { world: WorldState; thumbnail: string | null } {
  let file: ExportFile;
  try {
    file = JSON.parse(text);
  } catch {
    throw new ImportError("That file isn't a Fin City world (it couldn't be read).");
  }
  if (!file || file.format !== EXPORT_FORMAT || !file.world) {
    throw new ImportError("That file isn't a Fin City world.");
  }
  if (hashString(JSON.stringify(file.world)) !== file.checksum) {
    throw new ImportError('This world file looks damaged or was edited, so it was not imported.');
  }
  const world = migrateWorld(file.world);
  if (existingIds.includes(world.id)) {
    world.id = uid('world');
    world.name = `${world.name} (imported)`;
  }
  return { world, thumbnail: typeof file.thumbnail === 'string' ? file.thumbnail : null };
}

export function duplicateOf(w: WorldState): WorldState {
  const copy = structuredClone(w);
  copy.id = uid('world');
  copy.name = `${w.name} (copy)`;
  copy.createdAt = Date.now();
  copy.lastPlayed = Date.now();
  return copy;
}

/** Filename-safe slug for exports. */
export function exportFileName(w: WorldState): string {
  const slug = w.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'world';
  return `${slug}.fincity.json`;
}
