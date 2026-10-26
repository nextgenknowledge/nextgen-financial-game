'use client';
/** Works out where Narwhal should point for the current quest step, across scenes and cities. */
import { rt } from '@/engine/runtime';
import { getWorld } from '@/store/game';
import { useScene } from '@/store/scene';
import { currentStep } from '@/game/progress/quests';
import { CITIES } from '@/world/cities';
import type { LocationId } from '@/game/types';
import { worldRun } from '@/activities/world/delivery';

import { findPath } from '@/engine/nav';

const EVENT_SERVICE: Record<string, string | string[]> = {
  buy: ['shop:outfits', 'shop:pets', 'shop:furniture', 'shop:vehicles', 'shop:collectibles'],
  openChecking: 'bank',
  openSavings: 'bank',
  deposit: 'bank',
  depositSavings: 'bank',
  invest: 'brokerage',
  openCD: 'cds',
  insure: 'insurance',
  // Starter deals (the "Make Fin City Yours" quest)
  ownOutfit: 'shop:outfits',
  ownPet: 'shop:pets',
  ownRide: 'shop:vehicles',
  ownHome: 'shop:property',
};

/** First building with a matching station, looking in the city you're in before anywhere else. */
function findBuilding(pred: (st: { activity?: string; service?: string }) => boolean): { city: LocationId; building: string } | null {
  const here = useScene.getState().location;
  const order = [CITIES[here], ...Object.values(CITIES).filter((c) => c.id !== here)].filter(Boolean);
  for (const c of order) {
    for (const b of c.buildings) {
      if (b.stations.some(pred) || b.entryStations?.some(pred)) return { city: c.id, building: b.id };
    }
  }
  return null;
}

function trigger(id: string) {
  return rt.triggers.find((t) => t.id === id) ?? null;
}

export function updateGoalMarker() {
  setGoal();
  // Route the guide around buildings to the goal
  const g = rt.goal;
  rt.guidePath = g ? findPath(rt.collision, rt.sceneKey, rt.player.x, rt.player.z, g.x, g.z) : null;
}

function setGoal() {
  const w = getWorld();
  const scene = useScene.getState();
  if (worldRun.run) return; // a world activity is steering the beacon
  rt.goal = null;
  if (!w) return;
  const cs = currentStep(w);
  if (!cs) return;
  const g = cs.step.goal;
  const here = scene.location;
  const inside = scene.interior;

  let dest: { city: LocationId; building?: string; activity?: string; service?: string; pos?: [number, number]; portal?: LocationId } | null = null;
  if (cs.step.marker) dest = { city: cs.step.marker.location, pos: cs.step.marker.pos };
  if (g.type === 'enter' && g.target) {
    const city = Object.values(CITIES).find((c) => c.buildings.some((b) => b.id === g.target));
    if (city) dest = { city: city.id, building: g.target };
  } else if (g.type === 'activity' && g.target && g.target !== '*') {
    const f = findBuilding((s) => s.activity === g.target);
    if (f) dest = { ...f, activity: g.target };
    else if (cs.step.marker) dest = { city: cs.step.marker.location, pos: cs.step.marker.pos };
  } else if (g.type === 'event' && (g.target === 'enterHome' || g.target === 'viewPlot')) {
    // Your home's front door, or a lot that's still for sale, both on Maple Lane in the park
    if (here !== 'park') dest = { city: 'park', portal: undefined };
    else if (inside) return pointToExit();
    else {
      const t = rt.triggers.find((x) => (g.target === 'enterHome' ? x.id.startsWith('home:') : x.kind === 'plot' && !w.assets.properties.some((p) => p.plotId === x.data?.plot)));
      if (t) rt.goal = { id: t.id, x: t.x, z: t.z, label: g.target === 'enterHome' ? 'Your home' : t.label };
      return;
    }
  } else if (g.type === 'event' && g.target && EVENT_SERVICE[g.target]) {
    const svcs = ([] as string[]).concat(EVENT_SERVICE[g.target]);
    const f = findBuilding((s) => !!s.service && svcs.includes(s.service));
    if (f) {
      const b = CITIES[f.city].buildings.find((x) => x.id === f.building)!;
      const st = [...b.stations, ...(b.entryStations ?? [])].find((s) => s.service && svcs.includes(s.service));
      dest = { ...f, service: st?.service };
    }
  } else if (g.type === 'travel' && g.target) {
    dest = { city: 'park', portal: g.target as LocationId };
    if (here === g.target) dest = null;
  }
  if (!dest) return;

  // Wrong city? Head for the portal (to the park, or from the park to the city).
  if (dest.city !== here && !dest.portal) {
    if (inside) return pointToExit();
    const t = here === 'park' ? trigger(`portal:${dest.city}`) : trigger('portal:park');
    if (t) rt.goal = { id: t.id, x: t.x, z: t.z, label: 'Portal' };
    return;
  }
  if (dest.portal) {
    if (inside) return pointToExit();
    const t = here === 'park' ? trigger(`portal:${dest.portal}`) : trigger('portal:park');
    if (t) rt.goal = { id: t.id, x: t.x, z: t.z, label: 'Portal' };
    return;
  }
  if (dest.building) {
    if (inside === dest.building) {
      const st = rt.triggers.find((t) => t.kind === 'station' && ((dest!.activity && t.data?.activity === dest!.activity) || (dest!.service && t.data?.service === dest!.service)));
      if (st) rt.goal = { id: st.id, x: st.x, z: st.z, label: st.label };
      return;
    }
    if (inside) return pointToExit();
    const t = trigger(`door:${dest.building}`);
    if (t) rt.goal = { id: t.id, x: t.x, z: t.z, label: t.label };
    return;
  }
  if (dest.pos && !inside) rt.goal = { id: 'marker', x: dest.pos[0], z: dest.pos[1] };
  else if (inside) pointToExit();
}

function pointToExit() {
  const t = trigger('exit');
  if (t) rt.goal = { id: 'exit', x: t.x, z: t.z, label: 'Exit' };
}
