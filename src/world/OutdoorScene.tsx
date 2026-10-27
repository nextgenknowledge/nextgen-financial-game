'use client';
import { useEffect, useMemo, useRef } from 'react';
import { walkTo } from '@/engine/walk';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { CityDef } from '@/game/content';
import type { AvatarConfig, Difficulty } from '@/game/types';
import { getCityBuild } from './builders/sceneBuilder';
import { M, updateNightMaterials } from './materials';
import { Signs, StreetLamps, Trees, Water, Clouds, Birds } from './Props';
import { Crowd, Boats } from './Life';
import { Traffic, TrafficSignals, ParkedCars, Tickers } from './Street';
import { DynamicLandmark } from './Landmarks';
import { Portal } from './Portals';
import { Avatar } from './Avatar';
import { rt } from '@/engine/runtime';
import { useScene } from '@/store/scene';
import { useSettings } from '@/store/settings';
import { useUI } from '@/store/ui';
import { CITY_META } from './cities';
import npcs from '@/data/npcs.json';
import { ParkedVehicles } from './ParkedVehicles';
import { CondoEntrances } from './CondoEntrance';
import { Weather } from './Weather';
import { Sites, Steam, Pigeons, Flags } from './Ambient';
import { worldUniforms } from '@/engine/atlas';

export function OutdoorScene({ def, difficulty }: { def: CityDef; difficulty: Difficulty }) {
  const quality = useSettings((s) => s.quality);
  const build = useMemo(() => getCityBuild(def, difficulty), [def, difficulty]);

  // Register colliders/triggers synchronously during render so children (landmarks) can add theirs after.
  useMemo(() => {
    rt.resetScene(def.id);
    const c = rt.collision;
    c.bounds = { minX: -def.half - 20, maxX: def.half + 20, minZ: -def.half - 20, maxZ: def.half + 20 };
    for (const k of build.colliders) c.addBox(k.cx, k.cz, k.w, k.d, k.minY, k.maxY, undefined, k.rotY);
    for (const k of build.lowColliders) c.addBox(k.cx, k.cz, k.w, k.d, -1, k.maxY);
    c.water = build.water;
    rt.triggers.push(...build.triggers);
    rt.garage = build.garage;
    rt.dock = build.dock;
  }, [build, def]);

  // Place the player
  useEffect(() => {
    const sp = useScene.getState().spawn ?? build.spawn;
    rt.teleport(sp.x, sp.z, sp.rot);
    // Finish loading after the first frame renders
    const t = setTimeout(() => useUI.getState().setLoading({ active: false, progress: 1 }), 120);
    return () => clearTimeout(t);
  }, [build]);

  useFrame(() => {
    updateNightMaterials(rt.dayLight);
    worldUniforms.uGrime.value = quality === 'low' ? 0 : 1;
    // Gusty in storms, a light breeze otherwise
    worldUniforms.uWind.value = 1 + (rt.weather === 'rain' || rt.weather === 'snow' ? rt.weatherAmt * 1.6 : 0);
  });

  // Pigeons gather on plazas and a few busy pavement corners
  const pigeonSpots = useMemo(() => {
    const spots: [number, number][] = build.map.plazas.map((p) => [p.x + p.r * 0.4, p.z - p.r * 0.3] as [number, number]);
    build.npcLoops.forEach((loop, i) => {
      if (i % 3 === 0 && loop.length) {
        const a = loop[i % loop.length];
        const b = loop[(i + 1) % loop.length];
        spots.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
      }
    });
    return spots.slice(0, quality === 'low' ? 3 : 8);
  }, [build, quality]);

  const onGroundClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6 || rt.vehicle) return;
    e.stopPropagation();
    walkTo(e.point.x, e.point.z);
  };

  const crowdScale = quality === 'low' ? 0.4 : quality === 'medium' ? 0.7 : 1;
  const host = npcs.looks[def.host.look as keyof typeof npcs.looks] as unknown as AvatarConfig;

  return (
    <group>
      <mesh geometry={build.ground} material={M.ground} receiveShadow onClick={onGroundClick} />
      <mesh geometry={build.solid} material={M.vc} castShadow receiveShadow onClick={onGroundClick} />
      <mesh geometry={build.lit} material={M.lit} />
      <mesh geometry={build.dark} material={M.dark} />
      <mesh geometry={build.neon} material={M.neon} />
      <Signs signs={build.signs} city={def.id} />
      <StreetLamps lamps={build.streetLamps} extraGlows={build.lampGlows} city={def.id} />
      <Trees trees={build.trees} city={def.id} />
      <Water rects={build.water} />
      {build.dynamic.map((d, i) => (
        <DynamicLandmark key={`${d.type}-${i}`} d={d} />
      ))}
      {build.portals.map((p) => (
        <Portal key={p.to} {...p} />
      ))}
      <HostNPC look={host} x={def.host.pos[0]} z={def.host.pos[1]} />
      <Crowd loops={build.npcLoops} count={Math.round(def.npcs * crowdScale)} seed={def.filler.seed} />
      <Traffic loops={build.trafficLoops} count={Math.round(def.traffic * crowdScale)} colors={CITY_META[def.id].traffic} cityId={def.id} />
      <TrafficSignals heads={build.signals} />
      <ParkedCars cars={build.parked} />
      <Tickers tickers={build.tickers} />
      <Boats loops={build.boatLoops} count={def.boats} junk={def.id === 'hong-kong'} />
      <ParkedVehicles />
      <CondoEntrances city={def.id} footprints={build.map.footprints} spawn={build.spawn} />
      {quality !== 'low' && <Clouds count={quality === 'high' ? 16 : 10} spread={def.half + 60} />}
      <Birds count={quality === 'low' ? 4 : 10} />
      <Weather cityId={def.id} />
      <Sites sites={build.sites} />
      <Steam vents={build.vents} />
      <Flags flags={build.flags} />
      <Pigeons spots={pigeonSpots} seed={def.filler.seed} />
    </group>
  );
}

function HostNPC({ look, x, z }: { look: AvatarConfig; x: number; z: number }) {
  const g = useRef<THREE.Group>(null);
  const anim = useRef({ speed: 0, grounded: true, wave: 0 });
  useFrame(() => {
    if (!g.current) return;
    const d = Math.hypot(rt.player.x - x, rt.player.z - z);
    if (d < 9) g.current.rotation.y = Math.atan2(rt.player.x - x, rt.player.z - z);
    anim.current.wave = d < 6 ? 1 : 0;
  });
  useMemo(() => rt.collision.addBox(x, z, 0.8, 0.8, 0, 2), [x, z]);
  return (
    <group ref={g} position={[x, 0, z]}>
      <Avatar config={look} anim={anim} />
      <mesh position={[0, 2.65, 0]}>
        <octahedronGeometry args={[0.22, 0]} />
        <meshBasicMaterial color="#ffcf3f" toneMapped={false} />
      </mesh>
    </group>
  );
}
