'use client';
/**
 * Admin access on this device. The Admin app in the FinPhone unlocks it with the team's code
 * (checked against a hash in src/game/admin.ts); it stays unlocked on this browser until locked
 * again. While on, the player can fly (double-tap Space) and use the admin powers.
 */
import { create } from 'zustand';
import { getGlobal, setGlobal } from '@/save/db';
import { rt } from '@/engine/runtime';
import { isAdminCode } from '@/game/admin';

interface AdminStore {
  on: boolean;
  loaded: boolean;
}

export const useAdmin = create<AdminStore>(() => ({ on: false, loaded: false }));

const apply = (on: boolean) => {
  useAdmin.setState({ on, loaded: true });
  rt.canFly = on;
  if (!on) {
    rt.flying = false;
    rt.speedBoost = 1;
  }
};

let started = false;
/** Read the saved unlock once (called from the HUD). */
export function loadAdmin() {
  if (started) return;
  started = true;
  getGlobal<boolean>('adminUnlocked')
    .then((v) => apply(v === true))
    .catch(() => apply(false));
}

/** Try a code. True when it's right (and admin is now on for this device). */
export async function unlockAdmin(code: string): Promise<boolean> {
  let ok = false;
  try {
    ok = await isAdminCode(code);
  } catch {
    ok = false;
  }
  if (!ok) return false;
  apply(true);
  await setGlobal('adminUnlocked', true).catch(() => {});
  return true;
}

export async function lockAdmin() {
  apply(false);
  await setGlobal('adminUnlocked', false).catch(() => {});
}
