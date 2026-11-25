'use client';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VoxelBuilder, cylinder, trs } from '@/engine/voxel';
import { vehicleDef, type VehicleDef } from '@/engine/vehicles';
import type { AvatarConfig } from '@/game/types';
import { Avatar, type AnimState } from './Avatar';
import { rt } from '@/engine/runtime';

export const vehicleMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
/** Windows are see-through so you can watch the driver at the wheel. */
const glassMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.32, depthWrite: false });

interface VehicleGeo {
  body: THREE.BufferGeometry;
  glass: THREE.BufferGeometry | null;
}
const geoCache = new Map<string, VehicleGeo>();

function shade(hex: string, f: number) {
  return '#' + new THREE.Color(hex).multiplyScalar(f).getHexString();
}

/** Car body sizes, shared by the model and the driver's seat. */
function carDims(def: VehicleDef) {
  const truck = def.id === 'pickup';
  const sporty = def.id === 'sports';
  const L = truck ? 4.4 : sporty ? 4.0 : 3.6;
  const H = sporty ? 0.55 : 0.75;
  const belt = 0.3 + H;
  const cabH = sporty ? 0.62 : 0.72;
  const cabZ = truck ? 0.5 : sporty ? -0.2 : -0.1;
  const cabL = truck ? 1.6 : sporty ? 1.7 : 2.0;
  return { truck, sporty, L, H, belt, cabH, cabZ, cabL };
}

export function buildVehicle(def: VehicleDef, colorOverride?: string): VehicleGeo {
  const key = def.id + (colorOverride ?? '');
  const cached = geoCache.get(key);
  if (cached) return cached;
  const b = new VoxelBuilder();
  const gl = new VoxelBuilder();
  let hasGlass = false;
  const c = colorOverride ?? def.color;
  const dark = '#2a2f3d';
  const glass = '#9fd3f0';
  const chrome = '#c0c4cc';
  const pane = (x: number, y0: number, z: number, w: number, h: number, d: number) => {
    gl.block(x, y0, z, w, h, d, glass);
    hasGlass = true;
  };
  const wheel = (x: number, z: number, r: number, w: number) => {
    b.geom(cylinder(r, r, w, 14), trs(x, r, z, 0, 0, Math.PI / 2), dark);
    // Hubcap and centre on the outside of bigger wheels
    if (r > 0.2) {
      b.geom(cylinder(r * 0.62, r * 0.62, w + 0.02, 12), trs(x, r, z, 0, 0, Math.PI / 2), '#aeb4bd', 'metal');
      b.geom(cylinder(r * 0.22, r * 0.22, w + 0.04, 8), trs(x, r, z, 0, 0, Math.PI / 2), '#5a606b');
    }
  };
  /** Steering wheel facing a driver who sits behind it (toward -z). */
  const steering = (x: number, y: number, z: number, r = 0.17) => b.geom(cylinder(r, r, 0.05, 12), trs(x, y, z, Math.PI / 2 - 0.45, 0, 0), dark);
  if (def.id === 'volt-streak') return finish(key, voltStreak(b, gl, c), b, gl);
  if (def.id === 'dune-hopper') return finish(key, duneHopper(b, c), b, gl);
  if (def.id === 'roadster') return finish(key, roadster(b, gl, c), b, gl);
  if (def.id === 'jet-ski') return finish(key, jetSki(b, c), b, gl);
  if (def.type === 'heli') return finish(key, skylark(b, gl, c), b, gl);
  switch (def.type) {
    case 'bike': {
      wheel(0, 0.62, 0.36, 0.08);
      wheel(0, -0.62, 0.36, 0.08);
      b.box(0, 0.62, 0, 0.08, 0.08, 1.1, c);
      // Seat post and saddle
      b.box(0, 0.8, -0.28, 0.08, 0.5, 0.08, c);
      b.box(0, 1.07, -0.3, 0.2, 0.06, 0.3, dark);
      // Fork, a stem that sweeps back toward the rider, and the bars
      b.box(0, 0.95, 0.52, 0.06, 0.66, 0.06, chrome);
      b.box(0, 1.25, 0.43, 0.06, 0.06, 0.2, chrome);
      b.box(0, 1.26, 0.34, 0.62, 0.06, 0.06, dark);
      // Crank and pedals under the saddle
      b.box(0, 0.42, 0.02, 0.1, 0.14, 0.14, dark);
      b.box(0.14, 0.42, 0.1, 0.12, 0.04, 0.14, dark);
      b.box(-0.14, 0.42, -0.06, 0.12, 0.04, 0.14, dark);
      break;
    }
    case 'scooter': {
      wheel(0, 0.55, 0.18, 0.1);
      wheel(0, -0.55, 0.18, 0.1);
      b.box(0, 0.25, 0, 0.32, 0.08, 1.2, c);
      b.box(0, 0.75, 0.55, 0.08, 1.0, 0.08, chrome);
      b.box(0, 1.25, 0.55, 0.6, 0.07, 0.07, dark);
      b.box(0, 0.32, 0.55, 0.3, 0.12, 0.16, c);
      break;
    }
    case 'kart': {
      for (const [x, z] of [[0.6, 0.7], [-0.6, 0.7], [0.6, -0.65], [-0.6, -0.65]]) wheel(x, z, 0.24, 0.22);
      b.block(0, 0.15, 0, 1.1, 0.2, 1.8, c);
      // Low bucket seat with a backrest, so the driver sits in it rather than inside a block
      b.block(0, 0.35, -0.3, 0.56, 0.1, 0.5, dark);
      b.block(0, 0.35, -0.6, 0.56, 0.55, 0.1, dark);
      b.block(0, 0.35, 0.75, 1.0, 0.18, 0.3, shade(c, 0.8));
      b.block(0, 0.35, 0.42, 0.06, 0.48, 0.06, dark);
      steering(0, 0.86, 0.34, 0.15);
      break;
    }
    case 'car': {
      if (def.id === 'sports') {
        hasGlass = true;
        apexTR(b, gl, c);
        break;
      }
      const { truck, sporty, L, H, belt, cabH, cabZ, cabL } = carDims(def);
      for (const [x, z] of [[0.82, L / 2 - 0.75], [-0.82, L / 2 - 0.75], [0.82, -L / 2 + 0.75], [-0.82, -L / 2 + 0.75]]) wheel(x, z, 0.36, 0.3);
      b.block(0, 0.3, 0, 1.8, H, L, c);
      // Hollow cabin: roof, four pillars and glass all round
      const roof = 0.08;
      const pillarH = cabH - roof;
      b.block(0, belt + pillarH, cabZ, 1.62, roof, cabL, shade(c, 0.95));
      for (const [x, z] of [[0.77, cabL / 2 - 0.06], [-0.77, cabL / 2 - 0.06], [0.77, -cabL / 2 + 0.06], [-0.77, -cabL / 2 + 0.06]])
        b.block(x, belt, cabZ + z, 0.08, pillarH, 0.12, shade(c, 0.95));
      pane(0, belt, cabZ + cabL / 2 - 0.04, 1.46, pillarH, 0.04);
      pane(0, belt, cabZ - cabL / 2 + 0.04, 1.46, pillarH, 0.04);
      pane(0.79, belt, cabZ, 0.03, pillarH, cabL - 0.24);
      pane(-0.79, belt, cabZ, 0.03, pillarH, cabL - 0.24);
      // Dashboard, seats and the wheel in front of the driver (left seat, +x)
      const seat = driverSeat(def);
      b.block(0, belt - 0.12, cabZ + cabL / 2 - 0.22, 1.5, 0.18, 0.3, dark);
      steering(seat.x, belt + 0.02, seat.z + 0.58);
      // Seat backs stop below the driver's head so the driver stays visible
      b.block(seat.x, belt - 0.3, seat.z - 0.24, 0.5, sporty ? 0.42 : 0.5, 0.1, dark);
      b.block(-seat.x, belt - 0.3, seat.z - 0.24, 0.5, sporty ? 0.42 : 0.5, 0.1, dark);
      // Lights & bumpers
      b.block(0.6, 0.55, L / 2, 0.36, 0.18, 0.06, '#fff4c2');
      b.block(-0.6, 0.55, L / 2, 0.36, 0.18, 0.06, '#fff4c2');
      b.block(0.6, 0.55, -L / 2, 0.3, 0.16, 0.06, '#ff5a4a');
      b.block(-0.6, 0.55, -L / 2, 0.3, 0.16, 0.06, '#ff5a4a');
      b.block(0, 0.22, L / 2 + 0.05, 1.84, 0.2, 0.12, dark);
      b.block(0, 0.22, -L / 2 - 0.05, 1.84, 0.2, 0.12, dark);
      // Grille, number plates, door mirrors, door seams and a dark rubbing strip
      if (def.id !== 'ev') b.block(0, 0.42, L / 2 + 0.01, 0.8, 0.2, 0.04, dark);
      else b.block(0, 0.62, L / 2 + 0.01, 1.4, 0.04, 0.04, '#e9f6ff'); // light bar instead of a grille
      b.block(0, 0.3, L / 2 + 0.11, 0.5, 0.13, 0.02, '#f4f1ea');
      b.block(0, 0.3, -L / 2 - 0.11, 0.5, 0.13, 0.02, '#f4f1ea');
      for (const sx of [-1, 1]) {
        b.block(sx * 0.95, belt - 0.02, cabZ + cabL / 2 - 0.2, 0.12, 0.12, 0.16, shade(c, 0.85));
        b.block(sx * 0.905, 0.38, cabZ + cabL / 2 - 0.1, 0.01, H - 0.12, 0.02, shade(c, 0.7));
        b.block(sx * 0.905, 0.38, cabZ - 0.2, 0.01, H - 0.12, 0.02, shade(c, 0.7));
        b.block(sx * 0.91, 0.4, 0, 0.02, 0.06, L - 0.9, dark);
        for (const z of [L / 2 - 0.75, -L / 2 + 0.75]) b.block(sx * 0.86, 0.62, z, 0.12, 0.08, 0.9, dark);
      }
      if (truck) {
        b.block(0, 0.3 + H, -1.2, 1.6, 0.04, 1.8, dark); // bed liner
        b.block(0.86, 0.3 + H, -1.2, 0.08, 0.4, 1.8, c);
        b.block(-0.86, 0.3 + H, -1.2, 0.08, 0.4, 1.8, c);
        b.block(0, 0.3 + H, -2.15, 1.8, 0.4, 0.08, c);
      }
      if (sporty) b.block(0, 0.3 + H + 0.05, -L / 2 + 0.2, 1.6, 0.08, 0.3, dark);
      break;
    }
    case 'boat': {
      const big = def.id === 'speedboat';
      const L = big ? 5.5 : 3.2;
      const W = big ? 2.1 : 0.8;
      b.block(0, -0.2, 0, W, 0.6, L, c);
      b.block(0, -0.2, L / 2 + 0.3, W * 0.6, 0.6, 0.6, c, { rotY: 0 });
      b.block(0, -0.25, 0, W + 0.02, 0.12, L + 0.02, big ? '#2f6bdb' : '#ffffff');
      if (big) {
        b.block(0, 0.4, 0, W - 0.2, 0.08, L - 0.6, shade(c, 0.75));
        pane(0, 0.4, 0.6, 1.6, 0.6, 0.08);
        // Console with the wheel, and a bench behind it
        b.block(0.35, 0.48, 0.18, 0.6, 0.55, 0.3, '#e8dcc0');
        steering(0.35, 1.1, -0.02);
        b.block(0, 0.4, -0.85, 1.4, 0.35, 0.8, '#e8dcc0');
        b.block(0, 0.4, -1.3, 1.4, 0.7, 0.12, '#e8dcc0');
        for (const sx of [-1, 1]) b.block(sx * (W / 2 + 0.005), 0.05, 0.3, 0.01, 0.08, L - 1.2, '#f4f1ea'); // hull stripe
        b.block(0, 1.0, 0.6, 1.64, 0.05, 0.1, '#c0c4cc'); // windscreen frame
        b.block(0, 0.1, -L / 2 - 0.25, 0.4, 0.75, 0.4, '#2a2f3d'); // outboard motor
        b.block(0, 0.85, -L / 2 - 0.25, 0.46, 0.2, 0.5, '#e8e6df');
      } else {
        // Kayak: decks fore and aft, an open cockpit in the middle
        b.block(0, 0.4, 0.95, W - 0.2, 0.08, 1.2, shade(c, 0.75));
        b.block(0, 0.4, -1.05, W - 0.2, 0.08, 1.0, shade(c, 0.75));
        b.block(0, 0.4, -0.2, W - 0.1, 0.1, 0.06, dark);
        b.block(0, 0.4, 0.33, W - 0.1, 0.1, 0.06, dark);
      }
      break;
    }
    case 'plane': {
      b.block(0, 0.9, 0, 1.3, 1.2, 5.2, c);
      b.block(0, 1.0, 2.75, 0.9, 0.9, 0.5, shade(c, 0.9));
      // Canopy on top of the fuselage, with the pilot's head showing through it
      pane(0, 2.1, 1.0, 0.98, 0.46, 1.25);
      b.block(0, 2.54, 1.0, 1.0, 0.05, 1.27, shade(c, 0.85));
      b.block(0, 1.45, 0.3, 9.5, 0.14, 1.4, '#f4f6fa');
      b.block(0, 1.2, -2.3, 3.2, 0.12, 0.8, '#f4f6fa');
      b.block(0, 1.6, -2.4, 0.12, 1.1, 0.8, c);
      b.block(0, 1.0, 3.05, 0.12, 1.8, 0.12, dark); // propeller
      b.geom(new THREE.ConeGeometry(0.22, 0.4, 10), trs(0, 1.45, 3.2, Math.PI / 2, 0, 0), '#e8e6df'); // spinner
      for (const sx of [-1, 1]) {
        b.geom(new THREE.BoxGeometry(0.06, 0.06, 1.0), trs(sx * 1.6, 1.15, 0.3, 0, 0, sx * 0.55), '#8d939c'); // wing strut
        b.block(sx * 4.55, 1.45, 0.3, 0.4, 0.15, 1.42, '#e5533d'); // wing tip
      }
      b.block(0, 2.1, -2.4, 0.13, 0.25, 0.82, '#f4f6fa'); // tail stripe
      for (let k = 0; k < 3; k++) b.block(0.66, 1.25, 0.2 - k * 0.6, 0.01, 0.3, 0.38, glass); // cabin windows
      // Floats
      b.block(1.3, 0.1, 0.2, 0.4, 0.35, 4.2, '#f4f6fa');
      b.block(-1.3, 0.1, 0.2, 0.4, 0.35, 4.2, '#f4f6fa');
      b.block(1.3, 0.45, 0.2, 0.08, 0.5, 0.08, dark);
      b.block(-1.3, 0.45, 0.2, 0.08, 0.5, 0.08, dark);
      break;
    }
  }
  return finish(key, hasGlass, b, gl);
}

function finish(key: string, hasGlass: boolean, b: VoxelBuilder, gl: VoxelBuilder): VehicleGeo {
  const out: VehicleGeo = { body: b.build(), glass: hasGlass ? gl.build() : null };
  geoCache.set(key, out);
  return out;
}

const ink = '#16181c';
const gun = '#2a2f3d';
const chromeC = '#c0c4cc';
/** A tyre with a rim, on an axle along x. */
function tyre(b: VoxelBuilder, x: number, z: number, r: number, w: number, rim = '#aeb4bd', wall?: string) {
  b.geom(cylinder(r, r, w, 16), trs(x, r, z, 0, 0, Math.PI / 2), ink);
  if (wall) b.geom(cylinder(r * 0.8, r * 0.8, w + 0.01, 16), trs(x, r, z, 0, 0, Math.PI / 2), wall);
  b.geom(cylinder(r * 0.6, r * 0.6, w + 0.02, 12), trs(x, r, z, 0, 0, Math.PI / 2), rim, 'metal');
  b.geom(cylinder(r * 0.2, r * 0.2, w + 0.04, 8), trs(x, r, z, 0, 0, Math.PI / 2), '#5a606b');
}

/**
 * Volt Streak E-Moto: a low electric motorbike with a battery pack where the engine would be,
 * a glowing strip down each side, a short tail and a small screen over the headlight.
 */
function voltStreak(b: VoxelBuilder, gl: VoxelBuilder, c: string) {
  const glow = '#7ff5ff';
  tyre(b, 0, 0.78, 0.34, 0.2, '#33363d');
  tyre(b, 0, -0.72, 0.34, 0.24, '#33363d');
  b.box(0, 0.36, -0.42, 0.12, 0.08, 0.62, gun); // swingarm
  // Battery pack, the fairing over it and the glow strips
  b.block(0, 0.36, 0.02, 0.36, 0.44, 0.86, gun);
  b.block(0, 0.8, 0.18, 0.44, 0.24, 0.66, c);
  b.block(0, 0.5, 0.15, 0.4, 0.3, 0.5, shade(c, 0.8));
  for (const sx of [-1, 1]) {
    b.block(sx * 0.222, 0.62, 0.05, 0.01, 0.04, 0.92, glow);
    b.block(sx * 0.202, 0.42, 0.02, 0.01, 0.1, 0.5, '#3a404c'); // cooling fins
  }
  // Seat and the short tail with its light
  b.block(0, 0.84, -0.4, 0.32, 0.12, 0.6, ink);
  b.block(0, 0.78, -0.82, 0.26, 0.16, 0.34, c);
  b.block(0, 0.82, -1.0, 0.2, 0.05, 0.02, '#ff3b2f');
  // Front fork leaning back, bars, the headlight cowl and a small screen
  for (const sx of [-0.1, 0.1]) b.geom(new THREE.BoxGeometry(0.06, 0.78, 0.06), trs(sx, 0.72, 0.66, -0.35, 0, 0), chromeC, 'metal');
  b.block(0, 0.88, 0.62, 0.36, 0.26, 0.24, c);
  b.block(0, 0.96, 0.745, 0.22, 0.1, 0.02, '#e9f6ff');
  b.block(0, 0.9, 0.745, 0.3, 0.02, 0.02, glow);
  b.box(0, 1.16, 0.52, 0.66, 0.05, 0.05, gun);
  for (const sx of [-0.33, 0.33]) b.box(sx, 1.16, 0.52, 0.08, 0.07, 0.12, ink);
  gl.geom(new THREE.BoxGeometry(0.3, 0.2, 0.02), trs(0, 1.22, 0.68, -0.4, 0, 0), '#9fd3f0');
  b.box(0, 0.3, -0.9, 0.08, 0.06, 0.2, gun); // number plate hanger
  return true;
}

/**
 * Dune Hopper Buggy: chunky tyres, an open roll cage with a roof light bar, a rear engine box and
 * a spare tyre on the back.
 */
function duneHopper(b: VoxelBuilder, c: string) {
  const cage = '#2a2f3d';
  for (const [x, z] of [[0.84, 0.95], [-0.84, 0.95], [0.88, -0.9], [-0.88, -0.9]] as const) tyre(b, x, z, 0.42, 0.36, '#d8dbe0');
  b.block(0, 0.3, 0, 1.2, 0.22, 2.3, gun); // chassis
  b.block(0, 0.52, 0.9, 1.2, 0.26, 0.72, c); // nose
  b.geom(new THREE.BoxGeometry(1.2, 0.08, 0.5), trs(0, 0.86, 0.6, 0.35, 0, 0), c); // sloped scuttle
  for (const sx of [-1, 1]) {
    b.block(sx * 0.56, 0.52, -0.2, 0.1, 0.3, 1.3, c); // side pods
    b.block(sx * 0.86, 0.86, 0.95, 0.3, 0.06, 0.7, shade(c, 0.85)); // fender flares
    b.block(sx * 0.9, 0.86, -0.9, 0.3, 0.06, 0.7, shade(c, 0.85));
    b.block(sx * 0.4, 0.66, 1.27, 0.2, 0.12, 0.02, '#fff4c2'); // headlights
  }
  b.block(0, 0.42, 1.28, 1.3, 0.1, 0.12, ink); // bumper
  // Bucket seat, wheel and the engine box behind
  b.block(0, 0.52, -0.25, 0.56, 0.12, 0.52, ink);
  b.block(0, 0.52, -0.55, 0.56, 0.68, 0.1, ink);
  b.box(0, 0.78, 0.36, 0.06, 0.4, 0.06, gun);
  b.geom(cylinder(0.16, 0.16, 0.05, 12), trs(0, 1.0, 0.3, Math.PI / 2 - 0.5, 0, 0), ink);
  b.block(0, 0.52, -0.95, 0.9, 0.42, 0.46, '#3a3f4a');
  for (let k = 0; k < 4; k++) b.block(0, 0.6 + k * 0.08, -1.19, 0.7, 0.03, 0.02, ink);
  b.geom(cylinder(0.3, 0.3, 0.16, 14), trs(0, 1.18, -1.28, Math.PI / 2, 0, 0), ink); // spare
  b.geom(cylinder(0.16, 0.16, 0.18, 10), trs(0, 1.18, -1.28, Math.PI / 2, 0, 0), '#d8dbe0', 'metal');
  // Roll cage: four uprights, rails over the top and a light bar
  const top = 1.78;
  for (const [x, z] of [[0.58, 0.3], [-0.58, 0.3], [0.58, -0.72], [-0.58, -0.72]] as const) b.box(x, (0.52 + top) / 2, z, 0.07, top - 0.52, 0.07, cage);
  for (const sx of [-0.58, 0.58]) b.box(sx, top, -0.21, 0.07, 0.07, 1.09, cage);
  for (const z of [0.3, -0.72]) b.box(0, top, z, 1.23, 0.07, 0.07, cage);
  b.box(0, top + 0.08, 0.3, 1.0, 0.1, 0.1, ink);
  for (let k = 0; k < 4; k++) b.box(-0.36 + k * 0.24, top + 0.08, 0.36, 0.16, 0.07, 0.02, '#fff4c2');
  return false;
}

/**
 * Marlin Coast Roadster: a long-nosed classic convertible with round headlights, a chrome grille
 * and bumpers, whitewall tyres, tan leather seats and a wooden dash. Driver on the left (+x).
 */
function roadster(b: VoxelBuilder, gl: VoxelBuilder, c: string) {
  const tan = '#c9a27a';
  for (const [x, z] of [[0.82, 1.3], [-0.82, 1.3], [0.82, -1.3], [-0.82, -1.3]] as const) tyre(b, x, z, 0.36, 0.28, chromeC, '#f4f1ea');
  // Long hood, short rear deck, and an open cockpit between them
  b.block(0, 0.3, 1.05, 1.76, 0.56, 1.9, c);
  b.block(0, 0.3, -1.55, 1.76, 0.56, 0.9, c);
  b.block(0, 0.3, -0.5, 1.76, 0.22, 1.2, gun);
  for (const sx of [-1, 1]) {
    b.block(sx * 0.8, 0.3, -0.5, 0.16, 0.56, 1.2, c);
    b.block(sx * 0.86, 0.3, 1.3, 0.12, 0.66, 0.95, shade(c, 0.92)); // front fender
    b.block(sx * 0.86, 0.3, -1.3, 0.12, 0.66, 0.95, shade(c, 0.92)); // rear fender
    b.block(sx * 0.925, 0.62, 0, 0.01, 0.04, 3.4, chromeC); // side trim
    // Round headlights in chrome rings, round tail lights
    b.geom(cylinder(0.17, 0.17, 0.05, 16), trs(sx * 0.6, 0.74, 2.0, Math.PI / 2, 0, 0), chromeC, 'metal');
    b.geom(cylinder(0.14, 0.14, 0.06, 16), trs(sx * 0.6, 0.74, 2.01, Math.PI / 2, 0, 0), '#fff4c2');
    b.geom(cylinder(0.1, 0.1, 0.05, 12), trs(sx * 0.6, 0.66, -2.0, Math.PI / 2, 0, 0), '#ff3b2f');
    b.box(sx * 0.95, 1.0, 0.25, 0.12, 0.09, 0.05, chromeC); // mirror
    b.geom(cylinder(0.05, 0.05, 0.25, 8), trs(sx * 0.3, 0.3, -2.05, Math.PI / 2, 0, 0), chromeC, 'metal'); // exhaust
  }
  // Chrome grille and bumpers, a hood stripe
  b.block(0, 0.36, 2.0, 0.7, 0.36, 0.03, chromeC);
  for (let k = 0; k < 5; k++) b.block(-0.28 + k * 0.14, 0.4, 2.02, 0.04, 0.28, 0.02, gun);
  b.block(0, 0.2, 2.06, 1.84, 0.12, 0.1, chromeC);
  b.block(0, 0.2, -2.06, 1.84, 0.12, 0.1, chromeC);
  b.block(0, 0.865, 1.05, 0.3, 0.01, 1.9, '#f4f1ea');
  b.block(0, 0.865, -1.55, 0.3, 0.01, 0.9, '#f4f1ea');
  // Windscreen in a chrome frame, wooden dash, wheel, leather seats and chrome hoops behind them
  gl.block(0, 0.86, 0.12, 1.5, 0.42, 0.04, '#9fd3f0');
  b.block(0, 1.28, 0.12, 1.56, 0.04, 0.06, chromeC);
  for (const sx of [-0.77, 0.77]) b.block(sx, 0.86, 0.12, 0.04, 0.46, 0.06, chromeC);
  b.block(0, 0.72, 0.0, 1.44, 0.16, 0.18, '#6b4226');
  b.geom(cylinder(0.18, 0.18, 0.04, 16), trs(0.38, 0.92, -0.12, Math.PI / 2 - 0.45, 0, 0), '#6b4226');
  for (const sx of [-0.38, 0.38]) {
    b.block(sx, 0.52, -0.58, 0.52, 0.14, 0.5, tan);
    b.block(sx, 0.52, -0.92, 0.52, 0.5, 0.12, tan);
    b.geom(new THREE.TorusGeometry(0.2, 0.03, 6, 12, Math.PI), trs(sx, 0.86, -1.05), chromeC, 'metal');
  }
  return true;
}

/** Wave Dart Jet Ski: a short hull you sit astride, with a handlebar pod and a jet at the back. */
function jetSki(b: VoxelBuilder, c: string) {
  b.block(0, -0.2, -0.1, 0.92, 0.5, 2.5, c);
  b.geom(new THREE.BoxGeometry(0.72, 0.38, 0.6), trs(0, 0.06, 1.3, -0.3, 0, 0), c); // nose
  b.block(0, 0.3, -0.25, 0.86, 0.06, 2.0, '#f4f6fa'); // deck
  for (const sx of [-1, 1]) b.block(sx * 0.465, -0.02, -0.1, 0.01, 0.1, 2.3, ink); // hull stripe
  b.block(0, 0.36, -0.45, 0.38, 0.22, 1.0, ink); // seat
  b.block(0, 0.36, 0.5, 0.46, 0.32, 0.4, c); // handlebar pod
  b.box(0, 0.84, 0.48, 0.12, 0.16, 0.12, gun);
  b.box(0, 0.92, 0.46, 0.74, 0.05, 0.05, gun);
  for (const sx of [-0.36, 0.36]) b.box(sx, 0.92, 0.46, 0.1, 0.07, 0.07, ink);
  b.block(0, -0.12, -1.42, 0.3, 0.22, 0.14, gun); // jet nozzle
  return false;
}

/**
 * Skylark H2 Helicopter: a rounded cabin with a big glass canopy, an engine hump, a long tail boom
 * with a fin and tail rotor, and landing skids. The main rotor spins in VehicleModel.
 */
function skylark(b: VoxelBuilder, gl: VoxelBuilder, c: string) {
  const accent = '#e5533d';
  b.block(0, 0.55, 0.55, 1.6, 0.72, 2.3, c); // lower cabin
  b.block(0, 0.55, 1.78, 1.3, 0.55, 0.2, c);
  gl.block(0, 1.27, 0.75, 1.5, 0.82, 1.7, '#9fd3f0'); // canopy
  gl.geom(new THREE.BoxGeometry(1.3, 0.9, 0.05), trs(0, 1.45, 1.68, -0.5, 0, 0), '#9fd3f0'); // windscreen
  b.block(0, 2.09, 0.5, 1.6, 0.1, 1.5, c); // roof
  for (const [x, z] of [[0.77, 1.58], [-0.77, 1.58], [0.77, -0.1], [-0.77, -0.1]] as const) b.block(x, 1.27, z, 0.06, 0.82, 0.06, shade(c, 0.85));
  b.block(0, 1.27, -0.45, 1.6, 0.82, 0.5, c); // rear bulkhead
  for (const sx of [-1, 1]) {
    b.block(sx * 0.805, 0.85, 0.55, 0.01, 0.12, 2.3, accent);
    b.box(sx * 0.82, 0.07, 0.5, 0.1, 0.1, 2.9, gun); // skid
    b.box(sx * 0.82, 0.16, 1.95, 0.1, 0.1, 0.22, gun);
    for (const z of [1.2, -0.2]) b.box(sx * 0.74, 0.34, z, 0.07, 0.5, 0.07, gun);
  }
  // Engine hump and rotor mast
  b.block(0, 2.19, -0.15, 0.95, 0.38, 1.3, shade(c, 0.88));
  for (let k = 0; k < 4; k++) b.block(0.476, 2.27, -0.5 + k * 0.2, 0.01, 0.2, 0.08, ink);
  b.geom(cylinder(0.08, 0.1, 0.4, 10), trs(0, 2.77, 0.2), gun);
  // Tail boom, fin, tail plane, tail rotor and the warning light on top
  b.block(0, 1.15, -2.3, 0.36, 0.36, 3.2, c);
  b.block(0, 1.27, -2.3, 0.37, 0.08, 3.0, accent);
  b.block(0, 1.3, -3.85, 0.08, 1.0, 0.5, c);
  b.block(0, 1.36, -3.3, 1.3, 0.06, 0.4, c);
  b.box(0.12, 1.95, -3.85, 0.03, 0.9, 0.12, ink);
  b.box(0.12, 1.95, -3.85, 0.03, 0.12, 0.9, ink);
  b.box(0, 2.33, -3.95, 0.06, 0.06, 0.06, accent);
  b.block(0, 0.55, 1.9, 0.5, 0.1, 0.04, '#fff4c2'); // landing light
  return true;
}

/** The helicopter's main rotor: spins up while you're aboard. */
function Rotor({ spin }: { spin: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const rate = useRef(0);
  useFrame((_, dt) => {
    if (!ref.current) return;
    rate.current += ((spin ? 22 : 0) - rate.current) * Math.min(1, dt * 0.8);
    ref.current.rotation.y += rate.current * dt;
  });
  return (
    <group ref={ref} position={[0, 3.0, 0.2]}>
      <mesh material={rotorMaterial}>
        <boxGeometry args={[9.4, 0.05, 0.32]} />
      </mesh>
      <mesh material={rotorMaterial}>
        <boxGeometry args={[0.32, 0.05, 9.4]} />
      </mesh>
      <mesh material={rotorMaterial}>
        <cylinderGeometry args={[0.2, 0.2, 0.16, 10]} />
      </mesh>
    </group>
  );
}
const rotorMaterial = new THREE.MeshLambertMaterial({ color: '#2a2f3d' });

/**
 * The Kestrel Apex TR, Fin City's own track car: a rear-engined coupe with a low sloping nose,
 * raised front fenders with round headlights and louvres, a teardrop roof that runs down into a
 * long engine cover, wide rear hips with side intakes, a tall swan-neck wing, a full-width light
 * bar, a big diffuser and twin centre exhausts. No badges or real brand names anywhere.
 * Forward is +z; the driver sits on the left (+x).
 */
function apexTR(b: VoxelBuilder, gl: VoxelBuilder, paint: string) {
  const black = '#16181c';
  const carbon = '#24272d';
  const glass = '#8fc8e8';
  const light = '#fff6d6';
  const red = '#ff3b2f';
  const metal = '#c0c4cc';
  const dark = shade(paint, 0.82);
  const rot = (x: number, y: number, z: number, rx: number, ry = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0)), new THREE.Vector3(1, 1, 1));

  // Wheels: wide tyres, dark centre-lock rims with a bright lip, red calipers up front
  for (const [x, z, r] of [[0.84, 1.3, 0.36], [-0.84, 1.3, 0.36], [0.9, -1.3, 0.39], [-0.9, -1.3, 0.39]] as const) {
    b.geom(cylinder(r, r, 0.34, 16), trs(x, r, z, 0, 0, Math.PI / 2), '#1b1d21');
    b.geom(cylinder(r * 0.7, r * 0.7, 0.36, 16), trs(x, r, z, 0, 0, Math.PI / 2), '#33363d', 'metal');
    b.geom(cylinder(r * 0.74, r * 0.74, 0.355, 16), trs(x, r, z, 0, 0, Math.PI / 2), metal);
    b.geom(cylinder(r * 0.66, r * 0.66, 0.365, 10), trs(x, r, z, 0, 0, Math.PI / 2), '#2b2e34');
    b.geom(cylinder(0.07, 0.07, 0.38, 8), trs(x, r, z, 0, 0, Math.PI / 2), '#d4a23a');
    if (z > 0) b.box(x * 0.93, r + 0.1, z - 0.12, 0.08, 0.16, 0.2, red);
  }

  // Floor, sills and the lower body
  b.block(0, 0.16, 0, 1.84, 0.14, 3.7, black);
  b.block(0, 0.3, 0.15, 1.82, 0.5, 2.6, paint);

  // Nose: bumper with three big intakes, a splitter, and a hood that slopes down to it
  b.block(0, 0.26, 1.95, 1.84, 0.34, 0.26, paint);
  b.block(0, 0.3, 2.09, 0.8, 0.18, 0.02, black);
  for (const sx of [-0.66, 0.66]) b.block(sx, 0.3, 2.09, 0.34, 0.2, 0.02, black);
  b.block(0, 0.18, 2.12, 1.94, 0.05, 0.3, carbon);
  b.block(0, 0.6, 1.1, 1.08, 0.12, 0.85, paint);
  b.block(0, 0.6, 1.62, 1.08, 0.06, 0.3, paint);
  b.block(0, 0.72, 1.0, 0.36, 0.015, 0.4, black); // hood vent
  // Raised front fenders with louvres on top and round headlights at the front
  for (const sx of [-1, 1]) {
    const x = sx * 0.68;
    b.block(x, 0.6, 1.25, 0.48, 0.22, 1.5, paint);
    b.block(x, 0.82, 1.15, 0.42, 0.04, 1.1, paint);
    for (let k = 0; k < 5; k++) b.block(x, 0.86, 1.0 + k * 0.12, 0.3, 0.015, 0.05, black);
    b.geom(cylinder(0.19, 0.19, 0.06, 16), rot(x, 0.68, 1.99, Math.PI / 2 - 0.5), black);
    b.geom(cylinder(0.16, 0.16, 0.07, 16), rot(x, 0.69, 2.0, Math.PI / 2 - 0.5), light);
    b.geom(cylinder(0.06, 0.06, 0.08, 8), rot(x, 0.69, 2.01, Math.PI / 2 - 0.5), '#ffffff');
    // Door mirror on a slim stalk
    b.box(sx * 0.98, 1.0, 0.42, 0.06, 0.05, 0.12, black);
    b.box(sx * 1.06, 1.02, 0.42, 0.14, 0.12, 0.2, paint);
  }

  // Cabin: steep windscreen, short roof, side glass, then the fastback down to the tail
  gl.geom(new THREE.BoxGeometry(1.38, 0.66, 0.04), rot(0, 1.1, 0.62, -1.0), glass);
  for (const sx of [-0.7, 0.7]) b.geom(new THREE.BoxGeometry(0.07, 0.68, 0.07), rot(sx, 1.1, 0.62, -1.0), black);
  b.block(0, 1.32, -0.12, 1.38, 0.07, 0.86, paint);
  b.block(0, 1.385, -0.12, 0.5, 0.02, 0.8, dark); // roof channel
  for (const sx of [-0.71, 0.71]) {
    gl.block(sx, 0.85, 0.02, 0.03, 0.42, 0.95, glass);
    b.block(sx, 0.82, 0.05, 0.05, 0.04, 1.1, black); // window frame
  }
  // Rear pillars sweep from the roof down onto the hips, so the roof sits on the body
  for (const sx of [-0.69, 0.69]) {
    b.geom(new THREE.BoxGeometry(0.07, 0.07, 0.9), rot(sx, 1.15, -0.85, -0.38), paint);
    b.geom(new THREE.BoxGeometry(0.06, 0.32, 0.7), rot(sx, 1.02, -0.85, -0.38), paint);
    b.box(sx, 1.08, 0.5, 0.07, 0.5, 0.06, black); // B-pillar edge of the door glass
  }
  // Fastback: rear glass, then the engine cover with cooling slats
  gl.geom(new THREE.BoxGeometry(1.2, 0.04, 0.55), rot(0, 1.23, -0.75, -0.32), glass);
  b.geom(new THREE.BoxGeometry(1.5, 0.08, 0.95), rot(0, 1.05, -1.42, -0.3), paint);
  for (let k = 0; k < 5; k++) b.geom(new THREE.BoxGeometry(0.9, 0.02, 0.05), rot(0, 1.13 - k * 0.05, -1.2 - k * 0.16, -0.3), black);

  // Wide rear hips with side intakes just behind the doors
  for (const sx of [-1, 1]) {
    b.block(sx * 0.82, 0.3, -1.15, 0.42, 0.62, 1.7, paint);
    b.block(sx * 0.82, 0.92, -1.2, 0.36, 0.06, 1.4, paint);
    b.block(sx * 1.03, 0.58, -0.45, 0.02, 0.26, 0.32, black);
    b.block(sx * 0.93, 0.18, 0.15, 0.05, 0.1, 2.0, carbon); // side skirt
  }

  // Tail: light bar across the back, a big diffuser and two centre exhausts
  b.block(0, 0.4, -2.0, 1.98, 0.58, 0.24, paint);
  b.block(0, 0.86, -2.13, 1.9, 0.05, 0.02, red);
  for (const sx of [-0.85, 0.85]) b.block(sx, 0.76, -2.13, 0.22, 0.12, 0.02, red);
  b.block(0, 0.6, -2.13, 1.2, 0.14, 0.02, black); // grille over the engine
  b.block(0, 0.16, -2.0, 1.7, 0.24, 0.26, carbon);
  for (let k = -2; k <= 2; k++) b.block(k * 0.32, 0.16, -2.12, 0.04, 0.22, 0.12, black);
  for (const sx of [-0.12, 0.12]) {
    b.geom(cylinder(0.08, 0.08, 0.16, 12), rot(sx, 0.36, -2.15, Math.PI / 2), metal);
    b.geom(cylinder(0.055, 0.055, 0.17, 12), rot(sx, 0.36, -2.15, Math.PI / 2), black);
  }

  // Swan-neck rear wing: uprights hook over the top of a wide main plane, tall endplates
  for (const sx of [-0.42, 0.42]) {
    b.box(sx, 1.3, -1.82, 0.06, 0.56, 0.14, carbon);
    b.box(sx, 1.64, -1.9, 0.06, 0.12, 0.3, carbon);
  }
  b.box(0, 1.56, -1.98, 1.96, 0.06, 0.46, carbon);
  b.box(0, 1.64, -2.16, 1.96, 0.04, 0.14, carbon); // gurney flap
  for (const sx of [-1, 1]) b.box(sx * 0.99, 1.52, -1.98, 0.04, 0.34, 0.58, black);
}

/**
 * Where the rider sits and how. The player is drawn a little smaller on vehicles (RIDER_SCALE)
 * so a grown-up fits in a car cabin. Heights are worked out from the avatar rig: seated, the
 * hips are 0.41 above the rider origin, the shoulders 0.94 and the top of the head 1.43.
 */
const RIDER_SCALE = 0.85;
interface Seat {
  x: number;
  y: number;
  z: number;
  ride: NonNullable<AnimState['ride']>;
  reach?: number;
  lean?: number;
}

function driverSeat(def: VehicleDef): Seat {
  switch (def.type) {
    case 'bike':
      if (def.id === 'volt-streak') return { x: 0, y: 0.5, z: -0.38, ride: 'straddle', reach: 1.05, lean: 0.42 };
      // Hips on the saddle, leaning to the bars
      return { x: 0, y: 0.69, z: -0.3, ride: 'pedal', reach: 0.98, lean: 0.4 };
    case 'scooter':
      return { x: 0, y: 0.29, z: 0.05, ride: 'stand', reach: 0.87, lean: 0.12 };
    case 'kart':
      if (def.id === 'dune-hopper') return { x: 0, y: 0.22, z: -0.25, ride: 'drive', reach: 1.3, lean: 0.02 };
      return { x: 0, y: 0.04, z: -0.3, ride: 'drive', reach: 1.35, lean: 0.02 };
    case 'car': {
      if (def.id === 'roadster') return { x: 0.38, y: 0.24, z: -0.6, ride: 'drive', reach: 1.3 };
      const { sporty, cabZ } = carDims(def);
      // Head clears the roof; left-hand driving seat
      return { x: 0.38, y: sporty ? -0.07 : 0.24, z: cabZ - 0.15, ride: 'drive', reach: 1.35 };
    }
    case 'boat':
      if (def.id === 'jet-ski') return { x: 0, y: 0.18, z: -0.38, ride: 'straddle', reach: 1.0, lean: 0.38 };
      return def.id === 'speedboat' ? { x: 0.35, y: 0.34, z: -0.6, ride: 'drive', reach: 1.25 } : { x: 0, y: -0.26, z: 0.05, ride: 'paddle', reach: 1.25 };
    case 'plane':
      return { x: 0, y: 1.07, z: 1.0, ride: 'drive', reach: 1.3 };
    case 'heli':
      return { x: 0.35, y: 0.6, z: 0.95, ride: 'drive', reach: 1.2 };
  }
}

/** Kayak paddle: in the rider's hands, dipping side to side in step with the stroke. */
function Paddle({ anim, held }: { anim: React.RefObject<AnimState>; held: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current || !held) return;
    const k = Math.sin((anim.current?.phase ?? 0) * 0.9);
    ref.current.rotation.z = k * 0.42;
  });
  return (
    <group ref={ref} position={held ? [0, 0.47, 0.62] : [0, 0.5, -0.5]} rotation={held ? [0, 0, 0] : [0, 0.4, 0]}>
      <mesh material={vehicleMaterial}>
        <boxGeometry args={[2.3, 0.05, 0.05]} />
      </mesh>
      {[1.1, -1.1].map((x) => (
        <mesh key={x} position={[x, 0, 0]} material={paddleBlade}>
          <boxGeometry args={[0.3, 0.03, 0.18]} />
        </mesh>
      ))}
    </group>
  );
}
const paddleBlade = new THREE.MeshLambertMaterial({ color: '#f2b234' });

export function VehicleModel({ itemId, rider, color }: { itemId: string; rider?: AvatarConfig; color?: string }) {
  const def = vehicleDef(itemId);
  const geo = useMemo(() => (def ? buildVehicle(def, color) : null), [def, color]);
  const seat = useMemo(() => (def ? driverSeat(def) : null), [def]);
  const tilt = useRef<THREE.Group>(null);
  const anim = useRef<AnimState>({ speed: 0, grounded: true });
  if (seat) Object.assign(anim.current, { ride: seat.ride, reach: seat.reach, lean: seat.lean });
  useFrame((state) => {
    if (!tilt.current || !rt.vehicle || !def) return;
    // Pedalling and paddling keep pace with the vehicle
    anim.current.speed = Math.abs(rt.vehicle.speed) / Math.max(1, def.topSpeed);
    // Lean bikes into turns / bob boats
    if (def.type === 'boat') {
      tilt.current.rotation.z = Math.sin(state.clock.elapsedTime * 1.6) * 0.04;
      tilt.current.rotation.x = -Math.min(0.12, rt.vehicle.speed * 0.006);
    } else if (def.type === 'plane') {
      tilt.current.rotation.x = rt.vehicle.alt > 0.5 ? -0.08 : 0;
    } else if (def.type === 'heli') {
      // Nose dips as it flies forward, with a gentle hover sway
      const air = rt.vehicle.alt > 0.5;
      tilt.current.rotation.x = air ? Math.max(-0.08, Math.min(0.16, rt.vehicle.speed * 0.005)) : 0;
      tilt.current.rotation.z = air ? Math.sin(state.clock.elapsedTime * 1.3) * 0.02 : 0;
    }
  });
  if (!def || !geo || !seat) return null;
  return (
    <group ref={tilt}>
      <mesh geometry={geo.body} material={vehicleMaterial} castShadow />
      {geo.glass && <mesh geometry={geo.glass} material={glassMaterial} renderOrder={2} />}
      {def.id === 'kayak' && <Paddle anim={anim} held={!!rider} />}
      {def.type === 'heli' && <Rotor spin={!!rider} />}
      {rider && (
        <group position={[seat.x, seat.y, seat.z]} scale={RIDER_SCALE}>
          <Avatar config={rider} anim={anim} />
        </group>
      )}
    </group>
  );
}
