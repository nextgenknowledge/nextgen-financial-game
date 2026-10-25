'use client';
import type { WorldState } from '@/game/types';
import { useGame } from '@/store/game';
import { useUI } from '@/store/ui';
import { useScene } from '@/store/scene';
import { rt } from '@/engine/runtime';
import { saveWorld, storageMode } from '@/save/db';
import { stopSpeaking } from './speech';
import { clearKeys } from '@/engine/input';
import { updateHallOfFame } from '@/save/fame';
import { loadSignFonts } from '@/world/signage';
import { applyDifficulty } from '@/world/cities';

export const capture: { fn: null | (() => string | null) } = { fn: null };

export function startWorld(w: WorldState) {
  const ui = useUI.getState();
  loadSignFonts();
  applyDifficulty(w.difficulty);
  ui.setLoading({ active: true, progress: 0.15, text: `Loading ${w.name}…`, kind: 'world', city: w.player.location, building: undefined });
  ui.closeAll();
  ui.clearNarwhal();
  rt.vehicle = null;
  const loaded = { ...w, lastPlayed: Date.now() };
  useGame.getState().load(loaded);
  rt.player.set(w.player.pos[0], 0, w.player.pos[2]);
  rt.playerRotY = w.player.rotY;
  rt.camYaw = w.player.rotY + Math.PI;
  useScene.getState().go(w.player.location, null, { x: w.player.pos[0], z: w.player.pos[2], rot: w.player.rotY });
  // Let the loading screen paint before the scene builds.
  setTimeout(() => ui.setScreen('game'), 60);
}

/** Copy runtime-only state (position) into the world and write it to IndexedDB. */
export async function saveNow(withThumb = false): Promise<void> {
  const g = useGame.getState();
  const w = g.world;
  if (!w) return;
  const scene = useScene.getState();
  const inside = scene.interior !== null;
  const patched: WorldState = {
    ...w,
    lastPlayed: Date.now(),
    player: {
      ...w.player,
      location: scene.location,
      // Inside a building we save the outdoor spawn so the world reloads outside.
      pos: inside || rt.vehicle ? w.player.pos : [rt.player.x, 0, rt.player.z],
      rotY: rt.playerRotY,
    },
  };
  useGame.setState({ world: patched });
  let thumb: string | null | undefined = undefined;
  if (withThumb && capture.fn && !inside) {
    try {
      thumb = capture.fn();
    } catch {
      thumb = undefined;
    }
  }
  try {
    await saveWorld(patched, thumb);
    await updateHallOfFame(patched);
  } catch {
    // Storage falls back on its own; this is only reached if even memory refuses
  }
  warnIfNotSaving();
}

let warned = false;

/**
 * Some browsers block every kind of site storage (private windows, Lockdown Mode, "block all
 * site data"). The game still plays, keeping saves in memory, so say once what that means
 * instead of showing an error on every autosave.
 */
export function warnIfNotSaving() {
  if (warned || storageMode() !== 'memory') return;
  warned = true;
  useUI
    .getState()
    .sayNarwhal(
      "Heads up! This browser isn't letting games save, so your progress only lasts until you close this tab. A normal (not private) window usually fixes it, or use Export world in the Pause menu to keep a copy.",
      'skeptical',
    );
}

export async function quitToWorlds() {
  await saveNow(true);
  stopSpeaking();
  clearKeys();
  rt.vehicle = null;
  const ui = useUI.getState();
  ui.closeAll();
  ui.clearNarwhal();
  ui.setWorldActivity(null);
  useGame.getState().unload();
  ui.setScreen('worlds');
}
