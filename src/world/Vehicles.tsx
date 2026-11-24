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
  const out: VehicleGeo = { body: b.build(), glass: hasGlass ? gl.build() : null };
  geoCache.set(key, out);
  return out;
}

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
      // Hips on the saddle, leaning to the bars
      return { x: 0, y: 0.69, z: -0.3, ride: 'pedal', reach: 0.98, lean: 0.4 };
    case 'scooter':
      return { x: 0, y: 0.29, z: 0.05, ride: 'stand', reach: 0.87, lean: 0.12 };
    case 'kart':
      return { x: 0, y: 0.04, z: -0.3, ride: 'drive', reach: 1.35, lean: 0.02 };
    case 'car': {
      const { sporty, cabZ } = carDims(def);
      // Head clears the roof; left-hand driving seat
      return { x: 0.38, y: sporty ? -0.07 : 0.24, z: cabZ - 0.15, ride: 'drive', reach: 1.35 };
    }
    case 'boat':
      return def.id === 'speedboat' ? { x: 0.35, y: 0.34, z: -0.6, ride: 'drive', reach: 1.25 } : { x: 0, y: -0.26, z: 0.05, ride: 'paddle', reach: 1.25 };
    case 'plane':
      return { x: 0, y: 1.07, z: 1.0, ride: 'drive', reach: 1.3 };
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
    }
  });
  if (!def || !geo || !seat) return null;
  return (
    <group ref={tilt}>
      <mesh geometry={geo.body} material={vehicleMaterial} castShadow />
      {geo.glass && <mesh geometry={geo.glass} material={glassMaterial} renderOrder={2} />}
      {def.id === 'kayak' && <Paddle anim={anim} held={!!rider} />}
      {rider && (
        <group position={[seat.x, seat.y, seat.z]} scale={RIDER_SCALE}>
          <Avatar config={rider} anim={anim} />
        </group>
      )}
    </group>
  );
}
