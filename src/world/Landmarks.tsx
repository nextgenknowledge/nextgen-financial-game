'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VoxelBuilder, cylinder, sphere, trs } from '@/engine/voxel';
import { signMaterial } from './signage';
import { M } from './materials';
import { NarwhalModel } from './Narwhal';
import { useGame } from '@/store/game';
import { rt } from '@/engine/runtime';
import property from '@/data/shop/property.json';
import community from '@/data/community.json';

type Dyn = { type: string; x: number; z: number; rot: number; scale: number; label?: string };

function useMerged(build: (b: VoxelBuilder) => void, deps: unknown[] = []) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => {
    const b = new VoxelBuilder();
    build(b);
    return b.build();
  }, deps);
}

export function DynamicLandmark({ d }: { d: Dyn }) {
  const funded = useGame((s) => {
    const proj = community.projects.find((p) => p.landmark === d.type);
    if (!proj) return true;
    return (s.world?.progress.community[proj.id] ?? 0) >= proj.cost;
  });
  const proj = community.projects.find((p) => p.landmark === d.type);
  if (!funded && proj) return <ConstructionSite d={d} name={proj.name} />;
  switch (d.type) {
    case 'fountain':
      return <Fountain d={d} />;
    case 'narwhal-statue':
      return (
        <group position={[d.x, 0, d.z]} rotation={[0, d.rot, 0]}>
          <mesh position={[0, 0.9, 0]}>
            <boxGeometry args={[3.2, 1.8, 3.2]} />
            <meshLambertMaterial color="#d9cdb4" />
          </mesh>
          <mesh position={[0, 1.85, 0]}>
            <boxGeometry args={[3.5, 0.2, 3.5]} />
            <meshLambertMaterial color="#c9b48a" />
          </mesh>
          <group position={[0, 1.95, 0]} scale={2}>
            <NarwhalModel mood="confident" flap={false} />
          </group>
        </group>
      );
    case 'ferris-wheel':
    case 'big-wheel':
      return <Wheel d={d} big={d.type === 'big-wheel'} />;
    case 'bandstand':
      return <Bandstand d={d} />;
    case 'playground':
      return <Playground d={d} />;
    case 'garden':
      return <Garden d={d} />;
    case 'supertrees':
      return <Supertrees d={d} />;
    case 'cable-car':
      return <CableCar d={d} />;
    case 'hall-of-fame-board':
      return <Board d={d} title="Hall of Fame" />;
    case 'job-board':
      return <Board d={d} title={d.label ?? 'Odd Jobs'} />;
    case 'neighborhood':
      return <Neighborhood d={d} />;
    case 'lionfish-fountain':
      return <LionfishFountain d={d} />;
    default:
      return null;
  }
}

function ConstructionSite({ d, name }: { d: Dyn; name: string }) {
  const geo = useMerged((b) => {
    b.block(0, 0, 0, 12, 0.15, 12, '#c9b48a');
    for (const [x, z] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) b.block(x, 0, z, 0.3, 1.2, 0.3, '#ff8a3d');
    b.block(0, 1.0, 6, 12, 0.18, 0.1, '#ffcf3f');
    b.block(0, 1.0, -6, 12, 0.18, 0.1, '#ffcf3f');
    b.block(6, 1.0, 0, 0.1, 0.18, 12, '#ffcf3f');
    b.block(-6, 1.0, 0, 0.1, 0.18, 12, '#ffcf3f');
    b.block(-2, 0, 1, 1.4, 1.4, 1.4, '#a8774a');
    b.block(2, 0, -1, 2.4, 0.4, 1.2, '#8a8f9c');
    b.block(0, 0, -5.8, 0.2, 2.4, 0.2, '#5a4a3a');
  });
  const sign = useMemo(() => signMaterial({ kind: 'hoarding', text: name, sub: 'Community project · help fund it at Town Hall', w: 7, h: 1.6 }), [name]);
  // The site is taped off: the tape line, its posts, the crate and the slab are solid
  useMemo(() => {
    for (const [dx, dz, w, dd] of [[0, 6, 12.3, 0.3], [0, -6, 12.3, 0.3], [6, 0, 0.3, 12.3], [-6, 0, 0.3, 12.3]] as const) rt.collision.addBox(d.x + dx, d.z + dz, w, dd, 0, 1.3, 'site');
  }, [d.x, d.z]);
  return (
    <group position={[d.x, 0, d.z]}>
      <mesh geometry={geo} material={M.vc} />
      <mesh position={[0, 1.7, -5.75]} material={sign}>
        <planeGeometry args={[7, 1.6]} />
      </mesh>
    </group>
  );
}

function Fountain({ d }: { d: Dyn }) {
  const geo = useMerged((b) => {
    b.geom(cylinder(6, 6.4, 0.9, 24), trs(0, 0.45, 0), '#d9cdb4');
    b.geom(cylinder(5.4, 5.4, 0.2, 24), trs(0, 0.82, 0), '#4da3e0');
    b.geom(cylinder(0.8, 1.0, 2.6, 12), trs(0, 1.6, 0), '#e8dcc4');
    b.geom(cylinder(2.4, 1.6, 0.5, 16), trs(0, 2.9, 0), '#d9cdb4');
    b.geom(cylinder(2.1, 2.1, 0.12, 16), trs(0, 3.12, 0), '#6ab8ee');
    b.geom(cylinder(0.35, 0.45, 1.2, 10), trs(0, 3.6, 0), '#e8dcc4');
    b.geom(sphere(0.55, 10, 8), trs(0, 4.4, 0), '#ffcf3f');
  });
  const drops = useRef<THREE.InstancedMesh>(null);
  const N = 48;
  const data = useMemo(() => Array.from({ length: N }, (_, i) => ({ a: (i / N) * Math.PI * 2, t: Math.random() })), []);
  useFrame((_, dt) => {
    const m = drops.current;
    if (!m) return;
    data.forEach((p, i) => {
      p.t = (p.t + dt * 0.7) % 1;
      const r = 0.4 + p.t * 2.2;
      const y = 4.4 + p.t * 1.6 - p.t * p.t * 3.6;
      m.setMatrixAt(i, trs(Math.cos(p.a) * r, y, Math.sin(p.a) * r, 0, 0, 0, 1, 1, 1));
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <group position={[d.x, 0, d.z]}>
      <mesh geometry={geo} material={M.vc} castShadow />
      <instancedMesh ref={drops} args={[new THREE.BoxGeometry(0.14, 0.22, 0.14), new THREE.MeshBasicMaterial({ color: '#bfe6ff', transparent: true, opacity: 0.85 }), N]} frustumCulled={false} />
      <FountainCollider x={d.x} z={d.z} />
    </group>
  );
}

function FountainCollider({ x, z }: { x: number; z: number }) {
  useMemo(() => {
    // The round basin (radius 6.4, rim 0.9 high) as three overlapping boxes, so there are no
    // invisible corners outside it and the rim is exactly where it looks
    rt.collision.addBox(x, z, 12.8, 5, 0, 0.9, 'fountain');
    rt.collision.addBox(x, z, 5, 12.8, 0, 0.9, 'fountain');
    rt.collision.addBox(x, z, 9.6, 9.6, 0, 0.9, 'fountain');
    // The centre column and its bowl: solid all the way up, so nobody ends up inside them
    rt.collision.addBox(x, z, 4.8, 4.8, 0, 5, 'fountain');
  }, [x, z]);
  return null;
}

function Wheel({ d, big }: { d: Dyn; big: boolean }) {
  const R = big ? 18 : 11;
  const wheel = useRef<THREE.Group>(null);
  const frame = useMerged((b) => {
    for (const side of [-1, 1]) {
      b.box(side * 2.5, R / 2 + 1, 0, 0.6, R + 3, 0.6, '#f4f6fa', { rotY: 0 });
      b.box(side * 2.5, R / 2 + 1, -R * 0.3, 0.5, R + 3, 0.5, '#f4f6fa');
    }
    b.block(0, 0, 0, 7, 0.6, 5, '#c9c2b0');
  }, [R]);
  const spokes = useMerged((b) => {
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      b.geom(new THREE.BoxGeometry(0.2, R, 0.2), trs(0, 0, 0, 0, 0, a + Math.PI / 2, 1, 1, 1).multiply(new THREE.Matrix4().makeTranslation(0, R / 2, 0)), '#f4f6fa');
      b.geom(new THREE.BoxGeometry(0.35, (2 * Math.PI * R) / n + 0.2, 0.35), trs(Math.cos(a) * R, Math.sin(a) * R, 0, 0, 0, a), big ? '#9fd3f0' : '#e1553f');
    }
  }, [R]);
  const cabins = useRef<THREE.Group>(null);
  const n = big ? 16 : 10;
  const colors = ['#e1553f', '#ffcf3f', '#2ebaba', '#2f6bdb', '#3cc45a', '#f06aa8'];
  useFrame((_, dt) => {
    if (wheel.current) wheel.current.rotation.z += dt * 0.08;
    if (cabins.current && wheel.current) {
      const rot = wheel.current.rotation.z;
      cabins.current.children.forEach((c, i) => {
        const a = (i / n) * Math.PI * 2 + rot;
        c.position.set(Math.cos(a) * R, R + 3 + Math.sin(a) * R - 1.2, 0);
      });
    }
  });
  return (
    <group position={[d.x, 0, d.z]} rotation={[0, d.rot, 0]}>
      <mesh geometry={frame} material={M.vc} />
      <group ref={wheel} position={[0, R + 3, 0]}>
        <mesh geometry={spokes} material={M.vc} />
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[1, 1, 1.4, 12]} />
          <meshLambertMaterial color="#c0c4cc" />
        </mesh>
      </group>
      <group ref={cabins}>
        {Array.from({ length: n }, (_, i) => (
          <mesh key={i}>
            <boxGeometry args={big ? [2.6, 1.6, 2] : [1.4, 1.4, 1.4]} />
            <meshLambertMaterial color={big ? '#dff4ff' : colors[i % colors.length]} />
          </mesh>
        ))}
      </group>
      <WheelCollider x={d.x} z={d.z} />
    </group>
  );
}

function WheelCollider({ x, z }: { x: number; z: number }) {
  useMemo(() => rt.collision.addBox(x, z, 7, 5, 0, 30, 'wheel'), [x, z]);
  return null;
}

function Bandstand({ d }: { d: Dyn }) {
  const geo = useMerged((b) => {
    b.geom(cylinder(6, 6, 0.8, 8), trs(0, 0.4, 0), '#e8dcc4');
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      b.geom(cylinder(0.2, 0.2, 4, 6), trs(Math.cos(a) * 5.4, 2.8, Math.sin(a) * 5.4), '#ffffff');
    }
    b.geom(new THREE.ConeGeometry(6.8, 2.6, 8), trs(0, 6.1, 0), '#2ebaba');
    b.geom(sphere(0.4), trs(0, 7.6, 0), '#ffcf3f');
    // Instruments
    b.block(-1.5, 0.8, 0, 1.2, 0.9, 0.8, '#1e2840');
    b.geom(cylinder(0.5, 0.5, 0.6, 10), trs(1.5, 1.1, 0.5), '#e1553f');
  });
  useMemo(() => rt.collision.addBox(d.x, d.z, 12, 12, 0, 0.8, 'bandstand'), [d.x, d.z]);
  return <mesh geometry={geo} material={M.vc} position={[d.x, 0, d.z]} castShadow />;
}

function Playground({ d }: { d: Dyn }) {
  const geo = useMerged((b) => {
    b.block(0, 0, 0, 22, 0.1, 18, '#e8c88a');
    // Slide tower
    b.block(-5, 0, 0, 3, 3, 3, '#e1553f');
    b.block(-5, 3, 0, 3.4, 0.3, 3.4, '#ffcf3f');
    b.geom(new THREE.ConeGeometry(2.4, 1.6, 4), trs(-5, 4.2, 0, 0, Math.PI / 4), '#2f6bdb');
    b.box(-1.6, 1.6, 0, 4.5, 0.25, 1.4, '#3cc45a', { rotY: 0 });
    // Swings
    b.block(5, 0, -3, 0.3, 4, 0.3, '#8a5cf6');
    b.block(5, 0, 3, 0.3, 4, 0.3, '#8a5cf6');
    b.block(5, 4, 0, 0.3, 0.3, 6.6, '#8a5cf6');
    for (const z of [-1.4, 1.4]) {
      b.block(5, 1.2, z, 0.06, 2.8, 0.06, '#3a3f4a');
      b.block(5, 1.0, z, 0.8, 0.12, 0.6, '#ffcf3f');
    }
    // Seesaw
    b.block(0, 0, 6, 0.6, 0.6, 0.6, '#3a3f4a');
    b.box(0, 0.75, 6, 6, 0.2, 0.6, '#2ebaba', { rotY: 0 });
  });
  useMemo(() => {
    rt.collision.addBox(d.x - 5, d.z, 3, 3, 0, 3, 'slide');
  }, [d.x, d.z]);
  return <mesh geometry={geo} material={M.vc} position={[d.x, 0, d.z]} rotation={[0, d.rot, 0]} castShadow />;
}

function Garden({ d }: { d: Dyn }) {
  const geo = useMerged((b) => {
    const cols = ['#f06aa8', '#ffcf3f', '#e1553f', '#8a5cf6', '#ffffff', '#ff8a3d'];
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 5; c++) {
        const x = -8 + c * 4;
        const z = -6 + r * 4;
        b.block(x, 0, z, 3, 0.4, 2.6, '#7a5a3a');
        for (let k = 0; k < 4; k++) b.block(x - 1 + (k % 2) * 2, 0.4, z - 0.6 + Math.floor(k / 2) * 1.2, 0.45, 0.6, 0.45, cols[(r * 5 + c + k) % cols.length]);
      }
    b.block(0, 0, 9, 4, 3, 0.3, '#8a6a42');
    b.geom(new THREE.TorusGeometry(2, 0.25, 6, 12, Math.PI), trs(0, 3, 9), '#3cc45a');
  });
  // Raised beds and the arch's trellis are solid; the paths between the beds stay open
  useMemo(() => {
    const c = Math.cos(d.rot);
    const sn = Math.sin(d.rot);
    const at = (lx: number, lz: number, w: number, dd: number, h: number) => rt.collision.addBox(d.x + lx * c + lz * sn, d.z - lx * sn + lz * c, w, dd, 0, h, 'garden', d.rot);
    for (let r = 0; r < 4; r++) for (let col = 0; col < 5; col++) at(-8 + col * 4, -6 + r * 4, 3, 2.6, 1);
    at(-1.9, 9, 0.3, 0.4, 3);
    at(1.9, 9, 0.3, 0.4, 3);
  }, [d.x, d.z, d.rot]);
  return <mesh geometry={geo} material={M.vc} position={[d.x, 0, d.z]} rotation={[0, d.rot, 0]} />;
}

const SUPERTREE_SPOTS: [number, number, number][] = [[0, 0, 24], [-9, 4, 17], [9, -3, 19], [-4, -10, 15], [6, 10, 16], [12, 6, 13]];

function Supertrees({ d }: { d: Dyn }) {
  const geo = useMerged((b) => {
    let seed = 5;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const [x, z, h] of SUPERTREE_SPOTS) {
      // Steel core, slightly tapered, on a planted base
      b.geom(cylinder(0.75, 1.5, h - 5, 10), trs(x, (h - 5) / 2, z), '#3b3f45', 'metal');
      b.geom(cylinder(2.2, 2.4, 0.6, 12), trs(x, 0.3, z), '#a9a39a', 'concrete');
      // Vertical garden: clumps of ferns and flowering plants spiralling up the trunk
      const n = Math.round(h * 3.2);
      for (let k = 0; k < n; k++) {
        const t = k / n;
        const y = 0.8 + t * (h - 6);
        const r = 1.45 - t * 0.6;
        const a = k * 2.4;
        const flower = rnd() < 0.18;
        b.geom(sphere(0.38 + rnd() * 0.25, 6, 4), trs(x + Math.cos(a) * r, y, z + Math.sin(a) * r), flower ? (rnd() < 0.5 ? '#c9578f' : '#e0a33a') : rnd() < 0.5 ? '#3f6e34' : '#4f7f3c', 'leaves');
      }
      // Flared steel lattice crown: ribs from the trunk top out to the canopy ring
      const ribs = 14;
      for (let k = 0; k < ribs; k++) {
        const a = (k / ribs) * Math.PI * 2;
        const r0 = 0.8;
        const r1 = 4.6;
        const y0 = h - 5.5;
        const y1 = h;
        const mx = x + Math.cos(a) * (r0 + r1) / 2;
        const mz = z + Math.sin(a) * (r0 + r1) / 2;
        const len = Math.hypot(r1 - r0, y1 - y0);
        const g = new THREE.BoxGeometry(0.16, len, 0.16);
        const m = new THREE.Matrix4().compose(
          new THREE.Vector3(mx, (y0 + y1) / 2, mz),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a, -Math.atan2(r1 - r0, y1 - y0), 'YXZ')),
          new THREE.Vector3(1, 1, 1),
        );
        b.geom(g, m, '#4a4f57');
      }
      for (const [rr, yy] of [[4.6, h], [3.1, h - 2], [1.9, h - 4]] as const) b.geom(new THREE.TorusGeometry(rr, 0.1, 4, 24), trs(x, yy, z, Math.PI / 2), '#4a4f57');
    }
    // Skywalk between the two tallest trees
    const [ax, az] = [SUPERTREE_SPOTS[0][0], SUPERTREE_SPOTS[0][1]];
    const [bx, bz] = [SUPERTREE_SPOTS[2][0], SUPERTREE_SPOTS[2][1]];
    const len = Math.hypot(bx - ax, bz - az);
    const rot = Math.atan2(bx - ax, bz - az);
    b.box((ax + bx) / 2, 13, (az + bz) / 2, 1.6, 0.25, len, '#d9dde3', { rotY: rot, tex: 'metal' });
    for (const side of [-0.75, 0.75]) b.box((ax + bx) / 2 + Math.cos(rot) * side, 13.6, (az + bz) / 2 - Math.sin(rot) * side, 0.06, 1.0, len, '#8d939c', { rotY: rot });
  });
  const glow = useMerged((b) => {
    for (const [x, z, h] of SUPERTREE_SPOTS)
      for (let k = 0; k < 18; k++) {
        const a = (k / 18) * Math.PI * 2;
        b.geom(sphere(0.14, 5, 4), trs(x + Math.cos(a) * 4.6, h + 0.05, z + Math.sin(a) * 4.6), '#ffffff');
        if (k % 2 === 0) b.geom(sphere(0.11, 5, 4), trs(x + Math.cos(a) * 3.1, h - 2, z + Math.sin(a) * 3.1), '#ffffff');
      }
  });
  const glowMat = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), []);
  useFrame((state) => {
    const night = Math.max(0, 0.8 - rt.dayLight) / 0.8;
    glowMat.color.setHSL((state.clock.elapsedTime * 0.04) % 1, 0.7, 0.25 + night * 0.45);
  });
  useMemo(() => {
    for (const [x, z] of SUPERTREE_SPOTS) rt.collision.addBox(d.x + x, d.z + z, 3, 3, 0, 20);
  }, [d.x, d.z]);
  return (
    <group position={[d.x, 0, d.z]}>
      <mesh geometry={geo} material={M.vc} castShadow />
      <mesh geometry={glow} material={glowMat} />
    </group>
  );
}

function CableCar({ d }: { d: Dyn }) {
  const car = useRef<THREE.Group>(null);
  const len = 120 * d.scale;
  const geo = useMerged((b) => {
    b.block(0, 0.4, 0, 2.4, 2.6, 6, '#c9302a');
    b.block(0, 0.6, 0, 2.5, 0.9, 6.1, '#f4e6c8');
    for (let z = -2.4; z <= 2.4; z += 1.2) {
      b.block(1.26, 1.7, z, 0.05, 0.9, 0.9, '#8fb8dc');
      b.block(-1.26, 1.7, z, 0.05, 0.9, 0.9, '#8fb8dc');
    }
    b.block(0, 3.0, 0, 2.7, 0.3, 6.4, '#5a4a3a');
    b.block(0, 0, 2.6, 2, 0.4, 0.8, '#2a2f3d');
    b.block(0, 0, -2.6, 2, 0.4, 0.8, '#2a2f3d');
  });
  useFrame((state) => {
    if (!car.current) return;
    const t = (Math.sin(state.clock.elapsedTime * 0.06) * 0.5 + 0.5) * len - len / 2;
    car.current.position.set(0, 0, t);
  });
  return (
    <group position={[d.x, 0, d.z]} rotation={[0, d.rot, 0]}>
      <group ref={car}>
        <mesh geometry={geo} material={M.vc} castShadow />
      </group>
    </group>
  );
}

function Board({ d, title }: { d: Dyn; title: string }) {
  const header = useMemo(() => signMaterial({ kind: 'notice', text: title, w: 3.8, h: 0.8 }), [title]);
  const geo = useMerged((b) => {
    b.block(-1.6, 0, 0, 0.3, 3.4, 0.3, '#6b4a2a');
    b.block(1.6, 0, 0, 0.3, 3.4, 0.3, '#6b4a2a');
    b.block(0, 1.4, 0, 3.6, 2.2, 0.25, '#a8774a');
    for (const [x, y, c] of [[-0.9, 2.6, '#fff4cf'], [0.2, 2.2, '#e3f7f7'], [1.0, 2.8, '#fde4ef'], [-0.4, 1.8, '#fff4cf']] as const) b.block(x, y - 0.6, 0.14, 0.8, 0.9, 0.04, c);
  });
  useMemo(() => rt.collision.addBox(d.x, d.z, 3.8, 0.5, 0, 3.4, 'board', d.rot), [d.x, d.z, d.rot]);
  return (
    <group position={[d.x, 0, d.z]} rotation={[0, d.rot, 0]}>
      <mesh geometry={geo} material={M.vc} />
      <mesh position={[0, 3.95, 0]}>
        <boxGeometry args={[4.0, 0.95, 0.2]} />
        <meshLambertMaterial color="#3a281c" />
      </mesh>
      <mesh position={[0, 3.95, 0.105]} material={header}>
        <planeGeometry args={[3.8, 0.8]} />
      </mesh>
    </group>
  );
}

function LionfishFountain({ d }: { d: Dyn }) {
  const geo = useMerged((b) => {
    b.block(0, 0, 0, 6, 1.2, 6, '#d9cdb4');
    b.block(0, 1.2, 0, 2.4, 3.4, 2.4, '#f4f1ea');
    b.block(0, 4.6, 0.3, 2.8, 2.4, 2.6, '#f4f1ea');
    for (let k = 0; k < 5; k++) b.block((k - 2) * 0.55, 6.6, -0.2, 0.4, 0.9, 1.6, '#f4f1ea');
    b.block(0, 1.2, -1.6, 1.4, 1.6, 1.6, '#f4f1ea');
    b.block(0, 2.4, -2.6, 2.2, 0.3, 1.2, '#f4f1ea');
    b.block(0, 5.2, 1.65, 0.6, 0.4, 0.2, '#1e2840');
  });
  const stream = useRef<THREE.InstancedMesh>(null);
  const N = 30;
  useFrame((state) => {
    const m = stream.current;
    if (!m) return;
    for (let i = 0; i < N; i++) {
      const t = ((state.clock.elapsedTime * 0.8 + i / N) % 1);
      m.setMatrixAt(i, trs(0, 5.3 + t * 1.2 - t * t * 6.5, 1.8 + t * 5, 0, 0, 0, 1, 1, 1));
    }
    m.instanceMatrix.needsUpdate = true;
  });
  useMemo(() => rt.collision.addBox(d.x, d.z, 6, 6, 0, 7), [d.x, d.z]);
  return (
    <group position={[d.x, 0, d.z]} rotation={[0, d.rot, 0]}>
      <mesh geometry={geo} material={M.vc} castShadow />
      <instancedMesh ref={stream} args={[new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: '#bfe6ff', transparent: true, opacity: 0.8 }), N]} frustumCulled={false} />
    </group>
  );
}

/* ───────── Neighborhood: plots and the houses players build ───────── */

export function houseGeometry(houseId: string): THREE.BufferGeometry {
  const b = new VoxelBuilder();
  const roof = { 'tiny-house': '#d9653b', cottage: '#8a3f2e', 'family-home': '#2f6bdb', 'modern-villa': '#3a3f4a' }[houseId] ?? '#d9653b';
  const wall = { 'tiny-house': '#f6d6c2', cottage: '#f4e6c8', 'family-home': '#e9eef6', 'modern-villa': '#f4f6fa' }[houseId] ?? '#f4e6c8';
  const glass = '#8fb8dc';
  if (houseId === 'modern-villa') {
    b.block(0, 0, 0, 12, 3.4, 9, wall);
    b.block(1.5, 3.4, -0.5, 9, 3.2, 7, '#e3e7ee');
    b.block(0, 0.4, 4.52, 10, 2.4, 0.08, glass);
    b.block(1.5, 3.8, 3.02, 8, 2.4, 0.08, glass);
    b.block(1.5, 6.6, -0.5, 9.4, 0.3, 7.4, '#3a3f4a');
    b.block(-4.5, 3.4, 2, 3, 0.15, 5, '#a8774a');
    b.block(-6, 0, 6, 4, 0.2, 3, '#5ab0e8');
  } else {
    const [w, d, h] = houseId === 'tiny-house' ? [6, 5, 3.2] : houseId === 'cottage' ? [9, 7, 3.6] : [12, 9, 6.4];
    b.block(0, 0, 0, w, h, d, wall);
    for (let k = 0; k < 4; k++) b.block(0, h + k * 0.7, 0, w + 0.8 - (k * (w + 0.8)) / 4.2, 0.7, d + 0.8, k % 2 ? roof : '#' + new THREE.Color(roof).multiplyScalar(0.9).getHexString(), { topTint: 1.06 });
    b.block(0, 0, d / 2 + 0.05, 1.4, 2.3, 0.12, '#6b4a2a');
    for (const x of [-w / 3, w / 3]) {
      b.block(x, 1.2, d / 2 + 0.05, 1.4, 1.3, 0.1, glass);
      if (h > 4) b.block(x, 4.0, d / 2 + 0.05, 1.4, 1.3, 0.1, glass);
    }
    b.block(w / 2 - 1.2, h, -d / 4, 0.8, 2.2, 0.8, '#8a5a44');
    if (houseId === 'family-home') {
      b.block(w / 2 + 2.2, 0, 0, 4, 3, 6, wall);
      b.block(w / 2 + 2.2, 0, 3.05, 3.2, 2.4, 0.1, '#c0c4cc');
      b.block(w / 2 + 2.2, 3, 0, 4.4, 0.4, 6.4, roof);
    }
  }
  return b.build();
}

function Neighborhood({ d }: { d: Dyn }) {
  const props = useGame((s) => s.world?.assets.properties);
  const owned = useMemo(() => new Map((props ?? []).filter((p) => p.plotId).map((p) => [p.plotId!, p])), [props]);
  const base = useMerged((b) => {
    // Street through the middle
    b.block(0, 0, 0, 8, 0.06, 84, '#5d6473');
    for (const pl of property.plots) {
      const [x, z] = pl.pos;
      b.block(x, 0, z, 16, 0.08, 16, '#8fd06a');
      // Fence
      b.block(x, 0, z - 8, 16, 0.7, 0.15, '#f4f1ea');
      b.block(x + (x > 0 ? 8 : -8), 0, z, 0.15, 0.7, 16, '#f4f1ea');
      b.block(x, 0, z + 8, 16, 0.7, 0.15, '#f4f1ea');
      // Mailbox
      b.block(x + (x > 0 ? -7 : 7), 0, z + 2, 0.15, 1.1, 0.15, '#3a3f4a');
      b.block(x + (x > 0 ? -7 : 7), 1.1, z + 2, 0.5, 0.4, 0.7, '#2f6bdb');
    }
  });
  const forSale = useMemo(() => signMaterial({ kind: 'realty', text: 'For Sale', sub: 'Fin City Realty', w: 2.4, h: 1.1 }), []);
  const soldTex = useMemo(() => signMaterial({ kind: 'realty', text: 'Sold', sub: 'Your property', bg: '#2f6b3a', w: 2.4, h: 1.1 }), []);
  useMemo(() => {
    // Picket fences (three sides, open to the street) and mailboxes are solid
    for (const pl of property.plots) {
      const [x, z] = pl.pos;
      const cx = d.x + x;
      const cz = d.z + z;
      rt.collision.addBox(cx, cz - 8, 16, 0.3, 0, 0.7, 'fence');
      rt.collision.addBox(cx, cz + 8, 16, 0.3, 0, 0.7, 'fence');
      rt.collision.addBox(cx + (x > 0 ? 8 : -8), cz, 0.3, 16, 0, 0.7, 'fence');
      rt.collision.addBox(cx + (x > 0 ? -7 : 7), cz + 2, 0.6, 0.8, 0, 1.5, 'mailbox');
    }
  }, [d.x, d.z]);
  useMemo(() => {
    for (const pl of property.plots) {
      const [x, z] = pl.pos;
      const id = `plot:${pl.id}`;
      if (!rt.triggers.some((t) => t.id === id)) {
        rt.triggers.push({ id, kind: 'plot', x: d.x + x + (x > 0 ? -6 : 6), z: d.z + z, r: 3, label: pl.name, icon: '🏡', data: { plot: pl.id } });
      }
    }
  }, [d.x, d.z]);
  return (
    <group position={[d.x, 0, d.z]}>
      <mesh geometry={base} material={M.vc} />
      {property.plots.map((pl) => {
        const [x, z] = pl.pos;
        const own = owned.get(pl.id);
        return (
          <group key={pl.id} position={[x, 0, z]}>
            {own?.houseId ? (
              <HouseOnPlot houseId={own.houseId} propUid={own.uid} rented={own.rented} rot={x > 0 ? -Math.PI / 2 : Math.PI / 2} cx={d.x + x} cz={d.z + z} />
            ) : (
              <group position={[x > 0 ? -6 : 6, 0, -3]} rotation={[0, x > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}>
                <mesh position={[0, 0.8, 0]}>
                  <boxGeometry args={[0.15, 1.6, 0.15]} />
                  <meshLambertMaterial color="#6b4a2a" />
                </mesh>
                <mesh position={[0, 2.05, 0.1]} material={own ? soldTex : forSale}>
                  <planeGeometry args={[2.4, 1.1]} />
                </mesh>
              </group>
            )}
          </group>
        );
      })}
    </group>
  );
}

/** Depth of each house from its centre to the front door (see houseGeometry). */
const HOUSE_FRONT: Record<string, number> = { 'tiny-house': 2.5, cottage: 3.5, 'family-home': 4.5, 'modern-villa': 4.5 };

function HouseOnPlot({ houseId, propUid, rented, rot, cx, cz }: { houseId: string; propUid: string; rented: boolean; rot: number; cx: number; cz: number }) {
  const geo = useMemo(() => houseGeometry(houseId), [houseId]);
  useMemo(() => {
    const size = houseId === 'tiny-house' ? 6 : houseId === 'cottage' ? 9 : 12;
    rt.collision.addBox(cx, cz, size * 0.75, size, 0, 8, 'house');
  }, [houseId, cx, cz]);
  // Front door: the house faces the street, so the step is out along the rotated +z
  useEffect(() => {
    const id = `home:${propUid}`;
    const out = (HOUSE_FRONT[houseId] ?? 3.5) + 0.9;
    rt.triggers = rt.triggers.filter((t) => t.id !== id);
    rt.triggers.push({ id, kind: 'door', x: cx + Math.sin(rot) * out, z: cz + Math.cos(rot) * out, r: 2, label: rented ? 'Rented to tenants' : 'Go home', icon: '🏠', data: { home: propUid } });
    return () => {
      rt.triggers = rt.triggers.filter((t) => t.id !== id);
    };
  }, [houseId, propUid, rented, rot, cx, cz]);
  return <mesh geometry={geo} material={M.vc} rotation={[0, rot, 0]} castShadow />;
}
