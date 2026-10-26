/**
 * Starter deals: one cheap item per category (an outfit, a pet, a ride and a home) so every new
 * player can try the fun side of Fin City early. Each deal works once per world. Prices are fixed
 * (no inflation) and the starter item is valued at what was paid, so a deal can never be resold
 * for a profit.
 */
import type { WorldState } from './types';

export const STARTER = {
  outfit: { id: 'bucket-hat', price: 5 },
  pet: { id: 'dog', price: 10 },
  ride: { id: 'scooter', price: 15 },
  home: { id: 'tiny-house', price: 30 },
} as const;

export type StarterKind = keyof typeof STARTER;

const flag = (k: StarterKind) => `starter:${k}`;

export const starterUsed = (w: WorldState, k: StarterKind) => !!w.progress.flags[flag(k)];

/** The deal price for this item, or null when it isn't the starter item or the deal is used. */
export function starterPrice(w: WorldState, k: StarterKind, id: string): number | null {
  const s = STARTER[k];
  return s.id === id && !starterUsed(w, k) ? s.price : null;
}

export function useStarter(w: WorldState, k: StarterKind) {
  w.progress.flags[flag(k)] = true;
}
