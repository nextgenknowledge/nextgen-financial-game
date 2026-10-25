'use client';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { rbox } from './Avatar';
import { VoxelBuilder, cylinder, trs } from '@/engine/voxel';
import { hourOf } from '@/engine/Sky';
import { getWorld } from '@/store/game';
import { pixelTexture } from '@/engine/pixtex';
import { rt } from '@/engine/runtime';
import { makeRng } from '@/game/rng';
import { isPaused } from '@/store/ui';

const SKINS = ['#ffdcc0', '#f2c39c', '#e8b48f', '#c98e64', '#a96e48', '#7d4f33', '#5a3826'];
// Everyday city clothing: suits, knitwear, denim, coats, the odd bright jacket
const SHIRTS = ['#2f3d55', '#1f2226', '#e9e9e6', '#8c9196', '#6b1f24', '#c9c3b4', '#3b4a3a', '#5b6f8f', '#a35c3c', '#d8cdb8', '#41526b', '#7a2e3a', '#2b5b8a', '#c98a2e'];
const PANTS = ['#2b3346', '#1f2226', '#4a4f57', '#6e6252', '#2f3d55', '#b9ad94', '#3a3f36', '#33507f'];
const SHOES = ['#1b1c1f', '#e9e9e6', '#5a3826', '#3a3f45', '#1b1c1f'];
const HAIR = ['#1e1a18', '#3b2a20', '#6b4428', '#b07a3c', '#e2b85e', '#8a8f96', '#2a211b'];

/** What people carry: briefcase, coffee cup, shopping bag, phone. Size [w,h,d], offset from the hand. */
const CARRY = [
  { size: [0.12, 0.34, 0.44], off: [0, -0.96, 0.02], color: '#3a2a1e' },
  { size: [0.1, 0.15, 0.1], off: [0, -0.72, 0.14], color: '#efe8da' },
  { size: [0.16, 0.38, 0.32], off: [0, -0.98, 0.02], color: '#c9a77a' },
  { size: [0.08, 0.16, 0.03], off: [0, -0.68, 0.15], color: '#15171a' },
] as const;

// Sportswear for joggers
const SPORT = ['#e0453a', '#2b8ad0', '#f2c230', '#2fae6a', '#e9e9e6', '#1f2226', '#d0457a'];
const UMBRELLAS = ['#1f2226', '#1f2226', '#2f3d55', '#6b1f24', '#2b5b8a', '#c9a227', '#3b4a3a', '#d8d4cc'];
const DOGS = ['#c9a06a', '#3a2a1e', '#f0e6d2', '#1f1c1a', '#8a6440', '#b0b4b8'];

/** How busy the pavements are at this hour: rush hours full, small hours nearly empty. */
export function footfall(hour: number) {
  if (hour < 5.5) return 0.15;
  if (hour < 7) return 0.45;
  if (hour < 9.5) return 1;
  if (hour < 16.5) return 0.75;
  if (hour < 19) return 1;
  if (hour < 22) return 0.55;
  return 0.25;
}

interface Walker {
  role: 'walk' | 'jog' | 'dog';
  umbrella: boolean;
  /** Order in which people leave the streets as it quietens down (0 = last to go). */
  rank: number;
  dogYaw: number;
  dogX: number;
  dogZ: number;
  loop: [number, number][];
  seg: number;
  t: number;
  speed: number;
  dir: 1 | -1;
  x: number;
  z: number;
  yaw: number;
  phase: number;
  wait: number;
  scale: number;
  carry: number; // -1 = hands free
}

const PARTS = [
  { key: 'legL', geo: rbox(0.28, 0.76, 0.3, 0.06), pivot: [0.16, 0.9, 0], offset: [0, -0.38, 0], color: 'pants', swing: 1 },
  { key: 'legR', geo: rbox(0.28, 0.76, 0.3, 0.06), pivot: [-0.16, 0.9, 0], offset: [0, -0.38, 0], color: 'pants', swing: -1 },
  { key: 'torso', geo: rbox(0.64, 0.7, 0.36, 0.08), pivot: [0, 1.24, 0], offset: [0, 0, 0], color: 'shirt', swing: 0 },
  { key: 'armL', geo: rbox(0.2, 0.66, 0.23, 0.06), pivot: [0.43, 1.53, 0], offset: [0, -0.32, 0], color: 'shirt', swing: -0.9 },
  { key: 'armR', geo: rbox(0.2, 0.66, 0.23, 0.06), pivot: [-0.43, 1.53, 0], offset: [0, -0.32, 0], color: 'shirt', swing: 0.9 },
  { key: 'handL', geo: rbox(0.18, 0.15, 0.2, 0.05), pivot: [0.43, 1.53, 0], offset: [0, -0.72, 0], color: 'skin', swing: -0.9 },
  { key: 'handR', geo: rbox(0.18, 0.15, 0.2, 0.05), pivot: [-0.43, 1.53, 0], offset: [0, -0.72, 0], color: 'skin', swing: 0.9 },
  { key: 'neck', geo: rbox(0.2, 0.14, 0.2, 0.04), pivot: [0, 1.62, 0], offset: [0, 0, 0], color: 'skin', swing: 0 },
  { key: 'head', geo: rbox(0.5, 0.5, 0.49, 0.08), pivot: [0, 1.93, 0], offset: [0, 0, 0], color: 'skin', swing: 0 },
  { key: 'eyes', geo: new THREE.BoxGeometry(0.3, 0.06, 0.02).translate(0, 0, 0.25), pivot: [0, 1.96, 0], offset: [0, 0, 0], color: 'eyes', swing: 0 },
  { key: 'hair', geo: rbox(0.54, 0.17, 0.53, 0.06), pivot: [0, 2.17, -0.02], offset: [0, 0, 0], color: 'hair', swing: 0 },
  { key: 'shoeL', geo: rbox(0.3, 0.15, 0.4, 0.05), pivot: [0.16, 0.9, 0], offset: [0, -0.82, 0.04], color: 'shoes', swing: 1 },
  { key: 'shoeR', geo: rbox(0.3, 0.15, 0.4, 0.05), pivot: [-0.16, 0.9, 0], offset: [0, -0.82, 0.04], color: 'shoes', swing: -1 },
  { key: 'carry', geo: new THREE.BoxGeometry(1, 1, 1), pivot: [-0.43, 1.53, 0], offset: [0, 0, 0], color: 'carry', swing: 0.9 },
] as const;
const mScale = new THREE.Matrix4();
const HIDE = new THREE.Matrix4().makeScale(0, 0, 0);

/** Umbrella: canopy with ribs, shaft and a hooked handle. White vertex colours so the instance colour paints the canopy. */
const umbrellaGeo = (() => {
  const b = new VoxelBuilder();
  b.geom(cylinder(0.04, 0.62, 0.26, 8), trs(0, 0.95, 0), '#ffffff');
  b.geom(cylinder(0.015, 0.015, 1.0, 5), trs(0, 0.45, 0), '#2a2a2a');
  b.box(0, 0.0, 0.04, 0.03, 0.1, 0.1, '#3a2a1e');
  return b.build();
})();
/** Dog: body, head, snout, ears, legs and a tail, pointing +Z. */
const dogGeo = (() => {
  const b = new VoxelBuilder();
  b.box(0, 0.32, 0, 0.24, 0.22, 0.56, '#ffffff');
  b.box(0, 0.46, 0.32, 0.2, 0.2, 0.2, '#ffffff');
  b.box(0, 0.42, 0.45, 0.1, 0.08, 0.1, '#e8e2da');
  b.box(0, 0.46, 0.505, 0.05, 0.04, 0.02, '#1a1a1a');
  for (const sx of [-0.07, 0.07]) b.box(sx, 0.58, 0.3, 0.05, 0.08, 0.05, '#ffffff');
  for (const [lx, lz] of [[-0.08, 0.2], [0.08, 0.2], [-0.08, -0.2], [0.08, -0.2]]) b.box(lx, 0.11, lz, 0.06, 0.22, 0.06, '#ffffff');
  b.geom(new THREE.BoxGeometry(0.04, 0.04, 0.2), trs(0, 0.5, -0.34, -0.7), '#ffffff');
  b.box(0, 0.4, 0.22, 0.25, 0.04, 0.05, '#b3261e');
  return b.build();
})();
const extraMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const leashMat = new THREE.MeshBasicMaterial({ color: '#2a2a2a' });
const leashGeo = new THREE.BoxGeometry(0.02, 0.02, 1).translate(0, 0, 0.5);
const vA = new THREE.Vector3();
const vB = new THREE.Vector3();
const vC = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

const mBase = new THREE.Matrix4();
const mPart = new THREE.Matrix4();
const mRot = new THREE.Matrix4();
const mOff = new THREE.Matrix4();
const partMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
let clothMat: THREE.MeshLambertMaterial | null = null;
/** Clothes get a faint woven texture; skin, hair and props stay smooth. */
function matFor(key: string) {
  if (!['legL', 'legR', 'torso', 'armL', 'armR'].includes(key)) return partMat;
  clothMat ??= new THREE.MeshLambertMaterial({ map: pixelTexture('twill', '#f2f2f2') });
  return clothMat;
}

/** Instanced walking townsfolk: 7 draw calls no matter how many people. */
export function Crowd({ loops, count, seed = 1 }: { loops: [number, number][][]; count: number; seed?: number }) {
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const walkers = useMemo<Walker[]>(() => {
    if (!loops.length) return [];
    const rng = makeRng(seed);
    return Array.from({ length: count }, () => {
      const loop = rng.pick(loops);
      const role: Walker['role'] = rng.chance(0.08) ? 'jog' : rng.chance(0.08) ? 'dog' : 'walk';
      return {
        role,
        umbrella: role !== 'jog' && rng.chance(0.75),
        rank: rng.next(),
        dogYaw: 0,
        dogX: 0,
        dogZ: 0,
        loop,
        seg: rng.int(0, loop.length - 1),
        t: rng.next(),
        speed: role === 'jog' ? rng.range(3.0, 3.6) : role === 'dog' ? rng.range(0.9, 1.2) : rng.range(1.1, 1.8),
        dir: rng.chance(0.5) ? 1 : -1,
        x: 0,
        z: 0,
        yaw: 0,
        phase: rng.range(0, 10),
        wait: 0,
        scale: rng.range(0.85, 1.05),
        carry: role === 'walk' && rng.chance(0.55) ? rng.int(0, CARRY.length - 1) : -1,
      } as Walker;
    });
  }, [loops, count, seed]);
  const colors = useMemo(() => {
    const rng = makeRng(seed + 5);
    return walkers.map((w) => ({
      skin: rng.pick(SKINS),
      shirt: w.role === 'jog' ? rng.pick(SPORT) : rng.pick(SHIRTS),
      pants: w.role === 'jog' ? rng.pick(['#1f2226', '#1f2226', '#2f3d55', '#4a4f57']) : rng.pick(PANTS),
      umbrella: rng.pick(UMBRELLAS),
      dog: rng.pick(DOGS),
      hair: rng.pick(HAIR),
      shoes: rng.pick(SHOES),
      carry: w.carry >= 0 ? (w.carry === 2 && rng.chance(0.5) ? '#f4f1ea' : CARRY[w.carry].color) : '#000000',
      eyes: '#24262c',
    }));
  }, [walkers, seed]);

  useFrame((_, rawDt) => {
    const dt = isPaused() ? 0 : Math.min(rawDt, 0.05);
    const c = new THREE.Color();
    const raining = rt.weather === 'rain' && rt.weatherAmt > 0.25;
    const busy = footfall(hourOf(getWorld()?.time.t ?? 0.3)) * (raining ? 0.75 : 1);
    const umb = refs.current[PARTS.length];
    const dog = refs.current[PARTS.length + 1];
    const leash = refs.current[PARTS.length + 2];
    walkers.forEach((w, i) => {
      // Quiet hours: some people go home (hidden), the rest keep walking
      if (w.rank > busy) {
        PARTS.forEach((_, k) => refs.current[k]?.setMatrixAt(i, HIDE));
        umb?.setMatrixAt(i, HIDE);
        dog?.setMatrixAt(i, HIDE);
        leash?.setMatrixAt(i, HIDE);
        return;
      }
      const n = w.loop.length;
      const a = w.loop[w.seg];
      const b = w.loop[(w.seg + 1) % n];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const nearPlayer = Math.hypot(w.x - rt.player.x, w.z - rt.player.z) < 1.4;
      if (w.wait > 0) w.wait -= dt;
      else if (!nearPlayer) {
        w.t += (w.dir * w.speed * dt) / len;
        if (w.t > 1) {
          w.t = 0;
          w.seg = (w.seg + 1) % n;
          if (Math.random() < 0.08) w.wait = 1 + Math.random() * 3;
        } else if (w.t < 0) {
          w.t = 1;
          w.seg = (w.seg - 1 + n) % n;
        }
      }
      const a2 = w.loop[w.seg];
      const b2 = w.loop[(w.seg + 1) % n];
      w.x = a2[0] + (b2[0] - a2[0]) * w.t;
      w.z = a2[1] + (b2[1] - a2[1]) * w.t;
      const moving = w.wait <= 0 && !nearPlayer;
      const targetYaw = Math.atan2((b2[0] - a2[0]) * w.dir, (b2[1] - a2[1]) * w.dir);
      let d = targetYaw - w.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      w.yaw += d * Math.min(1, 8 * dt);
      if (nearPlayer) w.yaw = Math.atan2(rt.player.x - w.x, rt.player.z - w.z);
      const jog = w.role === 'jog';
      if (moving) w.phase += dt * (jog ? 3.4 : 7 * 0.7) * w.speed;
      const swing = moving ? Math.sin(w.phase) * (jog ? 0.95 : 0.7) : 0;
      const bob = moving ? Math.abs(Math.sin(w.phase)) * (jog ? 0.12 : 0.05) : 0;
      const hold = raining && w.umbrella;
      mBase.compose(new THREE.Vector3(w.x, bob, w.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), w.yaw), new THREE.Vector3(w.scale, w.scale, w.scale));
      PARTS.forEach((p, k) => {
        const mesh = refs.current[k];
        if (!mesh) return;
        mPart.makeTranslation(p.pivot[0], p.pivot[1], p.pivot[2]);
        // Umbrella arm is raised and still; joggers pump bent arms
        const left = p.key === 'armL' || p.key === 'handL';
        if (hold && left) mRot.makeRotationX(-1.2);
        else if (w.role === 'dog' && left) mRot.makeRotationX(-0.5);
        else mRot.makeRotationX(swing * p.swing * (p.key === 'carry' && w.carry === 1 ? 0.3 : 1) * (jog && p.swing !== 0 && !p.key.startsWith('leg') && !p.key.startsWith('shoe') ? 1.2 : 1));
        if (p.key === 'carry') {
          const cdef = w.carry >= 0 ? CARRY[w.carry] : null;
          mOff.makeTranslation(cdef ? cdef.off[0] : 0, cdef ? cdef.off[1] : 0, cdef ? cdef.off[2] : 0);
          mScale.makeScale(cdef ? cdef.size[0] : 0.0001, cdef ? cdef.size[1] : 0.0001, cdef ? cdef.size[2] : 0.0001);
          mOff.multiply(mScale);
        } else mOff.makeTranslation(p.offset[0], p.offset[1], p.offset[2]);
        mPart.multiply(mRot).multiply(mOff);
        mesh.setMatrixAt(i, mPart.premultiply(mBase));
      });
      // Umbrella held up in the left hand, canopy over the head
      if (umb) {
        if (hold) {
          mPart.makeTranslation(0.34, 1.74, 0.46).premultiply(mBase);
          umb.setMatrixAt(i, mPart);
        } else umb.setMatrixAt(i, HIDE);
      }
      // Dog trotting ahead on its lead
      if (dog && leash) {
        if (w.role === 'dog') {
          const fx = Math.sin(w.yaw);
          const fz = Math.cos(w.yaw);
          const tx = w.x + fx * 1.1 - fz * 0.45;
          const tz = w.z + fz * 1.1 + fx * 0.45;
          w.dogX += (tx - w.dogX) * Math.min(1, dt * 4);
          w.dogZ += (tz - w.dogZ) * Math.min(1, dt * 4);
          if (Math.hypot(tx - w.dogX, tz - w.dogZ) > 4) {
            w.dogX = tx;
            w.dogZ = tz;
          }
          w.dogYaw = w.yaw + Math.sin(w.phase * 0.5) * 0.15;
          const hop = moving ? Math.abs(Math.sin(w.phase * 2)) * 0.05 : 0;
          dog.setMatrixAt(i, trs(w.dogX, hop, w.dogZ, 0, w.dogYaw, 0, 1.1, 1.1, 1.1));
          vA.set(0.43, 0.95, 0.25).applyMatrix4(mBase);
          vB.set(w.dogX + Math.sin(w.dogYaw) * 0.25, 0.44, w.dogZ + Math.cos(w.dogYaw) * 0.25);
          // Lead runs from the dog's collar up to the owner's hand
          const len = vA.distanceTo(vB);
          mPart.lookAt(vA, vB, UP).scale(vC.set(1, 1, len)).setPosition(vB);
          leash.setMatrixAt(i, mPart);
        } else {
          dog.setMatrixAt(i, HIDE);
          leash.setMatrixAt(i, HIDE);
        }
      }
    });
    for (const m of [umb, dog, leash]) if (m) m.instanceMatrix.needsUpdate = true;
    if (umb && !umb.userData.colored) {
      colors.forEach((col, i) => umb.setColorAt(i, c.set(col.umbrella)));
      if (umb.instanceColor) umb.instanceColor.needsUpdate = true;
      umb.userData.colored = true;
    }
    if (dog && !dog.userData.colored) {
      colors.forEach((col, i) => dog.setColorAt(i, c.set(col.dog)));
      if (dog.instanceColor) dog.instanceColor.needsUpdate = true;
      dog.userData.colored = true;
    }
    PARTS.forEach((p, k) => {
      const mesh = refs.current[k];
      if (!mesh) return;
      mesh.instanceMatrix.needsUpdate = true;
      if (!mesh.userData.colored) {
        colors.forEach((col, i) => mesh.setColorAt(i, c.set(col[p.color as keyof typeof col])));
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.userData.colored = true;
      }
    });
  });
  if (!walkers.length) return null;
  return (
    <>
      {PARTS.map((p, k) => (
        <instancedMesh key={p.key} ref={(m) => void (refs.current[k] = m)} args={[p.geo, matFor(p.key), walkers.length]} frustumCulled={false} />
      ))}
      <instancedMesh ref={(m) => void (refs.current[PARTS.length] = m)} args={[umbrellaGeo, extraMat, walkers.length]} frustumCulled={false} />
      <instancedMesh ref={(m) => void (refs.current[PARTS.length + 1] = m)} args={[dogGeo, extraMat, walkers.length]} frustumCulled={false} />
      <instancedMesh ref={(m) => void (refs.current[PARTS.length + 2] = m)} args={[leashGeo, leashMat, walkers.length]} frustumCulled={false} />
    </>
  );
}

const carMat = new THREE.MeshLambertMaterial({ vertexColors: true });

/* ───────── Boats ───────── */

export function Boats({ loops, count, junk }: { loops: { cx: number; cz: number; rx: number; rz: number }[]; count: number; junk?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => {
    const b = new VoxelBuilder();
    b.block(0, -0.3, 0, 2.2, 0.8, 5, '#f4f6fa');
    b.block(0, 0.5, -0.4, 1.6, 0.8, 2, '#d9dde6');
    b.block(0, -0.32, 0, 2.24, 0.15, 5.04, '#2f6bdb');
    b.block(0, 0.5, 0.6, 0.15, 5, 0.15, '#8a6a42');
    b.box(0.0, 3.4, 1.2, 0.08, 3.6, 2.2, junk ? '#d0402a' : '#ffffff');
    return b.build();
  }, [junk]);
  const boats = useMemo(() => {
    if (!loops.length) return [];
    const rng = makeRng(31);
    return Array.from({ length: count }, (_, i) => ({ loop: loops[i % loops.length], a: rng.range(0, Math.PI * 2), v: rng.range(0.03, 0.06) * (rng.chance(0.5) ? 1 : -1), k: rng.range(0.6, 0.95) }));
  }, [loops, count]);
  useFrame((state, rawDt) => {
    const dt = isPaused() ? 0 : Math.min(rawDt, 0.05);
    const mesh = ref.current;
    if (!mesh) return;
    boats.forEach((b, i) => {
      b.a += b.v * dt;
      const x = b.loop.cx + Math.cos(b.a) * b.loop.rx * b.k;
      const z = b.loop.cz + Math.sin(b.a) * b.loop.rz * b.k;
      const yaw = Math.atan2(-Math.sin(b.a) * b.loop.rx * Math.sign(b.v), Math.cos(b.a) * b.loop.rz * Math.sign(b.v));
      mesh.setMatrixAt(i, trs(x, Math.sin(state.clock.elapsedTime * 1.5 + i) * 0.08, z, 0, yaw, Math.sin(state.clock.elapsedTime + i) * 0.03));
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  if (!boats.length || !loops.length) return null;
  return <instancedMesh ref={ref} args={[geo, carMat, boats.length]} frustumCulled={false} />;
}
