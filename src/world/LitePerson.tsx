'use client';
/**
 * A cheap stand-in for a full Avatar: the same proportions, colours and animation, but the body is
 * merged into five meshes (body and head, two arms, two legs) that share one material. A full
 * Avatar costs about 17 draw calls; this costs 5. Used for background people (site crews, delivery
 * drivers) and for anyone indoors who isn't close to the camera.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VoxelBuilder } from '@/engine/voxel';
import type { AvatarConfig } from '@/game/types';
import type { AnimState } from './Avatar';
import outfits from '@/data/shop/outfits.json';

type Item = { id: string; style: string; color?: string; color2?: string };
const ITEMS = new Map<string, Item>((outfits.items as Item[]).map((i) => [i.id, i]));
const item = (id?: string | null) => (id ? ITEMS.get(id) : undefined);
const SUITS = new Set(['suit', 'threepiece', 'tux', 'blazer']);
const SHORT = new Set(['tee', 'polo', 'jersey']);
const TUCKED = new Set(['polo', 'turtleneck', 'cardigan', 'vest', 'suit', 'threepiece', 'tux', 'blazer']);

const material = new THREE.MeshLambertMaterial({ vertexColors: true });

function shade(hex: string, f: number) {
  return '#' + new THREE.Color(hex).multiplyScalar(f).getHexString();
}

interface Parts {
  body: THREE.BufferGeometry;
  arm: THREE.BufferGeometry;
  leg: THREE.BufferGeometry;
}

const cache = new Map<string, Parts>();

function partsFor(c: AvatarConfig): Parts {
  const key = [c.skin, c.hair, c.hairStyle, c.eyes, c.shirt, c.pants, c.shoes, c.top, c.bottom, c.feet, c.hat].join('|');
  const hit = cache.get(key);
  if (hit) return hit;
  const top = item(c.top);
  const bottom = item(c.bottom);
  const feet = item(c.feet);
  const hat = item(c.hat);
  const shirt = top?.color ?? c.shirt;
  const suit = !!top && SUITS.has(top.style);
  const pants = bottom?.color ?? (suit && top?.style !== 'blazer' ? shirt : c.pants);
  const shoe = feet?.color ?? c.shoes;
  const sleeve = top?.style === 'qzvest' ? top.color2 ?? '#7f9cc9' : shirt;
  const short = !!top && SHORT.has(top.style);

  // Body: hips, belt, tapered torso with shoulders (shirt-and-tie for suits), neck, head with face, hair.
  // Same proportions as the full Avatar so people don't change shape as you walk up to them.
  const b = new VoxelBuilder();
  b.box(0, 0.88, 0, 0.6, 0.16, 0.33, pants);
  if (!top || TUCKED.has(top.style)) {
    b.box(0, 0.95, 0, 0.6, 0.06, 0.35, '#2a1f18');
    b.box(0, 0.95, 0.177, 0.07, 0.05, 0.02, '#c9a24a');
  }
  b.box(0, 1.11, 0, 0.58, 0.3, 0.34, shirt);
  b.box(0, 1.36, 0, 0.68, 0.38, 0.38, shirt);
  for (const x of [0.31, -0.31]) b.box(x, 1.47, 0, 0.16, 0.14, 0.34, shirt);
  if (suit) {
    b.box(0, 1.4, 0.192, 0.16, 0.3, 0.01, '#f4f6fa');
    b.box(0, 1.35, 0.2, 0.06, 0.26, 0.01, top?.color2 ?? '#8a1f2a');
  }
  // Head in its own frame (origin at the top of the neck), as in Avatar
  const hy = 1.62;
  const H = (x: number, y: number, z: number, w: number, h: number, d: number, col: string) => b.box(x, hy + y, z, w, h, d, col);
  const line = shade(c.skin, 0.55);
  H(0, -0.04, -0.01, 0.16, 0.16, 0.16, c.skin);
  H(0, 0.29, 0, 0.42, 0.38, 0.44, c.skin);
  H(0, 0.14, 0.01, 0.39, 0.24, 0.4, c.skin);
  H(0, 0.05, 0.15, 0.2, 0.06, 0.08, c.skin);
  for (const x of [0.215, -0.215]) H(x, 0.25, -0.01, 0.04, 0.11, 0.09, shade(c.skin, 0.86));
  for (const x of [0.085, -0.085]) {
    H(x, 0.27, 0.215, 0.09, 0.05, 0.02, '#f6f3ee');
    H(x, 0.27, 0.222, 0.045, 0.05, 0.02, c.eyes ?? '#2b2b38');
    H(x, 0.297, 0.214, 0.1, 0.016, 0.03, line);
    H(x, 0.336, 0.213, 0.1, 0.022, 0.03, shade(c.hair, 0.85));
  }
  H(0, 0.2, 0.235, 0.05, 0.13, 0.06, c.skin);
  H(0, 0.106, 0.201, 0.1, 0.02, 0.02, shade(c.skin, 0.74));
  H(0, 0.084, 0.199, 0.08, 0.024, 0.02, shade(c.skin, 0.74));
  // Hair: a cap over the top and back, longer at the back for some styles
  if (hat) {
    H(0, 0.5, 0, 0.46, 0.12, 0.47, hat.color ?? '#2a2f3d');
    if (hat.style === 'cap') H(0, 0.46, 0.27, 0.34, 0.04, 0.16, hat.color ?? '#2a2f3d');
  } else {
    H(0, 0.5, -0.01, 0.45, 0.1, 0.47, c.hair);
  }
  H(0, 0.35, -0.225, 0.44, c.hairStyle === 1 ? 0.46 : 0.3, 0.05, c.hair);
  for (const x of [0.218, -0.218]) H(x, 0.4, -0.06, 0.03, 0.18, 0.33, c.hair);
  const body = b.build();

  // Arm (pivot at the shoulder): upper sleeve and forearm, or short sleeve and bare arm; a hand with fingers
  const a = new VoxelBuilder();
  if (short) {
    a.box(0, -0.12, 0, 0.21, 0.24, 0.24, sleeve);
    a.box(0, -0.42, 0, 0.16, 0.36, 0.18, c.skin);
  } else {
    a.box(0, -0.165, 0, 0.19, 0.35, 0.22, sleeve);
    a.box(0, -0.47, 0.005, 0.17, 0.29, 0.2, sleeve);
  }
  a.box(0, -0.69, 0, 0.09, 0.14, 0.16, c.skin);
  a.box(0, -0.8, 0.01, 0.075, 0.12, 0.145, c.skin);
  a.box(0, -0.66, 0.1, 0.055, 0.1, 0.05, c.skin);
  const arm = a.build();

  // Leg (pivot at the hip): thigh, shin and shoe, the same lengths as the Avatar's (which scales legs by 1.15)
  const l = new VoxelBuilder();
  if (bottom?.style === 'shorts') {
    l.box(0, -0.18, 0, 0.3, 0.37, 0.32, pants);
    l.box(0, -0.53, 0.005, 0.19, 0.38, 0.21, c.skin);
  } else {
    l.box(0, -0.22, 0, 0.3, 0.44, 0.32, pants);
    l.box(0, -0.56, 0.005, 0.26, 0.38, 0.28, pants);
  }
  l.box(0, -0.83, 0.04, 0.3, 0.15, 0.4, shoe);
  l.box(0, -0.9, 0.04, 0.31, 0.03, 0.41, shade(shoe, 0.6));
  const leg = l.build();

  const out = { body, arm, leg };
  cache.set(key, out);
  return out;
}

export function LitePerson({ config, anim }: { config: AvatarConfig; anim?: React.RefObject<AnimState> }) {
  const parts = useMemo(() => partsFor(config), [config]);
  const lLeg = useRef<THREE.Mesh>(null);
  const rLeg = useRef<THREE.Mesh>(null);
  const lArm = useRef<THREE.Mesh>(null);
  const rArm = useRef<THREE.Mesh>(null);
  const body = useRef<THREE.Group>(null);
  const phase = useRef(Math.random() * 10);
  useFrame((_, dt) => {
    const a = anim?.current;
    const speed = a?.speed ?? 0;
    phase.current += dt * (4 + speed * 7);
    const p = phase.current;
    const swing = Math.sin(p) * Math.min(1, speed) * 0.85;
    if (!lLeg.current || !rLeg.current || !lArm.current || !rArm.current || !body.current) return;
    lLeg.current.rotation.x = a?.sitting ? -1.45 : swing;
    rLeg.current.rotation.x = a?.sitting ? -1.45 : -swing;
    if (a?.busy) {
      const k = Math.sin(p * 3.1) * 0.07;
      lArm.current.rotation.set(-1.05 + k, 0, 0.12);
      rArm.current.rotation.set(-1.05 - k, 0, -0.12);
    } else {
      lArm.current.rotation.set(-swing * 0.9, 0, 0.04);
      rArm.current.rotation.set(swing * 0.9, 0, -0.04);
    }
    body.current.position.y = a?.sitting ? -0.42 : Math.abs(Math.sin(p)) * 0.05 * Math.min(1, speed);
  });
  return (
    <group ref={body} name="lite-person">
      <mesh geometry={parts.body} material={material} castShadow />
      <mesh ref={lLeg} geometry={parts.leg} material={material} position={[0.16, 0.9, 0]} castShadow />
      <mesh ref={rLeg} geometry={parts.leg} material={material} position={[-0.16, 0.9, 0]} castShadow />
      <mesh ref={lArm} geometry={parts.arm} material={material} position={[0.44, 1.5, 0]} />
      <mesh ref={rArm} geometry={parts.arm} material={material} position={[-0.44, 1.5, 0]} />
    </group>
  );
}
