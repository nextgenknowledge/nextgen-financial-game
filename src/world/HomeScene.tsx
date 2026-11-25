'use client';
import { useEffect, useMemo, useRef } from 'react';
import { walkTo } from '@/engine/walk';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '@/store/game';
import { useUI } from '@/store/ui';
import { useScene } from '@/store/scene';
import { rt } from '@/engine/runtime';
import { playSfx } from '@/engine/audio';
import { CollisionWorld } from '@/engine/collision';
import { VoxelBuilder } from '@/engine/voxel';
import { worldUniforms } from '@/engine/atlas';
import { FURNITURE_SIZE, homeInfo, isFlat, layoutOf, placementProblem, type HomeInfo } from '@/game/home';
import type { PlacedFurniture } from '@/game/types';
import { M } from './materials';
import { buildShell, GLASS_MAT } from './InteriorScene';
import { decorAction } from '@/ui/hud/DecorPanel';
import { buildHomeInterior, homeStyle, type Collider } from './homeInterior';
import { STOREY } from '@/game/homePlan';
import { furnitureGeometry, fishbowlGeometry } from './Furniture';
import type { Layout } from './interiors/plan';

/** Where the piece you are carrying would land, read by the decorating panel. */
export const decorTarget = { x: 0, z: 0, problem: null as string | null };

/**
 * Arranging furniture from above: where the pointer is over the floor, the grab offset so a piece
 * doesn't jump to the pointer, and whether a piece is being dragged (rather than placed with a tap).
 */
export const planner = { x: 0, z: 0, offX: 0, offZ: 0, dragging: false };
const snap = (v: number) => Math.round(v * 4) / 4;

/** Let go of the piece being carried: put it down if it fits; a dragged piece that doesn't fit goes back. */
export function finishPlacing() {
  const d = useUI.getState().decor;
  if (!d?.carrying) return;
  const dragged = planner.dragging;
  planner.dragging = false;
  if (dragged && decorTarget.problem) {
    useUI.getState().pushToast({ text: `${decorTarget.problem} It went back where it was.`, tone: 'info' });
    decorAction('cancel');
    return;
  }
  decorAction('place');
}

/** Wall and floor finish for each kind of home (from its style in homeInterior.ts). */
function lookFor(home: HomeInfo) {
  const st = homeStyle(home.prop.houseId ?? home.prop.itemId);
  return { wall: st.wall, wallTex: st.wallTex, floor: st.floor, floorColor: st.floorColor, windows: true };
}

/** Colliders for the room walls plus every piece of furniture that isn't flat. */
function roomCollision(L: Layout, layout: PlacedFurniture[], itemsById: Map<string, string>, builtIn: Collider[]) {
  const { w, d } = L;
  const c = new CollisionWorld();
  for (const k of builtIn) c.addBox(k.x, k.z, k.w, k.d, k.minY, k.maxY, 'built-in');
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
    if (look) {
      buildShell(b, g, look, L, false);
      // Skirting boards and a doormat inside the front door
      const { w, d } = L;
      const skirt = look.floor === 'marble' ? '#cfcac0' : '#5a3e2b';
      b.box(0, 0.07, -d / 2 + 0.03, w, 0.14, 0.04, skirt, { ao: false });
      for (const sx of [-1, 1]) {
        b.box(sx * (w / 2 - 0.03), 0.07, 0, 0.04, 0.14, d, skirt, { ao: false });
        b.box(sx * (w / 4 + 0.6), 0.07, d / 2 - 0.03, w / 2 - 1.2, 0.14, 0.04, skirt, { ao: false });
      }
      b.box(0, 0.012, d / 2 - 0.9, 1.4, 0.02, 0.8, '#6b4a2a', { ao: false, tex: 'concrete' });
    }
    // The built-in rooms: kitchen, dining, living room, stairs and the bedroom upstairs
    const glow = new VoxelBuilder();
    const inside = home ? buildHomeInterior(home.prop.houseId ?? home.prop.itemId, L, b, glow, g) : null;
    if (inside) {
      // Upstairs is built at floor level and lifted onto the mezzanine
      for (const geo of [inside.upper.solid, inside.upper.glow, inside.upper.glass]) geo.translate(0, STOREY, 0);
    }
    return { geo: b.build(), glass: g.build(), glow: glow.build(), upper: inside?.upper ?? null, colliders: inside?.colliders ?? [] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L, look?.wall, look?.floor, home?.prop.houseId, home?.prop.itemId]);

  // New scene, exit door and starting spot, once per visit
  useMemo(() => {
    rt.resetScene(`home:${propUid}`);
    rt.triggers.push({ id: 'exit', kind: 'exit', x: 0, z: L.d / 2 - 0.8, r: 1.8, label: 'Leave home', icon: '🚪' });
  }, [propUid, L]);
  // Colliders follow the furniture as you arrange it
  useMemo(() => {
    rt.collision = roomCollision(L, layout, itemsById, shell.colliders);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L, layoutKey, itemsById, shell]);

  useEffect(() => {
    if (!rt.restoreSpot()) rt.teleport(0, L.d / 2 - 3.2, Math.PI);
    rt.camYaw = 0;
    rt.camPitch = 0.5;
    rt.camDist = 4.2;
    const t = setTimeout(() => useUI.getState().setLoading({ active: false, progress: 1 }), 80);
    const here = useScene.getState().interior;
    return () => {
      clearTimeout(t);
      // Stop arranging only when you leave the home: a graphics quality change also rebuilds the
      // scene, and arranging should carry on through that
      if (useScene.getState().interior !== here) useUI.getState().setDecor(null);
    };
  }, [L]);

  // Arranging: a piece picked from storage starts in the middle of the free floor, and letting go
  // of a dragged piece anywhere (even over the panel) puts it down or sends it back
  const carrying = decor?.carrying ?? null;
  useEffect(() => {
    if (carrying && !planner.dragging) {
      planner.x = 0;
      planner.z = snap(L.d * 0.1);
      planner.offX = 0;
      planner.offZ = 0;
    }
  }, [carrying, L.d]);
  useEffect(() => {
    if (!decor) {
      planner.dragging = false;
      document.body.style.cursor = '';
      return;
    }
    const up = () => planner.dragging && finishPlacing();
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, [decor]);

  useFrame(() => {
    worldUniforms.uGrime.value = 0.2;
    worldUniforms.uWet.value = 0;
    worldUniforms.uSnow.value = 0;
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6 || useUI.getState().decor) return;
    e.stopPropagation();
    walkTo(e.point.x, e.point.z);
  };

  if (!home) return null;
  return (
    <group>
      <mesh geometry={shell.geo} material={M.vc} onClick={onClick} receiveShadow />
      <mesh geometry={shell.glass} material={GLASS_MAT} renderOrder={2} />
      <mesh geometry={shell.glow} material={M.neon} />
      {shell.upper && !decor && (
        <>
          <mesh geometry={shell.upper.solid} material={M.vc} onClick={onClick} castShadow receiveShadow />
          <mesh geometry={shell.upper.glow} material={M.neon} />
          <mesh geometry={shell.upper.glass} material={GLASS_MAT} renderOrder={2} />
        </>
      )}
      {/* Light upstairs, in the tall living room and under the mezzanine */}
      {[-L.w / 4, L.w / 4].map((x) => (
        <pointLight key={x} position={[x, L.h - 0.8, 0]} intensity={8} distance={L.w} color="#ffe9c4" decay={1.4} />
      ))}
      {[-L.w / 4, L.w / 4].map((x) => (
        <pointLight key={`u${x}`} position={[x, STOREY - 0.6, -L.d / 4]} intensity={5} distance={L.w * 0.7} color="#ffe9c4" decay={1.4} />
      ))}
      {layout.map((f) =>
        f.item === decor?.carrying ? null : (
          <Piece
            key={f.item}
            itemId={itemsById.get(f.item) ?? ''}
            x={f.x}
            z={f.z}
            rot={f.rot}
            onGrab={
              decor && !decor.carrying
                ? (e) => {
                    // Press on a piece and drag it somewhere else
                    e.stopPropagation();
                    planner.dragging = true;
                    planner.x = snap(e.point.x);
                    planner.z = snap(e.point.z);
                    planner.offX = f.x - planner.x;
                    planner.offZ = f.z - planner.z;
                    playSfx('pop');
                    useUI.getState().setDecor({ ...decor, carrying: f.item, rot: f.rot });
                  }
                : undefined
            }
          />
        ),
      )}
      {decor && decor.home === propUid && (
        // An invisible floor that follows the pointer while arranging
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.03, 0]}
          onPointerMove={(e) => {
            planner.x = snap(e.point.x);
            planner.z = snap(e.point.z);
          }}
          onPointerUp={(e) => {
            if (!useUI.getState().decor?.carrying) return;
            e.stopPropagation();
            planner.x = snap(e.point.x);
            planner.z = snap(e.point.z);
            finishPlacing();
          }}
        >
          <planeGeometry args={[L.w, L.d]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      {hasFish && <FishBowl x={L.w / 2 - 0.6} z={-L.d / 2 + 0.6} />}
      {decor?.carrying && decor.home === propUid && <Ghost itemId={itemsById.get(decor.carrying) ?? ''} home={home} layout={layout} itemsById={itemsById} />}
    </group>
  );
}

function Piece({ itemId, x, z, rot, onGrab }: { itemId: string; x: number; z: number; rot: number; onGrab?: (e: ThreeEvent<PointerEvent>) => void }) {
  const geo = useMemo(() => furnitureGeometry(itemId), [itemId]);
  return (
    <group
      position={[x, 0, z]}
      rotation={[0, rot, 0]}
      onPointerDown={onGrab}
      onPointerOver={onGrab ? () => (document.body.style.cursor = 'grab') : undefined}
      onPointerOut={onGrab ? () => (document.body.style.cursor = '') : undefined}
    >
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
  useFrame(() => {
    const d = useUI.getState().decor;
    if (!g.current || !d) return;
    // Follows the pointer over the floor (keeping where you grabbed it)
    const x = snap(planner.x + planner.offX);
    const z = snap(planner.z + planner.offZ);
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
