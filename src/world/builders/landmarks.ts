/**
 * Landmarks: recognizable-but-original stylized monuments for each city, plus park furniture.
 * Static ones are merged into the scene geometry; animated or state-dependent ones are listed in
 * DYNAMIC_LANDMARKS and rendered by components in src/world/Landmarks.tsx.
 */
import * as THREE from 'three';
import { cylinder, sphere } from '@/engine/voxel';
import type { LandmarkDef } from '@/game/content';
import type { Rng } from '@/game/rng';
import { Frame, shade, type Builders } from './buildings';

export const DYNAMIC_LANDMARKS = new Set([
  'fountain',
  'narwhal-statue',
  'ferris-wheel',
  'big-wheel',
  'bandstand',
  'playground',
  'garden',
  'supertrees',
  'cable-car',
  'hall-of-fame-board',
  'job-board',
  'neighborhood',
  'lionfish-fountain',
  'savings-garden-trees',
]);

/** Community projects only appear once funded at Town Hall. */
export const PROJECT_LANDMARKS: Record<string, string> = {
  bandstand: 'bandstand',
  playground: 'playground',
  garden: 'garden',
  'ferris-wheel': 'ferris-wheel',
};

export function buildLandmark(b: Builders, lm: LandmarkDef, rng: Rng) {
  const rot = ((lm.rot ?? 0) * Math.PI) / 180;
  const s = lm.scale ?? 1;
  const f = new Frame(lm.pos[0], lm.pos[1], rot, b);
  switch (lm.type) {
    case 'bench': {
      f.block(0, 0.45, 0, 2.2, 0.15, 0.7, '#a8774a');
      f.block(0, 0.6, -0.3, 2.2, 0.6, 0.12, '#a8774a');
      f.block(-0.9, 0, 0, 0.15, 0.45, 0.6, '#3a3f4a');
      f.block(0.9, 0, 0, 0.15, 0.45, 0.6, '#3a3f4a');
      f.collider(0, 0, 2.2, 0.7, 0, 0.6);
      break;
    }
    case 'food-cart': {
      f.block(0, 0.5, 0, 2.6, 1.2, 1.4, '#ffffff');
      f.block(0, 0.6, 0.71, 2.4, 0.9, 0.05, '#e1553f');
      f.geom(cylinder(0.35, 0.35, 0.15, 10), -0.9, 0.35, 0.72, '#2a2f3d', Math.PI / 2);
      f.geom(cylinder(0.35, 0.35, 0.15, 10), 0.9, 0.35, 0.72, '#2a2f3d', Math.PI / 2);
      f.block(0, 1.7, 0, 0.1, 1.5, 0.1, '#c0c4cc');
      f.geom(new THREE.ConeGeometry(1.8, 0.8, 8), 0, 3.4, 0, '#ffcf3f');
      f.collider(0, 0, 2.6, 1.4, 0, 2);
      break;
    }
    case 'flowerbeds': {
      const cols = ['#f06aa8', '#ffcf3f', '#e1553f', '#8a5cf6', '#ffffff'];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const x = Math.cos(a) * 15.5;
        const z = Math.sin(a) * 15.5;
        b.solid.box(lm.pos[0] + x, 0.25, lm.pos[1] + z, 3.2, 0.5, 1.6, '#8a6a4a', { rotY: -a + Math.PI / 2 });
        // Colliders are axis-aligned, so a slightly smaller square stands in for the angled bed
        b.colliders.push({ cx: lm.pos[0] + x, cz: lm.pos[1] + z, w: 2.2, d: 2.2, minY: 0, maxY: 0.85, rotY: 0 });
        for (let k = 0; k < 6; k++) {
          const t = (k - 2.5) * 0.5;
          b.solid.box(lm.pos[0] + x + Math.cos(a + Math.PI / 2) * t, 0.65, lm.pos[1] + z + Math.sin(a + Math.PI / 2) * t, 0.35, 0.35, 0.35, cols[(i + k) % cols.length]);
        }
      }
      break;
    }
    case 'dock': {
      f.block(0, 0, 4, 5, 0.4, 14, '#a8774a');
      for (let z = -2; z <= 10; z += 3) {
        f.block(-2.6, -1, z, 0.4, 1.8, 0.4, '#6b4a2a');
        f.block(2.6, -1, z, 0.4, 1.8, 0.4, '#6b4a2a');
      }
      f.collider(0, 4, 5, 14, -1, 0.4);
      break;
    }
    case 'liberty-torch': {
      // Original stylized torch statue on a granite plinth (harbor island)
      const patina = '#6fae96';
      f.tb(0, 0, 0, 16, 1.2, 16, '#8b8676', 'stone', 'stone');
      f.tb(0, 1.2, 0, 9, 2.0, 9, '#b9ad94', 'stone', 'stone');
      f.tb(0, 3.2, 0, 7, 5.5, 7, '#c9bda3', 'fac-stone', 'stone');
      f.tb(0, 8.7, 0, 8, 0.8, 8, '#b5a888', 'stone', 'stone');
      // Robed figure: tapering stacked drums
      for (let k = 0; k < 6; k++) f.geom(cylinder(1.9 - k * 0.18, 2.05 - k * 0.18, 1.5, 12), 0, 10.2 + k * 1.45, 0, patina, 0, 0, 0, 1, 'solid', 'metal');
      f.geom(sphere(1.15, 12, 8), 0, 19.5, 0, patina, 0, 0, 0, 1, 'solid', 'metal');
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI - Math.PI / 2;
        f.geom(new THREE.ConeGeometry(0.18, 1.4, 4), Math.sin(a) * 1.0, 20.6, Math.cos(a) * 0.5 + 0.2, patina, -0.5 + Math.cos(a) * 0.4, 0, Math.sin(a) * 0.9);
      }
      // Raised arm with torch, and a tablet held at the hip
      f.geom(cylinder(0.42, 0.5, 6.5, 8), 1.6, 20.5, 0, patina, 0, 0, -0.18, 1, 'solid', 'metal');
      f.geom(cylinder(0.75, 0.45, 1.2, 10), 2.2, 24.2, 0, '#c9a24a');
      f.geom(new THREE.ConeGeometry(0.6, 1.5, 8), 2.2, 25.4, 0, '#ffcf3f', 0, 0, 0, 1, 'neon');
      f.tb(-1.5, 12.5, 1.0, 1.4, 2.0, 0.4, patina, 'metal');
      f.collider(0, 0, 16, 16, 0, 26);
      b.lamps.push([lm.pos[0], 25.5, lm.pos[1]]);
      break;
    }
    case 'deco-spire': {
      // Art-deco skyscraper: stone setbacks, piers, gold-lit crown and needle spire
      const tiers = [
        [16, 42, '#d6c9ae'],
        [12.4, 16, '#ddd1b8'],
        [9, 9, '#e3d9c3'],
        [6, 6, '#e9e1cf'],
      ] as const;
      let y = 0;
      for (const [w, h, c] of tiers) {
        f.tb(0, y, 0, w, h, w, c, 'fac-stone', 'roof-gravel');
        // Vertical piers at the corners and a cornice band
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) f.tb((sx * w) / 2, y, (sz * w) / 2, 0.9, h + 0.6, 0.9, shade(c, 1.06), 'stone', 'stone');
        f.tb(0, y + h - 0.6, 0, w + 0.5, 0.6, w + 0.5, shade(c, 0.9), 'stone', 'stone');
        y += h;
      }
      // Gold crown with sunburst arches
      for (let k = 0; k < 3; k++) f.tb(0, y + k * 1.6, 0, 4.6 - k * 1.3, 1.6, 4.6 - k * 1.3, '#c9a24a', 'metal', 'metal');
      f.block(0, y - 1.2, 0, 6.4, 0.6, 6.4, '#ffd36b', 'lit');
      f.geom(new THREE.ConeGeometry(0.45, 16, 8), 0, y + 12.8, 0, '#c8ccd4', 0, 0, 0, 1, 'solid', 'metal');
      f.block(0, y + 20.6, 0, 0.45, 0.45, 0.45, '#ff5a4a', 'neon');
      f.collider(0, 0, 16, 16, 0, 90);
      break;
    }
    case 'bull-bear': {
      // Bull and bear statues: market up / market down
      f.block(-3, 0, 0, 2.4, 0.8, 4.4, '#8a8f9c');
      f.block(-3, 0.8, 0, 1.6, 1.4, 3.2, '#b07a3c');
      f.block(-3, 1.4, 1.9, 1.3, 1.2, 1.0, '#b07a3c');
      f.block(-3.6, 2.4, 2.1, 0.25, 0.25, 0.9, '#f4e6c8');
      f.block(-2.4, 2.4, 2.1, 0.25, 0.25, 0.9, '#f4e6c8');
      for (const [x, z] of [[-3.5, 1.2], [-2.5, 1.2], [-3.5, -1.2], [-2.5, -1.2]]) f.block(x, 0.8, z, 0.4, 0.5, 0.4, '#8a5a2c');
      f.block(3, 0, 0, 2.4, 0.8, 4.4, '#8a8f9c');
      f.block(3, 0.8, 0, 1.8, 1.6, 3.0, '#6b4a2a');
      f.block(3, 1.6, 1.8, 1.4, 1.3, 1.2, '#6b4a2a');
      f.block(2.5, 2.9, 1.7, 0.4, 0.4, 0.3, '#6b4a2a');
      f.block(3.5, 2.9, 1.7, 0.4, 0.4, 0.3, '#6b4a2a');
      f.collider(0, 0, 9, 4.4, 0, 3);
      break;
    }
    case 'bridge': {
      // Suspension bridge: steel towers with cross-bracing, asphalt deck, curved main cables and hangers
      const len = 90 * s;
      const steel = lm.label === 'golden' ? '#c0512f' : '#7d838d';
      f.tb(0, 5.6, 0, 9, 0.9, len, '#5a5f66', 'metal', 'asphalt');
      f.block(0, 6.52, 0, 0.18, 0.02, len, '#e9d58a');
      for (const side of [-1, 1]) f.block(side * 4.35, 6.5, 0, 0.12, 1.0, len, steel);
      for (const z of [-len / 3, len / 3]) {
        for (const side of [-1, 1]) f.tb(side * 4.6, -2, z, 1.6, 30, 1.8, steel, 'metal', 'metal');
        for (const y of [10, 17, 24, 28.6]) f.tb(0, y, z, 10.8, 1.2, 1.4, steel, 'metal', 'metal');
      }
      // Main cables follow a smooth catenary between and beyond the towers
      const cableY = (z: number) => {
        const az = Math.abs(z);
        if (az <= len / 3) return 9 + 20 * Math.pow(az / (len / 3), 2);
        return 29 - 22 * ((az - len / 3) / (len / 6));
      };
      for (const side of [-4.6, 4.6])
        for (let i = 0; i < 60; i++) {
          const z0 = -len / 2 + (i / 60) * len;
          const z1 = -len / 2 + ((i + 1) / 60) * len;
          const y0 = cableY(z0);
          const y1 = cableY(z1);
          const dz = z1 - z0;
          f.geom(new THREE.BoxGeometry(0.32, 0.32, Math.hypot(dz, y1 - y0) + 0.05), side, (y0 + y1) / 2, (z0 + z1) / 2, steel, -Math.atan2(y1 - y0, dz));
          if (i % 2 === 0) f.block(side, 6.5, z0, 0.07, Math.max(0.2, y0 - 6.5), 0.07, steel);
        }
      break;
    }
    case 'clock-tower': {
      // Gothic clock tower: stone shaft with tall traceried windows, belfry, clock faces, slate spire
      const stone = '#cdb88d';
      f.tb(0, 0, 0, 8, 2, 8, '#a99b7d', 'stone', 'stone');
      f.tb(0, 2, 0, 7, 32, 7, stone, 'fac-stone', 'stone');
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) f.tb(sx * 3.5, 0, sz * 3.5, 0.9, 36, 0.9, shade(stone, 1.05), 'stone', 'stone');
      f.tb(0, 34, 0, 8.4, 8, 8.4, '#d9c69c', 'stone', 'stone');
      for (const [x, z, ry] of [[0, 4.25, 0], [0, -4.25, Math.PI], [4.25, 0, Math.PI / 2], [-4.25, 0, -Math.PI / 2]] as const) {
        f.geom(cylinder(3.0, 3.0, 0.2, 24), x, 38, z, '#c9a24a', Math.PI / 2, ry);
        f.geom(cylinder(2.7, 2.7, 0.22, 24), x * 1.005, 38, z * 1.005, '#f6f0dc', Math.PI / 2, ry);
        f.block(x * 1.03, 37.9, z * 1.03, 0.22, 2.1, 0.08, '#1e2025', 'solid', ry);
        f.block(x * 1.03, 38.4, z * 1.03, 1.5, 0.18, 0.08, '#1e2025', 'solid', ry);
      }
      // Belfry arcade and steep slate spire with gold finials
      f.tb(0, 42, 0, 7.4, 3, 7.4, '#cdb88d', 'fac-stone', 'stone');
      for (let k = 0; k < 7; k++) f.tb(0, 45 + k * 1.3, 0, 7 - k * 1.0, 1.3, 7 - k * 1.0, '#3d4a52', 'slate', 'slate');
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) f.geom(new THREE.ConeGeometry(0.4, 3, 6), sx * 3.4, 46.5, sz * 3.4, '#c9a24a');
      f.block(0, 54, 0, 0.3, 4.5, 0.3, '#c9a24a');
      f.collider(0, 0, 8.4, 8.4, 0, 58);
      break;
    }
    case 'tower-bridge': {
      // Twin stone towers with slate turrets, high walkways and suspension chains
      const len = 70 * s;
      f.tb(0, 4.6, 0, 9, 1, len, '#5a5f66', 'metal', 'asphalt');
      f.block(0, 5.62, 0, 0.18, 0.02, len, '#e9d58a');
      for (const side of [-1, 1]) f.block(side * 4.35, 5.6, 0, 0.12, 1.0, len, '#2f5f9a');
      for (const z of [-len / 4, len / 4]) {
        f.tb(0, -2, z, 10, 26, 8, '#cbb58c', 'fac-stone', 'stone');
        for (const sx of [-1, 1])
          for (const sz of [-1, 1]) {
            f.tb(sx * 4.6, 18, z + sz * 3.6, 1.8, 9, 1.8, '#cbb58c', 'stone', 'stone');
            f.geom(new THREE.ConeGeometry(1.4, 4, 4), sx * 4.6, 29, z + sz * 3.6, '#3d4a52', 0, Math.PI / 4, 0, 1, 'solid', 'slate');
          }
        f.geom(new THREE.ConeGeometry(4.2, 6, 4), 0, 27, z, '#3d4a52', 0, Math.PI / 4, 0, 1, 'solid', 'slate');
      }
      // High-level walkways (blue steel)
      for (const y of [18.5, 20.5]) f.tb(0, y, 0, 6, 1.4, len / 2 - 8, '#2f5f9a', 'metal', 'metal');
      // Suspension chains from the towers to the shore
      for (const side of [-4.4, 4.4])
        for (const dir of [-1, 1])
          for (let i = 0; i < 12; i++) {
            const z0 = dir * (len / 4 + 4 + i * ((len / 4 - 4) / 12));
            const y0 = 17 - i * 1.0;
            f.block(side, y0, z0, 0.3, 0.3, (len / 4 - 4) / 12 + 0.2, '#2f5f9a');
          }
      break;
    }
    case 'phone-box': {
      f.block(0, 0, 0, 1.3, 2.8, 1.3, '#d0302a');
      f.block(0, 2.8, 0, 1.45, 0.3, 1.45, '#d0302a');
      f.block(0, 0.9, 0.66, 0.9, 1.6, 0.04, '#8fb8dc', 'lit');
      f.block(0, 2.4, 0.67, 0.9, 0.25, 0.04, '#ffffff', 'neon');
      f.collider(0, 0, 1.3, 1.3, 0, 3);
      break;
    }
    case 'double-decker': {
      f.block(0, 0.4, 0, 2.5, 4.2, 9, '#d0302a');
      for (let z = -3.5; z <= 3.5; z += 1.75) {
        f.block(1.26, 1.6, z, 0.06, 1.1, 1.4, '#8fb8dc', 'lit');
        f.block(-1.26, 1.6, z, 0.06, 1.1, 1.4, '#8fb8dc', 'lit');
        f.block(1.26, 3.4, z, 0.06, 1.0, 1.4, '#8fb8dc', 'lit');
        f.block(-1.26, 3.4, z, 0.06, 1.0, 1.4, '#8fb8dc', 'lit');
      }
      for (const z of [-3, 3]) {
        f.geom(cylinder(0.55, 0.55, 2.6, 10), 0, 0.55, z, '#2a2f3d', 0, 0, Math.PI / 2);
      }
      f.collider(0, 0, 2.5, 9, 0, 4.6);
      break;
    }
    case 'triangle-tower': {
      // Stepped glass tower with white diagonal bracing (Hong Kong)
      let y = 0;
      const sections = [
        [14, 20],
        [11, 18],
        [8, 16],
        [5, 14],
      ];
      for (const [w, h] of sections) {
        f.tb(0, y, 0, w, h, w, '#a9c3d9', 'fac-glass', 'roof-gravel');
        for (const [rz, lz] of [[0, w / 2 + 0.08], [Math.PI, -w / 2 - 0.08]] as const) {
          f.geom(new THREE.BoxGeometry(0.35, Math.hypot(w, h), 0.08), 0, y + h / 2, lz, '#f4f6fa', 0, rz, Math.atan2(w, h));
          f.geom(new THREE.BoxGeometry(0.35, Math.hypot(w, h), 0.08), 0, y + h / 2, lz, '#f4f6fa', 0, rz, -Math.atan2(w, h));
        }
        f.tb(0, y + h - 0.3, 0, w + 0.2, 0.4, w + 0.2, '#f4f6fa', 'metal', 'metal');
        y += h;
      }
      f.block(-1, y, -1, 0.4, 10, 0.4, '#c0c4cc');
      f.block(1, y, 1, 0.4, 8, 0.4, '#c0c4cc');
      f.collider(0, 0, 14, 14, 0, y);
      b.lamps.push([lm.pos[0], y + 9, lm.pos[1]]);
      break;
    }
    case 'peak-hill': {
      // Wooded peak: layered grassy slopes, rock outcrops, tree clumps and a summit viewing pavilion
      const W = 70 * s;
      for (let k = 0; k < 6; k++) {
        const w = W - k * 11 * s;
        const [wx, wz] = f.world(0, 0);
        b.solid.geom(sphere(w / 2, 16, 8), new THREE.Matrix4().compose(new THREE.Vector3(wx, k * 3.2, wz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), new THREE.Vector3(1, 0.18, 0.6)), k < 4 ? shade('#557f43', 1 - k * 0.04) : '#6a9050', 'grass');
      }
      for (let i = 0; i < 26; i++) {
        const a = rng.next() * Math.PI * 2;
        const r = rng.range(6, W * 0.42);
        f.geom(sphere(rng.range(1.6, 2.8), 7, 5), Math.cos(a) * r, Math.max(2, 18 - r * 0.45), Math.sin(a) * r * 0.6, rng.pick(['#3a6630', '#456f37', '#2f5a2a']), 0, 0, 0, 1, 'solid', 'leaves');
      }
      for (let i = 0; i < 6; i++) f.tb(rng.range(-20, 20), rng.range(4, 12), rng.range(-10, 10), rng.range(2, 4), rng.range(1.5, 3), rng.range(2, 4), '#8b8676', 'stone', 'stone', rng.next());
      f.tb(0, 17.1, 0, 8, 0.6, 6, '#b9ad94', 'stone', 'stone');
      for (const sx of [-3.4, 3.4]) for (const sz of [-2.4, 2.4]) f.block(sx, 17.7, sz, 0.3, 3, 0.3, '#5a3e2b');
      f.tb(0, 20.7, 0, 9, 0.4, 7, '#7a2e2e', 'roof-tiles', 'roof-tiles');
      f.collider(0, 0, W, W * 0.6, 0, 30);
      break;
    }
    case 'pyramid-tower': {
      // Slim white pyramid skyscraper with glass bands and two 'wings' (San Francisco)
      const steps = 22;
      for (let k = 0; k < steps; k++) {
        const w = 14 - k * 0.58;
        f.tb(0, k * 3, 0, w, 3, w, k % 2 ? '#f1f2f4' : '#e6e8ec', k % 2 ? 'fac-glass' : 'concrete', 'concrete');
      }
      f.geom(new THREE.ConeGeometry(0.9, 10, 4), 0, steps * 3 + 5, 0, '#f4f6fa', 0, Math.PI / 4, 0, 1, 'solid', 'concrete');
      f.tb(-4.2, 20, 0, 3, 14, 4, '#f1f2f4', 'fac-glass', 'concrete');
      f.tb(4.2, 20, 0, 3, 14, 4, '#f1f2f4', 'fac-glass', 'concrete');
      f.collider(0, 0, 14, 14, 0, 70);
      break;
    }
    case 'marina-towers': {
      // Three glass towers joined by a ship-shaped sky deck with a rooftop pool and garden (Singapore)
      for (const x of [-18, 0, 18]) {
        f.tb(x, 0, 0, 9, 46, 12, '#dfe7f0', 'fac-glass', 'roof-gravel');
        f.tb(x, 0, 6.1, 9.4, 46, 0.3, '#eef2f6', 'metal', 'metal');
        f.collider(x, 0, 9, 12, 0, 50);
      }
      f.tb(0, 46, 0, 58, 2.2, 10, '#d4d9e1', 'metal', 'wood');
      f.tb(30, 46, 0, 6, 1.4, 7, '#d4d9e1', 'metal', 'wood');
      f.block(-10, 48.2, 0, 14, 0.3, 5, '#3fa7c0', 'lit');
      for (let x = -24; x < 26; x += 4) f.geom(sphere(0.8, 6, 5), x, 49.0, 3.4, '#3f6e34', 0, 0, 0, 1, 'solid', 'leaves');
      break;
    }
    case 'hawker-center': {
      // Open-sided food centre: tiled hip roof on steel columns, stalls with signboards, tables
      f.tb(0, 0, 0, 24, 0.3, 16, '#cfc8b8', 'stone', 'sidewalk');
      for (const [x, z] of [[-11, -7], [11, -7], [-11, 7], [11, 7], [0, -7], [0, 7]]) f.geom(cylinder(0.3, 0.3, 5, 8), x, 2.8, z, '#8a8f9c', 0, 0, 0, 1, 'solid', 'metal');
      for (let k = 0; k < 3; k++) f.tb(0, 5.3 + k * 0.7, 0, 26 - k * 7, 0.7, 18 - k * 5, k % 2 ? '#a8432f' : '#b84d33', 'roof-tiles', 'roof-tiles');
      for (let x = -9; x <= 9; x += 4.5) {
        f.tb(x, 0.3, -5, 3.6, 1.1, 1.4, '#d9dde3', 'metal');
        f.block(x, 2.4, -5.6, 3.4, 0.7, 0.1, ['#d8b23a', '#2f7a7a', '#b3261e', '#3f6e34', '#c96a2a'][Math.round((x + 9) / 4.5)]);
        f.geom(cylinder(0.9, 0.9, 0.08, 12), x, 0.95, 3, '#e9e4da');
        f.block(x, 0.3, 3, 0.15, 0.62, 0.15, '#3a3f45');
        for (const sx of [-1, 1]) f.geom(cylinder(0.25, 0.25, 0.45, 8), x + sx * 1.2, 0.55, 3, '#c9a24a');
      }
      f.collider(-11, -7, 0.6, 0.6, 0, 5);
      f.collider(11, -7, 0.6, 0.6, 0, 5);
      f.collider(-11, 7, 0.6, 0.6, 0, 5);
      f.collider(11, 7, 0.6, 0.6, 0, 5);
      break;
    }
    case 'lantern-street': {
      for (let k = -4; k <= 4; k++) {
        f.block(k * 3, 4.6, 0, 0.05, 0.05, 0.05, '#000000');
        f.geom(sphere(0.45, 8, 6), k * 3, 4.6 - Math.abs(k) * 0.08, 0, k % 2 ? '#e1553f' : '#ffcf3f', 0, 0, 0, 1, 'neon');
      }
      f.block(0, 5, 0, 27, 0.06, 0.06, '#3a2f2a');
      f.block(-13.5, 0, 0, 0.3, 5.2, 0.3, '#3a2f2a');
      f.block(13.5, 0, 0, 0.3, 5.2, 0.3, '#3a2f2a');
      break;
    }
    case 'cable-car-track': {
      const len = 120 * s;
      f.block(0, 0.02, 0, 1.6, 0.05, len, '#8a7a62');
      f.block(-0.55, 0.06, 0, 0.12, 0.05, len, '#c0c4cc');
      f.block(0.55, 0.06, 0, 0.12, 0.05, len, '#c0c4cc');
      break;
    }
    case 'trolley-stop':
    case 'statue': {
      f.block(0, 0, 0, 3, 1.6, 3, '#c9c2b0');
      f.block(0, 1.6, 0, 1.4, 3, 1.0, '#8a9aa0');
      f.block(0, 4.6, 0, 1, 1, 1, '#8a9aa0');
      f.collider(0, 0, 3, 3, 0, 5);
      break;
    }
    case 'gate': {
      // Paifang-style gate
      for (const x of [-5, 5]) f.block(x, 0, 0, 1, 7, 1, '#d0302a');
      for (let k = 0; k < 3; k++) f.block(0, 7 + k * 0.6, 0, 13 - k * 1.5, 0.6, 2 - k * 0.3, k === 1 ? '#ffcf3f' : '#2f5a5a');
      f.collider(-5, 0, 1, 1, 0, 7);
      f.collider(5, 0, 1, 1, 0, 7);
      break;
    }
    case 'billboard': {
      f.block(0, 0, 0, 0.6, 9, 0.6, '#8a8f9c');
      f.block(0, 8, 0, 10, 4.5, 0.4, '#1e2840');
      f.block(0, 8.4, 0.22, 9.2, 3.7, 0.05, rng.pick(['#2ebaba', '#ffcf3f', '#f06aa8', '#3cc45a']), 'neon');
      f.collider(0, 0, 0.6, 0.6, 0, 9);
      break;
    }
    case 'construction': {
      f.block(0, 0, 0, 10, 0.2, 10, '#c9b48a');
      for (const [x, z] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) f.block(x, 0, z, 0.25, 1.1, 0.25, '#ff8a3d');
      f.block(0, 0.9, 5, 10, 0.2, 0.1, '#ffcf3f');
      f.block(0, 0.9, -5, 10, 0.2, 0.1, '#ffcf3f');
      f.block(5, 0.9, 0, 0.1, 0.2, 10, '#ffcf3f');
      f.block(-5, 0.9, 0, 0.1, 0.2, 10, '#ffcf3f');
      break;
    }
    default:
      break;
  }
}
