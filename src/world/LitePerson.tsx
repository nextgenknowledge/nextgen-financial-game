'use client';
/**
 * A cheap stand-in for a full Avatar: the same proportions, colours and animation, but the body is
 * merged into five meshes (body and head, two arms, two legs) that share one material. A full
 * Avatar costs ~37 draw calls; this costs 5. Used for background people (site crews, delivery
 * drivers) and for anyone indoors who isn't close to the camera.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VoxelBuilder } from '@/engine/voxel';
import type { AvatarConfig } from '@/game/types';
import type { AnimState } from './Avatar';
import outfits from '@/data/shop/outfits.json';
import { armX, bodyScale } from '@/game/look';

type Item = { id: string; style: string; color?: string; color2?: string };
const ITEMS = new Map<string, Item>((outfits.items as Item[]).map((i) => [i.id, i]));
const item = (id?: string | null) => (id ? ITEMS.get(id) : undefined);
const SUITS = new Set(['suit', 'threepiece', 'tux', 'blazer', 'skirtsuit']);
const SHORT = new Set(['tee', 'polo', 'jersey', 'dress']);

const material = new THREE.MeshLambertMaterial({ vertexColors: true });

function shade(hex: string, f: number) {
  return '#' + new THREE.Color(hex).multiplyScalar(f).getHexString();
}

interface Parts {
  body: THREE.BufferGeometry;
  arm: THREE.BufferGeometry;
  leg: THREE.BufferGeometry;
  shoulder: number;
  hip: number;
  height: number;
}

const cache = new Map<string, Parts>();

function partsFor(c: AvatarConfig): Parts {
  const key = [c.skin, c.hair, c.hairStyle, c.shirt, c.pants, c.shoes, c.top, c.bottom, c.feet, c.hat, c.body, c.build].join('|');
  const hit = cache.get(key);
  if (hit) return hit;
  const top = item(c.top);
  const dress = top?.style === 'dress' || top?.style === 'gown';
  const bottom = dress ? undefined : item(c.bottom);
  const fit = bodyScale(c);
  const feet = item(c.feet);
  const hat = item(c.hat);
  const shirt = top?.color ?? c.shirt;
  const suit = !!top && SUITS.has(top.style);
  const pants = dress ? shirt : bottom?.color ?? (suit && top?.style !== 'blazer' ? shirt : c.pants);
  // How far a skirt or dress reaches down the 0.76 leg, and the colour showing below it
  const skirtStyle = top?.style === 'gown' ? 'gown' : dress || (!bottom && top?.style === 'skirtsuit') ? 'pencil' : bottom?.style;
  const skirt = skirtStyle === 'gown' ? 0.76 : skirtStyle === 'pencil' ? 0.54 : skirtStyle === 'skirt' ? 0.48 : 0;
  const below = skirtStyle === 'pencil' ? shade(c.skin, 0.62) : c.skin;
  const shoe = feet?.color ?? c.shoes;
  const sleeve = top?.style === 'qzvest' ? top.color2 ?? '#7f9cc9' : shirt;
  const short = !!top && SHORT.has(top.style);

  // Body: hips, torso (with shirt-and-tie for suits), neck, head with face, hair
  const b = new VoxelBuilder();
  const tw = fit.torso;
  b.box(0, 0.9, 0, 0.62 * tw, 0.16, 0.34 * fit.depth, pants);
  b.box(0, 1.23, 0, 0.66 * tw, 0.68, 0.38 * fit.depth, shirt);
  if (suit) {
    b.box(0, 1.38, 0.192, 0.16, 0.36, 0.01, '#f4f6fa');
    if (c.body !== 'female' && top?.style !== 'skirtsuit') b.box(0, 1.33, 0.2, 0.06, 0.3, 0.01, top?.color2 ?? '#8a1f2a');
  }
  b.box(0, 1.6, 0, 0.22, 0.14, 0.22, c.skin);
  const s = 0.82;
  const hy = 1.6;
  const H = (x: number, y: number, z: number, w: number, h: number, d: number, col: string) => b.box(x * s, hy + y * s, z * s, w * s, h * s, d * s, col);
  H(0, 0.31, 0, 0.62, 0.62, 0.6, c.skin);
  H(0.32, 0.3, 0, 0.06, 0.15, 0.11, shade(c.skin, 0.9));
  H(-0.32, 0.3, 0, 0.06, 0.15, 0.11, shade(c.skin, 0.9));
  for (const x of [0.14, -0.14]) {
    H(x, 0.35, 0.305, 0.14, 0.1, 0.02, '#ffffff');
    H(x - 0.01, 0.348, 0.315, 0.07, 0.09, 0.02, c.eyes ?? '#2b2b38');
    H(x, 0.45, 0.305, 0.16, 0.035, 0.03, shade(c.hair, 0.85));
  }
  H(0, 0.26, 0.32, 0.08, 0.13, 0.07, shade(c.skin, 0.9));
  H(0, 0.13, 0.305, 0.15, 0.035, 0.02, shade(c.skin, 0.72));
  // Hair: a cap over the top and back, longer at the back for some styles
  if (hat) {
    H(0, 0.68, 0, 0.66, 0.16, 0.64, hat.color ?? '#2a2f3d');
    if (hat.style === 'cap') H(0, 0.62, 0.36, 0.5, 0.05, 0.22, hat.color ?? '#2a2f3d');
  } else {
    H(0, 0.66, -0.02, 0.66, 0.14, 0.64, c.hair);
  }
  const longBack = c.hairStyle === 1 || c.hairStyle === 10;
  H(0, longBack ? 0.31 : 0.45, -0.31, 0.64, longBack ? 0.62 : c.hairStyle === 9 ? 0.5 : 0.4, 0.06, c.hair);
  for (const x of [0.32, -0.32]) H(x, c.hairStyle === 9 ? 0.42 : 0.52, -0.08, 0.04, c.hairStyle === 9 ? 0.4 : 0.24, 0.46, c.hair);
  if (c.hairStyle === 8) H(0, 0.22, -0.4, 0.2, 0.5, 0.14, c.hair);
  if (c.hairStyle === 10) for (const x of [0.2, -0.2]) H(x, -0.04, -0.3, 0.12, 0.48, 0.12, c.hair);
  const body = b.build();

  // Arm (pivot at the shoulder): sleeve, then skin below short sleeves, hand
  const a = new VoxelBuilder();
  const aw = fit.limb;
  if (short) {
    a.box(0, -0.13, 0, 0.23 * aw, 0.26, 0.26 * aw, sleeve);
    a.box(0, -0.44, 0, 0.18 * aw, 0.37, 0.2 * aw, c.skin);
  } else a.box(0, -0.29, 0, 0.21 * aw, 0.62, 0.24 * aw, sleeve);
  a.box(0, -0.66, 0, 0.2 * aw, 0.17, 0.22 * aw, c.skin);
  const arm = a.build();

  // Leg (pivot at the hip): trouser leg and shoe
  const l = new VoxelBuilder();
  const lw = fit.limb;
  if (skirt) {
    l.box(0, -skirt / 2, 0, 0.33, skirt, 0.34, pants);
    if (skirt < 0.76) l.box(0, -(0.76 + skirt) / 2, 0, 0.22 * lw, 0.76 - skirt, 0.24 * lw, below);
  } else l.box(0, -0.38, 0, 0.28 * lw, 0.76, 0.3 * lw, pants);
  l.box(0, -0.83, 0.04, 0.3 * lw, 0.15, 0.4, shoe);
  l.box(0, -0.9, 0.04, 0.31 * lw, 0.03, 0.41, shade(shoe, 0.6));
  const leg = l.build();

  const out = { body, arm, leg, shoulder: armX(tw, lw), hip: 0.16 * tw, height: fit.height };
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
    <group scale={parts.height}>
      <group ref={body}>
        <mesh geometry={parts.body} material={material} castShadow />
        <mesh ref={lLeg} geometry={parts.leg} material={material} position={[parts.hip, 0.9, 0]} castShadow />
        <mesh ref={rLeg} geometry={parts.leg} material={material} position={[-parts.hip, 0.9, 0]} castShadow />
        <mesh ref={lArm} geometry={parts.arm} material={material} position={[parts.shoulder, 1.52, 0]} />
        <mesh ref={rArm} geometry={parts.arm} material={material} position={[-parts.shoulder, 1.52, 0]} />
      </group>
    </group>
  );
}
