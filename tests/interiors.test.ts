/**
 * Interior layouts: in every building, for both difficulties, the player must be able to walk from
 * the entrance spawn to every service counter without furniture in the way, and the room must have
 * people in it.
 */
import { describe, expect, it } from 'vitest';
import { applyDifficulty, CITIES } from '@/world/cities';
import { VoxelBuilder } from '@/engine/voxel';
import { makeRng } from '@/game/rng';
import type { Kit } from '@/world/interiors/furnish';
import { kindFor, layoutFor, zoneFor } from '@/world/interiors/plan';

const R = 0.35; // player radius
const CELL = 0.25;

interface Box {
  x: number;
  z: number;
  w: number;
  d: number;
  rot?: number;
}

/** Axis-aligned bounds of a (possibly rotated) box, grown by the player radius. */
function bounds(b: Box) {
  const c = Math.abs(Math.cos(b.rot ?? 0));
  const s = Math.abs(Math.sin(b.rot ?? 0));
  const hw = (b.w * c + b.d * s) / 2 + R;
  const hd = (b.w * s + b.d * c) / 2 + R;
  return { x0: b.x - hw, x1: b.x + hw, z0: b.z - hd, z1: b.z + hd };
}

const buildings = Object.values(CITIES).flatMap((c) => c.buildings.map((b) => ({ city: c.id, b })));

describe('interiors', () => {
  for (const { city, b } of buildings)
    for (const diff of ['entry', 'advanced'] as const) {
      const stations = diff === 'entry' && b.entryStations ? b.entryStations : b.stations;
      it(`${city}/${b.id} (${diff}) counters are reachable and the room has people`, () => {
        applyDifficulty(diff);
        const kind = kindFor(b);
        const L = layoutFor(stations.length, kind);
        const k: Kit = {
          b: new VoxelBuilder(),
          g: new VoxelBuilder(),
          gl: new VoxelBuilder(),
          rng: makeRng(b.id.length * 977 + b.id.charCodeAt(0)),
          w: L.w,
          d: L.d,
          h: L.h,
          zone: zoneFor(L),
          solids: [],
          actors: [],
        };
        kind.furnish(k);
        expect(k.actors.length).toBeGreaterThan(3);

        const spots = L.spots.slice(0, stations.length);
        const boxes: Box[] = [
          ...k.solids,
          ...spots.map((s) => ({ x: s.x + Math.sin(s.rot) * 1.6, z: s.z + Math.cos(s.rot) * 1.6, w: 3.4, d: 1.1, rot: s.rot })),
        ].map(bounds) as never;
        const nx = Math.ceil(L.w / CELL);
        const nz = Math.ceil(L.d / CELL);
        const free = (i: number, j: number) => {
          const x = -L.w / 2 + (i + 0.5) * CELL;
          const z = -L.d / 2 + (j + 0.5) * CELL;
          if (Math.abs(x) > L.w / 2 - R || Math.abs(z) > L.d / 2 - R) return false;
          return !(boxes as unknown as ReturnType<typeof bounds>[]).some((q) => x > q.x0 && x < q.x1 && z > q.z0 && z < q.z1);
        };
        const cell = (x: number, z: number) => [Math.floor((x + L.w / 2) / CELL), Math.floor((z + L.d / 2) / CELL)];
        const seen = new Uint8Array(nx * nz);
        const [si, sj] = cell(0, L.d / 2 - 4.6);
        expect(free(si, sj), 'spawn point is inside furniture').toBe(true);
        const q = [[si, sj]];
        seen[sj * nx + si] = 1;
        while (q.length) {
          const [i, j] = q.pop()!;
          for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const a = i + di;
            const c = j + dj;
            if (a < 0 || c < 0 || a >= nx || c >= nz || seen[c * nx + a] || !free(a, c)) continue;
            seen[c * nx + a] = 1;
            q.push([a, c]);
          }
        }
        // Each counter's trigger circle (r 2.2) must contain a reachable cell
        spots.forEach((s, n) => {
          const tx = s.x + Math.sin(s.rot) * 3.2;
          const tz = s.z + Math.cos(s.rot) * 3.2;
          let ok = false;
          for (let j = 0; j < nz && !ok; j++)
            for (let i = 0; i < nx && !ok; i++) {
              if (!seen[j * nx + i]) continue;
              const x = -L.w / 2 + (i + 0.5) * CELL;
              const z = -L.d / 2 + (j + 0.5) * CELL;
              if (Math.hypot(x - tx, z - tz) < 2.0) ok = true;
            }
          expect(ok, `counter ${n} (${stations[n].label}) is walled off by furniture`).toBe(true);
        });
      });
    }
});
