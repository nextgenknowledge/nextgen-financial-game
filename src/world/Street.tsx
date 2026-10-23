'use client';
/** Living street pieces: traffic signals, parked & moving cars, and LED stock tickers. */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { trs } from '@/engine/voxel';
import { rt } from '@/engine/runtime';
import { makeRng } from '@/game/rng';
import { isPaused } from '@/store/ui';
import { useGame } from '@/store/game';
import { carGeometry, carPaintMat, carTrimMat, type AnyCarModel } from './cars';
import type { ParkedCar, SignalHead } from './builders/streetscape';
import { CAR_PAINTS } from './builders/streetscape';
import { glowTexture } from './materials';
import type { AnimState } from './Avatar';
import { LitePerson } from './LitePerson';
import { DEFAULT_AVATAR } from '@/game/world';
import { hourOf } from '@/engine/Sky';
import { getWorld } from '@/store/game';

/** Share of cars on the road at this hour: jams at rush hour, a trickle at night. */
export function trafficLevel(hour: number) {
  if (hour < 5.5) return 0.25;
  if (hour < 7) return 0.55;
  if (hour < 9.5) return 1;
  if (hour < 16) return 0.7;
  if (hour < 19) return 1;
  if (hour < 22.5) return 0.6;
  return 0.35;
}
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const LPC = 6; // light glows per car: 2 head, 2 tail, 2 indicators

/* ───────── Signal timing (shared by lights and cars) ───────── */

const CYCLE = 22;
export type Light = 'g' | 'y' | 'r';
/** Axis 'x' gets green first, then 'z'. A short all-red gap clears the junction. */
export function signalState(axis: 'x' | 'z', t = performance.now() / 1000): Light {
  const p = t % CYCLE;
  if (axis === 'x') return p < 8.5 ? 'g' : p < 10.5 ? 'y' : 'r';
  return p < 11 ? 'r' : p < 19.5 ? 'g' : p < 21.5 ? 'y' : 'r';
}

const LENS_COLORS: Record<Light, THREE.Color> = { r: new THREE.Color('#ff3b2f'), y: new THREE.Color('#ffb21f'), g: new THREE.Color('#3dff8c') };
const LENS_Y: Record<Light, number> = { r: 0, y: -0.36, g: -0.72 };

export function TrafficSignals({ heads }: { heads: SignalHead[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const last = useRef('');
  const geo = useMemo(() => new THREE.BoxGeometry(0.42, 0.27, 0.27), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const sx = signalState('x');
    const sz = signalState('z');
    const key = sx + sz;
    if (key === last.current) return;
    last.current = key;
    heads.forEach((h, i) => {
      const st = h.axis === 'x' ? sx : sz;
      mesh.setMatrixAt(i, trs(h.x, h.y - 0.13 + LENS_Y[st], h.z, 0, h.rot, 0));
      mesh.setColorAt(i, LENS_COLORS[st]);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });
  if (!heads.length) return null;
  return <instancedMesh ref={ref} args={[geo, mat, heads.length]} frustumCulled={false} />;
}

/* ───────── Parked cars ───────── */

function CarGroup({ model, items }: { model: AnyCarModel; items: { x: number; y?: number; z: number; rot: number; color: string }[] }) {
  const paint = useRef<THREE.InstancedMesh>(null);
  const trim = useRef<THREE.InstancedMesh>(null);
  const g = carGeometry(model);
  useEffect(() => {
    const c = new THREE.Color();
    items.forEach((it, i) => {
      const m = trs(it.x, it.y ?? 0, it.z, 0, it.rot, 0);
      paint.current?.setMatrixAt(i, m);
      trim.current?.setMatrixAt(i, m);
      paint.current?.setColorAt(i, c.set(it.color));
    });
    for (const r of [paint, trim]) {
      if (!r.current) continue;
      r.current.instanceMatrix.needsUpdate = true;
      r.current.computeBoundingSphere();
    }
    if (paint.current?.instanceColor) paint.current.instanceColor.needsUpdate = true;
  }, [items]);
  return (
    <>
      <instancedMesh ref={paint} args={[g.paint, carPaintMat, items.length]} castShadow receiveShadow />
      <instancedMesh ref={trim} args={[g.trim, carTrimMat, items.length]} castShadow />
    </>
  );
}

export function ParkedCars({ cars }: { cars: ParkedCar[] }) {
  const groups = useMemo(() => {
    const m = new Map<AnyCarModel, ParkedCar[]>();
    for (const c of cars) {
      if (!m.has(c.model)) m.set(c.model, []);
      m.get(c.model)!.push(c);
    }
    return [...m.entries()];
  }, [cars]);
  const vans = useMemo(() => cars.filter((c) => c.hazard && c.drop), [cars]);
  return (
    <>
      {groups.map(([model, list]) => (
        <CarGroup key={model} model={model} items={list} />
      ))}
      {vans.map((v, i) => (
        <Delivery key={i} van={v} seed={i} />
      ))}
    </>
  );
}

const DRIVER = { ...DEFAULT_AVATAR, shirt: '#5a4a3a', pants: '#2b3346', shoes: '#1b1c1f', hat: 'cap-red', top: 'vest' };

/** Hazard lights blinking on a delivery van, and its driver carrying parcels to a shop door. */
function Delivery({ van, seed }: { van: ParkedCar; seed: number }) {
  const g = useRef<THREE.Group>(null);
  const box = useRef<THREE.Mesh>(null);
  const anim = useRef<AnimState>({ speed: 0, grounded: true });
  const lights = useRef<THREE.Points>(null);
  const half = carGeometry('van').length / 2;
  const geo = useMemo(() => {
    const sy = Math.sin(van.rot);
    const cy = Math.cos(van.rot);
    const pts: number[] = [];
    for (const [lx, lz] of [[0.85, half], [-0.85, half], [0.85, -half], [-0.85, -half]]) pts.push(van.x + lx * cy + lz * sy, 0.75, van.z - lx * sy + lz * cy);
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return gg;
  }, [van, half]);
  const mat = useMemo(() => new THREE.PointsMaterial({ map: glowTexture(), size: 1.3, color: '#ffa21f', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), []);
  // Back doors of the van to the drop point and back again
  const back = useMemo(() => ({ x: van.x - Math.sin(van.rot) * (half + 0.9), z: van.z - Math.cos(van.rot) * (half + 0.9) }), [van, half]);
  const st = useRef({ t: seed * 0.37, leg: 0 });
  useFrame((_, rawDt) => {
    const dt = isPaused() ? 0 : Math.min(rawDt, 0.05);
    const now = performance.now() / 1000;
    mat.opacity = Math.floor(now * 1.6 + seed) % 2 === 0 ? 0.95 : 0.05;
    const d = van.drop!;
    const s = st.current;
    const dist = Math.hypot(d.x - back.x, d.z - back.z);
    // leg 0: carry to door, 1: pause, 2: walk back, 3: pause at van
    const dur = [dist / 1.3, 1.6, dist / 1.6, 2.2][s.leg];
    s.t += dt;
    if (s.t > dur) {
      s.t = 0;
      s.leg = (s.leg + 1) % 4;
    }
    const k = Math.min(1, s.t / dur);
    const [from, to] = s.leg < 2 ? [back, d] : [d, back];
    const walking = s.leg === 0 || s.leg === 2;
    const x = walking ? from.x + (to.x - from.x) * k : s.leg === 1 ? d.x : back.x;
    const z = walking ? from.z + (to.z - from.z) * k : s.leg === 1 ? d.z : back.z;
    if (!g.current) return;
    g.current.position.set(x, 0, z);
    if (walking) g.current.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
    anim.current.speed = walking ? 0.35 : 0;
    anim.current.busy = s.leg === 0;
    if (box.current) box.current.visible = s.leg === 0 || s.leg === 3;
  });
  return (
    <>
      <points ref={lights} geometry={geo} material={mat} frustumCulled={false} />
      <group ref={g}>
        <LitePerson config={DRIVER} anim={anim} />
        <mesh ref={box} position={[0, 1.1, 0.42]} castShadow>
          <boxGeometry args={[0.55, 0.42, 0.4]} />
          <meshLambertMaterial color="#b8895a" />
        </mesh>
      </group>
    </>
  );
}

/* ───────── Moving traffic ───────── */

interface Car {
  loop: [number, number][];
  cum: number[]; // cumulative distance at each vertex
  total: number;
  s: number;
  v: number;
  cruise: number;
  model: AnyCarModel;
  color: string;
  yaw: number;
  len: number;
  group: number;
  /** Cars with a low rank stay on the road at quiet hours. */
  rank: number;
  braking: number;
}

function along(car: Car, s: number) {
  const L = car.loop;
  s = ((s % car.total) + car.total) % car.total;
  for (let k = 0; k < L.length; k++) {
    if (car.cum[k + 1] >= s) {
      const a = L[k];
      const b = L[(k + 1) % L.length];
      const len = car.cum[k + 1] - car.cum[k];
      const t = (s - car.cum[k]) / len;
      return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, yaw: Math.atan2(b[0] - a[0], b[1] - a[1]), k, toCorner: car.cum[k + 1] - s, axis: Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1]) ? ('x' as const) : ('z' as const) };
    }
  }
  return { x: L[0][0], z: L[0][1], yaw: 0, k: 0, toCorner: 0, axis: 'x' as const };
}

/**
 * Cars cruise around city blocks, keep a safe gap to the car ahead, stop at red lights,
 * and wait for the player. One instanced mesh pair per model.
 */
export function Traffic({ loops, count, colors, cityId }: { loops: [number, number][][]; count: number; colors: string[]; cityId: string }) {
  const cars = useMemo<Car[]>(() => {
    if (!loops.length) return [];
    const rng = makeRng(77);
    const perLoop = Math.max(1, Math.ceil(count / loops.length));
    const out: Car[] = [];
    loops.forEach((loop, li) => {
      const cum = [0];
      for (let i = 0; i < loop.length; i++) cum.push(cum[i] + Math.hypot(loop[(i + 1) % loop.length][0] - loop[i][0], loop[(i + 1) % loop.length][1] - loop[i][1]));
      const total = cum[loop.length];
      for (let k = 0; k < perLoop && out.length < count; k++) {
        if (li * perLoop + k >= count) break;
        const roll = rng.next();
        const model: AnyCarModel =
          roll < 0.06 ? 'bus' : cityId === 'new-york' && roll < 0.38 ? 'taxi' : roll < 0.5 ? 'suv' : roll < 0.6 ? 'van' : roll < 0.75 ? 'hatch' : 'sedan';
        const color = model === 'taxi' ? '#e8b923' : model === 'bus' ? (cityId === 'london' ? '#b3261e' : '#e9e9e6') : rng.chance(0.25) ? rng.pick(colors) : rng.pick(CAR_PAINTS);
        out.push({ loop, cum, total, s: (total * k) / perLoop + rng.range(0, 4), v: 0, cruise: rng.range(7.5, 10.5), model, color, yaw: 0, len: carGeometry(model).length, group: li, rank: rng.next(), braking: 0 });
      }
    });
    return out;
  }, [loops, count, colors, cityId]);

  const byModel = useMemo(() => {
    const m = new Map<AnyCarModel, number[]>();
    cars.forEach((c, i) => {
      if (!m.has(c.model)) m.set(c.model, []);
      m.get(c.model)!.push(i);
    });
    return [...m.entries()];
  }, [cars]);
  const refs = useRef(new Map<string, THREE.InstancedMesh | null>());
  // Head- and tail-light glows (4 per car), visible from dusk
  const lights = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(cars.length * LPC * 3), 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(cars.length * LPC * 3), 3));
    const mat = new THREE.PointsMaterial({ map: glowTexture(), size: 1.5, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 1, toneMapped: false });
    return { geo, mat };
  }, [cars]);

  useFrame((_, rawDt) => {
    const dt = isPaused() ? 0 : Math.min(rawDt, 0.05);
    const now = performance.now() / 1000;
    // Gap to the car ahead on the same loop
    const ahead = new Map<Car, number>();
    const groups = new Map<number, Car[]>();
    const level = trafficLevel(hourOf(getWorld()?.time.t ?? 0.3));
    const onRoad = (c: Car) => c.rank <= level;
    for (const c of cars) {
      if (!onRoad(c)) continue;
      if (!groups.has(c.group)) groups.set(c.group, []);
      groups.get(c.group)!.push(c);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => (a.s % a.total) - (b.s % b.total));
      list.forEach((c, i) => {
        const n = list[(i + 1) % list.length];
        if (n === c) return ahead.set(c, Infinity);
        let gap = (n.s % n.total) - (c.s % c.total);
        if (gap <= 0) gap += c.total;
        ahead.set(c, gap - (c.len + n.len) / 2);
      });
    }
    for (const car of cars) {
      if (!onRoad(car)) continue;
      const p = along(car, car.s);
      let target = car.cruise;
      // Red / amber light ahead: brake smoothly to the stop line
      const front = p.toCorner - car.len / 2;
      const light = signalState(p.axis, now);
      if (light !== 'g' && front > 3.6 && front < 16) {
        const stopAt = front - 4.6;
        if (light === 'r' || stopAt > 2) target = Math.min(target, Math.max(0, stopAt) * 1.4);
      }
      // Keep a safe gap
      const gap = ahead.get(car) ?? Infinity;
      target = Math.min(target, Math.max(0, gap - 2.2) * 1.6);
      // Wait for the player standing in the lane
      const look = along(car, car.s + car.len / 2 + 2.5);
      if (Math.hypot(look.x - rt.player.x, look.z - rt.player.z) < 2.6 && !rt.vehicle) target = 0;
      // Brake lights come on when slowing hard or waiting
      car.braking = target < car.v - 0.4 || car.v < 0.6 ? 1 : Math.max(0, car.braking - dt * 3);
      car.v += (target - car.v) * Math.min(1, (target < car.v ? 4 : 1.6) * dt);
      car.s += Math.max(0, car.v) * dt;
      let d = p.yaw - car.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      car.yaw += d * Math.min(1, 5 * dt);
    }
    // Light glows follow the cars: headlights after dusk, brake lights and indicators any time
    const night = Math.min(1, Math.max(0, 0.8 - rt.dayLight) * 1.4 + (rt.weatherAmt > 0.5 && rt.weather !== 'haze' ? 0.4 : 0));
    const blink = Math.floor(now * 2.6) % 2 === 0 ? 1 : 0;
    const pos = lights.geo.getAttribute('position') as THREE.BufferAttribute;
    const col = lights.geo.getAttribute('color') as THREE.BufferAttribute;
    cars.forEach((car, i) => {
      const base = i * LPC;
      if (!onRoad(car)) {
        for (let k = 0; k < LPC; k++) col.setXYZ(base + k, 0, 0, 0);
        return;
      }
      const p = along(car, car.s);
      const sy = Math.sin(car.yaw);
      const cy = Math.cos(car.yaw);
      const half = car.len / 2 + 0.05;
      // Which way the next corner turns (+1 = toward local +x)
      const L = car.loop;
      const a = L[p.k];
      const b = L[(p.k + 1) % L.length];
      const c2 = L[(p.k + 2) % L.length];
      const nx = c2[0] - b[0];
      const nz = c2[1] - b[1];
      const turn = Math.sign(nx * Math.cos(Math.atan2(b[0] - a[0], b[1] - a[1])) - nz * Math.sin(Math.atan2(b[0] - a[0], b[1] - a[1])));
      const signalling = p.toCorner < 16 && p.toCorner > car.len / 2 - 1 ? blink : 0;
      const pts = [
        [0.62, 0.68, half],
        [-0.62, 0.68, half],
        [0.62, 0.72, -half],
        [-0.62, 0.72, -half],
        [0.8 * turn, 0.7, half - 0.1],
        [0.8 * turn, 0.74, -half + 0.1],
      ];
      pts.forEach(([lx, ly, lz], k) => pos.setXYZ(base + k, p.x + lx * cy + lz * sy, ly, p.z - lx * sy + lz * cy));
      const head = night * 0.9;
      const tail = Math.min(1, night * 0.45 + car.braking * 0.85);
      col.setXYZ(base, head, head * 0.95, head * 0.8);
      col.setXYZ(base + 1, head, head * 0.95, head * 0.8);
      col.setXYZ(base + 2, tail, tail * 0.1, tail * 0.06);
      col.setXYZ(base + 3, tail, tail * 0.1, tail * 0.06);
      const ind = signalling * 0.9;
      col.setXYZ(base + 4, ind, ind * 0.55, 0);
      col.setXYZ(base + 5, ind, ind * 0.55, 0);
    });
    pos.needsUpdate = true;
    col.needsUpdate = true;
    const c = new THREE.Color();
    for (const [model, idx] of byModel) {
      const paint = refs.current.get(model + ':p');
      const trim = refs.current.get(model + ':t');
      if (!paint || !trim) continue;
      idx.forEach((ci, i) => {
        const car = cars[ci];
        const p = along(car, car.s);
        const m = onRoad(car) ? trs(p.x, 0, p.z, 0, car.yaw, 0) : HIDDEN;
        paint.setMatrixAt(i, m);
        trim.setMatrixAt(i, m);
      });
      paint.instanceMatrix.needsUpdate = true;
      trim.instanceMatrix.needsUpdate = true;
      if (!paint.userData.colored) {
        idx.forEach((ci, i) => paint.setColorAt(i, c.set(cars[ci].color)));
        if (paint.instanceColor) paint.instanceColor.needsUpdate = true;
        paint.userData.colored = true;
      }
    }
  });
  if (!cars.length) return null;
  return (
    <>
      <points geometry={lights.geo} material={lights.mat} frustumCulled={false} />
      {byModel.map(([model, idx]) => {
        const g = carGeometry(model);
        return (
          <group key={model}>
            <instancedMesh ref={(m) => void refs.current.set(model + ':p', m)} args={[g.paint, carPaintMat, idx.length]} frustumCulled={false} castShadow />
            <instancedMesh ref={(m) => void refs.current.set(model + ':t', m)} args={[g.trim, carTrimMat, idx.length]} frustumCulled={false} />
          </group>
        );
      })}
    </>
  );
}

/* ───────── LED stock tickers ───────── */

const TICKER_PX_H = 48;
const TICKER_M_PER_TEX = 32; // meters of ticker covered by one canvas width

function drawTicker(canvas: HTMLCanvasElement) {
  const w = useGame.getState().world;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#050607';
  g.fillRect(0, 0, canvas.width, canvas.height);
  // LED dot grid
  g.fillStyle = 'rgba(255,255,255,0.025)';
  for (let x = 0; x < canvas.width; x += 3) for (let y = 0; y < canvas.height; y += 3) g.fillRect(x, y, 1, 1);
  if (!w) return;
  g.font = `700 ${Math.round(TICKER_PX_H * 0.62)}px 'Helvetica Neue', Helvetica, Arial, sans-serif`;
  g.textBaseline = 'middle';
  let x = 12;
  const syms = Object.keys(w.market.prices);
  let i = 0;
  while (x < canvas.width - 10 && syms.length) {
    const sym = syms[i++ % syms.length];
    const price = w.market.prices[sym];
    const hist = w.market.history[sym] ?? [];
    const prev = hist.length > 1 ? hist[hist.length - 2] : price;
    const ch = prev ? ((price - prev) / prev) * 100 : 0;
    const up = ch >= 0;
    g.fillStyle = '#ffc24a';
    g.fillText(sym, x, TICKER_PX_H / 2);
    x += g.measureText(sym).width + 10;
    g.fillStyle = '#e8eef0';
    const ps = price.toFixed(2);
    g.fillText(ps, x, TICKER_PX_H / 2);
    x += g.measureText(ps).width + 8;
    g.fillStyle = up ? '#3dff8c' : '#ff4a3d';
    const cs = `${up ? '▲' : '▼'}${Math.abs(ch).toFixed(2)}%`;
    g.fillText(cs, x, TICKER_PX_H / 2);
    x += g.measureText(cs).width + 34;
  }
}

export function Tickers({ tickers }: { tickers: { x: number; y: number; z: number; rotY: number; w: number; h: number }[] }) {
  const base = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 2048;
    c.height = TICKER_PX_H;
    drawTicker(c);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    return { c, t };
  }, []);
  const mats = useMemo(
    () =>
      tickers.map((tk) => {
        const t = base.t.clone();
        t.repeat.set(tk.w / TICKER_M_PER_TEX, 1);
        return new THREE.MeshBasicMaterial({ map: t, toneMapped: false });
      }),
    [tickers, base],
  );
  const redraw = useRef(0);
  useFrame((_, dt) => {
    for (const m of mats) m.map!.offset.x += dt * (1.6 / TICKER_M_PER_TEX);
    redraw.current += dt;
    if (redraw.current > 6) {
      redraw.current = 0;
      drawTicker(base.c);
      base.t.needsUpdate = true;
      for (const m of mats) m.map!.needsUpdate = true;
    }
  });
  return (
    <>
      {tickers.map((tk, i) => (
        <mesh key={i} position={[tk.x, tk.y, tk.z]} rotation={[0, tk.rotY, 0]} material={mats[i]}>
          <planeGeometry args={[tk.w, tk.h]} />
        </mesh>
      ))}
    </>
  );
}
