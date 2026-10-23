import type { CityDef } from '@/game/content';
import type { LocationId } from '@/game/types';
import park from '@/data/cities/park.json';
import newYork from '@/data/cities/new-york.json';
import london from '@/data/cities/london.json';
import hongKong from '@/data/cities/hong-kong.json';
import sanFrancisco from '@/data/cities/san-francisco.json';
import singapore from '@/data/cities/singapore.json';

export const CITIES: Record<LocationId, CityDef> = {
  park: park as unknown as CityDef,
  'new-york': newYork as unknown as CityDef,
  london: london as unknown as CityDef,
  'hong-kong': hongKong as unknown as CityDef,
  'san-francisco': sanFrancisco as unknown as CityDef,
  singapore: singapore as unknown as CityDef,
};

export const CITY_META: Record<LocationId, { name: string; icon: string; color: string; theme: string; traffic: string[] }> = {
  park: { name: 'Fin-City Park', icon: '🌳', color: '#3cc45a', theme: 'Home base', traffic: ['#e1553f', '#2f6bdb', '#ffcf3f', '#f4f6fa', '#3cc45a'] },
  'san-francisco': { name: 'San Francisco', icon: '🌉', color: '#e1653b', theme: 'Earning, careers & tech', traffic: ['#f4f6fa', '#2f6bdb', '#3a3f4a', '#e1553f', '#3cc45a', '#8aa1c9'] },
  'new-york': { name: 'New York', icon: '🗽', color: '#ffcf3f', theme: 'Investing & markets', traffic: ['#ffcf3f', '#ffcf3f', '#ffcf3f', '#1e2840', '#f4f6fa', '#8aa1c9'] },
  london: { name: 'London', icon: '🎡', color: '#e1553f', theme: 'Budgeting & smart shopping', traffic: ['#d0302a', '#1e1a18', '#1e1a18', '#f4f6fa', '#2f6bdb', '#3a6b4a'] },
  'hong-kong': { name: 'Hong Kong', icon: '🏮', color: '#f06aa8', theme: 'Business & trade', traffic: ['#d0302a', '#d0302a', '#3cc45a', '#f4f6fa', '#2f6bdb'] },
  singapore: { name: 'Singapore', icon: '🦁', color: '#2ebaba', theme: 'Saving, protection & the long term', traffic: ['#2f6bdb', '#f4f6fa', '#3a3f4a', '#2ebaba', '#e1553f'] },
};

export function buildingById(id: string) {
  for (const c of Object.values(CITIES)) {
    const b = c.buildings.find((x) => x.id === id);
    if (b) return { building: b, city: c };
  }
  return null;
}
