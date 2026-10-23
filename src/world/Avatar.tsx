'use client';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { AvatarConfig } from '@/game/types';
import outfits from '@/data/shop/outfits.json';
import { fabric } from '@/engine/pixtex';

export interface AnimState {
  speed: number; // 0..1+ (1 = run)
  grounded: boolean;
  wave?: number; // >0 while waving
  sitting?: boolean;
  /** Arms forward and busy (typing, cooking, browsing a shelf). */
  busy?: boolean;
}

const geoCache = new Map<string, THREE.BufferGeometry>();
export function rbox(w: number, h: number, d: number, r = 0.05): THREE.BufferGeometry {
  const key = `${w}|${h}|${d}|${r}`;
  let g = geoCache.get(key);
  if (!g) {
    g = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2));
    geoCache.set(key, g);
  }
  return g;
}

const matCache = new Map<string, THREE.MeshLambertMaterial>();
export function mat(color: string, emissive?: string): THREE.MeshLambertMaterial {
  const key = color + (emissive ?? '');
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, emissive: emissive ?? '#000000' });
    matCache.set(key, m);
  }
  return m;
}

type OutfitItem = { id: string; slot: string; style: string; color?: string; color2?: string; pattern?: string };
const OUTFIT_BY_ID = new Map<string, OutfitItem>((outfits.items as OutfitItem[]).map((i) => [i.id, i]));
const outfit = (id: string | null | undefined) => (id ? OUTFIT_BY_ID.get(id) : undefined);

function shade(hex: string, f: number) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return '#' + c.getHexString();
}

/** Gold / chrome items glow slightly so they read as metal under any light. */
const GLOW: Record<string, string> = { gold: '#4a3500', silver: '#202226' };
const glowFor = (it?: OutfitItem) => (it?.pattern === 'gold' ? GLOW.gold : undefined);

/** Fabric material for an outfit item (pixel texture), or a plain cotton fallback color. */
function cloth(it: OutfitItem | undefined, fallback: string, pattern = 'cotton') {
  if (!it) return fabric(pattern, fallback);
  return fabric(it.pattern ?? pattern, it.color ?? fallback, it.color2, glowFor(it));
}

const SUITS = new Set(['suit', 'threepiece', 'tux', 'blazer']);
const SHORT_SLEEVE = new Set(['tee', 'polo', 'jersey']);
function Hair({ style, color }: { style: number; color: string }) {
  const m = mat(color);
  switch (style) {
    case 1: // long
      return (
        <group>
          <mesh geometry={rbox(0.68, 0.18, 0.66, 0.06)} material={m} position={[0, 0.62, 0]} />
          <mesh geometry={rbox(0.68, 0.62, 0.16, 0.05)} material={m} position={[0, 0.3, -0.27]} />
          <mesh geometry={rbox(0.1, 0.5, 0.5, 0.04)} material={m} position={[0.33, 0.36, -0.04]} />
          <mesh geometry={rbox(0.1, 0.5, 0.5, 0.04)} material={m} position={[-0.33, 0.36, -0.04]} />
          <mesh geometry={rbox(0.66, 0.12, 0.14, 0.04)} material={m} position={[0, 0.54, 0.26]} />
        </group>
      );
    case 2: // curly / afro
      return (
        <group>
          <mesh geometry={rbox(0.82, 0.38, 0.8, 0.17)} material={m} position={[0, 0.66, -0.03]} />
          <mesh geometry={rbox(0.12, 0.36, 0.56, 0.06)} material={m} position={[0.35, 0.44, -0.06]} />
          <mesh geometry={rbox(0.12, 0.36, 0.56, 0.06)} material={m} position={[-0.35, 0.44, -0.06]} />
        </group>
      );
    case 3: // buzz
      return <mesh geometry={rbox(0.65, 0.1, 0.64, 0.04)} material={m} position={[0, 0.6, -0.01]} />;
    case 4: // bun
      return (
        <group>
          <mesh geometry={rbox(0.67, 0.16, 0.66, 0.06)} material={m} position={[0, 0.61, 0]} />
          <mesh geometry={rbox(0.67, 0.4, 0.14, 0.05)} material={m} position={[0, 0.42, -0.27]} />
          <mesh geometry={rbox(0.3, 0.26, 0.28, 0.1)} material={m} position={[0, 0.8, -0.14]} />
        </group>
      );
    case 5: // spiky
      return (
        <group>
          <mesh geometry={rbox(0.66, 0.14, 0.65, 0.05)} material={m} position={[0, 0.61, 0]} />
          {[-0.2, 0, 0.2].map((x, i) => (
            <mesh key={i} geometry={rbox(0.16, 0.22, 0.2, 0.04)} material={m} position={[x, 0.76, 0.1 - i * 0.04]} rotation={[0.3, 0, x]} />
          ))}
          <mesh geometry={rbox(0.66, 0.3, 0.14, 0.05)} material={m} position={[0, 0.46, -0.27]} />
        </group>
      );
    default: // short
      return (
        <group>
          <mesh geometry={rbox(0.67, 0.17, 0.66, 0.06)} material={m} position={[0, 0.61, 0]} />
          <mesh geometry={rbox(0.67, 0.3, 0.14, 0.05)} material={m} position={[0, 0.46, -0.27]} />
          <mesh geometry={rbox(0.5, 0.1, 0.12, 0.04)} material={m} position={[-0.06, 0.54, 0.27]} />
        </group>
      );
  }
}

function Hat({ id }: { id: string | null }) {
  const it = id ? OUTFIT_BY_ID.get(id) : undefined;
  if (!it) return null;
  const c = it.color ?? '#e1553f';
  const c2 = it.color2 ?? '#ffffff';
  switch (it.style) {
    case 'cap':
      return (
        <group position={[0, 0.66, 0]}>
          <mesh geometry={rbox(0.7, 0.18, 0.7, 0.07)} material={mat(c)} />
          <mesh geometry={rbox(0.6, 0.05, 0.3, 0.02)} material={mat(c2)} position={[0, -0.06, 0.45]} />
        </group>
      );
    case 'beanie':
      return (
        <group position={[0, 0.66, 0]}>
          <mesh geometry={rbox(0.7, 0.24, 0.7, 0.1)} material={mat(c)} />
          <mesh geometry={rbox(0.72, 0.08, 0.72, 0.03)} material={mat(c2)} position={[0, -0.1, 0]} />
          <mesh geometry={rbox(0.14, 0.14, 0.14, 0.06)} material={mat(c2)} position={[0, 0.18, 0]} />
        </group>
      );
    case 'tophat':
      return (
        <group position={[0, 0.66, 0]}>
          <mesh geometry={rbox(0.86, 0.05, 0.86, 0.02)} material={mat(c)} />
          <mesh geometry={rbox(0.54, 0.5, 0.54, 0.04)} material={mat(c)} position={[0, 0.27, 0]} />
          <mesh geometry={rbox(0.56, 0.08, 0.56, 0.02)} material={mat(c2)} position={[0, 0.07, 0]} />
        </group>
      );
    case 'gradcap':
      // Mortarboard: skull cap, flat square board and a gold tassel
      return (
        <group position={[0, 0.66, 0]}>
          <mesh geometry={rbox(0.66, 0.2, 0.66, 0.06)} material={mat(c)} />
          <mesh geometry={rbox(0.98, 0.05, 0.98, 0.01)} material={mat(c)} position={[0, 0.13, 0]} rotation={[0, Math.PI / 4, 0]} />
          <mesh geometry={rbox(0.08, 0.05, 0.08, 0.02)} material={mat(c2)} position={[0, 0.17, 0]} />
          <mesh geometry={rbox(0.04, 0.32, 0.04, 0.01)} material={mat(c2)} position={[0.4, 0.0, 0.2]} />
        </group>
      );
    case 'crown':
      return (
        <group position={[0, 0.7, 0]}>
          <mesh geometry={rbox(0.6, 0.12, 0.6, 0.02)} material={mat(c, '#3a2a00')} />
          {[-0.22, 0, 0.22].map((x) => (
            <mesh key={x} geometry={rbox(0.12, 0.16, 0.12, 0.02)} material={mat(c, '#3a2a00')} position={[x, 0.12, 0.24]} />
          ))}
          <mesh geometry={rbox(0.1, 0.1, 0.04, 0.02)} material={mat(c2)} position={[0, 0.02, 0.31]} />
        </group>
      );
    case 'headphones':
      return (
        <group position={[0, 0.36, 0]}>
          <mesh geometry={rbox(0.74, 0.08, 0.14, 0.03)} material={mat(c)} position={[0, 0.34, 0]} />
          <mesh geometry={rbox(0.1, 0.24, 0.24, 0.05)} material={mat(c2)} position={[0.35, 0, 0]} />
          <mesh geometry={rbox(0.1, 0.24, 0.24, 0.05)} material={mat(c2)} position={[-0.35, 0, 0]} />
        </group>
      );
    case 'helmet':
      return (
        <group position={[0, 0.62, 0]}>
          <mesh geometry={rbox(0.76, 0.3, 0.76, 0.14)} material={mat(c)} />
          <mesh geometry={rbox(0.1, 0.06, 0.6, 0.02)} material={mat(c2)} position={[0, 0.16, 0]} />
        </group>
      );
    case 'bow':
      return (
        <group position={[0.18, 0.7, 0.05]}>
          <mesh geometry={rbox(0.18, 0.16, 0.1, 0.04)} material={mat(c)} position={[-0.1, 0, 0]} />
          <mesh geometry={rbox(0.18, 0.16, 0.1, 0.04)} material={mat(c)} position={[0.1, 0, 0]} />
          <mesh geometry={rbox(0.08, 0.08, 0.12, 0.02)} material={mat(c2)} />
        </group>
      );
    case 'bucket':
      return (
        <group position={[0, 0.66, 0]}>
          <mesh geometry={rbox(0.68, 0.2, 0.68, 0.08)} material={cloth(it, c, 'twill')} />
          <mesh geometry={rbox(0.9, 0.04, 0.9, 0.02)} material={cloth(it, c, 'twill')} position={[0, -0.09, 0]} />
        </group>
      );
    case 'fedora':
      return (
        <group position={[0, 0.66, 0]}>
          <mesh geometry={rbox(0.92, 0.04, 0.92, 0.02)} material={cloth(it, c, 'wool')} />
          <mesh geometry={rbox(0.6, 0.26, 0.6, 0.08)} material={cloth(it, c, 'wool')} position={[0, 0.14, 0]} />
          <mesh geometry={rbox(0.62, 0.06, 0.62, 0.02)} material={mat(c2)} position={[0, 0.05, 0]} />
          <mesh geometry={rbox(0.12, 0.05, 0.5, 0.02)} material={cloth(it, shade(c, 0.85), 'wool')} position={[0, 0.27, 0]} />
        </group>
      );
    case 'party':
      return (
        <mesh position={[0, 0.85, 0]} material={mat(c)}>
          <coneGeometry args={[0.22, 0.45, 6]} />
        </mesh>
      );
    default:
      return null;
  }
}

/** A tie hanging from the collar. */
function Tie({ color, z = 0.215 }: { color: string; z?: number }) {
  return (
    <group>
      <mesh geometry={rbox(0.09, 0.07, 0.03, 0.01)} material={fabric('satin', shade(color, 0.85))} position={[0, 0.29, z]} />
      <mesh geometry={rbox(0.075, 0.36, 0.02, 0.01)} material={fabric('satin', color)} position={[0, 0.08, z]} />
    </group>
  );
}

/** Jacket front: shirt V, lapels, buttons and the hem that drops below the waist. */
function Jacket({ it, body, lapel, shirt = '#f4f6fa', vee = 0.17 }: { it: OutfitItem; body: THREE.Material; lapel: THREE.Material; shirt?: string; vee?: number }) {
  return (
    <group>
      <mesh geometry={rbox(vee, 0.3, 0.02, 0.01)} material={fabric('cotton', shirt)} position={[0, 0.18, 0.197]} />
      <mesh geometry={rbox(0.09, 0.34, 0.03, 0.01)} material={lapel} position={[0.1, 0.17, 0.205]} rotation={[0, 0, -0.32]} />
      <mesh geometry={rbox(0.09, 0.34, 0.03, 0.01)} material={lapel} position={[-0.1, 0.17, 0.205]} rotation={[0, 0, 0.32]} />
      {[-0.06, -0.17].map((y) => (
        <mesh key={y} geometry={rbox(0.04, 0.04, 0.02, 0.01)} material={mat('#15161a')} position={[0, y, 0.205]} />
      ))}
      <mesh geometry={rbox(0.68, 0.16, 0.4, 0.03)} material={body} position={[0, -0.4, 0]} />
      <mesh geometry={rbox(0.14, 0.03, 0.02, 0.005)} material={mat(shade(it.color ?? '#333333', 0.7))} position={[-0.18, -0.12, 0.2]} />
    </group>
  );
}

function TopDetails({ it, body }: { it: OutfitItem | undefined; body: THREE.Material }) {
  if (!it) return null;
  const c = it.color ?? '#2ebaba';
  const c2 = it.color2 ?? '#ffffff';
  const dark = cloth({ ...it, color: shade(c, 0.78) }, c);
  switch (it.style) {
    case 'tee':
      return <mesh geometry={rbox(0.24, 0.04, 0.02, 0.01)} material={dark} position={[0, 0.31, 0.19]} />;
    case 'polo':
      return (
        <group>
          <mesh geometry={rbox(0.16, 0.08, 0.04, 0.01)} material={body} position={[0.1, 0.33, 0.18]} rotation={[0, 0, -0.35]} />
          <mesh geometry={rbox(0.16, 0.08, 0.04, 0.01)} material={body} position={[-0.1, 0.33, 0.18]} rotation={[0, 0, 0.35]} />
          <mesh geometry={rbox(0.06, 0.16, 0.02, 0.01)} material={dark} position={[0, 0.22, 0.195]} />
          <mesh geometry={rbox(0.025, 0.025, 0.01, 0.005)} material={mat(c2)} position={[0, 0.25, 0.206]} />
          <mesh geometry={rbox(0.025, 0.025, 0.01, 0.005)} material={mat(c2)} position={[0, 0.19, 0.206]} />
        </group>
      );
    case 'hoodie':
    case 'ziphoodie':
      return (
        <group>
          <mesh geometry={rbox(0.5, 0.26, 0.16, 0.06)} material={dark} position={[0, 0.3, -0.24]} />
          <mesh geometry={rbox(0.42, 0.06, 0.2, 0.03)} material={dark} position={[0, 0.36, 0.08]} />
          {it.style === 'hoodie' ? (
            <mesh geometry={rbox(0.38, 0.17, 0.03, 0.02)} material={dark} position={[0, -0.15, 0.2]} />
          ) : (
            <mesh geometry={rbox(0.025, 0.64, 0.02, 0.005)} material={mat(c2, '#111114')} position={[0, 0, 0.198]} />
          )}
          <mesh geometry={rbox(0.02, 0.15, 0.02, 0.005)} material={mat('#f4f6fa')} position={[0.07, 0.2, 0.2]} />
          <mesh geometry={rbox(0.02, 0.15, 0.02, 0.005)} material={mat('#f4f6fa')} position={[-0.07, 0.2, 0.2]} />
          <mesh geometry={rbox(0.68, 0.07, 0.4, 0.02)} material={dark} position={[0, -0.31, 0]} />
        </group>
      );
    case 'quarterzip':
    case 'qzvest': {
      // For the vest combo, color = vest, color2 = the quarter-zip underneath
      const under = it.style === 'qzvest' ? fabric('knit', c2) : body;
      const zip = mat('#c0c4cc', '#202226');
      return (
        <group>
          <mesh geometry={rbox(0.44, 0.11, 0.34, 0.04)} material={under} position={[0, 0.38, 0]} />
          <mesh geometry={rbox(0.025, 0.22, 0.02, 0.005)} material={zip} position={[0, 0.25, it.style === 'qzvest' ? 0.215 : 0.198]} />
          <mesh geometry={rbox(0.04, 0.06, 0.02, 0.005)} material={zip} position={[0, 0.14, it.style === 'qzvest' ? 0.22 : 0.205]} />
          {it.style === 'quarterzip' ? (
            <>
              <mesh geometry={rbox(0.07, 0.04, 0.01, 0.005)} material={mat(c2)} position={[-0.18, 0.18, 0.196]} />
              <mesh geometry={rbox(0.68, 0.07, 0.4, 0.02)} material={dark} position={[0, -0.31, 0]} />
            </>
          ) : (
            <group>
              {/* Fleece vest shell: two front panels, back, sides, with a gap for the zip */}
              <mesh geometry={rbox(0.3, 0.64, 0.04, 0.02)} material={body} position={[0.18, -0.01, 0.205]} />
              <mesh geometry={rbox(0.3, 0.64, 0.04, 0.02)} material={body} position={[-0.18, -0.01, 0.205]} />
              <mesh geometry={rbox(0.7, 0.64, 0.04, 0.02)} material={body} position={[0, -0.01, -0.205]} />
              <mesh geometry={rbox(0.04, 0.5, 0.42, 0.02)} material={body} position={[0.345, -0.08, 0]} />
              <mesh geometry={rbox(0.04, 0.5, 0.42, 0.02)} material={body} position={[-0.345, -0.08, 0]} />
              <mesh geometry={rbox(0.025, 0.6, 0.02, 0.005)} material={zip} position={[0.035, -0.01, 0.228]} />
              <mesh geometry={rbox(0.06, 0.035, 0.01, 0.005)} material={mat('#f4f6fa')} position={[-0.2, 0.17, 0.228]} />
            </group>
          )}
        </group>
      );
    }
    case 'turtleneck':
      return <mesh geometry={rbox(0.42, 0.16, 0.34, 0.06)} material={body} position={[0, 0.39, 0]} />;
    case 'cardigan':
      return (
        <group>
          <mesh geometry={rbox(0.12, 0.66, 0.02, 0.01)} material={fabric('cotton', c2)} position={[0, 0, 0.196]} />
          {[0.18, 0.04, -0.1, -0.24].map((y) => (
            <mesh key={y} geometry={rbox(0.035, 0.035, 0.02, 0.01)} material={mat('#3a2a1c')} position={[0.085, y, 0.205]} />
          ))}
          <mesh geometry={rbox(0.68, 0.07, 0.4, 0.02)} material={dark} position={[0, -0.31, 0]} />
        </group>
      );
    case 'bomber':
    case 'varsity': {
      const rib = fabric('knit', it.style === 'varsity' ? c2 : '#2a2a30', '#ffffff');
      return (
        <group>
          <mesh geometry={rbox(0.7, 0.08, 0.42, 0.02)} material={rib} position={[0, -0.31, 0]} />
          <mesh geometry={rbox(0.44, 0.08, 0.34, 0.03)} material={rib} position={[0, 0.36, 0]} />
          <mesh geometry={rbox(0.025, 0.6, 0.02, 0.005)} material={mat('#c0c4cc', '#202226')} position={[0, 0, 0.198]} />
          {it.style === 'varsity' && (
            <group position={[-0.17, 0.12, 0.2]}>
              <mesh geometry={rbox(0.16, 0.18, 0.02, 0.01)} material={fabric('wool', c2)} />
              <mesh geometry={rbox(0.03, 0.12, 0.02, 0.005)} material={mat(c)} position={[-0.03, 0, 0.01]} />
              <mesh geometry={rbox(0.08, 0.03, 0.02, 0.005)} material={mat(c)} position={[0.01, 0.045, 0.01]} />
              <mesh geometry={rbox(0.06, 0.03, 0.02, 0.005)} material={mat(c)} position={[0, 0, 0.01]} />
            </group>
          )}
        </group>
      );
    }
    case 'puffer':
      return (
        <group>
          <mesh geometry={rbox(0.74, 0.66, 0.46, 0.12)} material={body} />
          <mesh geometry={rbox(0.48, 0.16, 0.4, 0.06)} material={body} position={[0, 0.38, 0]} />
          <mesh geometry={rbox(0.025, 0.66, 0.02, 0.005)} material={mat(c2)} position={[0, 0, 0.235]} />
        </group>
      );
    case 'blazer':
      return <Jacket it={it} body={body} lapel={dark} shirt={c2} />;
    case 'suit':
      return (
        <group>
          <Jacket it={it} body={body} lapel={dark} />
          <Tie color={c2} />
          <mesh geometry={rbox(0.05, 0.05, 0.02, 0.01)} material={mat('#ffcf3f', '#4a3500')} position={[-0.2, 0.2, 0.215]} />
        </group>
      );
    case 'threepiece':
      return (
        <group>
          <Jacket it={it} body={body} lapel={dark} shirt={shade(c, 0.7)} vee={0.2} />
          <mesh geometry={rbox(0.09, 0.3, 0.02, 0.01)} material={fabric('cotton', '#f4f6fa')} position={[0, 0.22, 0.2]} />
          <Tie color={c2} z={0.218} />
          <mesh geometry={rbox(0.09, 0.05, 0.02, 0.01)} material={fabric('satin', c2)} position={[-0.2, 0.17, 0.212]} />
          <mesh geometry={rbox(0.01, 0.1, 0.01, 0.003)} material={mat('#ffcf3f', '#4a3500')} position={[0.12, -0.04, 0.21]} rotation={[0, 0, 1.1]} />
        </group>
      );
    case 'tux':
      return (
        <group>
          <Jacket it={it} body={body} lapel={fabric('satin', '#26272d')} vee={0.22} />
          <mesh geometry={rbox(0.1, 0.06, 0.03, 0.01)} material={fabric('satin', '#0d0d10')} position={[0.05, 0.3, 0.215]} rotation={[0, 0, 0.3]} />
          <mesh geometry={rbox(0.1, 0.06, 0.03, 0.01)} material={fabric('satin', '#0d0d10')} position={[-0.05, 0.3, 0.215]} rotation={[0, 0, -0.3]} />
          {[0.2, 0.12, 0.04].map((y) => (
            <mesh key={y} geometry={rbox(0.025, 0.025, 0.01, 0.005)} material={mat('#15161a')} position={[0, y, 0.205]} />
          ))}
        </group>
      );
    case 'stripes':
      return (
        <group>
          {[-0.2, 0, 0.2].map((y) => (
            <mesh key={y} geometry={rbox(0.67, 0.07, 0.39, 0.01)} material={mat(c2)} position={[0, y, 0]} />
          ))}
        </group>
      );
    case 'jersey':
      return (
        <group>
          <mesh geometry={rbox(0.24, 0.24, 0.02, 0.01)} material={mat(c2)} position={[0, 0.04, 0.2]} />
          <mesh geometry={rbox(0.3, 0.05, 0.02, 0.01)} material={mat(c2)} position={[0, 0.31, 0.19]} />
        </group>
      );
    case 'apron':
      return <mesh geometry={rbox(0.5, 0.56, 0.03, 0.02)} material={fabric('cotton', c2)} position={[0, -0.06, 0.2]} />;
    case 'cape':
      return <mesh geometry={rbox(0.62, 0.95, 0.05, 0.02)} material={fabric('satin', c2)} position={[0, -0.2, -0.23]} rotation={[0.08, 0, 0]} />;
    case 'vest':
      return (
        <group>
          <mesh geometry={rbox(0.2, 0.6, 0.03, 0.01)} material={fabric('twill', c2)} position={[0.21, 0, 0.195]} />
          <mesh geometry={rbox(0.2, 0.6, 0.03, 0.01)} material={fabric('twill', c2)} position={[-0.21, 0, 0.195]} />
        </group>
      );
    default:
      return null;
  }
}

/** Head-mounted accessories. */
function HeadAccessory({ it }: { it: OutfitItem | undefined }) {
  if (!it) return null;
  const c = it.color ?? '#1e2840';
  switch (it.style) {
    case 'glasses':
      return (
        <group position={[0, 0.33, 0.31]}>
          <mesh geometry={rbox(0.2, 0.14, 0.03, 0.02)} material={mat(c)} position={[-0.14, 0, 0]} />
          <mesh geometry={rbox(0.2, 0.14, 0.03, 0.02)} material={mat(c)} position={[0.14, 0, 0]} />
          <mesh geometry={rbox(0.1, 0.03, 0.03, 0.01)} material={mat(c)} />
        </group>
      );
    case 'shades':
      return <mesh geometry={rbox(0.56, 0.13, 0.04, 0.03)} material={mat(c)} position={[0, 0.33, 0.31]} />;
    case 'headset':
      return (
        <group>
          <mesh geometry={rbox(0.72, 0.06, 0.1, 0.02)} material={mat(c)} position={[0, 0.66, 0]} />
          <mesh geometry={rbox(0.08, 0.32, 0.06, 0.02)} material={mat(c)} position={[0.35, 0.5, 0]} />
          <mesh geometry={rbox(0.1, 0.2, 0.2, 0.05)} material={mat(c)} position={[0.35, 0.32, 0]} />
          <mesh geometry={rbox(0.03, 0.03, 0.3, 0.01)} material={mat(it.color2 ?? '#c0c4cc')} position={[0.3, 0.22, 0.17]} rotation={[0, 0.35, 0]} />
        </group>
      );
    default:
      return null;
  }
}

/** Torso-mounted accessories. */
function BodyAccessory({ it }: { it: OutfitItem | undefined }) {
  if (!it) return null;
  const c = it.color ?? '#1e2840';
  switch (it.style) {
    case 'backpack':
      return (
        <group position={[0, -0.02, -0.3]}>
          <mesh geometry={rbox(0.5, 0.56, 0.24, 0.07)} material={fabric('twill', c)} />
          <mesh geometry={rbox(0.36, 0.2, 0.06, 0.04)} material={fabric('twill', shade(c, 1.15))} position={[0, -0.12, -0.13]} />
        </group>
      );
    case 'scarf':
      return (
        <group>
          <mesh geometry={rbox(0.66, 0.12, 0.42, 0.05)} material={cloth(it, c, 'check')} position={[0, 0.3, 0]} />
          <mesh geometry={rbox(0.12, 0.3, 0.04, 0.02)} material={cloth(it, c, 'check')} position={[0.14, 0.12, 0.21]} />
        </group>
      );
    case 'chain':
      return (
        <group>
          <mesh geometry={rbox(0.025, 0.2, 0.02, 0.005)} material={mat(c, '#2a2c30')} position={[0.07, 0.22, 0.2]} rotation={[0, 0, 0.5]} />
          <mesh geometry={rbox(0.025, 0.2, 0.02, 0.005)} material={mat(c, '#2a2c30')} position={[-0.07, 0.22, 0.2]} rotation={[0, 0, -0.5]} />
          <mesh geometry={rbox(0.05, 0.05, 0.02, 0.01)} material={mat(c, '#2a2c30')} position={[0, 0.13, 0.205]} />
        </group>
      );
    case 'lanyard':
      return (
        <group>
          <mesh geometry={rbox(0.025, 0.3, 0.02, 0.005)} material={mat(c)} position={[0.09, 0.18, 0.2]} rotation={[0, 0, 0.3]} />
          <mesh geometry={rbox(0.025, 0.3, 0.02, 0.005)} material={mat(c)} position={[-0.09, 0.18, 0.2]} rotation={[0, 0, -0.3]} />
          <mesh geometry={rbox(0.13, 0.16, 0.02, 0.01)} material={mat(it.color2 ?? '#ffffff')} position={[0, 0, 0.21]} />
          <mesh geometry={rbox(0.13, 0.04, 0.02, 0.005)} material={mat(c)} position={[0, 0.06, 0.215]} />
        </group>
      );
    default:
      return null;
  }
}

/** Wrist / hand accessories, attached to an arm group (hand at y ≈ −0.6). */
function HandAccessory({ it, side }: { it: OutfitItem | undefined; side: 'left' | 'right' }) {
  if (!it) return null;
  const metal = it.style === 'watch' && (it.color === '#d9a823' || it.color === '#c8ccd4');
  if (it.style === 'watch' && side === 'left')
    return (
      <group position={[0, -0.5, 0]}>
        <mesh geometry={rbox(0.235, 0.07, 0.255, 0.02)} material={mat(it.color ?? '#22252d', metal ? (it.color === '#d9a823' ? '#4a3500' : '#2a2c30') : undefined)} />
        <mesh geometry={rbox(0.03, 0.09, 0.12, 0.01)} material={mat(it.color2 ?? '#1e2840', it.color2 === '#3cc45a' ? '#1a5a24' : undefined)} position={[0.12, 0, 0]} />
      </group>
    );
  if (it.style === 'briefcase' && side === 'right')
    return (
      <group position={[0, -0.86, 0.05]}>
        <mesh geometry={rbox(0.12, 0.32, 0.46, 0.03)} material={fabric('leather', it.color ?? '#5a3826')} />
        <mesh geometry={rbox(0.05, 0.06, 0.16, 0.02)} material={mat('#2a1c12')} position={[0, 0.19, 0]} />
        <mesh geometry={rbox(0.13, 0.04, 0.04, 0.01)} material={mat(it.color2 ?? '#d9a823', '#4a3500')} position={[0, 0.1, 0.12]} />
        <mesh geometry={rbox(0.13, 0.04, 0.04, 0.01)} material={mat(it.color2 ?? '#d9a823', '#4a3500')} position={[0, 0.1, -0.12]} />
      </group>
    );
  return null;
}

/** Shoe for one foot. Default (no item) is a simple sneaker in the free shoe color. */
function Shoe({ it, color }: { it: OutfitItem | undefined; color: string }) {
  const style = it?.style ?? 'basic';
  const c = it?.color ?? color;
  const c2 = it?.color2 ?? '#f4f6fa';
  const sole = (h: number, col: string) => <mesh geometry={rbox(0.31, h, 0.42, 0.02)} material={mat(col)} position={[0, -0.765, 0.045]} />;
  switch (style) {
    case 'sneakers':
    case 'canvas':
      return (
        <group>
          <mesh geometry={rbox(0.3, 0.13, 0.4, 0.05)} material={cloth(it, c, style === 'canvas' ? 'cotton' : 'plain')} position={[0, -0.7, 0.04]} />
          <mesh geometry={rbox(0.31, 0.04, 0.14, 0.02)} material={mat('#f4f6fa')} position={[0, -0.72, 0.19]} />
          <mesh geometry={rbox(0.32, 0.05, 0.16, 0.01)} material={mat(c2)} position={[0, -0.69, 0.0]} />
          {sole(0.05, '#f4f6fa')}
        </group>
      );
    case 'hightops':
      return (
        <group>
          <mesh geometry={rbox(0.31, 0.25, 0.4, 0.05)} material={cloth(it, c, 'plain')} position={[0, -0.64, 0.04]} />
          <mesh geometry={rbox(0.32, 0.06, 0.18, 0.01)} material={mat(c2)} position={[0, -0.62, 0.0]} />
          <mesh geometry={rbox(0.12, 0.16, 0.02, 0.01)} material={mat(c2)} position={[0, -0.62, 0.245]} />
          {sole(0.06, '#f4f6fa')}
        </group>
      );
    case 'loafers':
      return (
        <group>
          <mesh geometry={rbox(0.28, 0.1, 0.42, 0.05)} material={cloth(it, c, 'leather')} position={[0, -0.72, 0.05]} />
          <mesh geometry={rbox(0.18, 0.03, 0.06, 0.01)} material={mat(shade(c, 0.6))} position={[0, -0.665, 0.16]} />
          {sole(0.04, '#2a1c12')}
        </group>
      );
    case 'oxfords':
      return (
        <group>
          <mesh geometry={rbox(0.28, 0.11, 0.43, 0.06)} material={mat(c, '#141418')} position={[0, -0.715, 0.05]} />
          <mesh geometry={rbox(0.1, 0.02, 0.12, 0.01)} material={mat('#3a3d45')} position={[0, -0.655, 0.06]} />
          {sole(0.035, '#0b0b0d')}
        </group>
      );
    default:
      return (
        <group>
          <mesh geometry={rbox(0.3, 0.13, 0.4, 0.05)} material={mat(c)} position={[0, -0.7, 0.04]} />
          {sole(0.04, shade(c, 0.75))}
        </group>
      );
  }
}

/** One leg: trousers (or shorts + bare shin), an optional cuff, and the shoe. */
function Leg({ pants, skin, bottom, feet, shoeColor }: { pants: THREE.Material; skin: THREE.Material; bottom?: OutfitItem; feet?: OutfitItem; shoeColor: string }) {
  const shorts = bottom?.style === 'shorts';
  return (
    <group>
      {shorts ? (
        <>
          <mesh geometry={rbox(0.3, 0.34, 0.32, 0.06)} material={pants} position={[0, -0.17, 0]} castShadow />
          <mesh geometry={rbox(0.22, 0.34, 0.24, 0.05)} material={skin} position={[0, -0.47, 0]} />
        </>
      ) : (
        <mesh geometry={rbox(0.28, 0.66, 0.3, 0.06)} material={pants} position={[0, -0.33, 0]} castShadow />
      )}
      {bottom?.style === 'joggers' && <mesh geometry={rbox(0.27, 0.07, 0.29, 0.02)} material={fabric('knit', bottom.color2 ?? '#9aa0aa')} position={[0, -0.6, 0]} />}
      {bottom?.style === 'cargo' && <mesh geometry={rbox(0.05, 0.16, 0.18, 0.02)} material={pants} position={[0.15, -0.36, 0]} />}
      {bottom?.style === 'trousers' && <mesh geometry={rbox(0.02, 0.6, 0.02, 0.005)} material={mat(shade(bottom.color ?? '#333333', 0.75))} position={[0, -0.33, 0.152]} />}
      <Shoe it={feet} color={shoeColor} />
    </group>
  );
}

/**
 * Blocky player/NPC character. Feet at y=0, faces +Z.
 * Original design: cube head, chunky rounded limbs, simple pixel-free face.
 */
export function Avatar({ config, anim, scale = 1 }: { config: AvatarConfig; anim?: React.RefObject<AnimState>; scale?: number }) {
  const lLeg = useRef<THREE.Group>(null);
  const rLeg = useRef<THREE.Group>(null);
  const lArm = useRef<THREE.Group>(null);
  const rArm = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const phase = useRef(Math.random() * 10);

  const top = outfit(config.top);
  const bottom = outfit(config.bottom);
  const feet = outfit(config.feet);
  const acc = outfit(config.accessory);
  const m = useMemo(() => {
    const torso = cloth(top, config.shirt);
    // Sleeves: knit under a fleece vest, leather on a varsity jacket, otherwise same as the body
    const sleeve =
      top?.style === 'qzvest' ? fabric('knit', top.color2 ?? '#7f9cc9') : top?.style === 'varsity' ? fabric('leather', top.color2 ?? '#f4f1ea') : torso;
    // Suits come with matching trousers unless the player picked other pants
    const pants = bottom ? cloth(bottom, config.pants, 'twill') : top && SUITS.has(top.style) && top.style !== 'blazer' ? torso : fabric('twill', config.pants);
    return {
      torso,
      sleeve,
      pants,
      skin: mat(config.skin),
      eyes: mat(config.eyes),
      white: mat('#ffffff'),
      mouth: mat(shade(config.skin, 0.55)),
      lips: mat(shade(config.skin, 0.78)),
      nose: mat(shade(config.skin, 0.9)),
      brow: mat(shade(config.hair, 0.85)),
      cuff: mat('#f4f6fa'),
    };
  }, [top, bottom, config.shirt, config.pants, config.skin, config.eyes, config.hair]);
  const short = !!top && SHORT_SLEEVE.has(top.style);
  const jacket = !!top && SUITS.has(top.style);
  const ribCuff = top && (top.style === 'bomber' || top.style === 'varsity') ? fabric('knit', top.style === 'varsity' ? top.color2 ?? '#f4f1ea' : '#2a2a30') : null;
  const headAcc = acc && ['glasses', 'shades', 'headset'].includes(acc.style) ? acc : undefined;
  const bodyAcc = acc && ['backpack', 'scarf', 'chain', 'lanyard'].includes(acc.style) ? acc : undefined;
  const handAcc = acc && ['watch', 'briefcase'].includes(acc.style) ? acc : undefined;

  const arm = (side: 'left' | 'right') => (
    <>
      {short ? (
        <>
          <mesh geometry={rbox(0.23, 0.24, 0.26, 0.06)} material={m.sleeve} position={[0, -0.11, 0]} castShadow />
          <mesh geometry={rbox(0.18, 0.34, 0.2, 0.05)} material={m.skin} position={[0, -0.4, 0]} />
        </>
      ) : (
        <mesh geometry={rbox(0.21, 0.56, 0.24, 0.06)} material={m.sleeve} position={[0, -0.26, 0]} castShadow />
      )}
      {jacket && <mesh geometry={rbox(0.19, 0.05, 0.22, 0.02)} material={m.cuff} position={[0, -0.53, 0]} />}
      {ribCuff && <mesh geometry={rbox(0.22, 0.07, 0.25, 0.02)} material={ribCuff} position={[0, -0.51, 0]} />}
      <mesh geometry={rbox(0.2, 0.16, 0.22, 0.06)} material={m.skin} position={[0, -0.6, 0]} />
      <HandAccessory it={handAcc} side={side} />
    </>
  );

  useFrame((_, dt) => {
    const a = anim?.current;
    const speed = a?.speed ?? 0;
    const grounded = a?.grounded ?? true;
    phase.current += dt * (4 + speed * 7);
    const p = phase.current;
    const swing = grounded ? Math.sin(p) * Math.min(1, speed) * 0.85 : 0.5;
    if (lLeg.current && rLeg.current) {
      lLeg.current.rotation.x = swing;
      rLeg.current.rotation.x = grounded ? -swing : -0.3;
    }
    if (lArm.current && rArm.current) {
      lArm.current.rotation.x = -swing * 0.9;
      const waving = (a?.wave ?? 0) > 0;
      rArm.current.rotation.x = waving ? -2.8 : grounded ? swing * 0.9 : -2.4;
      rArm.current.rotation.z = waving ? 0.25 + Math.sin(p * 2.5) * 0.35 : 0;
      lArm.current.rotation.z = grounded ? 0.04 : -0.5;
    }
    if (a?.sitting && lLeg.current && rLeg.current) {
      // Seated: thighs forward, lower the body onto the chair
      lLeg.current.rotation.x = -1.45;
      rLeg.current.rotation.x = -1.45;
    }
    if (a?.busy && lArm.current && rArm.current) {
      const k = Math.sin(p * 3.1) * 0.07;
      lArm.current.rotation.x = -1.05 + k;
      rArm.current.rotation.x = -1.05 - k;
      lArm.current.rotation.z = 0.12;
      rArm.current.rotation.z = -0.12;
    }
    if (body.current) {
      const bob = grounded ? Math.abs(Math.sin(p)) * 0.05 * Math.min(1, speed) + Math.sin(p * 0.35) * 0.008 : 0;
      body.current.position.y = a?.sitting ? -0.42 : bob;
    }
    if (head.current) head.current.rotation.y = Math.sin(p * 0.2) * 0.08 * (1 - Math.min(1, speed));
  });

  return (
    <group scale={scale}>
      <group ref={body}>
        {/* Legs: longer than they used to be, for grown-up proportions */}
        <group ref={lLeg} position={[0.16, 0.9, 0]}>
          <group scale={[1, 1.15, 1]}>
            <Leg pants={m.pants} skin={m.skin} bottom={bottom} feet={feet} shoeColor={config.shoes} />
          </group>
        </group>
        <group ref={rLeg} position={[-0.16, 0.9, 0]}>
          <group scale={[1, 1.15, 1]}>
            <Leg pants={m.pants} skin={m.skin} bottom={bottom} feet={feet} shoeColor={config.shoes} />
          </group>
        </group>
        {/* Hips join the legs to the body */}
        <mesh geometry={rbox(0.62, 0.16, 0.34, 0.05)} material={m.pants} position={[0, 0.9, 0]} />
        {/* Torso */}
        <group position={[0, 1.23, 0]}>
          <mesh geometry={rbox(0.66, 0.68, 0.38, 0.08)} material={m.torso} castShadow />
          <TopDetails it={top} body={m.torso} />
          <BodyAccessory it={bodyAcc} />
        </group>
        {/* Arms */}
        <group ref={lArm} position={[0.44, 1.52, 0]}>
          <group scale={[1, 1.1, 1]}>{arm('left')}</group>
        </group>
        <group ref={rArm} position={[-0.44, 1.52, 0]}>
          <group scale={[1, 1.1, 1]}>{arm('right')}</group>
        </group>
        {/* Neck */}
        <mesh geometry={rbox(0.22, 0.14, 0.22, 0.04)} material={m.skin} position={[0, 1.6, 0]} />
        {/* Head: smaller in proportion to the body, with a proper face */}
        <group ref={head} position={[0, 1.6, 0]} scale={0.82}>
          <mesh geometry={rbox(0.62, 0.62, 0.6, 0.09)} material={m.skin} position={[0, 0.31, 0]} castShadow />
          {/* Ears */}
          <mesh geometry={rbox(0.06, 0.15, 0.11, 0.025)} material={m.nose} position={[0.32, 0.3, 0]} />
          <mesh geometry={rbox(0.06, 0.15, 0.11, 0.025)} material={m.nose} position={[-0.32, 0.3, 0]} />
          {/* Eyes: white, coloured iris with a dark pupil and a glint */}
          <mesh geometry={rbox(0.14, 0.1, 0.02, 0.02)} material={m.white} position={[0.14, 0.35, 0.3]} />
          <mesh geometry={rbox(0.14, 0.1, 0.02, 0.02)} material={m.white} position={[-0.14, 0.35, 0.3]} />
          <mesh geometry={rbox(0.07, 0.09, 0.02, 0.015)} material={m.eyes} position={[0.13, 0.348, 0.31]} />
          <mesh geometry={rbox(0.07, 0.09, 0.02, 0.015)} material={m.eyes} position={[-0.15, 0.348, 0.31]} />
          <mesh geometry={rbox(0.025, 0.025, 0.01, 0.005)} material={m.white} position={[0.115, 0.365, 0.322]} />
          <mesh geometry={rbox(0.025, 0.025, 0.01, 0.005)} material={m.white} position={[-0.165, 0.365, 0.322]} />
          {/* Eyebrows */}
          <mesh geometry={rbox(0.16, 0.035, 0.03, 0.01)} material={m.brow} position={[0.14, 0.45, 0.3]} rotation={[0, 0, -0.08]} />
          <mesh geometry={rbox(0.16, 0.035, 0.03, 0.01)} material={m.brow} position={[-0.14, 0.45, 0.3]} rotation={[0, 0, 0.08]} />
          {/* Nose and mouth */}
          <mesh geometry={rbox(0.08, 0.13, 0.07, 0.025)} material={m.nose} position={[0, 0.26, 0.32]} />
          <mesh geometry={rbox(0.15, 0.035, 0.02, 0.012)} material={m.lips} position={[0, 0.13, 0.302]} />
          <mesh geometry={rbox(0.11, 0.015, 0.02, 0.006)} material={m.mouth} position={[0, 0.14, 0.31]} />
          {/* Corners of the mouth turned up a touch: a relaxed, friendly expression */}
          <mesh geometry={rbox(0.03, 0.02, 0.02, 0.006)} material={m.mouth} position={[0.065, 0.152, 0.31]} />
          <mesh geometry={rbox(0.03, 0.02, 0.02, 0.006)} material={m.mouth} position={[-0.065, 0.152, 0.31]} />
          <Hair style={config.hairStyle} color={config.hair} />
          <Hat id={config.hat} />
          <HeadAccessory it={headAcc} />
        </group>
      </group>
    </group>
  );
}
