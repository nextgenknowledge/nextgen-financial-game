'use client';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VoxelBuilder, cylinder, trs } from '@/engine/voxel';
import { vehicleDef, type VehicleDef } from '@/engine/vehicles';
import type { AvatarConfig } from '@/game/types';
import { Avatar } from './Avatar';
import { rt } from '@/engine/runtime';

export const vehicleMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });

const geoCache = new Map<string, THREE.BufferGeometry>();

function shade(hex: string, f: number) {
  return '#' + new THREE.Color(hex).multiplyScalar(f).getHexString();
}

export function buildVehicle(def: VehicleDef, colorOverride?: string): THREE.BufferGeometry {
  const key = def.id + (colorOverride ?? '');
  const cached = geoCache.get(key);
  if (cached) return cached;
  const b = new VoxelBuilder();
  const c = colorOverride ?? def.color;
  const dark = '#2a2f3d';
  const glass = '#9fd3f0';
  const wheel = (x: number, z: number, r: number, w: number) =>
    b.geom(cylinder(r, r, w, 10), trs(x, r, z, 0, 0, Math.PI / 2), dark);
  switch (def.type) {
    case 'bike': {
      wheel(0, 0.62, 0.36, 0.08);
      wheel(0, -0.62, 0.36, 0.08);
      b.box(0, 0.62, 0, 0.08, 0.08, 1.1, c);
      b.box(0, 0.8, -0.25, 0.08, 0.5, 0.08, c, { rotY: 0 });
      b.box(0, 1.05, -0.3, 0.2, 0.06, 0.3, dark);
      b.box(0, 1.0, 0.5, 0.06, 0.6, 0.06, '#c0c4cc');
      b.box(0, 1.28, 0.5, 0.6, 0.06, 0.06, dark);
      break;
    }
    case 'scooter': {
      wheel(0, 0.55, 0.18, 0.1);
      wheel(0, -0.55, 0.18, 0.1);
      b.box(0, 0.25, 0, 0.32, 0.08, 1.2, c);
      b.box(0, 0.75, 0.55, 0.08, 1.0, 0.08, '#c0c4cc');
      b.box(0, 1.25, 0.55, 0.6, 0.07, 0.07, dark);
      b.box(0, 0.32, 0.55, 0.3, 0.12, 0.16, c);
      break;
    }
    case 'kart': {
      for (const [x, z] of [[0.6, 0.7], [-0.6, 0.7], [0.6, -0.65], [-0.6, -0.65]]) wheel(x, z, 0.24, 0.22);
      b.block(0, 0.15, 0, 1.1, 0.2, 1.8, c);
      b.block(0, 0.35, -0.35, 0.6, 0.5, 0.5, dark);
      b.block(0, 0.35, 0.75, 1.0, 0.18, 0.3, shade(c, 0.8));
      b.block(0, 0.6, 0.45, 0.06, 0.4, 0.06, dark);
      b.block(0, 0.95, 0.4, 0.4, 0.06, 0.06, dark);
      break;
    }
    case 'car': {
      const truck = def.id === 'pickup';
      const sporty = def.id === 'sports';
      const L = truck ? 4.4 : sporty ? 4.0 : 3.6;
      const H = sporty ? 0.55 : 0.75;
      for (const [x, z] of [[0.82, L / 2 - 0.75], [-0.82, L / 2 - 0.75], [0.82, -L / 2 + 0.75], [-0.82, -L / 2 + 0.75]]) wheel(x, z, 0.36, 0.3);
      b.block(0, 0.3, 0, 1.8, H, L, c);
      // Cabin
      const cabZ = truck ? 0.5 : sporty ? -0.2 : -0.1;
      const cabL = truck ? 1.6 : sporty ? 1.7 : 2.0;
      b.block(0, 0.3 + H, cabZ, 1.62, sporty ? 0.5 : 0.68, cabL, shade(c, 0.95));
      b.block(0, 0.36 + H, cabZ + cabL / 2 - 0.02, 1.5, sporty ? 0.38 : 0.52, 0.06, glass);
      b.block(0, 0.36 + H, cabZ - cabL / 2 + 0.02, 1.5, sporty ? 0.38 : 0.5, 0.06, glass);
      b.block(0.81, 0.36 + H, cabZ, 0.04, sporty ? 0.36 : 0.5, cabL - 0.3, glass);
      b.block(-0.81, 0.36 + H, cabZ, 0.04, sporty ? 0.36 : 0.5, cabL - 0.3, glass);
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
      b.block(0, 0.4, 0, W - 0.2, 0.08, L - 0.6, shade(c, 0.75));
      b.block(0, -0.25, 0, W + 0.02, 0.12, L + 0.02, big ? '#2f6bdb' : '#ffffff');
      if (big) {
        b.block(0, 0.4, 0.6, 1.6, 0.6, 0.12, glass);
        b.block(0, 0.4, -0.8, 1.2, 0.35, 1.1, '#e8dcc0');
      } else {
        b.block(0, 0.45, 0, 0.06, 0.06, 2.6, '#8a6a3c', { rotY: 0.4 });
      }
      break;
    }
    case 'plane': {
      b.block(0, 0.9, 0, 1.3, 1.2, 5.2, c);
      b.block(0, 1.0, 2.75, 0.9, 0.9, 0.5, shade(c, 0.9));
      b.block(0, 1.35, 1.1, 1.1, 0.6, 1.2, glass);
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
  const g = b.build();
  geoCache.set(key, g);
  return g;
}

const RIDER: Record<string, { y: number; z: number; seated: boolean; scale?: number; hide?: boolean }> = {
  bike: { y: 0.42, z: -0.15, seated: false },
  scooter: { y: 0.3, z: 0, seated: false },
  kart: { y: -0.15, z: -0.3, seated: true },
  car: { y: 0.15, z: -0.1, seated: true },
  boat: { y: -0.15, z: -0.4, seated: true },
  plane: { y: 0.6, z: 1.0, seated: true },
};

export function VehicleModel({ itemId, rider, color }: { itemId: string; rider?: AvatarConfig; color?: string }) {
  const def = vehicleDef(itemId);
  const geo = useMemo(() => (def ? buildVehicle(def, color) : null), [def, color]);
  const tilt = useRef<THREE.Group>(null);
  const anim = useRef({ speed: 0, grounded: true });
  useFrame((state) => {
    if (!tilt.current || !rt.vehicle || !def) return;
    // Lean bikes into turns / bob boats
    if (def.type === 'boat') {
      tilt.current.rotation.z = Math.sin(state.clock.elapsedTime * 1.6) * 0.04;
      tilt.current.rotation.x = -Math.min(0.12, rt.vehicle.speed * 0.006);
    } else if (def.type === 'plane') {
      tilt.current.rotation.x = rt.vehicle.alt > 0.5 ? -0.08 : 0;
    }
  });
  if (!def || !geo) return null;
  const r = RIDER[def.type];
  return (
    <group ref={tilt}>
      <mesh geometry={geo} material={vehicleMaterial} castShadow />
      {rider && (
        <group position={[0, r.y, r.z]}>
          <group position={[0, r.seated ? -0.45 : 0, 0]} scale={r.seated ? [1, 1, 1] : 1}>
            <Avatar config={rider} anim={anim} />
          </group>
        </group>
      )}
    </group>
  );
}
