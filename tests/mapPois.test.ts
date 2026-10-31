import { describe, expect, it } from 'vitest';
import { CITIES } from '@/world/cities';
import { landmarkPois, MAP_LANDMARKS, MAP_SKIPPED_LANDMARKS } from '@/ui/map/pixelMap';

describe('city maps', () => {
  it('every landmark in every city is either pinned on the map or a deliberately skipped prop', () => {
    for (const c of Object.values(CITIES))
      for (const lm of c.landmarks) expect(MAP_LANDMARKS.has(lm.type) || MAP_SKIPPED_LANDMARKS.has(lm.type), `${c.id}: ${lm.type}`).toBe(true);
  });
  it('each city shows its landmarks, its car parking, unfunded projects as sites and owned homes', () => {
    for (const c of Object.values(CITIES)) {
      const pois = landmarkPois(c, { building: new Set(), homes: [] });
      expect(pois.length, c.id).toBeGreaterThan(2);
      expect(pois.some((p) => p.id === 'lm:garage'), c.id).toBe(true);
      for (const p of pois) expect(p.name).not.toMatch(/—/);
    }
    const park = landmarkPois(CITIES.park, { building: new Set(['garden']), homes: [{ uid: 'h1', name: 'Maple Lane · Lot 1, Cozy Cottage', x: 84, z: 42 }] });
    expect(park.find((p) => p.name.startsWith('Flower Garden'))?.glyph).toBe('construction');
    expect(park.find((p) => p.id === 'home:h1')?.name).toBe('Your home: Maple Lane · Lot 1, Cozy Cottage');
    expect(park.some((p) => p.name.includes('Homes'))).toBe(true);
  });
});
