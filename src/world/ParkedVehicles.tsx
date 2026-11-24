'use client';
import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { useGame, act } from '@/store/game';
import { recordEvent } from '@/game/progress/events';
import { rt } from '@/engine/runtime';
import { vehicleDef, mountVehicle, dismountVehicle } from '@/engine/vehicles';
import { VehicleModel } from './Vehicles';
import { playSfx } from '@/engine/audio';
import { useUI } from '@/store/ui';
import { AIRPORT } from '@/game/airport';

/** Small reactive flag so the scene re-renders when the player gets on/off a vehicle. */
export const useRide = create<{ riding: string | null; parkedRev: number; set: (r: string | null) => void; bump: () => void }>((set, get) => ({
  riding: null,
  parkedRev: 0,
  set: (riding) => set({ riding }),
  bump: () => set({ parkedRev: get().parkedRev + 1 }),
}));

/**
 * Where a boat or the seaplane waits: on the water just off the shore near the dock, a few metres
 * to one side of the pier (it used to sit across the pier's planks), nose out to open water, and
 * close enough to the bank to hop on (walkers can't step onto the water or the pier).
 */
export function waterSpot(dock: { x: number; z: number; rot: number }): { x: number; z: number; rot: number; bank?: { x: number; z: number } } {
  const water = rt.collision.water;
  const w = water.find((r) => dock.x >= r.minX - 8 && dock.x <= r.maxX + 8 && dock.z >= r.minZ - 8 && dock.z <= r.maxZ + 8);
  if (!w) return dock;
  // The shore nearest the dock, and the way into the water from it
  const edges = [
    { d: Math.abs(dock.x - w.minX), at: w.minX, nx: 1, nz: 0 },
    { d: Math.abs(w.maxX - dock.x), at: w.maxX, nx: -1, nz: 0 },
    { d: Math.abs(dock.z - w.minZ), at: w.minZ, nx: 0, nz: 1 },
    { d: Math.abs(w.maxZ - dock.z), at: w.maxZ, nx: 0, nz: -1 },
  ].sort((a, b) => a.d - b.d);
  const e = edges[0];
  const out = 3.4; // plane/boat radius plus a little, so it floats clear of the seawall
  for (const along of [7, -7, 11, -11, 15, -15, 19, -19, 23, -23, 27, -27]) {
    const x = e.nx ? e.at + e.nx * out : dock.x + along;
    const z = e.nz ? e.at + e.nz * out : dock.z + along;
    if (!rt.collision.inWater(x, z, 2.2)) continue;
    // The bank right beside it has to be open ground you can stand on
    const lx = e.nx ? e.at - e.nx * 1.2 : x;
    const lz = e.nz ? e.at - e.nz * 1.2 : z;
    // (lamp posts and tree trunks are fine to stand beside; walls and buildings aren't)
    if (rt.collision.query(lx - 0.6, lx + 0.6, lz - 0.6, lz + 0.6).some((bx) => bx.maxY > 0.6 && bx.minY < 1.5 && Math.max(bx.maxX - bx.minX, bx.maxZ - bx.minZ) > 1.6)) continue;
    // ...and the water there clear of the pier and moored boats
    if (rt.collision.query(x - 2.5, x + 2.5, z - 2.5, z + 2.5).some((bx) => bx.maxY > -0.5 && bx.minY < 1.5)) continue;
    return { x, z, rot: Math.atan2(e.nx, e.nz), bank: { x: lx, z: lz } };
  }
  return dock;
}

function spotFor(type: string): { x: number; z: number; rot: number; bank?: { x: number; z: number } } | null {
  // The seaplane takes off from the water: its wings don't fit between the cars at the garage
  if (type === 'boat') return rt.dock && waterSpot(rt.dock);
  if (type === 'plane') return rt.airport ? { ...rt.airport, bank: { ...AIRPORT.stand } } : rt.dock ? waterSpot(rt.dock) : rt.garage;
  return rt.garage;
}

export function rideParked() {
  const p = rt.parked;
  if (!p) return;
  mountVehicle(p.uid, p.itemId, p.x, p.z, p.rot);
  rt.parked = null;
  useRide.getState().set(p.uid);
  playSfx('horn');
  act((d, fx) => recordEvent(d, fx, { type: 'rideVehicle', target: p.itemId }));
}

export function getOff() {
  const v = rt.vehicle;
  if (!v) return;
  if (Math.abs(v.speed) > 3 || (v.type === 'plane' && v.alt > 0.5)) {
    useUI.getState().pushToast({ text: v.type === 'plane' ? 'Land first! (hold Shift to descend)' : 'Slow down to get off (Space brakes).', icon: '🛑', tone: 'info' });
    return;
  }
  const temp = v.itemId === 'rental-scooter';
  rt.parked = temp ? null : { uid: v.uid, itemId: v.itemId, x: v.pos.x, z: v.pos.z, rot: v.yaw, scene: rt.sceneKey };
  dismountVehicle();
  useRide.getState().set(null);
  useRide.getState().bump();
  act((d, fx) => recordEvent(d, fx, { type: 'getOff' }));
}

/**
 * Removes the ridden or parked vehicle once it isn't yours any more (the delivery
 * scooter is a loaner and never counts). Returns true if you were riding it.
 */
export function dropUnowned(owned: string[]) {
  const mine = new Set(owned);
  let wasRiding = false;
  let changed = false;
  const v = rt.vehicle;
  if (v && v.itemId !== 'rental-scooter' && !v.uid.startsWith('dev-') && !mine.has(v.uid)) {
    dismountVehicle();
    useRide.getState().set(null);
    wasRiding = changed = true;
  }
  if (rt.parked && !mine.has(rt.parked.uid)) {
    rt.parked = null;
    changed = true;
  }
  if (changed) useRide.getState().bump();
  return wasRiding;
}

/** Summon your active vehicle next to you (FinPhone garage). */
export function summonVehicle(uid: string, itemId: string) {
  const def = vehicleDef(itemId);
  if (!useGame.getState().world?.assets.vehicles.some((v) => v.uid === uid)) return false;
  if (!def) return false;
  if (def.type === 'plane' && rt.airport) {
    // The seaplane waits at the airfield past the west edge, ready on the runway
    rt.parked = { uid, itemId, x: rt.airport.x, z: rt.airport.z, rot: rt.airport.rot, scene: rt.sceneKey, bank: { ...AIRPORT.stand } };
  } else if ((def.type === 'plane' || def.type === 'boat') && rt.dock) {
    // Seaplanes and boats wait on the water at the dock
    const s = waterSpot(rt.dock);
    rt.parked = { uid, itemId, x: s.x, z: s.z, rot: s.rot, scene: rt.sceneKey, bank: s.bank };
  } else if (def.type === 'boat') {
    useUI.getState().pushToast({ text: 'Boats can only be launched at a dock (Fin-City Park, New York, Hong Kong, SF, Singapore).', icon: '⚓', tone: 'info' });
    return false;
  } else {
    const yaw = rt.playerRotY;
    rt.parked = { uid, itemId, x: rt.player.x + Math.cos(yaw) * 3, z: rt.player.z - Math.sin(yaw) * 3, rot: yaw, scene: rt.sceneKey };
  }
  useRide.getState().bump();
  return true;
}

export function ParkedVehicles() {
  const activeUid = useGame((s) => s.world?.assets.activeVehicle ?? null);
  const vehicles = useGame((s) => s.world?.assets.vehicles);
  const riding = useRide((s) => s.riding);
  const rev = useRide((s) => s.parkedRev);
  const active = useMemo(() => vehicles?.find((v) => v.uid === activeUid) ?? null, [vehicles, activeUid]);

  // Reset parking spot when the scene changes or the active vehicle changes.
  useEffect(() => {
    if (!active) {
      rt.parked = null;
    } else if (!rt.parked || rt.parked.scene !== rt.sceneKey || rt.parked.uid !== active.uid) {
      const def = vehicleDef(active.itemId);
      const spot = def ? spotFor(def.type) : null;
      rt.parked = spot ? { uid: active.uid, itemId: active.itemId, x: spot.x, z: spot.z, rot: spot.rot, scene: rt.sceneKey, bank: spot.bank } : null;
    }
    useRide.getState().bump();
  }, [active]);

  // A vehicle you no longer own (sold, lease ended) leaves the world, even mid-ride.
  useEffect(() => {
    if (!vehicles) return;
    if (dropUnowned(vehicles.map((v) => v.uid))) useUI.getState().pushToast({ text: 'You sold the vehicle you were riding, so you hopped off.', icon: '🏷️', tone: 'info' });
  }, [vehicles]);

  const p = rt.parked;
  // Keep the trigger in sync
  useEffect(() => {
    rt.triggers = rt.triggers.filter((t) => t.kind !== 'vehicle');
    if (p && !riding) {
      const def = vehicleDef(p.itemId);
      rt.triggers.push({ id: `vehicle:${p.uid}`, kind: 'vehicle', x: p.x, z: p.z, r: def?.type === 'boat' || def?.type === 'plane' ? 6 : 3, label: `Ride ${def?.name ?? 'vehicle'}`, icon: def?.icon });
    }
  }, [p, riding, rev]);

  if (!p || riding || p.scene !== rt.sceneKey) return null;
  return (
    <group position={[p.x, vehicleDef(p.itemId)?.type === 'boat' ? -0.15 : 0, p.z]} rotation={[0, p.rot, 0]}>
      <VehicleModel itemId={p.itemId} />
    </group>
  );
}
