/**
 * Click / tap to walk. The player follows a route around walls, buildings and furniture (the
 * same A* grid the guide trail uses) instead of a straight line that gets stuck on the first
 * obstacle. Clicking on top of something solid walks up to it.
 */
import * as THREE from 'three';
import { rt } from './runtime';
import { findPath } from './nav';

export function walkTo(x: number, z: number) {
  const p = rt.player;
  // Exactly there if it's open ground, otherwise as close as the route can get
  const route = (reach: number) => findPath(rt.collision, rt.sceneKey, p.x, p.z, x, z, reach);
  // Clicking a fountain, a planter or a big table walks to its edge
  const path = route(0.4) ?? route(1.6) ?? route(5);
  if (path && path.length > 1) {
    rt.walkPath = path.slice(1);
    const [lx, lz] = path[path.length - 1];
    rt.walkTarget = new THREE.Vector3(lx, 0, lz);
  } else {
    // No route found (open field outside the grid, or nowhere to go): head straight there
    rt.walkPath = null;
    rt.walkTarget = new THREE.Vector3(x, 0, z);
  }
}

export function stopWalking() {
  rt.walkPath = null;
  rt.walkTarget = null;
}
