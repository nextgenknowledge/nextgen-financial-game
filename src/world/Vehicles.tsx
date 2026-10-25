'use client';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VoxelBuilder, cylinder, trs } from '@/engine/voxel';
import { vehicleDef, type VehicleDef } from '@/engine/vehicles';
import type { AvatarConfig } from '@/game/types';
import { Avatar, type AnimState } from './Avatar';
import { rt } from '@/engine/runtime';

export const vehicleMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
/** Windows are see-through so you can watch the driver at the wheel. */
const glassMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.32, depthWrite: false });

interface VehicleGeo {
  body: THREE.BufferGeometry;
  glass: THREE.BufferGeometry | null;
}
const geoCache = new Map<string, VehicleGeo>();

function shade(hex: string, f: number) {
  return '#' + new THREE.Color(hex).multiplyScalar(f).getHexString();
}

/** Car body sizes, shared by the model and the driver's seat. */
function carDims(def: VehicleDef) {
  const truck = def.id === 'pickup';
  const sporty = def.id === 'sports';
  const L = truck ? 4.4 : sporty ? 4.0 : 3.6;
  const H = sporty ? 0.55 : 0.75;
  const belt = 0.3 + H;
  const cabH = sporty ? 0.62 : 0.72;
  const cabZ = truck ? 0.5 : sporty ? -0.2 : -0.1;
  const cabL = truck ? 1.6 : sporty ? 1.7 : 2.0;
  return { truck, sporty, L, H, belt, cabH, cabZ, cabL };
}

export function buildVehicle(def: VehicleDef, colorOverride?: string): VehicleGeo {
  const key = def.id + (colorOverride ?? '');
  const cached = geoCache.get(key);
  if (cached) return cached;
  const b = new VoxelBuilder();
  const gl = new VoxelBuilder();
  let hasGlass = false;
  const c = colorOverride ?? def.color;
  const dark = '#2a2f3d';
  const glass = '#9fd3f0';
  const chrome = '#c0c4cc';
  const pane = (x: number, y0: number, z: number, w: number, h: number, d: number) => {
    gl.block(x, y0, z, w, h, d, glass);
    hasGlass = true;
  };
  const wheel = (x: number, z: number, r: number, w: number) => b.geom(cylinder(r, r, w, 10), trs(x, r, z, 0, 0, Math.PI / 2), dark);
  /** Steering wheel facing a driver who sits behind it (toward -z). */
  const steering = (x: number, y: number, z: number, r = 0.17) => b.geom(cylinder(r, r, 0.05, 12), trs(x, y, z, Math.PI / 2 - 0.45, 0, 0), dark);
  switch (def.type) {
    case 'bike': {
      wheel(0, 0.62, 0.36, 0.08);
      wheel(0, -0.62, 0.36, 0.08);
      b.box(0, 0.62, 0, 0.08, 0.08, 1.1, c);
      // Seat post and saddle
      b.box(0, 0.8, -0.28, 0.08, 0.5, 0.08, c);
      b.box(0, 1.07, -0.3, 0.2, 0.06, 0.3, dark);
      // Fork, a stem that sweeps back toward the rider, and the bars
      b.box(0, 0.95, 0.52, 0.06, 0.66, 0.06, chrome);
      b.box(0, 1.25, 0.43, 0.06, 0.06, 0.2, chrome);
      b.box(0, 1.26, 0.34, 0.62, 0.06, 0.06, dark);
      // Crank and pedals under the saddle
      b.box(0, 0.42, 0.02, 0.1, 0.14, 0.14, dark);
      b.box(0.14, 0.42, 0.1, 0.12, 0.04, 0.14, dark);
      b.box(-0.14, 0.42, -0.06, 0.12, 0.04, 0.14, dark);
      break;
    }
    case 'scooter': {
      wheel(0, 0.55, 0.18, 0.1);
      wheel(0, -0.55, 0.18, 0.1);
      b.box(0, 0.25, 0, 0.32, 0.08, 1.2, c);
      b.box(0, 0.75, 0.55, 0.08, 1.0, 0.08, chrome);
      b.box(0, 1.25, 0.55, 0.6, 0.07, 0.07, dark);
      b.box(0, 0.32, 0.55, 0.3, 0.12, 0.16, c);
      break;
    }
    case 'kart': {
      for (const [x, z] of [[0.6, 0.7], [-0.6, 0.7], [0.6, -0.65], [-0.6, -0.65]]) wheel(x, z, 0.24, 0.22);
      b.block(0, 0.15, 0, 1.1, 0.2, 1.8, c);
      // Low bucket seat with a backrest, so the driver sits in it rather than inside a block
      b.block(0, 0.35, -0.3, 0.56, 0.1, 0.5, dark);
      b.block(0, 0.35, -0.6, 0.56, 0.55, 0.1, dark);
      b.block(0, 0.35, 0.75, 1.0, 0.18, 0.3, shade(c, 0.8));
      b.block(0, 0.35, 0.42, 0.06, 0.48, 0.06, dark);
      steering(0, 0.86, 0.34, 0.15);
      break;
    }
    case 'car': {
      const { truck, sporty, L, H, belt, cabH, cabZ, cabL } = carDims(def);
      for (const [x, z] of [[0.82, L / 2 - 0.75], [-0.82, L / 2 - 0.75], [0.82, -L / 2 + 0.75], [-0.82, -L / 2 + 0.75]]) wheel(x, z, 0.36, 0.3);
      b.block(0, 0.3, 0, 1.8, H, L, c);
      // Hollow cabin: roof, four pillars and glass all round
      const roof = 0.08;
      const pillarH = cabH - roof;
      b.block(0, belt + pillarH, cabZ, 1.62, roof, cabL, shade(c, 0.95));
      for (const [x, z] of [[0.77, cabL / 2 - 0.06], [-0.77, cabL / 2 - 0.06], [0.77, -cabL / 2 + 0.06], [-0.77, -cabL / 2 + 0.06]])
        b.block(x, belt, cabZ + z, 0.08, pillarH, 0.12, shade(c, 0.95));
      pane(0, belt, cabZ + cabL / 2 - 0.04, 1.46, pillarH, 0.04);
      pane(0, belt, cabZ - cabL / 2 + 0.04, 1.46, pillarH, 0.04);
      pane(0.79, belt, cabZ, 0.03, pillarH, cabL - 0.24);
      pane(-0.79, belt, cabZ, 0.03, pillarH, cabL - 0.24);
      // Dashboard, seats and the wheel in front of the driver (left seat, +x)
      const seat = driverSeat(def);
      b.block(0, belt - 0.12, cabZ + cabL / 2 - 0.22, 1.5, 0.18, 0.3, dark);
      steering(seat.x, belt + 0.02, seat.z + 0.58);
      // Seat backs stop below the driver's head so the driver stays visible
      b.block(seat.x, belt - 0.3, seat.z - 0.24, 0.5, sporty ? 0.42 : 0.5, 0.1, dark);
      b.block(-seat.x, belt - 0.3, seat.z - 0.24, 0.5, sporty ? 0.42 : 0.5, 0.1, dark);
      // Lights & bumpers
      b.block(0.6, 0.55, L / 2, 0.36, 0.18, 0.06, '#fff4c2');
      b.block(-0.6, 0.55, L / 2, 0.36, 0.18, 0.06, '#fff4c2');
      b.block(0.6, 0.55, -L / 2, 0.3, 0.16, 0.06, '#ff5a4a');
      b.block(-0.6, 0.55, -L / 2, 0.3, 0.16, 0.06, '#ff5a4a');
      b.block(0, 0.22, L / 2 + 0.05, 1.84, 0.2, 0.12, dark);
      b.block(0, 0.22, -L / 2 - 0.05, 1.84, 0.2, 0.12, dark);
      if (truck) {
        b.block(0.86, 0.3 + H, -1.2, 0.08, 0.4, 1.8, c);
        b.block(-0.86, 0.3 + H, -1.2, 0.08, 0.4, 1.8, c);
        b.block(0, 0.3 + H, -2.15, 1.8, 0.4, 0.08, c);
      }
      if (sporty) b.block(0, 0.3 + H + 0.05, -L / 2 + 0.2, 1.6, 0.08, 0.3, dark);
      break;
    }
    case 'boat': {
      const big = def.id === 'speedboat';
      const L = big ? 5.5 : 3.2;
      const W = big ? 2.1 : 0.8;
      b.block(0, -0.2, 0, W, 0.6, L, c);
      b.block(0, -0.2, L / 2 + 0.3, W * 0.6, 0.6, 0.6, c, { rotY: 0 });
      b.block(0, -0.25, 0, W + 0.02, 0.12, L + 0.02, big ? '#2f6bdb' : '#ffffff');
      if (big) {
        b.block(0, 0.4, 0, W - 0.2, 0.08, L - 0.6, shade(c, 0.75));
        pane(0, 0.4, 0.6, 1.6, 0.6, 0.08);
        // Console with the wheel, and a bench behind it
        b.block(0.35, 0.48, 0.18, 0.6, 0.55, 0.3, '#e8dcc0');
        steering(0.35, 1.1, -0.02);
        b.block(0, 0.4, -0.85, 1.4, 0.35, 0.8, '#e8dcc0');
        b.block(0, 0.4, -1.3, 1.4, 0.7, 0.12, '#e8dcc0');
      } else {
        // Kayak: decks fore and aft, an open cockpit in the middle
        b.block(0, 0.4, 0.95, W - 0.2, 0.08, 1.2, shade(c, 0.75));
        b.block(0, 0.4, -1.05, W - 0.2, 0.08, 1.0, shade(c, 0.75));
        b.block(0, 0.4, -0.2, W - 0.1, 0.1, 0.06, dark);
        b.block(0, 0.4, 0.33, W - 0.1, 0.1, 0.06, dark);
      }
      break;
    }
    case 'plane': {
      b.block(0, 0.9, 0, 1.3, 1.2, 5.2, c);
      b.block(0, 1.0, 2.75, 0.9, 0.9, 0.5, shade(c, 0.9));
      // Canopy on top of the fuselage, with the pilot's head showing through it
      pane(0, 2.1, 1.0, 0.98, 0.46, 1.25);
      b.block(0, 2.54, 1.0, 1.0, 0.05, 1.27, shade(c, 0.85));
      b.block(0, 1.45, 0.3, 9.5, 0.14, 1.4, '#f4f6fa');
      b.block(0, 1.2, -2.3, 3.2, 0.12, 0.8, '#f4f6fa');
      b.block(0, 1.6, -2.4, 0.12, 1.1, 0.8, c);
      b.block(0, 1.0, 3.05, 0.12, 1.8, 0.12, dark); // propeller
      // Floats
      b.block(1.3, 0.1, 0.2, 0.4, 0.35, 4.2, '#f4f6fa');
      b.block(-1.3, 0.1, 0.2, 0.4, 0.35, 4.2, '#f4f6fa');
      b.block(1.3, 0.45, 0.2, 0.08, 0.5, 0.08, dark);
      b.block(-1.3, 0.45, 0.2, 0.08, 0.5, 0.08, dark);
      break;
    }
  }
  const out: VehicleGeo = { body: b.build(), glass: hasGlass ? gl.build() : null };
  geoCache.set(key, out);
  return out;
}

/**
 * Where the rider sits and how. The player is drawn a little smaller on vehicles (RIDER_SCALE)
 * so a grown-up fits in a car cabin. Heights are worked out from the avatar rig: seated, the
 * hips are 0.41 above the rider origin, the shoulders 0.94 and the top of the head 1.43.
 */
const RIDER_SCALE = 0.85;
interface Seat {
  x: number;
  y: number;
  z: number;
  ride: NonNullable<AnimState['ride']>;
  reach?: number;
  lean?: number;
}

function driverSeat(def: VehicleDef): Seat {
  switch (def.type) {
    case 'bike':
      // Hips on the saddle, leaning to the bars
      return { x: 0, y: 0.69, z: -0.3, ride: 'pedal', reach: 0.98, lean: 0.4 };
    case 'scooter':
      return { x: 0, y: 0.29, z: 0.05, ride: 'stand', reach: 0.87, lean: 0.12 };
    case 'kart':
      return { x: 0, y: 0.04, z: -0.3, ride: 'drive', reach: 1.35, lean: 0.02 };
    case 'car': {
      const { sporty, cabZ } = carDims(def);
      // Head clears the roof; left-hand driving seat
      return { x: 0.38, y: sporty ? -0.07 : 0.24, z: cabZ - 0.15, ride: 'drive', reach: 1.35 };
    }
    case 'boat':
      return def.id === 'speedboat' ? { x: 0.35, y: 0.34, z: -0.6, ride: 'drive', reach: 1.25 } : { x: 0, y: -0.26, z: 0.05, ride: 'paddle', reach: 1.25 };
    case 'plane':
      return { x: 0, y: 1.07, z: 1.0, ride: 'drive', reach: 1.3 };
  }
}

/** Kayak paddle: in the rider's hands, dipping side to side in step with the stroke. */
function Paddle({ anim, held }: { anim: React.RefObject<AnimState>; held: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current || !held) return;
    const k = Math.sin((anim.current?.phase ?? 0) * 0.9);
    ref.current.rotation.z = k * 0.42;
  });
  return (
    <group ref={ref} position={held ? [0, 0.47, 0.62] : [0, 0.5, -0.5]} rotation={held ? [0, 0, 0] : [0, 0.4, 0]}>
      <mesh material={vehicleMaterial}>
        <boxGeometry args={[2.3, 0.05, 0.05]} />
      </mesh>
      {[1.1, -1.1].map((x) => (
        <mesh key={x} position={[x, 0, 0]} material={paddleBlade}>
          <boxGeometry args={[0.3, 0.03, 0.18]} />
        </mesh>
      ))}
    </group>
  );
}
const paddleBlade = new THREE.MeshLambertMaterial({ color: '#f2b234' });

export function VehicleModel({ itemId, rider, color }: { itemId: string; rider?: AvatarConfig; color?: string }) {
  const def = vehicleDef(itemId);
  const geo = useMemo(() => (def ? buildVehicle(def, color) : null), [def, color]);
  const seat = useMemo(() => (def ? driverSeat(def) : null), [def]);
  const tilt = useRef<THREE.Group>(null);
  const anim = useRef<AnimState>({ speed: 0, grounded: true });
  if (seat) Object.assign(anim.current, { ride: seat.ride, reach: seat.reach, lean: seat.lean });
  useFrame((state) => {
    if (!tilt.current || !rt.vehicle || !def) return;
    // Pedalling and paddling keep pace with the vehicle
    anim.current.speed = Math.abs(rt.vehicle.speed) / Math.max(1, def.topSpeed);
    // Lean bikes into turns / bob boats
    if (def.type === 'boat') {
      tilt.current.rotation.z = Math.sin(state.clock.elapsedTime * 1.6) * 0.04;
      tilt.current.rotation.x = -Math.min(0.12, rt.vehicle.speed * 0.006);
    } else if (def.type === 'plane') {
      tilt.current.rotation.x = rt.vehicle.alt > 0.5 ? -0.08 : 0;
    }
  });
  if (!def || !geo || !seat) return null;
  return (
    <group ref={tilt}>
      <mesh geometry={geo.body} material={vehicleMaterial} castShadow />
      {geo.glass && <mesh geometry={geo.glass} material={glassMaterial} renderOrder={2} />}
      {def.id === 'kayak' && <Paddle anim={anim} held={!!rider} />}
      {rider && (
        <group position={[seat.x, seat.y, seat.z]} scale={RIDER_SCALE}>
          <Avatar config={rider} anim={anim} />
        </group>
      )}
    </group>
  );
}
