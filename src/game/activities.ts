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

/** Entry activity id → the Advanced activity that replaces it. */
export const PRO_TWIN = new Map(ACTIVITIES.filter((a) => a.replaces).map((a) => [a.replaces!, a.id]));

/** True when a played activity satisfies a goal that names `target` (its Advanced twin counts too). */
export const sameActivity = (played: string | undefined, target: string) => played === target || (!!played && PRO_TWIN.get(target) === played);

/** Wording for the player's difficulty: Entry and Advanced variants fall back to the plain text. */
export function textFor<T extends { text: string; entryText?: string; proText?: string }>(o: T, difficulty: string) {
  return (difficulty === 'entry' ? o.entryText : o.proText) ?? o.text;
}
