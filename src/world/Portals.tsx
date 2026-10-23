'use client';
/**
 * Portals between places. Each destination is a giant landmark (see portalKinds.ts) with a
 * swirling doorway. Locked portals show a grey, still swirl behind a barrier.
 */
import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { signMaterial } from './signage';
import { M } from './materials';
import { CITY_META } from './cities';
import { useGame } from '@/store/game';
import { useScene } from '@/store/scene';
import type { LocationId } from '@/game/types';
import { portalGeometry, portalKind } from './portalKinds';
import { BoardSign, boardMaterials } from './Props';

const swirlVert = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const swirlFrag = /* glsl */ `
uniform float time; uniform vec3 colA; uniform vec3 colB; uniform float locked; uniform float fade;
uniform vec2 size; uniform float shape;
varying vec2 vUv;
void main(){
  vec2 q = (vUv - 0.5) * size;            // metres from the centre
  vec2 h = size * 0.5;
  float inside;
  if (shape < 0.5) {                       // rectangle with rounded corners
    vec2 d = abs(q) - (h - 0.35);
    inside = 1.0 - smoothstep(0.3, 0.36, length(max(d, 0.0)));
  } else if (shape < 1.5) {                // arch: rectangle with a round top
    float r = h.x;
    float top = h.y - r;
    float rect = step(abs(q.x), h.x) * step(q.y, top) * step(-h.y, q.y);
    float dome = step(length(vec2(q.x, q.y - top)), r);
    inside = max(rect, dome);
  } else {                                 // circle
    inside = step(length(q), h.x);
  }
  if (inside < 0.01) discard;
  float rr = length(q / h);
  float a = atan(q.y, q.x);
  float s = sin(a * 4.0 + rr * 9.0 - time * 3.0) * 0.5 + 0.5;
  float s2 = sin(a * 7.0 - rr * 14.0 + time * 2.0) * 0.5 + 0.5;
  vec3 col = mix(colA, colB, s * 0.75 + s2 * 0.25);
  col += vec3(1.0) * pow(max(0.0, 1.0 - rr), 3.0) * 0.6;
  col = mix(col, vec3(0.45, 0.48, 0.55), locked * 0.75);
  gl_FragColor = vec4(col, 0.9 * inside * fade);
  if (gl_FragColor.a < 0.02) discard;
}`;

const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });

export function Portal({ to, x, z, rot }: { to: string; x: number; z: number; rot: number }) {
  const unlocked = useGame((s) => s.world?.progress.unlocked.includes(to as LocationId) ?? false);
  const here = useScene((s) => s.location);
  const meta = CITY_META[to as LocationId];
  const kind = portalKind(to);
  const geo = portalGeometry(to);
  const sw = kind.swirl;
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: swirlVert,
        fragmentShader: swirlFrag,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        uniforms: {
          time: { value: 0 },
          colA: { value: new THREE.Color(meta?.color ?? '#2ebaba') },
          colB: { value: new THREE.Color('#ffffff') },
          locked: { value: 0 },
          fade: { value: 1 },
          size: { value: new THREE.Vector2(sw.w, sw.h) },
          shape: { value: sw.shape === 'rect' ? 0 : sw.shape === 'arch' ? 1 : 2 },
        },
      }),
    [meta?.color, sw.w, sw.h, sw.shape],
  );
  const plate = useMemo(() => boardMaterials(to === 'park' ? 'Fin City Park' : meta?.name ?? to, kind.plate.w, 0.9, here, 'letters'), [to, meta, kind.plate.w, here]);
  const lockMat = useMemo(() => signMaterial({ kind: 'barrier', text: 'Not yet open', w: 3, h: 0.9 }), []);
  useFrame((state) => {
    mat.uniforms.time.value = state.clock.elapsedTime;
    // Fade the swirl when the camera is right next to it (e.g. just after arriving)
    const cd = Math.hypot(state.camera.position.x - x, state.camera.position.z - z);
    mat.uniforms.fade.value = Math.min(1, Math.max(0, (cd - 3) / 5));
    mat.uniforms.locked.value = unlocked ? 0 : 1;
  });
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh geometry={geo.solid} material={M.landmark} castShadow receiveShadow />
      <mesh geometry={geo.glow} material={glowMat} />
      <mesh position={[0, sw.y, sw.z ?? 0]} material={mat}>
        <planeGeometry args={[sw.w, sw.h]} />
      </mesh>
      <group position={[0, kind.plate.y, kind.plate.z]}>
        <BoardSign w={kind.plate.w} h={0.9} mats={plate} depth={0.16} />
      </group>
      {!unlocked && (
        <group position={[0, 0, 1.4]}>
          {[-1.35, 1.35].map((px) => (
            <mesh key={px} position={[px, 0.7, 0]}>
              <boxGeometry args={[0.12, 1.4, 0.12]} />
              <meshLambertMaterial color="#2a2a2a" />
            </mesh>
          ))}
          <mesh position={[0, 1.1, 0.07]} material={lockMat}>
            <planeGeometry args={[3, 0.9]} />
          </mesh>
        </group>
      )}
    </group>
  );
}
