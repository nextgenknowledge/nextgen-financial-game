'use client';
import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { useGame } from '@/store/game';
import { rt } from '@/engine/runtime';
import { vehicleDef, mountVehicle, dismountVehicle } from '@/engine/vehicles';
import { VehicleModel } from './Vehicles';
import { playSfx } from '@/engine/audio';
import { useUI } from '@/store/ui';

/** Small reactive flag so the scene re-renders when the player gets on/off a vehicle. */
export const useRide = create<{ riding: string | null; parkedRev: number; set: (r: string | null) => void; bump: () => void }>((set, get) => ({
  riding: null,
  parkedRev: 0,
  set: (riding) => set({ riding }),
  bump: () => set({ parkedRev: get().parkedRev + 1 }),
}));

function spotFor(type: string) {
  if (type === 'boat') return rt.dock;
  return rt.garage;
}

export function rideParked() {
  const p = rt.parked;
  if (!p) return;
  mountVehicle(p.uid, p.itemId, p.x, p.z, p.rot);
  rt.parked = null;
  useRide.getState().set(p.uid);
  playSfx('horn');
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
}

/** Summon your active vehicle next to you (FinPhone garage). */
export function summonVehicle(uid: string, itemId: string) {
  const def = vehicleDef(itemId);
  if (!def) return false;
  if (def.type === 'boat') {
    if (!rt.dock) {
      useUI.getState().pushToast({ text: 'Boats can only be launched at a dock (Fin-City Park, New York, Hong Kong, SF, Singapore).', icon: '⚓', tone: 'info' });
      return false;
    }
    rt.parked = { uid, itemId, x: rt.dock.x, z: rt.dock.z, rot: rt.dock.rot, scene: rt.sceneKey };
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
      rt.parked = spot ? { uid: active.uid, itemId: active.itemId, x: spot.x, z: spot.z, rot: spot.rot, scene: rt.sceneKey } : null;
    }
    useRide.getState().bump();
  }, [active]);

  const p = rt.parked;
  // Keep the trigger in sync
  useEffect(() => {
    rt.triggers = rt.triggers.filter((t) => t.kind !== 'vehicle');
    if (p && !riding) {
      const def = vehicleDef(p.itemId);
      rt.triggers.push({ id: `vehicle:${p.uid}`, kind: 'vehicle', x: p.x, z: p.z, r: def?.type === 'boat' ? 6 : 3, label: `Ride ${def?.name ?? 'vehicle'}`, icon: def?.icon });
    }
  }, [p, riding, rev]);

  if (!p || riding || p.scene !== rt.sceneKey) return null;
  return (
    <group position={[p.x, p.itemId && vehicleDef(p.itemId)?.type === 'boat' ? -0.15 : 0, p.z]} rotation={[0, p.rot, 0]}>
      <VehicleModel itemId={p.itemId} />
    </group>
  );
}
