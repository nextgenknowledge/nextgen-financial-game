'use client';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '@/store/game';
import { rt } from '@/engine/runtime';
import { worldUniforms } from '@/engine/atlas';
import { hashString, makeRng } from '@/game/rng';
import { CITIES } from './cities';
import { useSettings } from '@/store/settings';
import { hourOf } from '@/engine/Sky';
import type { LocationId } from '@/game/types';

export type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'haze';

/**
 * Deterministic weather for a city on a given day (same for everyone in that world). Each city has
 * its own climate: London drizzle, San Francisco fog, Singapore haze and tropical downpours,
 * New York snow in winter.
 */
export function weatherFor(seed: number, month: number, city: LocationId): WeatherKind {
  const rng = makeRng(seed ^ hashString(`${city}:${month}`));
  const def = CITIES[city];
  const rain = def?.weather?.rain ?? 0.2;
  const snow = def?.weather?.snow ?? 0;
  const fog = def?.weather?.fog ?? 0;
  const m = month % 12;
  const winter = m === 11 || m === 0 || m === 1;
  const r = rng.next();
  if (winter && r < snow) return 'snow';
  if (r < rain) return 'rain';
  if (r < rain + fog) return 'fog';
  if (city === 'singapore' || city === 'hong-kong') return r < rain + 0.3 ? 'haze' : 'clear';
  if (r < rain + fog + 0.25) return 'cloudy';
  return 'clear';
}

/**
 * How strong the weather is at this hour (0 … 1). Fog burns off by lunchtime and rolls back in at
 * dusk; tropical rain comes as an afternoon downpour; temperate rain comes and goes in bands.
 */
export function weatherAmount(kind: WeatherKind, city: LocationId, hour: number, day: number): number {
  const band = (a: number, b: number, ramp: number) => Math.min(1, Math.max(0, Math.min(hour - a, b - hour) / ramp + 0.5));
  switch (kind) {
    case 'fog':
      return Math.max(1 - band(11, 18.5, 2.5), 0.15);
    case 'rain':
      if (city === 'singapore' || city === 'hong-kong') return band(13.5, 17.5, 0.8);
      return 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(hour * 1.3 + day * 2.1));
    case 'snow':
      return 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(hour * 0.9 + day));
    case 'haze':
      return 0.7;
    case 'cloudy':
      return 0.8;
    default:
      return 0;
  }
}

const SPLASHES = 90;

export function Weather({ cityId }: { cityId: LocationId }) {
  const month = useGame((s) => s.world?.time.month ?? 0);
  const seed = useGame((s) => s.world?.seed ?? 1);
  const reduced = useSettings((s) => s.reducedMotion);
  const quality = useSettings((s) => s.quality);
  const kind = weatherFor(seed, month, cityId);
  rt.weather = kind;
  const falling = kind === 'rain' || kind === 'snow';
  const N = quality === 'low' ? 500 : quality === 'medium' ? 1100 : 1800;
  const ref = useRef<THREE.InstancedMesh>(null);
  const splashRef = useRef<THREE.InstancedMesh>(null);
  const drops = useMemo(() => Array.from({ length: N }, () => ({ x: (Math.random() - 0.5) * 60, y: Math.random() * 30, z: (Math.random() - 0.5) * 60, v: 0.8 + Math.random() * 0.4 })), [N]);
  const splashes = useMemo(() => Array.from({ length: SPLASHES }, () => ({ x: 0, z: 0, t: Math.random() })), []);
  const geo = useMemo(() => (kind === 'snow' ? new THREE.BoxGeometry(0.1, 0.1, 0.1) : new THREE.BoxGeometry(0.025, 0.9, 0.025)), [kind]);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: kind === 'snow' ? '#ffffff' : '#b8cce0', transparent: true, opacity: kind === 'snow' ? 0.9 : 0.42, depthWrite: false }), [kind]);
  const splashGeo = useMemo(() => new THREE.RingGeometry(0.06, 0.1, 10).rotateX(-Math.PI / 2), []);
  const splashMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#dfe9f2', transparent: true, opacity: 0.45, depthWrite: false }), []);
  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, 0, 0.08)), []);
  const v3 = useMemo(() => new THREE.Vector3(), []);
  const s3 = useMemo(() => new THREE.Vector3(1, 1, 1), []);

  useFrame((_, dt) => {
    const hour = hourOf(useGame.getState().world?.time.t ?? 0.3);
    const amt = weatherAmount(kind, cityId, hour, month);
    rt.weatherAmt = amt;
    // Surfaces soak quickly in rain and dry slowly afterwards; snow builds up over the day
    const wetTarget = kind === 'rain' ? 0.35 + amt * 0.65 : kind === 'snow' ? 0.15 : kind === 'fog' ? 0.2 * amt : 0;
    const u = worldUniforms;
    u.uWet.value += (wetTarget - u.uWet.value) * Math.min(1, dt * (wetTarget > u.uWet.value ? 0.5 : 0.08));
    const snowTarget = kind === 'snow' ? 0.5 + amt * 0.4 : 0;
    u.uSnow.value += (snowTarget - u.uSnow.value) * Math.min(1, dt * 0.2);

    const mesh = ref.current;
    if (!mesh || !falling) return;
    const active = Math.floor(N * (reduced ? 0.25 : 1) * Math.max(0.08, amt));
    mesh.count = active;
    const p = rt.player;
    const speed = kind === 'snow' ? 2.2 : 24;
    for (let i = 0; i < active; i++) {
      const d = drops[i];
      d.y -= speed * d.v * dt;
      if (kind === 'snow') {
        d.x += Math.sin(d.y * 0.5 + i) * dt * 0.6;
        d.z += Math.cos(d.y * 0.4 + i) * dt * 0.3;
      } else d.x += dt * 2.5;
      if (d.y < 0) {
        d.y = 26 + Math.random() * 4;
        d.x = (Math.random() - 0.5) * 60;
        d.z = (Math.random() - 0.5) * 60;
      }
      if (kind === 'snow') m4.makeTranslation(p.x + d.x, d.y, p.z + d.z);
      else m4.compose(v3.set(p.x + d.x, d.y, p.z + d.z), q, s3);
      mesh.setMatrixAt(i, m4);
    }
    mesh.instanceMatrix.needsUpdate = true;

    // Raindrop splashes: little rings that grow and fade around the player
    const sm = splashRef.current;
    if (sm) {
      const n = Math.floor(SPLASHES * amt);
      sm.count = n;
      for (let i = 0; i < n; i++) {
        const s = splashes[i];
        s.t += dt * 3;
        if (s.t > 1) {
          s.t = 0;
          s.x = p.x + (Math.random() - 0.5) * 24;
          s.z = p.z + (Math.random() - 0.5) * 24;
        }
        const k = 0.4 + s.t * 2.2;
        m4.makeScale(k, 1, k).setPosition(s.x, 0.12, s.z);
        sm.setMatrixAt(i, m4);
      }
      sm.instanceMatrix.needsUpdate = true;
      splashMat.opacity = 0.45 * (1 - 0.5 * rt.dayLight);
    }
  });
  if (!falling || reduced) return null;
  return (
    <>
      <instancedMesh ref={ref} args={[geo, mat, N]} frustumCulled={false} />
      {kind === 'rain' && <instancedMesh ref={splashRef} args={[splashGeo, splashMat, SPLASHES]} frustumCulled={false} />}
    </>
  );
}
