'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { walkTo } from '@/engine/walk';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { BuildingDef, StationDef } from '@/game/content';
import type { AvatarConfig, Difficulty } from '@/game/types';
import { VoxelBuilder, trs } from '@/engine/voxel';
import { BoardSign, boardMaterials } from './Props';
import { useScene } from '@/store/scene';
import { M } from './materials';
import { rt } from '@/engine/runtime';
import { Avatar, type AnimState } from './Avatar';
import { LitePerson } from './LitePerson';
import { useUI } from '@/store/ui';
import { useSettings } from '@/store/settings';
import npcs from '@/data/npcs.json';
import { shade } from './builders/buildings';
import { makeRng, type Rng } from '@/game/rng';
import { DEFAULT_AVATAR } from '@/game/world';
import { HAIR_STYLES } from '@/game/look';
import { plant, type Actor, type InteriorKind, type Kit } from './interiors/furnish';
import { kindFor, layoutFor, zoneFor, type Layout } from './interiors/plan';
import { worldUniforms } from '@/engine/atlas';

export function stationsFor(b: BuildingDef, difficulty: Difficulty): StationDef[] {
  if (difficulty === 'entry' && b.entryStations) return b.entryStations;
  return b.stations;
}

export const GLASS_MAT = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.28, depthWrite: false, toneMapped: false });

/* ───────── People ───────── */

const SKINS = ['#ffdcc0', '#f2c39c', '#e8b48f', '#c98e64', '#a96e48', '#7d4f33', '#5a3826'];
const HAIRS = ['#1e1a18', '#3b2a20', '#6b4428', '#b07a3c', '#e2b85e', '#8a8f96', '#2a211b'];
const DRESS: Record<Actor['dress'], { top: string[]; bottom: string[]; feet: string[]; acc: (string | null)[] }> = {
  office: { top: ['suit', 'suit-pinstripe', 'blazer', 'qz-navy', 'qz-charcoal', 'qz-vest', 'turtleneck'], bottom: ['trousers', 'chinos', 'trousers'], feet: ['oxfords', 'loafers'], acc: ['steel-watch', 'glasses', 'lanyard', null, null] },
  smart: { top: ['blazer', 'cardigan', 'turtleneck', 'qz-navy', 'polo', 'bomber'], bottom: ['chinos', 'jeans-black', 'jeans'], feet: ['loafers', 'sneakers', 'oxfords'], acc: ['glasses', 'sport-watch', null, null] },
  casual: { top: ['tee-white', 'tee-black', 'hoodie-grey', 'hoodie-navy', 'polo', 'stripes', 'puffer', 'varsity', 'jersey'], bottom: ['jeans', 'joggers', 'shorts', 'cargo', 'jeans-black'], feet: ['sneakers', 'canvas', 'runners', 'high-tops'], acc: ['backpack', 'shades', null, null, null] },
  tech: { top: ['hoodie-grey', 'zip-hoodie', 'tee-black', 'qz-vest', 'bomber', 'hoodie-navy'], bottom: ['jeans', 'joggers', 'jeans-black'], feet: ['sneakers', 'high-tops', 'runners'], acc: ['headset', 'glasses', 'lanyard', null] },
  work: { top: ['vest', 'tee-white', 'tee-black', 'apron'], bottom: ['cargo', 'jeans'], feet: ['sneakers', 'runners'], acc: [null, null, 'sport-watch'] },
  chef: { top: ['apron'], bottom: ['jeans-black', 'cargo'], feet: ['sneakers'], acc: [null] },
};

/** Extra pieces women on staff wear alongside the shared lists above. */
const DRESS_F: Partial<Record<Actor['dress'], { top?: string[]; bottom?: string[]; feet?: string[]; acc?: (string | null)[] }>> = {
  office: { top: ['skirt-suit', 'work-dress', 'blouse', 'trench'], bottom: ['pencil-skirt', 'wide-trousers'], feet: ['pumps', 'flats', 'ankle-boots'], acc: ['pearls', 'tote'] },
  smart: { top: ['blouse', 'trench', 'work-dress'], bottom: ['pleated-skirt', 'wide-trousers'], feet: ['flats', 'ankle-boots'], acc: ['tote'] },
  casual: { bottom: ['leggings', 'pleated-skirt'], feet: ['ankle-boots', 'flats'] },
  tech: { bottom: ['leggings'], feet: ['ankle-boots'] },
};
const MALE_ONLY = new Set(['tux', 'three-piece', 'trousers']);

function dressLook(rng: Rng, dress: Actor['dress']): AvatarConfig {
  const d = DRESS[dress];
  const body = rng.chance(0.5) ? 'female' : 'male';
  const extra = body === 'female' ? DRESS_F[dress] : undefined;
  const pick = (base: (string | null)[], more?: (string | null)[]) => rng.pick([...base, ...(more ?? [])].filter((id) => body === 'male' || !id || !MALE_ONLY.has(id)));
  return {
    ...DEFAULT_AVATAR,
    body,
    build: rng.int(0, 2),
    skin: rng.pick(SKINS),
    hair: rng.pick(HAIRS),
    hairStyle: rng.pick(HAIR_STYLES[body]).id,
    top: pick(d.top, extra?.top),
    bottom: pick(d.bottom, extra?.bottom),
    feet: pick(d.feet, extra?.feet),
    accessory: pick(d.acc, extra?.acc),
    hat: null,
  };
}

function Person({ actor, look }: { actor: Actor; look: AvatarConfig }) {
  const g = useRef<THREE.Group>(null);
  const quality = useSettings((s) => s.quality);
  // Full detail only near the camera; everyone else uses the cheap merged model
  const [near, setNear] = useState(false);
  const lodTick = useRef(Math.random() * 0.5);
  const seated = actor.pose === 'sit' || actor.pose === 'type' || actor.pose === 'eat';
  const anim = useRef<AnimState>({ speed: 0, grounded: true, sitting: seated, busy: actor.pose === 'type' || actor.pose === 'eat' || actor.pose === 'busy' });
  const st = useRef({ seg: 0, t: Math.random(), wait: 0 });
  useFrame(({ camera }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const grp = g.current;
    lodTick.current -= rawDt;
    if (grp && lodTick.current <= 0) {
      lodTick.current = 0.5;
      const d = camera.position.distanceTo(grp.getWorldPosition(tmpV));
      const want = quality !== 'low' && (near ? d < 11 : d < 9);
      if (want !== near) setNear(want);
    }
    if (!grp || !actor.path) return;
    const p = actor.path;
    const s = st.current;
    const a = p[s.seg];
    const b = p[(s.seg + 1) % p.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const x = a[0] + (b[0] - a[0]) * s.t;
    const z = a[1] + (b[1] - a[1]) * s.t;
    const blocked = Math.hypot(rt.player.x - x, rt.player.z - z) < 1.3;
    if (s.wait > 0) s.wait -= dt;
    else if (!blocked) {
      s.t += (1.1 * dt) / len;
      if (s.t >= 1) {
        s.t = 0;
        s.seg = (s.seg + 1) % p.length;
        if (Math.random() < 0.3) s.wait = 1 + Math.random() * 2.5;
      }
    }
    anim.current.speed = s.wait > 0 || blocked ? 0 : 0.45;
    grp.position.set(x, 0, z);
    const yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    let dy = yaw - grp.rotation.y;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    grp.rotation.y += dy * Math.min(1, 6 * dt);
  });
  const y = seated ? (actor.seat ?? 0.46) - 0.46 : 0;
  // Seated people sit slightly back so they are on the chair, not the table edge
  const back = seated ? 0.1 : 0;
  return (
    <group ref={g} position={[actor.x - Math.sin(actor.rot) * back, y, actor.z - Math.cos(actor.rot) * back]} rotation={[0, actor.rot, 0]}>
      {near ? <Avatar config={look} anim={anim} /> : <LitePerson config={look} anim={anim} />}
    </group>
  );
}

const tmpV = new THREE.Vector3();

function People({ actors, seed }: { actors: Actor[]; seed: number }) {
  const quality = useSettings((s) => s.quality);
  const list = useMemo(() => {
    const rng = makeRng(seed);
    const keep = quality === 'low' ? actors.filter((_, i) => i % 2 === 0) : actors;
    // Spread the cap evenly across the room (walkers always kept) so a big hall isn't full at the front only
    const cap = quality === 'high' ? 40 : 26;
    const seated = (a: Actor) => a.pose === 'sit' || a.pose === 'type' || a.pose === 'eat';
    const walkers = keep.filter((a) => a.path || !seated(a)).slice(0, Math.floor(cap / 2));
    const rest = keep.filter((a) => !walkers.includes(a));
    const room = Math.max(0, cap - walkers.length);
    const step = rest.length > room ? rest.length / room : 1;
    const picked = rest.length > room ? Array.from({ length: room }, (_, i) => rest[Math.floor(i * step)]) : rest;
    return [...picked, ...walkers].map((a) => ({ a, look: dressLook(rng, a.dress) }));
  }, [actors, seed, quality]);
  return (
    <>
      {list.map(({ a, look }, i) => (
        <Person key={i} actor={a} look={look} />
      ))}
    </>
  );
}

/* ───────── Room shell ───────── */

/** Floor, walls, ceiling and entrance of a room. Homes leave out the two lobby plants. */
export function buildShell(b: VoxelBuilder, g: VoxelBuilder, kind: Pick<InteriorKind, 'wall' | 'wallTex' | 'floor' | 'floorColor' | 'windows'>, L: Layout, plants = true) {
  const { w, d, h } = L;
  const wall = kind.wall;
  const tx = { tex: kind.wallTex };
  b.block(0, -0.2, 0, w, 0.2, d, kind.floorColor, { ao: false, tex: kind.floor });
  b.block(0, 0, -d / 2 - 0.25, w + 1, h, 0.5, wall, tx);
  b.block(-w / 2 - 0.25, 0, 0, 0.5, h, d, wall, tx);
  b.block(w / 2 + 0.25, 0, 0, 0.5, h, d, wall, tx);
  b.block(-w / 4 - 1.2, 0, d / 2 + 0.25, w / 2 - 2.4, h, 0.5, wall, tx);
  b.block(w / 4 + 1.2, 0, d / 2 + 0.25, w / 2 - 2.4, h, 0.5, wall, tx);
  b.block(0, 3.4, d / 2 + 0.25, 4.8, h - 3.4, 0.5, wall, tx);
  // Skirting, crown moulding, pilasters
  const trim = shade(wall, 0.82);
  for (const sx of [-1, 1]) {
    b.box((sx * w) / 2 - sx * 0.04, 0.12, 0, 0.08, 0.24, d, trim);
    b.box((sx * w) / 2 - sx * 0.05, h - 0.2, 0, 0.12, 0.3, d, shade(wall, 1.05));
    for (let z = -d / 2 + 4; z < d / 2 - 2; z += 4.5) b.box((sx * w) / 2 - sx * 0.1, h / 2, z, 0.2, h, 0.5, shade(wall, 0.95), tx);
  }
  b.box(0, 0.12, -d / 2 + 0.04, w, 0.24, 0.08, trim);
  b.box(0, h - 0.2, -d / 2 + 0.05, w, 0.3, 0.12, shade(wall, 1.05));
  // Tall daylight windows on the side walls
  if (kind.windows && !L.sides)
    for (const sx of [-1, 1])
      for (let z = -d / 2 + 6.2; z < d / 2 - 3; z += 4.5) {
        b.box((sx * w) / 2 - sx * 0.06, h * 0.5, z, 0.1, h * 0.62, 2.4, '#e8e2d6');
        g.box((sx * w) / 2 - sx * 0.12, h * 0.5, z, 0.02, h * 0.56, 2.1, '#cfe2ee');
        b.box((sx * w) / 2 - sx * 0.14, h * 0.5, z, 0.03, h * 0.56, 0.06, '#e8e2d6');
      }
  // Ceiling (faces down only) with recessed lights
  b.geom(new THREE.PlaneGeometry(w + 1, d + 1).rotateX(Math.PI / 2), trs(0, h, 0), shade(wall, 1.02));
  for (let x = -w / 2 + 3; x < w / 2 - 1; x += 4) for (let z = -d / 2 + 3; z < d / 2 - 1; z += 4) g.box(x, h - 0.02, z, 0.6, 0.02, 0.6, '#fff4d6');
  // Entrance: mat and glazed double doors
  b.block(0, 0.0, d / 2 - 0.9, 3.6, 0.03, 1.6, '#2f3138', { tex: 'concrete' });
  b.block(0, 0, d / 2 + 0.05, 4.8, 3.4, 0.2, '#4a3324', { tex: 'wood' });
  g.block(-1.05, 0.3, d / 2 + 0.17, 1.8, 2.8, 0.04, '#cfe2ee');
  g.block(1.05, 0.3, d / 2 + 0.17, 1.8, 2.8, 0.04, '#cfe2ee');
  if (plants) {
    plant(b, -3.6, d / 2 - 1.6, true);
    plant(b, 3.6, d / 2 - 1.6, true);
  }
}

/**
 * Daylight through the tall side windows: a soft slanted beam from each window on the sunny side
 * and a warm patch where it lands on the floor. Fades out on dull days and after sunset.
 */
function SunShafts({ L }: { L: Layout }) {
  const { w, d, h } = L;
  const meshes = useMemo(() => {
    return [-1, 1].map((sx) => {
      const pos: number[] = [];
      const col: number[] = [];
      const yTop = h * 0.81;
      const yBot = h * 0.19;
      const reach = Math.min(w * 0.45, yTop * 1.1);
      const near = reach * (yBot / yTop);
      const xw = (sx * w) / 2 - sx * 0.15;
      const quad = (a: number[], b: number[], c: number[], e: number[], ca: number, cb: number) => {
        pos.push(...a, ...b, ...c, ...a, ...c, ...e);
        col.push(ca, ca, ca, cb, cb, cb, cb, cb, cb, ca, ca, ca, cb, cb, cb, cb, cb, cb);
      };
      for (let z = -d / 2 + 6.2; z < d / 2 - 3; z += 4.5) {
        const z0 = z - 1.05;
        const z1 = z + 1.05;
        // Slanted sheet from the top of the window down to the far edge of the patch
        quad([xw, yTop, z0], [xw - sx * reach, 0.03, z0 + 0.6], [xw - sx * reach, 0.03, z1 + 0.6], [xw, yTop, z1], 0.18, 0.05);
        // Patch of sunlight on the floor
        quad([xw - sx * near, 0.025, z0 + 0.15], [xw - sx * reach, 0.025, z0 + 0.6], [xw - sx * reach, 0.025, z1 + 0.6], [xw - sx * near, 0.025, z1 + 0.15], 0.55, 0.4);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      const mat = new THREE.MeshBasicMaterial({ vertexColors: true, color: '#ffd9a0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, opacity: 0 });
      return { sx, geo, mat };
    });
  }, [w, d, h]);
  useFrame(() => {
    const overcast = rt.weather === 'clear' || rt.weather === 'haze' ? 0 : rt.weatherAmt * 0.85;
    const sun = Math.max(0, rt.dayLight - 0.35) * 1.4 * (1 - overcast);
    for (const m of meshes) m.mat.opacity = (Math.sign(rt.sunDir.x) === m.sx ? 1 : 0.15) * sun;
  });
  return (
    <>
      {meshes.map((m) => (
        <mesh key={m.sx} geometry={m.geo} material={m.mat} renderOrder={3} />
      ))}
    </>
  );
}

/** Service counter matching the place: teller window, reception desk, checkout, stall, kiosk or bar. */
function buildCounter(b: VoxelBuilder, g: VoxelBuilder, style: InteriorKind['counter'], s: { x: number; z: number; rot: number }) {
  const c = Math.cos(s.rot);
  const si = Math.sin(s.rot);
  const cx = s.x + si * 1.6;
  const cz = s.z + c * 1.6;
  const o = { rotY: s.rot };
  switch (style) {
    case 'teller':
      b.box(cx, 0.55, cz, 3.2, 1.1, 0.9, '#6b4a30', { ...o, tex: 'wood' });
      b.box(cx, 1.13, cz, 3.4, 0.08, 1.1, '#e8e2d6', { ...o, tex: 'marble' });
      g.box(cx - si * 0.1, 1.85, cz - c * 0.1, 3.2, 1.3, 0.03, '#d6e8ef', o);
      b.box(cx - si * 0.1, 2.55, cz - c * 0.1, 3.4, 0.12, 0.08, '#c9a24a', o);
      g.box(cx - si * 0.1, 2.8, cz - c * 0.1, 0.6, 0.35, 0.03, '#e05a3a', o); // window number
      break;
    case 'checkout':
      b.box(cx, 0.5, cz, 3.0, 1.0, 0.8, '#d9dde3', { ...o, tex: 'metal' });
      b.box(cx, 1.01, cz, 2.2, 0.02, 0.6, '#1f2226', o);
      b.box(cx + c * 1.0, 1.25, cz - si * 1.0, 0.35, 0.3, 0.3, '#2a2c2f', o);
      g.box(cx + c * 1.0, 1.32, cz - si * 1.0 + 0.0, 0.28, 0.18, 0.01, '#3dd6ff', o);
      break;
    case 'stall':
      b.box(cx, 0.5, cz, 3.0, 1.0, 0.9, '#8a6440', { ...o, tex: 'wood' });
      for (let k = -1.2; k <= 1.2; k += 0.5) b.box(cx + c * k, 1.1, cz - si * k, 0.35, 0.2, 0.35, ['#c9455a', '#e0b03a', '#4a8a3a', '#e07a3a'][Math.round((k + 1.2) / 0.5) % 4], o);
      b.box(cx - si * 0.3, 2.5, cz - c * 0.3, 3.4, 0.08, 1.6, '#b3261e', o);
      break;
    case 'kiosk':
      b.box(cx, 0.6, cz, 1.4, 1.2, 0.9, '#2f3138', { ...o, tex: 'metal' });
      g.box(cx + si * 0.46, 0.9, cz + c * 0.46, 1.0, 0.4, 0.01, '#3dd6ff', o);
      break;
    case 'bar':
      b.box(cx, 0.55, cz, 3.2, 1.1, 0.9, '#3a2618', { ...o, tex: 'wood' });
      b.box(cx, 1.13, cz, 3.4, 0.08, 1.1, '#2a2c2f', { ...o, tex: 'marble' });
      b.box(cx - c * 0.9, 1.4, cz + si * 0.9, 0.6, 0.5, 0.5, '#c8ccd4', o);
      break;
    default:
      b.box(cx, 0.55, cz, 3.2, 1.1, 0.9, '#6b4a30', { ...o, tex: 'wood' });
      b.box(cx, 1.13, cz, 3.4, 0.08, 1.1, '#e8e2d6', { ...o, tex: 'marble' });
      b.box(cx + si * 0.46, 0.12, cz + c * 0.46, 3.2, 0.24, 0.04, '#2a2c2f', o);
  }
}

export function InteriorScene({ building, difficulty }: { building: BuildingDef; difficulty: Difficulty }) {
  const stations = stationsFor(building, difficulty);
  const kind = useMemo(() => kindFor(building), [building]);
  const L = useMemo(() => layoutFor(stations.length, kind), [stations.length, kind]);

  const built = useMemo(() => {
    const b = new VoxelBuilder();
    const g = new VoxelBuilder();
    const gl = new VoxelBuilder();
    const { w, d, h } = L;
    buildShell(b, g, kind, L);
    const k: Kit = {
      b,
      g,
      gl,
      rng: makeRng(building.id.length * 977 + building.id.charCodeAt(0)),
      w,
      d,
      h,
      zone: zoneFor(L),
      solids: [],
      actors: [],
    };
    kind.furnish(k);
    L.spots.slice(0, stations.length).forEach((s) => buildCounter(b, gl, kind.counter, s));
    return { geo: b.build(), glow: g.build(), glass: gl.build(), solids: k.solids, actors: k.actors };
  }, [L, kind, stations.length, building.id]);
  const geo = built.geo;

  // Indoors: surfaces are cleaned and dry
  useFrame(() => {
    worldUniforms.uGrime.value = 0.3;
    worldUniforms.uWet.value = 0;
    worldUniforms.uSnow.value = 0;
  });

  // Colliders & triggers
  useMemo(() => {
    rt.resetScene(`interior:${building.id}`);
    const { w, d } = L;
    const c = rt.collision;
    c.bounds = { minX: -w / 2, maxX: w / 2, minZ: -d / 2, maxZ: d / 2 + 2 };
    c.addBox(0, -d / 2 - 0.25, w + 1, 0.5, 0, 10);
    c.addBox(-w / 2 - 0.25, 0, 0.5, d, 0, 10);
    c.addBox(w / 2 + 0.25, 0, 0.5, d, 0, 10);
    c.addBox(-w / 4 - 1.2, d / 2 + 0.25, w / 2 - 2.4, 0.5, 0, 10);
    c.addBox(w / 4 + 1.2, d / 2 + 0.25, w / 2 - 2.4, 0.5, 0, 10);
    // Doorway: in line with the front wall so the camera never ends up inside the wall
    c.addBox(0, d / 2 + 0.25, 4.8, 0.5, 0, 10);
    for (const so of built.solids) c.addBox(so.x, so.z, so.w, so.d, 0, so.h, undefined, so.rot ?? 0);
    L.spots.slice(0, stations.length).forEach((s, i) => {
      const cx = s.x + Math.sin(s.rot) * 1.6;
      const cz = s.z + Math.cos(s.rot) * 1.6;
      c.addBox(cx, cz, 3.4, 1.1, 0, 1.2, undefined, s.rot);
      const st = stations[i];
      rt.triggers.push({
        id: `station:${building.id}:${i}`,
        kind: 'station',
        x: s.x + Math.sin(s.rot) * 3.2,
        z: s.z + Math.cos(s.rot) * 3.2,
        r: 2.2,
        label: st.label,
        icon: st.icon,
        data: { activity: st.activity, service: st.service, building: building.id },
      });
    });
    rt.triggers.push({ id: 'exit', kind: 'exit', x: 0, z: d / 2 - 0.8, r: 1.8, label: 'Leave building', icon: '🚪', data: { building: building.id } });
  }, [L, building.id, stations, built]);

  useEffect(() => {
    // Start a few steps inside, facing into the room, with the camera already clear of the doorway
    rt.teleport(0, L.d / 2 - 4.6, Math.PI);
    rt.camYaw = 0;
    rt.camPitch = 0.42;
    rt.camDist = 4.2;
    const t = setTimeout(() => useUI.getState().setLoading({ active: false, progress: 1 }), 80);
    return () => clearTimeout(t);
  }, [L]);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return;
    e.stopPropagation();
    walkTo(e.point.x, e.point.z);
  };

  return (
    <group>
      <mesh geometry={geo} material={M.vc} onClick={onClick} receiveShadow />
      <mesh geometry={built.glow} material={M.neon} />
      <mesh geometry={built.glass} material={GLASS_MAT} renderOrder={2} />
      {/* Warm ceiling lighting spread across the room */}
      {[-L.w / 3, 0, L.w / 3].flatMap((x) =>
        [-L.d / 4, L.d / 4].map((z) => <pointLight key={`${x}:${z}`} position={[x, L.h - 1.4, z]} intensity={9} distance={L.w * 0.6} color="#ffe9c4" decay={1.4} />),
      )}
      <People actors={built.actors} seed={building.id.length * 131} />
      {kind.windows && !L.sides && <SunShafts L={L} />}
      {L.spots.slice(0, stations.length).map((s, i) => (
        <Station key={i} st={stations[i]} x={s.x} z={s.z} rot={s.rot} ceiling={L.h} />
      ))}
    </group>
  );
}

function Station({ st, x, z, rot, ceiling }: { st: StationDef; x: number; z: number; rot: number; ceiling: number }) {
  const city = useScene((s) => s.location);
  const signMats = useMemo(() => boardMaterials(st.label, 3.4, 0.62, city, 'letters'), [st.label, city]);
  const look = st.npc ? (npcs.looks[st.npc as keyof typeof npcs.looks] as unknown as AvatarConfig) : null;
  const anim = useRef({ speed: 0, grounded: true, wave: 0 });
  const npc = useRef<THREE.Group>(null);
  useFrame(() => {
    const tx = x + Math.sin(rot) * 3.2;
    const tz = z + Math.cos(rot) * 3.2;
    const near = Math.hypot(rt.player.x - tx, rt.player.z - tz) < 4;
    anim.current.wave = near ? 1 : 0;
    if (npc.current) {
      const target = near ? Math.atan2(rt.player.x - x, rt.player.z - z) : rot;
      npc.current.rotation.y += (target - npc.current.rotation.y) * 0.1;
    }
  });
  return (
    <group position={[x, 0, z]}>
      {look ? (
        <group ref={npc} rotation={[0, rot, 0]}>
          <Avatar config={look} anim={anim} />
        </group>
      ) : (
        // Self-service terminal (ATM / kiosk): steel cabinet, recessed lit screen, keypad, card slot
        <group rotation={[0, rot, 0]}>
          <mesh position={[0, 1.15, 0]} castShadow>
            <boxGeometry args={[1.1, 2.3, 0.8]} />
            <meshLambertMaterial color="#5d636e" />
          </mesh>
          <mesh position={[0, 2.38, 0.05]}>
            <boxGeometry args={[1.16, 0.16, 0.9]} />
            <meshLambertMaterial color="#2f343c" />
          </mesh>
          <mesh position={[0, 1.62, 0.405]}>
            <planeGeometry args={[0.72, 0.52]} />
            <meshLambertMaterial color="#163d3a" emissive="#5fd0c0" emissiveIntensity={0.55} />
          </mesh>
          <mesh position={[0, 1.08, 0.46]} rotation={[-0.5, 0, 0]}>
            <boxGeometry args={[0.6, 0.06, 0.34]} />
            <meshLambertMaterial color="#3a3f48" />
          </mesh>
          <mesh position={[0.3, 1.32, 0.405]}>
            <planeGeometry args={[0.18, 0.04]} />
            <meshBasicMaterial color="#0d0f12" />
          </mesh>
        </group>
      )}
      {/* Hanging wayfinding sign on two ceiling rods */}
      <group position={[Math.sin(rot) * 1.6, 3.4, Math.cos(rot) * 1.6]} rotation={[0, rot, 0]}>
        {[-1.2, 1.2].map((rx) => (
          <mesh key={rx} position={[rx, (ceiling - 3.4) / 2, 0]}>
            <boxGeometry args={[0.03, ceiling - 3.4, 0.03]} />
            <meshLambertMaterial color="#8d939c" />
          </mesh>
        ))}
        <group position={[0, 0, 0.06]}>
          <BoardSign w={3.4} h={0.62} mats={signMats} depth={0.12} />
        </group>
        <group position={[0, 0, -0.06]} rotation={[0, Math.PI, 0]}>
          <BoardSign w={3.4} h={0.62} mats={signMats} depth={0.12} />
        </group>
      </group>
      {/* Service mat in front of the counter (where to stand) */}
      <mesh position={[Math.sin(rot) * 3.2, 0.012, Math.cos(rot) * 3.2]} rotation={[-Math.PI / 2, 0, -rot]} receiveShadow>
        <planeGeometry args={[2.2, 1.3]} />
        <meshLambertMaterial color="#3b3f47" />
      </mesh>
      <mesh position={[Math.sin(rot) * 3.2, 0.014, Math.cos(rot) * 3.2]} rotation={[-Math.PI / 2, 0, -rot]}>
        <ringGeometry args={[0.62, 0.66, 4, 1, Math.PI / 4]} />
        <meshLambertMaterial color="#b89a4e" />
      </mesh>
    </group>
  );
}
