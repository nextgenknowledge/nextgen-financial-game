'use client';
import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import type { AvatarConfig } from '@/game/types';
import { Avatar } from '@/world/Avatar';

interface SpinState {
  angle: number;
  dragging: boolean;
  lastX: number;
  idle: number; // seconds since the last drag; auto-spin resumes after a pause
}

function Spinner({ config, spin, wave }: { config: AvatarConfig; spin: React.RefObject<SpinState>; wave: boolean }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const s = spin.current;
    s.idle += dt;
    if (!s.dragging && s.idle > 2.5) s.angle += dt * 0.45;
    if (g.current) g.current.rotation.y = s.angle;
  });
  return (
    <group ref={g} position={[0, -1.05, 0]}>
      <Avatar config={config} anim={{ current: { speed: 0, grounded: true, wave: wave ? 1 : 0 } }} />
    </group>
  );
}

/** Rotating avatar preview. Drag left/right to turn it; it resumes spinning when left alone. */
export function AvatarPreview({ config, height = 260, wave = true }: { config: AvatarConfig; height?: number; wave?: boolean }) {
  const spin = useRef<SpinState>({ angle: 0, dragging: false, lastX: 0, idle: 0 });
  const down = (e: React.PointerEvent) => {
    spin.current.dragging = true;
    spin.current.lastX = e.clientX;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const s = spin.current;
    if (!s.dragging) return;
    s.angle += (e.clientX - s.lastX) * 0.012;
    s.lastX = e.clientX;
    s.idle = 0;
  };
  const up = () => {
    spin.current.dragging = false;
    spin.current.idle = 0;
  };
  return (
    <div
      style={{ height, borderRadius: 14, border: '3px solid var(--ink)', background: 'linear-gradient(#bfe3ff, #fff3d6)', overflow: 'hidden', cursor: 'grab', touchAction: 'none' }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      title="Drag to turn"
    >
      <Canvas camera={{ position: [0, 0.35, 3.6], fov: 40 }} dpr={[1, 1.5]} gl={{ antialias: true }}>
        <hemisphereLight args={['#ffffff', '#c9b48a', 1.6]} />
        <directionalLight position={[2, 3, 4]} intensity={1.6} />
        <Spinner config={config} spin={spin} wave={wave} />
      </Canvas>
    </div>
  );
}
