import { expect, it } from 'vitest';
import { CITIES, applyDifficulty } from '@/world/cities';
import { getCityBuild } from '@/world/builders/sceneBuilder';
import { CollisionWorld } from '@/engine/collision';
import { findPath } from '@/engine/nav';

it('every door, portal, job board and lot can be walked to from spawn', () => {
  for (const d of ['entry', 'advanced'] as const) {
    applyDifficulty(d);
    for (const c of Object.values(CITIES)) {
      const b = getCityBuild(c, d);
      const w = new CollisionWorld();
      w.bounds = { minX: -c.half - 20, maxX: c.half + 20, minZ: -c.half - 20, maxZ: c.half + 20 };
      for (const k of b.colliders) w.addBox(k.cx, k.cz, k.w, k.d, k.minY, k.maxY, undefined, k.rotY);
      for (const k of b.lowColliders) w.addBox(k.cx, k.cz, k.w, k.d, -1, k.maxY);
      w.water = b.water;
      const bad = b.triggers
        .filter((t) => t.id.startsWith('door:') || t.id.startsWith('portal:') || t.kind === 'board' || t.kind === 'plot')
        .filter((t) => !findPath(w, `reach:${c.id}:${d}:${t.id}`, b.spawn.x, b.spawn.z, t.x, t.z))
        .map((t) => t.id);
      expect(bad, `${d} ${c.id}`).toEqual([]);
    }
  }
  applyDifficulty('entry');
});
