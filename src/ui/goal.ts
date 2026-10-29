'use client';
/** Works out where Narwhal should point for the current quest step, across scenes and cities. */
import { rt } from '@/engine/runtime';
import { getWorld } from '@/store/game';
import { useScene } from '@/store/scene';
import { useUI } from '@/store/ui';
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
/**
 * Progress goals ("Have $500 in savings") have no place of their own, so the trail leads to where
 * that progress is made.
 */
const STAT_SERVICE: Record<string, string> = {
  savingsBalance: 'bank',
  holdingsCount: 'brokerage',
  propertiesOwned: 'shop:property',
  businessesOwned: 'business',
  lessonsRead: 'learn',
};

/** Closest building door in this city that passes `pred` (by building id). */
function nearestDoor(pred: (buildingId: string) => boolean) {
  let best: (typeof rt.triggers)[number] | null = null;
  let bd = Infinity;
  for (const t of rt.triggers) {
    if (!t.id.startsWith('door:') || !pred(t.id.slice(5))) continue;
    const d = Math.hypot(t.x - rt.player.x, t.z - rt.player.z);
    if (d < bd) {
      bd = d;
      best = t;
    }
  }
  return best;
}

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

/** Point the guide trail, beacon and Narwhal at a place until the player gets there. */
export function showTheWay(city: LocationId, triggerId: string, label: string) {
  const ui = useUI.getState();
  ui.setGuide({ city, trigger: triggerId, label });
  ui.closeAll();
  ui.pushToast({ text: `Follow the gold trail to ${label}`, icon: '🧭', tone: 'gold' });
  updateGoalMarker();
}

/** What the current guide route was planned from, so it is only re-planned when that changes. */
let planned = { goal: '', scene: '', x: 0, z: 0, at: 0 };

export function updateGoalMarker() {
  setGoal();
  // Route the guide around buildings to the goal. A* over a whole city costs a few milliseconds
  // (much more on a Chromebook), so re-plan only when the goal or scene changes, the player has
  // wandered off the old route's start, or every few seconds.
  const g = rt.goal;
  if (!g) {
    rt.guidePath = null;
    planned.goal = '';
    return;
  }
  const key = `${g.id}@${g.x.toFixed(1)},${g.z.toFixed(1)}`;
  const now = performance.now();
  const moved = Math.hypot(rt.player.x - planned.x, rt.player.z - planned.z);
  if (key === planned.goal && rt.sceneKey === planned.scene && rt.guidePath && moved < 8 && now - planned.at < 5000) return;
  const { x, z } = rt.player;
  // No walking route (the player hopped into a fenced garden or site): allow hopping the low
  // fence, and failing that point straight at the goal, so the trail never just disappears
  rt.guidePath =
    findPath(rt.collision, rt.sceneKey, x, z, g.x, g.z) ??
    findPath(rt.collision, rt.sceneKey, x, z, g.x, g.z, 2.2, true) ?? [
      [x, z],
      [g.x, g.z],
    ];
  planned = { goal: key, scene: rt.sceneKey, x: rt.player.x, z: rt.player.z, at: now };
}

/** Leads to a place picked with "Show me the way" (Map, My Stuff). True while it is steering. */
function guideGoal(): boolean {
  const ui = useUI.getState();
  const g = ui.guide;
  if (!g) return false;
  const scene = useScene.getState();
  const here = scene.location;
  const inside = scene.interior;
  // Arrived: inside that building or home, or standing at its door
  const t = here === g.city ? trigger(g.trigger) : null;
  if ((inside && (g.trigger === `door:${inside}` || g.trigger === inside)) || (t && !inside && Math.hypot(t.x - rt.player.x, t.z - rt.player.z) < 3.5)) {
    ui.setGuide(null);
    return false;
  }
  if (inside) {
    pointToExit();
    return true;
  }
  if (here !== g.city) {
    const portal = here === 'park' ? trigger(`portal:${g.city}`) : trigger('portal:park');
    if (portal) rt.goal = { id: portal.id, x: portal.x, z: portal.z, label: 'Portal' };
    return true;
  }
  if (t) rt.goal = { id: t.id, x: t.x, z: t.z, label: g.label };
  return true;
}

function setGoal() {
  const w = getWorld();
  const scene = useScene.getState();
  if (worldRun.run) return; // a world activity is steering the beacon
  rt.goal = null;
  if (!w) return;
  if (guideGoal()) return;
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
  } else if ((g.type === 'event' && g.target && EVENT_SERVICE[g.target]) || (g.type === 'stat' && g.target && STAT_SERVICE[g.target])) {
    const svcs = ([] as string[]).concat(g.type === 'stat' ? STAT_SERVICE[g.target!] : EVENT_SERVICE[g.target!]);
    const f = findBuilding((s) => !!s.service && svcs.includes(s.service));
    if (f) {
      const b = CITIES[f.city].buildings.find((x) => x.id === f.building)!;
      const st = [...b.stations, ...(b.entryStations ?? [])].find((s) => s.service && svcs.includes(s.service));
      dest = { ...f, service: st?.service };
    }
  } else if ((g.type === 'stat' && (g.target === 'buildingsVisited' || g.target === 'threeStarRuns')) || g.type === 'netWorth') {
    // Exploring: the closest building not yet visited. Stars and net worth: the closest place
    // with activities to play (that is where money and stars are earned).
    if (inside) return pointToExit();
    const city = CITIES[here];
    const seen = new Set(w.progress.seenBuildings);
    const playable = (id: string) => !!city?.buildings.find((b) => b.id === id && [...b.stations, ...(b.entryStations ?? [])].some((st) => st.activity));
    const t = g.target === 'buildingsVisited' ? (nearestDoor((id) => !seen.has(id)) ?? nearestDoor(playable)) : nearestDoor(playable);
    if (t) rt.goal = { id: t.id, x: t.x, z: t.z, label: t.label };
    return;
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
