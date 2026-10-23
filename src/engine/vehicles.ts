/** Arcade vehicle physics on top of the same collision world as walking. */
import { isDown, virtual } from './input';
import { rt } from './runtime';
import * as THREE from 'three';

import { vehicleDef, VEHICLES, RENTAL_SCOOTER, type VehicleDef, type VehicleType } from '@/game/sim/vehicleCatalog';
export { vehicleDef, VEHICLES, RENTAL_SCOOTER };
export type { VehicleDef, VehicleType };

const RADIUS: Record<VehicleType, number> = { bike: 0.5, scooter: 0.5, kart: 0.9, car: 1.2, boat: 1.4, plane: 2.2 };

export function mountVehicle(uid: string, itemId: string, x: number, z: number, yaw: number) {
  const def = vehicleDef(itemId);
  if (!def) return;
  rt.vehicle = { uid, itemId, type: def.type, speed: 0, yaw, alt: 0, pos: new THREE.Vector3(x, 0, z) };
  rt.walkTarget = null;
}

export function dismountVehicle() {
  const v = rt.vehicle;
  if (!v) return;
  // Step off to the side, out of the vehicle's collider.
  const side = RADIUS[v.type] + 0.8;
  const x = v.pos.x + Math.cos(v.yaw) * side;
  const z = v.pos.z - Math.sin(v.yaw) * side;
  rt.vehicle = null;
  rt.player.set(x, 0, z);
  if (rt.collision.inWater(x, z)) {
    // Boats: put the player back on the nearest dock spot.
    rt.player.set(rt.garage.x, 0, rt.garage.z);
  }
  rt.playerVel.set(0, 0, 0);
}

export function updateVehicle(dt: number) {
  const v = rt.vehicle;
  if (!v) return;
  const def = vehicleDef(v.itemId);
  if (!def) return;
  let throttle = (isDown('forward') ? 1 : 0) - (isDown('back') ? 1 : 0) + virtual.y;
  let steer = (isDown('left') ? 1 : 0) - (isDown('right') ? 1 : 0) - virtual.x;
  throttle = Math.max(-1, Math.min(1, throttle));
  steer = Math.max(-1, Math.min(1, steer));
  const boost = isDown('sprint') ? 1.15 : 1;
  const max = def.topSpeed * boost;

  if (v.type === 'plane') {
    v.speed += throttle * def.accel * dt;
    v.speed -= v.speed * 0.15 * dt;
    v.speed = Math.max(0, Math.min(max, v.speed));
    const lift = v.speed > def.topSpeed * 0.45;
    if (lift && (isDown('jump') || virtual.jump)) v.alt += 9 * dt;
    if (isDown('sprint') && v.alt > 0) v.alt -= 9 * dt;
    if (!lift) v.alt -= 6 * dt;
    v.alt = Math.max(0, Math.min(70, v.alt));
  } else {
    const braking = isDown('jump') || virtual.jump;
    if (braking) v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), def.accel * 2.2 * dt);
    else v.speed += throttle * def.accel * dt;
    // Rolling resistance / water drag
    const drag = v.type === 'boat' ? 0.6 : 0.35;
    if (throttle === 0 && !braking) v.speed -= v.speed * drag * dt;
    v.speed = Math.max(-max * 0.35, Math.min(max, v.speed));
  }

  const turnScale = Math.max(-1, Math.min(1, v.speed / (def.topSpeed * 0.25)));
  v.yaw += steer * def.turn * dt * turnScale;

  const prevX = v.pos.x;
  const prevZ = v.pos.z;
  v.pos.x += Math.sin(v.yaw) * v.speed * dt;
  v.pos.z += Math.cos(v.yaw) * v.speed * dt;

  if (v.type === 'boat') {
    if (!rt.collision.inWater(v.pos.x, v.pos.z, 1.2)) {
      v.pos.x = prevX;
      v.pos.z = prevZ;
      v.speed *= -0.25;
    }
    v.pos.y = -0.15;
  } else {
    const p = { x: v.pos.x, y: v.type === 'plane' ? v.alt : 0, z: v.pos.z };
    const hit = rt.collision.resolve(p, RADIUS[v.type], 1.6, 0.3);
    if (v.type !== 'plane' || v.alt < 1) {
      // Land vehicles stay out of water
      if (rt.collision.inWater(p.x, p.z, -RADIUS[v.type])) {
        p.x = prevX;
        p.z = prevZ;
        v.speed *= -0.3;
      }
    }
    if (hit) v.speed *= 0.6;
    v.pos.x = p.x;
    v.pos.z = p.z;
    v.pos.y = v.type === 'plane' ? v.alt : 0;
  }
  rt.playerSpeed = Math.abs(v.speed);
}
