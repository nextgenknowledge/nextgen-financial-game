/**
 * Walking routes for the guide. A coarse grid of the current scene marks every cell a body can't
 * pass (buildings, furniture, water); A* finds the shortest route around them and the result is
 * smoothed so it reads as a natural path. Narwhal leads along it and the ground trail draws it,
 * so both always agree with the goal beacon.
 */
import type { CollisionWorld } from './collision';

const CELL = 0.5;
const BODY = 0.3;

interface Grid {
  key: string;
  x0: number;
  z0: number;
  nx: number;
  nz: number;
  blocked: Uint8Array;
}

let cache: Grid | null = null;

function gridFor(c: CollisionWorld, sceneKey: string): Grid {
  const key = `${sceneKey}:${c.id}:${c.boxes.length}`;
  if (cache?.key === key) return cache;
  const { minX, maxX, minZ, maxZ } = c.bounds;
  const nx = Math.ceil((maxX - minX) / CELL);
  const nz = Math.ceil((maxZ - minZ) / CELL);
  const blocked = new Uint8Array(nx * nz);
  for (const b of c.boxes) {
    // Kerbs, steps and anything you can walk over don't block
    if (b.maxY <= 0.5 || b.minY > 1.6) continue;
    const i0 = Math.max(0, Math.floor((b.minX - BODY - minX) / CELL));
    const i1 = Math.min(nx - 1, Math.floor((b.maxX + BODY - minX) / CELL));
    const j0 = Math.max(0, Math.floor((b.minZ - BODY - minZ) / CELL));
    const j1 = Math.min(nz - 1, Math.floor((b.maxZ + BODY - minZ) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) blocked[j * nx + i] = 1;
  }
  for (const w of c.water) {
    const i0 = Math.max(0, Math.floor((w.minX - minX) / CELL));
    const i1 = Math.min(nx - 1, Math.floor((w.maxX - minX) / CELL));
    const j0 = Math.max(0, Math.floor((w.minZ - minZ) / CELL));
    const j1 = Math.min(nz - 1, Math.floor((w.maxZ - minZ) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) blocked[j * nx + i] = 1;
  }
  cache = { key, x0: minX, z0: minZ, nx, nz, blocked };
  return cache;
}

/** Nearest open cell (spiral search), for starts or goals that sit inside a collider. */
function nearestOpen(g: Grid, i: number, j: number) {
  for (let r = 0; r < 12; r++)
    for (let dj = -r; dj <= r; dj++)
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const a = i + di;
        const b = j + dj;
        if (a >= 0 && b >= 0 && a < g.nx && b < g.nz && !g.blocked[b * g.nx + a]) return [a, b];
      }
  return null;
}

function clear(g: Grid, a: [number, number], b: [number, number]) {
  const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) * 2;
  for (let k = 0; k <= n; k++) {
    const i = Math.round(a[0] + ((b[0] - a[0]) * k) / (n || 1));
    const j = Math.round(a[1] + ((b[1] - a[1]) * k) / (n || 1));
    if (g.blocked[j * g.nx + i]) return false;
  }
  return true;
}

/** Shortest walkable route from (fx,fz) to (tx,tz) as world points, or null if there is none. */
export function findPath(c: CollisionWorld, sceneKey: string, fx: number, fz: number, tx: number, tz: number, reach = 2.2): [number, number][] | null {
  const g = gridFor(c, sceneKey);
  const toCell = (x: number, z: number) => [Math.floor((x - g.x0) / CELL), Math.floor((z - g.z0) / CELL)] as [number, number];
  const s0 = toCell(fx, fz);
  const e0 = toCell(tx, tz);
  const s = nearestOpen(g, s0[0], s0[1]);
  const e = e0;
  if (!s) return null;
  // Arriving anywhere within `reach` of the target counts (doors and counters trigger from a distance)
  const R = reach / CELL;
  const N = g.nx * g.nz;
  const cost = new Float32Array(N).fill(Infinity);
  const from = new Int32Array(N).fill(-1);
  const start = s[1] * g.nx + s[0];
  let goal = -1;
  // Binary heap of (priority, node); priorities are snapshots so later improvements just add entries
  const hn: number[] = [];
  const hp: number[] = [];
  const f = { set: (n: number, v: number) => push(n, v) };
  const push = (n: number, pr: number) => {
    hn.push(n);
    hp.push(pr);
    let k = hn.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (hp[p] <= hp[k]) break;
      [hn[p], hn[k]] = [hn[k], hn[p]];
      [hp[p], hp[k]] = [hp[k], hp[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = hn[0];
    const ln = hn.pop()!;
    const lp = hp.pop()!;
    if (hn.length) {
      hn[0] = ln;
      hp[0] = lp;
      let k = 0;
      for (;;) {
        const l = k * 2 + 1;
        const r = l + 1;
        let m = k;
        if (l < hn.length && hp[l] < hp[m]) m = l;
        if (r < hn.length && hp[r] < hp[m]) m = r;
        if (m === k) break;
        [hn[m], hn[k]] = [hn[k], hn[m]];
        [hp[m], hp[k]] = [hp[k], hp[m]];
        k = m;
      }
    }
    return top;
  };
  const h = (n: number) => Math.max(0, Math.hypot((n % g.nx) - e[0], Math.floor(n / g.nx) - e[1]) - R);
  cost[start] = 0;
  f.set(start, h(start));
  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  let found = false;
  let steps = 0;
  const closed = new Uint8Array(N);
  while (hn.length && steps++ < N * 2) {
    const n = pop();
    if (closed[n]) continue;
    closed[n] = 1;
    if (h(n) === 0) {
      found = true;
      goal = n;
      break;
    }
    const i = n % g.nx;
    const j = Math.floor(n / g.nx);
    for (const [di, dj, w] of DIRS) {
      const a = i + di;
      const b = j + dj;
      if (a < 0 || b < 0 || a >= g.nx || b >= g.nz) continue;
      const m = b * g.nx + a;
      if (g.blocked[m]) continue;
      // No squeezing diagonally between two blocked cells
      if (di && dj && (g.blocked[j * g.nx + a] || g.blocked[b * g.nx + i])) continue;
      const nc = cost[n] + w;
      if (nc < cost[m]) {
        cost[m] = nc;
        from[m] = n;
        f.set(m, nc + h(m));
      }
    }
  }
  if (!found) return null;
  const cells: [number, number][] = [];
  for (let n = goal; n !== -1; n = from[n]) cells.push([n % g.nx, Math.floor(n / g.nx)]);
  cells.reverse();
  // String-pulling: keep only the turning points that are needed
  const pts: [number, number][] = [cells[0]];
  let anchor = 0;
  for (let k = 2; k < cells.length; k++) {
    if (!clear(g, cells[anchor], cells[k])) {
      pts.push(cells[k - 1]);
      anchor = k - 1;
    }
  }
  pts.push(cells[cells.length - 1]);
  const world = pts.map(([i, j]) => [g.x0 + (i + 0.5) * CELL, g.z0 + (j + 0.5) * CELL] as [number, number]);
  world[0] = [fx, fz];
  // Finish on the target itself if it's in plain view from the last point
  const last = cells[cells.length - 1];
  if (e0[0] >= 0 && e0[1] >= 0 && e0[0] < g.nx && e0[1] < g.nz && !g.blocked[e0[1] * g.nx + e0[0]] && clear(g, last, e0)) world.push([tx, tz]);
  return world;
}

/** Point `ahead` metres along a polyline from its start. */
export function alongPath(path: [number, number][], ahead: number): [number, number] {
  let left = ahead;
  for (let k = 0; k < path.length - 1; k++) {
    const [ax, az] = path[k];
    const [bx, bz] = path[k + 1];
    const seg = Math.hypot(bx - ax, bz - az);
    if (seg >= left) return [ax + ((bx - ax) * left) / (seg || 1), az + ((bz - az) * left) / (seg || 1)];
    left -= seg;
  }
  return path[path.length - 1];
}

/** The point `dist` metres further along the route from wherever (x,z) is closest to it. */
export function aheadOnPath(path: [number, number][], x: number, z: number, dist: number): [number, number] {
  let best = 0;
  let bestT = 0;
  let bestD = Infinity;
  for (let k = 0; k < path.length - 1; k++) {
    const [ax, az] = path[k];
    const [bx, bz] = path[k + 1];
    const vx = bx - ax;
    const vz = bz - az;
    const L = vx * vx + vz * vz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L));
    const d = Math.hypot(ax + vx * t - x, az + vz * t - z);
    if (d < bestD) {
      bestD = d;
      best = k;
      bestT = t;
    }
  }
  const [ax, az] = path[best];
  const [bx, bz] = path[best + 1] ?? path[best];
  const rest: [number, number][] = [[ax + (bx - ax) * bestT, az + (bz - az) * bestT], ...path.slice(best + 1)];
  return alongPath(rest, dist);
}

/** True when a body can walk straight from (ax,az) to (bx,bz) without meeting a blocked cell. */
export function lineClear(c: CollisionWorld, sceneKey: string, ax: number, az: number, bx: number, bz: number): boolean {
  const g = gridFor(c, sceneKey);
  const a: [number, number] = [Math.floor((ax - g.x0) / CELL), Math.floor((az - g.z0) / CELL)];
  const b: [number, number] = [Math.floor((bx - g.x0) / CELL), Math.floor((bz - g.z0) / CELL)];
  const inside = (p: [number, number]) => p[0] >= 0 && p[1] >= 0 && p[0] < g.nx && p[1] < g.nz;
  if (!inside(a) || !inside(b)) return false;
  return clear(g, a, b);
}
