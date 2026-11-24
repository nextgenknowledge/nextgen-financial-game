/**
 * The airfield past each city's west edge (layout in src/game/airport.ts): runway with markings and
 * edge lights, a taxiway, an apron, a glass terminal with the city's name, a control tower, a
 * hangar, a windsock, a road in through the boundary wall and a fence round the grounds.
 */
import * as THREE from 'three';
import type { CityDef } from '@/game/content';
import type { Builders } from './buildings';
import { cylinder } from '@/engine/voxel';
import { AIRPORT } from '@/game/airport';

type Seg = { a: [number, number]; b: [number, number]; w: number };

const CONCRETE = '#9a9fa6';
const ASPHALT = '#3d4148';
const WHITE = '#ecebe4';
const YELLOW = '#e6bd3a';

/**
 * Draws the airfield. `edgeX` is where the city's boundary wall (or the park's edge) stands; the
 * fence closes the gap between it and the airfield. Returns road pieces for the map.
 */
export function buildAirport(def: CityDef, b: Builders, edgeX: number): Seg[] {
  const s = b.solid;
  const Z = AIRPORT.zone;
  const R = AIRPORT.runway;
  const isPark = def.id === 'park';
  const segs: Seg[] = [];

  // Ground: apron concrete over the whole field, the runway on top
  const cx = (Z.minX + Z.maxX) / 2;
  const cz = (Z.minZ + Z.maxZ) / 2;
  s.box(cx, 0.03, cz, Z.maxX - Z.minX, 0.06, Z.maxZ - Z.minZ, CONCRETE, { ao: false, tex: 'concrete' });
  const rx = (R.x0 + R.x1) / 2;
  const rl = R.x1 - R.x0;
  s.box(rx, 0.075, R.z, rl, 0.03, R.w, ASPHALT, { ao: false, tex: 'asphalt' });
  for (let x = R.x0 + 14; x < R.x1 - 14; x += 9) s.box(x, 0.095, R.z, 5, 0.01, 0.35, WHITE, { ao: false });
  for (const e of [-1, 1]) s.box(rx, 0.095, R.z + e * (R.w / 2 - 0.5), rl - 2, 0.01, 0.3, WHITE, { ao: false });
  // Threshold "piano keys" at both ends
  for (const [x0, dir] of [[R.x0 + 2, 1], [R.x1 - 2, -1]] as const)
    for (let k = -3; k <= 3; k++) s.box(x0 + dir * 3, 0.095, R.z + k * 2.1, 6, 0.01, 1.1, WHITE, { ao: false });
  // Edge lights
  for (let x = R.x0; x <= R.x1; x += 10)
    for (const e of [-1, 1]) {
      s.box(x, 0.18, R.z + e * (R.w / 2 + 0.6), 0.25, 0.3, 0.25, '#f2f2e8');
      b.lamps.push([x, 0.4, R.z + e * (R.w / 2 + 0.6)]);
    }
  segs.push({ a: [R.x0, R.z], b: [R.x1, R.z], w: R.w });

  // Taxiway from the apron to the runway, with a yellow centre line
  const tx = -170;
  s.box(tx, 0.07, (R.z + 8) / 2 + 4, 12, 0.03, 28, ASPHALT, { ao: false, tex: 'asphalt' });
  s.box(tx, 0.09, (R.z + 8) / 2 + 4, 0.3, 0.01, 28, YELLOW, { ao: false });
  for (let x = Z.minX + 8; x < Z.maxX - 8; x += 1) if (x % 2 === 0) s.box(x, 0.065, 14, 1, 0.01, 0.25, YELLOW, { ao: false });

  // Road in from the city through the gap in the wall, with an arch over it
  const roadFrom = isPark ? -116 : edgeX + 4;
  const rlen = roadFrom - Z.maxX + 6;
  s.box((roadFrom + Z.maxX - 6) / 2, 0.05, AIRPORT.gate.z, rlen, 0.06, 9, ASPHALT, { ao: false, tex: 'asphalt' });
  for (let x = Z.maxX - 4; x < roadFrom; x += 4) s.box(x, 0.085, AIRPORT.gate.z, 2.2, 0.01, 0.2, YELLOW, { ao: false });
  segs.push({ a: [Z.maxX - 6, AIRPORT.gate.z], b: [roadFrom, AIRPORT.gate.z], w: 9 });
  const ax = Z.maxX + 1;
  for (const e of [-1, 1]) {
    s.box(ax, 2.6, AIRPORT.gate.z + e * 6, 0.6, 5.2, 0.6, '#2f6bdb', { tex: 'metal' });
    b.colliders.push({ cx: ax, cz: AIRPORT.gate.z + e * 6, w: 0.7, d: 0.7, minY: 0, maxY: 6, rotY: 0 });
  }
  s.box(ax, 5.4, AIRPORT.gate.z, 0.7, 1.1, 13, '#1f2a44', { tex: 'metal' });
  for (const rot of [-Math.PI / 2, Math.PI / 2]) b.signs.push({ text: 'AIRPORT', sub: 'Fly to another city', x: ax + (rot < 0 ? -0.37 : 0.37), y: 5.4, z: AIRPORT.gate.z, rotY: rot, w: 9, h: 1.0, bg: '#1f2a44', fg: '#ffcf3f' });

  // Terminal: glass hall with a deep roof and the airfield's name
  const T = { x: -195, z: 38, w: 54, d: 12, h: 9 };
  s.box(T.x, T.h / 2, T.z, T.w, T.h, T.d, '#cfd8e2', { tex: 'fac-glass', topTex: 'roof-gravel' });
  s.box(T.x, T.h + 0.4, T.z, T.w + 3, 0.8, T.d + 4, '#3a3f4a', { tex: 'metal' });
  for (let x = T.x - T.w / 2 + 4; x < T.x + T.w / 2; x += 8) s.box(x, T.h / 2, T.z - T.d / 2 - 2, 0.5, T.h, 0.5, '#d9dde3', { tex: 'metal' });
  b.colliders.push({ cx: T.x, cz: T.z, w: T.w, d: T.d, minY: 0, maxY: T.h + 1, rotY: 0 });
  b.signs.push({ text: `${def.name.toUpperCase()} AIRFIELD`, x: T.x, y: T.h - 1.2, z: T.z - T.d / 2 - 0.08, rotY: Math.PI, w: 22, h: 1.6, bg: '#1f2a44', fg: '#ffffff' });
  // Jet-bridge style walkway and a couple of luggage carts on the apron
  s.box(-180, 3, 26, 3, 2.6, 12, '#d9dde3', { tex: 'metal' });
  b.colliders.push({ cx: -180, cz: 26, w: 3, d: 12, minY: 2, maxY: 5, rotY: 0 });
  for (const [x, z] of [[-205, 24], [-209, 25]] as const) {
    s.box(x, 0.5, z, 2.2, 0.5, 1.3, '#e6bd3a');
    for (let k = 0; k < 3; k++) s.box(x - 0.6 + k * 0.6, 1.05, z, 0.5, 0.6, 0.9, ['#2f6bdb', '#e5533d', '#3cc45a'][k]);
    b.colliders.push({ cx: x, cz: z, w: 2.3, d: 1.4, minY: 0, maxY: 1.4, rotY: 0 });
  }

  // Control tower
  const tw = { x: -150, z: 34 };
  s.geom(cylinder(2, 2.4, 18, 14), new THREE.Matrix4().makeTranslation(tw.x, 9, tw.z), '#d9dde3', 'concrete');
  s.geom(cylinder(3.6, 3, 3, 12), new THREE.Matrix4().makeTranslation(tw.x, 19.5, tw.z), '#7fb3d9', 'fac-glass');
  s.geom(cylinder(4, 4, 0.5, 12), new THREE.Matrix4().makeTranslation(tw.x, 21.2, tw.z), '#3a3f4a', 'metal');
  s.box(tw.x, 23, tw.z, 0.2, 3, 0.2, '#e5533d');
  b.lamps.push([tw.x, 24.6, tw.z]);
  b.colliders.push({ cx: tw.x, cz: tw.z, w: 4.6, d: 4.6, minY: 0, maxY: 22, rotY: 0 });

  // Hangar with a curved roof and open doors
  const H = { x: -243, z: 34, w: 22, d: 16 };
  for (let k = 0; k < 10; k++) {
    const a = (k / 9) * Math.PI;
    const y = Math.sin(a) * 7;
    const xx = H.x + Math.cos(a) * (H.w / 2);
    s.box(xx, y + 0.3, H.z, H.w / 9 + 0.6, 0.6, H.d, '#b9bec9', { tex: 'metal', rotY: 0 });
  }
  for (const e of [-1, 1]) s.box(H.x + e * (H.w / 2 - 0.3), 2.5, H.z, 0.6, 5, H.d, '#9aa0a8', { tex: 'metal' });
  s.box(H.x, 3.5, H.z + H.d / 2 - 0.2, H.w, 7, 0.3, '#6e747a', { tex: 'metal' });
  b.colliders.push({ cx: H.x, cz: H.z, w: H.w, d: H.d, minY: 0, maxY: 8, rotY: 0 });

  // Windsock
  s.box(-140, 3.5, -40, 0.18, 7, 0.18, '#d9dde3');
  s.geom(new THREE.CylinderGeometry(0.45, 0.2, 2.6, 8), new THREE.Matrix4().compose(new THREE.Vector3(-141.4, 6.6, -40), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2 + 0.25)), new THREE.Vector3(1, 1, 1)), '#f08a3a');
  b.colliders.push({ cx: -140, cz: -40, w: 0.4, d: 0.4, minY: 0, maxY: 7, rotY: 0 });

  // Fence round the grounds (and, in the park, along its open west side)
  const fence = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const mx = (x0 + x1) / 2;
    const mz = (z0 + z1) / 2;
    for (let t = 0; t <= len; t += 4) s.box(x0 + ((x1 - x0) * t) / len, 1.1, z0 + ((z1 - z0) * t) / len, 0.14, 2.2, 0.14, '#5a606b');
    s.box(mx, 2.15, mz, alongX ? len : 0.08, 0.08, alongX ? 0.08 : len, '#5a606b');
    s.box(mx, 1.1, mz, alongX ? len : 0.03, 2, alongX ? 0.03 : len, '#8d939c', { ao: false });
    b.colliders.push({ cx: mx, cz: mz, w: alongX ? len : 0.4, d: alongX ? 0.4 : len, minY: 0, maxY: 2.3, rotY: 0 });
  };
  fence(edgeX, Z.minZ, Z.minX, Z.minZ);
  fence(edgeX, Z.maxZ, Z.minX, Z.maxZ);
  fence(Z.minX, Z.minZ, Z.minX, Z.maxZ);
  if (isPark) {
    const H2 = def.half + 20;
    fence(edgeX, -H2, edgeX, Z.minZ);
    fence(edgeX, Z.maxZ, edgeX, H2);
  }
  return segs;
}
