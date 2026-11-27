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
import { VoxelBuilder, trs } from '@/engine/voxel';
import { hairShellGeo, headGeo, limbGeo, torsoGeo } from './bodyShape';
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
  const female = c.body === 'female';
  b.geom(limbGeo(0.08, 0.17, 0.6, 0.33, 0.62, 0.34, { n: 3.2, capBottom: 0.04, seg: 12, rings: 2 }), trs(0, 0.9, 0, 0, 0, 0, tw, 1, fit.depth), pants);
  b.geom(torsoGeo(0.66, 0.68, 0.38, female, 1, 14), trs(0, 1.23, 0, 0, 0, 0, tw, 1, fit.depth), shirt);
  if (suit) {
    b.box(0, 1.38, 0.192, 0.16, 0.36, 0.01, '#f4f6fa');
    if (c.body !== 'female' && top?.style !== 'skirtsuit') b.box(0, 1.33, 0.2, 0.06, 0.3, 0.01, top?.color2 ?? '#8a1f2a');
  }
  b.geom(limbGeo(0.09, 0.18, 0.2, 0.2, 0.22, 0.22, { n: 2.6, seg: 10, rings: 1 }), trs(0, 1.6, 0), c.skin);
  const s = 0.82;
  const hy = 1.6;
  const H = (x: number, y: number, z: number, w: number, h: number, d: number, col: string) => b.box(x * s, hy + y * s, z * s, w * s, h * s, d * s, col);
  b.geom(headGeo(0.62, 0.6, 14), trs(0, hy, 0, 0, 0, 0, s, s, s), c.skin);
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
  // Hair hugs the head (same shell as the full Avatar); a hat sits over the crown instead
  const longBack = c.hairStyle === 1 || c.hairStyle === 10;
  const HS = trs(0, hy, 0, 0, 0, 0, s, s, s);
  const line: [number, number, number, number, number] =
    c.hairStyle === 9 ? [0.49, 0.16, 0.14, 1.1, 0.06] : c.hairStyle === 3 || c.hairStyle === 7 ? [0.53, 0.47, 0.4, 1.03, 0.01] : c.hairStyle === 2 ? [0.5, 0.36, 0.26, 1.16, 0.1] : longBack || c.hairStyle === 8 ? [0.5, 0.3, 0.12, 1.07, 0.06] : [0.5, 0.44, 0.3, 1.07, 0.06];
  b.geom(hairShellGeo(line[0], line[1], line[2], line[3], line[4], 16), HS, c.hair);
  if (hat) {
    H(0, 0.68, 0, 0.66, 0.16, 0.64, hat.color ?? '#2a2f3d');
    if (hat.style === 'cap') H(0, 0.62, 0.36, 0.5, 0.05, 0.22, hat.color ?? '#2a2f3d');
  }
  if (longBack) H(0, 0.16, -0.28, 0.62, 0.5, 0.1, c.hair);
  if (c.hairStyle === 8) H(0, 0.22, -0.4, 0.2, 0.5, 0.14, c.hair);
  if (c.hairStyle === 10) for (const x of [0.2, -0.2]) H(x, -0.04, -0.3, 0.12, 0.48, 0.12, c.hair);
  const body = b.build();

  // Arm (pivot at the shoulder): sleeve, then skin below short sleeves, hand
  const a = new VoxelBuilder();
  const aw = fit.limb;
  // Same shapes as the full Avatar's arm (which is scaled 1.1 tall), with fewer points around
  const A = trs(0, 0, 0, 0, 0, 0, aw, 1.1, aw);
  if (short) {
    a.geom(limbGeo(0.04, 0.27, 0.24, 0.26, 0.25, 0.27, { capTop: 0.07, flare: 0.12, seg: 10, rings: 3 }), A, sleeve);
    a.geom(limbGeo(-0.2, 0.37, 0.18, 0.2, 0.15, 0.17, { seg: 10, rings: 3 }), A, c.skin);
  } else a.geom(limbGeo(0.04, 0.59, 0.23, 0.25, 0.19, 0.21, { capTop: 0.07, flare: 0.06, seg: 10, rings: 5, sweep: 0.02 }), A, sleeve);
  a.geom(limbGeo(-0.53, 0.17, 0.19, 0.2, 0.17, 0.19, { capBottom: 0.05, seg: 10, rings: 2 }), A, c.skin);
  const arm = a.build();

  // Leg (pivot at the hip): trouser leg and shoe
  const l = new VoxelBuilder();
  const lw = fit.limb;
  // The full Avatar's leg shapes are 1.15 tall in leg space, so divide back out
  const L = trs(0, 0, 0, 0, 0, 0, lw, 1.15, lw);
  if (skirt) {
    const len = skirt / 1.15;
    l.geom(limbGeo(0.02, len + 0.02, 0.3, 0.33, 0.35, 0.37, { n: 3, seg: 12, rings: 3 }), trs(0, 0, 0, 0, 0, 0, 1, 1.15, 1), pants);
    if (skirt < 0.76) l.geom(limbGeo(-len + 0.04, 0.7 - len, 0.2, 0.22, 0.16, 0.18, { seg: 10, rings: 3 }), L, below);
  } else l.geom(limbGeo(0.03, 0.7, 0.3, 0.32, 0.24, 0.26, { capTop: 0.04, flare: 0.07, seg: 10, rings: 6 }), L, pants);
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
