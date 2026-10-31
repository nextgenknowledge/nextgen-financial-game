/**
 * What the maps need to know about the player's world: which community projects are still
 * building sites, and where the homes they own are. Shared by the full Map and the minimap.
 */
import community from '@/data/community.json';
import { CITIES } from '@/world/cities';
import { rt } from '@/engine/runtime';
import { condoDef, houseDef, plotDef } from '@/game/sim/catalog';
import type { LocationId, WorldState } from '@/game/types';
import type { MapContext } from './pixelMap';

export interface OwnedHome {
  uid: string;
  name: string;
  city: LocationId;
  /** Door position, when known (a condo's street door is only placed while you're in its city). */
  x?: number;
  z?: number;
}

export function ownedHomes(w: WorldState, location: LocationId): OwnedHome[] {
  const out: OwnedHome[] = [];
  const hood = CITIES.park.landmarks.find((l) => l.type === 'neighborhood');
  for (const pr of w.assets.properties) {
    const c = condoDef(pr.itemId);
    const h = pr.houseId ? houseDef(pr.houseId) : null;
    if (c) {
      const t = c.city === location ? rt.triggers.find((x) => x.id === `home:${pr.uid}`) : undefined;
      out.push({ uid: pr.uid, name: c.name, city: c.city as LocationId, x: t?.x, z: t?.z });
    } else if (h && pr.plotId && hood) {
      const pl = plotDef(pr.plotId);
      if (pl) out.push({ uid: pr.uid, name: `${pl.name}, ${h.name}`, city: 'park', x: hood.pos[0] + pl.pos[0], z: hood.pos[1] + pl.pos[1] });
    }
  }
  return out;
}

export function mapContext(w: WorldState, homes: OwnedHome[], city: LocationId): MapContext {
  return {
    building: new Set(community.projects.filter((pj) => pj.landmark && (w.progress.community[pj.id] ?? 0) < pj.cost).map((pj) => pj.landmark as string)),
    homes: homes.filter((h) => h.city === city && h.x !== undefined).map((h) => ({ uid: h.uid, name: h.name, x: h.x!, z: h.z! })),
  };
}
