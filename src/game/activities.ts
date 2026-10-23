/** Loads every activity definition from src/data/activities/*.json. */
import type { ActivityDef } from './content';
import park from '@/data/activities/park.json';
import newYork from '@/data/activities/new-york.json';
import london from '@/data/activities/london.json';
import hongKong from '@/data/activities/hong-kong.json';
import sanFrancisco from '@/data/activities/san-francisco.json';
import singapore from '@/data/activities/singapore.json';

export const ACTIVITIES: ActivityDef[] = [park, newYork, london, hongKong, sanFrancisco, singapore].flatMap((f) => f.activities as unknown as ActivityDef[]);
export const ACTIVITY_BY_ID = new Map(ACTIVITIES.map((a) => [a.id, a]));
