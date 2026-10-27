/**
 * Per-frame mutable state shared between 3D components and the HUD. Kept out of React/Zustand
 * so 60 fps updates don't re-render the UI.
 */
import * as THREE from 'three';
import { CollisionWorld } from './collision';

export interface Trigger {
  id: string;
  kind: 'door' | 'portal' | 'npc' | 'station' | 'exit' | 'vehicle' | 'plot' | 'sign' | 'checkpoint' | 'board';
  x: number;
  z: number;
  r: number;
  label: string;
  icon?: string;
  /** Data for the handler (building id, portal target, activity id…). */
  data?: Record<string, unknown>;
  locked?: boolean;
}

export interface Marker {
  id: string;
  x: number;
  z: number;
  label?: string;
  color?: string;
}

export const rt = {
  collision: new CollisionWorld(),
  triggers: [] as Trigger[],
  player: new THREE.Vector3(0, 0, 0),
  playerVel: new THREE.Vector3(),
  playerRotY: 0,
  playerSpeed: 0,
  grounded: true,
  /** Set when the player leaves the ground in a jump (keyboard or touch button); quests read and clear it. */
  jumped: false,
  camYaw: Math.PI,
  camPitch: 0.42,
  camDist: 8,
  walkTarget: null as THREE.Vector3 | null,
  /** Remaining turning points of a click-to-walk route (see engine/walk.ts). */
  walkPath: null as [number, number][] | null,
  /** Where Narwhal should point / fly toward (quest goal). */
  goal: null as Marker | null,
  /** Extra markers to render (delivery checkpoints, etc). */
  markers: [] as Marker[],
  nearTrigger: null as Trigger | null,
  vehicle: null as null | {
    uid: string;
    itemId: string;
    type: 'bike' | 'scooter' | 'car' | 'boat' | 'plane' | 'kart';
    speed: number;
    yaw: number;
    alt: number;
    pos: THREE.Vector3;
  },
  /** Where parked vehicles spawn in the current scene. */
  garage: { x: 0, z: 0, rot: 0 },
  dock: null as null | { x: number; z: number; rot: number },
  /** The player's vehicle parked in the current scene (not being ridden). */
  parked: null as null | { uid: string; itemId: string; x: number; z: number; rot: number; scene: string },
  weather: 'clear' as 'clear' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'haze',
  /** Strength of the current weather at this hour (0 … 1). */
  weatherAmt: 0,
  sceneKey: '',
  timeOfDay: 0.3,
  dayLight: 1,
  /** Walking route from the player to the goal (world points), for Narwhal and the ground trail. */
  guidePath: null as null | [number, number][],
  /** Arrival flyover queued for when the loading screen clears (first visit to a city). */
  flyoverPending: null as null | { half: number },
  /** Arrival flyover in progress: a sweep around the skyline that settles behind the player. */
  flyover: null as null | { start: number; dur: number; half: number },
  /** Developer photo camera (position + look-at). Unused in normal play. */
  photo: null as null | { pos: [number, number, number]; look: [number, number, number] },
  /** Direction toward the sun (updated by the sky each frame). */
  sunDir: new THREE.Vector3(0.4, 0.8, 0.45),
  sunColor: new THREE.Color('#fff0d8'),
  frame: 0,
  teleport(x: number, z: number, rotY?: number) {
    this.player.set(x, 0, z);
    this.playerVel.set(0, 0, 0);
    this.walkTarget = null;
    this.walkPath = null;
    if (rotY !== undefined) {
      this.playerRotY = rotY;
      this.camYaw = rotY + Math.PI;
    }
  },
  resetScene(key: string) {
    this.collision = new CollisionWorld();
    this.triggers = [];
    this.markers = [];
    this.nearTrigger = null;
    this.walkTarget = null;
    this.walkPath = null;
    this.sceneKey = key;
  },
};
