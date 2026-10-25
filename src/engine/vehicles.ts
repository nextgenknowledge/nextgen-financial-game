/** Arcade vehicle physics on top of the same collision world as walking. */
import { isDown, virtual } from './input';
import { rt } from './runtime';
import * as THREE from 'three';

import { vehicleDef, VEHICLES, RENTAL_SCOOTER, type VehicleDef, type VehicleType } from '@/game/sim/vehicleCatalog';
export { vehicleDef, VEHICLES, RENTAL_SCOOTER };
export type { VehicleDef, VehicleType };

const RADIUS: Record<VehicleType, number> = { bike: 0.5, scooter: 0.5, kart: 0.9, car: 1.2, boat: 1.4, plane: 2.2 };

/** Closest the chase camera sits to each kind of vehicle, so small rides stay big on screen. */
/** The kayak is much slimmer than the speedboat. */
const boatRadius = (itemId: string) => (itemId === 'kayak' ? 0.7 : RADIUS.boat);

export const CHASE_DIST: Record<VehicleType, number> = { bike: 6, scooter: 6, kart: 7, car: 9, boat: 9, plane: 16 };

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
  // Try the right-hand side, then the left (boats moored beside a pier step onto it)
  const sides = [1, -1].map((s) => [v.pos.x + Math.cos(v.yaw) * side * s, v.pos.z - Math.sin(v.yaw) * side * s] as const);
  const dry = sides.find(([x, z]) => !rt.collision.inWater(x, z));
  rt.vehicle = null;
  // Out on open water: back to the garage spot on land
  rt.player.set(dry ? dry[0] : rt.garage.x, 0, dry ? dry[1] : rt.garage.z);
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

  let turnScale = Math.max(-1, Math.min(1, v.speed / (def.topSpeed * 0.25)));
  // Boats can pivot on the spot under power, so you can always turn away from the shore
  if (v.type === 'boat' && throttle !== 0 && Math.abs(turnScale) < 0.45) turnScale = 0.45 * Math.sign(throttle);
  v.yaw += steer * def.turn * dt * turnScale;

  const prevX = v.pos.x;
  const prevZ = v.pos.z;
  v.pos.x += Math.sin(v.yaw) * v.speed * dt;
  v.pos.z += Math.cos(v.yaw) * v.speed * dt;

  if (v.type === 'boat') {
    // Piers and moored things block boats too
    const b = { x: v.pos.x, y: -0.15, z: v.pos.z };
    if (rt.collision.resolve(b, boatRadius(v.itemId), 1.6, 0.6)) {
      v.pos.x = b.x;
      v.pos.z = b.z;
      v.speed *= 0.7;
    }
    if (!rt.collision.inWater(v.pos.x, v.pos.z, 1.2)) {
      v.pos.x = prevX;
      v.pos.z = prevZ;
      v.speed *= -0.25;
    }
    v.pos.y = -0.15;
  } else {
    const p = { x: v.pos.x, y: v.type === 'plane' ? v.alt : 0, z: v.pos.z };
    const want = Math.hypot(p.x - prevX, p.z - prevZ);
    const hit = rt.collision.resolve(p, RADIUS[v.type], 1.6, 0.3);
    // Land vehicles stay out of water (the seaplane has floats and may taxi on it)
    if (v.type !== 'plane' && rt.collision.inWater(p.x, p.z, -RADIUS[v.type])) {
      p.x = prevX;
      p.z = prevZ;
      v.speed *= -0.3;
    } else if (hit && want > 1e-4) {
      // Slow down by how much the wall actually blocked us: scraping along it barely costs
      // speed, driving straight into it stops you.
      const got = Math.hypot(p.x - prevX, p.z - prevZ) / want;
      if (got < 0.95) v.speed *= Math.max(0.3, got);
    }
    v.pos.x = p.x;
    v.pos.z = p.z;
    v.pos.y = v.type === 'plane' ? v.alt : 0;
  }
  rt.playerSpeed = Math.abs(v.speed);
}
