'use client';
/**
 * Ambient city life that isn't traffic or pedestrians: tower cranes slewing over building sites
 * with their crews, steam drifting out of New York's streets, and pigeons that scatter when
 * you walk through them.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VoxelBuilder, cylinder, trs } from '@/engine/voxel';
import { rt } from '@/engine/runtime';
import { isPaused } from '@/store/ui';
import { makeRng } from '@/game/rng';
import { DEFAULT_AVATAR } from '@/game/world';
import { M, glowTexture } from './materials';
import type { AnimState } from './Avatar';
import { LitePerson } from './LitePerson';
import type { Site } from './builders/streetscape';

/* ───────── Building sites ───────── */

const YELLOW = '#e0b02a';

function jibGeometry(jib: number) {
  const b = new VoxelBuilder();
  // Slewing unit and operator's cab
  b.box(0, 0.6, 0, 2.2, 1.2, 2.2, YELLOW, { tex: 'metal' });
  b.box(0.9, 0.1, 1.3, 1.1, 1.4, 1.2, '#e8e4da', { tex: 'metal' });
  b.box(0.9, 0.25, 1.92, 1.0, 0.8, 0.04, '#2a3a4a');
  // Main jib: triangular lattice reaching out along +Z
  const top = 2.6;
  for (let z = 1.2; z < jib; z += 1.6) {
    for (const x of [-0.6, 0.6]) b.box(x, 1.2, z + 0.8, 0.1, 0.1, 1.6, YELLOW);
    b.box(0, top - (z / jib) * 1.1, z + 0.8, 0.1, 0.1, 1.6, YELLOW);
    b.box(0, 1.2, z, 1.2, 0.08, 0.08, YELLOW);
    for (const x of [-0.3, 0.3]) b.geom(new THREE.BoxGeometry(0.06, 1.6, 0.06), trs(x, (1.2 + top - (z / jib) * 1.1) / 2, z, 0, 0, x > 0 ? -0.35 : 0.35), YELLOW);
  }
  // Apex tower, tie bars, counter-jib with concrete counterweights
  b.box(0, 3.4, 0, 0.5, 4.4, 0.5, YELLOW);
  b.geom(new THREE.BoxGeometry(0.05, 0.05, 1), new THREE.Matrix4().compose(new THREE.Vector3(0, 3.2, jib * 0.35), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.atan2(4, jib * 0.7), 0, 0)), new THREE.Vector3(1, 1, Math.hypot(jib * 0.7, 4))), '#3a3a3a');
  b.geom(new THREE.BoxGeometry(0.05, 0.05, 1), new THREE.Matrix4().compose(new THREE.Vector3(0, 3.4, -4), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.atan2(3.6, 8), 0, 0)), new THREE.Vector3(1, 1, Math.hypot(8, 3.6))), '#3a3a3a');
  b.box(0, 1.3, -4.2, 1.4, 0.3, 8, YELLOW);
  for (let i = 0; i < 4; i++) b.box(0, 0.6, -6.2 - i * 0.55, 1.6, 1.2, 0.5, '#9a968e', { tex: 'concrete' });
  // Trolley near the tip
  b.box(0, 0.95, jib * 0.7, 0.9, 0.4, 0.9, '#3a3f45');
  return b.build();
}

function Crane({ crane, seed }: { crane: Site['crane']; seed: number }) {
  const g = useRef<THREE.Group>(null);
  const hook = useRef<THREE.Group>(null);
  const geo = useMemo(() => jibGeometry(crane.jib), [crane.jib]);
  const st = useRef({ yaw: crane.rot, target: crane.rot, hold: 3 + seed, drop: 8 });
  const beacon = useMemo(() => new THREE.PointsMaterial({ map: glowTexture(), size: 3, color: '#ff3b2f', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), []);
  const beaconGeo = useMemo(() => {
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute([0, 6, 0, 0, 1.6, crane.jib], 3));
    return gg;
  }, [crane.jib]);
  useFrame((_, rawDt) => {
    const dt = isPaused() ? 0 : Math.min(rawDt, 0.05);
    const s = st.current;
    // Slew to a new heading, pause while the load is raised or lowered, repeat
    if (s.hold > 0) {
      s.hold -= dt;
      if (s.hold <= 0) s.target = s.yaw + (Math.random() - 0.5) * 2.4;
    } else {
      const d = s.target - s.yaw;
      s.yaw += Math.sign(d) * Math.min(Math.abs(d), dt * 0.12);
      if (Math.abs(d) < 0.002) s.hold = 6 + Math.random() * 8;
    }
    s.drop += ((s.hold > 0 ? crane.h * 0.6 : 6) - s.drop) * Math.min(1, dt * 0.25);
    if (g.current) g.current.rotation.y = s.yaw;
    if (hook.current) {
      hook.current.position.y = -s.drop;
      hook.current.children[0].scale.y = s.drop;
      hook.current.children[0].position.y = s.drop / 2;
    }
    beacon.opacity = (Math.floor(performance.now() / 700) % 2 ? 1 : 0.2) * Math.max(0.15, 1 - rt.dayLight);
  });
  return (
    <group position={[crane.x, crane.h, crane.z]}>
      <group ref={g}>
        <mesh geometry={geo} material={M.vc} castShadow />
        <points geometry={beaconGeo} material={beacon} frustumCulled={false} />
        <group position={[0, 0.8, crane.jib * 0.7]}>
          <group ref={hook}>
            <mesh>
              <boxGeometry args={[0.04, 1, 0.04]} />
              <meshBasicMaterial color="#2a2a2a" />
            </mesh>
            <mesh position={[0, -0.25, 0]}>
              <boxGeometry args={[0.35, 0.5, 0.25]} />
              <meshLambertMaterial color="#e0b02a" />
            </mesh>
            {/* A bundle of steel beams on the hook */}
            <mesh position={[0, -1.0, 0]} castShadow>
              <boxGeometry args={[0.5, 0.35, 3.6]} />
              <meshLambertMaterial color="#6a5a4a" />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

const WORKER = { ...DEFAULT_AVATAR, shirt: '#f2a72e', pants: '#2b3346', shoes: '#3a2a1e', hat: 'cap-red', top: 'vest' };

function Worker({ x, z, rot, i }: { x: number; z: number; rot: number; i: number }) {
  const anim = useRef<AnimState>({ speed: 0, grounded: true, busy: i % 2 === 0 });
  // Every third crew member is a woman, ponytail under the cap
  const look = useMemo(() => ({ ...WORKER, skin: ['#e8b48f', '#a96e48', '#f2c39c', '#7d4f33'][i % 4], ...(i % 3 === 1 ? { body: 'female' as const, hairStyle: 8 } : {}) }), [i]);
  return (
    <group position={[x, 0.14, z]} rotation={[0, rot, 0]}>
      <LitePerson config={look} anim={anim} />
    </group>
  );
}

export function Sites({ sites }: { sites: Site[] }) {
  return (
    <>
      {sites.map((s, i) => (
        <group key={i}>
          <Crane crane={s.crane} seed={i} />
          {s.crew.map((c, k) => (
            <Worker key={k} {...c} i={i * 3 + k} />
          ))}
        </group>
      ))}
    </>
  );
}

/* ───────── Steam from the streets (New York) ───────── */

let steamTex: THREE.CanvasTexture | null = null;
function steamTexture() {
  if (steamTex) return steamTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grd.addColorStop(0, 'rgba(255,255,255,0.75)');
  grd.addColorStop(0.5, 'rgba(240,242,245,0.35)');
  grd.addColorStop(1, 'rgba(230,232,236,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  steamTex = new THREE.CanvasTexture(c);
  return steamTex;
}

const PUFFS = 14;

export function Steam({ vents }: { vents: { x: number; z: number; stack: boolean }[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: steamTexture(), transparent: true, depthWrite: false, opacity: 0.55 }), []);
  const puffs = useMemo(() => vents.flatMap((v, vi) => Array.from({ length: PUFFS }, (_, i) => ({ v, t: (i / PUFFS) + vi * 0.13, seed: Math.random() * 10 }))), [vents]);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const scl = useMemo(() => new THREE.Vector3(), []);
  const m4 = useMemo(() => new THREE.Matrix4(), []);
  useFrame(({ camera }, rawDt) => {
    const dt = isPaused() ? 0 : Math.min(rawDt, 0.05);
    const mesh = ref.current;
    if (!mesh) return;
    q.copy(camera.quaternion);
    puffs.forEach((p, i) => {
      p.t = (p.t + dt * 0.22) % 1;
      const base = p.v.stack ? 3.1 : 0.1;
      const k = p.t;
      // Rise, spread and drift downwind
      pos.set(p.v.x + Math.sin(p.seed + k * 3) * 0.4 + k * 1.6, base + k * (p.v.stack ? 6 : 4.5), p.v.z + Math.cos(p.seed + k * 2) * 0.4);
      const size = (p.v.stack ? 1.2 : 1.6) + k * 3.2;
      scl.set(size, size, size);
      m4.compose(pos, q, scl);
      mesh.setMatrixAt(i, m4);
    });
    mesh.instanceMatrix.needsUpdate = true;
    // Steam shows best on cold, damp days and under street lights at night
    mat.opacity = 0.32 + (rt.weather === 'snow' || rt.weather === 'rain' ? 0.18 : 0) + (1 - rt.dayLight) * 0.1;
  });
  if (!vents.length) return null;
  return <instancedMesh ref={ref} args={[geo, mat, puffs.length]} frustumCulled={false} renderOrder={3} />;
}

/* ───────── Pigeons ───────── */

const pigeonGeo = (() => {
  const b = new VoxelBuilder();
  b.box(0, 0.12, 0, 0.13, 0.12, 0.26, '#8a8f98');
  b.box(0, 0.22, 0.12, 0.1, 0.1, 0.1, '#5a6070');
  b.box(0, 0.2, 0.18, 0.03, 0.03, 0.05, '#c9a24a');
  b.box(0, 0.16, 0.06, 0.12, 0.05, 0.06, '#4a8a7a');
  b.box(0, 0.12, -0.17, 0.1, 0.03, 0.12, '#4a4f58');
  for (const x of [-0.07, 0.07]) b.box(x, 0.13, -0.02, 0.03, 0.08, 0.18, '#6a707a');
  b.geom(cylinder(0.012, 0.012, 0.08, 4), trs(0.03, 0.04, 0), '#c9605a');
  b.geom(cylinder(0.012, 0.012, 0.08, 4), trs(-0.03, 0.04, 0), '#c9605a');
  return b.build();
})();
const wingGeo = new THREE.BoxGeometry(0.34, 0.02, 0.16);

interface Pigeon {
  hx: number;
  hz: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  vx: number;
  vy: number;
  vz: number;
  peck: number;
  flying: number; // seconds left in the air (0 = on the ground)
}

/** Flocks of pigeons pecking around plazas and pavements. Walk into them and they take off. */
export function Pigeons({ spots, seed }: { spots: [number, number][]; seed: number }) {
  const body = useRef<THREE.InstancedMesh>(null);
  const wings = useRef<THREE.InstancedMesh>(null);
  const birds = useMemo<Pigeon[]>(() => {
    const rng = makeRng(seed * 7 + 1);
    const out: Pigeon[] = [];
    for (const [cx, cz] of spots) {
      const n = rng.int(5, 9);
      for (let i = 0; i < n; i++) {
        const x = cx + rng.range(-1.8, 1.8);
        const z = cz + rng.range(-1.8, 1.8);
        out.push({ hx: x, hz: z, x, y: 0.16, z, yaw: rng.range(0, 6.28), vx: 0, vy: 0, vz: 0, peck: rng.range(0, 6), flying: 0 });
      }
    }
    return out;
  }, [spots, seed]);
  useFrame((state, rawDt) => {
    const dt = isPaused() ? 0 : Math.min(rawDt, 0.05);
    const bm = body.current;
    const wm = wings.current;
    if (!bm || !wm) return;
    const t = state.clock.elapsedTime;
    const px = rt.player.x;
    const pz = rt.player.z;
    birds.forEach((p, i) => {
      if (p.flying <= 0) {
        const d = Math.hypot(p.x - px, p.z - pz);
        if (d < 2.6) {
          // Take off away from the player
          const ax = (p.x - px) / (d || 1);
          const az = (p.z - pz) / (d || 1);
          p.vx = ax * 4 + (Math.random() - 0.5) * 2;
          p.vz = az * 4 + (Math.random() - 0.5) * 2;
          p.vy = 3.5 + Math.random() * 1.5;
          p.flying = 5 + Math.random() * 4;
          p.yaw = Math.atan2(p.vx, p.vz);
        } else {
          // Strut about and peck
          p.peck += dt;
          if (Math.sin(p.peck * 0.7 + i) > 0.92) {
            p.yaw += (Math.random() - 0.5) * 0.3;
            p.x += Math.sin(p.yaw) * dt * 0.5;
            p.z += Math.cos(p.yaw) * dt * 0.5;
          }
        }
      } else {
        p.flying -= dt;
        const returning = p.flying < 3;
        if (returning) {
          // Glide back home and land
          const dx = p.hx - p.x;
          const dz = p.hz - p.z;
          p.vx += (dx * 0.8 - p.vx) * dt * 1.5;
          p.vz += (dz * 0.8 - p.vz) * dt * 1.5;
          p.vy += ((0.16 - p.y) * 1.2 - p.vy) * dt * 2;
          p.yaw = Math.atan2(p.vx, p.vz);
        } else p.vy -= dt * 0.8;
        p.x += p.vx * dt;
        p.y = Math.max(0.16, p.y + p.vy * dt);
        p.z += p.vz * dt;
        if (p.flying <= 0) {
          p.y = 0.16;
          p.x = p.hx + (Math.random() - 0.5);
          p.z = p.hz + (Math.random() - 0.5);
        }
      }
      const peckTilt = p.flying > 0 ? 0 : Math.max(0, Math.sin(p.peck * 5 + i * 1.7)) * 0.5;
      bm.setMatrixAt(i, trs(p.x, p.y - 0.16, p.z, peckTilt, p.yaw, 0));
      const flap = p.flying > 0 ? Math.sin(t * 22 + i) * 0.9 : 0;
      wm.setMatrixAt(i, trs(p.x, p.y - 0.02, p.z, 0, p.yaw, flap, p.flying > 0 ? 1.5 : 0.001, 1, 1));
    });
    bm.instanceMatrix.needsUpdate = true;
    wm.instanceMatrix.needsUpdate = true;
  });
  if (!birds.length) return null;
  return (
    <>
      <instancedMesh ref={body} args={[pigeonGeo, M.vc, birds.length]} frustumCulled={false} />
      <instancedMesh ref={wings} args={[wingGeo, wingMat, birds.length]} frustumCulled={false} />
    </>
  );
}
const wingMat = new THREE.MeshLambertMaterial({ color: '#7a808a' });

/* ───────── Flags ───────── */

const flagTexCache = new Map<string, THREE.CanvasTexture>();
function flagTexture(c1: string, c2: string) {
  const key = c1 + c2;
  let t = flagTexCache.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = 48;
  c.height = 30;
  const g = c.getContext('2d')!;
  g.fillStyle = c1;
  g.fillRect(0, 0, 48, 30);
  // Pale band near the hoist and a simple emblem: a civic flag, not any real nation's
  g.fillStyle = c2;
  g.fillRect(0, 0, 14, 30);
  g.beginPath();
  g.arc(31, 15, 6, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = c1;
  g.beginPath();
  g.arc(31, 15, 3.5, 0, Math.PI * 2);
  g.fill();
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  flagTexCache.set(key, t);
  return t;
}

const flagUniforms = { uFlagTime: { value: 0 }, uFlagWind: { value: 1 } };
function flagMaterial(c1: string, c2: string) {
  const m = new THREE.MeshLambertMaterial({ map: flagTexture(c1, c2), side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, flagUniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uFlagTime;\nuniform float uFlagWind;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
float fx = uv.x;
transformed.z += sin(uFlagTime * 5.0 * (0.7 + 0.3 * uFlagWind) - fx * 7.0) * 0.16 * fx * uFlagWind;
transformed.y -= fx * fx * 0.12 / uFlagWind;`,
      );
  };
  m.customProgramCacheKey = () => 'fc-flag';
  return m;
}

export function Flags({ flags }: { flags: { x: number; y: number; z: number; rotY: number; w: number; h: number; c1: string; c2: string }[] }) {
  const geos = useMemo(() => flags.map((f) => new THREE.PlaneGeometry(f.w, f.h, 10, 2).translate(f.w / 2, -f.h / 2, 0)), [flags]);
  const mats = useMemo(() => flags.map((f) => flagMaterial(f.c1, f.c2)), [flags]);
  useFrame(() => {
    flagUniforms.uFlagTime.value = performance.now() / 1000;
    flagUniforms.uFlagWind.value = 1 + (rt.weather === 'rain' || rt.weather === 'snow' ? rt.weatherAmt : 0);
  });
  return (
    <>
      {flags.map((f, i) => (
        <mesh key={i} geometry={geos[i]} material={mats[i]} position={[f.x, f.y, f.z]} rotation={[0, f.rotY, 0]} castShadow />
      ))}
    </>
  );
}
