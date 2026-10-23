/**
 * Guide routes: from where you arrive in each city, Narwhal's trail must find a walking route to
 * every building door and portal, and quest steps must point somewhere when they name a place.
 */
import { describe, expect, it } from 'vitest';
import { CITIES } from '@/world/cities';
import { getCityBuild } from '@/world/builders/sceneBuilder';
import { CollisionWorld } from '@/engine/collision';
import { findPath } from '@/engine/nav';

describe('guide routes', () => {
  for (const def of Object.values(CITIES)) {
    it(`${def.id}: every door and portal is reachable from the spawn`, () => {
      const build = getCityBuild(def, 'advanced');
      const c = new CollisionWorld();
      c.bounds = { minX: -def.half - 20, maxX: def.half + 20, minZ: -def.half - 20, maxZ: def.half + 20 };
      for (const k of build.colliders) c.addBox(k.cx, k.cz, k.w, k.d, k.minY, k.maxY, undefined, k.rotY);
      for (const k of build.lowColliders) c.addBox(k.cx, k.cz, k.w, k.d, -1, k.maxY);
      c.water = build.water;
      const targets = build.triggers.filter((t) => t.kind === 'door' || t.kind === 'portal');
      expect(targets.length).toBeGreaterThan(0);
      for (const t of targets) {
        const path = findPath(c, `test:${def.id}`, build.spawn.x, build.spawn.z, t.x, t.z);
        expect(path, `no route to ${t.id}`).not.toBeNull();
      }
    });
  }
});
