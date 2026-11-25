/**
 * Fin City Motor Stadium, past the park's north edge: a wide tarmac oval with red-and-white kerbs
 * and a wall on both sides, stands all the way round (nine rows, coloured seats), a roofed main
 * stand on the north straight, a tunnel under the south stand that the park road drives through,
 * a chequered start line under a gantry, gold checkpoint arches, floodlight towers and a big
 * scoreboard in the infield. Layout and lap rules are in src/game/speedway.ts.
 */
import * as THREE from 'three';
import type { Builders } from './buildings';
import { cylinder } from '@/engine/voxel';
import { CHECKPOINTS, STAND, STAND_OUTER, TRACK, TUNNEL, TURN_R, TURN_Z } from '@/game/speedway';

type Seg = { a: [number, number]; b: [number, number]; w: number };

const ASPHALT = '#3d4148';
const KERB = ['#d8402f', '#f4f1ea'];
const GOLD = '#e9b23a';
const CONCRETE = '#a29d92';
const FACADE = '#1f2a44';
const GRASS = '#5f9a48';
const SEATS = ['#2f6bdb', '#e5533d', '#ffcf3f', '#3cc45a', '#f4f1ea'];
/** Made-up sponsors for the boards along the track wall. */
const BOARDS = ['FINBUCKS', 'HARBOR TRADING', 'NORTHLINE RAIL', 'PINEWOOD POWER', 'SAVE EARLY', 'VANTAGE CHIPS', 'CLOUDNEST', 'GRANARY FOODS'];

/**
 * A point on the oval at distance `off` from the centre line (positive = outside), going round by
 * `t` from 0 to 1: the south straight west to east, the east turn, the north straight east to
 * west, then the west turn.
 */
function ovalPoint(t: number, off: number): { x: number; z: number } {
  const L = TRACK.halfLen * 2;
  const r = TURN_R + off;
  const C = Math.PI * r;
  const total = 2 * L + 2 * C;
  let d = (((t % 1) + 1) % 1) * total;
  if (d < L) return { x: -TRACK.halfLen + d, z: TRACK.southZ + off };
  d -= L;
  if (d < C) {
    const a = -Math.PI / 2 + (d / C) * Math.PI;
    return { x: TRACK.halfLen + Math.cos(a) * r, z: TURN_Z - Math.sin(a) * r };
  }
  d -= C;
  if (d < L) return { x: TRACK.halfLen - d, z: TRACK.northZ - off };
  d -= L;
  const a = Math.PI / 2 + (d / C) * Math.PI;
  return { x: -TRACK.halfLen + Math.cos(a) * r, z: TURN_Z - Math.sin(a) * r };
}

/** Pieces of a ring round the oval at `off`, each about `step` metres long. `dir` is atan2(dx, dz). */
function ring(off: number, step: number) {
  const perim = 4 * TRACK.halfLen + 2 * Math.PI * (TURN_R + off);
  const n = Math.max(24, Math.round(perim / step));
  const out: { x: number; z: number; len: number; dir: number }[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = ovalPoint(i / n, off);
    const p1 = ovalPoint((i + 1) / n, off);
    out.push({ x: (p0.x + p1.x) / 2, z: (p0.z + p1.z) / 2, len: Math.hypot(p1.x - p0.x, p1.z - p0.z), dir: Math.atan2(p1.x - p0.x, p1.z - p0.z) });
  }
  return out;
}

/** True where a piece `m` metres long would reach into the tunnel through the south stand. */
const inTunnel = (x: number, z: number, m = 0) => Math.abs(x - TUNNEL.x) < TUNNEL.halfWidth + 1.2 + m && z > TRACK.southZ;
/** Facing (rotY) for a sign that looks along the vector (fx, fz). */
const facing = (fx: number, fz: number) => Math.atan2(fx, fz);

/** Draws the stadium; returns its road pieces (track and the road in) for the map. */
export function buildSpeedway(b: Builders): Seg[] {
  const s = b.solid;
  const W = TRACK.width;
  const L = TRACK.halfLen;
  const segs: Seg[] = [];

  // Ground under the whole stadium: a concrete concourse, the infield in grass
  const outer = STAND_OUTER + 4;
  s.box(0, 0.02, TURN_Z, (L + TURN_R + outer) * 2, 0.04, (TURN_R + outer) * 2, CONCRETE, { ao: false, tex: 'concrete' });
  const inR = TURN_R - W / 2 - 1.2;
  s.box(0, 0.035, TURN_Z, L * 2, 0.04, inR * 2, GRASS, { ao: false });
  for (const side of [-1, 1]) s.geom(cylinder(inR, inR, 0.04, 28), new THREE.Matrix4().makeTranslation(side * L, 0.035, TURN_Z), GRASS);

  // Track: overlapping slabs round the oval, kerbs on both edges, a dashed line down the straights
  for (const p of ring(0, 6)) s.box(p.x, 0.06, p.z, W, 0.09, p.len + 0.8, ASPHALT, { ao: false, tex: 'asphalt', rotY: p.dir });
  for (const e of [-1, 1]) ring(e * (W / 2 + 0.4), 2.2).forEach((p, i) => s.box(p.x, 0.12, p.z, 0.8, 0.12, p.len, KERB[i % 2], { ao: false, rotY: p.dir }));
  for (const z of [TRACK.southZ, TRACK.northZ]) for (let x = -L + 2; x < L - 2; x += 7) s.box(x, 0.11, z, 3, 0.01, 0.2, '#e8e2cf', { ao: false });
  const mapRing = ring(0, 10);
  mapRing.forEach((p) => segs.push({ a: [p.x - (Math.sin(p.dir) * p.len) / 2, p.z - (Math.cos(p.dir) * p.len) / 2], b: [p.x + (Math.sin(p.dir) * p.len) / 2, p.z + (Math.cos(p.dir) * p.len) / 2], w: W }));

  // Walls both sides of the track (the outer one opens where the tunnel comes in), with sponsor
  // boards facing the track along the outer wall of the straights
  const wallOff = W / 2 + 1.2;
  let board = 0;
  for (const e of [-1, 1]) {
    ring(e * wallOff, 4).forEach((p, i) => {
      if (e > 0 && inTunnel(p.x, p.z, p.len / 2 - 1.2)) return;
      s.box(p.x, 0.6, p.z, 0.5, 1.2, p.len + 0.1, e > 0 ? '#e8e6df' : '#c9452f', { rotY: p.dir, tex: 'concrete' });
      b.colliders.push({ cx: p.x, cz: p.z, w: 0.6, d: p.len + 0.1, minY: 0, maxY: 1.4, rotY: p.dir });
      if (e > 0 && i % 5 === 2 && Math.abs(p.x) < L - 6 && !inTunnel(p.x, p.z, 4)) {
        // Outward normal is +z on the south straight and -z on the north one; boards face inward
        const out = p.z > TURN_Z ? 1 : -1;
        b.signs.push({ text: BOARDS[board++ % BOARDS.length], x: p.x, y: 0.62, z: p.z - out * 0.27, rotY: facing(0, -out), w: 7, h: 0.8, bg: FACADE, fg: '#ffcf3f' });
      }
    });
  }

  // Stands: nine rising rows all the way round, each a band of coloured seats on a concrete step
  for (let row = 0; row < STAND.rows; row++) {
    const off = W / 2 + STAND.gap + (row + 0.5) * STAND.rowDepth;
    const top = 0.9 + row * STAND.rowRise;
    ring(off, 6).forEach((p, i) => {
      if (inTunnel(p.x, p.z, p.len / 2)) return;
      s.box(p.x, top / 2, p.z, STAND.rowDepth + 0.05, top, p.len + 0.15, CONCRETE, { rotY: p.dir, tex: 'concrete' });
      s.box(p.x, top + 0.18, p.z, STAND.rowDepth * 0.55, 0.36, p.len - 0.2, SEATS[(row * 3 + i) % SEATS.length], { ao: false, rotY: p.dir });
    });
  }
  // The back of the stands: a tall facade the whole way round
  const backTop = 0.9 + STAND.rows * STAND.rowRise + 2.4;
  ring(STAND_OUTER + 0.4, 6).forEach((p) => {
    if (inTunnel(p.x, p.z, p.len / 2)) return;
    s.box(p.x, backTop / 2, p.z, 0.8, backTop, p.len + 0.2, FACADE, { rotY: p.dir, tex: 'metal' });
  });
  // One collider band over the stands, so cars can't climb them
  const standW = STAND.rows * STAND.rowDepth + STAND.gap - 0.4;
  ring(wallOff + 0.3 + standW / 2, 6).forEach((p) => {
    if (inTunnel(p.x, p.z, p.len / 2)) return;
    b.colliders.push({ cx: p.x, cz: p.z, w: standW, d: p.len + 0.2, minY: 0, maxY: backTop, rotY: p.dir });
  });

  // Main stand on the north straight: a roof on tall columns over the top rows, the name above
  const nBack = TRACK.northZ - STAND_OUTER;
  const roofD = STAND.rows * STAND.rowDepth * 0.7;
  s.box(0, backTop + 1.4, nBack + roofD / 2, L * 1.5, 0.4, roofD, '#e8e6df', { tex: 'metal' });
  for (let x = -L * 0.75; x <= L * 0.75 + 0.1; x += L * 0.25) s.box(x, (backTop + 1.4) / 2, nBack - 0.4, 0.6, backTop + 1.4, 0.6, '#d9dde3', { tex: 'metal' });
  b.signs.push({ text: 'FIN CITY MOTOR STADIUM', x: 0, y: backTop - 1.4, z: nBack + 0.05, rotY: 0, w: 36, h: 2.2, bg: FACADE, fg: '#ffcf3f' });

  // Tunnel under the south stand: walls, filled-in shoulders, a roof, the road through, and the
  // stadium's name over the entrance on the park side
  const tz0 = TRACK.southZ + wallOff;
  const tz1 = TRACK.southZ + STAND_OUTER + 0.8;
  const tLen = tz1 - tz0;
  const tMid = (tz0 + tz1) / 2;
  for (const e of [-1, 1]) {
    const x = TUNNEL.x + e * (TUNNEL.halfWidth + 0.4);
    s.box(x, 2.6, tMid, 0.8, 5.2, tLen, CONCRETE, { tex: 'concrete' });
    const sx = TUNNEL.x + e * (TUNNEL.halfWidth + 0.8 + 3);
    s.box(sx, backTop / 2, tMid + 0.4, 6.4, backTop, tLen + 0.8, FACADE, { tex: 'metal' });
    b.colliders.push({ cx: (x + sx) / 2 + e * 1.4, cz: tMid, w: 7.4, d: tLen, minY: 0, maxY: backTop, rotY: 0 });
  }
  s.box(TUNNEL.x, 5.5, tMid, TUNNEL.halfWidth * 2 + 1.6, 0.6, tLen, '#8d8a82', { tex: 'concrete' });
  s.box(TUNNEL.x, backTop / 2 + 3, tMid + 0.4, TUNNEL.halfWidth * 2 + 1.6, backTop - 5.6, tLen + 0.8, FACADE, { tex: 'metal' });
  s.box(TUNNEL.x, 0.07, tMid + 6, TUNNEL.halfWidth * 2 - 2, 0.08, tLen + 12, ASPHALT, { ao: false, tex: 'asphalt' });
  for (let k = 0; k < 4; k++) b.lamps.push([TUNNEL.x, 5.0, tz0 + 2 + (k * (tLen - 4)) / 3]);
  b.signs.push({ text: 'FIN CITY MOTOR STADIUM', x: TUNNEL.x, y: 7.4, z: tz1 + 0.86, rotY: 0, w: TUNNEL.halfWidth * 2 + 6, h: 2.2, bg: FACADE, fg: '#ffcf3f' });
  segs.push({ a: [TUNNEL.x, tz0], b: [TUNNEL.x, tz1 + 12], w: TUNNEL.halfWidth * 2 - 2 });

  // Chequered start line under a gantry
  const [st] = CHECKPOINTS;
  const sq = W / 16;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 16; j++) s.box(st.x - sq / 2 + i * sq, 0.115, st.z - W / 2 + sq / 2 + j * sq, sq, 0.012, sq, (i + j) % 2 ? '#f4f1ea' : '#1f2226', { ao: false });
  for (const e of [-1, 1]) s.box(st.x, 3.7, st.z + e * (W / 2 + 0.7), 0.5, 7.4, 0.5, '#d9dde3', { tex: 'metal' });
  s.box(st.x, 7.6, st.z, 0.6, 1.5, W + 2, FACADE, { tex: 'metal' });
  for (const fx of [-1, 1]) b.signs.push({ text: 'START / FINISH', x: st.x + fx * 0.32, y: 7.6, z: st.z, rotY: facing(fx, 0), w: W, h: 1.2, bg: FACADE, fg: '#ffcf3f' });
  for (let k = -3; k <= 3; k++) b.lamps.push([st.x, 8.5, st.z + k * 2]);

  // Gold checkpoint arches over the track
  for (const cp of CHECKPOINTS.slice(1)) {
    const across = Math.abs(cp.z - TRACK.northZ) < 1 ? 'z' : 'x';
    for (const e of [-1, 1]) {
      const px = across === 'x' ? cp.x + e * (W / 2 + 0.7) : cp.x;
      const pz = across === 'z' ? cp.z + e * (W / 2 + 0.7) : cp.z;
      s.box(px, 3, pz, 0.45, 6, 0.45, GOLD, { tex: 'metal' });
    }
    s.box(cp.x, 6.1, cp.z, across === 'x' ? W + 2 : 0.55, 0.55, across === 'z' ? W + 2 : 0.55, GOLD, { tex: 'metal' });
    b.lamps.push([cp.x, 5.8, cp.z]);
  }

  // Floodlight towers behind the four corners of the stands, their lamps angled at the track
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const r = TURN_R + STAND_OUTER + 4;
      const x = sx * (L + Math.cos(Math.PI / 4) * r);
      const z = TURN_Z + sz * Math.sin(Math.PI / 4) * r;
      s.box(x, 15, z, 1.2, 30, 1.2, '#d9dde3', { tex: 'metal' });
      s.box(x, 30.6, z, 7, 2.8, 1, '#2a2f3d', { rotY: facing(-x, TURN_Z - z) + Math.PI / 2 });
      b.colliders.push({ cx: x, cz: z, w: 1.4, d: 1.4, minY: 0, maxY: 32, rotY: 0 });
      for (let k = -1; k <= 1; k++) b.lamps.push([x + k * 1.8 * sz * sx, 30.4, z + k * 1.8 * 0.5]);
    }

  // Scoreboard in the middle of the infield, readable from both straights
  for (const e of [-1, 1]) s.box(e * 8, 4, TURN_Z, 0.8, 8, 0.8, '#5a606b', { tex: 'metal' });
  s.box(0, 11, TURN_Z, 26, 7, 1, '#16181c');
  for (const fz of [1, -1]) b.signs.push({ text: 'FIN CITY MOTOR STADIUM', x: 0, y: 11, z: TURN_Z + fz * 0.55, rotY: facing(0, fz), w: 24, h: 5, bg: '#16181c', fg: '#ffcf3f' });
  b.colliders.push({ cx: 0, cz: TURN_Z, w: 18, d: 1.2, minY: 0, maxY: 15, rotY: 0 });

  return segs;
}
