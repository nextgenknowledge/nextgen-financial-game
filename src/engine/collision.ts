/**
 * Custom kinematic collision: axis-aligned boxes in a spatial hash, circle-vs-box push-out on XZ,
 * stand-on-top for anything low enough to step or jump onto. Deterministic and tiny.
 */

export interface AABB {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  tag?: string;
}

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

const CELL = 8;

let worldIds = 0;

export class CollisionWorld {
  /** Unique per collision world, so caches built from it (the nav grid) know when it was rebuilt. */
  readonly id = ++worldIds;
  boxes: AABB[] = [];
  private grid = new Map<number, number[]>();
  bounds = { minX: -200, maxX: 200, minZ: -200, maxZ: 200 };
  /** Rectangles the player may not walk into (e.g. deep water). Boats use `water` instead. */
  water: { minX: number; maxX: number; minZ: number; maxZ: number }[] = [];

  private key(ix: number, iz: number) {
    return (ix + 1000) * 4000 + (iz + 1000);
  }

  add(b: AABB) {
    const i = this.boxes.length;
    this.boxes.push(b);
    const x0 = Math.floor(b.minX / CELL);
    const x1 = Math.floor(b.maxX / CELL);
    const z0 = Math.floor(b.minZ / CELL);
    const z1 = Math.floor(b.maxZ / CELL);
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++) {
        const k = this.key(x, z);
        let arr = this.grid.get(k);
        if (!arr) this.grid.set(k, (arr = []));
        arr.push(i);
      }
  }

  /** Convenience: center x/z, width/depth, bottom & top. */
  addBox(cx: number, cz: number, w: number, d: number, minY = 0, maxY = 10, tag?: string, rotY = 0) {
    // Rotated boxes by 90° steps swap extents; other angles use the bounding square.
    const quarter = Math.round(rotY / (Math.PI / 2));
    const exact = Math.abs(rotY - quarter * (Math.PI / 2)) < 1e-3;
    let hw = w / 2;
    let hd = d / 2;
    if (exact && quarter % 2 !== 0) [hw, hd] = [hd, hw];
    else if (!exact) hw = hd = Math.max(hw, hd);
    this.add({ minX: cx - hw, maxX: cx + hw, minZ: cz - hd, maxZ: cz + hd, minY, maxY, tag });
  }

  query(minX: number, maxX: number, minZ: number, maxZ: number): AABB[] {
    const out: AABB[] = [];
    const seen = new Set<number>();
    const x0 = Math.floor(minX / CELL);
    const x1 = Math.floor(maxX / CELL);
    const z0 = Math.floor(minZ / CELL);
    const z1 = Math.floor(maxZ / CELL);
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++) {
        const arr = this.grid.get(this.key(x, z));
        if (!arr) continue;
        for (const i of arr) {
          if (seen.has(i)) continue;
          seen.add(i);
          const b = this.boxes[i];
          if (b.maxX < minX || b.minX > maxX || b.maxZ < minZ || b.minZ > maxZ) continue;
          out.push(b);
        }
      }
    return out;
  }

  /** Highest surface under the circle whose top is at or below y + step. */
  groundAt(x: number, z: number, r: number, y: number, step = 0.45): number {
    let ground = 0;
    for (const b of this.query(x - r, x + r, z - r, z + r)) {
      if (b.maxY > y + step) continue;
      // Require the center to be over the box (with a small lip) to stand on it.
      const lip = r * 0.5;
      if (x < b.minX - lip || x > b.maxX + lip || z < b.minZ - lip || z > b.maxZ + lip) continue;
      if (b.maxY > ground) ground = b.maxY;
    }
    return ground;
  }

  /**
   * Push a circle (radius r, from p.y to p.y+height) out of all boxes it overlaps.
   * Returns true if anything was hit.
   */
  resolve(p: Vec3Like, r: number, height: number, step = 0.45): boolean {
    let hit = false;
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const b of this.query(p.x - r, p.x + r, p.z - r, p.z + r)) {
        if (b.maxY <= p.y + step || b.minY >= p.y + height) continue;
        const cx = Math.max(b.minX, Math.min(p.x, b.maxX));
        const cz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
        let dx = p.x - cx;
        let dz = p.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-9) {
          const d = Math.sqrt(d2);
          dx /= d;
          dz /= d;
          p.x += dx * (r - d);
          p.z += dz * (r - d);
        } else {
          // Center is inside the box: exit by the shallowest side.
          const left = p.x - b.minX;
          const right = b.maxX - p.x;
          const back = p.z - b.minZ;
          const front = b.maxZ - p.z;
          const m = Math.min(left, right, back, front);
          if (m === left) p.x = b.minX - r;
          else if (m === right) p.x = b.maxX + r;
          else if (m === back) p.z = b.minZ - r;
          else p.z = b.maxZ + r;
        }
        hit = moved = true;
      }
      if (!moved) break;
    }
    // World bounds
    p.x = Math.max(this.bounds.minX + r, Math.min(this.bounds.maxX - r, p.x));
    p.z = Math.max(this.bounds.minZ + r, Math.min(this.bounds.maxZ - r, p.z));
    return hit;
  }

  inWater(x: number, z: number, margin = 0): boolean {
    return this.water.some((w) => x > w.minX + margin && x < w.maxX - margin && z > w.minZ + margin && z < w.maxZ - margin);
  }

  /** Keep a walker out of water rectangles (treated like a low wall). */
  resolveWater(p: Vec3Like, r: number) {
    for (const w of this.water) {
      if (p.x > w.minX - r && p.x < w.maxX + r && p.z > w.minZ - r && p.z < w.maxZ + r) {
        const left = p.x - (w.minX - r);
        const right = w.maxX + r - p.x;
        const back = p.z - (w.minZ - r);
        const front = w.maxZ + r - p.z;
        const m = Math.min(left, right, back, front);
        if (m === left) p.x = w.minX - r;
        else if (m === right) p.x = w.maxX + r;
        else if (m === back) p.z = w.minZ - r;
        else p.z = w.maxZ + r;
      }
    }
  }

  /** Distance along a ray to the first box, or null. Used to keep the camera out of walls. */
  raycast(o: Vec3Like, dir: Vec3Like, maxDist: number): number | null {
    const ex = o.x + dir.x * maxDist;
    const ez = o.z + dir.z * maxDist;
    let best: number | null = null;
    for (const b of this.query(Math.min(o.x, ex), Math.max(o.x, ex), Math.min(o.z, ez), Math.max(o.z, ez))) {
      const t = rayAabb(o, dir, b);
      if (t !== null && t <= maxDist && (best === null || t < best)) best = t;
    }
    return best;
  }
}

export function rayAabb(o: Vec3Like, d: Vec3Like, b: AABB): number | null {
  let tmin = 0;
  let tmax = Infinity;
  const axes: [number, number, number, number][] = [
    [o.x, d.x, b.minX, b.maxX],
    [o.y, d.y, b.minY, b.maxY],
    [o.z, d.z, b.minZ, b.maxZ],
  ];
  for (const [oo, dd, mn, mx] of axes) {
    if (Math.abs(dd) < 1e-9) {
      if (oo < mn || oo > mx) return null;
    } else {
      let t1 = (mn - oo) / dd;
      let t2 = (mx - oo) / dd;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}
