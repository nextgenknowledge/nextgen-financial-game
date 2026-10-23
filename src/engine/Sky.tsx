'use client';
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { rt } from './runtime';
import { getWorld } from '@/store/game';
import { setNight } from './audio';
import { useSettings } from '@/store/settings';
import { worldUniforms } from './atlas';

/** Hour of day (0..24) for month progress t. Daytime gets 65% of the cycle so kids mostly play in daylight. */
export function hourOf(t: number): number {
  return t < 0.65 ? 6 + (t / 0.65) * 12 : (18 + ((t - 0.65) / 0.35) * 12) % 24;
}

interface SkyKey {
  h: number;
  top: string;
  hor: string;
  sun: string;
  sunI: number;
  hemi: number;
}

const KEYS: SkyKey[] = [
  { h: 0, top: '#0b1130', hor: '#1f2750', sun: '#8fa6ff', sunI: 0.22, hemi: 0.32 },
  { h: 5, top: '#121a40', hor: '#333a6a', sun: '#8fa6ff', sunI: 0.22, hemi: 0.34 },
  // Blue hour, then a warm, low sunrise
  { h: 5.9, top: '#2c3c78', hor: '#c98a8a', sun: '#ff9a6a', sunI: 0.8, hemi: 0.5 },
  { h: 6.8, top: '#6a94c9', hor: '#f6c08c', sun: '#ffbb7a', sunI: 1.9, hemi: 0.72 },
  { h: 9, top: '#5a8fcf', hor: '#d4e2ee', sun: '#fff0d8', sunI: 2.9, hemi: 0.85 },
  { h: 15, top: '#5a8fcf', hor: '#d9e5ef', sun: '#fff0d8', sunI: 2.9, hemi: 0.85 },
  // Golden hour: long amber light
  { h: 16.8, top: '#5f86c0', hor: '#f0cf9c', sun: '#ffc27a', sunI: 2.6, hemi: 0.78 },
  { h: 17.8, top: '#4f62a0', hor: '#f59e6a', sun: '#ff9550', sunI: 2.1, hemi: 0.66 },
  // Blue hour after sunset
  { h: 18.7, top: '#24306a', hor: '#7a5a8a', sun: '#c08aa0', sunI: 0.6, hemi: 0.48 },
  { h: 19.6, top: '#141c48', hor: '#34306a', sun: '#8fa6ff', sunI: 0.28, hemi: 0.38 },
  { h: 24, top: '#0b1130', hor: '#1f2750', sun: '#8fa6ff', sunI: 0.22, hemi: 0.32 },
];

/** How much each weather greys the sky and dims the sun, its fog colour and how close the fog comes. */
const WEATHER_LOOK: Record<string, { over: number; fog: string; near: number; far: number }> = {
  clear: { over: 0, fog: '', near: 1, far: 1 },
  cloudy: { over: 0.45, fog: '#b9c1ca', near: 0.9, far: 0.9 },
  rain: { over: 0.8, fog: '#8f99a5', near: 0.35, far: 0.55 },
  snow: { over: 0.7, fog: '#c9d0d8', near: 0.3, far: 0.5 },
  fog: { over: 0.75, fog: '#c4cbd1', near: 0.04, far: 0.26 },
  haze: { over: 0.25, fog: '#d8cbb0', near: 0.5, far: 0.72 },
};
const GREY = new THREE.Color('#9aa3ad');
const fogTint = new THREE.Color();

const cA = new THREE.Color();
const cB = new THREE.Color();

function sample(h: number) {
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const f = (h - a.h) / (b.h - a.h || 1);
  const mix = (x: string, y: string, out: THREE.Color) => out.set(x).lerp(cB.set(y), f);
  return {
    top: mix(a.top, b.top, new THREE.Color()),
    hor: mix(a.hor, b.hor, new THREE.Color()),
    sun: mix(a.sun, b.sun, new THREE.Color()),
    sunI: a.sunI + (b.sunI - a.sunI) * f,
    hemi: a.hemi + (b.hemi - a.hemi) * f,
  };
}

const skyVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w; // always at the far plane
}`;
const skyFrag = /* glsl */ `
uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float night;
varying vec3 vDir;
float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
void main() {
  float h = clamp(vDir.y, -0.2, 1.0);
  vec3 col = mix(hor, top, smoothstep(-0.05, 0.55, h));
  float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
  col += sunCol * (pow(s, 600.0) * 1.6 + pow(s, 12.0) * 0.18);
  // Stars at night
  if (night > 0.01 && h > 0.05) {
    vec3 cell = floor(vDir * 160.0);
    float st = step(0.9965, hash(cell));
    col += vec3(st) * night * 0.9 * smoothstep(0.05, 0.3, h);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export function SkyAndLights({ interior = false }: { interior?: boolean }) {
  const { scene } = useThree();
  const quality = useSettings((s) => s.quality);
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const uniforms = useMemo(
    () => ({
      top: { value: new THREE.Color() },
      hor: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunCol: { value: new THREE.Color() },
      night: { value: 0 },
    }),
    [],
  );
  const fog = useMemo(() => new THREE.Fog('#cfe6ff', 60, 260), []);
  const sunTarget = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const w = getWorld();
    const t = w?.time.t ?? 0.3;
    rt.timeOfDay = t;
    const h = hourOf(t);
    const s = sample(h);
    const dayAngle = ((h - 6) / 12) * Math.PI; // 0 at sunrise, π at sunset
    const isDay = h >= 6 && h <= 18;
    const elev = isDay ? Math.sin(dayAngle) : Math.sin(((h + (h < 6 ? 24 : 0) - 18) / 12) * Math.PI) * 0.7;
    const az = isDay ? dayAngle : ((h + (h < 6 ? 24 : 0) - 18) / 12) * Math.PI;
    const dir = new THREE.Vector3(Math.cos(az) * 0.8, Math.max(0.15, elev), 0.45).normalize();
    const nightAmt = isDay ? Math.max(0, 1 - elev * 5) * 0.4 : Math.min(1, 0.4 + elev * 2);
    rt.dayLight = 1 - Math.min(1, nightAmt * 1.25);
    setNight(rt.dayLight < 0.4);

    // Weather: overcast skies flatten the light and pull the fog in
    const wl = WEATHER_LOOK[rt.weather] ?? WEATHER_LOOK.clear;
    const wa = interior ? 0 : wl.over * rt.weatherAmt;
    const grey = GREY.clone().multiplyScalar(0.25 + 0.75 * rt.dayLight);
    s.top.lerp(grey, wa * 0.85);
    s.hor.lerp(grey, wa * 0.7);
    s.sunI *= 1 - wa * 0.75;
    s.hemi *= 1 + wa * 0.15;
    worldUniforms.uSkyRefl.value.copy(s.hor).lerp(s.top, 0.35);
    uniforms.top.value.copy(s.top);
    uniforms.hor.value.copy(s.hor);
    uniforms.sunDir.value.copy(dir);
    rt.sunDir.copy(dir);
    rt.sunColor.copy(s.sun);
    uniforms.sunCol.value.copy(s.sun);
    uniforms.night.value = nightAmt;

    if (interior) {
      fog.color.set('#f3e8d6');
      fog.near = 40;
      fog.far = 120;
    } else {
      fog.color.copy(s.hor);
      const far = quality === 'low' ? 150 : quality === 'medium' ? 220 : 300;
      const a = rt.weatherAmt;
      if (wl.fog) fog.color.lerp(fogTint.set(wl.fog).multiplyScalar(0.2 + 0.8 * rt.dayLight), Math.min(1, a));
      fog.near = far * 0.22 * (1 + (wl.near - 1) * a);
      fog.far = far * (1 + (wl.far - 1) * a);
    }
    scene.fog = fog;

    if (sunRef.current) {
      const p = rt.player;
      // Snap the shadow camera to texel-sized steps so shadows don't shimmer as you walk
      const step = (shadowR * 2) / shadowMap;
      const sx = Math.round(p.x / step) * step;
      const sz = Math.round(p.z / step) * step;
      sunRef.current.position.set(sx + dir.x * 80, p.y + dir.y * 80, sz + dir.z * 80);
      sunTarget.position.set(sx, p.y, sz);
      sunRef.current.color.copy(s.sun);
      sunRef.current.intensity = interior ? 1.2 : s.sunI;
    }
    if (hemiRef.current) {
      hemiRef.current.color.copy(interior ? cA.set('#fff4e0') : s.top).lerp(cB.set('#ffffff'), 0.5);
      hemiRef.current.groundColor.set(interior ? '#c9b48a' : '#6b8f4e').lerp(cB.set('#2a2f4a'), 1 - rt.dayLight);
      hemiRef.current.intensity = interior ? 1.5 : s.hemi;
    }
  });

  const shadows = quality !== 'low' && !interior;
  const shadowMap = quality === 'high' ? 2048 : 1024;
  const shadowR = quality === 'high' ? 48 : 34;
  return (
    <>
      {!interior && (
        <mesh scale={900} renderOrder={-1} frustumCulled={false}>
          <sphereGeometry args={[1, 24, 12]} />
          <shaderMaterial vertexShader={skyVert} fragmentShader={skyFrag} uniforms={uniforms} side={THREE.BackSide} depthWrite={false} fog={false} />
        </mesh>
      )}
      {interior && <color attach="background" args={['#f3e8d6']} />}
      <hemisphereLight ref={hemiRef} args={['#ffffff', '#6b8f4e', 1]} />
      <primitive object={sunTarget} />
      <directionalLight
        ref={sunRef}
        target={sunTarget}
        castShadow={shadows}
        shadow-mapSize-width={shadowMap}
        shadow-mapSize-height={shadowMap}
        shadow-camera-left={-shadowR}
        shadow-camera-right={shadowR}
        shadow-camera-top={shadowR}
        shadow-camera-bottom={-shadowR}
        shadow-camera-far={180}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      <ambientLight intensity={0.15} />
    </>
  );
}
