/**
 * World material atlas: a single WebGL2 texture array holding every surface material
 * (brick, stone, glass facades, asphalt, grass…), painted procedurally at startup.
 *
 * Each layer has an RGB image and a mask (stored in alpha):
 *   1.0 = wall/surface: tinted by the vertex color, so one "brick" layer serves every brick color
 *   0.5 = trim: drawn as painted (white window frames, dark shutters)
 *   0.0 = glass pane: drawn as painted, and lit at night per window cell by the shader
 *
 * Geometry carries an `aTex` attribute (u, v, layer + 1). u/v are in tile units, so 1 unit = one
 * repeat of the layer (one brick tile, or one window bay × one floor for facades). Layer 0 = none.
 */
import * as THREE from 'three';

export const TEX_SIZE = 128;

export interface LayerDef {
  /** Meters covered by one tile horizontally and vertically. */
  m: [number, number];
  /** Facades: snap to a whole number of bays/floors per face so windows line up with edges. */
  fit?: boolean;
  paint: (p: Painter) => void;
}

/** Drawing helpers for a 128×128 layer, writing straight into RGBA buffers (fast on low-end CPUs). */
export class Painter {
  readonly S = TEX_SIZE;
  rnd: () => number;
  constructor(
    public rgb: Uint8ClampedArray,
    public mask: Uint8ClampedArray,
    seed: number,
  ) {
    let s = seed * 9301 + 49297;
    this.rnd = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }
  /** Set one pixel (wraps around the tile edges). Colors are 0..1 sRGB. */
  px(x: number, y: number, r: number, g: number, b: number, mask?: number) {
    const i = (((y & 127) << 7) + (x & 127)) << 2;
    this.rgb[i] = r * 255;
    this.rgb[i + 1] = g * 255;
    this.rgb[i + 2] = b * 255;
    if (mask !== undefined) this.mask[i] = mask * 255;
  }
  /** Fill a rect with a gray level (0..1) and mask class. */
  rect(x: number, y: number, w: number, h: number, gray: number, mask = 1) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, gray, gray, gray, mask);
  }
  /** Per-pixel brightness noise over a rect (keeps the mask). */
  noise(x: number, y: number, w: number, h: number, base: number, amt: number) {
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) {
        const v = base + (this.rnd() - 0.5) * amt;
        this.px(i, j, v, v, v);
      }
  }
  /** Glass pane with a sky-reflection gradient, a diagonal streak and optional mullions. */
  pane(x: number, y: number, w: number, h: number, mullionsX = 0, mullionsY = 0, frame = 0.92) {
    for (let j = 0; j < h; j++) {
      const t = j / h;
      for (let i = 0; i < w; i++) {
        const streak = Math.abs(((i + j * 0.6) % 40) - 20) < 3 ? 1.12 : 1;
        const k = streak * (1 + (this.rnd() - 0.5) * 0.05);
        this.px(x + i, y + j, (0.32 + 0.28 * (1 - t)) * k, (0.42 + 0.3 * (1 - t)) * k, (0.55 + 0.3 * (1 - t)) * k, 0);
      }
    }
    for (let k = 1; k <= mullionsX; k++) this.rect(x + Math.round((w * k) / (mullionsX + 1)) - 1, y, 2, h, frame, 0.5);
    for (let k = 1; k <= mullionsY; k++) this.rect(x, y + Math.round((h * k) / (mullionsY + 1)) - 1, w, 2, frame, 0.5);
  }
}

/* ───────────── Layer painters ───────────── */

function brickWall(p: Painter, x = 0, y = 0, w = p.S, h = p.S, bw = 24, bh = 8) {
  p.rect(x, y, w, h, 0.62);
  for (let row = 0; row * bh < h; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let bx = -bw; bx < w + bw; bx += bw) {
      const x0 = Math.max(x, x + bx + off);
      const x1 = Math.min(x + w, x + bx + off + bw - 2);
      if (x1 <= x0) continue;
      const shade = 0.82 + p.rnd() * 0.22;
      p.noise(x0, y + row * bh, x1 - x0, bh - 2, shade, 0.08);
    }
  }
}

function stoneBlocks(p: Painter, x = 0, y = 0, w = p.S, h = p.S, bw = 64, bh = 32) {
  p.rect(x, y, w, h, 0.7);
  for (let row = 0; row * bh < h; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let bx = -bw; bx < w + bw; bx += bw) {
      const x0 = Math.max(x, x + bx + off);
      const x1 = Math.min(x + w, x + bx + off + bw - 2);
      if (x1 <= x0) continue;
      p.noise(x0, y + row * bh, x1 - x0, bh - 2, 0.9 + p.rnd() * 0.08, 0.06);
    }
  }
}

function stucco(p: Painter, x = 0, y = 0, w = p.S, h = p.S) {
  p.noise(x, y, w, h, 0.95, 0.06);
}

/** A classic window: frame (trim), sill, lintel, and a pane with sash bars. */
function classicWindow(p: Painter, cx: number, top: number, w: number, h: number, opts: { sash?: boolean; shutters?: boolean; lintel?: number; arch?: boolean } = {}) {
  const x = Math.round(cx - w / 2);
  if (opts.lintel !== undefined) p.rect(x - 4, top - 6, w + 8, 6, opts.lintel, 0.5);
  p.rect(x - 2, top - 2, w + 4, h + 4, 0.94, 0.5); // frame
  p.pane(x, top, w, h, opts.sash ? 1 : 0, opts.sash ? 1 : 0);
  p.rect(x - 4, top + h + 2, w + 8, 4, 0.9, 0.5); // sill
  if (opts.shutters) {
    p.rect(x - 14, top - 2, 10, h + 4, 0.35, 0.5);
    p.rect(x + w + 4, top - 2, 10, h + 4, 0.35, 0.5);
    for (let j = top; j < top + h; j += 4) {
      p.rect(x - 13, j, 8, 1, 0.28, 0.5);
      p.rect(x + w + 5, j, 8, 1, 0.28, 0.5);
    }
  }
}


/** Multi-pane sash window: frame, glazing bars, sill. */
function sash(p: Painter, cx: number, top: number, w: number, h: number, cols: number, rows: number, frame = 0.96) {
  const x = Math.round(cx - w / 2);
  p.rect(x - 3, top - 3, w + 6, h + 6, frame, 0.5);
  p.pane(x, top, w, h, cols - 1, rows - 1, frame);
  p.rect(x - 5, top + h + 3, w + 10, 4, 0.92, 0.5);
}

/** Louvred timber shutter (fixed color, not tinted). */
function shutter(p: Painter, x: number, y: number, w: number, h: number, color: [number, number, number]) {
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const slat = j % 4 === 3 ? 0.7 : 1;
      p.px(x + i, y + j, color[0] * slat, color[1] * slat, color[2] * slat, 0.5);
    }
  p.rect(x, y, w, 1, 0.3, 0.5);
  p.rect(x, y + h - 1, w, 1, 0.3, 0.5);
  p.rect(x, y, 1, h, 0.3, 0.5);
  p.rect(x + w - 1, y, 1, h, 0.3, 0.5);
}

export const LAYERS: Record<string, LayerDef> = {
  /* Surfaces (tinted by vertex color) */
  brick: { m: [1.2, 1.2], paint: (p) => brickWall(p) },
  stone: { m: [2.4, 2.4], paint: (p) => stoneBlocks(p) },
  concrete: {
    m: [3, 3],
    paint: (p) => {
      p.noise(0, 0, p.S, p.S, 0.9, 0.08);
      p.rect(0, 0, p.S, 1, 0.74);
      p.rect(0, 0, 1, p.S, 0.74);
      for (const [x, y] of [[20, 20], [108, 20], [20, 108], [108, 108]]) p.rect(x, y, 2, 2, 0.7);
    },
  },
  stucco: { m: [2, 2], paint: (p) => stucco(p) },
  siding: {
    m: [1.6, 1.6],
    paint: (p) => {
      for (let y = 0; y < p.S; y += 12) {
        p.noise(0, y, p.S, 10, 0.97, 0.04);
        p.rect(0, y + 10, p.S, 2, 0.7);
      }
    },
  },
  metal: {
    m: [1.2, 1.2],
    paint: (p) => {
      for (let x = 0; x < p.S; x += 8) {
        p.rect(x, 0, 4, p.S, 0.98);
        p.rect(x + 4, 0, 3, p.S, 0.82);
        p.rect(x + 7, 0, 1, p.S, 0.7);
      }
    },
  },
  'roof-gravel': {
    m: [2.5, 2.5],
    paint: (p) => {
      p.noise(0, 0, p.S, p.S, 0.86, 0.22);
    },
  },
  'roof-tiles': {
    m: [1.6, 1.6],
    paint: (p) => {
      for (let row = 0; row < 8; row++)
        for (let k = -1; k < 9; k++) {
          const x = k * 16 + (row % 2 ? 8 : 0);
          p.noise(x, row * 16, 15, 14, 0.92 + p.rnd() * 0.1, 0.06);
          p.rect(x, row * 16 + 14, 15, 2, 0.55);
          p.rect(x + 15, row * 16, 1, 16, 0.65);
        }
    },
  },
  slate: {
    m: [1.6, 1.6],
    paint: (p) => {
      for (let row = 0; row < 8; row++)
        for (let k = -1; k < 6; k++) {
          const x = k * 24 + (row % 2 ? 12 : 0);
          p.noise(x, row * 16, 23, 15, 0.86 + p.rnd() * 0.12, 0.05);
          p.rect(x, row * 16 + 15, 24, 1, 0.5);
        }
    },
  },
  asphalt: {
    m: [5, 5],
    paint: (p) => {
      p.noise(0, 0, p.S, p.S, 0.95, 0.16);
      // A few softer patched seams and aggregate flecks
      for (let i = 0; i < 2; i++) {
        let x = p.rnd() * p.S;
        let y = p.rnd() * p.S;
        for (let k = 0; k < 40; k++) {
          p.rect(Math.floor(x) & 127, Math.floor(y) & 127, 1, 1, 0.82);
          x += p.rnd() * 1.6 - 0.3;
          y += p.rnd() * 1.4 - 0.7;
        }
      }
      for (let i = 0; i < 160; i++) {
        p.rect(Math.floor(p.rnd() * p.S), Math.floor(p.rnd() * p.S), 1, 1, 1.1);
      }
    },
  },
  sidewalk: {
    m: [3, 3],
    paint: (p) => {
      for (let j = 0; j < 4; j++)
        for (let i = 0; i < 4; i++) {
          p.noise(i * 32, j * 32, 31, 31, 0.94 + p.rnd() * 0.05, 0.05);
          p.rect(i * 32 + 31, j * 32, 1, 32, 0.72);
          p.rect(i * 32, j * 32 + 31, 32, 1, 0.72);
        }
    },
  },
  // ── City paving: every city's pavements are laid differently ──
  /** New York: big poured-concrete squares with dark joints, hairline cracks and gum. */
  'pave-nyc': {
    m: [3, 3],
    paint: (p) => {
      for (let j = 0; j < 2; j++)
        for (let i = 0; i < 2; i++) {
          p.noise(i * 64, j * 64, 63, 63, 0.9 + p.rnd() * 0.08, 0.07);
          p.rect(i * 64 + 63, j * 64, 1, 64, 0.55);
          p.rect(i * 64, j * 64 + 63, 64, 1, 0.55);
          // Hairline crack across some slabs
          if (p.rnd() < 0.6) {
            let x = i * 64 + 8 + p.rnd() * 48;
            let y = j * 64 + 2;
            for (let k = 0; k < 60; k++) {
              p.rect(Math.floor(x), Math.floor(y), 1, 1, 0.66);
              x += p.rnd() * 2 - 1;
              y += 1;
              if (y > j * 64 + 62) break;
            }
          }
        }
      for (let i = 0; i < 26; i++) p.rect(Math.floor(p.rnd() * p.S), Math.floor(p.rnd() * p.S), 2, 2, 0.62);
    },
  },
  /** London: York stone flags of mixed lengths in running courses, warm grey. */
  'pave-york': {
    m: [2.4, 2.4],
    paint: (p) => {
      p.rect(0, 0, p.S, p.S, 0.58);
      for (let y = 0; y < p.S; y += 32) {
        let x = Math.floor(p.rnd() * 30);
        while (x < p.S + 40) {
          const w = 30 + Math.floor(p.rnd() * 40);
          p.noise(x + 1, y + 1, w - 2, 30, 0.84 + p.rnd() * 0.12, 0.06);
          x += w;
        }
      }
    },
  },
  /** Hong Kong: red and grey interlocking pavers in a herringbone. */
  'pave-hk': {
    m: [1.6, 1.6],
    paint: (p) => {
      for (let y = 0; y < p.S; y++)
        for (let x = 0; x < p.S; x++) {
          const u = (x + y) % 32;
          const v = (x - y + 128) % 32;
          const horiz = Math.floor((x + y) / 16) % 2 === 0;
          const joint = horiz ? u % 16 === 0 || v % 8 === 0 : v % 16 === 0 || u % 8 === 0;
          const cell = Math.floor(x / 16) * 7 + Math.floor(y / 16) * 13;
          const red = ((cell * 2654435761) >>> 0) % 5 < 3;
          const n = 0.92 + ((((x * 73856093) ^ (y * 19349663)) >>> 0) % 100) / 900;
          if (joint) p.px(x, y, 0.34, 0.32, 0.3, 0.5);
          else if (red) p.px(x, y, 0.6 * n, 0.37 * n, 0.33 * n, 0.5);
          else p.px(x, y, 0.62 * n, 0.62 * n, 0.6 * n, 0.5);
        }
    },
  },
  /** San Francisco: pale concrete scored into small squares, with a brick-red border course. */
  'pave-sf': {
    m: [2, 2],
    paint: (p) => {
      p.noise(0, 0, p.S, p.S, 0.95, 0.06);
      for (let k = 0; k < p.S; k += 32) {
        p.rect(k, 0, 1, p.S, 0.7);
        p.rect(0, k, p.S, 1, 0.7);
      }
      for (let i = 0; i < 300; i++) p.rect(Math.floor(p.rnd() * p.S), Math.floor(p.rnd() * p.S), 1, 1, 0.8 + p.rnd() * 0.3);
    },
  },
  /** Singapore: terracotta tiles laid square with crisp pale joints. */
  'pave-sg': {
    m: [2, 2],
    paint: (p) => {
      for (let j = 0; j < 4; j++)
        for (let i = 0; i < 4; i++) {
          const k = 0.92 + p.rnd() * 0.08;
          for (let y = 1; y < 32; y++) for (let x = 1; x < 32; x++) p.px(i * 32 + x, j * 32 + y, 0.74 * k, 0.48 * k, 0.36 * k, 0.5);
          p.rect(i * 32, j * 32, 32, 1, 0.82, 0.5);
          p.rect(i * 32, j * 32, 1, 32, 0.82, 0.5);
        }
    },
  },
  /** Granite kerb stones with joints every metre. */
  kerb: {
    m: [1, 1],
    paint: (p) => {
      p.noise(0, 0, p.S, p.S, 0.86, 0.14);
      p.rect(0, 0, 2, p.S, 0.55);
      for (let i = 0; i < 400; i++) p.rect(Math.floor(p.rnd() * p.S), Math.floor(p.rnd() * p.S), 1, 1, p.rnd() < 0.5 ? 0.6 : 1.1);
    },
  },
  grass: {
    m: [3, 3],
    paint: (p) => {
      p.noise(0, 0, p.S, p.S, 0.9, 0.16);
      for (let i = 0; i < 700; i++) {
        const x = Math.floor(p.rnd() * p.S);
        const y = Math.floor(p.rnd() * p.S);
        p.rect(x, y, 1, 2, p.rnd() < 0.5 ? 1.12 : 0.72);
      }
    },
  },
  path: {
    m: [2, 2],
    paint: (p) => {
      p.noise(0, 0, p.S, p.S, 0.92, 0.14);
      for (let i = 0; i < 260; i++) {
        p.rect(Math.floor(p.rnd() * p.S), Math.floor(p.rnd() * p.S), 2, 2, 0.7 + p.rnd() * 0.5);
      }
    },
  },
  cobble: {
    m: [1.6, 1.6],
    paint: (p) => {
      p.rect(0, 0, p.S, p.S, 0.6);
      for (let row = 0; row < 8; row++)
        for (let k = -1; k < 9; k++) p.noise(k * 16 + (row % 2 ? 8 : 0) + 1, row * 16 + 1, 14, 14, 0.88 + p.rnd() * 0.14, 0.08);
    },
  },
  wood: {
    m: [2, 2],
    paint: (p) => {
      for (let y = 0; y < p.S; y += 16) {
        const b = 0.85 + p.rnd() * 0.12;
        for (let j = 0; j < 15; j++) for (let i = 0; i < p.S; i++) {
          p.rect(i, y + j, 1, 1, b + Math.sin(i * 0.15 + j * 0.9 + y) * 0.04 + (p.rnd() - 0.5) * 0.04);
        }
        p.rect(0, y + 15, p.S, 1, 0.55);
        p.rect(Math.floor(p.rnd() * p.S), y, 1, 15, 0.6);
      }
    },
  },
  marble: {
    m: [2.4, 2.4],
    paint: (p) => {
      p.noise(0, 0, p.S, p.S, 0.97, 0.035);
      // Soft, mostly diagonal veining
      for (let v = 0; v < 3; v++) {
        let x = p.rnd() * p.S;
        for (let y = 0; y < p.S; y++) {
          x += 0.35 + Math.sin(y * 0.05 + v * 2) * 0.35;
          p.rect(Math.floor(x) & 127, y, 1, 1, 0.9);
        }
      }
      // Slab joints
      p.rect(0, 0, p.S, 1, 0.86);
      p.rect(0, 0, 1, p.S, 0.86);
    },
  },
  leaves: {
    m: [1.4, 1.4],
    paint: (p) => {
      p.noise(0, 0, p.S, p.S, 0.78, 0.2);
      // Clusters of leaves with light tops and dark gaps
      for (let i = 0; i < 260; i++) {
        const x = Math.floor(p.rnd() * p.S);
        const y = Math.floor(p.rnd() * p.S);
        const v = 0.85 + p.rnd() * 0.35;
        p.rect(x, y, 3, 2, v);
        p.rect(x + 1, y + 2, 2, 1, v * 0.7);
      }
      for (let i = 0; i < 120; i++) p.rect(Math.floor(p.rnd() * p.S), Math.floor(p.rnd() * p.S), 2, 2, 0.45);
    },
  },
  bark: {
    m: [0.8, 1.6],
    paint: (p) => {
      for (let x = 0; x < p.S; x++) {
        const b = 0.78 + Math.sin(x * 0.7) * 0.08 + (p.rnd() - 0.5) * 0.1;
        for (let y = 0; y < p.S; y++) p.px(x, y, b + (p.rnd() - 0.5) * 0.08, b + (p.rnd() - 0.5) * 0.08, b + (p.rnd() - 0.5) * 0.08);
      }
      for (let i = 0; i < 40; i++) p.rect(Math.floor(p.rnd() * p.S), Math.floor(p.rnd() * p.S), 1, 6, 0.5);
    },
  },

  /* Facades: one tile = one window bay × one floor. Wall tinted, frames/panes not. */
  /* New York: brownstone, pre-war brick, cast-iron lofts */
  'fac-brownstone': {
    m: [2.6, 3.4],
    fit: true,
    paint: (p) => {
      stoneBlocks(p, 0, 0, p.S, p.S, 40, 12);
      p.rect(28, 14, 72, 10, 0.78); // heavy carved lintel
      p.rect(24, 12, 80, 3, 0.86);
      sash(p, 64, 28, 46, 70, 1, 2);
      p.rect(0, 120, p.S, 8, 0.82); // string course
    },
  },
  'fac-loft': {
    m: [4, 4.4],
    fit: true,
    paint: (p) => {
      p.noise(0, 0, p.S, p.S, 0.92, 0.05);
      // cast-iron pilasters with capitals
      for (const x of [0, 124]) {
        p.rect(x, 0, 4, p.S, 0.98);
        p.rect(x - 2, 6, 8, 4, 0.86);
      }
      p.rect(0, 116, p.S, 12, 0.86);
      p.rect(0, 114, p.S, 2, 1);
      // tall arched multi-pane window
      p.rect(14, 10, 100, 100, 0.84, 0.5);
      p.pane(18, 16, 92, 92, 2, 3, 0.86);
      for (let i = 0; i < 46; i++) p.rect(18 + i * 2, 14 - Math.round(Math.sin((i / 46) * Math.PI) * 4), 2, 3, 0.84, 0.5);
    },
  },
  /* London: Georgian stock brick, stucco ground floors, red-brick mansion blocks */
  'fac-georgian': {
    m: [3, 3.4],
    fit: true,
    paint: (p) => {
      brickWall(p, 0, 0, p.S, p.S, 20, 6);
      p.rect(34, 16, 60, 6, 0.95, 0.5); // gauged brick arch / white lintel
      sash(p, 64, 24, 52, 84, 3, 4, 0.98);
    },
  },
  'fac-rustic': {
    m: [3, 3.8],
    fit: true,
    paint: (p) => {
      p.noise(0, 0, p.S, p.S, 0.97, 0.03);
      for (let y = 8; y < p.S; y += 14) p.rect(0, y, p.S, 2, 0.78); // rusticated joints
      // arched ground-floor window
      p.rect(30, 24, 68, 84, 0.95, 0.5);
      p.pane(34, 34, 60, 72, 1, 2);
      for (let i = 0; i < 30; i++) p.rect(34 + i * 2, 30 - Math.round(Math.sin((i / 30) * Math.PI) * 6), 2, 4, 0.95, 0.5);
    },
  },
  'fac-mansion': {
    m: [3, 3.4],
    fit: true,
    paint: (p) => {
      brickWall(p, 0, 0, p.S, p.S, 22, 7);
      p.rect(0, 10, p.S, 6, 0.97, 0.5); // white stone band
      p.rect(0, 112, p.S, 6, 0.97, 0.5);
      sash(p, 64, 26, 44, 74, 2, 2, 0.98);
    },
  },
  /* San Francisco: painted Victorian clapboard with ornate trim */
  'fac-painted': {
    m: [2.2, 3.4],
    fit: true,
    paint: (p) => {
      for (let y = 0; y < p.S; y += 8) {
        p.noise(0, y, p.S, 6, 0.98, 0.03);
        p.rect(0, y + 6, p.S, 2, 0.78);
      }
      // corner boards & ornate window surround
      p.rect(0, 0, 6, p.S, 0.98, 0.5);
      p.rect(22, 8, 84, 10, 0.98, 0.5);
      for (let i = 0; i < 6; i++) p.rect(30 + i * 12, 4, 6, 4, 0.98, 0.5);
      sash(p, 64, 24, 40, 80, 1, 2, 0.98);
      p.rect(22, 110, 84, 6, 0.98, 0.5);
    },
  },
  /* Hong Kong: mosaic-tiled residential tower bays with AC units and balcony rails */
  'fac-resi': {
    m: [2.8, 2.8],
    fit: true,
    paint: (p) => {
      for (let y = 0; y < p.S; y += 4) for (let x = 0; x < p.S; x += 4) p.rect(x, y, 3, 3, 0.92 + ((x * 7 + y * 13) % 9) * 0.01);
      p.rect(0, 0, p.S, p.S, 0.92, 1);
      for (let y = 0; y < p.S; y += 4) for (let x = 0; x < p.S; x += 4) p.rect(x, y, 3, 3, 0.9 + ((x * 7 + y * 13) % 9) * 0.012);
      // grime streaks
      for (let i = 0; i < 5; i++) p.noise(10 + i * 25, 70, 2, 58, 0.72, 0.08);
      p.rect(10, 20, 50, 46, 0.86, 0.5);
      p.pane(12, 22, 46, 42, 1, 0);
      p.rect(70, 20, 48, 46, 0.86, 0.5);
      p.pane(72, 22, 44, 42, 1, 0);
      // AC unit
      p.rect(74, 74, 30, 22, 0.9, 0.5);
      for (let j = 77; j < 94; j += 3) p.rect(76, j, 26, 1, 0.62, 0.5);
      // balcony rail
      p.rect(8, 64, 54, 3, 0.55, 0.5);
      for (let x = 10; x < 60; x += 6) p.rect(x, 66, 1, 10, 0.55, 0.5);
    },
  },
  /* Singapore: HDB access corridors, Peranakan shophouse shutters, eco-tower planters */
  'fac-hdb': {
    m: [3, 2.9],
    fit: true,
    paint: (p) => {
      p.noise(0, 0, p.S, p.S, 0.98, 0.03);
      // corridor slot with parapet
      p.rect(0, 82, p.S, 30, 0.42, 0.5);
      p.rect(0, 100, p.S, 12, 0.99);
      p.rect(0, 98, p.S, 2, 0.8);
      sash(p, 40, 20, 40, 48, 2, 1, 0.97);
      sash(p, 98, 20, 30, 48, 1, 1, 0.97);
    },
  },
  'fac-shophouse': {
    m: [3.2, 3.4],
    fit: true,
    paint: (p) => {
      stucco(p);
      // pilasters & cornice moulding (white)
      p.rect(0, 0, 8, p.S, 0.99, 0.5);
      p.rect(120, 0, 8, p.S, 0.99, 0.5);
      p.rect(0, 0, p.S, 8, 0.99, 0.5);
      p.rect(0, 118, p.S, 10, 0.99, 0.5);
      // tall windows with green louvred shutters
      for (const cx of [42, 86]) {
        p.rect(cx - 13, 22, 26, 76, 0.96, 0.5);
        p.pane(cx - 10, 26, 20, 70, 1, 2);
        shutter(p, cx - 24, 24, 10, 72, [0.2, 0.48, 0.42]);
        shutter(p, cx + 14, 24, 10, 72, [0.2, 0.48, 0.42]);
      }
      // ceramic tile panel
      for (let x = 30; x < 98; x += 8) p.rect(x, 104, 6, 6, 0.75, 0.5);
    },
  },
  'fac-eco': {
    m: [3, 3.4],
    fit: true,
    paint: (p) => {
      p.pane(0, 0, p.S, 100, 1, 0);
      p.rect(0, 0, 3, p.S, 0.95);
      p.rect(0, 100, p.S, 28, 0.95);
      // planter box trailing greenery
      for (let x = 0; x < p.S; x++)
        for (let y = 96; y < 112; y++) {
          const g = 0.35 + p.rnd() * 0.3;
          if (p.rnd() < 0.8) p.px(x, y, g * 0.55, g, g * 0.45, 0.5);
        }
      for (let i = 0; i < 30; i++) p.rect(Math.floor(p.rnd() * p.S), 88 + Math.floor(p.rnd() * 8), 2, 4, 0.4, 0.5);
    },
  },
  'fac-brick': {
    m: [3, 3.2],
    fit: true,
    paint: (p) => {
      brickWall(p, 0, 0, p.S, p.S, 22, 7);
      classicWindow(p, 64, 30, 46, 62, { sash: true, lintel: 0.82 });
    },
  },
  'fac-stucco': {
    m: [3, 3.2],
    fit: true,
    paint: (p) => {
      stucco(p);
      p.rect(0, 122, p.S, 6, 0.86); // floor band
      classicWindow(p, 64, 32, 40, 58, { sash: true, shutters: true });
    },
  },
  'fac-office': {
    m: [3.2, 3.4],
    fit: true,
    paint: (p) => {
      p.noise(0, 0, p.S, p.S, 0.92, 0.06);
      p.rect(0, 0, p.S, 2, 0.75);
      p.rect(0, 0, 3, p.S, 0.8);
      p.rect(8, 22, 112, 64, 0.85, 0.5);
      p.pane(10, 24, 108, 60, 2, 0);
      p.rect(8, 88, 112, 3, 0.8, 0.5);
    },
  },
  'fac-glass': {
    m: [2.4, 3.4],
    fit: true,
    paint: (p) => {
      p.pane(0, 0, p.S, p.S, 1, 0);
      p.rect(0, 0, 4, p.S, 0.95); // mullion (tinted by wall color)
      p.rect(0, 100, p.S, 28, 0.95); // spandrel
      p.noise(0, 102, p.S, 26, 0.85, 0.05);
      p.rect(0, 100, p.S, 2, 1);
    },
  },
  'fac-stone': {
    m: [3.6, 4],
    fit: true,
    paint: (p) => {
      stoneBlocks(p, 0, 0, p.S, p.S, 42, 21);
      classicWindow(p, 64, 26, 40, 74, { sash: true, lintel: 0.98 });
      p.rect(58, 18, 12, 10, 1, 0.5); // keystone
    },
  },
  'fac-hk': {
    m: [2.6, 2.6],
    fit: true,
    paint: (p) => {
      p.noise(0, 0, p.S, p.S, 0.9, 0.12);
      // water stains
      for (let i = 0; i < 6; i++) {
        const x = Math.floor(p.rnd() * p.S);
        p.noise(x, 70, 3, 58, 0.72, 0.1);
      }
      p.rect(22, 26, 84, 50, 0.85, 0.5);
      p.pane(24, 28, 80, 46, 2, 0);
      {
        p.rect(84, 84, 30, 22, 0.9, 0.5); // AC unit
        p.rect(86, 86, 26, 18, 0.75, 0.5);
        for (let j = 88; j < 104; j += 3) p.rect(87, j, 24, 1, 0.6, 0.5);
      }
    },
  },
  'fac-siding': {
    m: [3, 3.2],
    fit: true,
    paint: (p) => {
      for (let y = 0; y < p.S; y += 11) {
        p.noise(0, y, p.S, 9, 0.98, 0.04);
        p.rect(0, y + 9, p.S, 2, 0.72);
      }
      classicWindow(p, 64, 28, 38, 64, { sash: true });
    },
  },
};

export const LAYER_NAMES = Object.keys(LAYERS);
export const LAYER_INDEX: Record<string, number> = Object.fromEntries(LAYER_NAMES.map((n, i) => [n, i]));

let atlas: THREE.DataArrayTexture | null = null;

/** Builds (once) the texture array for all layers. */
export function getAtlas(): THREE.DataArrayTexture {
  if (atlas) return atlas;
  const S = TEX_SIZE;
  const n = LAYER_NAMES.length;
  const data = new Uint8Array(S * S * 4 * n);
  const rgb = new Uint8ClampedArray(S * S * 4);
  const mask = new Uint8ClampedArray(S * S * 4);
  LAYER_NAMES.forEach((name, li) => {
    rgb.fill(0);
    mask.fill(255);
    LAYERS[name].paint(new Painter(rgb, mask, li * 131 + 7));
    const base = li * S * S * 4;
    for (let y = 0; y < S; y++) {
      // Flip so v = 0 is the bottom of the painted image (floor level for facades)
      const src = (S - 1 - y) * S * 4;
      const dst = base + y * S * 4;
      for (let x = 0; x < S * 4; x += 4) {
        data[dst + x] = rgb[src + x];
        data[dst + x + 1] = rgb[src + x + 1];
        data[dst + x + 2] = rgb[src + x + 2];
        data[dst + x + 3] = mask[src + x];
      }
    }
  });
  atlas = new THREE.DataArrayTexture(data, S, S, n);
  atlas.format = THREE.RGBAFormat;
  atlas.type = THREE.UnsignedByteType;
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.magFilter = THREE.NearestFilter;
  atlas.minFilter = THREE.LinearMipmapLinearFilter;
  atlas.wrapS = atlas.wrapT = THREE.RepeatWrapping;
  atlas.generateMipmaps = true;
  atlas.anisotropy = 4;
  atlas.needsUpdate = true;
  return atlas;
}

/** Uniforms shared by every world material (updated once per frame). */
export const worldUniforms = {
  uAtlas: { value: null as THREE.DataArrayTexture | null },
  uNight: { value: 0 },
  uTime: { value: 0 },
  /** Weathering strength (1 outdoors, lower indoors where surfaces are cleaned). */
  uGrime: { value: 1 },
  /** 0 dry … 1 soaked (rain darkens surfaces and fills puddles). */
  uWet: { value: 0 },
  /** 0 … 1 snow lying on upward-facing surfaces. */
  uSnow: { value: 0 },
  /** Wind strength for swaying foliage (stronger in storms). */
  uWind: { value: 1 },
  /** Sky colour reflected in puddles. */
  uSkyRefl: { value: new THREE.Color('#9fb8d0') },
};

/**
 * Patches a Lambert material so geometry with an `aTex` attribute samples the atlas.
 * Untextured geometry (aTex.z = 0) renders exactly as before.
 */
export function useAtlas<T extends THREE.MeshLambertMaterial>(mat: T, variant: 'surface' | 'ground' | 'foliage' | 'glass' | 'landmark' = 'surface'): T {
  const L = (n: string) => (LAYER_INDEX[n] + 1).toFixed(1);
  mat.onBeforeCompile = (shader) => {
    if (!worldUniforms.uAtlas.value) worldUniforms.uAtlas.value = getAtlas();
    Object.assign(shader.uniforms, worldUniforms);
    shader.defines = { ...shader.defines, ...(variant === 'ground' ? { FC_GROUND: '' } : variant === 'foliage' ? { FC_FOLIAGE: '' } : variant === 'glass' ? { FC_GLASS: '' } : variant === 'landmark' ? { FC_LANDMARK: '' } : {}), FC_ASPHALT: L('asphalt'), FC_SIDEWALK: L('sidewalk'), FC_COBBLE: L('cobble'), FC_PATH: L('path'), FC_GRASS: L('grass'), FC_PAVE0: L('pave-nyc'), FC_PAVE1: L('kerb') };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aTex;\nvarying vec3 vTex;\nvarying vec3 vWPos;\nvarying vec3 vWNorm;\nuniform float uTime;\nuniform float uWind;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vTex = aTex;
mat4 fcModel = modelMatrix;
#ifdef USE_INSTANCING
  fcModel = modelMatrix * instanceMatrix;
#endif
#ifdef FC_FOLIAGE
  // Trees sway as a whole and their leaves flutter; the higher up, the more they move
  vec3 fcRoot = fcModel[3].xyz;
  float fcH = max(position.y - 1.6, 0.0);
  float fcSway = sin(uTime * 1.1 + fcRoot.x * 0.21 + fcRoot.z * 0.17) * 0.6 + sin(uTime * 2.3 + fcRoot.z * 0.3) * 0.25;
  transformed.x += fcSway * fcH * 0.022 * uWind;
  transformed.z += cos(uTime * 0.9 + fcRoot.x * 0.13) * fcH * 0.014 * uWind;
  transformed += vec3(sin(uTime * 7.0 + position.x * 4.0 + position.y * 3.0), 0.0, cos(uTime * 6.0 + position.z * 4.0)) * 0.025 * step(1.8, position.y) * uWind;
#endif
vWPos = (fcModel * vec4(transformed, 1.0)).xyz;
vWNorm = normalize(mat3(fcModel) * objectNormal);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform highp sampler2DArray uAtlas;
uniform float uNight;
uniform float uTime;
uniform float uGrime;
uniform float uWet;
uniform float uSnow;
uniform vec3 uSkyRefl;
varying vec3 vTex;
varying vec3 vWPos;
varying vec3 vWNorm;
float fcHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float fcNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fcHash(i), fcHash(i + vec2(1.0, 0.0)), f.x), mix(fcHash(i + vec2(0.0, 1.0)), fcHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
bool fcIs(float layer) { return abs(vTex.z - layer) < 0.1; }
bool fcIsPave() { return vTex.z > FC_PAVE0 - 0.1 && vTex.z < FC_PAVE1 + 0.1; }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
// Real-world grade: pull saturated "toy" colors toward natural, slightly weathered tones
float fcLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
diffuseColor.rgb = mix(vec3(fcLum), diffuseColor.rgb, 0.8) * 0.97;
vec3 fcGlow = vec3(0.0);
if (vTex.z > 0.5) {
  vec4 t = texture(uAtlas, vec3(vTex.xy, vTex.z - 1.0));
  float tinted = smoothstep(0.7, 0.9, t.a);
  diffuseColor.rgb = mix(t.rgb, diffuseColor.rgb * t.rgb * 1.08, tinted);
  float pane = 1.0 - smoothstep(0.15, 0.35, t.a);
  if (pane > 0.01) {
    vec2 cell = floor(vTex.xy) + vTex.z * 17.0;
    float h = fcHash(cell);
    // Blinds / curtains: each window a slightly different brightness by day
    diffuseColor.rgb *= mix(1.0, 0.82 + 0.3 * h, pane);
    // Night: a changing pattern of lit windows (people coming and going)
    float slot = floor(uTime / 45.0 + h * 11.0);
    float lit = step(fcHash(cell + slot * 3.1), 0.58);
    vec3 warm = mix(vec3(1.0, 0.72, 0.38), vec3(0.62, 0.78, 1.0), step(0.82, h));
    fcGlow = warm * lit * uNight * pane * (0.42 + 0.18 * h);
    diffuseColor.rgb *= 1.0 - uNight * 0.55 * pane;
  }
}
// ── Weathering: nothing in a real city is spotless ──
vec3 fcN = normalize(vWNorm);
float fcVert = 1.0 - abs(fcN.y);
float fcUp = smoothstep(0.75, 0.95, fcN.y);
// Coordinate running along a wall (whichever horizontal axis the face spans)
float fcAlong = abs(fcN.x) > abs(fcN.z) ? vWPos.z : vWPos.x;
float fcDirt = 0.0;
bool fcPave = fcUp > 0.5 && (fcIs(FC_ASPHALT) || fcIs(FC_SIDEWALK) || fcIsPave() || fcIs(FC_COBBLE) || fcIs(FC_PATH) || fcIs(FC_GRASS));
#ifdef FC_GROUND
  fcPave = true;
#endif
if (uGrime < 0.001) {
} else if (!fcPave) {
  // Patchy staining at two scales
  float fcPatch = fcNoise(vWPos.xz * 0.07 + vWPos.y * 0.04) * 0.6 + fcNoise(vec2(fcAlong, vWPos.y) * 0.45) * 0.4;
  fcDirt += smoothstep(0.5, 0.95, fcPatch) * 0.13;
  // Rain streaks running down from ledges and sills
  float fcCol = floor(fcAlong * 2.2);
  float fcRun = fcNoise(vec2(fcCol * 1.7, vWPos.y * 0.3 + fcHash(vec2(fcCol, 1.0)) * 9.0));
  fcDirt += fcVert * step(0.6, fcHash(vec2(fcCol, 7.0))) * smoothstep(0.45, 0.85, fcRun) * 0.11;
  // Splash-back dirt at the foot of walls
  fcDirt += fcVert * (1.0 - smoothstep(0.05, 1.0, vWPos.y)) * step(0.02, vWPos.y) * 0.16;
  // Roofs: soot and moss patches
  fcDirt += fcUp * step(3.0, vWPos.y) * smoothstep(0.45, 0.9, fcNoise(vWPos.xz * 0.4)) * 0.14;
} else {
  vec2 fcP = vWPos.xz;
  if (fcIs(FC_ASPHALT)) {
    // Tar patches from old roadworks, rectangular and slightly darker
    vec2 fcCell = floor(fcP / vec2(5.0, 3.0));
    vec2 fcIn = fract(fcP / vec2(5.0, 3.0));
    float fcPatchOn = step(0.86, fcHash(fcCell * 1.3)) * step(0.12, fcIn.x) * step(fcIn.x, 0.88) * step(0.15, fcIn.y) * step(fcIn.y, 0.85);
    diffuseColor.rgb *= 1.0 - fcPatchOn * 0.22;
    // Hairline cracks
    float fcCr = abs(fcNoise(fcP * 0.55) - 0.5) + abs(fcNoise(fcP * 1.7 + 3.0) - 0.5) * 0.4;
    diffuseColor.rgb *= 1.0 - (1.0 - smoothstep(0.0, 0.018, fcCr)) * 0.35 * step(0.55, fcNoise(fcP * 0.12));
    // Oil drips down the middle of the lanes and tyre polish
    fcDirt += smoothstep(0.62, 0.9, fcNoise(fcP * vec2(0.9, 0.9))) * 0.12;
  } else if (fcIs(FC_SIDEWALK) || fcIsPave() || fcIs(FC_COBBLE) || fcIs(FC_PATH)) {
    // Gum spots and stains on paving
    vec2 fcG = floor(fcP * 3.0);
    fcDirt += step(0.985, fcHash(fcG)) * 0.35;
    fcDirt += smoothstep(0.55, 0.9, fcNoise(fcP * 0.3)) * 0.1;
  } else if (fcIs(FC_GRASS)) {
    // Worn, sun-bleached and lush patches
    float fcW = fcNoise(fcP * 0.18);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12, 1.05, 0.78), smoothstep(0.55, 0.85, fcW) * 0.5);
    diffuseColor.rgb *= 0.92 + 0.12 * fcNoise(fcP * 0.9);
  }
}
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.8, 0.76, 0.7), clamp(fcDirt * uGrime * 4.0, 0.0, 1.0) * 0.6) * (1.0 - clamp(fcDirt * uGrime, 0.0, 0.3) * 0.5);
#ifdef FC_GLASS
  // Dark glazing: reflects the sky by day. At street level these are shop windows: after dark
  // some shops stay open with lit displays, the rest roll their shutters down.
  vec3 fcVg = normalize(cameraPosition - vWPos);
  float fcFresG = pow(1.0 - abs(dot(fcVg, fcN)), 2.0);
  fcGlow += uSkyRefl * (0.06 + 0.22 * fcFresG) * (1.0 - uNight * 0.8) * fcVert;
  if (vWPos.y < 3.6 && fcVert > 0.8) {
    float fcShop = fcHash(vec2(floor(fcAlong / 3.2), floor(vWPos.y / 4.0) + 5.0));
    if (fcShop < 0.42) {
      // Open late: warm display lighting with shelves
      float fcShelf = step(0.75, fract(vWPos.y * 1.6)) * 0.25;
      fcGlow += vec3(1.0, 0.82, 0.58) * uNight * (0.55 - fcShelf) * smoothstep(0.1, 0.4, uNight);
    } else {
      // Roller shutter coming down from the top, ribbed galvanised steel
      float fcRoll = clamp(uNight * 1.6 - (fcShop - 0.42) * 0.8, 0.0, 1.0);
      float fcCover = step(3.35 - fcRoll * 3.2, vWPos.y);
      vec3 fcSteel = vec3(0.52, 0.54, 0.56) * (0.82 + 0.18 * step(0.5, fract(vWPos.y * 9.0)));
      diffuseColor.rgb = mix(diffuseColor.rgb, fcSteel, fcCover);
    }
  }
#endif
// ── Rain: wet surfaces darken; paving collects puddles that mirror the sky and street lights ──
if (uWet > 0.001) {
  diffuseColor.rgb *= 1.0 - uWet * (0.22 * fcUp + 0.1 * fcVert);
  if (fcPave && !fcIs(FC_GRASS)) {
    float fcPud = smoothstep(0.58, 0.68, fcNoise(vWPos.xz * 0.16) * 0.75 + fcNoise(vWPos.xz * 0.7) * 0.25) * uWet;
    vec3 fcV = normalize(cameraPosition - vWPos);
    float fcFres = pow(1.0 - clamp(fcV.y, 0.0, 1.0), 4.0);
    float fcSheen = (0.1 + 0.6 * fcFres) * (0.12 * uWet + fcPud * 0.7);
    diffuseColor.rgb *= 1.0 - fcPud * 0.5;
    fcGlow += uSkyRefl * fcSheen * (1.0 - uNight * 0.7) * 0.6;
    // At night the lamps and shop windows smear across the wet road
    float fcSmear = fcNoise(vec2(vWPos.x * 0.35, vWPos.z * 0.35)) * fcNoise(vWPos.xz * 2.0);
    fcGlow += vec3(1.0, 0.72, 0.42) * uNight * fcSheen * fcSmear * 0.9;
  }
}
// ── Snow settling on anything facing up ──
if (uSnow > 0.001) {
  float fcS = fcUp * smoothstep(0.3, 0.55, fcNoise(vWPos.xz * 0.9) * 0.35 + uSnow * 0.75);
  // Traffic keeps roads clear apart from grey slush along the kerbs
  if (fcIs(FC_ASPHALT)) fcS *= 0.22 * smoothstep(0.55, 0.8, fcNoise(vWPos.xz * 0.7));
  diffuseColor.rgb = mix(diffuseColor.rgb, fcIs(FC_ASPHALT) ? vec3(0.62, 0.63, 0.65) : vec3(0.93, 0.95, 0.98), fcS);
}`,
      )
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += fcGlow;\n#ifdef FC_LANDMARK\ntotalEmissiveRadiance += diffuseColor.rgb * 0.32;\n#endif');
  };
  mat.customProgramCacheKey = () => `fc-atlas-${variant}`;
  return mat;
}
