'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { VoxelBuilder, cylinder, sphere, trs } from '@/engine/voxel';
import { signMaterial } from './signage';
import { M, glowTexture } from './materials';
import type { SignSpec, } from './builders/buildings';
import type { Rect } from './builders/sceneBuilder';
import { rt } from '@/engine/runtime';
import { useGame } from '@/store/game';
import { useSettings } from '@/store/settings';
import { kitFor, lampGeometry as cityLamp } from './builders/cityKit';

/* ───────── Trees ───────── */

const treeGeoCache = new Map<string, THREE.BufferGeometry>();
/** Clumpy canopy: overlapping leaf-textured boxes scattered inside an ellipsoid. */
function canopy(b: VoxelBuilder, rnd: () => number, cy: number, rx: number, ry: number, n: number, colors: string[], size: [number, number]) {
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd());
    const x = Math.cos(a) * r * rx;
    const z = Math.sin(a) * r * rx;
    const y = cy + (rnd() - 0.5) * 2 * ry * (1 - r * 0.5);
    const s = size[0] + rnd() * (size[1] - size[0]);
    b.box(x, y, z, s, s * (0.75 + rnd() * 0.3), s, colors[Math.floor(rnd() * colors.length)], { rotY: rnd() * 1.5, tex: 'leaves', topTint: 1.12 });
  }
}

export function treeGeometry(kind: string): THREE.BufferGeometry {
  const hit = treeGeoCache.get(kind);
  if (hit) return hit;
  const b = new VoxelBuilder();
  let seed = kind.length * 977 + 13;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const trunk = '#6e5340';
  const bark = { tex: 'bark' };
  switch (kind) {
    case 'pine': {
      b.block(0, 0, 0, 0.45, 3.2, 0.45, '#5e4636', bark);
      const greens = ['#2f5a3c', '#366443', '#2a5236', '#3b6b47'];
      for (let t = 0; t < 5; t++) {
        const y = 1.4 + t * 1.15;
        const w = 3.4 - t * 0.62;
        for (let k = 0; k < 3; k++) b.box((rnd() - 0.5) * 0.4, y + 0.5, (rnd() - 0.5) * 0.4, w, 0.9, w, greens[(t + k) % greens.length], { rotY: (k * Math.PI) / 6 + rnd(), tex: 'leaves', topTint: 1.1 });
      }
      b.block(0, 7.1, 0, 0.5, 0.8, 0.5, '#3b6b47', { tex: 'leaves' });
      break;
    }
    case 'blossom':
      b.block(0, 0, 0, 0.45, 2.4, 0.45, '#5c4033', bark);
      b.box(0.5, 2.6, 0, 0.25, 1.2, 0.25, '#5c4033', { rotY: 0, tex: 'bark' });
      canopy(b, rnd, 3.6, 2.0, 0.9, 12, ['#e6a6bd', '#efb9cc', '#d993ac', '#f3c7d6'], [1.0, 1.7]);
      break;
    case 'palm':
      for (let i = 0; i < 7; i++) b.block(i * 0.09, i * 0.85, 0, 0.42 - i * 0.025, 0.86, 0.42 - i * 0.025, i % 2 ? '#8a7258' : '#7a644c', bark);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        b.box(Math.cos(a) * 1.4 + 0.6, 5.7 - (k % 2) * 0.25, Math.sin(a) * 1.4, 2.9, 0.16, 0.75, k % 2 ? '#4a7a3a' : '#3f6e34', { rotY: -a, tex: 'leaves' });
      }
      b.block(0.6, 5.5, 0, 0.7, 0.5, 0.7, '#5a6a35', { tex: 'leaves' });
      break;
    case 'autumn':
      b.block(0, 0, 0, 0.5, 2.6, 0.5, trunk, bark);
      canopy(b, rnd, 3.8, 2.1, 1.0, 13, ['#c8743a', '#d68c43', '#b5602f', '#ddb04e'], [1.1, 1.8]);
      break;
    case 'bush':
      canopy(b, rnd, 0.6, 0.8, 0.3, 6, ['#3f6e34', '#4a7a3a', '#365f2e'], [0.7, 1.1]);
      break;
    case 'bare': {
      // Winter: trunk and a crown of bare, forking branches with a few dead leaves hanging on
      b.block(0, 0, 0, 0.5, 2.8, 0.5, trunk, bark);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + rnd() * 0.4;
        const tilt = 0.5 + rnd() * 0.4;
        const len = 1.6 + rnd() * 1.2;
        const m = new THREE.Matrix4().compose(
          new THREE.Vector3(Math.cos(a) * len * 0.45 * Math.sin(tilt), 2.7 + len * 0.45 * Math.cos(tilt), Math.sin(a) * len * 0.45 * Math.sin(tilt)),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt)),
          new THREE.Vector3(1, 1, 1),
        );
        b.geom(new THREE.BoxGeometry(0.14, len, 0.14), m, '#5e4636', 'bark');
        for (let k = 0; k < 3; k++) {
          const r2 = len * (0.8 + rnd() * 0.3);
          const a2 = a + (rnd() - 0.5) * 0.9;
          const m2 = new THREE.Matrix4().compose(
            new THREE.Vector3(Math.cos(a2) * r2 * 0.8 * Math.sin(tilt), 2.7 + r2 * Math.cos(tilt) + 0.3, Math.sin(a2) * r2 * 0.8 * Math.sin(tilt)),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(a2) * (tilt + 0.3), rnd(), -Math.cos(a2) * (tilt + 0.3))),
            new THREE.Vector3(1, 1, 1),
          );
          b.geom(new THREE.BoxGeometry(0.07, 0.9, 0.07), m2, '#6e5340', 'bark');
        }
      }
      for (let i = 0; i < 5; i++) b.box((rnd() - 0.5) * 3, 3.6 + rnd() * 1.2, (rnd() - 0.5) * 3, 0.3, 0.2, 0.3, '#8a6a3a', { tex: 'leaves' });
      break;
    }
    case 'round':
    default:
      b.block(0, 0, 0, 0.5, 2.8, 0.5, trunk, bark);
      b.box(0.55, 2.9, 0.2, 0.22, 1.3, 0.22, trunk, { rotY: 0.4, tex: 'bark' });
      b.box(-0.45, 3.0, -0.2, 0.2, 1.1, 0.2, trunk, { rotY: -0.6, tex: 'bark' });
      canopy(b, rnd, 4.1, 2.2, 1.1, 14, ['#3f6e34', '#4a7a3a', '#365f2e', '#56853f'], [1.1, 1.9]);
      break;
  }
  const g = b.build();
  treeGeoCache.set(kind, g);
  return g;
}

const TROPICAL = new Set(['hong-kong', 'singapore']);
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
/** Northern-hemisphere seasons for the temperate cities; the tropics stay green all year. */
export function seasonOf(month: number, city: string): Season {
  if (TROPICAL.has(city)) return 'summer';
  const m = ((month % 12) + 12) % 12;
  return m <= 1 || m === 11 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn';
}

/** Deciduous street trees change with the seasons: blossom, full green, autumn colour, bare. */
function seasonalKind(kind: string, season: Season, city: string, h: number) {
  if (kind !== 'round' && kind !== 'autumn' && kind !== 'blossom') return kind;
  const mild = city === 'san-francisco';
  if (season === 'autumn') return h < (mild ? 0.35 : 0.75) ? 'autumn' : 'round';
  if (season === 'winter') return mild ? 'round' : h < 0.85 ? 'bare' : 'round';
  if (season === 'spring') return h < 0.3 ? 'blossom' : 'round';
  return kind === 'autumn' ? 'round' : kind;
}

export function Trees({ trees, city }: { trees: { kind: string; x: number; z: number; s: number; r: number }[]; city: string }) {
  const month = useGame((s) => s.world?.time.month ?? 0);
  const season = seasonOf(month, city);
  const groups = useMemo(() => {
    const m = new Map<string, typeof trees>();
    trees.forEach((t, i) => {
      const k = seasonalKind(t.kind, season, city, ((i * 2654435761) >>> 0) / 4294967296);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    });
    return [...m.entries()];
  }, [trees, season, city]);
  // Fallen leaves drift under trees in autumn (and a few linger into winter)
  const leaves = useMemo(() => {
    if (season !== 'autumn' && season !== 'winter') return null;
    const deciduous = trees.filter((t) => t.kind === 'round' || t.kind === 'autumn' || t.kind === 'blossom');
    if (!deciduous.length || city === 'san-francisco') return null;
    const b = new VoxelBuilder();
    let seed = trees.length * 31 + 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const per = season === 'autumn' ? 26 : 8;
    const cols = ['#c8743a', '#d68c43', '#b5602f', '#ddb04e', '#9a5a2a'];
    for (const t of deciduous)
      for (let i = 0; i < per; i++) {
        const a = rnd() * Math.PI * 2;
        const r = Math.sqrt(rnd()) * 3.2 * t.s;
        b.box(t.x + Math.cos(a) * r, 0.19, t.z + Math.sin(a) * r, 0.22, 0.015, 0.16, cols[Math.floor(rnd() * cols.length)], { rotY: rnd() * 3, ao: false, tex: 'leaves' });
      }
    return b.build();
  }, [trees, season, city]);
  // Holiday lights wound through the street trees in December, lit after dark
  const festive = useMemo(() => {
    if ((month % 12) !== 11) return null;
    const pts: number[] = [];
    const col: number[] = [];
    const palette = [[1, 0.85, 0.55], [1, 0.3, 0.25], [0.35, 0.9, 0.45], [0.4, 0.6, 1], [1, 0.75, 0.3]];
    let seed = trees.length * 17 + 3;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const warmOnly = city === 'london' || city === 'park';
    for (const t of trees) {
      if (t.kind === 'palm' || t.kind === 'bush') continue;
      for (let i = 0; i < 22; i++) {
        const a = i * 0.9 + rnd();
        const y = 2.6 + (i / 22) * 2.6;
        const r = (2.0 - (i / 22) * 1.1) * t.s;
        pts.push(t.x + Math.cos(a) * r, y * t.s, t.z + Math.sin(a) * r);
        const c = warmOnly ? palette[0] : palette[Math.floor(rnd() * palette.length)];
        col.push(...c);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ map: glowTexture(), size: 0.7, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0 });
    return { geo, mat };
  }, [trees, month, city]);
  useFrame(() => {
    if (festive) festive.mat.opacity = Math.max(0, 0.85 - rt.dayLight) * 1.2 * (0.85 + 0.15 * Math.sin(performance.now() / 400));
  });
  return (
    <>
      {groups.map(([kind, list]) => (
        <InstancedStatic key={kind} geometry={treeGeometry(kind)} material={M.foliage} items={list.map((t) => ({ x: t.x, y: 0, z: t.z, ry: t.r, s: t.s }))} castShadow />
      ))}
      {leaves && <mesh geometry={leaves} material={M.vc} receiveShadow />}
      {festive && <points geometry={festive.geo} material={festive.mat} frustumCulled={false} />}
    </>
  );
}

export function InstancedStatic({
  geometry,
  material,
  items,
  castShadow,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  items: { x: number; y: number; z: number; ry?: number; s?: number }[];
  castShadow?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((it, i) => {
      mesh.setMatrixAt(i, trs(it.x, it.y, it.z, 0, it.ry ?? 0, 0, it.s ?? 1, it.s ?? 1, it.s ?? 1));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  if (!items.length) return null;
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={castShadow} frustumCulled={false} />;
}

/* ───────── Street lamps ───────── */

export function StreetLamps({ lamps, extraGlows, city = 'park' }: { lamps: { x: number; z: number; rot: number }[]; extraGlows: [number, number, number][]; city?: string }) {
  const glowPoints = useMemo(() => {
    const pts: number[] = [];
    for (const l of lamps) pts.push(l.x + Math.sin(l.rot) * 0.9, 4.18, l.z + Math.cos(l.rot) * 0.9);
    for (const g of extraGlows) pts.push(...g);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return geo;
  }, [lamps, extraGlows]);
  const pmat = useMemo(
    () =>
      new THREE.PointsMaterial({
        map: glowTexture(),
        size: 5,
        sizeAttenuation: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0,
        toneMapped: false,
        fog: true,
      }),
    [],
  );
  const bulbs = useMemo(() => lamps.map((l) => ({ x: l.x + Math.sin(l.rot) * 0.9, y: 3.9, z: l.z + Math.cos(l.rot) * 0.9 })), [lamps]);
  const bulbGeo = useMemo(() => new THREE.BoxGeometry(0.4, 0.1, 0.4), []);
  // Warm pools of light on the pavement under each lamp at night
  const poolGeo = useMemo(() => new THREE.PlaneGeometry(7.5, 7.5).rotateX(-Math.PI / 2), []);
  const poolMat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    [],
  );
  const pools = useMemo(() => lamps.map((l) => ({ x: l.x + Math.sin(l.rot) * 1.2, y: 0.19, z: l.z + Math.cos(l.rot) * 1.2 })), [lamps]);
  useFrame(() => {
    pmat.opacity = Math.max(0, 0.85 - rt.dayLight) * 0.95;
    poolMat.opacity = Math.max(0, 0.75 - rt.dayLight) * 0.55;
    M.bulb.color.setScalar(rt.dayLight > 0.6 ? 0.85 : 1.6);
  });
  return (
    <>
      <InstancedStatic geometry={cityLamp(kitFor(city).lamp, (draw) => {
        const vb = new VoxelBuilder();
        draw(vb);
        return vb.build();
      })} material={M.vc} items={lamps.map((l) => ({ x: l.x, y: 0, z: l.z, ry: l.rot }))} />
      <InstancedStatic geometry={bulbGeo} material={M.bulb} items={bulbs} />
      <InstancedStatic geometry={poolGeo} material={poolMat} items={pools} />
      <points geometry={glowPoints} material={pmat} frustumCulled={false} />
    </>
  );
}

/* ───────── Signs ───────── */

/** Shop boards use a muted, painted version of the building's sign color. */
function boardColor(hex: string) {
  const c = new THREE.Color(hex);
  const l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
  c.lerp(new THREE.Color(l, l, l), 0.35).multiplyScalar(0.72);
  return '#' + c.getHexString();
}

type BoardStyle = { panel: string | null; frame: string; fg: string; font: 'roman' | 'serif' | 'sans' | 'corp' | 'cond'; upper: boolean };

/**
 * How each city letters its buildings. Signs are framed boards with the name standing proud of
 * the face, but the colours and typefaces follow local habits: gilt serif on London's painted
 * fascias, red-and-gold in Hong Kong, white enamel boards in Singapore and so on.
 * `panel: null` means "use the building's own colour" (shops keep their identity).
 */
const BOARD: Record<string, Partial<Record<'carved' | 'letters' | 'fascia', BoardStyle>>> = {
  park: {
    carved: { panel: '#1e2840', frame: '#c9a24a', fg: '#ecd28a', font: 'roman', upper: true },
    letters: { panel: '#1e2840', frame: '#d8dde4', fg: '#ffffff', font: 'corp', upper: false },
    fascia: { panel: null, frame: '#2b2622', fg: '#f4ead0', font: 'serif', upper: false },
  },
  'new-york': {
    carved: { panel: '#1d2533', frame: '#b89a52', fg: '#e8d39a', font: 'roman', upper: true },
    letters: { panel: '#15171b', frame: '#6a7078', fg: '#ffffff', font: 'corp', upper: true },
    fascia: { panel: null, frame: '#15171b', fg: '#f6f3ec', font: 'sans', upper: true },
  },
  london: {
    carved: { panel: '#1f2c4a', frame: '#c9a24a', fg: '#e6c86a', font: 'roman', upper: true },
    letters: { panel: '#1e3a2e', frame: '#c9a24a', fg: '#efe2b8', font: 'serif', upper: false },
    fascia: { panel: null, frame: '#c9a24a', fg: '#e6c86a', font: 'serif', upper: false },
  },
  'hong-kong': {
    carved: { panel: '#7a1a1a', frame: '#d9b04a', fg: '#f6d47a', font: 'roman', upper: true },
    letters: { panel: '#8c1f1f', frame: '#d9b04a', fg: '#f6d47a', font: 'cond', upper: true },
    fascia: { panel: '#9a2420', frame: '#d9b04a', fg: '#f6d47a', font: 'cond', upper: true },
  },
  'san-francisco': {
    carved: { panel: '#e9e4d8', frame: '#3a3f46', fg: '#2b3a40', font: 'roman', upper: true },
    letters: { panel: '#f2f0ea', frame: '#2b2f36', fg: '#1f6f6a', font: 'corp', upper: false },
    fascia: { panel: '#5e4330', frame: '#2b2f36', fg: '#f2e6cf', font: 'cond', upper: true },
  },
  singapore: {
    carved: { panel: '#f4f5f2', frame: '#8a9a94', fg: '#1f5a4a', font: 'roman', upper: true },
    letters: { panel: '#f6f7f4', frame: '#c9d2cf', fg: '#14524a', font: 'corp', upper: false },
    fascia: { panel: '#0f4a5a', frame: '#e8ece9', fg: '#ffffff', font: 'sans', upper: false },
  },
};

/** Materials for a framed board with raised lettering in a city's sign style. */
export function boardMaterials(text: string, w: number, h: number, city: string, kind: 'carved' | 'letters' | 'fascia', bg = '#1f3a2e') {
  const board = (BOARD[city] ?? BOARD.park)[kind]!;
  const panelBg = board.panel ?? boardColor(bg);
  const panel = signMaterial({ kind: 'panel', text, w, h, bg: panelBg, fg: board.frame });
  const letters = signMaterial({ kind: 'raised', text, w, h, fg: board.fg, font: board.font, upper: board.upper });
  const edge = new THREE.MeshBasicMaterial({ map: letters.map, color: new THREE.Color(board.fg).multiplyScalar(0.42), alphaTest: 0.35, transparent: true });
  const shadow = new THREE.MeshBasicMaterial({ map: letters.map, color: '#000000', transparent: true, opacity: 0.45, depthWrite: false });
  return { frame: board.frame, panel, letters, edge, shadow };
}

/** A framed sign board whose name stands proud of the face (extruded letters with a shadow). */
export function BoardSign({ w, h, mats, depth = 0.22 }: { w: number; h: number; mats: ReturnType<typeof boardMaterials>; depth?: number }) {
  return (
    <>
      <mesh position={[0, 0, -depth / 2]} castShadow>
        <boxGeometry args={[w + 0.26, h + 0.26, depth]} />
        <meshLambertMaterial color={mats.frame} />
      </mesh>
      <mesh position={[0, 0, 0.012]} material={mats.panel}>
        <planeGeometry args={[w, h]} />
      </mesh>
      <mesh position={[0.035, -0.05, 0.02]} material={mats.shadow}>
        <planeGeometry args={[w, h]} />
      </mesh>
      <mesh position={[0, 0, 0.045]} material={mats.edge}>
        <planeGeometry args={[w, h]} />
      </mesh>
      <mesh position={[-0.008, 0.008, 0.075]} material={mats.letters}>
        <planeGeometry args={[w, h]} />
      </mesh>
    </>
  );
}

export function Signs({ signs, city = 'park' }: { signs: SignSpec[]; city?: string }) {
  const quality = useSettings((s) => s.quality);
  const refs = useRef<(THREE.Group | null)[]>([]);
  const tick = useRef(0);
  // Signs far from the camera can't be read anyway: skip drawing them
  useFrame(({ camera }, dt) => {
    tick.current -= dt;
    if (tick.current > 0) return;
    tick.current = 0.4;
    const lim = quality === 'low' ? 55 : quality === 'medium' ? 90 : 130;
    signs.forEach((sg, i) => {
      const g = refs.current[i];
      if (g) g.visible = Math.hypot(camera.position.x - sg.x, camera.position.z - sg.z) < lim;
    });
  });
  const items = useMemo(
    () =>
      signs.map((s) => {
        const kind = s.kind ?? 'fascia';
        const board = (kind === 'carved' || kind === 'letters' || kind === 'fascia') && (BOARD[city] ?? BOARD.park)[kind];
        if (board) {
          // Framed board + name in raised letters (extruded edge and a soft cast shadow)
          const mats = boardMaterials(s.text, s.w, s.h, city, kind as 'carved' | 'letters' | 'fascia', s.bg);
          return { s, kind, board: true, mats, mat: null };
        }
        const ad = kind === 'poster' || kind === 'billboard' || kind === 'street' || kind === 'hoarding' || kind === 'neon';
        const mat = signMaterial({
          kind,
          text: s.text,
          sub: s.sub,
          w: s.w,
          h: s.h,
          bg: ad ? s.bg : undefined,
          fg: ad ? s.fg : undefined,
        });
        return { s, kind, board: false, mats: null, mat };
      }),
    [signs, city],
  );
  return (
    <>
      {items.map(({ s, mat, kind, board, mats }, i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)} position={[s.x, s.y, s.z]} rotation={[0, s.rotY, 0]}>
          {board && mats ? (
            <BoardSign w={s.w} h={s.h} mats={mats} />
          ) : (
            <>
              {kind === 'marquee' && (
                <mesh position={[0, 0, -0.06]}>
                  <boxGeometry args={[s.w + 0.16, s.h + 0.16, 0.1]} />
                  <meshLambertMaterial color="#2a2018" />
                </mesh>
              )}
              <mesh material={mat!}>
                <planeGeometry args={[s.w, s.h]} />
              </mesh>
            </>
          )}
        </group>
      ))}
    </>
  );
}

/* ───────── Water ───────── */

const waterVert = /* glsl */ `
uniform float uTime;
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vec3 p = position;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  // Gentle swell
  wp.y += sin(wp.x * 0.18 + uTime * 0.9) * 0.05 + sin(wp.z * 0.23 - uTime * 0.7) * 0.04;
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const waterFrag = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uSkyHor;
uniform vec3 uSkyTop;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform float uNight;
uniform vec4 uRect;
varying vec3 vWorld;
#include <fog_pars_fragment>
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float waves(vec2 p) {
  return n2(p * 0.35 + vec2(uTime * 0.05, uTime * 0.03)) * 0.5
       + n2(p * 0.9 - vec2(uTime * 0.09, -uTime * 0.07)) * 0.3
       + n2(p * 2.2 + vec2(-uTime * 0.16, uTime * 0.12)) * 0.2;
}
void main() {
  // Chunky pixel grid (0.35 m texels) for the retro look
  vec2 q = floor(vWorld.xz / 0.35) * 0.35;
  float e = 0.35;
  float h = waves(q);
  vec3 n = normalize(vec3(h - waves(q + vec2(e, 0.0)), 0.35, h - waves(q + vec2(0.0, e))));
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
  vec3 R = reflect(-V, n);
  vec3 sky = mix(uSkyHor, uSkyTop, clamp(R.y * 1.6, 0.0, 1.0));
  vec3 base = mix(uDeep, uShallow, h * 0.6);
  vec3 col = mix(base, sky, 0.18 + fres * 0.62);
  // Sun glint
  float spec = pow(max(dot(R, normalize(uSunDir)), 0.0), 140.0);
  col += uSunCol * spec * 1.6 * (1.0 - uNight);
  // City lights shimmering at night
  float sparkle = step(0.985, h21(q * 3.1 + floor(uTime * 2.0)));
  col += vec3(1.0, 0.8, 0.5) * sparkle * uNight * 0.55;
  // Foam along the seawalls
  float edge = min(min(vWorld.x - uRect.x, uRect.z - vWorld.x), min(vWorld.z - uRect.y, uRect.w - vWorld.z));
  float foam = (1.0 - smoothstep(0.2, 1.6, edge)) * step(0.45, n2(q * 1.7 + uTime * 0.4));
  col = mix(col, vec3(0.92, 0.95, 0.97) * (1.0 - uNight * 0.6), foam * 0.75);
  // Posterize slightly for the pixel-art palette
  col = floor(col * 28.0 + 0.5) / 28.0;
  gl_FragColor = vec4(col, 0.96);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export function Water({ rects }: { rects: Rect[] }) {
  const { scene } = useThree();
  const mats = useMemo(
    () =>
      rects.map(
        (r) =>
          new THREE.ShaderMaterial({
            vertexShader: waterVert,
            fragmentShader: waterFrag,
            transparent: true,
            fog: true,
            uniforms: {
              ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
              uTime: { value: 0 },
              uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.4) },
              uSunCol: { value: new THREE.Color('#fff0d8') },
              uSkyHor: { value: new THREE.Color('#d4e2ee') },
              uSkyTop: { value: new THREE.Color('#5a8fcf') },
              uDeep: { value: new THREE.Color('#123a52') },
              uShallow: { value: new THREE.Color('#2f6f86') },
              uNight: { value: 0 },
              uRect: { value: new THREE.Vector4(r.minX, r.minZ, r.maxX, r.maxZ) },
            },
          }),
      ),
    [rects],
  );
  const top = useMemo(() => new THREE.Color(), []);
  useFrame((state) => {
    const fog = scene.fog as THREE.Fog | null;
    const night = Math.max(0, Math.min(1, (0.75 - rt.dayLight) / 0.6));
    top.set('#5a8fcf').lerp(new THREE.Color('#0b1130'), night);
    for (const m of mats) {
      const u = m.uniforms;
      u.uTime.value = state.clock.elapsedTime;
      u.uSunDir.value.copy(rt.sunDir);
      u.uSunCol.value.copy(rt.sunColor);
      if (fog) u.uSkyHor.value.copy(fog.color);
      u.uSkyTop.value.copy(top);
      u.uNight.value = night;
      u.uDeep.value.set('#123a52').multiplyScalar(1 - night * 0.7);
      u.uShallow.value.set('#2f6f86').multiplyScalar(1 - night * 0.7);
    }
  });
  return (
    <>
      {rects.map((r, i) => (
        <group key={i}>
          <mesh position={[(r.minX + r.maxX) / 2, -0.35, (r.minZ + r.maxZ) / 2]} rotation={[-Math.PI / 2, 0, 0]} material={mats[i]}>
            <planeGeometry args={[r.maxX - r.minX, r.maxZ - r.minZ, Math.ceil((r.maxX - r.minX) / 4), Math.ceil((r.maxZ - r.minZ) / 4)]} />
          </mesh>
          <mesh position={[(r.minX + r.maxX) / 2, -1.6, (r.minZ + r.maxZ) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[r.maxX - r.minX, r.maxZ - r.minZ]} />
            <meshBasicMaterial color="#0e2a3c" />
          </mesh>
        </group>
      ))}
    </>
  );
}

/* ───────── Clouds & birds ───────── */

/** Soft pixel-art cumulus: overlapping puffs, lit top, grey underside, feathered edges. */
function cloudTexture(seed: number) {
  const W = 96;
  const H = 48;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  let s0 = seed * 7919 + 1;
  const rnd = () => ((s0 = (s0 * 16807) % 2147483647) / 2147483647);
  const puffs = 9 + Math.floor(rnd() * 6);
  for (let i = 0; i < puffs; i++) {
    const x = W * (0.18 + rnd() * 0.64);
    const y = H * (0.42 + rnd() * 0.25) - Math.sin((x / W) * Math.PI) * H * 0.18;
    const r = H * (0.16 + rnd() * 0.2);
    const grd = g.createRadialGradient(x, y - r * 0.35, r * 0.1, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.55, 'rgba(236,240,246,0.95)');
    grd.addColorStop(1, 'rgba(200,210,224,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // Flat, slightly darker base
  const base = g.createLinearGradient(0, H * 0.55, 0, H);
  base.addColorStop(0, 'rgba(0,0,0,0)');
  base.addColorStop(1, 'rgba(120,135,160,0.35)');
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}

export function Clouds({ count = 14, spread = 200 }: { count?: number; spread?: number }) {
  const { camera } = useThree();
  const mats = useMemo(
    () => Array.from({ length: 4 }, (_, i) => new THREE.MeshBasicMaterial({ map: cloudTexture(i + 1), transparent: true, depthWrite: false, fog: false, opacity: 0.9 })),
    [],
  );
  const plane = useMemo(() => new THREE.PlaneGeometry(1, 0.5), []);
  const data = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: (Math.random() - 0.5) * spread * 3,
        z: (Math.random() - 0.5) * spread * 3,
        y: 95 + Math.random() * 45,
        s: 55 + Math.random() * 70,
        v: 0.8 + Math.random() * 0.9,
        m: i % 4,
      })),
    [count, spread],
  );
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame((_, dt) => {
    const day = (0.35 + rt.dayLight * 0.65) * (1 - Math.min(0.45, (rt.weather === 'rain' || rt.weather === 'snow' || rt.weather === 'cloudy' ? 0.5 : 0) * rt.weatherAmt));
    for (const m of mats) m.color.setRGB(day, day, day * 1.04);
    data.forEach((c, i) => {
      c.x += c.v * dt;
      if (c.x > spread * 1.5) c.x = -spread * 1.5;
      const mesh = refs.current[i];
      if (!mesh) return;
      mesh.position.set(c.x, c.y, c.z);
      mesh.quaternion.copy(camera.quaternion); // always face the camera
    });
  });
  return (
    <>
      {data.map((c, i) => (
        <mesh key={i} ref={(m) => void (refs.current[i] = m)} geometry={plane} material={mats[c.m]} scale={[c.s, c.s, 1]} renderOrder={-0.5} frustumCulled={false} />
      ))}
    </>
  );
}

export function Birds({ count = 10 }: { count?: number }) {
  const geo = useMemo(() => {
    const b = new VoxelBuilder();
    b.box(0, 0, 0, 0.25, 0.2, 0.6, '#3a3f4a');
    b.box(0.45, 0.05, 0, 0.7, 0.05, 0.3, '#3a3f4a', { rotY: 0 });
    b.box(-0.45, 0.05, 0, 0.7, 0.05, 0.3, '#3a3f4a', { rotY: 0 });
    return b.build();
  }, []);
  const ref = useRef<THREE.InstancedMesh>(null);
  const data = useMemo(() => Array.from({ length: count }, (_, i) => ({ cx: (Math.random() - 0.5) * 120, cz: (Math.random() - 0.5) * 120, r: 8 + Math.random() * 14, y: 18 + Math.random() * 14, a: Math.random() * 6, v: 0.3 + Math.random() * 0.3, i })), [count]);
  useFrame((state, dt) => {
    const mesh = ref.current;
    if (!mesh) return;
    for (const b of data) {
      b.a += b.v * dt;
      const x = b.cx + Math.cos(b.a) * b.r;
      const z = b.cz + Math.sin(b.a) * b.r;
      const flap = 1 + Math.sin(state.clock.elapsedTime * 10 + b.i) * 0.35;
      mesh.setMatrixAt(b.i, trs(x, b.y + Math.sin(b.a * 3) * 0.6, z, 0, -b.a, 0, flap, 1, 1));
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, M.vc, count]} frustumCulled={false} />;
}

export { sphere };
