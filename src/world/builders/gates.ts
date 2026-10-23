/**
 * Arrival gates. Where you step out of the portal there's a paved arrival plaza and a grand gate
 * into the place, built in local style: a Portland-stone triumphal arch in London, an art-deco
 * gateway in New York, a red-and-green paifang in Hong Kong, a deco pylon gate in San Francisco,
 * a garden canopy in Singapore and wrought-iron park gates at home.
 *
 * Local frame: the gate stands across the way into the city; +Z faces the arrival plaza (the side
 * you see as you arrive), -Z faces the city.
 */
import * as THREE from 'three';
import type { CityDef } from '@/game/content';
import { cylinder, sphere } from '@/engine/voxel';
import { Frame, type Builders } from './buildings';

/** Where the gate stands and how big the plaza is, relative to the spawn point. */
export function arrivalLayout(def: CityDef) {
  const [sx, sz] = def.spawn;
  const city = def.id !== 'park';
  return {
    gate: { x: sx, z: city ? sz - 6.5 : sz - 9 },
    plaza: city ? { minX: sx - 13, maxX: sx + 13, minZ: sz - 8, maxZ: sz + 20 } : null,
  };
}

const PLAZA: Record<string, { color: string; tex: string; border: string }> = {
  'new-york': { color: '#b9b3a8', tex: 'stone', border: '#6e747a' },
  london: { color: '#d8cfba', tex: 'pave-york', border: '#8a8476' },
  'hong-kong': { color: '#c9c1b2', tex: 'stone', border: '#9a2420' },
  'san-francisco': { color: '#e2dccd', tex: 'pave-sf', border: '#c0362c' },
  singapore: { color: '#ece8de', tex: 'marble', border: '#3f7a3a' },
};

export function buildArrival(def: CityDef, b: Builders) {
  const L = arrivalLayout(def);
  const f = new Frame(L.gate.x, L.gate.z, 0, b);
  if (L.plaza) {
    const p = L.plaza;
    const st = PLAZA[def.id] ?? PLAZA['new-york'];
    const cx = (p.minX + p.maxX) / 2;
    const cz = (p.minZ + p.maxZ) / 2;
    b.solid.box(cx, 0.17, cz, p.maxX - p.minX, 0.03, p.maxZ - p.minZ, st.color, { ao: false, tex: st.tex });
    // Border band and a compass rose inlaid in the paving
    for (const [x, z, w, d] of [[cx, p.minZ + 0.3, p.maxX - p.minX, 0.6], [cx, p.maxZ - 0.3, p.maxX - p.minX, 0.6], [p.minX + 0.3, cz, 0.6, p.maxZ - p.minZ], [p.maxX - 0.3, cz, 0.6, p.maxZ - p.minZ]] as const)
      b.solid.box(x, 0.19, z, w, 0.02, d, st.border, { ao: false, tex: 'stone' });
    const rz = def.spawn[1] + 1;
    b.solid.geom(new THREE.CylinderGeometry(3, 3, 0.02, 32), new THREE.Matrix4().makeTranslation(cx, 0.19, rz), '#d9d2c2', 'marble');
    for (let k = 0; k < 4; k++) {
      const m = new THREE.Matrix4().compose(new THREE.Vector3(cx, 0.2, rz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (k * Math.PI) / 4, 0)), new THREE.Vector3(1, 1, 1));
      b.solid.geom(new THREE.BoxGeometry(0.35, 0.02, 5.6), m, k % 2 ? '#8a8476' : st.border);
    }
    // Planters and benches down both sides, lamps at the gate end
    for (const sx of [-1, 1]) {
      for (let z = p.minZ + 5; z < p.maxZ - 3; z += 7) {
        b.solid.box(cx + sx * 10.5, 0.45, z, 2.2, 0.6, 2.2, '#9a958a', { tex: 'concrete' });
        b.solid.geom(sphere(1.0, 8, 6), new THREE.Matrix4().makeTranslation(cx + sx * 10.5, 1.3, z), '#3f6e34', 'leaves');
        b.colliders.push({ cx: cx + sx * 10.5, cz: z, w: 2.3, d: 2.3, minY: 0, maxY: 1, rotY: 0 });
      }
    }
  }
  switch (def.id) {
    case 'london':
      return londonArch(f, b, def.name);
    case 'new-york':
      return decoGate(f, b, def.name);
    case 'hong-kong':
      return paifang(f, b, def.name);
    case 'san-francisco':
      return sfGate(f, b, def.name);
    case 'singapore':
      return gardenGate(f, b, def.name);
    default:
      return parkGates(f, b);
  }
}

function names(b: Builders, f: Frame, y: number, w: number, h: number, inner: string, outer: string, kind: 'carved' | 'letters', depthZ = 0.75) {
  for (const [z, rot, text] of [[depthZ, 0, inner], [-depthZ, Math.PI, outer]] as const) {
    const [x, wz] = f.world(0, z);
    b.signs.push({ text, x, y, z: wz, rotY: f.rot + rot, w, h, bg: '#1f2a3a', fg: '#ffffff', kind });
  }
}

function pier(f: Frame, b: Builders, x: number, w: number, h: number, d: number, color: string, tex = 'stone') {
  f.tb(x, 0, 0, w, h, d, color, tex, tex);
  f.collider(x, 0, w, d, 0, h);
  void b;
}

/* London: Portland-stone triumphal arch with side passages and an inscribed attic */
function londonArch(f: Frame, b: Builders, name: string) {
  const stone = '#e8e2d2';
  for (const sx of [-1, 1]) {
    pier(f, b, sx * 5.4, 3.0, 10, 3.0, stone);
    // Paired columns on the faces
    for (const z of [1.65, -1.65]) for (const cx of [-0.8, 0.8]) f.geom(cylinder(0.32, 0.36, 8, 12), sx * 5.4 + cx, 4.6, z, '#f2ede0', 0, 0, 0, 1, 'solid', 'marble');
    // Side passage arch heads
    f.tb(sx * 8.3, 0, 0, 2.8, 7.2, 2.4, stone, 'stone', 'stone');
    f.collider(sx * 8.3, 0, 2.8, 2.4, 0, 7.2);
  }
  f.tb(0, 8.2, 0, 13.8, 1.8, 3.2, stone, 'stone', 'stone');
  f.tb(0, 10, 0, 12.4, 2.6, 2.8, '#ded7c4', 'stone', 'stone');
  f.tb(0, 12.6, 0, 6, 0.8, 2.2, '#ded7c4', 'stone', 'stone');
  // Bronze quadriga silhouette on top
  f.block(0, 13.4, 0, 3.2, 1.6, 1.2, '#4a5a4a');
  f.geom(sphere(0.5, 8, 6), 0, 15.4, 0, '#4a5a4a');
  names(b, f, 11.3, 9.5, 1.3, `Welcome to ${name}`, name, 'carved', 1.75);
  for (const sx of [-1, 1]) f.flag(sx * 5.4, 15, 0, 2.2, 1.3, '#1f2c4a', '#c4202f');
  for (const sx of [-1, 1]) f.block(sx * 5.4, 10, 0, 0.12, 5, 0.12, '#c0c4cc');
}

/* New York: stepped art-deco pylons with a gilded sunburst and lettered lintel */
function decoGate(f: Frame, b: Builders, name: string) {
  const stone = '#cfc6b4';
  for (const sx of [-1, 1]) {
    pier(f, b, sx * 5.5, 3.2, 9, 3.2, stone);
    f.tb(sx * 5.5, 9, 0, 2.6, 2.4, 2.6, stone, 'stone', 'stone');
    f.tb(sx * 5.5, 11.4, 0, 1.8, 1.8, 1.8, stone, 'stone', 'stone');
    f.geom(cylinder(0.12, 0.4, 2.2, 8), sx * 5.5, 14.3, 0, '#d9b04a', 0, 0, 0, 1, 'solid', 'metal');
    // Fluted bronze strips
    for (const cx of [-0.9, 0, 0.9]) f.block(sx * 5.5 + cx, 0.5, 1.62, 0.18, 8, 0.06, '#8a6a3a');
    for (const z of [1.65, -1.65]) f.block(sx * 5.5, 2.5, z, 2.2, 0.06, 0.06, '#d9b04a');
  }
  f.tb(0, 7.6, 0, 14.2, 2.0, 2.4, '#2a2d33', 'metal', 'metal');
  // Sunburst over the lintel
  for (let k = 0; k < 9; k++) {
    const a = Math.PI * (k / 8);
    f.geom(new THREE.BoxGeometry(0.22, 2.6, 0.12), Math.cos(a) * 1.6, 9.6 + Math.sin(a) * 1.3, 0, '#e6c35a', 0, 0, a - Math.PI / 2, 1, 'solid', 'metal');
  }
  f.geom(cylinder(1.0, 1.0, 0.3, 16), 0, 9.6, 0, '#e6c35a', Math.PI / 2, 0, 0, 1, 'solid', 'metal');
  names(b, f, 8.6, 10, 1.4, `Welcome to ${name}`, name, 'letters', 1.75);
  for (const sx of [-1, 1]) f.lamp(sx * 5.5, 14.8, 0);
}

/* Hong Kong: red-columned paifang with tiled roofs and upturned eaves */
function paifang(f: Frame, b: Builders, name: string) {
  const red = '#a3201c';
  const tile = '#2f6b4a';
  for (const x of [-6.2, -3.4, 3.4, 6.2]) {
    f.geom(cylinder(0.45, 0.5, 8.5, 12), x, 4.25, 0, red);
    f.tb(x, 0, 0, 1.4, 0.8, 1.4, '#cfc8b8', 'stone', 'stone');
    f.collider(x, 0, 1.2, 1.2, 0, 8.5);
  }
  const roof = (cx: number, y: number, w: number) => {
    f.block(cx, y, 0, w, 0.7, 1.6, '#d9b04a');
    f.block(cx, y + 0.7, 0, w + 1.4, 0.3, 2.8, tile);
    f.block(cx, y + 1.0, 0, w + 0.4, 0.5, 2.2, tile);
    f.block(cx, y + 1.5, 0, w - 1.2, 0.3, 1.2, tile);
    for (const sx of [-1, 1]) f.geom(new THREE.BoxGeometry(1.2, 0.25, 0.4), cx + sx * (w / 2 + 0.9), y + 1.15, 0, tile, 0, 0, sx * 0.5);
    f.block(cx, y + 1.8, 0, 0.6, 0.5, 0.6, '#d9b04a');
  };
  f.block(0, 6.8, 0, 13.6, 1.0, 1.0, red);
  roof(0, 8.5, 6.6);
  for (const sx of [-1, 1]) roof(sx * 4.8, 7.0, 3.4);
  names(b, f, 7.5, 5.2, 1.2, `Welcome to ${name}`, name, 'carved', 0.55);
  // Hanging lanterns
  for (const x of [-4.8, 4.8]) {
    f.block(x, 5.6, 0.9, 0.04, 1.2, 0.04, '#3a2a1a');
    f.geom(sphere(0.5, 10, 8), x, 5.2, 0.9, '#d4202a', 0, 0, 0, 1, 'neon');
  }
}

/* San Francisco: white deco pylons with an orange steel lintel and cable motif */
function sfGate(f: Frame, b: Builders, name: string) {
  for (const sx of [-1, 1]) {
    pier(f, b, sx * 5.6, 2.8, 11, 2.8, '#f0ece2', 'concrete');
    for (let y = 2; y < 10.5; y += 1.4) f.block(sx * 5.6, y, 1.42, 2.2, 0.12, 0.06, '#c9c2b2');
    f.tb(sx * 5.6, 11, 0, 2.2, 1.2, 2.2, '#c0362c', 'metal', 'metal');
  }
  f.tb(0, 8.4, 0, 14, 1.4, 1.8, '#c0362c', 'metal', 'metal');
  // Cable swoops between the pylon tops
  for (let k = 0; k <= 16; k++) {
    const t = k / 16;
    const x = -5.6 + t * 11.2;
    const y = 12.0 - Math.sin(t * Math.PI) * 2.6;
    f.block(x, y, 0, 0.75, 0.16, 0.16, '#c0362c');
    if (k % 2 === 0 && k > 0 && k < 16) f.block(x, 9.8, 0, 0.06, y - 9.8, 0.06, '#8f2a22');
  }
  names(b, f, 9.1, 9.6, 1.1, `Welcome to ${name}`, name, 'letters', 1.55);
}

/* Singapore: two sculpted white pillars under a curved, planted canopy */
function gardenGate(f: Frame, b: Builders, name: string) {
  for (const sx of [-1, 1]) {
    f.geom(cylinder(0.9, 1.3, 8, 16), sx * 5.4, 4, 0, '#f2f2ee', 0, 0, 0, 1, 'solid', 'concrete');
    f.collider(sx * 5.4, 0, 2.4, 2.4, 0, 8);
    for (let y = 1; y < 7.5; y += 1.2) f.geom(cylinder(1.35 - y * 0.05, 1.35 - y * 0.05, 0.25, 16), sx * 5.4, y, 0, '#6fb04f', 0, 0, 0, 1, 'solid', 'leaves');
  }
  for (let k = 0; k <= 20; k++) {
    const t = k / 20;
    const x = -8 + t * 16;
    const y = 8.4 + Math.sin(t * Math.PI) * 1.6;
    f.geom(new THREE.BoxGeometry(0.85, 0.35, 4.2), x, y, 0, '#f6f6f2', 0, 0, Math.cos(t * Math.PI) * 0.35);
    f.geom(new THREE.BoxGeometry(0.8, 0.25, 3.6), x, y + 0.3, 0, '#3f7a3a', 0, 0, Math.cos(t * Math.PI) * 0.35, 1, 'solid', 'leaves');
  }
  names(b, f, 7.2, 7.8, 1.1, `Welcome to ${name}`, name, 'letters', 0.4);
}

/* Fin City Park: brick piers, coin finials and a wrought-iron arch over open gates */
function parkGates(f: Frame, b: Builders) {
  const brick = '#9a5a44';
  const iron = '#22262a';
  for (const sx of [-1, 1]) {
    pier(f, b, sx * 4.4, 1.8, 5.2, 1.8, brick, 'brick');
    f.tb(sx * 4.4, 5.2, 0, 2.2, 0.4, 2.2, '#e2d8c4', 'stone', 'stone');
    f.geom(cylinder(0.75, 0.75, 0.25, 20), sx * 4.4, 6.4, 0, '#e0b02a', Math.PI / 2, 0, 0, 1, 'solid', 'metal');
    f.block(sx * 4.4, 5.6, 0, 0.3, 0.3, 0.3, '#e2d8c4');
    // Low railings running off either side
    for (let x = 5.6; x < 13; x += 0.35) f.block(sx * x, 0, 0, 0.05, 1.4, 0.05, iron);
    f.block(sx * 9.3, 1.3, 0, 7.4, 0.08, 0.08, iron);
    f.block(sx * 9.3, 0.3, 0, 7.4, 0.08, 0.08, iron);
    f.collider(sx * 9.3, 0, 7.4, 0.3, 0, 1.4);
    // Gate leaves swung open against the piers
    for (let k = 0; k < 8; k++) f.block(sx * 3.4, 0.1, 0.4 + k * 0.32, 0.05, 3.2, 0.05, iron);
    f.block(sx * 3.4, 3.2, 1.5, 0.08, 0.08, 2.6, iron);
    f.block(sx * 3.4, 0.3, 1.5, 0.08, 0.08, 2.6, iron);
  }
  // Wrought-iron arch with scrollwork
  for (let k = 0; k <= 18; k++) {
    const a = Math.PI * (k / 18);
    f.block(Math.cos(a) * 4.4, 5.2 + Math.sin(a) * 2.2, 0, 0.4, 0.12, 0.12, iron);
    if (k % 3 === 0 && k > 0 && k < 18) f.geom(new THREE.TorusGeometry(0.3, 0.04, 4, 12), Math.cos(a) * 3.6, 5.6 + Math.sin(a) * 1.6, 0, iron);
  }
  names(b, f, 6.2, 4.6, 0.8, 'Fin City Park', 'Fin City Park', 'letters', 0.12);
}
