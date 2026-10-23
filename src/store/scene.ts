'use client';
import { create } from 'zustand';
import type { LocationId } from '@/game/types';

/** Which 3D scene is showing. Interiors are not saved: loading a world puts you outside. */
interface SceneStore {
  location: LocationId;
  interior: string | null; // building id
  /** Increments on every scene change so components can reset. */
  key: number;
  /** Where to place the player after the scene builds. */
  spawn: { x: number; z: number; rot: number } | null;
  go: (location: LocationId, interior?: string | null, spawn?: SceneStore['spawn']) => void;
}

export const useScene = create<SceneStore>((set, get) => ({
  location: 'park',
  interior: null,
  key: 0,
  spawn: null,
  go: (location, interior = null, spawn = null) => set({ location, interior, spawn, key: get().key + 1 }),
}));
