'use client';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useGame } from '@/store/game';
import { rt } from '@/engine/runtime';
import { condoDef } from '@/game/sim/catalog';
import type { CityMapData } from './builders/sceneBuilder';
import { signMaterial } from './signage';

/*
 * A condo you own has its own street entrance: a lobby door with a canopy and a "Residences"
 * sign, set into the face of an ordinary city building close to where you arrive in that city.
 * The spot is worked out from the city layout, so it never covers another building's door, a
 * gate or the water, and it is the same every visit.
 */

interface Spot {
  x: number;
  z: number;
  /** Direction the door faces (out of the building). */
  yaw: number;
}

const CLEAR = 7;

function entranceSpots(footprints: CityMapData['footprints'], from: { x: number; z: number }, n: number): Spot[] {
  const taken = rt.triggers.filter((t) => t.kind === 'door' || t.kind === 'portal' || t.kind === 'npc');
  const out: (Spot & { dist: number })[] = [];
  for (const f of footprints) {
    if (f.kind !== 'building' || f.w < 6 || f.d < 6 || f.h < 6) continue;
    // Spawn point in the footprint's own frame
    const dx = from.x - f.x;
    const dz = from.z - f.z;
    const c = Math.cos(f.rot);
    const s = Math.sin(f.rot);
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    const hw = f.w / 2;
    const hd = f.d / 2;
    if (Math.abs(lx) < hw && Math.abs(lz) < hd) continue;
    // Middle of the face that looks toward the spawn, so the door sits on a full wall
    const overX = Math.abs(lx) - hw;
    const overZ = Math.abs(lz) - hd;
    const [px, pz, nx, nz] = overX > overZ ? [Math.sign(lx) * hw, 0, Math.sign(lx), 0] : [0, Math.sign(lz) * hd, 0, Math.sign(lz)];
    // Back to world space
    const wx = f.x + px * c + pz * s;
    const wz = f.z - px * s + pz * c;
    const wnx = nx * c + nz * s;
    const wnz = -nx * s + nz * c;
    const sx = wx + wnx * 1.2;
    const sz = wz + wnz * 1.2;
    if (rt.collision.inWater(sx, sz, -3)) continue;
    if (taken.some((t) => Math.hypot(t.x - sx, t.z - sz) < CLEAR)) continue;
    // The step in front of the door must be open ground
    const probe = { x: sx, y: 0, z: sz };
    if (rt.collision.resolve(probe, 0.4, 1.6)) continue;
    out.push({ x: wx, z: wz, yaw: Math.atan2(wnx, wnz), dist: Math.hypot(sx - from.x, sz - from.z) });
  }
  out.sort((a, b) => a.dist - b.dist);
  const picked: Spot[] = [];
  for (const o of out) {
    if (picked.some((p) => Math.hypot(p.x - o.x, p.z - o.z) < CLEAR)) continue;
    picked.push(o);
    if (picked.length >= n) break;
  }
  return picked;
}

export function CondoEntrances({ city, footprints, spawn }: { city: string; footprints: CityMapData['footprints']; spawn: { x: number; z: number } }) {
  const props = useGame((s) => s.world?.assets.properties);
  const condos = useMemo(() => (props ?? []).filter((p) => !p.plotId && condoDef(p.itemId)?.city === city), [props, city]);
  const spots = useMemo(() => (condos.length ? entranceSpots(footprints, spawn, condos.length) : []), [condos.length, footprints, spawn]);
  return (
    <>
      {condos.map((p, i) =>
        spots[i] ? <Entrance key={p.uid} spot={spots[i]} propUid={p.uid} rented={p.rented} name={condoDef(p.itemId)!.name} /> : null,
      )}
    </>
  );
}

const frameMat = new THREE.MeshLambertMaterial({ color: '#2a2f3d' });
const doorMat = new THREE.MeshLambertMaterial({ color: '#1d2a3a', emissive: '#0d1a28' });
const canopyMat = new THREE.MeshLambertMaterial({ color: '#1e5a8a' });
const stepMat = new THREE.MeshLambertMaterial({ color: '#b9b2a2' });

function Entrance({ spot, propUid, rented, name }: { spot: Spot; propUid: string; rented: boolean; name: string }) {
  const sign = useMemo(() => signMaterial({ kind: 'letters', text: 'Residences', w: 3, h: 0.5 }), []);
  useEffect(() => {
    const id = `home:${propUid}`;
    rt.triggers = rt.triggers.filter((t) => t.id !== id);
    rt.triggers.push({
      id,
      kind: 'door',
      x: spot.x + Math.sin(spot.yaw) * 1.3,
      z: spot.z + Math.cos(spot.yaw) * 1.3,
      r: 2,
      label: rented ? `${name}: rented to tenants` : `Go home: ${name}`,
      icon: '🏢',
      data: { home: propUid, yaw: spot.yaw },
    });
    return () => {
      rt.triggers = rt.triggers.filter((t) => t.id !== id);
    };
  }, [spot, propUid, rented, name]);
  return (
    <group position={[spot.x, 0, spot.z]} rotation={[0, spot.yaw, 0]}>
      <mesh position={[0, 0.06, 0.7]} material={stepMat} receiveShadow>
        <boxGeometry args={[3.2, 0.12, 1.4]} />
      </mesh>
      <mesh position={[0, 1.4, 0.04]} material={doorMat}>
        <boxGeometry args={[2.2, 2.8, 0.1]} />
      </mesh>
      {[-1.2, 1.2].map((x) => (
        <mesh key={x} position={[x, 1.5, 0.12]} material={frameMat}>
          <boxGeometry args={[0.2, 3.0, 0.24]} />
        </mesh>
      ))}
      <mesh position={[0, 2.98, 0.12]} material={frameMat}>
        <boxGeometry args={[2.6, 0.18, 0.24]} />
      </mesh>
      <mesh position={[0, 3.25, 0.75]} material={canopyMat} castShadow>
        <boxGeometry args={[3.2, 0.14, 1.5]} />
      </mesh>
      <mesh position={[0, 3.62, 0.2]} material={sign}>
        <planeGeometry args={[3, 0.5]} />
      </mesh>
    </group>
  );
}
