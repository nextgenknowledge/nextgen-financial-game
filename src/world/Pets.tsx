'use client';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '@/store/game';
import { useSettings } from '@/store/settings';
import { isPaused } from '@/store/ui';
import { rt } from '@/engine/runtime';
import { findPath, lineClear } from '@/engine/nav';
import { VoxelBuilder, sphere, trs } from '@/engine/voxel';
import type { OwnedPet } from '@/game/types';

/*
 * Pets you own walk with you, outdoors and inside buildings. Each one heads for a spot just
 * behind you; when the straight line there is blocked it asks the guide's A* grid (nav.ts) for a
 * route. When you stop it sits a little way off, and it never settles in a doorway. Riding a
 * vehicle tucks your pets away; they hop out beside you when you get off.
 *
 * Cost: one merged mesh per pet plus four legs on Medium/High (one mesh, no leg swing on Low),
 * at most 1 / 2 / 3 pets shown on Low / Medium / High, and routes are only searched when the
 * straight line is blocked, a few times a second at most.
 */

type Kind = 'dog' | 'cat' | 'bunny' | 'pony' | 'turtle' | 'hamster' | 'parrot';
const WALKERS: Kind[] = ['dog', 'cat', 'bunny', 'pony', 'turtle'];

interface Spec {
  /** Gap kept from the player when idle (metres). */
  keep: number;
  /** Top speed when catching up; the player runs at 8.5. */
  run: number;
  radius: number;
  /** Hip height and leg length for the walk cycle. */
  hip: number;
  leg: number;
  /** Leg positions [x, z] under the body. */
  legs: [number, number][];
  legW: number;
}

const SPECS: Record<Kind, Spec> = {
  dog: { keep: 1.7, run: 9, radius: 0.3, hip: 0.36, leg: 0.36, legs: [[0.1, 0.24], [-0.1, 0.24], [0.1, -0.24], [-0.1, -0.24]], legW: 0.09 },
  cat: { keep: 1.5, run: 9, radius: 0.22, hip: 0.25, leg: 0.25, legs: [[0.07, 0.17], [-0.07, 0.17], [0.07, -0.17], [-0.07, -0.17]], legW: 0.06 },
  bunny: { keep: 1.4, run: 8.6, radius: 0.2, hip: 0.1, leg: 0.1, legs: [[0.08, 0.1], [-0.08, 0.1], [0.09, -0.1], [-0.09, -0.1]], legW: 0.07 },
  pony: { keep: 2.6, run: 9.5, radius: 0.55, hip: 0.8, leg: 0.8, legs: [[0.16, 0.42], [-0.16, 0.42], [0.16, -0.42], [-0.16, -0.42]], legW: 0.13 },
  turtle: { keep: 1.4, run: 8.5, radius: 0.28, hip: 0.1, leg: 0.1, legs: [[0.2, 0.18], [-0.2, 0.18], [0.2, -0.18], [-0.2, -0.18]], legW: 0.1 },
  hamster: { keep: 1.4, run: 9, radius: 0.27, hip: 0, leg: 0, legs: [], legW: 0 },
  parrot: { keep: 1.2, run: 12, radius: 0.15, hip: 0, leg: 0, legs: [], legW: 0 },
};

const PALETTES: Record<Kind, string[][]> = {
  // [main, secondary, dark details]
  dog: [['#b77b43', '#f1dcc0', '#3a2618'], ['#e2b25e', '#f6e6c4', '#4a3420'], ['#2b2a2e', '#f2f0ea', '#111114'], ['#f1ece2', '#c9874b', '#2a2018']],
  cat: [['#e08a3c', '#f6dcc0', '#3a2414'], ['#8f949c', '#e6e8ea', '#26282c'], ['#232328', '#f4f2ee', '#0d0d10'], ['#f2ece0', '#d9a46e', '#3a2a1c']],
  bunny: [['#f4f1ea', '#f2b8c4', '#3a2a2a'], ['#9a7a5a', '#e9dcc8', '#2a1c12'], ['#6e6a66', '#e6e2dc', '#1e1c1a']],
  pony: [['#8a5a34', '#2a1c12', '#1a120c'], ['#e9e2d6', '#9a8a78', '#3a3028'], ['#4a3a30', '#e9e2d6', '#1a120c']],
  turtle: [['#5a8a3c', '#3c6a2a', '#a8c46a']],
  hamster: [['#e6b070', '#fbe8cf', '#3a2414']],
  parrot: [['#2fae4f', '#e83a2e', '#f2c234'], ['#2f7fd6', '#f2c234', '#1e2840']],
};

const kindOf = (itemId: string): Kind | null => ((WALKERS as string[]).includes(itemId) || itemId === 'hamster' || itemId === 'parrot' ? (itemId as Kind) : null);

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export const petMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
const ballMaterial = new THREE.MeshLambertMaterial({ color: '#cfeefa', transparent: true, opacity: 0.35, depthWrite: false });

const geoCache = new Map<string, { body: THREE.BufferGeometry; leg: THREE.BufferGeometry | null }>();

/** Body (and one leg shape) for a pet. With `merged`, legs are baked into the body for Low quality. */
function buildPet(kind: Kind, pal: string[], merged: boolean) {
  const key = `${kind}|${pal.join()}|${merged}`;
  const hit = geoCache.get(key);
  if (hit) return hit;
  const [c, c2, d] = pal;
  const b = new VoxelBuilder();
  const S = SPECS[kind];
  const eyes = (x: number, y: number, z: number, s = 0.04) => {
    b.box(x, y, z, s, s, 0.02, d);
    b.box(-x, y, z, s, s, 0.02, d);
  };
  switch (kind) {
    case 'dog':
      b.box(0, 0.48, 0, 0.3, 0.26, 0.64, c);
      b.box(0, 0.44, 0.06, 0.26, 0.12, 0.4, c2);
      b.box(0, 0.68, 0.38, 0.26, 0.26, 0.26, c);
      b.box(0, 0.62, 0.55, 0.14, 0.12, 0.14, c2);
      b.box(0, 0.66, 0.62, 0.06, 0.05, 0.03, d);
      b.box(0.13, 0.7, 0.36, 0.05, 0.18, 0.1, d);
      b.box(-0.13, 0.7, 0.36, 0.05, 0.18, 0.1, d);
      eyes(0.07, 0.74, 0.515);
      b.box(0, 0.6, -0.38, 0.06, 0.06, 0.22, c, { rotY: 0 });
      break;
    case 'cat':
      b.box(0, 0.33, 0, 0.2, 0.18, 0.46, c);
      b.box(0, 0.47, 0.27, 0.2, 0.18, 0.18, c);
      b.box(0, 0.43, 0.37, 0.1, 0.07, 0.04, c2);
      b.box(0.065, 0.59, 0.26, 0.06, 0.07, 0.05, c);
      b.box(-0.065, 0.59, 0.26, 0.06, 0.07, 0.05, c);
      eyes(0.05, 0.5, 0.365, 0.035);
      b.box(0, 0.5, -0.3, 0.04, 0.32, 0.04, c);
      break;
    case 'bunny':
      b.box(0, 0.22, -0.02, 0.24, 0.22, 0.3, c);
      b.box(0, 0.33, 0.16, 0.17, 0.16, 0.16, c);
      b.box(0.045, 0.5, 0.14, 0.05, 0.22, 0.04, c);
      b.box(-0.045, 0.5, 0.14, 0.05, 0.22, 0.04, c);
      b.box(0.045, 0.5, 0.162, 0.02, 0.16, 0.01, c2);
      b.box(-0.045, 0.5, 0.162, 0.02, 0.16, 0.01, c2);
      eyes(0.05, 0.36, 0.245, 0.03);
      b.box(0, 0.26, -0.19, 0.08, 0.08, 0.06, '#ffffff');
      break;
    case 'pony':
      b.box(0, 1.05, 0, 0.4, 0.42, 1.0, c);
      b.box(0, 1.35, 0.5, 0.2, 0.5, 0.22, c, { rotY: 0 });
      b.box(0, 1.6, 0.66, 0.2, 0.22, 0.42, c);
      b.box(0, 1.54, 0.86, 0.17, 0.14, 0.06, d);
      b.box(0, 1.6, 0.45, 0.06, 0.45, 0.16, c2);
      b.box(0.06, 1.75, 0.55, 0.05, 0.1, 0.05, c);
      b.box(-0.06, 1.75, 0.55, 0.05, 0.1, 0.05, c);
      eyes(0.1, 1.66, 0.74, 0.04);
      b.box(0, 0.98, -0.55, 0.08, 0.45, 0.08, c2);
      break;
    case 'turtle':
      b.geom(sphere(0.3, 10, 6), trs(0, 0.12, 0, 0, 0, 0, 1, 0.55, 1.2), c);
      b.box(0, 0.08, 0, 0.5, 0.06, 0.6, c3(c2));
      for (const [x, z] of [[0.1, 0.1], [-0.12, -0.08], [0.06, -0.18], [-0.04, 0.2]]) b.box(x, 0.28, z, 0.12, 0.03, 0.12, c2);
      b.box(0, 0.16, 0.38, 0.12, 0.1, 0.14, d === '#a8c46a' ? '#8fae58' : d);
      eyes(0.04, 0.2, 0.452, 0.025);
      break;
    case 'hamster':
      b.geom(sphere(0.11, 8, 6), trs(0, 0.13, 0, 0, 0, 0, 1, 0.85, 1.25), c);
      b.geom(sphere(0.07, 6, 5), trs(0, 0.11, 0.06, 0, 0, 0, 1.1, 0.8, 1), c2);
      b.box(0.05, 0.23, 0.04, 0.04, 0.04, 0.02, d);
      b.box(-0.05, 0.23, 0.04, 0.04, 0.04, 0.02, d);
      eyes(0.04, 0.17, 0.13, 0.02);
      break;
    case 'parrot':
      b.box(0, 0, 0, 0.14, 0.2, 0.14, c);
      b.box(0, 0.15, 0.03, 0.12, 0.12, 0.12, c);
      b.box(0, 0.13, 0.11, 0.04, 0.06, 0.06, d);
      b.box(0, -0.18, -0.08, 0.08, 0.2, 0.04, c2);
      eyes(0.05, 0.18, 0.09, 0.025);
      b.box(0.09, 0.02, 0, 0.04, 0.14, 0.12, c2);
      b.box(-0.09, 0.02, 0, 0.04, 0.14, 0.12, c2);
      break;
  }
  let leg: THREE.BufferGeometry | null = null;
  if (S.legs.length) {
    if (merged) for (const [x, z] of S.legs) b.box(x, S.hip - S.leg / 2, z, S.legW, S.leg, S.legW, kind === 'pony' ? d : c);
    else {
      const lb = new VoxelBuilder();
      // Pivot at the hip: the leg hangs down from y = 0
      lb.box(0, -S.leg / 2, 0, S.legW, S.leg, S.legW, kind === 'pony' ? d : c);
      if (kind === 'pony') lb.box(0, -S.leg + 0.04, 0, S.legW + 0.02, 0.08, S.legW + 0.02, '#1a120c');
      leg = lb.build();
    }
  }
  const out = { body: b.build(), leg };
  geoCache.set(key, out);
  return out;
}
function c3(hex: string) {
  return '#' + new THREE.Color(hex).multiplyScalar(0.85).getHexString();
}

const MAX_SHOWN = { low: 1, medium: 2, high: 3 } as const;

export function PlayerPets() {
  const pets = useGame((s) => s.world?.assets.pets);
  const quality = useSettings((s) => s.quality);
  const shown = useMemo(() => (pets ?? []).filter((p) => kindOf(p.itemId)).slice(0, MAX_SHOWN[quality]), [pets, quality]);
  return (
    <>
      {shown.map((p, i) => (
        <Pet key={p.uid} pet={p} slot={i} low={quality === 'low'} />
      ))}
    </>
  );
}

const DOOR_KINDS = new Set(['door', 'exit', 'portal']);
const DOOR_CLEAR = 2.2;

/** Push a spot out of any doorway so pets never park where you walk in and out. */
function awayFromDoors(x: number, z: number): [number, number] {
  for (const t of rt.triggers) {
    if (!DOOR_KINDS.has(t.kind)) continue;
    const dx = x - t.x;
    const dz = z - t.z;
    const d = Math.hypot(dx, dz);
    if (d < DOOR_CLEAR) {
      const k = (DOOR_CLEAR - d) / (d || 1);
      x += (d ? dx : 1) * k;
      z += (d ? dz : 0) * k;
    }
  }
  return [x, z];
}

function nearDoor(x: number, z: number) {
  return rt.triggers.some((t) => DOOR_KINDS.has(t.kind) && Math.hypot(x - t.x, z - t.z) < DOOR_CLEAR - 0.3);
}

function Pet({ pet, slot, low }: { pet: OwnedPet; slot: number; low: boolean }) {
  const kind = kindOf(pet.itemId)!;
  const S = SPECS[kind];
  const pals = PALETTES[kind];
  const pal = pals[hash(pet.uid) % pals.length];
  const geo = useMemo(() => buildPet(kind, pal, low), [kind, pal, low]);
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const legs = useRef<(THREE.Group | null)[]>([]);
  const st = useRef({
    pos: new THREE.Vector3(),
    yaw: 0,
    speed: 0,
    phase: Math.random() * 6,
    idle: 0,
    scene: '',
    path: null as [number, number][] | null,
    pi: 0,
    repath: slot * 0.23,
    pathFor: new THREE.Vector2(Infinity, Infinity),
    hidden: false,
  });

  useFrame((state, rawDt) => {
    const g = root.current;
    if (!g) return;
    const s = st.current;
    const dt = isPaused() ? 0 : Math.min(rawDt, 0.05);
    const p = rt.player;
    const yaw = rt.playerRotY;

    // Slot spot: behind the player, alternating sides
    const side = slot % 2 === 0 ? 1 : -1;
    const back = S.keep + Math.floor(slot / 2) * 0.6;
    const ang = yaw + Math.PI + side * (0.55 + Math.floor(slot / 2) * 0.35);
    let [tx, tz] = awayFromDoors(p.x + Math.sin(ang) * back, p.z + Math.cos(ang) * back);

    const place = () => {
      // Out of sight jumps (new scene, far behind): appear at the slot, or by the player if it's blocked
      const ok = lineClear(rt.collision, rt.sceneKey, p.x, p.z, tx, tz);
      s.pos.set(ok ? tx : p.x - Math.sin(yaw) * 0.8, 0, ok ? tz : p.z - Math.cos(yaw) * 0.8);
      s.path = null;
      s.speed = 0;
    };

    // Riding: tucked away, ready to hop out where you get off
    if (rt.vehicle) {
      g.visible = false;
      s.hidden = true;
      return;
    }
    if (s.hidden || s.scene !== rt.sceneKey) {
      s.hidden = false;
      s.scene = rt.sceneKey;
      place();
      g.visible = true;
    }

    const dPlayer = Math.hypot(s.pos.x - p.x, s.pos.z - p.z);
    if (dPlayer > 26) place();

    const t = state.clock.elapsedTime;
    if (kind === 'parrot') {
      // Flies: no route needed, perches in the air beside your shoulder
      const px = p.x + Math.cos(yaw) * -0.7 * side + Math.sin(yaw) * -0.3;
      const pz = p.z - Math.sin(yaw) * -0.7 * side + Math.cos(yaw) * -0.3;
      const k = Math.min(1, dt * 3.5);
      s.pos.x += (px - s.pos.x) * k;
      s.pos.z += (pz - s.pos.z) * k;
      g.position.set(s.pos.x, 2.25 + Math.sin(t * 3 + slot) * 0.08, s.pos.z);
      turnTo(s, yaw, dt, 6);
      g.rotation.y = s.yaw;
      if (body.current) body.current.rotation.z = Math.sin(t * 14) * 0.25;
      return;
    }

    // Close enough and not in a doorway: idle
    const dSlot = Math.hypot(s.pos.x - tx, s.pos.z - tz);
    const settled = dPlayer < back + 0.7 && rt.playerSpeed < 0.5 && !nearDoor(s.pos.x, s.pos.z);
    let want = 0;
    let gx = tx;
    let gz = tz;
    if (!settled && dSlot > 0.35) {
      // Straight there if nothing is in the way, otherwise along an A* route
      if (lineClear(rt.collision, rt.sceneKey, s.pos.x, s.pos.z, tx, tz)) s.path = null;
      else {
        s.repath -= dt;
        const moved = Math.hypot(s.pathFor.x - tx, s.pathFor.y - tz) > 1.2;
        if (!s.path || (s.repath <= 0 && moved)) {
          s.repath = low ? 1.4 : 0.7;
          s.pathFor.set(tx, tz);
          s.path = findPath(rt.collision, rt.sceneKey, s.pos.x, s.pos.z, tx, tz, 0.6);
          s.pi = 1;
        }
        if (s.path) {
          while (s.pi < s.path.length - 1 && Math.hypot(s.path[s.pi][0] - s.pos.x, s.path[s.pi][1] - s.pos.z) < 0.45) s.pi++;
          [gx, gz] = s.path[Math.min(s.pi, s.path.length - 1)];
        }
      }
      // Trot to keep up, sprint when far behind, ease off as it arrives
      want = Math.min(S.run, 1.2 + dSlot * 1.9 + (dPlayer > back + 4 ? 3 : 0));
    }
    s.speed += (want - s.speed) * Math.min(1, dt * (want > s.speed ? 5 : 8));
    if (s.speed > 0.05) {
      const dx = gx - s.pos.x;
      const dz = gz - s.pos.z;
      const L = Math.hypot(dx, dz) || 1;
      const step = Math.min(L, s.speed * dt);
      const nx = s.pos.x + (dx / L) * step;
      const nz = s.pos.z + (dz / L) * step;
      const q = { x: nx, y: 0, z: nz };
      rt.collision.resolve(q, S.radius, 0.6);
      rt.collision.resolveWater(q, S.radius);
      s.pos.set(q.x, 0, q.z);
      turnTo(s, Math.atan2(dx, dz), dt, 8);
      s.idle = 0;
    } else {
      // Idle: turn to look at you
      s.idle += dt;
      turnTo(s, Math.atan2(p.x - s.pos.x, p.z - s.pos.z), dt, 3);
    }

    // Animate
    const moving = Math.min(1, s.speed / 4);
    s.phase += dt * (3 + s.speed * 2.2);
    const swing = Math.sin(s.phase) * 0.7 * moving;
    let y = 0;
    let pitch = 0;
    if (kind === 'bunny') y = Math.abs(Math.sin(s.phase * 0.8)) * 0.18 * moving;
    else if (kind === 'hamster') {
      if (body.current) body.current.rotation.x += (s.speed * dt) / 0.27;
    } else y = Math.abs(Math.sin(s.phase)) * 0.025 * moving;
    // Dogs and cats sit down after a moment of standing still
    const sit = (kind === 'dog' || kind === 'cat') && s.idle > 1.2;
    if (sit) pitch = -0.32;
    if (!low)
      legs.current.forEach((l, i) => {
        if (!l) return;
        const front = i < 2;
        l.rotation.x = sit && !front ? -1.2 : (i === 0 || i === 3 ? swing : -swing);
      });
    g.position.set(s.pos.x, y + (sit ? -0.05 : 0), s.pos.z);
    g.rotation.y = s.yaw;
    if (body.current && kind !== 'hamster') body.current.rotation.x += (pitch - body.current.rotation.x) * Math.min(1, dt * 6);
  });

  return (
    <group ref={root} visible={false} name={`pet:${pet.itemId}`}>
      {kind === 'hamster' ? (
        <>
          <group ref={body} position={[0, 0.27, 0]}>
            <mesh geometry={sphere(0.27, 12, 8)} material={ballMaterial} renderOrder={2} />
          </group>
          <mesh geometry={geo.body} material={petMaterial} />
        </>
      ) : (
        <group ref={body} position={[0, S.hip * 0.5, 0]}>
          <group position={[0, -S.hip * 0.5, 0]}>
            <mesh geometry={geo.body} material={petMaterial} castShadow={!low} />
            {!low &&
              geo.leg &&
              S.legs.map(([x, z], i) => (
                <group key={i} ref={(el) => void (legs.current[i] = el)} position={[x, S.hip, z]}>
                  <mesh geometry={geo.leg!} material={petMaterial} />
                </group>
              ))}
          </group>
        </group>
      )}
    </group>
  );
}

function turnTo(s: { yaw: number }, target: number, dt: number, rate: number) {
  let d = target - s.yaw;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  s.yaw += d * Math.min(1, dt * rate);
}
