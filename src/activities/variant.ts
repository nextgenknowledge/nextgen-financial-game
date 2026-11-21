/**
 * Picks which scenario set an activity plays this run. The seed decides, but the set played last
 * time (in this session) is skipped, so replaying always brings a different scenario.
 * Asking again with the same seed returns the same pick, so re-renders never switch scenarios.
 */
const last = new Map<string, { seed: number; i: number; prev?: number }>();

export function variantIndex(key: string, count: number, seed: number): number {
  if (count <= 1) return 0;
  const rec = last.get(key);
  if (rec && rec.seed === seed && rec.i < count) return rec.i;
  const prev = rec?.i;
  const s = Math.abs(Math.floor(seed));
  let i = s % count;
  if (i === prev) i = (i + 1 + (Math.floor(s / count) % (count - 1))) % count;
  last.set(key, { seed, i, prev });
  return i;
}

/** One item from a list, or the value itself when it is not a list. */
export function pickVariant<T>(key: string, v: T | T[], seed: number): T {
  return Array.isArray(v) ? v[variantIndex(key, v.length, seed)] : v;
}
