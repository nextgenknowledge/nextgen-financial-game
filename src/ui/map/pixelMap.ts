/**
 * Pixel-art city maps, drawn like a proper street map rather than a diagram. The base map is
 * painted once per city from the real scene layout at 3 px per metre:
 *
 *   - ground, water (depth shading, ripples, quay walls), parks and car parks
 *   - pavements in each city's own paving, kerbs, roads with that city's markings and crossings
 *   - buildings with height: a visible street-side wall with window rows under an offset roof,
 *     roof parapets and plant, shadows thrown to the south-east
 *   - building sites, trees, plazas and paths
 *   - street names along the roads
 *
 * Points of interest use the game's own pixel icons on a pin.
 */
import type { BuildingDef, CityDef } from '@/game/content';
import type { CityMapData } from '@/world/builders/sceneBuilder';
import { footprint } from '@/world/builders/sceneBuilder';
import { streetName } from '@/world/builders/cityKit';
import { drawIcon, type IconName } from '../icons/pixelIcons';

export const PPM = 3; // map pixels per world metre
const MARGIN = 14; // metres of border around the playable area

interface MapStyle {
  ground: [number, number, number];
  pave: string;
  paveJoint: string;
  /** Spacing of the paving joints in metres. */
  joint: number;
  road: string;
  kerb: string;
  centre: 'double-yellow' | 'white-dash';
  /** Red-and-grey pavers drawn as a speckle (Hong Kong). */
  speckle?: string;
}

const STYLE: Record<string, MapStyle> = {
  park: { ground: [98, 142, 74], pave: '#d8d0bf', paveJoint: 'rgba(0,0,0,0.06)', joint: 2, road: '#575c65', kerb: '#b8b4ac', centre: 'white-dash' },
  'new-york': { ground: [176, 172, 164], pave: '#c9c6bf', paveJoint: 'rgba(0,0,0,0.12)', joint: 1.5, road: '#45494f', kerb: '#8f9294', centre: 'double-yellow' },
  london: { ground: [180, 176, 160], pave: '#cdc4b2', paveJoint: 'rgba(60,40,20,0.12)', joint: 1, road: '#4c4f55', kerb: '#a5a197', centre: 'white-dash' },
  'hong-kong': { ground: [182, 178, 170], pave: '#b8807a', paveJoint: 'rgba(0,0,0,0.08)', joint: 0.6, road: '#5b6067', kerb: '#cbc7ba', centre: 'white-dash', speckle: '#a3a29e' },
  'san-francisco': { ground: [196, 190, 176], pave: '#dcd7cb', paveJoint: 'rgba(0,0,0,0.08)', joint: 1, road: '#5f6369', kerb: '#cdc8bc', centre: 'double-yellow' },
  singapore: { ground: [170, 186, 160], pave: '#c98a66', paveJoint: 'rgba(255,240,220,0.25)', joint: 0.66, road: '#383b40', kerb: '#ecece6', centre: 'white-dash' },
};

/* ───────── Points of interest ───────── */

export interface Poi {
  id: string;
  name: string;
  glyph: IconName;
  color: string;
  x: number;
  z: number;
}

const CATEGORY: { test: RegExp; glyph: IconName; color: string }[] = [
  { test: /insurance|emergency|cyber|safety/, glyph: 'shield', color: '#2f5f9a' },
  { test: /currency|exchange-booth|fx/, glyph: 'exchange', color: '#2f8a4a' },
  { test: /ny-exchange|stock|trading|trade-hall|harbor/, glyph: 'chart_up', color: '#2f8a4a' },
  { test: /bank|atm|cds|brokerage|vault|credit/, glyph: 'bank', color: '#2f8a4a' },
  { test: /garden|giving/, glyph: 'seedling', color: '#3f7a3a' },
  { test: /pet/, glyph: 'paw', color: '#b36b2a' },
  { test: /auto|car|showroom/, glyph: 'car', color: '#b3261e' },
  { test: /dim-sum|food|night-market|hawker/, glyph: 'bowl', color: '#c96a2a' },
  { test: /cafe|coding-cafe/, glyph: 'coffee', color: '#8a5a3a' },
  { test: /market|grocery|corner/, glyph: 'shop', color: '#c96a2a' },
  { test: /real-estate|rent|home|borrow|property/, glyph: 'house', color: '#7a5a3a' },
  { test: /library|club/, glyph: 'books', color: '#6a4a8a' },
  { test: /newsroom/, glyph: 'newspaper', color: '#4a5260' },
  { test: /town-hall|tax|budget|registry|civic|hall/, glyph: 'bank', color: '#5a5f66' },
  { test: /theater|quiz|pitch/, glyph: 'masks', color: '#c93b8a' },
  { test: /arcade/, glyph: 'gamepad', color: '#c93b8a' },
  { test: /welcome/, glyph: 'question', color: '#2a7a9a' },
  { test: /travel|map/, glyph: 'plane', color: '#2a7a9a' },
  { test: /tech|campus|lab/, glyph: 'computer', color: '#2a6a8a' },
  { test: /sorting|warehouse|depot/, glyph: 'package', color: '#7a5a3a' },
  { test: /retirement|accounting/, glyph: 'calendar', color: '#2f8a4a' },
  { test: /store|shop|boutique|style|dept|furniture/, glyph: 'bags', color: '#a8432f' },
  { test: /job/, glyph: 'briefcase', color: '#3f4a5a' },
];

export function poiFor(b: BuildingDef): Poi {
  const key = `${b.id} ${b.interior?.theme ?? ''}`;
  const c = CATEGORY.find((k) => k.test.test(key)) ?? { glyph: 'briefcase' as const, color: '#3f4a5a' };
  return { id: b.id, name: b.name, glyph: c.glyph, color: c.color, x: b.pos[0], z: b.pos[1] };
}

/**
 * Map pin: a coloured rim around a cream tile holding the pixel icon, with a pointer underneath.
 * `px` is canvas pixels per icon pixel. (x, y) is the point the pin marks.
 */
export function drawPin(g: CanvasRenderingContext2D, glyph: IconName, color: string, x: number, y: number, px = 1.5) {
  const s = 16 * px;
  const pad = Math.max(1, Math.round(px * 1.5));
  const bw = Math.round(s + pad * 2);
  const bx = Math.round(x - bw / 2);
  const by = Math.round(y - bw - px * 4);
  // Pointer
  g.fillStyle = '#14181f';
  g.beginPath();
  g.moveTo(x - px * 3, by + bw);
  g.lineTo(x + px * 3, by + bw);
  g.lineTo(x, y);
  g.closePath();
  g.fill();
  // Tile: dark outline, coloured rim, cream face
  const o = Math.max(1, Math.round(px));
  g.fillRect(bx - o, by - o, bw + o * 2, bw + o * 2);
  g.fillStyle = color;
  g.fillRect(bx, by, bw, bw);
  g.fillStyle = '#fbf6ea';
  g.fillRect(bx + o, by + o, bw - o * 2, bw - o * 2);
  drawIcon(g, glyph, bx + pad, by + pad, px);
}

/* ───────── Base map painting ───────── */

function hash(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function shadeHex(hex: string, f: number) {
  const n = parseInt(hex.slice(1, 7), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const gg = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return `rgb(${r},${gg},${b})`;
}

const cache = new Map<string, { canvas: HTMLCanvasElement; size: number }>();

/** Paints (and caches) the base pixel map for a city. Returns the canvas and its size in px. */
export function baseMap(def: CityDef, data: CityMapData) {
  const hit = cache.get(def.id);
  if (hit) return hit;
  const st = STYLE[def.id] ?? STYLE.park;
  const H = data.half + MARGIN;
  const size = Math.round(H * 2 * PPM);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const X = (x: number) => Math.round((x + H) * PPM);
  const Z = (z: number) => Math.round((z + H) * PPM);
  const W = (m: number) => Math.max(1, Math.round(m * PPM));
  const rect = (x0: number, z0: number, x1: number, z1: number) => g.fillRect(X(x0), Z(z0), X(x1) - X(x0), Z(z1) - Z(z0));

  // ── Ground: textured, with a few darker patches ──
  const img = g.createImageData(size, size);
  const [gr, gg0, gb] = st.ground;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const n = hash(x, y);
      const patch = hash(x >> 4, y >> 4) * 0.08;
      const f = 0.92 + n * 0.08 + patch + (!data.isCity && n > 0.94 ? 0.1 : 0);
      const i = (y * size + x) * 4;
      img.data[i] = gr * f;
      img.data[i + 1] = gg0 * f;
      img.data[i + 2] = gb * f;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);

  // ── Water: deeper toward the middle, ripples, a quay wall and a pale edge ──
  for (const w of data.water) {
    const x0 = X(w.minX);
    const y0 = Z(w.minZ);
    const ww = X(w.maxX) - x0;
    const hh = Z(w.maxZ) - y0;
    for (let y = 0; y < hh; y++)
      for (let x = 0; x < ww; x++) {
        const edge = Math.min(x, y, ww - x, hh - y);
        const deep = Math.min(1, edge / 40);
        g.fillStyle = `rgb(${Math.round(64 - deep * 22)},${Math.round(128 - deep * 30)},${Math.round(160 - deep * 18)})`;
        g.fillRect(x0 + x, y0 + y, 1, 1);
      }
    for (let y = y0 + 4; y < y0 + hh - 4; y += 5)
      for (let x = x0 + 4; x < x0 + ww - 8; x += 2)
        if (hash(x, y) > 0.94) {
          g.fillStyle = 'rgba(200,232,245,0.55)';
          g.fillRect(x, y, 4, 1);
          g.fillRect(x + 1, y - 1, 2, 1);
        }
    g.fillStyle = '#9a958a';
    g.fillRect(x0 - 3, y0 - 3, ww + 6, 3);
    g.fillRect(x0 - 3, y0 + hh, ww + 6, 3);
    g.fillRect(x0 - 3, y0, 3, hh);
    g.fillRect(x0 + ww, y0, 3, hh);
    g.fillStyle = 'rgba(230,245,250,0.7)';
    g.fillRect(x0, y0, ww, 1);
    g.fillRect(x0, y0, 1, hh);
  }

  // ── Pavements: each city's paving, with a kerb line ──
  for (const b of data.blocks) {
    g.fillStyle = st.pave;
    rect(b.minX, b.minZ, b.maxX, b.maxZ);
    if (st.speckle) {
      for (let y = Z(b.minZ); y < Z(b.maxZ); y++)
        for (let x = X(b.minX); x < X(b.maxX); x++)
          if (hash(x >> 1, y >> 1) > 0.55) {
            g.fillStyle = st.speckle;
            g.fillRect(x, y, 1, 1);
          }
    }
    g.fillStyle = st.paveJoint;
    const step = Math.max(2, Math.round(st.joint * PPM));
    for (let x = X(b.minX); x < X(b.maxX); x += step) g.fillRect(x, Z(b.minZ), 1, Z(b.maxZ) - Z(b.minZ));
    for (let y = Z(b.minZ); y < Z(b.maxZ); y += step) g.fillRect(X(b.minX), y, X(b.maxX) - X(b.minX), 1);
    g.fillStyle = st.kerb;
    g.fillRect(X(b.minX), Z(b.minZ), X(b.maxX) - X(b.minX), 1);
    g.fillRect(X(b.minX), Z(b.maxZ) - 1, X(b.maxX) - X(b.minX), 1);
    g.fillRect(X(b.minX), Z(b.minZ), 1, Z(b.maxZ) - Z(b.minZ));
    g.fillRect(X(b.maxX) - 1, Z(b.minZ), 1, Z(b.maxZ) - Z(b.minZ));
  }

  // ── Roads: asphalt with a darker edge, local centre markings ──
  const xs = [...new Set(data.roads.filter((r) => r.a[0] === r.b[0]).map((r) => r.a[0]))].sort((a, b) => a - b);
  const zs = [...new Set(data.roads.filter((r) => r.a[1] === r.b[1]).map((r) => r.a[1]))].sort((a, b) => a - b);
  const nearJunction = (x: number, z: number, rw: number) => data.isCity && xs.some((rx) => Math.abs(rx - x) < rw / 2 + 2) && zs.some((rz) => Math.abs(rz - z) < rw / 2 + 2);
  for (const r of data.roads) {
    const dx = r.b[0] - r.a[0];
    const dz = r.b[1] - r.a[1];
    const len = Math.hypot(dx, dz);
    g.save();
    g.translate(X((r.a[0] + r.b[0]) / 2), Z((r.a[1] + r.b[1]) / 2));
    g.rotate(Math.atan2(dz, dx));
    g.fillStyle = st.road;
    g.fillRect(Math.round((-len / 2 - r.w / 2) * PPM), Math.round((-r.w / 2) * PPM), Math.round((len + r.w) * PPM), Math.round(r.w * PPM));
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let k = 0; k < len * 2; k++) {
      const t = (hash(k, Math.round(r.a[0] + r.a[1])) - 0.5) * len;
      g.fillRect(Math.round(t * PPM), Math.round((hash(k, 7) - 0.5) * r.w * PPM), 3, 1);
    }
    g.restore();
  }
  for (const r of data.roads) {
    const dx = r.b[0] - r.a[0];
    const dz = r.b[1] - r.a[1];
    const len = Math.hypot(dx, dz);
    const ux = dx / (len || 1);
    const uz = dz / (len || 1);
    for (let t = -len / 2; t < len / 2; t += 1) {
      const cx = (r.a[0] + r.b[0]) / 2 + ux * t;
      const cz = (r.a[1] + r.b[1]) / 2 + uz * t;
      if (nearJunction(cx, cz, r.w)) continue;
      if (st.centre === 'double-yellow') {
        g.fillStyle = '#e6bd3a';
        g.fillRect(X(cx - uz * 0.25), Z(cz + ux * 0.25), Math.max(1, Math.round(Math.abs(ux) * PPM)), Math.max(1, Math.round(Math.abs(uz) * PPM)));
        g.fillRect(X(cx + uz * 0.25), Z(cz - ux * 0.25), Math.max(1, Math.round(Math.abs(ux) * PPM)), Math.max(1, Math.round(Math.abs(uz) * PPM)));
      } else if (Math.floor(t / 2.4) % 2 === 0) {
        g.fillStyle = '#ecebe4';
        g.fillRect(X(cx), Z(cz), Math.max(1, Math.round(Math.abs(ux) * PPM)), Math.max(1, Math.round(Math.abs(uz) * PPM)));
      }
    }
  }
  // Zebra crossings at junctions
  if (data.isCity) {
    const rw = data.roads[0]?.w ?? 10;
    g.fillStyle = '#ecebe4';
    for (const x of xs)
      for (const z of zs)
        for (let k = -rw / 2 + 0.6; k < rw / 2 - 0.4; k += 1.1) {
          for (const s of [-1, 1]) {
            rect(x + k, z + s * (rw / 2 + 1.25) - 0.9, x + k + 0.55, z + s * (rw / 2 + 1.25) + 0.9);
            rect(x + s * (rw / 2 + 1.25) - 0.9, z + k, x + s * (rw / 2 + 1.25) + 0.9, z + k + 0.55);
          }
        }
  }

  // ── Paths and plazas ──
  for (const p of data.paths) {
    g.strokeStyle = data.isCity ? '#cfc4ac' : '#dccca6';
    g.lineWidth = W(p.w);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(X(p.a[0]), Z(p.a[1]));
    g.lineTo(X(p.b[0]), Z(p.b[1]));
    g.stroke();
  }
  for (const p of data.plazas) {
    g.fillStyle = shadeHex(p.color.length === 7 ? p.color : '#e8dcc4', 0.82);
    g.beginPath();
    g.arc(X(p.x), Z(p.z), W(p.r + 0.6), 0, Math.PI * 2);
    g.fill();
    g.fillStyle = shadeHex(p.color.length === 7 ? p.color : '#e8dcc4', 0.97);
    g.beginPath();
    g.arc(X(p.x), Z(p.z), W(p.r), 0, Math.PI * 2);
    g.fill();
    // Paving rings
    g.strokeStyle = 'rgba(0,0,0,0.08)';
    g.lineWidth = 1;
    for (let r = 2; r < p.r; r += 2) {
      g.beginPath();
      g.arc(X(p.x), Z(p.z), W(r), 0, Math.PI * 2);
      g.stroke();
    }
  }

  // ── Pocket parks, car parks, building sites ──
  for (const p of data.parks) {
    g.fillStyle = '#5f8a45';
    rect(p.minX, p.minZ, p.maxX, p.maxZ);
    for (let y = Z(p.minZ); y < Z(p.maxZ); y++)
      for (let x = X(p.minX); x < X(p.maxX); x++)
        if (hash(x, y) > 0.86) {
          g.fillStyle = hash(y, x) > 0.5 ? '#6f9c52' : '#527a3a';
          g.fillRect(x, y, 1, 1);
        }
    g.fillStyle = '#3f6a30';
    g.fillRect(X(p.minX), Z(p.minZ), X(p.maxX) - X(p.minX), 2);
    g.fillRect(X(p.minX), Z(p.maxZ) - 2, X(p.maxX) - X(p.minX), 2);
    g.fillRect(X(p.minX), Z(p.minZ), 2, Z(p.maxZ) - Z(p.minZ));
    g.fillRect(X(p.maxX) - 2, Z(p.minZ), 2, Z(p.maxZ) - Z(p.minZ));
    g.fillStyle = '#d4c7a8';
    rect((p.minX + p.maxX) / 2 - 0.8, p.minZ + 0.7, (p.minX + p.maxX) / 2 + 0.8, p.maxZ - 0.7);
  }
  for (const p of data.carParks) {
    g.fillStyle = '#50545b';
    rect(p.minX, p.minZ, p.maxX, p.maxZ);
    g.fillStyle = 'rgba(235,235,225,0.75)';
    const along = p.maxX - p.minX >= p.maxZ - p.minZ;
    if (along) for (let x = p.minX + 1; x < p.maxX - 0.5; x += 2.7) for (const zz of [p.minZ + 0.4, p.maxZ - 2.8]) rect(x, zz, x + 0.12, zz + 2.4);
    else for (let z = p.minZ + 1; z < p.maxZ - 0.5; z += 2.7) for (const xx of [p.minX + 0.4, p.maxX - 2.8]) rect(xx, z, xx + 2.4, z + 0.12);
    g.fillStyle = '#2f5f9a';
    rect((p.minX + p.maxX) / 2 - 0.9, (p.minZ + p.maxZ) / 2 - 0.9, (p.minX + p.maxX) / 2 + 0.9, (p.minZ + p.maxZ) / 2 + 0.9);
    g.fillStyle = '#ffffff';
    g.font = `700 ${W(1.4)}px 'Pixelify Sans', monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('P', X((p.minX + p.maxX) / 2), Z((p.minZ + p.maxZ) / 2) + 1);
  }
  for (const p of data.sites) {
    g.fillStyle = '#8a7a62';
    rect(p.minX, p.minZ, p.maxX, p.maxZ);
    for (let y = Z(p.minZ); y < Z(p.maxZ); y++)
      for (let x = X(p.minX); x < X(p.maxX); x++)
        if (hash(x, y) > 0.8) {
          g.fillStyle = '#76684f';
          g.fillRect(x, y, 1, 1);
        }
    g.strokeStyle = '#b08a5a';
    g.lineWidth = 2;
    g.strokeRect(X(p.minX) + 1, Z(p.minZ) + 1, X(p.maxX) - X(p.minX) - 2, Z(p.maxZ) - Z(p.minZ) - 2);
  }

  // ── Buildings: shadow, street-side wall with windows, offset roof ──
  const fp = [...data.footprints].sort((a, b) => a.z + a.d / 2 - (b.z + b.d / 2));
  const corners = (f: (typeof fp)[number], grow = 0) => {
    const c2 = Math.cos(f.rot);
    const s2 = Math.sin(f.rot);
    const hw = f.w / 2 + grow;
    const hd = f.d / 2 + grow;
    return [
      [-hw, -hd],
      [hw, -hd],
      [hw, hd],
      [-hw, hd],
    ].map(([lx, lz]) => [f.x + lx * c2 + lz * s2, f.z - lx * s2 + lz * c2] as [number, number]);
  };
  const poly = (pts: [number, number][], oy = 0) => {
    g.beginPath();
    pts.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z) - oy) : g.moveTo(X(x), Z(z) - oy)));
    g.closePath();
  };
  const lift = (f: (typeof fp)[number]) => Math.round(Math.min(14, 1 + f.h * 0.22) * (PPM / 2));
  // Shadows to the south-east
  g.fillStyle = 'rgba(20,24,32,0.26)';
  for (const f of fp) {
    const len = Math.min(12, 1 + f.h * 0.16);
    const pts = corners(f);
    poly(pts.map(([x, z]) => [x + len * 0.6, z + len] as [number, number]));
    g.fill();
  }
  for (const f of fp) {
    const pts = corners(f);
    const oy = lift(f);
    // Bounds of the footprint in map pixels
    const minX = Math.min(...pts.map((p) => X(p[0])));
    const maxX = Math.max(...pts.map((p) => X(p[0])));
    const maxY = Math.max(...pts.map((p) => Z(p[1])));
    const wallCol = f.kind === 'landmark' ? '#8a857a' : shadeHex(f.color, 0.62);
    // South wall (the face toward the viewer)
    g.fillStyle = wallCol;
    g.fillRect(minX, maxY - oy, maxX - minX, oy);
    // Windows on that wall
    if (oy >= 4) {
      g.fillStyle = 'rgba(190,215,235,0.55)';
      for (let y = maxY - oy + 2; y < maxY - 2; y += 4) for (let x = minX + 2; x < maxX - 2; x += 4) g.fillRect(x, y, 2, 2);
    }
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(minX, maxY - 1, maxX - minX, 1);
    // Roof
    poly(pts, oy);
    g.fillStyle = shadeHex(f.color, 0.7);
    g.fill();
    poly(corners(f, -0.8), oy);
    const roof = f.kind === 'landmark' ? '#b2ac9c' : shadeHex(f.color, 0.96 + Math.min(0.12, f.h / 300));
    g.fillStyle = roof;
    g.fill();
    // Roof texture and plant
    const rx0 = Math.min(...corners(f, -1.2).map((p) => X(p[0])));
    const rx1 = Math.max(...corners(f, -1.2).map((p) => X(p[0])));
    const ry0 = Math.min(...corners(f, -1.2).map((p) => Z(p[1]))) - oy;
    const ry1 = Math.max(...corners(f, -1.2).map((p) => Z(p[1]))) - oy;
    for (let y = ry0; y < ry1; y += 2)
      for (let x = rx0; x < rx1; x += 2)
        if (hash(x, y) > 0.82) {
          g.fillStyle = 'rgba(0,0,0,0.07)';
          g.fillRect(x, y, 1, 1);
        }
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.fillRect(rx0, ry0, rx1 - rx0, 1);
    if (f.w > 6 && f.d > 6) {
      const n = Math.floor(hash(Math.round(f.x), Math.round(f.z)) * 3) + 1;
      for (let k = 0; k < n; k++) {
        const ux = rx0 + 3 + hash(k, Math.round(f.x)) * Math.max(1, rx1 - rx0 - 9);
        const uy = ry0 + 3 + hash(Math.round(f.z), k) * Math.max(1, ry1 - ry0 - 9);
        g.fillStyle = '#9aa0a8';
        g.fillRect(Math.round(ux), Math.round(uy), 5, 4);
        g.fillStyle = 'rgba(0,0,0,0.3)';
        g.fillRect(Math.round(ux) + 1, Math.round(uy) + 4, 5, 1);
      }
    }
    if (f.kind === 'enterable') {
      poly(pts, oy);
      g.strokeStyle = '#f2c94c';
      g.lineWidth = 2;
      g.stroke();
    }
  }

  // ── Trees ──
  for (const t of data.trees) {
    const r = Math.max(3, Math.round(2.0 * t.s * PPM * 0.8));
    const x = X(t.x);
    const y = Z(t.z) - 2;
    const col = t.kind === 'blossom' ? '#c98aa2' : t.kind === 'autumn' ? '#c0773a' : t.kind === 'palm' ? '#4f8a3e' : t.kind === 'pine' ? '#2f5a3c' : '#3f6e34';
    g.fillStyle = 'rgba(20,30,20,0.3)';
    g.beginPath();
    g.arc(x + 3, y + 4, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = shadeHex(col, 0.7);
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = col;
    g.beginPath();
    g.arc(x - 1, y - 1, r - 1.5, 0, Math.PI * 2);
    g.fill();
    for (let k = 0; k < 4; k++) {
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(x - r / 2 + hash(k, x) * r * 0.6, y - r / 2 + hash(y, k) * r * 0.5, 2, 1);
    }
  }

  // ── Street names along the roads, between junctions ──
  if (data.isCity) {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const fs = Math.round(PPM * 2.4);
    g.font = `700 ${fs}px 'Pixelify Sans', monospace`;
    const label = (text: string, x: number, y: number, rot: number) => {
      g.save();
      g.translate(x, y);
      g.rotate(rot);
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(20,24,31,0.85)';
      g.strokeText(text, 0, 0);
      g.fillStyle = '#fbf6ea';
      g.fillText(text, 0, 0);
      g.restore();
    };
    const cutsZ = [-data.half, ...zs, data.half];
    xs.forEach((rx, i) => {
      for (let k = 0; k < cutsZ.length - 1; k += 2) {
        const mid = (cutsZ[k] + cutsZ[k + 1]) / 2;
        if (cutsZ[k + 1] - cutsZ[k] < 24 || data.water.some((w) => rx > w.minX && rx < w.maxX && mid > w.minZ && mid < w.maxZ)) continue;
        label(streetName(def.id, 'xs', i), X(rx), Z(mid), -Math.PI / 2);
      }
    });
    const cutsX = [-data.half, ...xs, data.half];
    zs.forEach((rz, i) => {
      for (let k = 1; k < cutsX.length - 1; k += 2) {
        const mid = (cutsX[k] + cutsX[k + 1]) / 2;
        if (cutsX[k + 1] - cutsX[k] < 24 || data.water.some((w) => mid > w.minX && mid < w.maxX && rz > w.minZ && rz < w.maxZ)) continue;
        label(streetName(def.id, 'zs', i), X(mid), Z(rz), 0);
      }
    });
  }

  // ── Frame: dark border with a fine inner rule ──
  g.fillStyle = '#14181f';
  g.fillRect(0, 0, size, 4);
  g.fillRect(0, size - 4, size, 4);
  g.fillRect(0, 0, 4, size);
  g.fillRect(size - 4, 0, 4, size);
  g.fillStyle = 'rgba(251,246,234,0.6)';
  g.fillRect(6, 6, size - 12, 1);
  g.fillRect(6, size - 7, size - 12, 1);
  g.fillRect(6, 6, 1, size - 12);
  g.fillRect(size - 7, 6, 1, size - 12);

  const out = { canvas: c, size };
  cache.set(def.id, out);
  return out;
}

/** World → base-map pixel coordinate. */
export function worldToMap(data: CityMapData, x: number, z: number) {
  const H = data.half + MARGIN;
  return { x: (x + H) * PPM, y: (z + H) * PPM };
}

export function buildingsPois(def: CityDef) {
  return def.buildings.map(poiFor);
}

export { footprint };
