'use client';
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Avatar, type AnimState } from '@/world/Avatar';
import { useGame } from '@/store/game';
import { useSettings } from '@/store/settings';
import { isPaused, useUI } from '@/store/ui';
import { isDown, virtual } from './input';
import { rt } from './runtime';
import { playSfx } from './audio';
import { VehicleModel } from '@/world/Vehicles';
import { updateVehicle, CHASE_DIST } from './vehicles';
import { useRide } from '@/world/ParkedVehicles';

const RADIUS = 0.38;
const HEIGHT = 1.9;
const WALK = 5;
const RUN = 8.5;
const GRAVITY = 30;
const JUMP = 10.5;

const tmp = new THREE.Vector3();
const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3();
const dir = new THREE.Vector3();
const flyPos = new THREE.Vector3();
const flyLook = new THREE.Vector3();

export function PlayerController() {
  const avatar = useGame((s) => s.world?.avatar);
  const riding = useRide((s) => s.riding);
  const group = useRef<THREE.Group>(null);
  const anim = useRef<AnimState>({ speed: 0, grounded: true });
  const { camera, gl } = useThree();
  const drag = useRef<{ x: number; y: number; moved: number; id: number } | null>(null);
  const smoothedDist = useRef(rt.camDist);

  // Any key, click or scroll skips the arrival flyover
  useEffect(() => {
    const skip = () => {
      if (rt.flyover) rt.flyover = null;
    };
    window.addEventListener('keydown', skip);
    gl.domElement.addEventListener('pointerdown', skip);
    gl.domElement.addEventListener('wheel', skip, { passive: true });
    return () => {
      window.removeEventListener('keydown', skip);
      gl.domElement.removeEventListener('pointerdown', skip);
      gl.domElement.removeEventListener('wheel', skip);
    };
  }, [gl]);

  // Mouse / touch look (drag) and wheel zoom
  useEffect(() => {
    const el = gl.domElement;
    // Two fingers on the screen pinch to zoom (Android has no Safari gesture events)
    const fingers = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    const spread = () => {
      const [a, b] = [...fingers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (fingers.size === 2) {
          drag.current = null;
          pinch = spread();
          return;
        }
      }
      if (e.button === 2 || e.button === 0 || e.pointerType === 'touch') {
        drag.current = { x: e.clientX, y: e.clientY, moved: 0, id: e.pointerId };
      }
    };
    const onMove = (e: PointerEvent) => {
      const f = fingers.get(e.pointerId);
      if (f) {
        f.x = e.clientX;
        f.y = e.clientY;
        if (fingers.size === 2 && pinch > 0) {
          const now = spread();
          if (now > 0) zoomBy(pinch / now);
          pinch = now;
          return;
        }
      }
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      d.x = e.clientX;
      d.y = e.clientY;
      d.moved += Math.abs(dx) + Math.abs(dy);
      if (d.moved < 4) return;
      const s = useSettings.getState();
      rt.camYaw -= dx * 0.006 * s.mouseSensitivity;
      rt.camPitch += dy * 0.0045 * s.mouseSensitivity * (s.invertY ? -1 : 1);
      rt.camPitch = Math.max(0.05, Math.min(1.25, rt.camPitch));
    };
    const onUp = (e: PointerEvent) => {
      fingers.delete(e.pointerId);
      if (fingers.size < 2) pinch = 0;
      if (drag.current?.id === e.pointerId) drag.current = null;
    };
    // ── Zoom: mouse wheel, trackpad pinch, two-finger scroll, Safari gestures, +/- keys ──
    const zoomBy = (factor: number) => {
      const max = rt.vehicle ? 26 : 16;
      rt.camDist = Math.max(2.2, Math.min(max, rt.camDist * factor));
    };
    /** Panels, the phone and menus keep their own scrolling. */
    const overUI = (t: EventTarget | null) => t instanceof Element && t !== el && !!t.closest('.modal-backdrop, .modal, .hud-panel, [data-scroll], input, textarea, select');
    const onWheel = (e: WheelEvent) => {
      if (overUI(e.target)) return;
      e.preventDefault(); // stop the page itself zooming/scrolling
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const dy = e.deltaY * unit;
      const dx = e.deltaX * unit;
      if (e.ctrlKey) {
        // Trackpad pinch (browsers report it as ctrl+wheel with small deltas)
        zoomBy(Math.exp(dy * 0.012));
      } else if (Math.abs(dx) > Math.abs(dy) * 1.2) {
        // Two-finger sideways swipe turns the camera
        rt.camYaw -= dx * 0.004 * useSettings.getState().mouseSensitivity;
      } else {
        // Two-finger scroll or mouse wheel: smooth, proportional zoom
        zoomBy(Math.exp(Math.max(-120, Math.min(120, dy)) * 0.0022));
      }
    };
    let gestureStart = rt.camDist;
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      gestureStart = rt.camDist;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const scale = (e as Event & { scale?: number }).scale ?? 1;
      rt.camDist = Math.max(2.2, Math.min(rt.vehicle ? 26 : 16, gestureStart / Math.max(0.2, scale)));
    };
    const onKey = (e: KeyboardEvent) => {
      if (overUI(e.target) || e.metaKey || e.ctrlKey) return;
      if (e.key === '+' || e.key === '=') zoomBy(0.88);
      else if (e.key === '-' || e.key === '_') zoomBy(1.14);
    };
    const onCtx = (e: Event) => e.preventDefault();
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('gesturestart', onGestureStart, { passive: false } as AddEventListenerOptions);
    window.addEventListener('gesturechange', onGestureChange, { passive: false } as AddEventListenerOptions);
    window.addEventListener('keydown', onKey);
    el.addEventListener('contextmenu', onCtx);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('gesturestart', onGestureStart);
      window.removeEventListener('gesturechange', onGestureChange);
      window.removeEventListener('keydown', onKey);
      el.removeEventListener('contextmenu', onCtx);
    };
  }, [gl]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const paused = isPaused();
    const p = rt.player;
    const v = rt.playerVel;

    if (rt.vehicle) {
      if (!paused) updateVehicle(dt);
      p.copy(rt.vehicle.pos);
      rt.playerRotY = rt.vehicle.yaw;
    } else if (!paused) {
      // Input relative to camera
      let ix = 0;
      let iz = 0;
      if (isDown('forward')) iz += 1;
      if (isDown('back')) iz -= 1;
      if (isDown('left')) ix -= 1;
      if (isDown('right')) ix += 1;
      ix += virtual.x;
      iz += virtual.y;
      const fx = -Math.sin(rt.camYaw);
      const fz = -Math.cos(rt.camYaw);
      const rx = Math.cos(rt.camYaw);
      const rz = -Math.sin(rt.camYaw);
      dir.set(fx * iz + rx * ix, 0, fz * iz + rz * ix);
      if (dir.lengthSq() > 0.01) rt.walkTarget = null;
      else if (rt.walkTarget) {
        dir.set(rt.walkTarget.x - p.x, 0, rt.walkTarget.z - p.z);
        if (dir.length() < 0.6) rt.walkTarget = null;
      }
      const len = Math.min(1, dir.length());
      if (len > 0.01) dir.normalize();
      const sprint = isDown('sprint') || virtual.sprint;
      const speed = (sprint ? RUN : WALK) * len;
      const accel = rt.grounded ? 14 : 4;
      v.x += (dir.x * speed - v.x) * Math.min(1, accel * dt);
      v.z += (dir.z * speed - v.z) * Math.min(1, accel * dt);
      if ((isDown('jump') || virtual.jump) && rt.grounded) {
        v.y = JUMP;
        rt.grounded = false;
        playSfx('jump');
      }
      v.y -= GRAVITY * dt;
      p.x += v.x * dt;
      p.z += v.z * dt;
      p.y += v.y * dt;
      rt.collision.resolve(p, RADIUS, HEIGHT);
      rt.collision.resolveWater(p, RADIUS);
      const ground = rt.collision.groundAt(p.x, p.z, RADIUS, p.y);
      if (p.y <= ground) {
        p.y = ground;
        v.y = 0;
        rt.grounded = true;
      } else if (p.y > ground + 0.05) rt.grounded = false;
      const hs = Math.hypot(v.x, v.z);
      rt.playerSpeed = hs;
      if (hs > 0.3) {
        const target = Math.atan2(v.x, v.z);
        let d = target - rt.playerRotY;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        rt.playerRotY += d * Math.min(1, 12 * dt);
      }
      anim.current.speed = hs / RUN + (hs > 0.2 ? 0.25 : 0);
      anim.current.grounded = rt.grounded;
    } else {
      anim.current.speed = 0;
    }

    if (group.current) {
      group.current.position.copy(p);
      group.current.rotation.y = rt.playerRotY;
    }

    // Camera follow with collision pull-in
    const vehicleCam = !!rt.vehicle;
    const targetH = vehicleCam ? (rt.vehicle!.type === 'plane' ? 2 : 1.6) : 1.55;
    camTarget.set(p.x, p.y + targetH, p.z);
    if (vehicleCam && !drag.current) {
      // Drift camera behind the vehicle
      let d = rt.vehicle!.yaw + Math.PI - rt.camYaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      rt.camYaw += d * Math.min(1, 2.5 * dt);
    }
    const desired = vehicleCam ? Math.max(rt.camDist, CHASE_DIST[rt.vehicle!.type]) : rt.camDist;
    tmp.set(Math.sin(rt.camYaw) * Math.cos(rt.camPitch), Math.sin(rt.camPitch), Math.cos(rt.camYaw) * Math.cos(rt.camPitch));
    const hit = rt.collision.raycast(camTarget, tmp, desired);
    const dist = hit !== null ? Math.max(1.2, hit - 0.4) : desired;
    smoothedDist.current += (dist - smoothedDist.current) * Math.min(1, (dist < smoothedDist.current ? 20 : 4) * dt);
    camPos.copy(camTarget).addScaledVector(tmp, smoothedDist.current);
    if (camPos.y < 0.4) camPos.y = 0.4;
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
    // Arrival flyover: orbit the skyline, then glide down into the normal follow camera
    if (rt.flyoverPending && !useUI.getState().loading.active) {
      rt.flyover = { start: performance.now() / 1000, dur: 7.5, half: rt.flyoverPending.half };
      rt.flyoverPending = null;
    }
    if (rt.flyover) {
      const fo = rt.flyover;
      const k = (performance.now() / 1000 - fo.start) / fo.dur;
      if (k >= 1) rt.flyover = null;
      else {
        const ang = rt.camYaw + (1 - k) * 2.2;
        const R = fo.half * 0.9;
        flyPos.set(Math.sin(ang) * R, fo.half * 0.42 + 18 - k * 10, Math.cos(ang) * R);
        flyLook.set(0, 6, 0);
        const e = k < 0.55 ? 0 : (k - 0.55) / 0.45;
        const ease = e * e * (3 - 2 * e);
        camera.position.lerpVectors(flyPos, camPos, ease);
        camera.lookAt(flyLook.lerp(camTarget, ease));
      }
    }
    if (rt.photo) {
      camera.position.set(...rt.photo.pos);
      camera.lookAt(...rt.photo.look);
    }

    // Nearest interactive trigger → HUD prompt
    rt.frame++;
    if (rt.frame % 6 === 0) {
      let best: (typeof rt.triggers)[number] | null = null;
      let bestD = Infinity;
      for (const t of rt.triggers) {
        const d = Math.hypot(t.x - p.x, t.z - p.z);
        if (d < t.r && d < bestD) {
          best = t;
          bestD = d;
        }
      }
      rt.nearTrigger = best;
      useUI.getState().setPrompt(best ? { id: best.id, text: best.label, icon: best.icon } : null);
    }
  });

  if (!avatar) return null;
  return (
    <group ref={group} name="player">
      {riding && rt.vehicle ? (
        <VehicleModel itemId={rt.vehicle.itemId} rider={avatar} />
      ) : (
        <Avatar config={avatar} anim={anim} />
      )}
    </group>
  );
}
