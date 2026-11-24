import { describe, expect, it } from 'vitest';
import { STOREY, homePlan } from '@/game/homePlan';

const rooms = { tiny: { w: 12, d: 10 }, cottage: { w: 14, d: 11 }, family: { w: 18, d: 14 }, villa: { w: 22, d: 16 }, sf: { w: 13, d: 10 }, hk: { w: 13, d: 11 } };
const overlap = (a: { x: number; z: number; w: number; d: number }, b: typeof a) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 0.01 && Math.abs(a.z - b.z) < (a.d + b.d) / 2 - 0.01;

describe('two-storey homes', () => {
  for (const [name, room] of Object.entries(rooms)) {
    it(`${name}: everything fits inside, nothing overlaps, stairs reach the mezzanine`, () => {
      const p = homePlan(room);
      const s = p.stairs;
      expect(s.rise * s.steps).toBeCloseTo(STOREY);
      expect(s.rise).toBeLessThanOrEqual(0.45);
      // Stairs end inside the room, clear of the front wall
      expect(s.z0 + s.steps * s.run).toBeLessThan(room.d / 2 - 0.4);
      const stairs = { x: (s.x0 + s.x1) / 2, z: s.z0 + (s.steps * s.run) / 2, w: s.x1 - s.x0, d: s.steps * s.run };
      for (const set of [p.ground, p.upper]) {
        for (const f of set) {
          expect(Math.abs(f.x) + f.w / 2).toBeLessThanOrEqual(room.w / 2 + 0.01);
          expect(Math.abs(f.z) + f.d / 2).toBeLessThanOrEqual(room.d / 2 + 0.01);
          for (const g of set) if (g !== f) expect(overlap(f, g), `${f.id} vs ${g.id}`).toBe(false);
        }
      }
      for (const f of p.ground) expect(overlap(f, stairs), `${f.id} vs stairs`).toBe(false);
      // Upstairs sits on the mezzanine, and the stairs' landing is clear
      for (const f of p.upper) {
        expect(f.z + f.d / 2).toBeLessThanOrEqual(p.zM + 0.01);
        expect(overlap(f, { x: (s.x0 + s.x1) / 2, z: p.zM - 0.8, w: 1.6, d: 1.6 }), `${f.id} on the landing`).toBe(false);
      }
      // The doorway stays clear
      for (const f of p.ground) expect(overlap(f, { x: 0, z: room.d / 2 - 1.1, w: 3.2, d: 2.2 }), `${f.id} in the doorway`).toBe(false);
    });
  }
});
