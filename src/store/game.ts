'use client';
import { create } from 'zustand';
import { produce } from 'immer';
import type { WorldState } from '@/game/types';
import type { Effect, Fx } from '@/game/effects';

type EffectHandler = (fx: Effect[]) => void;
let effectHandler: EffectHandler = () => {};
export function setEffectHandler(h: EffectHandler) {
  effectHandler = h;
}

interface GameStore {
  world: WorldState | null;
  /** Bumped whenever something worth autosaving changes. */
  rev: number;
  load: (w: WorldState) => void;
  unload: () => void;
  /** Apply a rule function to the world (immer draft) and play its effects. */
  act: (fn: (w: WorldState, fx: Fx) => void) => Effect[];
}

export const useGame = create<GameStore>((set, get) => ({
  world: null,
  rev: 0,
  load: (w) => set({ world: w, rev: 0 }),
  unload: () => set({ world: null }),
  act: (fn) => {
    const w = get().world;
    if (!w) return [];
    const fx: Fx = [];
    const next = produce(w, (draft) => {
      fn(draft as WorldState, fx);
    });
    if (next !== w) set({ world: next, rev: get().rev + 1 });
    if (fx.length) effectHandler(fx);
    return fx;
  },
}));

/** Non-reactive accessor for code that runs every frame. */
export const getWorld = () => useGame.getState().world;
export const act = (fn: (w: WorldState, fx: Fx) => void) => useGame.getState().act(fn);
