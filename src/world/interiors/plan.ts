/**
 * Room planning shared by the interior scene and its tests: which interior kind a building uses,
 * how big the room is, where the service counters stand and which area is free for furniture.
 */
import type { BuildingDef } from '@/game/content';
import { BUILDING_INTERIOR, KINDS, type InteriorKind } from './furnish';

export interface Layout {
  w: number;
  d: number;
  h: number;
  spots: { x: number; z: number; rot: number }[];
  sides: boolean;
}


export function kindFor(b: BuildingDef): InteriorKind {
  const id = BUILDING_INTERIOR[b.id];
  if (id && KINDS[id]) return KINDS[id];
  const theme = b.interior?.theme ?? 'office';
  return KINDS[{ bank: 'bank-hall', exchange: 'trading-floor', library: 'library', civic: 'council', arcade: 'arcade', shop: 'grocery', boutique: 'boutique', pets: 'pets', showroom: 'showroom', travel: 'travel', welcome: 'atrium' }[theme] ?? 'open-office'];
}

export function layoutFor(n: number, kind: InteriorKind): Layout {
  const [w0, d, h] = kind.size;
  const w = Math.max(w0, n * 6 + 8);
  const spots: Layout['spots'] = [];
  if (kind.sideStations) {
    for (let i = 0; i < n; i++) {
      const left = i % 2 === 0;
      spots.push({ x: left ? -w / 2 + 2.6 : w / 2 - 2.6, z: -d / 2 + 9 + Math.floor(i / 2) * 5, rot: left ? Math.PI / 2 : -Math.PI / 2 });
    }
    return { w, d, h, spots, sides: n > 0 };
  }
  // Counters along the back wall first, then the side walls
  const back = Math.min(n, Math.max(2, Math.ceil(n * 0.6)));
  for (let i = 0; i < back; i++) spots.push({ x: -w / 2 + ((i + 0.5) * w) / back, z: -d / 2 + 2.6, rot: 0 });
  const rest = n - back;
  for (let i = 0; i < rest; i++) {
    const left = i % 2 === 0;
    spots.push({ x: left ? -w / 2 + 2.6 : w / 2 - 2.6, z: -1 + Math.floor(i / 2) * 5, rot: left ? Math.PI / 2 : -Math.PI / 2 });
  }
  return { w, d, h, spots, sides: rest > 0 };
}


/** Area the furnisher may fill, leaving the counters, the entrance and the side walls clear. */
export function zoneFor(L: Layout) {
  const x1 = L.sides ? L.w / 2 - 7 : L.w / 2 - 1.6;
  return { x0: -x1, x1, z0: -L.d / 2 + 7, z1: L.d / 2 - 3.5 };
}
