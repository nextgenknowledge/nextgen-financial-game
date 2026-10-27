'use client';
import type { Trigger } from '@/engine/runtime';
import { rt } from '@/engine/runtime';
import { useScene } from '@/store/scene';
import { useUI } from '@/store/ui';
import { act, getWorld } from '@/store/game';
import { homeInfo, canEnterHome } from '@/game/home';
import { playSfx, playMusic } from '@/engine/audio';
import { CITIES, CITY_META, buildingById } from '@/world/cities';
import type { LocationId } from '@/game/types';
import { recordEvent } from '@/game/progress/events';
import { rideParked, getOff } from '@/world/ParkedVehicles';
import { saveNow } from './startWorld';
import { speak } from './speech';
import { useSettings } from '@/store/settings';

export function travelTo(to: LocationId, spawn?: { x: number; z: number; rot: number } | null) {
  const w = getWorld();
  if (!w) return;
  if (!w.progress.unlocked.includes(to)) {
    playSfx('error');
    useUI.getState().sayNarwhal(lockedMessage(to), 'skeptical');
    return;
  }
  if (rt.vehicle) getOff();
  if (rt.vehicle) return;
  const ui = useUI.getState();
  ui.closeAll();
  playSfx('portal');
  ui.setLoading({ active: true, progress: 0.3, text: `Traveling to ${CITY_META[to].name}…`, kind: 'city', city: to, building: undefined });
  setTimeout(() => {
    useScene.getState().go(to, null, spawn ?? null);
    playMusic(CITIES[to].music);
    act((d, fx) => {
      d.player.location = to;
      recordEvent(d, fx, { type: 'travel', target: to });
      // First time here: sweep the camera round the skyline before handing over
      const key = `flyover:${to}`;
      if (!d.progress.flags[key] && !useSettings.getState().reducedMotion) rt.flyoverPending = { half: CITIES[to].half };
      d.progress.flags[key] = true;
    });
    saveNow(false);
  }, 350);
}

function lockedMessage(to: LocationId) {
  const name = CITY_META[to].name;
  return `${name} is still locked. Keep following my quests and I'll open that portal for you soon!`;
}

export function enterBuilding(id: string) {
  const found = buildingById(id);
  if (!found) return;
  const { building } = found;
  const w = getWorld();
  if (!w) return;
  if (building.advancedOnly && w.difficulty === 'entry' && !building.entryStations) {
    useUI.getState().sayNarwhal(`${building.name} is for Advanced mode. You can switch difficulty in Pause → World options when you're ready!`, 'talking');
    return;
  }
  if (building.unlock?.level && w.progress.level < building.unlock.level) {
    useUI.getState().sayNarwhal(`${building.name} opens at level ${building.unlock.level}. Keep playing to level up!`, 'skeptical');
    return;
  }
  playSfx('door');
  const ui = useUI.getState();
  ui.setLoading({ active: true, progress: 0.6, text: building.name, kind: 'building', city: useScene.getState().location, building: id });
  // Remember where we were outside so leaving puts us at the door.
  const outside = { x: rt.player.x, z: rt.player.z, rot: rt.playerRotY + Math.PI };
  setTimeout(() => {
    useScene.getState().go(useScene.getState().location, id, outside);
    playMusic('interior');
    act((d, fx) => {
      recordEvent(d, fx, { type: 'enterBuilding', target: id });
    });
  }, 150);
}

/** Walk into a home you own. Homes rented out to tenants stay locked. */
export function enterHome(propUid: string) {
  const w = getWorld();
  if (!w) return;
  const home = homeInfo(w, propUid);
  if (!home) return;
  if (!canEnterHome(w, propUid)) {
    useUI.getState().sayNarwhal(`Tenants are renting your ${home.name}, so it's their home for now. To move in and decorate, stop renting it out in the FinPhone (My Stuff).`, 'talking');
    return;
  }
  playSfx('door');
  act((d, fx) => recordEvent(d, fx, { type: 'enterHome', target: propUid }));
  const ui = useUI.getState();
  ui.setLoading({ active: true, progress: 0.6, text: home.name, kind: 'building', city: useScene.getState().location, building: undefined });
  const outside = { x: rt.player.x, z: rt.player.z, rot: rt.playerRotY + Math.PI };
  setTimeout(() => {
    useScene.getState().go(useScene.getState().location, `home:${propUid}`, outside);
    playMusic('interior');
  }, 150);
}

export function exitBuilding() {
  const scene = useScene.getState();
  const spawn = scene.spawn;
  playSfx('door');
  const ui = useUI.getState();
  ui.setLoading({ active: true, progress: 0.6, text: CITY_META[scene.location].name, kind: 'city', city: scene.location, building: undefined });
  setTimeout(() => {
    useScene.getState().go(scene.location, null, spawn);
    playMusic(CITIES[scene.location].music);
  }, 120);
}

export function interact(t: Trigger | null) {
  if (rt.vehicle) {
    getOff();
    return;
  }
  if (!t) return;
  const ui = useUI.getState();
  const data = (t.data ?? {}) as Record<string, string | undefined>;
  switch (t.kind) {
    case 'door':
      if (data.home) enterHome(data.home);
      else enterBuilding(data.building!);
      break;
    case 'exit':
      exitBuilding();
      break;
    case 'portal':
      travelTo(data.to as LocationId, null);
      break;
    case 'station':
    case 'board':
      playSfx('pop');
      if (data.activity) ui.open({ type: 'activity', id: data.activity });
      else if (data.service) openService(data.service);
      act((d, fx) => recordEvent(d, fx, { type: 'station', target: data.activity ?? data.service ?? '' }));
      break;
    case 'npc':
      talkToHost();
      break;
    case 'vehicle':
      rideParked();
      break;
    case 'plot':
      act((d, fx) => recordEvent(d, fx, { type: 'viewPlot', target: data.plot }));
      ui.open({ type: 'shop', id: `property:${data.plot}` });
      break;
    case 'checkpoint':
      break;
    default:
      break;
  }
}

export function openService(id: string) {
  const ui = useUI.getState();
  if (id.startsWith('shop:')) ui.open({ type: 'shop', id: id.slice(5) });
  else if (id === 'map') ui.open({ type: 'map' });
  else if (id === 'learn') ui.open({ type: 'learn' });
  else ui.open({ type: 'service', id });
}

function talkToHost() {
  const w = getWorld();
  if (!w) return;
  const def = CITIES[useScene.getState().location];
  const lines = w.difficulty === 'entry' && def.host.entryLines ? def.host.entryLines : def.host.lines;
  const ui = useUI.getState();
  const line = lines[Math.floor(Math.random() * lines.length)];
  ui.sayNarwhal(`${def.host.name}: “${line}”`, 'talking');
  if (useSettings.getState().readAloud) speak(line);
  act((d, fx) => recordEvent(d, fx, { type: 'talk', target: def.id }));
}
