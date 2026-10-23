/** TypeScript shapes for everything in src/data. See README "Adding content" for field docs. */
import type { CityId, Difficulty, LocationId, Topic } from './types';

export type Facing = 'north' | 'south' | 'east' | 'west';

export interface StationDef {
  /** Activity id (src/data/activities) or service id (bank, shop:<id>, atm, jobs, …). */
  activity?: string;
  service?: string;
  label: string;
  icon: string;
  npc?: string; // npc look id
}

export interface BuildingDef {
  id: string;
  name: string;
  icon: string;
  pos: [number, number]; // x, z (center)
  size: [number, number, number]; // width (x), depth (z), height
  door: Facing;
  style: string; // see BUILDING_STYLES in src/world/builders/buildings.ts
  colors?: { wall?: string; trim?: string; roof?: string; accent?: string };
  blurb: string;
  entryBlurb?: string;
  stations: StationDef[];
  /** Interior theme name and floor/wall colors. */
  interior?: { floor?: string; wall?: string; theme?: string };
  /** Quest id or level required before the door opens. */
  unlock?: { quest?: string; level?: number };
  /** Hidden in Entry mode (e.g. Tax Office), replaced by entryStations if given. */
  advancedOnly?: boolean;
  entryStations?: StationDef[];
}

export interface LandmarkDef {
  type: string; // see LANDMARKS in src/world/builders/landmarks.ts
  pos: [number, number];
  rot?: number; // degrees
  scale?: number;
  label?: string;
}

export interface PortalDef {
  to: LocationId;
  pos: [number, number];
  rot: number; // degrees, which way the portal faces
}

export interface WaterDef {
  x: number;
  z: number;
  w: number;
  d: number;
}

export interface CityDef {
  id: LocationId;
  name: string;
  tagline: string;
  theme: string; // money theme
  music: string;
  icon: string;
  half: number; // world half-size
  ground: string;
  palette: { walls: string[]; roofs: string[]; trims: string[]; accents: string[] };
  /** Road grid: road lines at these x and z coordinates. */
  roads: { xs: number[]; zs: number[]; width: number; color?: string };
  extraRoads?: { from: [number, number]; to: [number, number]; width: number }[];
  paths?: { from: [number, number]; to: [number, number]; width: number }[];
  plazas?: { pos: [number, number]; r: number; color?: string }[];
  water: WaterDef[];
  buildings: BuildingDef[];
  landmarks: LandmarkDef[];
  portals: PortalDef[];
  spawn: [number, number, number]; // x, z, rot(deg)
  garage: [number, number, number];
  dock?: [number, number, number];
  filler: { seed: number; density: number; minH: number; maxH: number; style: string };
  trees: { count: number; seed: number; kinds: string[] };
  npcs: number;
  traffic: number;
  boats: number;
  host: { name: string; look: string; pos: [number, number]; lines: string[]; entryLines?: string[] };
  /** Ambient decorations (lanterns, flags…) */
  decor?: string[];
  weather?: { rain: number; snow?: number; fog?: number };
}

export interface ActivityDef {
  id: string;
  name: string;
  kind: string;
  icon: string;
  building: string;
  city: LocationId;
  topics: Topic[];
  blurb: string;
  entryBlurb?: string;
  entry: Record<string, unknown> | null;
  advanced: Record<string, unknown> | null;
  /** Score thresholds for 1/2/3 stars (score is 0..100 unless stated). */
  stars?: [number, number, number];
  rewards: { cash: [number, number, number]; xp: [number, number, number] };
  /** Arcade games cost a fee and pay tickets instead of cash. */
  fee?: number;
  tickets?: [number, number, number];
}

export interface QuestionVar {
  min?: number;
  max?: number;
  step?: number;
  choices?: (number | string)[];
}

export interface QuestionMedia {
  type: 'table' | 'chart' | 'document' | 'image' | 'coins';
  title?: string;
  rows?: (string | number)[][];
  series?: number[];
  labels?: string[];
  lines?: string[];
  emoji?: string;
  coins?: Record<string, number>;
}

export interface QuestionDef {
  id: string;
  city: LocationId;
  building?: string;
  topic: Topic;
  difficulty: Difficulty;
  level: number; // 1..5
  type: 'mc' | 'tf' | 'numeric' | 'multi' | 'order';
  prompt: string;
  choices?: string[];
  /** mc/tf: index; multi: indices; order: correct order of choice indices; numeric: number */
  answer?: number | number[] | boolean;
  answerExpr?: string;
  choiceExprs?: string[];
  vars?: Record<string, QuestionVar>;
  derived?: Record<string, string>;
  tolerance?: number; // relative, e.g. 0.01 = 1%
  toleranceAbs?: number;
  unit?: string;
  format?: 'money' | 'pct' | 'int' | 'num' | 'years' | 'months';
  explanation: string;
  hint?: string;
  media?: QuestionMedia;
  icon?: string;
}

export interface QuestStep {
  id: string;
  text: string;
  entryText?: string;
  goal: { type: string; target?: string; count?: number; value?: number };
  /** Narwhal says these when the step starts. */
  say?: string[];
  entrySay?: string[];
  marker?: { location: LocationId; pos: [number, number]; label?: string };
  reward?: { cash?: number; xp?: number };
}

export interface QuestDef {
  id: string;
  title: string;
  icon: string;
  steps: QuestStep[];
  reward: { cash?: number; xp?: number; unlock?: LocationId[]; title?: string; item?: string };
  next?: string[];
  onboarding?: boolean;
  requires?: { quest?: string; level?: number };
  city?: LocationId;
}

export type { CityId };
