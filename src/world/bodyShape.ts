/**
 * Character body shapes: softer than boxes, still stylised.
 *
 * Every part is a "soft tube": a stack of rounded-square cross sections (a superellipse, between a
 * square and a circle) that can widen and narrow along its length, closed with domed caps. That gives
 * a chest wider than the waist, sloped shoulders, arms and legs that taper, sleeves that flare at the
 * opening, and fabric that bunches at elbows and knees, while keeping the chunky, readable look.
 *
 * Shared by the full Avatar, LitePerson (merged background people) and the instanced street crowds,
 * so everyone in the world has the same build.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface Ring {
  /** Height of this cross section. */
  y: number;
  /** Width (x) and depth (z) of the cross section. */
  w: number;
  d: number;
  /** Shift forward or sideways (a chest that pushes forward, a thumb that sits to one side). */
  dz?: number;
  dx?: number;
}

export interface TubeOpts {
  /** Squareness: 2 is round, 4 is close to a box. */
  n?: number;
  seg?: number;
  /** Dome heights closing the top and bottom (0 = flat). */
  capTop?: number;
  capBottom?: number;
  /** Texture repeats around the tube (4 matches a box's four sides). */
  uScale?: number;
}

const spow = (v: number, e: number) => Math.sign(v) * Math.pow(Math.abs(v), e);

/** Build a soft tube through `rings` (listed bottom to top). */
export function tube(rings: Ring[], o: TubeOpts = {}): THREE.BufferGeometry {
  const n = o.n ?? 3;
  const seg = o.seg ?? 16;
  const uScale = o.uScale ?? 4;
  const all: Ring[] = [];
  const K = 3;
  const first = rings[0];
  const last = rings[rings.length - 1];
  if (o.capBottom)
    for (let k = K; k >= 1; k--) {
      const a = (k / (K + 1)) * (Math.PI / 2);
      all.push({ ...first, y: first.y - o.capBottom * Math.sin(a), w: first.w * Math.cos(a), d: first.d * Math.cos(a) });
    }
  all.push(...rings);
  if (o.capTop)
    for (let k = 1; k <= K; k++) {
      const a = (k / (K + 1)) * (Math.PI / 2);
      all.push({ ...last, y: last.y + o.capTop * Math.sin(a), w: last.w * Math.cos(a), d: last.d * Math.cos(a) });
    }

  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const y0 = all[0].y;
  const y1 = all[all.length - 1].y;
  const e = 2 / n;
  for (let r = 0; r < all.length; r++) {
    const R = all[r];
    for (let i = 0; i <= seg; i++) {
      // Start at the back so the texture seam is out of sight
      const th = -Math.PI / 2 + (i / seg) * Math.PI * 2;
      pos.push((R.dx ?? 0) + (R.w / 2) * spow(Math.cos(th), e), R.y, (R.dz ?? 0) + (R.d / 2) * spow(Math.sin(th), e));
      uv.push((i / seg) * uScale, (R.y - y0) / Math.max(0.001, y1 - y0));
    }
  }
  const row = seg + 1;
  for (let r = 0; r < all.length - 1; r++)
    for (let i = 0; i < seg; i++) {
      const a = r * row + i;
      const b = a + row;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  // Close both ends with a centre point
  const capEnd = (r: number, up: boolean) => {
    const R = all[r];
    const c = pos.length / 3;
    pos.push(R.dx ?? 0, R.y + (up ? 0.001 : -0.001), R.dz ?? 0);
    uv.push(0.5, up ? 1 : 0);
    for (let i = 0; i < seg; i++) {
      const a = r * row + i;
      if (up) idx.push(a, c, a + 1);
      else idx.push(a, a + 1, c);
    }
  };
  capEnd(0, false);
  capEnd(all.length - 1, true);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Smooth across the seam (first and last column share a position)
  const nrm = g.getAttribute('normal') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let r = 0; r < all.length; r++) {
    const a = r * row;
    const b = a + seg;
    v.set(nrm.getX(a) + nrm.getX(b), nrm.getY(a) + nrm.getY(b), nrm.getZ(a) + nrm.getZ(b)).normalize();
    nrm.setXYZ(a, v.x, v.y, v.z);
    nrm.setXYZ(b, v.x, v.y, v.z);
  }
  return g;
}

const cache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry) {
  let g = cache.get(key);
  if (!g) {
    g = make();
    cache.set(key, g);
  }
  return g;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Torso profile, bottom to top: [height 0..1, width, depth] as fractions of the torso's size. Hips, a
 * nipped-in waist, a fuller chest and shoulders. Most of the waist comes in at the back (the small of
 * the back), so the front stays nearly flat and shirt fronts, zips and lapels sit right on it.
 */
const TORSO_M: [number, number, number][] = [
  [0, 0.93, 0.9],
  [0.18, 0.92, 0.88],
  [0.36, 0.89, 0.88],
  [0.55, 0.95, 0.96],
  [0.7, 0.99, 1.0],
  [0.86, 1.0, 0.98],
  [0.95, 0.96, 0.92],
];
const TORSO_F: [number, number, number][] = [
  [0, 0.95, 0.9],
  [0.18, 0.88, 0.86],
  [0.36, 0.84, 0.86],
  [0.55, 0.93, 0.96],
  [0.7, 0.97, 1.04],
  [0.86, 0.98, 0.98],
  [0.95, 0.94, 0.92],
];

function torsoRing(k: number, w: number, h: number, d: number, female: boolean, grow: number): Ring {
  const P = female ? TORSO_F : TORSO_M;
  let i = 0;
  while (i < P.length - 2 && k > P[i + 1][0]) i++;
  const [k0, w0, d0] = P[i];
  const [k1, w1, d1] = P[i + 1];
  const t = Math.min(1, Math.max(0, (k - k0) / (k1 - k0)));
  const wf = lerp(w0, w1, t);
  const df = lerp(d0, d1, t);
  // Bust: a little forward push around the chest line on the female build
  const bust = female ? 0.012 * Math.exp(-Math.pow((k - 0.7) / 0.12, 2)) : 0;
  const front = d / 2 - (1 - df) * d * 0.15 + bust;
  return { y: -h / 2 + k * h, w: w * wf * grow, d: d * df * grow, dz: (front - (d * df) / 2) * grow };
}

/** Torso centred on the origin. `grow` makes a looser shell over it (a puffer, a vest). */
export function torsoGeo(w = 0.66, h = 0.68, d = 0.38, female = false, grow = 1, seg = 20) {
  return cached(`torso|${w}|${h}|${d}|${female}|${grow}|${seg}`, () =>
    tube(
      (female ? TORSO_F : TORSO_M).map(([k]) => torsoRing(k, w, h, d, female, grow)),
      { n: 3.2, seg, capTop: 0.09 * grow, capBottom: 0.02 },
    ),
  );
}

/**
 * A band that wraps the torso between two heights (torso-local, centred like torsoGeo), standing
 * `grow` proud of it: hems, belts, waistbands, quilting, stripes.
 */
export function torsoBand(y0: number, y1: number, grow = 1.04, female = false, w = 0.66, h = 0.68, d = 0.38) {
  return cached(`tband|${y0}|${y1}|${grow}|${female}|${w}|${h}|${d}`, () => {
    const k = (y: number) => (y + h / 2) / h;
    const ring = (y: number, g: number) => torsoRing(Math.min(1, Math.max(0, k(y))), w, h, d, female, g);
    const e = Math.min(0.012, (y1 - y0) * 0.2);
    return tube(
      [
        { ...ring(y0, grow * 0.985), y: y0 },
        { ...ring(y0 + e, grow), y: y0 + e },
        { ...ring(y1 - e, grow), y: y1 - e },
        { ...ring(y1, grow * 0.985), y: y1 },
      ],
      { n: 3.2, seg: 20, uScale: 4 },
    );
  });
}

export interface LimbOpts {
  /** Folds that bunch the fabric: where along the limb (0 top, 1 bottom) and how much. */
  folds?: { t: number; amp: number }[];
  /** Widen the last part (a sleeve or trouser opening). */
  flare?: number;
  /** Round the top (a shoulder) and bottom. */
  capTop?: number;
  capBottom?: number;
  /** Lean the bottom forward (a forearm that hangs slightly forward). */
  sweep?: number;
  n?: number;
  rings?: number;
  /** Points around each ring (fewer for crowds). */
  seg?: number;
}

/**
 * A limb or sleeve hanging from its pivot: top at y = `top`, `len` long, tapering from
 * `wTop`×`dTop` to `wBot`×`dBot`.
 */
export function limbGeo(top: number, len: number, wTop: number, dTop: number, wBot: number, dBot: number, o: LimbOpts = {}) {
  const key = `limb|${top}|${len}|${wTop}|${dTop}|${wBot}|${dBot}|${JSON.stringify(o)}`;
  return cached(key, () => {
    const R = o.rings ?? 10;
    const rings: Ring[] = [];
    for (let i = R; i >= 0; i--) {
      const t = i / R; // 0 at the top, 1 at the bottom
      let s = 1;
      for (const f of o.folds ?? []) s += f.amp * Math.exp(-Math.pow((t - f.t) / 0.045, 2));
      if (o.flare && t > 0.8) s *= 1 + o.flare * ((t - 0.8) / 0.2);
      rings.push({ y: top - t * len, w: lerp(wTop, wBot, t) * s, d: lerp(dTop, dBot, t) * s, dz: (o.sweep ?? 0) * t * t });
    }
    return tube(rings, { n: o.n ?? 2.8, seg: o.seg ?? 14, capTop: o.capTop ?? 0, capBottom: o.capBottom ?? 0 });
  });
}

/** Squareness of the head: rounder than a cube, still clearly not an egg. */
const HEAD_N = 3;

/** Head, base at y = 0 and `s` tall: a softened cube with a slightly narrower jaw and a rounded crown. */
export function headGeo(s = 0.62, d = 0.6, seg = 20) {
  return cached(`head|${s}|${d}|${seg}`, () =>
    tube(
      [
        { y: 0.0, w: s * 0.76, d: d * 0.9 },
        { y: s * 0.12, w: s * 0.86, d: d * 0.97 },
        { y: s * 0.3, w: s * 0.96, d },
        { y: s * 0.5, w: s, d },
        { y: s * 0.78, w: s, d },
        { y: s * 0.88, w: s * 0.97, d: d * 0.97 },
      ],
      { n: HEAD_N, seg, capTop: s * 0.1, capBottom: s * 0.03 },
    ),
  );
}

/**
 * A mitten hand with a thumb, centred on the origin. `side` +1 is the character's left hand (on +x),
 * whose thumb sits toward the body (-x) and forward.
 */
export function handGeo(w = 0.2, h = 0.17, d = 0.21, side: 1 | -1 = 1) {
  return cached(`hand|${w}|${h}|${d}|${side}`, () => {
    const palm = tube(
      [
        { y: -h / 2, w: w * 0.82, d: d * 0.8 },
        { y: -h * 0.1, w: w, d: d * 0.95 },
        { y: h / 2, w: w * 0.92, d },
      ],
      { n: 3, seg: 12, capTop: 0.02, capBottom: 0.05 },
    );
    const thumb = tube(
      [
        { y: -h * 0.3, w: w * 0.3, d: d * 0.32, dx: -side * w * 0.36, dz: d * 0.32 },
        { y: h * 0.2, w: w * 0.36, d: d * 0.38, dx: -side * w * 0.3, dz: d * 0.24 },
      ],
      { n: 2.6, seg: 8, capTop: 0.02, capBottom: 0.04 },
    );
    return mergeGeometries([palm, thumb])!;
  });
}

/** A flat ring (collar, cuff, hem band) around the y axis at height `y`. */
export function bandGeo(y: number, h: number, w: number, d: number, n = 3) {
  return cached(`band|${y}|${h}|${w}|${d}|${n}`, () =>
    tube(
      [
        { y: y - h / 2, w: w * 0.98, d: d * 0.98 },
        { y, w, d },
        { y: y + h / 2, w: w * 0.98, d: d * 0.98 },
      ],
      { n, seg: 18 },
    ),
  );
}

/** The head's outline at height y (head base at 0), matching headGeo(0.62, 0.6). */
const HEAD_S = 0.62;
const HEAD_D = 0.6;
const HEAD_RINGS: [number, number, number][] = [
  [0, 0.76, 0.9],
  [0.12, 0.86, 0.97],
  [0.3, 0.96, 1],
  [0.5, 1, 1],
  [0.78, 1, 1],
  [0.88, 0.97, 0.97],
];
function headAt(y: number): [number, number] {
  const k = y / HEAD_S;
  const top = HEAD_RINGS[HEAD_RINGS.length - 1];
  if (k >= top[0]) {
    // The domed crown
    const cap = HEAD_S * 0.1;
    const a = Math.asin(Math.min(1, (y - top[0] * HEAD_S) / cap));
    return [top[1] * HEAD_S * Math.cos(a), top[2] * HEAD_D * Math.cos(a)];
  }
  let i = 0;
  while (i < HEAD_RINGS.length - 2 && k > HEAD_RINGS[i + 1][0]) i++;
  const [k0, w0, d0] = HEAD_RINGS[i];
  const [k1, w1, d1] = HEAD_RINGS[i + 1];
  const t = Math.min(1, Math.max(0, (k - k0) / (k1 - k0)));
  return [lerp(w0, w1, t) * HEAD_S, lerp(d0, d1, t) * HEAD_D];
}
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Hair that hugs the head: a shell over the rounded head, standing `grow` proud of it, with a
 * hairline at `front` over the forehead, `side` over the ears and `back` at the nape (head-local
 * heights, head base 0, eyes ≈ 0.35, crown ≈ 0.61). `lift` adds volume on top. The lower edge tucks
 * in to the scalp so there is no gap to see through.
 */
export function hairShellGeo(front: number, side: number, back: number, grow = 1.07, lift = 0.06, seg = 24) {
  return cached(`hair|${front}|${side}|${back}|${grow}|${lift}|${seg}`, () => {
    const crown = HEAD_S * 0.88 + HEAD_S * 0.1;
    const R = 9;
    const e = 2 / HEAD_N;
    const pos: number[] = [];
    const idx: number[] = [];
    const rows = R + 2;
    for (let i = 0; i <= seg; i++) {
      const th = -Math.PI / 2 + (i / seg) * Math.PI * 2;
      const c = Math.cos(th);
      const s = Math.sin(th);
      const ac = Math.abs(c);
      // Hairline for this direction: forehead in front, ears at the sides, nape at the back
      const line = s >= 0 ? lerp(front, side, smooth(0.72, 0.97, ac)) : lerp(back, side, smooth(0.3, 0.95, ac));
      for (let j = 0; j < rows; j++) {
        // Row 0 tucks against the scalp, row 1 is the hair's lower edge, then up to the crown
        const t = j === 0 ? 0 : (j - 1) / R;
        const y = j === 0 ? line : lerp(line + 0.012, crown, t * t * (3 - 2 * t) * 0.5 + t * 0.5);
        const [w, d] = headAt(Math.min(crown, y));
        const g = j === 0 ? 1.0 : grow;
        const up = j === 0 ? 0 : lift * smooth(0.4, crown, y);
        pos.push((w / 2) * g * Math.sign(c) * Math.pow(ac, e), y + up, (d / 2) * g * Math.sign(s) * Math.pow(Math.abs(s), e));
      }
    }
    for (let i = 0; i < seg; i++)
      for (let j = 0; j < rows - 1; j++) {
        const a = i * rows + j;
        const b = a + rows;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  });
}
