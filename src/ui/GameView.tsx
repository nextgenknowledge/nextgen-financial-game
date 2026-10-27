'use client';
import { Suspense, useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame, act, getWorld } from '@/store/game';
import { useScene } from '@/store/scene';
import { useSettings } from '@/store/settings';
import { isPaused, useUI } from '@/store/ui';
import { SkyAndLights } from '@/engine/Sky';
import { PostFX } from '@/engine/PostFX';
import { PlayerController } from '@/engine/Player';
import { OutdoorScene } from '@/world/OutdoorScene';
import { InteriorScene } from '@/world/InteriorScene';
import { HomeScene } from '@/world/HomeScene';
import { decorAction } from './hud/DecorPanel';
import { NarwhalGuide, GoalBeacon, GuideTrail } from '@/world/Narwhal';
import { CITIES, applyDifficulty, buildingById } from '@/world/cities';
import { rt } from '@/engine/runtime';
import { onAction } from '@/engine/input';
import { playMusic } from '@/engine/audio';
import { startAmbience, stopAmbience } from '@/engine/ambience';
import { advanceTime } from '@/game/sim/time';
import { recordEvent } from '@/game/progress/events';
import { refreshChallenges } from '@/game/progress/challenges';
import { sayStep, currentStep, startEpics } from '@/game/progress/quests';
import { capture, saveNow } from './startWorld';
import { interact } from './interact';
import { HUD } from './hud/HUD';
import { HudTour, startTour } from './hud/HudTour';
import { Panels } from './panels/Panels';
import { updateGoalMarker } from './goal';
import { getOff } from '@/world/ParkedVehicles';
import { WorldActivityRunner } from '@/activities/world/WorldActivityRunner';
import { PlayerPets } from '@/world/Pets';

const DPR = { low: 0.75, medium: 1, high: Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio : 1) };

export default function GameView() {
  const quality = useSettings((s) => s.quality);
  const narwhalFollow = useSettings((s) => s.narwhalFollow);
  const location = useScene((s) => s.location);
  const interior = useScene((s) => s.interior);
  const difficulty = useGame((s) => s.world?.difficulty ?? 'entry');
  // Buildings wear their Entry or Advanced identity; idempotent, and must run before the scene builds
  applyDifficulty(difficulty);

  // Global key actions
  useEffect(() => {
    return onAction((a) => {
      const ui = useUI.getState();
      if (ui.screen !== 'game' || ui.loading.active || ui.tour) return;
      switch (a) {
        case 'interact':
          if (ui.decor?.carrying) decorAction('place');
          else if (!ui.panel) interact(rt.nearTrigger);
          break;
        case 'map':
          if (ui.panel?.type === 'map') ui.close();
          else if (!ui.panel) ui.open({ type: 'map' });
          break;
        case 'inventory':
          if (ui.panel?.type === 'phone' && ui.panel.app === 'bag') ui.close();
          else if (!ui.panel) ui.open({ type: 'phone', app: 'bag' });
          break;
        case 'phone':
          if (ui.panel?.type === 'phone') ui.close();
          else if (!ui.panel) {
            ui.open({ type: 'phone' });
            act((d, fx) => recordEvent(d, fx, { type: 'menu', target: 'phone' }));
          }
          break;
        case 'pause':
          if (ui.decor) decorAction('cancel');
          else if (ui.panel) ui.close();
          else ui.open({ type: 'pause' });
          break;
        case 'camera':
          rt.camYaw = rt.playerRotY + Math.PI;
          rt.camPitch = 0.42;
          rt.camDist = 8;
          break;
      }
    });
  }, []);

  // First-time intro and music
  useEffect(() => {
    const w = getWorld();
    if (!w) return;
    playMusic(CITIES[w.player.location].music);
    // A brand-new world gets the screen tour first; the first quest line plays when it ends.
    // Older saves that already saw the intro never get it unasked.
    const fresh = !w.progress.flags.introDone && !w.progress.flags.tourDone;
    act((d, fx) => {
      refreshChallenges(d);
      startEpics(d, fx);
      if (!d.progress.flags.introDone) {
        d.progress.flags.introDone = true;
        const cs = currentStep(d);
        if (cs && !fresh) sayStep(d, fx, cs.step);
      }
    });
    if (fresh) startTour();
  }, []);

  // L opens the Learn hub
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'l' || e.repeat || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      const ui = useUI.getState();
      if (ui.screen !== 'game' || ui.loading.active || ui.tour) return;
      if (ui.panel?.type === 'learn') ui.close();
      else if (!ui.panel) ui.open({ type: 'learn' });
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // City soundscape (runs while the game view is mounted)
  useEffect(() => {
    startAmbience();
    return () => stopAmbience();
  }, []);

  // Autosave every 30 s and when the tab is hidden
  useEffect(() => {
    const id = setInterval(() => saveNow(true), 30000);
    const vis = () => document.visibilityState === 'hidden' && saveNow(false);
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('beforeunload', vis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('beforeunload', vis);
    };
  }, []);

  const home = interior?.startsWith('home:') ? interior.slice(5) : null;
  const building = interior && !home ? buildingById(interior)?.building : null;
  const indoors = !!building || !!home;
  const sceneKey = `${location}:${interior ?? ''}:${difficulty}`;

  return (
    <div className="game-view">
      <Canvas
        key={quality}
        shadows={quality !== 'low'}
        dpr={DPR[quality]}
        camera={{ fov: 55, near: 0.1, far: 1200, position: [0, 6, 10] }}
        gl={{ antialias: quality !== 'low', powerPreference: 'high-performance', preserveDrawingBuffer: false }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
        style={{ position: 'fixed', inset: 0 }}
      >
        <Suspense fallback={null}>
          <SkyAndLights interior={indoors} />
          <group key={sceneKey}>
            {home ? (
              <HomeScene propUid={home} />
            ) : building ? (
              <InteriorScene building={building} difficulty={difficulty} />
            ) : (
              <OutdoorScene def={CITIES[location]} difficulty={difficulty} />
            )}
          </group>
          <PlayerController />
          {narwhalFollow && <NarwhalGuide />}
          <PlayerPets />
          <GoalBeacon />
          <GuideTrail />
          <Systems />
          <CaptureBinder />
          <WorldActivityRunner />
          {quality !== 'low' && <PostFX quality={quality} interior={indoors} />}
        </Suspense>
      </Canvas>
      <HUD />
      <Panels />
      <HudTour />
    </div>
  );
}

/** Runs game systems: time, market, walking stats, goal markers, performance. */
function Systems() {
  const acc = useRef(0);
  const walked = useRef(0);
  const last = useRef(new THREE.Vector3().copy(rt.player));
  const frames = useRef({ n: 0, t: 0, low: 0 });
  useFrame((_, dt) => {
    const paused = isPaused();
    // Walking distance for quests/achievements
    const d = Math.hypot(rt.player.x - last.current.x, rt.player.z - last.current.z);
    if (d < 5 && !rt.vehicle) walked.current += d;
    last.current.copy(rt.player);

    if (!paused) acc.current += dt;
    if (acc.current >= 1) {
      const secs = acc.current;
      acc.current = 0;
      const monthSeconds = useSettings.getState().monthMinutes * 60;
      const walk = walked.current;
      walked.current = 0;
      // A real jump from either the keyboard or the on-screen touch button
      const jump = rt.jumped;
      rt.jumped = false;
      act((w, fx) => {
        advanceTime(w, fx, secs, monthSeconds);
        if (walk > 0.2) recordEvent(w, fx, { type: 'move', value: walk });
        if (jump) recordEvent(w, fx, { type: 'jump' });
      });
      updateGoalMarker();
    }
    // FPS meter & auto quality
    const f = frames.current;
    f.n++;
    f.t += dt;
    if (f.t >= 1) {
      const fps = f.n / f.t;
      useUI.setState({ fps: Math.round(fps) });
      const s = useSettings.getState();
      // Hidden or unfocused tabs are throttled by the browser, never judge performance there
      const throttled = document.hidden || !document.hasFocus();
      if (s.autoQuality && s.quality !== 'low' && fps < 27 && !paused && !throttled) {
        f.low++;
        if (f.low >= 3) {
          s.set({ quality: s.quality === 'high' ? 'medium' : 'low' });
          useUI.getState().pushToast({ text: 'Lowered graphics quality to keep things smooth.', icon: '🖥️', tone: 'info' });
          f.low = 0;
        }
      } else f.low = 0;
      f.n = 0;
      f.t = 0;
    }
  });
  return null;
}

/** Lets the save system grab a small thumbnail from the WebGL canvas. */
function CaptureBinder() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    // Dev-only: renderer stats for automated performance checks
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __gl?: unknown }).__gl = { gl, scene, camera };
    capture.fn = () => {
      gl.render(scene, camera);
      const src = gl.domElement;
      const c = document.createElement('canvas');
      c.width = 320;
      c.height = 180;
      const g = c.getContext('2d')!;
      const ar = src.width / src.height;
      const sw = ar > 16 / 9 ? src.height * (16 / 9) : src.width;
      const sh = ar > 16 / 9 ? src.height : src.width / (16 / 9);
      g.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, 320, 180);
      return c.toDataURL('image/jpeg', 0.72);
    };
    return () => {
      capture.fn = null;
    };
  }, [gl, scene, camera]);
  return null;
}

export { getOff };
