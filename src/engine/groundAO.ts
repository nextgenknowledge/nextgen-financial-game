/**
 * The ground map: one small texture baked once per city and laid over the whole map from above.
 * The world shader reads it by world position (one texture lookup, so it runs on every quality setting).
 *
 *  - Red: ground occlusion. Pavement, roads and grass get darker right next to buildings, walls and
 *    big props, where less sky can reach. Without it, buildings look pasted onto the street.
 *  - Green: tyre wear. Two darker, polished tracks run down every lane where the wheels go.
 *  - Blue: concrete. The gutter strip along each kerb and the long patched trenches left by
 *    roadworks are a paler concrete than the asphalt around them.
 *
 * White means "nothing here" in every channel.
 */
import * as THREE from 'three';
import { worldUniforms } from './atlas';

export interface AOShape {
  cx: number;
  cz: number;
  w: number;
  d: number;
  /** Rotation about Y, the same convention as the building frames and colliders. */
  rot: number;
}

/** A straight stretch of road, centre line from a to b. */
export interface GroundRoad {
  a: [number, number];
  b: [number, number];
  w: number;
}

export interface GroundExtras {
  roads?: GroundRoad[];
  /** Cities: kerbs run along both sides of each road (the park's drives have none). */
  gutters?: boolean;
  /** Deterministic per city, so the trench patches stay put between visits. */
  seed?: number;
}

/** Pixels per metre, enough for a tyre track about 30 cm wide. */
const PX_PER_M = 4;
const MAX_PX = 2048;
/** How far the soft shade spreads out from a wall, in metres. */
const SPREAD = 4;

let current: THREE.CanvasTexture | null = null;

export function setGroundAO(shapes: AOShape[], bounds: { minX: number; maxX: number; minZ: number; maxZ: number }, extras: GroundExtras = {}) {
  if (typeof document === 'undefined') return;
  const pad = SPREAD * 2;
  const minX = bounds.minX - pad;
  const minZ = bounds.minZ - pad;
  const wM = bounds.maxX - bounds.minX + pad * 2;
  const dM = bounds.maxZ - bounds.minZ + pad * 2;
  const scale = Math.min(PX_PER_M, MAX_PX / wM, MAX_PX / dM);
  const W = Math.ceil(wM * scale);
  const H = Math.ceil(dM * scale);
  const px = (x: number) => (x - minX) * scale;
  const pz = (z: number) => (z - minZ) * scale;
  const layer = () => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, W, H);
    return g;
  };

  // ── Red: occlusion. Draw each shape far off to the side and let only its blurred shadow land on
  // the canvas: shadowBlur works in every browser, unlike canvas filters
  const ao = layer();
  const OFF = W + H + 100;
  ao.shadowColor = 'rgba(0,0,0,1)';
  ao.shadowBlur = SPREAD * scale * 1.6;
  ao.shadowOffsetX = OFF;
  ao.fillStyle = '#000';
  for (const s of shapes) {
    ao.save();
    ao.translate(px(s.cx) - OFF, pz(s.cz));
    ao.rotate(-s.rot);
    ao.fillRect((-s.w / 2) * scale, (-s.d / 2) * scale, s.w * scale, s.d * scale);
    ao.restore();
  }

  const roads = (extras.roads ?? []).filter((r) => Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]) > 4);
  let seed = (extras.seed ?? 1) * 9301 + 49297;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  // Draw a strip along a road: `off` metres to the side of the centre line, `width` wide, from t0 to t1 along it
  const strip = (g: CanvasRenderingContext2D, r: GroundRoad, off: number, width: number, t0 = 0, t1 = 1) => {
    const dx = r.b[0] - r.a[0];
    const dz = r.b[1] - r.a[1];
    const len = Math.hypot(dx, dz);
    const ux = dx / len;
    const uz = dz / len;
    // Side vector (to the right of travel)
    const sx = -uz;
    const sz = ux;
    const ax = r.a[0] + ux * len * t0 + sx * off;
    const az = r.a[1] + uz * len * t0 + sz * off;
    const bx = r.a[0] + ux * len * t1 + sx * off;
    const bz = r.a[1] + uz * len * t1 + sz * off;
    g.lineWidth = width * scale;
    g.beginPath();
    g.moveTo(px(ax), pz(az));
    g.lineTo(px(bx), pz(bz));
    g.stroke();
  };

  // ── Green: tyre tracks, two per lane, softened so they fade into the asphalt
  const wear = layer();
  wear.lineCap = 'butt';
  for (const r of roads) {
    if (r.w < 6) continue;
    const lanes = r.w >= 13 ? 4 : 2;
    const laneW = r.w / lanes;
    for (let l = 0; l < lanes; l++) {
      const centre = -r.w / 2 + laneW * (l + 0.5);
      for (const wheel of [-0.78, 0.78]) {
        // Soft edge: a wide faint band under a narrow stronger one
        wear.strokeStyle = 'rgba(0,0,0,0.25)';
        strip(wear, r, centre + wheel, 0.75);
        wear.strokeStyle = 'rgba(0,0,0,0.35)';
        strip(wear, r, centre + wheel, 0.35);
      }
      // Oil drips down the middle of the lane
      wear.strokeStyle = 'rgba(0,0,0,0.18)';
      strip(wear, r, centre, 0.5);
    }
  }

  // ── Blue: concrete gutters along the kerbs, and patched trenches from old roadworks
  const conc = layer();
  conc.strokeStyle = '#000';
  conc.lineCap = 'butt';
  if (extras.gutters)
    for (const r of roads) {
      if (r.w < 6) continue;
      for (const side of [-1, 1]) strip(conc, r, side * (r.w / 2 - 0.28), 0.56);
    }
  for (const r of roads) {
    const len = Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]);
    if (r.w < 6 || len < 30) continue;
    // Now and then a long trench patch down one lane, or a short one cut across the road
    if (rnd() < 0.45) {
      const t0 = 0.1 + rnd() * 0.5;
      conc.strokeStyle = 'rgba(0,0,0,0.55)';
      strip(conc, r, (rnd() < 0.5 ? -1 : 1) * r.w * (0.12 + rnd() * 0.2), 0.7 + rnd() * 0.5, t0, Math.min(0.95, t0 + (8 + rnd() * 25) / len));
    }
    if (rnd() < 0.5) {
      const t = 0.15 + rnd() * 0.7;
      conc.strokeStyle = 'rgba(0,0,0,0.5)';
      const dx = r.b[0] - r.a[0];
      const dz = r.b[1] - r.a[1];
      const cx = r.a[0] + dx * t;
      const cz = r.a[1] + dz * t;
      const ux = dx / len;
      const uz = dz / len;
      strip(conc, { a: [cx - uz * r.w * 0.45, cz + ux * r.w * 0.45], b: [cx + uz * r.w * 0.45, cz - ux * r.w * 0.45], w: 1 }, 0, 0.9);
    }
  }
  // Where two streets cross there is no kerb, so clear the gutters out of the junction
  if (extras.gutters) {
    const ax = roads.filter((r) => Math.abs(r.a[0] - r.b[0]) < 0.01);
    const az = roads.filter((r) => Math.abs(r.a[1] - r.b[1]) < 0.01);
    conc.fillStyle = '#fff';
    for (const v of ax)
      for (const h of az) {
        const x = v.a[0];
        const z = h.a[1];
        const inV = z > Math.min(v.a[1], v.b[1]) - h.w / 2 - 0.5 && z < Math.max(v.a[1], v.b[1]) + h.w / 2 + 0.5;
        const inH = x > Math.min(h.a[0], h.b[0]) - v.w / 2 - 0.5 && x < Math.max(h.a[0], h.b[0]) + v.w / 2 + 0.5;
        if (!inV || !inH) continue;
        conc.fillRect(px(x - v.w / 2), pz(z - h.w / 2), v.w * scale, h.w * scale);
      }
  }

  // ── Combine the three layers into one texture
  const out = layer();
  const img = out.getImageData(0, 0, W, H);
  const r0 = ao.getImageData(0, 0, W, H).data;
  const g0 = wear.getImageData(0, 0, W, H).data;
  const b0 = conc.getImageData(0, 0, W, H).data;
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = r0[i];
    d[i + 1] = g0[i];
    d[i + 2] = b0[i];
    d[i + 3] = 255;
  }
  out.putImageData(img, 0, 0);

  current?.dispose();
  const tex = new THREE.CanvasTexture(out.canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  current = tex;
  worldUniforms.uGroundAO.value = tex;
  worldUniforms.uAOBox.value.set(minX, minZ, wM, dM);
  worldUniforms.uAOOn.value = 1;
}

/** Indoors there is no city footprint to shade by. */
export function clearGroundAO() {
  worldUniforms.uAOOn.value = 0;
}
