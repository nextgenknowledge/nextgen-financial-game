'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import type { Mood } from '@/game/effects';
import { NARWHAL_COLORS as C, drawNarwhalFace } from './narwhalFace';
import { mat, rbox } from './Avatar';
import { aheadOnPath } from '@/engine/nav';
import { rt } from '@/engine/runtime';
import { useUI } from '@/store/ui';
import { useSettings } from '@/store/settings';
import { EMBLEM } from '@/ui/common';

const faceTextures = new Map<Mood, THREE.CanvasTexture>();
export function faceTexture(mood: Mood): THREE.CanvasTexture {
  let t = faceTextures.get(mood);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    drawNarwhalFace(g, 256, mood);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    faceTextures.set(mood, t);
  }
  return t;
}

const hornGeo = (() => {
  // Cream horn with a gold spiral stripe
  const g = new THREE.CylinderGeometry(0.02, 0.12, 1.0, 12);
  g.translate(0, 0.5, 0);
  return g;
})();

/** One bean-shaped body with the darker top blended in via vertex colors (no "cap" seam). */
const bodyGeo = (() => {
  const g = rbox(1.0, 1.6, 0.86, 0.36).clone();
  const pos = g.getAttribute('position');
  const light = new THREE.Color(C.body);
  const dark = new THREE.Color(C.top);
  const c = new THREE.Color();
  const cols: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i); // -0.8 .. 0.8
    const t = THREE.MathUtils.smoothstep(y, 0.42, 0.56);
    c.copy(light).lerp(dark, t);
    cols.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  return g;
})();
const bodyMat = new THREE.MeshLambertMaterial({ vertexColors: true });

/**
 * Blocky NextGen Narwhal: bean-shaped light-blue body with a darker top and spots, big expressive
 * eyes, cream spiral horn, navy suit with white shirt, teal tie, and the NextGen emblem pin.
 */
export function NarwhalModel({ mood = 'confident', flap = true, talking = false }: { mood?: Mood; flap?: boolean; talking?: boolean }) {
  const lFin = useRef<THREE.Group>(null);
  const rFin = useRef<THREE.Group>(null);
  const emblem = useLoader(THREE.TextureLoader, EMBLEM);
  useEffect(() => {
    emblem.colorSpace = THREE.SRGBColorSpace;
  }, [emblem]);
  const faceLit = useMemo(() => new THREE.MeshLambertMaterial({ map: faceTexture('confident'), transparent: true, alphaTest: 0.05 }), []);
  useEffect(() => () => faceLit.dispose(), [faceLit]);
  const stripes = useMemo(() => Array.from({ length: 5 }, (_, i) => i), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // Mouth flaps while talking by swapping face textures
    const want = talking && Math.floor(t * 6) % 2 === 0 ? faceTexture('talking') : faceTexture(mood);
    if (faceLit.map !== want) {
      faceLit.map = want;
      faceLit.needsUpdate = true;
    }
    if (!flap) return;
    if (lFin.current) lFin.current.rotation.z = 0.25 + Math.sin(t * 3) * 0.12;
    if (rFin.current) rFin.current.rotation.z = -0.25 - Math.sin(t * 3 + 0.5) * 0.12;
  });

  return (
    <group>
      {/* Body (bean) with darker top */}
      <mesh geometry={bodyGeo} material={bodyMat} position={[0, 0.95, 0]} castShadow />
      {/* Spots on the top */}
      {[[-0.12, 0.1], [0.14, -0.08], [0.02, 0.22], [-0.05, -0.2]].map(([x, z], i) => (
        <mesh key={i} position={[x, 1.752, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.045, 8]} />
          <meshLambertMaterial color={C.spot} />
        </mesh>
      ))}
      {/* Face (eyes, brows, mouth, shine and front spots are painted on) */}
      <mesh position={[0, 1.2, 0.432]} material={faceLit}>
        <planeGeometry args={[0.86, 0.86]} />
      </mesh>
      {/* Suit */}
      <mesh geometry={rbox(1.07, 0.78, 0.93, 0.2)} material={mat(C.suit)} position={[0, 0.52, 0]} castShadow />
      {/* Shirt V + tie + lapels */}
      <mesh geometry={rbox(0.32, 0.36, 0.03, 0.01)} material={mat(C.shirt)} position={[0, 0.76, 0.462]} />
      <mesh geometry={rbox(0.09, 0.42, 0.03, 0.01)} material={mat(C.tie)} position={[0, 0.7, 0.476]} />
      <mesh geometry={rbox(0.14, 0.05, 0.03, 0.01)} material={mat(C.tie)} position={[0, 0.9, 0.476]} />
      <mesh geometry={rbox(0.1, 0.42, 0.03, 0.01)} material={mat(C.lapel)} position={[0.19, 0.74, 0.468]} rotation={[0, 0, 0.35]} />
      <mesh geometry={rbox(0.1, 0.42, 0.03, 0.01)} material={mat(C.lapel)} position={[-0.19, 0.74, 0.468]} rotation={[0, 0, -0.35]} />
      {/* Buttons */}
      <mesh geometry={rbox(0.05, 0.05, 0.02, 0.01)} material={mat('#11182b')} position={[0, 0.42, 0.47]} />
      <mesh geometry={rbox(0.05, 0.05, 0.02, 0.01)} material={mat('#11182b')} position={[0, 0.28, 0.47]} />
      {/* NextGen emblem pin (crop of the provided logo) */}
      <mesh position={[-0.3, 0.68, 0.468]}>
        <planeGeometry args={[0.17, 0.15]} />
        <meshBasicMaterial map={emblem} toneMapped={false} />
      </mesh>
      {/* Arms / fins */}
      <group ref={lFin} position={[0.52, 0.78, 0.05]}>
        <mesh geometry={rbox(0.22, 0.5, 0.26, 0.09)} material={mat(C.suit)} position={[0.06, -0.2, 0]} />
        <mesh geometry={rbox(0.23, 0.05, 0.27, 0.02)} material={mat(C.shirt)} position={[0.06, -0.43, 0]} />
        <mesh geometry={rbox(0.2, 0.22, 0.22, 0.09)} material={mat(C.body)} position={[0.08, -0.55, 0]} />
      </group>
      <group ref={rFin} position={[-0.52, 0.78, 0.05]}>
        <mesh geometry={rbox(0.22, 0.5, 0.26, 0.09)} material={mat(C.suit)} position={[-0.06, -0.2, 0]} />
        <mesh geometry={rbox(0.23, 0.05, 0.27, 0.02)} material={mat(C.shirt)} position={[-0.06, -0.43, 0]} />
        <mesh geometry={rbox(0.2, 0.22, 0.22, 0.09)} material={mat(C.body)} position={[-0.08, -0.55, 0]} />
      </group>
      {/* Tail flukes */}
      <mesh geometry={rbox(0.55, 0.12, 0.45, 0.06)} material={mat(C.body)} position={[0.28, 0.08, 0.06]} rotation={[0, -0.35, 0]} />
      <mesh geometry={rbox(0.55, 0.12, 0.45, 0.06)} material={mat(C.body)} position={[-0.28, 0.08, 0.06]} rotation={[0, 0.35, 0]} />
      {/* Horn with gold spiral */}
      <group position={[0, 1.7, 0]} rotation={[0.04, 0, -0.04]}>
        <mesh geometry={hornGeo} material={mat(C.horn)} />
        {stripes.map((i) => (
          <mesh key={i} position={[0, 0.14 + i * 0.16, 0]} rotation={[Math.PI / 2 + 0.35, 0, 0.3]}>
            <torusGeometry args={[0.108 - i * 0.017, 0.014, 4, 12]} />
            <meshLambertMaterial color={C.hornStripe} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

const scratch = new THREE.Vector3();

/** Narwhal follows the player, leads toward the current goal, and faces you while talking. */
export function NarwhalGuide() {
  const g = useRef<THREE.Group>(null);
  const pos = useRef(new THREE.Vector3(rt.player.x + 2, 0, rt.player.z + 2));
  const line = useUI((s) => s.narwhal[0]);
  const hints = useSettings((s) => s.hints);
  const mood: Mood = line?.mood ?? 'confident';

  useFrame((state, dt) => {
    const group = g.current;
    if (!group) return;
    const p = rt.player;
    const target = scratch;
    const goal = hints ? rt.goal : null;
    if (goal && !line) {
      // Lead the way along the walking route (round buildings, to the door the beacon marks)
      const d = Math.hypot(goal.x - p.x, goal.z - p.z);
      const lead = Math.min(3.2, d * 0.5);
      const path = rt.guidePath;
      const [lx, lz] = path && path.length > 1 ? aheadOnPath(path, p.x, p.z, lead) : [p.x + ((goal.x - p.x) / (d || 1)) * lead, p.z + ((goal.z - p.z) / (d || 1)) * lead];
      target.set(lx, 0, lz);
    } else {
      // Hover beside the player's shoulder (right-hand side, slightly ahead when talking)
      const yaw = rt.playerRotY;
      const side = 1.6;
      const ahead = line ? 1.8 : -0.4;
      target.set(p.x + Math.cos(yaw) * -side + Math.sin(yaw) * ahead, 0, p.z - Math.sin(yaw) * -side + Math.cos(yaw) * ahead);
    }
    const cur = pos.current;
    const dist = cur.distanceTo(target);
    if (dist > 30) cur.copy(target);
    cur.lerp(target, Math.min(1, dt * (dist > 6 ? 4 : 2.2)));
    const t = state.clock.elapsedTime;
    const baseY = (rt.vehicle ? rt.vehicle.pos.y : p.y) + 0.55;
    group.position.set(cur.x, baseY + Math.sin(t * 2) * 0.12, cur.z);
    // Face the player while talking, otherwise the direction of travel
    let faceYaw: number;
    if (line || dist < 0.4) faceYaw = Math.atan2(p.x - cur.x, p.z - cur.z);
    else faceYaw = Math.atan2(target.x - cur.x, target.z - cur.z);
    let d = faceYaw - group.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    group.rotation.y += d * Math.min(1, dt * 5);
    group.rotation.z = Math.sin(t * 1.3) * 0.05;
  });

  return (
    <group ref={g} scale={0.8}>
      <NarwhalModel mood={line ? mood : 'confident'} talking={!!line} />
    </group>
  );
}

/** Goal beacon: a soft beam of light plus a bouncing arrow over the target. */
export function GoalBeacon() {
  const g = useRef<THREE.Group>(null);
  const arrow = useRef<THREE.Mesh>(null);
  const hints = useSettings((s) => s.hints);
  useFrame((state) => {
    const goal = rt.goal;
    if (!g.current) return;
    g.current.visible = !!goal && hints;
    if (!goal) return;
    g.current.position.set(goal.x, 0, goal.z);
    if (arrow.current) {
      arrow.current.position.y = 4.4 + Math.sin(state.clock.elapsedTime * 3) * 0.35;
      arrow.current.rotation.y = state.clock.elapsedTime * 1.5;
    }
  });
  return (
    <group ref={g}>
      {/* Bright core beam inside a wider glow, both visible from across the city */}
      <mesh position={[0, 15, 0]}>
        <cylinderGeometry args={[0.55, 0.75, 30, 12, 1, true]} />
        <meshBasicMaterial color="#fff2b0" transparent opacity={0.75} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh position={[0, 15, 0]}>
        <cylinderGeometry args={[1.3, 1.8, 30, 16, 1, true]} />
        <meshBasicMaterial color="#ffc21a" transparent opacity={0.38} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={arrow} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[1.0, 2.0, 4]} />
        <meshBasicMaterial color="#ffd23f" toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}>
        <ringGeometry args={[1.5, 2.3, 32]} />
        <meshBasicMaterial color="#ffd23f" transparent opacity={0.95} toneMapped={false} />
      </mesh>
    </group>
  );
}

const TRAIL_DOTS = 48;

/**
 * Glowing footpath of dots from the player to the goal, following the walking route. A brighter
 * pulse runs along it toward the goal so the direction is obvious at a glance.
 */
export function GuideTrail() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);
  const hints = useSettings((s) => s.hints);
  // Short dashes pointing along the route, each with a soft gold halo, so the trail reads on grass,
  // paving and snow
  const geo = useMemo(() => new THREE.PlaneGeometry(0.22, 0.62).rotateX(-Math.PI / 2), []);
  const glowGeo = useMemo(() => new THREE.PlaneGeometry(0.4, 0.8).rotateX(-Math.PI / 2), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffc81e', depthWrite: false, toneMapped: false }), []);
  const glowMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff9d00', transparent: true, opacity: 0.45, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }), []);
  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const size = useMemo(() => new THREE.Vector3(), []);
  useFrame((state) => {
    const mesh = ref.current;
    const glow = glowRef.current;
    if (!mesh || !glow) return;
    const path = rt.guidePath;
    const goal = rt.goal;
    const p = rt.player;
    if (!hints || !path || path.length < 2 || !goal || Math.hypot(goal.x - p.x, goal.z - p.z) < 3.5) {
      mesh.count = 0;
      glow.count = 0;
      return;
    }
    const t = state.clock.elapsedTime;
    let n = 0;
    for (let k = 0; k < TRAIL_DOTS; k++) {
      const dist = 1.4 + k * 1.25;
      const [x, z] = aheadOnPath(path, p.x, p.z, dist);
      // Face the dash along the route
      const [nx, nz] = aheadOnPath(path, p.x, p.z, dist + 0.3);
      const yaw = Math.atan2(nx - x, nz - z);
      if (Math.hypot(goal.x - x, goal.z - z) < 1.2) break;
      // Pulse travelling away from the player toward the goal
      const wave = Math.max(0, Math.cos((dist - ((t * 9) % 60)) * 0.35));
      const s = (0.85 + wave * 0.5) * (1 - (k / TRAIL_DOTS) * 0.35);
      m4.makeRotationY(yaw).scale(size.set(s, 1, s)).setPosition(x, 0.24, z);
      glow.setMatrixAt(n, m4);
      m4.setPosition(x, 0.26, z);
      mesh.setMatrixAt(n++, m4);
    }
    mesh.count = n;
    glow.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    glow.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={glowRef} args={[glowGeo, glowMat, TRAIL_DOTS]} frustumCulled={false} renderOrder={2} />
      <instancedMesh ref={ref} args={[geo, mat, TRAIL_DOTS]} frustumCulled={false} renderOrder={3} />
    </>
  );
}
