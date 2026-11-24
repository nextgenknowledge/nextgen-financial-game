/**
 * Fin City Speedway in the park: tarmac oval with red-and-white kerbs, a chequered start line under
 * a gantry, gold checkpoint arches, tyre walls on the turns and a grandstand. Layout and lap rules
 * are in src/game/speedway.ts.
 */
import * as THREE from 'three';
import type { Builders } from './buildings';
import { cylinder } from '@/engine/voxel';
import { CHECKPOINTS, TRACK, TURN_R, TURN_Z } from '@/game/speedway';

type Seg = { a: [number, number]; b: [number, number]; w: number };

const ASPHALT = '#3d4148';
const KERB = ['#d8402f', '#f4f1ea'];
const GOLD = '#e9b23a';

/** Draws the track; returns its centre-line pieces for the map. */
export function buildSpeedway(b: Builders): Seg[] {
  const s = b.solid;
  const W = TRACK.width;
  const L = TRACK.halfLen;
  const segs: Seg[] = [];

  // Straights
  for (const z of [TRACK.southZ, TRACK.northZ]) {
    s.box(0, 0.045, z, L * 2, 0.09, W, ASPHALT, { ao: false, tex: 'asphalt' });
    // Kerbs both sides and a dashed centre line
    for (let x = -L; x < L; x += 2) {
      for (const side of [-1, 1]) s.box(x + 1, 0.1, z + side * (W / 2 + 0.35), 2, 0.12, 0.7, KERB[Math.floor((x + L) / 2) % 2], { ao: false });
      if (Math.floor((x + L) / 2) % 3 === 0) s.box(x + 1, 0.095, z, 2.4, 0.01, 0.18, '#e8e2cf', { ao: false });
    }
    segs.push({ a: [-L, z], b: [L, z], w: W });
  }

  // Turns: short overlapping slabs round each half circle, kerbs on both edges, tyre wall outside
  for (const side of [-1, 1]) {
    const cx = side * L;
    const N = 18;
    let prev: [number, number] = [cx, TRACK.southZ];
    for (let i = 0; i <= N; i++) {
      // From the south straight round the outside to the north straight
      const a = -Math.PI / 2 + (i / N) * Math.PI;
      const ux = Math.cos(a) * side;
      const uz = -Math.sin(a);
      const x = cx + ux * TURN_R;
      const z = TURN_Z + uz * TURN_R;
      if (i > 0) {
        const mx = (prev[0] + x) / 2;
        const mz = (prev[1] + z) / 2;
        const len = Math.hypot(x - prev[0], z - prev[1]);
        const rot = Math.atan2(x - prev[0], z - prev[1]);
        s.box(mx, 0.045, mz, W, 0.09, len + 0.6, ASPHALT, { ao: false, tex: 'asphalt', rotY: rot });
        for (const e of [-1, 1]) {
          const r = TURN_R + e * (W / 2 + 0.35);
          const ka = -Math.PI / 2 + ((i - 0.5) / N) * Math.PI;
          s.box(cx + Math.cos(ka) * side * r, 0.1, TURN_Z - Math.sin(ka) * r, 0.7, 0.12, len * (r / TURN_R), KERB[i % 2], { ao: false, rotY: rot });
        }
        segs.push({ a: prev, b: [x, z], w: W });
      }
      // Tyre stacks round the outside of the turn
      if (i % 2 === 0) {
        const r = TURN_R + W / 2 + 2.2;
        const tx = cx + ux * r;
        const tz = TURN_Z + uz * r;
        for (let k = 0; k < 3; k++) s.geom(cylinder(0.42, 0.42, 0.3, 10), new THREE.Matrix4().makeTranslation(tx, 0.15 + k * 0.3, tz), k === 1 ? '#c9452f' : '#1f2226');
        b.colliders.push({ cx: tx, cz: tz, w: 0.9, d: 0.9, minY: 0, maxY: 1, rotY: 0 });
      }
      prev = [x, z];
    }
  }

  // Chequered start line under a gantry with the speedway's name both ways
  const sz = TRACK.southZ;
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < Math.round(W / 0.75); j++)
      s.box(-0.375 + i * 0.75, 0.095, sz - W / 2 + 0.375 + j * 0.75, 0.75, 0.012, 0.75, (i + j) % 2 ? '#f4f1ea' : '#1f2226', { ao: false });
  for (const e of [-1, 1]) {
    s.box(0, 3.2, sz + e * (W / 2 + 1.2), 0.5, 6.4, 0.5, '#d9dde3', { tex: 'metal' });
    b.colliders.push({ cx: 0, cz: sz + e * (W / 2 + 1.2), w: 0.6, d: 0.6, minY: 0, maxY: 7, rotY: 0 });
  }
  s.box(0, 6.6, sz, 0.6, 1.4, W + 3, '#1f2a44', { tex: 'metal' });
  for (const rot of [-Math.PI / 2, Math.PI / 2]) b.signs.push({ text: 'FIN CITY SPEEDWAY', x: rot < 0 ? -0.32 : 0.32, y: 6.6, z: sz, rotY: rot, w: W + 2, h: 1.1, bg: '#1f2a44', fg: '#ffcf3f' });
  for (let k = -3; k <= 3; k++) b.lamps.push([0, 7.4, sz + k * 1.6]);

  // Gold checkpoint arches over the track
  for (const cp of CHECKPOINTS.slice(1)) {
    const across = Math.abs(cp.z - TRACK.northZ) < 1 ? 'z' : 'x';
    for (const e of [-1, 1]) {
      const px = across === 'x' ? cp.x + e * (W / 2 + 1) : cp.x;
      const pz = across === 'z' ? cp.z + e * (W / 2 + 1) : cp.z;
      s.box(px, 2.6, pz, 0.4, 5.2, 0.4, GOLD, { tex: 'metal' });
      b.colliders.push({ cx: px, cz: pz, w: 0.5, d: 0.5, minY: 0, maxY: 6, rotY: 0 });
    }
    s.box(cp.x, 5.3, cp.z, across === 'x' ? W + 2.4 : 0.5, 0.5, across === 'z' ? W + 2.4 : 0.5, GOLD, { tex: 'metal' });
    b.lamps.push([cp.x, 5.0, cp.z]);
  }

  // Grandstand behind the north straight, with rows of coloured seats
  const gz = TRACK.northZ - W / 2 - 6;
  for (let row = 0; row < 5; row++) {
    s.box(0, 0.4 + row * 0.6, gz - row * 1.1, 60, 0.8 + row * 1.2, 1.1, '#9a958a', { tex: 'concrete' });
    for (let x = -29; x <= 29; x += 1.2) s.box(x, 0.95 + row * 1.2, gz - row * 1.1 + 0.2, 0.7, 0.35, 0.5, ['#2f6bdb', '#e5533d', '#ffcf3f', '#3cc45a'][(row + Math.round(x)) % 4], { ao: false });
  }
  s.box(0, 6.8, gz - 5, 62, 0.3, 7, '#1f2a44', { tex: 'metal' });
  for (const x of [-30, 0, 30]) s.box(x, 4.2, gz - 7.5, 0.4, 5.6, 0.4, '#d9dde3', { tex: 'metal' });

  // Sign by the park road pointing the way in
  b.signs.push({ text: 'SPEEDWAY', sub: 'Time trial: drive the gold arches', x: 7, y: 2.4, z: -104, rotY: 0, w: 5, h: 1.6, bg: '#1f2a44', fg: '#ffcf3f' });
  s.box(7, 1.2, -104.1, 0.25, 2.4, 0.25, '#2a2a2a');
  b.colliders.push({ cx: 7, cz: -104.1, w: 0.4, d: 0.4, minY: 0, maxY: 3, rotY: 0 });

  return segs;
}
