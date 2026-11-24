import { describe, expect, it } from 'vitest';
import { CHECKPOINTS, TRACK, lapClock, onTrack, stepLap, type Lap } from '@/game/speedway';
import { createWorld } from '@/game/world';
import { setRented } from '@/game/finance/purchases';
import type { Fx } from '@/game/effects';

const drive = (lap: Lap, pts: [number, number, number][]) => {
  const evs: string[] = [];
  for (const [x, z, t] of pts) {
    const r = stepLap(lap, x, z, t);
    lap = r.lap;
    if (r.ev) evs.push(r.ev.type === 'lap' ? `lap:${r.ev.time}` : r.ev.type === 'check' ? `check:${r.ev.index}` : r.ev.type);
  }
  return { lap, evs };
};
const at = (i: number, t: number): [number, number, number] => [CHECKPOINTS[i].x, CHECKPOINTS[i].z, t];

describe('Fin City Speedway', () => {
  it('knows where the tarmac is', () => {
    expect(onTrack(0, TRACK.southZ)).toBe(true);
    expect(onTrack(CHECKPOINTS[1].x, CHECKPOINTS[1].z)).toBe(true);
    expect(onTrack(0, (TRACK.southZ + TRACK.northZ) / 2)).toBe(false);
    expect(onTrack(0, -60)).toBe(false);
  });

  it('times a lap through every arch in order', () => {
    const { evs } = drive(null, [at(0, 10), [40, TRACK.southZ, 12], at(1, 18), at(2, 30), at(3, 42), at(0, 51.5)]);
    expect(evs).toEqual(['start', 'check:1', 'check:2', 'check:3', 'lap:41.5']);
  });

  it('does not count a lap that skips an arch', () => {
    const { evs } = drive(null, [at(0, 0), at(2, 10), at(3, 20), at(0, 30)]);
    expect(evs).toEqual(['start']);
  });

  it('formats lap times', () => {
    expect(lapClock(41.27)).toBe('0:41.3');
    expect(lapClock(75)).toBe('1:15.0');
  });
});

describe('renting out a home', () => {
  it('can be stopped again', () => {
    const w = createWorld({ name: 'Rent', nickname: 'Fin', difficulty: 'entry', seed: 2 });
    w.assets.properties.push({ uid: 'c1', itemId: 'london-flat', value: 1, price: 1, level: 1, rented: true, boughtMonth: 0 });
    const fx: Fx = [];
    setRented(w, fx, 'c1', false);
    expect(w.assets.properties[0].rented).toBe(false);
  });
});

import { engineRpm } from '@/engine/audio';
describe('track-car engine', () => {
  it('idles, climbs through each gear and drops back after every shift', () => {
    expect(engineRpm(0)).toBe(1100);
    const first = engineRpm(0.16);
    const shift = engineRpm(1 / 6 + 0.001);
    expect(first).toBeGreaterThan(7500);
    expect(shift).toBeLessThan(first);
    expect(engineRpm(0.99)).toBeGreaterThan(8500);
    expect(engineRpm(1)).toBeLessThanOrEqual(9000);
  });
});
