'use client';
import { useEffect, useMemo, useRef } from 'react';
import { walkTo } from '@/engine/walk';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '@/store/game';
import { useUI } from '@/store/ui';
import { rt } from '@/engine/runtime';
import { CollisionWorld } from '@/engine/collision';
import { VoxelBuilder } from '@/engine/voxel';
import { worldUniforms } from '@/engine/atlas';
import { FURNITURE_SIZE, homeInfo, isFlat, layoutOf, placementProblem, type HomeInfo } from '@/game/home';
import type { PlacedFurniture } from '@/game/types';
import { M } from './materials';
import { buildShell, GLASS_MAT } from './InteriorScene';
import { furnitureGeometry, fishbowlGeometry } from './Furniture';
import type { Layout } from './interiors/plan';

/** Where the piece you are carrying would land, read by the decorating panel. */
export const decorTarget = { x: 0, z: 0, problem: null as string | null };

/** Wall and floor finish for each kind of home. */
function lookFor(home: HomeInfo) {
  const id = home.prop.houseId ?? home.prop.itemId;
  switch (id) {
    case 'ny-loft':
      return { wall: '#b5654a', wallTex: 'brick', floor: 'wood', floorColor: '#8a5a34', windows: true };
    case 'modern-villa':
      return { wall: '#f4f6fa', wallTex: 'concrete', floor: 'marble', floorColor: '#e6e8ea', windows: true };
    case 'sg-condo':
    case 'hk-apartment':
      return { wall: '#eef3ec', wallTex: 'stucco', floor: 'marble', floorColor: '#ddd8cc', windows: true };
    case 'london-flat':
      return { wall: '#e9e2d0', wallTex: 'stucco', floor: 'wood', floorColor: '#9a6a40', windows: true };
    default:
      return { wall: '#f1e7d6', wallTex: 'stucco', floor: 'wood', floorColor: '#b07a4a', windows: true };
  }
}

/** Colliders for the room walls plus every piece of furniture that isn't flat. */
function roomCollision(L: Layout, layout: PlacedFurniture[], itemsById: Map<string, string>) {
  const { w, d } = L;
  const c = new CollisionWorld();
  c.bounds = { minX: -w / 2, maxX: w / 2, minZ: -d / 2, maxZ: d / 2 + 2 };
  c.addBox(0, -d / 2 - 0.25, w + 1, 0.5, 0, 10);
  c.addBox(-w / 2 - 0.25, 0, 0.5, d, 0, 10);
  c.addBox(w / 2 + 0.25, 0, 0.5, d, 0, 10);
  c.addBox(-w / 4 - 1.2, d / 2 + 0.25, w / 2 - 2.4, 0.5, 0, 10);
  c.addBox(w / 4 + 1.2, d / 2 + 0.25, w / 2 - 2.4, 0.5, 0, 10);
  c.addBox(0, d / 2 + 0.25, 4.8, 0.5, 0, 10);
  for (const f of layout) {
    const id = itemsById.get(f.item);
    if (!id || isFlat(id)) continue;
    const s = FURNITURE_SIZE[id] ?? { w: 1, d: 1, h: 1 };
    c.addBox(f.x, f.z, s.w, s.d, 0, s.h, 'furniture', f.rot);
  }
  return c;
}

export function HomeScene({ propUid }: { propUid: string }) {
  const world = useGame((s) => s.world);
  const home = useMemo(() => (world ? homeInfo(world, propUid) : null), [world, propUid]);
  const items = world?.assets.items;
  const layout = home ? layoutOf(home.prop) : [];
  const layoutKey = JSON.stringify(layout);
  const itemsById = useMemo(() => new Map((items ?? []).map((i) => [i.uid, i.itemId])), [items]);
  const hasFish = !!world?.assets.pets.some((p) => p.itemId === 'goldfish');
  const decor = useUI((s) => s.decor);

  const L: Layout = useMemo(() => ({ w: home?.room.w ?? 10, d: home?.room.d ?? 8, h: home?.room.h ?? 3.6, spots: [], sides: false }), [home?.room.w, home?.room.d, home?.room.h]);
  const look = home ? lookFor(home) : null;

  const shell = useMemo(() => {
    const b = new VoxelBuilder();
    const g = new VoxelBuilder();
    if (look) buildShell(b, g, look, L, false);
    return { geo: b.build(), glass: g.build() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L, look?.wall, look?.floor]);

  // New scene, exit door and starting spot, once per visit
  useMemo(() => {
    rt.resetScene(`home:${propUid}`);
    rt.triggers.push({ id: 'exit', kind: 'exit', x: 0, z: L.d / 2 - 0.8, r: 1.8, label: 'Leave home', icon: '🚪' });
  }, [propUid, L]);
  // Colliders follow the furniture as you arrange it
  useMemo(() => {
    rt.collision = roomCollision(L, layout, itemsById);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L, layoutKey, itemsById]);

  useEffect(() => {
    rt.teleport(0, L.d / 2 - 3.2, Math.PI);
    rt.camYaw = 0;
    rt.camPitch = 0.5;
    rt.camDist = 4.2;
    const t = setTimeout(() => useUI.getState().setLoading({ active: false, progress: 1 }), 80);
    return () => {
      clearTimeout(t);
      useUI.getState().setDecor(null);
    };
  }, [L]);

  useFrame(() => {
    worldUniforms.uGrime.value = 0.2;
    worldUniforms.uWet.value = 0;
    worldUniforms.uSnow.value = 0;
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return;
    e.stopPropagation();
    walkTo(e.point.x, e.point.z);
  };

  if (!home) return null;
  return (
    <group>
      <mesh geometry={shell.geo} material={M.vc} onClick={onClick} receiveShadow />
      <mesh geometry={shell.glass} material={GLASS_MAT} renderOrder={2} />
      {[-L.w / 4, L.w / 4].map((x) => (
        <pointLight key={x} position={[x, L.h - 0.8, 0]} intensity={8} distance={L.w} color="#ffe9c4" decay={1.4} />
      ))}
      {layout.map((f) =>
        f.item === decor?.carrying ? null : <Piece key={f.item} itemId={itemsById.get(f.item) ?? ''} x={f.x} z={f.z} rot={f.rot} />,
      )}
      {hasFish && <FishBowl x={L.w / 2 - 0.6} z={-L.d / 2 + 0.6} />}
      {decor?.carrying && decor.home === propUid && <Ghost itemId={itemsById.get(decor.carrying) ?? ''} home={home} layout={layout} itemsById={itemsById} />}
    </group>
  );
}

function Piece({ itemId, x, z, rot }: { itemId: string; x: number; z: number; rot: number }) {
  const geo = useMemo(() => furnitureGeometry(itemId), [itemId]);
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh geometry={geo.solid} material={M.vc} castShadow receiveShadow />
      {geo.glow && <mesh geometry={geo.glow} material={M.neon} />}
    </group>
  );
}

function FishBowl({ x, z }: { x: number; z: number }) {
  const geo = useMemo(() => fishbowlGeometry(), []);
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={geo.solid} material={M.vc} />
      {geo.glow && <mesh geometry={geo.glow} material={M.neon} />}
    </group>
  );
}

const ghostOk = new THREE.MeshBasicMaterial({ color: '#4ade80', transparent: true, opacity: 0.45, depthWrite: false });
const ghostBad = new THREE.MeshBasicMaterial({ color: '#f05252', transparent: true, opacity: 0.45, depthWrite: false });

/** The piece you're carrying, shown where it would go: in front of you, snapped to a 25 cm grid. */
function Ghost({ itemId, home, layout, itemsById }: { itemId: string; home: HomeInfo; layout: PlacedFurniture[]; itemsById: Map<string, string> }) {
  const g = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => furnitureGeometry(itemId), [itemId]);
  const size = FURNITURE_SIZE[itemId] ?? { w: 1, d: 1, h: 1 };
  useFrame(() => {
    const d = useUI.getState().decor;
    if (!g.current || !d) return;
    const ahead = Math.max(size.w, size.d) / 2 + 0.9;
    const snap = (v: number) => Math.round(v * 4) / 4;
    const x = snap(rt.player.x + Math.sin(rt.playerRotY) * ahead);
    const z = snap(rt.player.z + Math.cos(rt.playerRotY) * ahead);
    const problem = placementProblem(home.room, layout, itemsById, itemId, x, z, d.rot, d.carrying ?? undefined);
    decorTarget.x = x;
    decorTarget.z = z;
    decorTarget.problem = problem;
    g.current.position.set(x, 0.01, z);
    g.current.rotation.y = d.rot;
    if (mesh.current) mesh.current.material = problem ? ghostBad : ghostOk;
  });
  return (
    <group ref={g}>
      <mesh ref={mesh} geometry={geo.solid} material={ghostOk} renderOrder={3} />
    </group>
  );
}
