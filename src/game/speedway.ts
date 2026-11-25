/**
 * Fin City Motor Stadium: a time-trial oval inside a full stadium past the park's north edge. A
 * road from the park runs through a tunnel under the south stand onto the track. Drive through the
 * start line, the three gold arches in order and back over the line to set a lap time. Pure layout
 * and lap logic here (tested in tests/speedway.test.ts); the stadium is drawn in
 * src/world/builders/speedway.ts and timed by src/ui/hud/Speedway.tsx.
 */

/** Centre line: two straights joined by half-circle turns. */
export const TRACK = {
  southZ: -190,
  northZ: -250,
  halfLen: 92, // straights run from -halfLen to +halfLen
  width: 14,
} as const;
export const TURN_R = (TRACK.southZ - TRACK.northZ) / 2;
export const TURN_Z = (TRACK.southZ + TRACK.northZ) / 2;

/** Stands rise in rows outside the track wall; the tunnel cuts through the south stand at x = 0. */
export const STAND = { rows: 9, rowDepth: 1.7, rowRise: 0.85, gap: 3 } as const;
/** Distance from the centre line to the back of the stands (the outer facade). */
export const STAND_OUTER = TRACK.width / 2 + STAND.gap + STAND.rows * STAND.rowDepth;
export const TUNNEL = { x: 0, halfWidth: 7 } as const;

/** Everything the stadium covers, for keeping scenery and the backdrop clear of it. */
export const STADIUM = {
  minX: -(TRACK.halfLen + TURN_R + STAND_OUTER + 2),
  maxX: TRACK.halfLen + TURN_R + STAND_OUTER + 2,
  minZ: TRACK.northZ - STAND_OUTER - 2,
  maxZ: TRACK.southZ + STAND_OUTER + 2,
} as const;

export function inStadium(x: number, z: number, m = 0): boolean {
  return x > STADIUM.minX - m && x < STADIUM.maxX + m && z > STADIUM.minZ - m && z < STADIUM.maxZ + m;
}

/** Start line (on the south straight, east of the tunnel), then the three arches, in driving order. */
export const CHECKPOINTS: { x: number; z: number; name: string }[] = [
  { x: 36, z: TRACK.southZ, name: 'Start' },
  { x: TRACK.halfLen + TURN_R, z: TURN_Z, name: 'East arch' },
  { x: 0, z: TRACK.northZ, name: 'North arch' },
  { x: -(TRACK.halfLen + TURN_R), z: TURN_Z, name: 'West arch' },
];
export const CHECK_R = 10;

/** Distance from a point to the track's centre line. */
export function trackDist(x: number, z: number): number {
  const ax = Math.abs(x);
  if (ax <= TRACK.halfLen) return Math.min(Math.abs(z - TRACK.southZ), Math.abs(z - TRACK.northZ));
  return Math.abs(Math.hypot(ax - TRACK.halfLen, z - TURN_Z) - TURN_R);
}

/** On (or right beside) the tarmac, with `m` metres to spare. */
export function onTrack(x: number, z: number, m = 0): boolean {
  return trackDist(x, z) < TRACK.width / 2 + m;
}

export type Lap = { next: number; start: number } | null;
export type LapEvent = { type: 'start' } | { type: 'check'; index: number } | { type: 'lap'; time: number } | null;

/**
 * Advance the lap state for a vehicle at (x, z) at time `now` (seconds). The lap starts the first
 * time you cross the line, each arch must be passed in order, and crossing the line again after
 * the last arch finishes the lap and starts the next one.
 */
export function stepLap(lap: Lap, x: number, z: number, now: number): { lap: Lap; ev: LapEvent } {
  const near = (i: number) => Math.hypot(x - CHECKPOINTS[i].x, z - CHECKPOINTS[i].z) < CHECK_R;
  if (!lap) return near(0) ? { lap: { next: 1, start: now }, ev: { type: 'start' } } : { lap, ev: null };
  if (lap.next === 0) {
    if (near(0)) return { lap: { next: 1, start: now }, ev: { type: 'lap', time: now - lap.start } };
    return { lap, ev: null };
  }
  if (near(lap.next)) {
    const index = lap.next;
    return { lap: { ...lap, next: (lap.next + 1) % CHECKPOINTS.length }, ev: { type: 'check', index } };
  }
  return { lap, ev: null };
}

/** 41.27 → "0:41.3" */
export function lapClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}

/** XP for a lap: something for every lap (a few a day), more for a new best. */
export const LAP_XP = 15;
export const RECORD_XP = 30;
export const XP_LAPS_PER_DAY = 5;
