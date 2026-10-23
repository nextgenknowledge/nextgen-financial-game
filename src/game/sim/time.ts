import type { WorldState } from '../types';
import type { Fx } from '../effects';
import { processMonth } from './month';
import { marketTick, TICKS_PER_MONTH } from '../market/market';
import { makeRng } from '../rng';

/**
 * Advance the clock by `seconds` of real play time. One month = monthSeconds.
 * Runs market ticks and month rollovers as they come due.
 */
export function advanceTime(w: WorldState, fx: Fx, seconds: number, monthSeconds: number) {
  w.playSeconds += seconds;
  const before = w.time.t;
  w.time.t += seconds / monthSeconds;
  // Market ticks spread evenly through the month
  const dueTicks = Math.min(TICKS_PER_MONTH, Math.floor(Math.min(1, w.time.t) * TICKS_PER_MONTH));
  if (dueTicks > w.time.tick) {
    const rng = makeRng(w.rng);
    while (w.time.tick < dueTicks) {
      marketTick(w, fx, rng);
      w.time.tick++;
    }
    w.rng = rng.state();
  }
  void before;
  while (w.time.t >= 1 - 1e-9) {
    w.time.t = Math.max(0, w.time.t - 1);
    // Any ticks we skipped (e.g. very long frame) still happen before the month closes
    if (w.time.tick < TICKS_PER_MONTH) {
      const rng = makeRng(w.rng);
      while (w.time.tick < TICKS_PER_MONTH) {
        marketTick(w, fx, rng);
        w.time.tick++;
      }
      w.rng = rng.state();
    }
    w.time.tick = 0;
    processMonth(w, fx);
  }
}
