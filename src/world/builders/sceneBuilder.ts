/**
 * Turns a CityDef (JSON) into everything the 3D scene needs: merged geometry, colliders, triggers,
 * tree/lamp instances, crowd & traffic paths. Pure data in → plain objects out (no React).
 */
import * as THREE from 'three';
import { makeRng } from '@/game/rng';
import type { BuildingDef, CityDef } from '@/game/content';
import type { Difficulty } from '@/game/types';
import { VoxelBuilder } from '@/engine/voxel';
import { LAYERS, LAYER_INDEX } from '@/engine/atlas';
import { buildBuilding, buildFiller, newBuilders, shade, type Builders, type SignSpec } from './buildings';
import { buildLandmark, DYNAMIC_LANDMARKS } from './landmarks';
import { kitFor, roadMarkings } from './cityKit';
import { portalKind } from '../portalKinds';
import { arrivalLayout, buildArrival } from './gates';
import { buildStreetscape, buildLots, buildBackdrop, buildParkscape, onParterre, type SignalHead, type ParkedCar, type Site } from './streetscape';
import type { Trigger } from '@/engine/runtime';

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface SceneBuild {
  key: string;
  ground: THREE.BufferGeometry;
  solid: THREE.BufferGeometry;
  lit: THREE.BufferGeometry;
  dark: THREE.BufferGeometry;
  neon: THREE.BufferGeometry;
  signs: SignSpec[];
  lampGlows: [number, number, number][];
  streetLamps: { x: number; z: number; rot: number }[];
  trees: { kind: string; x: number; z: number; s: number; r: number }[];
  colliders: Builders['colliders'];
  lowColliders: { cx: number; cz: number; w: number; d: number; maxY: number }[];
  triggers: Trigger[];
  water: Rect[];
  npcLoops: [number, number][][];
  trafficLoops: [number, number][][];
  boatLoops: { cx: number; cz: number; rx: number; rz: number }[];
  dynamic: { type: string; x: number; z: number; rot: number; scale: number; label?: string }[];
  portals: { to: string; x: number; z: number; rot: number }[];
  doors: { building: BuildingDef; x: number; z: number; rot: number }[];
  signals: SignalHead[];
  parked: ParkedCar[];
  vents: { x: number; z: number; stack: boolean }[];
  sites: Site[];
  tickers: Builders['tickers'];
  flags: Builders['flags'];
  /** Everything the pixel-art map needs, in world units. */
  map: CityMapData;
  bounds: Rect;
  spawn: { x: number; z: number; rot: number };
  garage: { x: number; z: number; rot: number };
  dock: { x: number; z: number; rot: number } | null;
}

export interface CityMapData {
  half: number;
  footprints: Builders['footprints'];
  roads: { a: [number, number]; b: [number, number]; w: number }[];
  blocks: Rect[];
  parks: Rect[];
  carParks: Rect[];
  trees: { x: number; z: number; s: number; kind: string }[];
  water: Rect[];
  plazas: { x: number; z: number; r: number; color: string }[];
  paths: { a: [number, number]; b: [number, number]; w: number }[];
  /** Building sites (hoarded lots). */
  sites: Rect[];
  isCity: boolean;
}

function rectsOverlap(a: Rect, b: Rect, margin = 0) {
  return a.minX - margin < b.maxX && a.maxX + margin > b.minX && a.minZ - margin < b.maxZ && a.maxZ + margin > b.minZ;
}

export function footprint(b: BuildingDef): Rect {
  const [w, d] = b.size;
  const sideways = b.door === 'east' || b.door === 'west';
  const hx = (sideways ? d : w) / 2;
  const hz = (sideways ? w : d) / 2;
  return { minX: b.pos[0] - hx, maxX: b.pos[0] + hx, minZ: b.pos[1] - hz, maxZ: b.pos[1] + hz };
}

function segmentDist(px: number, pz: number, a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / l2));
  return Math.hypot(px - (a[0] + t * dx), pz - (a[1] + t * dz));
}

/** Ground plane with gentle color variation (fake grass/pavement texture via vertex colors). */
function buildGround(def: CityDef): THREE.BufferGeometry {
  const size = def.half * 2 + 420;
  // ~4 m cells so the ground can dip cleanly under harbours and rivers
  const seg = Math.ceil(size / 6);
  const g = new THREE.PlaneGeometry(size, size, seg, seg);
  g.rotateX(-Math.PI / 2);
  // Sink the ground under water so the water surface is visible (the seawall hides the step)
  const pos0 = g.getAttribute('position');
  for (let i = 0; i < pos0.count; i++) {
    const x = pos0.getX(i);
    const z = pos0.getZ(i);
    if (def.water.some((w) => x > w.x - w.w / 2 + 0.6 && x < w.x + w.w / 2 - 0.6 && z > w.z - w.d / 2 + 0.6 && z < w.z + w.d / 2 - 0.6)) pos0.setY(i, -2.2);
  }
  g.computeVertexNormals();
  const base = new THREE.Color(def.ground);
  const rng = makeRng(99);
  const colors: number[] = [];
  const pos = g.getAttribute('position');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const n = Math.sin(x * 0.07) * Math.cos(z * 0.06) * 0.04 + (rng.next() - 0.5) * 0.05;
    c.copy(base).multiplyScalar(1 + n);
    // Darken outside the playable area
    const out = Math.max(Math.abs(x), Math.abs(z)) > def.half ? 0.92 : 1;
    colors.push(c.r * out, c.g * out, c.b * out);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  // Atlas UVs: grass for green grounds, worn concrete otherwise
  const layer = base.g > base.r * 1.05 && base.g > base.b ? 'grass' : 'concrete';
  const [mu, mv] = LAYERS[layer].m;
  const tex: number[] = [];
  for (let i = 0; i < pos.count; i++) tex.push(pos.getX(i) / mu, -pos.getZ(i) / mv, LAYER_INDEX[layer] + 1);
  g.setAttribute('aTex', new THREE.Float32BufferAttribute(tex, 3));
  return g;
}

export function buildOutdoor(def: CityDef, difficulty: Difficulty): SceneBuild {
  const rng = makeRng(def.filler.seed * 7919 + 13);
  const b = newBuilders();
  const H = def.half;
  const roadW = def.roads.width;
  const isCity = def.id !== 'park';
  const kit = kitFor(def.id);
  const roadColor = isCity ? kit.road : def.roads.color ?? kit.road;
  const triggers: Trigger[] = [];
  const lowColliders: SceneBuild['lowColliders'] = [];
  const water: Rect[] = def.water.map((w) => ({ minX: w.x - w.w / 2, maxX: w.x + w.w / 2, minZ: w.z - w.d / 2, maxZ: w.z + w.d / 2 }));
  const inWater = (x: number, z: number, m = 0) => water.some((w) => x > w.minX - m && x < w.maxX + m && z > w.minZ - m && z < w.maxZ + m);

  // ── Roads ──
  const roadSegs: { a: [number, number]; b: [number, number]; w: number }[] = [];
  for (const x of def.roads.xs) roadSegs.push({ a: [x, -H], b: [x, H], w: roadW });
  for (const z of def.roads.zs) roadSegs.push({ a: [-H, z], b: [H, z], w: roadW });
  // Park ring road only spans between its lines
  if (!isCity) {
    roadSegs.length = 0;
    const [x0, x1] = [Math.min(...def.roads.xs), Math.max(...def.roads.xs)];
    const [z0, z1] = [Math.min(...def.roads.zs), Math.max(...def.roads.zs)];
    roadSegs.push({ a: [x0, z0], b: [x0, z1], w: roadW }, { a: [x1, z0], b: [x1, z1], w: roadW }, { a: [x0, z0], b: [x1, z0], w: roadW }, { a: [x0, z1], b: [x1, z1], w: roadW });
  }
  for (const r of def.extraRoads ?? []) roadSegs.push({ a: r.from, b: r.to, w: r.width });
  const nearRoad = (x: number, z: number, m: number) => roadSegs.some((r) => segmentDist(x, z, r.a, r.b) < r.w / 2 + m);

  for (const r of roadSegs) {
    const dx = r.b[0] - r.a[0];
    const dz = r.b[1] - r.a[1];
    const len = Math.hypot(dx, dz);
    const rot = Math.atan2(dx, dz);
    const cx = (r.a[0] + r.b[0]) / 2;
    const cz = (r.a[1] + r.b[1]) / 2;
    b.solid.box(cx, 0.03, cz, r.w, 0.06, len + r.w, roadColor, { rotY: rot, ao: false, tex: 'asphalt' });
    // Park drives: a simple dashed centre line (city roads get their local markings below)
    if (!isCity) {
      const dashes = Math.floor(len / 5);
      for (let i = 0; i < dashes; i++) {
        const t = (i + 0.5) / dashes - 0.5;
        b.solid.box(cx + dx * t, 0.065, cz + dz * t, 0.22, 0.02, 2.2, '#f4e7b0', { rotY: rot, ao: false });
      }
    }
  }
  if (isCity) roadMarkings(def, b, makeRng(def.filler.seed * 17 + 5), inWater);

  // ── Sidewalk blocks (cities): raised curbs between roads ──
  const blocks: Rect[] = [];
  if (isCity) {
    const xs = [-H, ...def.roads.xs, H];
    const zs = [-H, ...def.roads.zs, H];
    for (let i = 0; i < xs.length - 1; i++)
      for (let j = 0; j < zs.length - 1; j++) {
        const r: Rect = {
          minX: xs[i] + (i === 0 ? 0 : roadW / 2),
          maxX: xs[i + 1] - (i + 1 === xs.length - 1 ? 0 : roadW / 2),
          minZ: zs[j] + (j === 0 ? 0 : roadW / 2),
          maxZ: zs[j + 1] - (j + 1 === zs.length - 1 ? 0 : roadW / 2),
        };
        if (r.maxX - r.minX < 4 || r.maxZ - r.minZ < 4) continue;
        // Skip sidewalks over water
        const cx = (r.minX + r.maxX) / 2;
        const cz = (r.minZ + r.maxZ) / 2;
        if (inWater(cx, cz)) continue;
        blocks.push(r);
        const clipped = { ...r };
        for (const w of water) {
          if (!rectsOverlap(clipped, w)) continue;
          // Trim the block so the sidewalk stops at the shoreline
          if (w.minZ > cz) clipped.maxZ = Math.min(clipped.maxZ, w.minZ);
          else if (w.maxZ < cz) clipped.minZ = Math.max(clipped.minZ, w.maxZ);
          else if (w.minX > cx) clipped.maxX = Math.min(clipped.maxX, w.minX);
          else clipped.minX = Math.max(clipped.minX, w.maxX);
        }
        const w = clipped.maxX - clipped.minX;
        const d = clipped.maxZ - clipped.minZ;
        b.solid.box((clipped.minX + clipped.maxX) / 2, 0.08, (clipped.minZ + clipped.maxZ) / 2, w, 0.16, d, kit.paveColor, { ao: false, tex: kit.pave });
        lowColliders.push({ cx: (clipped.minX + clipped.maxX) / 2, cz: (clipped.minZ + clipped.maxZ) / 2, w, d, maxY: 0.16 });
      }
  }

  // ── Paths & plazas ──
  for (const p of def.paths ?? []) {
    const dx = p.to[0] - p.from[0];
    const dz = p.to[1] - p.from[1];
    const len = Math.hypot(dx, dz);
    b.solid.box((p.from[0] + p.to[0]) / 2, 0.025, (p.from[1] + p.to[1]) / 2, p.width, 0.05, len, '#e3d6b8', { rotY: Math.atan2(dx, dz), ao: false, tex: 'path' });
  }
  for (const pl of def.plazas ?? []) {
    b.solid.geom(new THREE.CylinderGeometry(pl.r, pl.r, 0.08, 40), new THREE.Matrix4().makeTranslation(pl.pos[0], 0.04, pl.pos[1]), pl.color ?? '#e8dcc4', 'cobble');
    b.solid.geom(new THREE.CylinderGeometry(pl.r + 0.6, pl.r + 0.6, 0.05, 40), new THREE.Matrix4().makeTranslation(pl.pos[0], 0.025, pl.pos[1]), shade(pl.color ?? '#e8dcc4', 0.85), 'stone');
  }

  // ── Water edges (seawall) ──
  for (const w of water) {
    const wall = '#b9b2a0';
    const o = { tex: 'stone' };
    b.solid.box((w.minX + w.maxX) / 2, -0.4, w.minZ, w.maxX - w.minX + 1, 1.0, 1, wall, o);
    b.solid.box((w.minX + w.maxX) / 2, -0.4, w.maxZ, w.maxX - w.minX + 1, 1.0, 1, wall, o);
    b.solid.box(w.minX, -0.4, (w.minZ + w.maxZ) / 2, 1, 1.0, w.maxZ - w.minZ, wall, o);
    b.solid.box(w.maxX, -0.4, (w.minZ + w.maxZ) / 2, 1, 1.0, w.maxZ - w.minZ, wall, o);
  }

  // ── Data buildings ──
  const reserved: Rect[] = [];
  const doors: SceneBuild['doors'] = [];
  for (const bd of def.buildings) {
    const fp = footprint(bd);
    reserved.push(fp);
    const pal = def.palette;
    const res = buildBuilding(
      b,
      {
        name: bd.name,
        icon: bd.icon,
        cx: bd.pos[0],
        cz: bd.pos[1],
        w: bd.size[0],
        d: bd.size[1],
        h: bd.size[2],
        facing: bd.door,
        style: bd.style,
        wall: bd.colors?.wall ?? pal.walls[0],
        roof: bd.colors?.roof ?? pal.roofs[0],
        trim: bd.colors?.trim ?? pal.trims[0],
        accent: bd.colors?.accent ?? pal.accents[0],
        enterable: true,
        city: def.id,
      },
      rng,
    );
    doors.push({ building: bd, x: res.doorX, z: res.doorZ, rot: res.rot });
    const hidden = bd.advancedOnly && difficulty === 'entry' && !bd.entryStations;
    triggers.push({
      id: `door:${bd.id}`,
      kind: 'door',
      x: res.doorX,
      z: res.doorZ,
      r: 3,
      label: hidden ? `${bd.name} (Advanced mode)` : `Enter ${bd.name}`,
      icon: bd.icon,
      data: { building: bd.id },
      locked: hidden,
    });
  }

  // ── Landmarks ──
  const dynamic: SceneBuild['dynamic'] = [];
  for (const lm of def.landmarks) {
    if (DYNAMIC_LANDMARKS.has(lm.type)) {
      dynamic.push({ type: lm.type, x: lm.pos[0], z: lm.pos[1], rot: ((lm.rot ?? 0) * Math.PI) / 180, scale: lm.scale ?? 1, label: lm.label });
    } else {
      const c0 = b.colliders.length;
      buildLandmark(b, lm, rng);
      for (const c of b.colliders.slice(c0)) if (c.maxY > 3 && c.w * c.d > 6) b.footprints.push({ x: c.cx, z: c.cz, w: c.w, d: c.d, rot: c.rotY, h: c.maxY, color: '#9a958a', kind: 'landmark' });
    }
    const r = LANDMARK_RADIUS[lm.type] ?? 6;
    reserved.push({ minX: lm.pos[0] - r, maxX: lm.pos[0] + r, minZ: lm.pos[1] - r, maxZ: lm.pos[1] + r });
    if (lm.type === 'job-board') {
      triggers.push({ id: 'board:jobs', kind: 'board', x: lm.pos[0], z: lm.pos[1], r: 3.2, label: 'Odd Jobs Board', icon: '📌', data: { activity: 'odd-jobs' } });
    }
    if (lm.type === 'hall-of-fame-board') {
      triggers.push({ id: 'board:fame', kind: 'board', x: lm.pos[0], z: lm.pos[1], r: 3.2, label: 'Hall of Fame', icon: '🏆', data: { service: 'hall-of-fame' } });
    }
    if (lm.type === 'neighborhood') {
      reserved.push({ minX: lm.pos[0] - 26, maxX: lm.pos[0] + 26, minZ: lm.pos[1] - 40, maxZ: lm.pos[1] + 40 });
    }
  }
  for (const pl of def.plazas ?? []) reserved.push({ minX: pl.pos[0] - pl.r, maxX: pl.pos[0] + pl.r, minZ: pl.pos[1] - pl.r, maxZ: pl.pos[1] + pl.r });

  // ── Portals ──
  const portals = def.portals.map((p) => ({ to: p.to, x: p.pos[0], z: p.pos[1], rot: (p.rot * Math.PI) / 180 }));
  for (const p of portals) {
    reserved.push({ minX: p.x - 9, maxX: p.x + 9, minZ: p.z - 9, maxZ: p.z + 9 });
    // The landmark's solid parts collide; the doorway in front is the trigger
    const c = Math.cos(p.rot);
    const s = Math.sin(p.rot);
    // Split into small pieces: angled boxes collide as their bounding square, so big ones would
    // swallow the doorway
    for (const [lx, lz, w, d, h] of portalKind(p.to).colliders) {
      const nx = Math.max(1, Math.ceil(w / 1.5));
      const nz = Math.max(1, Math.ceil(d / 1.5));
      for (let i = 0; i < nx; i++)
        for (let j = 0; j < nz; j++) {
          const px = lx - w / 2 + (w / nx) * (i + 0.5);
          const pz = lz - d / 2 + (d / nz) * (j + 0.5);
          b.colliders.push({ cx: p.x + px * c + pz * s, cz: p.z - px * s + pz * c, w: w / nx, d: d / nz, minY: 0, maxY: h, rotY: p.rot });
        }
    }
  }

  // Keep the arrival spot, the city host, the garage and the dock open
  const keep = (x: number, z: number, r: number) => reserved.push({ minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r });
  keep(def.spawn[0], def.spawn[1], 9);
  // Arrival plaza and the gate into the place
  {
    const al = arrivalLayout(def);
    if (al.plaza) reserved.push({ minX: al.plaza.minX - 1, maxX: al.plaza.maxX + 1, minZ: al.plaza.minZ, maxZ: al.plaza.maxZ + 1 });
    else keep(al.gate.x, al.gate.z, 7);
    buildArrival(def, b);
  }
  keep(def.host.pos[0], def.host.pos[1], 5);
  keep(def.garage[0], def.garage[1], 6);
  if (def.dock) keep(def.dock[0], def.dock[1], 6);

  // ── Filler buildings fill the rest of the city blocks ──
  const emptyLots: Rect[] = [];
  if (isCity && def.filler.density > 0) {
    for (const blk of blocks) {
      const inset = 3.2;
      const r: Rect = { minX: blk.minX + inset, maxX: blk.maxX - inset, minZ: blk.minZ + inset, maxZ: blk.maxZ - inset };
      const bw = r.maxX - r.minX;
      const bd = r.maxZ - r.minZ;
      if (bw < 6 || bd < 6) continue;
      // ~12 m lots so buildings form continuous street walls; interior lots stay as courtyards
      const nx = Math.max(1, Math.round(bw / 9));
      const nz = Math.max(1, Math.round(bd / 9));
      for (let i = 0; i < nx; i++)
        for (let j = 0; j < nz; j++) {
          const interior = i > 0 && i < nx - 1 && j > 0 && j < nz - 1;
          if (interior) continue;
          const lot: Rect = {
            minX: r.minX + (bw / nx) * i + 0.3,
            maxX: r.minX + (bw / nx) * (i + 1) - 0.3,
            minZ: r.minZ + (bd / nz) * j + 0.3,
            maxZ: r.minZ + (bd / nz) * (j + 1) - 0.3,
          };
          if (reserved.some((rv) => rectsOverlap(lot, rv, 1.2))) continue;
          if (!rng.chance(def.filler.density)) {
            if (!inWater((lot.minX + lot.maxX) / 2, (lot.minZ + lot.maxZ) / 2, 4)) emptyLots.push(lot);
            continue;
          }
          const cx = (lot.minX + lot.maxX) / 2;
          const cz = (lot.minZ + lot.maxZ) / 2;
          if (inWater(cx, cz, 4)) continue;
          const lw = lot.maxX - lot.minX;
          const ld = lot.maxZ - lot.minZ;
          // Face the nearest road edge of the block
          const dists = { north: lot.minZ - blk.minZ, south: blk.maxZ - lot.maxZ, west: lot.minX - blk.minX, east: blk.maxX - lot.maxX };
          const facing = (Object.entries(dists).sort((a, b2) => a[1] - b2[1])[0][0] as keyof typeof dists);
          const centerBias = 1 - Math.min(1, Math.hypot(cx, cz) / (H * 1.1));
          const h0 = def.filler.minH + (def.filler.maxH - def.filler.minH) * Math.min(1, rng.next() * 0.6 + centerBias * 0.7);
          const sideways = facing === 'east' || facing === 'west';
          const fw = sideways ? ld : lw;
          const fd = sideways ? lw : ld;
          const style = pickFillerStyle(def.filler.style, centerBias, Math.min(fw, fd), rng);
          const h = styleHeight(style, h0, rng);
          buildFiller(b, cx, cz, fw, fd, Math.round(h), facing, style, rng, def.palette);
          reserved.push(lot);
        }
    }
  }

  // ── Street lamps along roads ──
  const streetLamps: SceneBuild['streetLamps'] = [];
  for (const r of roadSegs) {
    const dx = r.b[0] - r.a[0];
    const dz = r.b[1] - r.a[1];
    const len = Math.hypot(dx, dz);
    const nx = -dz / len;
    const nz = dx / len;
    const n = Math.floor(len / 20);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      for (const side of [-1, 1]) {
        if ((i + (side > 0 ? 1 : 0)) % 2) continue;
        const x = r.a[0] + dx * t + nx * side * (r.w / 2 + 0.9);
        const z = r.a[1] + dz * t + nz * side * (r.w / 2 + 0.9);
        if (inWater(x, z, 1)) continue;
        if (isCity && def.roads.xs.some((rx) => Math.abs(rx - x) < roadW) && def.roads.zs.some((rz) => Math.abs(rz - z) < roadW)) continue;
        if (doors.some((dr) => Math.hypot(dr.x - x, dr.z - z) < 4)) continue;
        streetLamps.push({ x, z, rot: Math.atan2(-nx * side, -nz * side) });
        b.colliders.push({ cx: x, cz: z, w: 0.4, d: 0.4, minY: 0, maxY: 5, rotY: 0 });
      }
    }
  }

  // ── Trees ──
  const trees: SceneBuild['trees'] = [];
  const kinds = def.trees.kinds;
  const trng = makeRng(def.trees.seed);
  const okTree = (x: number, z: number) => {
    if (Math.abs(x) > H - 2 || Math.abs(z) > H - 2) return false;
    if (inWater(x, z, 2)) return false;
    if (nearRoad(x, z, 1.5)) return false;
    if (reserved.some((rv) => x > rv.minX - 2.5 && x < rv.maxX + 2.5 && z > rv.minZ - 2.5 && z < rv.maxZ + 2.5)) return false;
    if ((def.paths ?? []).some((p) => segmentDist(x, z, p.from, p.to) < p.width / 2 + 1.5)) return false;
    if (doors.some((dr) => Math.hypot(dr.x - x, dr.z - z) < 6)) return false;
    if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 3.2)) return false;
    if (!isCity && onParterre(x, z, 1.5)) return false;
    return true;
  };
  if (isCity) {
    // Street trees along sidewalks
    for (const blk of blocks) {
      const edges: [number, number, number, number][] = [
        [blk.minX, blk.minZ + 1.6, blk.maxX, blk.minZ + 1.6],
        [blk.minX, blk.maxZ - 1.6, blk.maxX, blk.maxZ - 1.6],
        [blk.minX + 1.6, blk.minZ, blk.minX + 1.6, blk.maxZ],
        [blk.maxX - 1.6, blk.minZ, blk.maxX - 1.6, blk.maxZ],
      ];
      for (const [x0, z0, x1, z1] of edges) {
        const len = Math.hypot(x1 - x0, z1 - z0);
        for (let t = 7; t < len - 5; t += 11) {
          const x = x0 + ((x1 - x0) * t) / len;
          const z = z0 + ((z1 - z0) * t) / len;
          if (trees.length >= def.trees.count) break;
          if (inWater(x, z, 1) || doors.some((dr) => Math.hypot(dr.x - x, dr.z - z) < 5) || streetLamps.some((l) => Math.hypot(l.x - x, l.z - z) < 3)) continue;
          if (Math.hypot(x - def.spawn[0], z - def.spawn[1]) < 9 || Math.hypot(x - def.host.pos[0], z - def.host.pos[1]) < 4) continue;
          trees.push({ kind: trng.pick(kinds), x, z, s: trng.range(0.8, 1.05), r: trng.range(0, Math.PI * 2) });
        }
      }
    }
  }
  for (let tries = 0; trees.length < def.trees.count && tries < def.trees.count * 40; tries++) {
    const x = trng.range(-H, H);
    const z = trng.range(-H, H);
    if (!okTree(x, z)) continue;
    trees.push({ kind: trng.pick(kinds), x, z, s: trng.range(0.8, 1.35), r: trng.range(0, Math.PI * 2) });
  }
  // Park landscaping (before tree colliders so its avenue trees collide too)
  if (!isCity) {
    const clear = (x: number, z: number, m: number) =>
      !reserved.some((rv) => x > rv.minX - m && x < rv.maxX + m && z > rv.minZ - m && z < rv.maxZ + m) && !inWater(x, z, 1) && !doors.some((dr) => Math.hypot(dr.x - x, dr.z - z) < m + 3) && !trees.some((t) => Math.hypot(t.x - x, t.z - z) < 2.5);
    buildParkscape(def, b, makeRng(77), trees, streetLamps, clear);
  }
  // Tree trunks collide
  for (const t of trees) b.colliders.push({ cx: t.x, cz: t.z, w: 0.7 * t.s, d: 0.7 * t.s, minY: 0, maxY: 4, rotY: 0 });

  // ── Streetscape: furniture, bus stops, signals, markings, parked cars ──
  const street = isCity
    ? buildStreetscape({ def, b, rng: makeRng(def.filler.seed * 31 + 7), blocks, doors, lamps: streetLamps, trees, inWater })
    : { signals: [], parked: [], vents: [] };
  const lots = isCity ? buildLots(emptyLots, b, makeRng(def.filler.seed * 13 + 3), trees, street.parked, kinds) : { parks: [], carParks: [], sites: [] as Site[] };
  buildBackdrop(def, b, makeRng(def.filler.seed * 17 + 11), (x, z, m = 0) => inWater(x, z, m));

  // ── Crowd paths ──
  const npcLoops: [number, number][][] = [];
  if (isCity) {
    for (const blk of blocks) {
      if (blk.maxX - blk.minX < 10 || blk.maxZ - blk.minZ < 10) continue;
      const m = 1.2;
      npcLoops.push([
        [blk.minX + m, blk.minZ + m],
        [blk.maxX - m, blk.minZ + m],
        [blk.maxX - m, blk.maxZ - m],
        [blk.minX + m, blk.maxZ - m],
      ]);
    }
  } else {
    for (const r of [13.5, 19.5]) {
      const loop: [number, number][] = [];
      for (let i = 0; i < 16; i++) loop.push([Math.cos((i / 16) * Math.PI * 2) * r, Math.sin((i / 16) * Math.PI * 2) * r]);
      npcLoops.push(loop);
    }
    const x0 = Math.min(...def.roads.xs) + roadW / 2 + 1.5;
    const x1 = Math.max(...def.roads.xs) - roadW / 2 - 1.5;
    const z0 = Math.min(...def.roads.zs) + roadW / 2 + 1.5;
    const z1 = Math.max(...def.roads.zs) - roadW / 2 - 1.5;
    npcLoops.push([[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);
  }

  // ── Traffic loops (drive on the right, except London) ──
  const trafficLoops: [number, number][][] = [];
  const xs = [...def.roads.xs].sort((a, b2) => a - b2);
  const zs = [...def.roads.zs].sort((a, b2) => a - b2);
  // Lane center sits a little inside the quarter line so cars clear the parked row at the curb
  const lane = roadW / 4 - 0.2;
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < zs.length - 1; j++) {
      // Clockwise rectangle offset inward = right-hand lane when driving clockwise (viewed from above)
      const loop: [number, number][] = [
        [xs[i] + lane, zs[j] + lane],
        [xs[i + 1] - lane, zs[j] + lane],
        [xs[i + 1] - lane, zs[j + 1] - lane],
        [xs[i] + lane, zs[j + 1] - lane],
      ];
      if (loop.some(([x, z]) => inWater(x, z))) continue;
      // London drives on the left: same inside lane, opposite direction
      if (def.id === 'london') loop.reverse();
      trafficLoops.push(loop);
    }

  const boatLoops = water.map((w) => ({
    cx: (w.minX + w.maxX) / 2,
    cz: (w.minZ + w.maxZ) / 2,
    rx: (w.maxX - w.minX) / 2 - 6,
    rz: (w.maxZ - w.minZ) / 2 - 6,
  }));

  // Host NPC
  triggers.push({ id: 'npc:host', kind: 'npc', x: def.host.pos[0], z: def.host.pos[1], r: 3, label: `Talk to ${def.host.name}`, icon: '💬', data: { host: true } });

  // Portals
  for (const p of portals) {
    triggers.push({ id: `portal:${p.to}`, kind: 'portal', x: p.x, z: p.z, r: 3.2, label: `Portal`, icon: '🌀', data: { to: p.to } });
  }

  const deg = (d: number) => (d * Math.PI) / 180;
  return {
    key: def.id,
    ground: buildGround(def),
    solid: b.solid.build(),
    lit: b.lit.build(),
    dark: b.dark.build(),
    neon: b.neon.build(),
    signs: b.signs,
    lampGlows: b.lamps,
    streetLamps,
    trees,
    colliders: b.colliders,
    lowColliders,
    triggers,
    water,
    npcLoops,
    trafficLoops,
    boatLoops,
    dynamic,
    portals,
    doors,
    signals: street.signals,
    parked: street.parked,
    vents: street.vents,
    sites: lots.sites,
    tickers: b.tickers,
    flags: b.flags,
    map: {
      half: H,
      footprints: b.footprints,
      roads: roadSegs,
      blocks,
      parks: lots.parks,
      carParks: lots.carParks,
      trees: trees.map((t) => ({ x: t.x, z: t.z, s: t.s, kind: t.kind })),
      water,
      plazas: (def.plazas ?? []).map((p) => ({ x: p.pos[0], z: p.pos[1], r: p.r, color: p.color ?? '#e8dcc4' })),
      paths: (def.paths ?? []).map((p) => ({ a: p.from, b: p.to, w: p.width })),
      sites: lots.sites.map((st) => st.lot),
      isCity,
    },
    bounds: { minX: -H, maxX: H, minZ: -H, maxZ: H },
    spawn: { x: def.spawn[0], z: def.spawn[1], rot: deg(def.spawn[2]) },
    garage: { x: def.garage[0], z: def.garage[1], rot: deg(def.garage[2]) },
    dock: def.dock ? { x: def.dock[0], z: def.dock[1], rot: deg(def.dock[2]) } : null,
  };
}

const LANDMARK_RADIUS: Record<string, number> = {
  fountain: 7,
  'narwhal-statue': 4,
  'ferris-wheel': 12,
  'big-wheel': 16,
  bandstand: 9,
  playground: 12,
  garden: 12,
  'liberty-torch': 9,
  'deco-spire': 10,
  'clock-tower': 6,
  'triangle-tower': 9,
  'pyramid-tower': 9,
  'marina-towers': 32,
  'peak-hill': 40,
  supertrees: 16,
  'hawker-center': 14,
  bridge: 6,
  'tower-bridge': 6,
  neighborhood: 4,
};

/**
 * Which building type stands on a lot. `core` is 1 at the city centre and 0 at the edges,
 * so each city has a downtown, a mid-ring and residential streets.
 */
function pickFillerStyle(style: string, core: number, size: number, rng: ReturnType<typeof makeRng>): string {
  const r = rng.next();
  switch (style) {
    case 'ny':
      if (core > 0.62) return r < 0.4 ? 'glass' : r < 0.7 ? 'tower' : 'ny-prewar';
      if (core > 0.35) return r < 0.5 ? 'ny-prewar' : r < 0.8 ? 'ny-loft' : 'ny-brownstone';
      return r < 0.7 ? 'ny-brownstone' : 'ny-prewar';
    case 'london':
      if (core > 0.62 && size > 10) return r < 0.12 ? 'ldn-gherkin' : r < 0.2 ? 'ldn-shard' : r < 0.65 ? 'glass' : 'ldn-mansion';
      return r < 0.68 ? 'ldn-terrace' : r < 0.9 ? 'ldn-mansion' : 'office';
    case 'sf':
      if (core > 0.62) return r < 0.6 ? 'glass' : r < 0.8 ? 'office' : 'sf-mission';
      return r < 0.75 ? 'sf-painted' : 'sf-mission';
    case 'hk':
      if (core > 0.6) return r < 0.55 ? 'glass' : 'hk-tower';
      return r < 0.62 ? 'hk-tower' : 'hk-tonglau';
    case 'sg':
      if (core > 0.62) return r < 0.5 ? 'glass' : 'sg-eco';
      if (core > 0.3) return r < 0.7 ? 'sg-shophouse' : 'sg-eco';
      return r < 0.75 ? 'sg-hdb' : 'sg-shophouse';
    default:
      return 'office';
  }
}

/** Realistic height range for each building type (falls back to the city's distribution). */
function styleHeight(style: string, h: number, rng: ReturnType<typeof makeRng>): number {
  const R: Record<string, [number, number]> = {
    'ny-brownstone': [12, 15],
    'ny-prewar': [20, 42],
    'ny-loft': [15, 23],
    'ldn-terrace': [13, 16],
    'ldn-mansion': [16, 22],
    'ldn-gherkin': [56, 70],
    'ldn-shard': [70, 90],
    'sf-painted': [9.5, 12],
    'sf-mission': [8, 12],
    'hk-tower': [42, 78],
    'hk-tonglau': [16, 23],
    'sg-shophouse': [9, 12],
    'sg-hdb': [32, 48],
    'sg-eco': [40, 62],
  };
  const r = R[style];
  return r ? rng.range(r[0], r[1]) : h;
}

export { VoxelBuilder };

const mapCache = new Map<string, CityMapData>();
/** Lightweight map data for any city (builds the layout once; 3D geometry is not kept). */
export function getCityMap(def: CityDef, difficulty: Difficulty): CityMapData {
  const key = def.id + ':' + difficulty;
  let hit = mapCache.get(key);
  if (!hit) {
    hit = buildOutdoor(def, difficulty).map;
    mapCache.set(key, hit);
  }
  return hit;
}
/** Builds the 3D scene for a city and remembers its map data. */
export function getCityBuild(def: CityDef, difficulty: Difficulty): SceneBuild {
  const build = buildOutdoor(def, difficulty);
  mapCache.set(def.id + ':' + difficulty, build.map);
  return build;
}
