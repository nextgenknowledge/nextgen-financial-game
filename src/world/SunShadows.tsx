'use client';
/**
 * Sun shadows without a shadow map, for the Low graphics setting (school Chromebooks).
 *
 * Buildings, trees and cars are drawn a second time, flattened onto the ground along the sun's
 * direction by a tiny vertex shader. It costs a fraction of real shadow mapping: no extra render
 * pass, no shadow texture and nothing added to the lighting of every other pixel. The stencil
 * buffer makes sure overlapping shadows darken the ground only once.
 *
 * Medium and High use real shadow maps instead, so none of this is drawn there.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { rt } from '@/engine/runtime';
import { useSettings } from '@/store/settings';

/** Height of the plane shadows land on: just above the pavements (0.16), so they show on roads, grass and paving. */
const PLANE = 0.19;
/** Longest a shadow gets, as a multiple of the caster's height (keeps sunrise and sunset shadows sensible). */
const MAX_REACH = 1.7;
/** How dark a shadow is at midday in clear weather. */
const STRENGTH = 0.36;

const uniforms = {
  ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
  /** Ground offset (x, z) per metre of height. */
  uReach: { value: new THREE.Vector2(0.4, 0.3) },
  uPlane: { value: PLANE },
  uStrength: { value: 0 },
};

export const sunShadowMaterial = new THREE.ShaderMaterial({
  uniforms,
  fog: true,
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -2,
  // Each pixel takes one layer of shadow, however many casters overlap there
  stencilWrite: true,
  stencilRef: 1,
  stencilFunc: THREE.NotEqualStencilFunc,
  stencilFail: THREE.KeepStencilOp,
  stencilZFail: THREE.KeepStencilOp,
  stencilZPass: THREE.ReplaceStencilOp,
  vertexShader: /* glsl */ `
uniform vec2 uReach; uniform float uPlane;
varying float vDepth;
void main() {
  vec4 wp = vec4(position, 1.0);
  #ifdef USE_INSTANCING
    wp = instanceMatrix * wp;
  #endif
  wp = modelMatrix * wp;
  float h = max(wp.y - uPlane, 0.0);
  wp.xz -= uReach * h;
  wp.y = uPlane;
  vec4 mv = viewMatrix * wp;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`,
  fragmentShader: /* glsl */ `
uniform float uStrength; uniform float fogNear; uniform float fogFar;
varying float vDepth;
void main() {
  // Fade with the distance haze so far-off shadows don't cut dark shapes into the fog
  float haze = smoothstep(fogNear, fogFar, vDepth);
  gl_FragColor = vec4(0.03, 0.05, 0.12, uStrength * (1.0 - haze));
}`,
});

/** True when the cheap projected shadows should be drawn (Low graphics; the others have real ones). */
export function useSunShadows(): boolean {
  return useSettings((s) => s.quality) === 'low';
}

/** Points the shadows away from the sun and fades them at dusk, at night and under heavy cloud. Call once per frame. */
export function updateSunShadows() {
  const d = rt.sunDir;
  const flat = Math.hypot(d.x, d.z) || 1;
  const reach = Math.min(MAX_REACH, flat / Math.max(d.y, 0.05));
  uniforms.uReach.value.set((d.x / flat) * reach, (d.z / flat) * reach);
  uniforms.uStrength.value = STRENGTH * rt.sunShadow;
}

/** Most triangles a city's shadow mesh may have; past this, the smallest details stop casting. */
const CASTER_BUDGET = 45_000;

/**
 * The parts of a merged scene mesh that matter for its shadow, positions only:
 * - nothing low (pavements, kerbs and road markings would shade themselves),
 * - no tiny details (window sills and door handles don't change a building's outline),
 * - no faces that can never be sunlit (undersides, and north walls: the sun stays in the south).
 * West-facing and east-facing walls are kept in separate runs, so each frame only the run facing
 * the sun is drawn (`userData.runs`), about half the triangles.
 */
export function casterGeometry(src: THREE.BufferGeometry, minTop = 0.7): THREE.BufferGeometry {
  const pos = src.getAttribute('position');
  const index = src.getIndex();
  const n = index ? index.count : pos.count;
  type Tri = { v: number[]; area: number };
  const runs: Tri[][] = [[], [], []]; // facing -x, facing up or south, facing +x
  for (let i = 0; i < n; i += 3) {
    const ids = index ? [index.getX(i), index.getX(i + 1), index.getX(i + 2)] : [i, i + 1, i + 2];
    const v = ids.flatMap((k) => [pos.getX(k), pos.getY(k), pos.getZ(k)]);
    if (Math.max(v[1], v[4], v[7]) < minTop) continue;
    const ux = v[3] - v[0], uy = v[4] - v[1], uz = v[5] - v[2];
    const wx = v[6] - v[0], wy = v[7] - v[1], wz = v[8] - v[2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-9) continue;
    nx /= len; ny /= len; nz /= len;
    const run = nx < -0.3 ? 0 : nx > 0.3 ? 2 : ny > 0.1 || nz > 0.1 ? 1 : -1;
    if (run < 0) continue;
    runs[run].push({ v, area: len / 2 });
  }
  // Drop small details until the mesh fits the budget
  let minArea = 0.02;
  const count = () => runs.reduce((s, r) => s + r.filter((t) => t.area >= minArea).length, 0);
  while (count() > CASTER_BUDGET && minArea < 4) minArea *= 1.6;
  const out: number[] = [];
  const sizes = runs.map((r) => {
    const keep = r.filter((t) => t.area >= minArea);
    for (const t of keep) out.push(...t.v);
    return keep.length * 3;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  geo.userData.runs = sizes;
  return geo;
}

const proxies = new WeakMap<THREE.BufferGeometry, Map<number, THREE.BufferGeometry>>();
/**
 * A stand-in for a detailed model, for shadows only: a stack of `slabs` boxes that follows the
 * model's outline at each height. A tree becomes five boxes instead of hundreds of leaves, and
 * its shadow looks the same on the ground.
 */
export function shadowProxy(src: THREE.BufferGeometry, slabs = 1): THREE.BufferGeometry {
  let byN = proxies.get(src);
  if (!byN) proxies.set(src, (byN = new Map()));
  const hit = byN.get(slabs);
  if (hit) return hit;
  src.computeBoundingBox();
  const bb = src.boundingBox!;
  const h = Math.max(1e-3, bb.max.y - bb.min.y);
  const box = Array.from({ length: slabs }, () => ({ x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity }));
  const pos = src.getAttribute('position');
  const index = src.getIndex();
  const n = index ? index.count : pos.count;
  for (let i = 0; i < n; i += 3) {
    const ids = index ? [index.getX(i), index.getX(i + 1), index.getX(i + 2)] : [i, i + 1, i + 2];
    const ys = ids.map((k) => pos.getY(k));
    const lo = Math.max(0, Math.min(slabs - 1, Math.floor(((Math.min(...ys) - bb.min.y) / h) * slabs + 1e-4)));
    const hi = Math.max(0, Math.min(slabs - 1, Math.ceil(((Math.max(...ys) - bb.min.y) / h) * slabs - 1e-4) - 1));
    for (let sI = lo; sI <= Math.max(lo, hi); sI++)
      for (const k of ids) {
        const b = box[sI];
        b.x0 = Math.min(b.x0, pos.getX(k));
        b.x1 = Math.max(b.x1, pos.getX(k));
        b.z0 = Math.min(b.z0, pos.getZ(k));
        b.z1 = Math.max(b.z1, pos.getZ(k));
      }
  }
  const out: number[] = [];
  box.forEach((b, sI) => {
    if (!isFinite(b.x0)) return;
    const y0 = bb.min.y + (h * sI) / slabs;
    const y1 = bb.min.y + (h * (sI + 1)) / slabs;
    const g = new THREE.BoxGeometry(Math.max(0.02, b.x1 - b.x0), y1 - y0, Math.max(0.02, b.z1 - b.z0)).translate((b.x0 + b.x1) / 2, (y0 + y1) / 2, (b.z0 + b.z1) / 2).toNonIndexed();
    out.push(...(g.getAttribute('position').array as Float32Array));
    g.dispose();
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  byN.set(slabs, geo);
  return geo;
}

const thinned = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
/** A model without its smallest faces, for shadows of open shapes like leafless trees: trunk and main limbs only. */
export function thinGeometry(src: THREE.BufferGeometry, minArea: number): THREE.BufferGeometry {
  const hit = thinned.get(src);
  if (hit) return hit;
  const pos = src.getAttribute('position');
  const index = src.getIndex();
  const n = index ? index.count : pos.count;
  const out: number[] = [];
  for (let i = 0; i < n; i += 3) {
    const ids = index ? [index.getX(i), index.getX(i + 1), index.getX(i + 2)] : [i, i + 1, i + 2];
    const v = ids.flatMap((k) => [pos.getX(k), pos.getY(k), pos.getZ(k)]);
    const ux = v[3] - v[0], uy = v[4] - v[1], uz = v[5] - v[2];
    const wx = v[6] - v[0], wy = v[7] - v[1], wz = v[8] - v[2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    // Sideways faces looking south are enough for the outline (the sun never shines from the north)
    if (Math.hypot(nx, ny, nz) / 2 < minArea || nz < 0 || Math.abs(ny) > Math.hypot(nx, nz)) continue;
    out.push(...v);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  thinned.set(src, geo);
  return geo;
}

/** Shadow of a static merged mesh (the city's buildings and street furniture). */
export function MeshSunShadow({ geometry }: { geometry: THREE.BufferGeometry }) {
  const on = useSunShadows();
  const geo = useMemo(() => (on ? casterGeometry(geometry) : null), [geometry, on]);
  useEffect(() => () => geo?.dispose(), [geo]);
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const m = ref.current;
    if (!m || !geo) return;
    m.visible = rt.sunShadow > 0.02;
    // Only the walls facing the sun can cast: morning sun is in the east (+x), afternoon in the west
    const [west, mid, east] = geo.userData.runs as number[];
    if (rt.sunDir.x >= 0) geo.setDrawRange(west, mid + east);
    else geo.setDrawRange(0, west + mid);
  });
  if (!geo) return null;
  return <mesh ref={ref} geometry={geo} material={sunShadowMaterial} frustumCulled={false} renderOrder={1} />;
}

/**
 * Shadow of an instanced mesh (trees, cars). It reuses the source's instance transforms, so
 * moving traffic drags its shadows along at no extra cost.
 */
export function InstancedSunShadow({ source, geometry, count }: { source: () => THREE.InstancedMesh | null | undefined; geometry: THREE.BufferGeometry; count: number }) {
  const on = useSunShadows();
  const ref = useRef<THREE.InstancedMesh>(null);
  useFrame(() => {
    const me = ref.current;
    const src = source();
    if (!me) return;
    if (src && me.instanceMatrix !== src.instanceMatrix) me.instanceMatrix = src.instanceMatrix;
    me.visible = !!src && rt.sunShadow > 0.02;
    if (src) me.count = src.count;
  });
  if (!on || !count) return null;
  return <instancedMesh ref={ref} args={[geometry, sunShadowMaterial, count]} frustumCulled={false} renderOrder={1} visible={false} />;
}
