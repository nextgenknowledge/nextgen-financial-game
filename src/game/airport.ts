/**
 * Every city and the park has an airport just past its west edge, reached by a road through a gap
 * in the boundary wall. The seaplane waits there, can only touch down at an airport (or on water),
 * and flies between cities from the air. The same layout is used everywhere; the world builder
 * draws it (src/world/builders/airport.ts).
 */

export const AIRPORT = {
  /** The fenced airport grounds. */
  zone: { minX: -264, maxX: -134, minZ: -50, maxZ: 50 },
  /** Runway centre line along x. */
  runway: { z: -24, x0: -256, x1: -142, w: 18 },
  /** Where the plane waits: the west end of the runway, nose east ready to take off. */
  plane: { x: -246, z: -24, rot: Math.PI / 2 },
  /** Where you stand beside it. */
  stand: { x: -246, z: -19.5 },
  /** The gap in the city's boundary wall and the road in. */
  gate: { z: 0, halfWidth: 7 },
} as const;

/** The west limit of the walkable world once the airport is added. */
export const AIRPORT_WEST = AIRPORT.zone.minX - 1;

export function inAirport(x: number, z: number, m = 0): boolean {
  const a = AIRPORT.zone;
  return x > a.minX - m && x < a.maxX + m && z > a.minZ - m && z < a.maxZ + m;
}
