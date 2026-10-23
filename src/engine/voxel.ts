/**
 * VoxelBuilder merges many colored boxes (and any other geometry) into ONE BufferGeometry with
 * vertex colors. A whole city block becomes a single draw call. Bottom edges of vertical faces are
 * darkened slightly, cheap fake ambient occlusion that gives the soft, cozy look.
 */
import * as THREE from 'three';
import { LAYERS, LAYER_INDEX } from './atlas';

export type ColorLike = string | number | THREE.Color;

const FACES: { n: [number, number, number]; c: [number, number, number][] }[] = [
  { n: [1, 0, 0], c: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
  { n: [-1, 0, 0], c: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
  { n: [0, 1, 0], c: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
  { n: [0, -1, 0], c: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
  { n: [0, 0, 1], c: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
  { n: [0, 0, -1], c: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
];

const tmpColor = new THREE.Color();
const tmpV = new THREE.Vector3();
const tmpN = new THREE.Vector3();
const tmpM3 = new THREE.Matrix3();

export interface BoxOpts {
  rotY?: number;
  /** Darken bottom of side faces (fake AO). Default true. */
  ao?: boolean;
  skipBottom?: boolean;
  /** Multiply top face brightness (e.g. 1.08 for sunlit roofs). */
  topTint?: number;
  /** Atlas layer for the side faces (see engine/atlas.ts). */
  tex?: string;
  /** Atlas layer for the top face (defaults to `tex` for plain surfaces, none for facades). */
  topTex?: string;
  /** Top-face UVs from world x/z (seamless ground) instead of box-local. Default true. */
  worldTop?: boolean;
}

/** Resolves a layer name to (layer+1, metersU, metersV, fit). */
function layerInfo(name?: string): [number, number, number, boolean] {
  if (!name) return [0, 1, 1, false];
  const def = LAYERS[name];
  if (!def) return [0, 1, 1, false];
  return [LAYER_INDEX[name] + 1, def.m[0], def.m[1], !!def.fit];
}

export class VoxelBuilder {
  private pos: number[] = [];
  private nor: number[] = [];
  private col: number[] = [];
  private tex: number[] = [];
  private idx: number[] = [];
  private v = 0;

  get vertexCount() {
    return this.v;
  }

  /** Box by center. */
  box(cx: number, cy: number, cz: number, w: number, h: number, d: number, color: ColorLike, opts: BoxOpts = {}) {
    const { rotY = 0, ao = true, skipBottom = false, topTint = 1, tex, worldTop = true } = opts;
    tmpColor.set(color as THREE.ColorRepresentation);
    const r = tmpColor.r;
    const g = tmpColor.g;
    const b = tmpColor.b;
    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    const hw = w / 2;
    const hh = h / 2;
    const hd = d / 2;
    const side = layerInfo(tex);
    const topName = opts.topTex ?? (side[3] ? undefined : tex);
    const top = layerInfo(topName);
    for (let f = 0; f < 6; f++) {
      if (skipBottom && f === 3) continue;
      const face = FACES[f];
      const nx = face.n[0] * cos + face.n[2] * sin;
      const nz = -face.n[0] * sin + face.n[2] * cos;
      // Per-face texture layer and tile scale
      const L = f === 2 ? top : f === 3 ? [0, 1, 1, false] as const : side;
      const faceW = f === 0 || f === 1 ? d : w;
      let su = 1 / L[1];
      let sv = 1 / L[2];
      if (L[3] && f !== 2) {
        // Facades: whole bays across, whole floors up
        su = Math.max(1, Math.round(faceW / L[1])) / faceW;
        sv = Math.max(1, Math.round(h / L[2])) / h;
      }
      for (const c of face.c) {
        const lx = c[0] * hw;
        const ly = c[1] * hh;
        const lz = c[2] * hd;
        const wx = cx + lx * cos + lz * sin;
        const wz = cz - lx * sin + lz * cos;
        this.pos.push(wx, cy + ly, wz);
        this.nor.push(nx, face.n[1], nz);
        let shade = 1;
        if (f === 2) shade = topTint;
        else if (f === 3) shade = 0.6;
        else if (ao && c[1] < 0) shade = cy - hh < 0.05 ? 0.72 : 0.86;
        this.col.push(r * shade, g * shade, b * shade);
        if (L[0] === 0) this.tex.push(0, 0, 0);
        else if (f === 2) {
          if (worldTop) this.tex.push(wx * su, -wz * sv, L[0]);
          else this.tex.push((lx + hw) * su, (lz + hd) * sv, L[0]);
        } else {
          // u runs left→right as seen from outside the face, v from the bottom of the box
          const u = f === 0 ? hd - lz : f === 1 ? lz + hd : f === 4 ? lx + hw : hw - lx;
          this.tex.push(u * su, (ly + hh) * sv, L[0]);
        }
      }
      const v = this.v;
      this.idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
      this.v += 4;
    }
  }

  /** Box by min corner on the ground: x/z are center, y0 is the bottom. */
  block(cx: number, y0: number, cz: number, w: number, h: number, d: number, color: ColorLike, opts?: BoxOpts) {
    this.box(cx, y0 + h / 2, cz, w, h, d, color, opts);
  }

  /**
   * Add any three.js geometry (cylinder, cone, sphere…) with a transform. With `tex`, UVs are
   * projected from world space along the dominant normal axis (good for domes, barrel roofs, pillars).
   */
  geom(g: THREE.BufferGeometry, m: THREE.Matrix4, color: ColorLike | null, tex?: string) {
    // color = null keeps the source geometry's own vertex colors
    const src = color === null ? g.getAttribute('color') : null;
    if (color !== null) tmpColor.set(color as THREE.ColorRepresentation);
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const [layer, mu, mv] = layerInfo(tex);
    tmpM3.getNormalMatrix(m);
    const base = this.v;
    for (let i = 0; i < p.count; i++) {
      tmpV.fromBufferAttribute(p, i).applyMatrix4(m);
      this.pos.push(tmpV.x, tmpV.y, tmpV.z);
      if (n) {
        tmpN.fromBufferAttribute(n, i).applyMatrix3(tmpM3).normalize();
        this.nor.push(tmpN.x, tmpN.y, tmpN.z);
      } else {
        tmpN.set(0, 1, 0);
        this.nor.push(0, 1, 0);
      }
      if (src) this.col.push(src.getX(i), src.getY(i), src.getZ(i));
      else this.col.push(tmpColor.r, tmpColor.g, tmpColor.b);
      if (!layer) this.tex.push(0, 0, 0);
      else {
        const ax = Math.abs(tmpN.x);
        const ay = Math.abs(tmpN.y);
        const az = Math.abs(tmpN.z);
        if (ay >= ax && ay >= az) this.tex.push(tmpV.x / mu, tmpV.z / mv, layer);
        else if (ax >= az) this.tex.push(tmpV.z / mu, tmpV.y / mv, layer);
        else this.tex.push(tmpV.x / mu, tmpV.y / mv, layer);
      }
    }
    const index = g.getIndex();
    if (index) for (let i = 0; i < index.count; i++) this.idx.push(base + index.getX(i));
    else for (let i = 0; i < p.count; i++) this.idx.push(base + i);
    this.v += p.count;
  }

  merge(other: VoxelBuilder) {
    const base = this.v;
    this.pos.push(...other.pos);
    this.nor.push(...other.nor);
    this.col.push(...other.col);
    this.tex.push(...other.tex);
    for (const i of other.idx) this.idx.push(base + i);
    this.v += other.v;
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aTex', new THREE.Float32BufferAttribute(this.tex, 3));
    g.setIndex(this.v > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/* Shared helpers for common shapes */
const cylCache = new Map<string, THREE.BufferGeometry>();
export function cylinder(rt: number, rb: number, h: number, seg = 8): THREE.BufferGeometry {
  const key = `${rt}|${rb}|${h}|${seg}`;
  let g = cylCache.get(key);
  if (!g) {
    g = new THREE.CylinderGeometry(rt, rb, h, seg);
    cylCache.set(key, g);
  }
  return g;
}
const sphCache = new Map<string, THREE.BufferGeometry>();
export function sphere(r: number, w = 8, h = 6): THREE.BufferGeometry {
  const key = `${r}|${w}|${h}`;
  let g = sphCache.get(key);
  if (!g) {
    g = new THREE.SphereGeometry(r, w, h);
    sphCache.set(key, g);
  }
  return g;
}

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const s = new THREE.Vector3();
const t = new THREE.Vector3();
export function trs(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): THREE.Matrix4 {
  return m4.compose(t.set(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), s.set(sx, sy, sz));
}

/** Canvas texture helper for signs/labels using the bundled Nunito font. */
export function labelTexture(
  text: string,
  opts: { bg?: string; fg?: string; w?: number; h?: number; font?: string; border?: string; icon?: string } = {},
): THREE.CanvasTexture {
  const { bg = '#1e2840', fg = '#ffffff', w = 512, h = 128, font = '900 64px Nunito, sans-serif', border, icon } = opts;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  const r = Math.min(28, h / 4);
  g.beginPath();
  g.roundRect(4, 4, w - 8, h - 8, r);
  g.fill();
  if (border) {
    g.lineWidth = 8;
    g.strokeStyle = border;
    g.stroke();
  }
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = parseInt(font.match(/(\d+)px/)?.[1] ?? '64', 10);
  const label = icon ? `${icon} ${text}` : text;
  g.font = font;
  while (g.measureText(label).width > w - 40 && size > 14) {
    size -= 2;
    g.font = font.replace(/\d+px/, `${size}px`);
  }
  g.fillText(label, w / 2, h / 2 + 3);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
