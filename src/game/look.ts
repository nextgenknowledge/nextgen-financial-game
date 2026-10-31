/**
 * Character body options: male or female, a build, and the hair styles offered for each.
 * Shared by the character screens, the 3D avatar and the Outfit Shop.
 */
import type { AvatarConfig, Body, OutfitSlot } from './types';
import outfits from '@/data/shop/outfits.json';

export const BODIES: { id: Body; label: string }[] = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
];

export const BUILDS = ['Slim', 'Regular', 'Athletic'];

/** Hair style ids are stored in saves, so new styles are only ever appended. */
export const HAIR_STYLES: Record<Body, { id: number; label: string }[]> = {
  male: [
    { id: 0, label: 'Short' },
    { id: 3, label: 'Buzz' },
    { id: 6, label: 'Side Part' },
    { id: 2, label: 'Curly' },
    { id: 5, label: 'Spiky' },
    { id: 7, label: 'Fade' },
    { id: 1, label: 'Shoulder' },
  ],
  female: [
    { id: 1, label: 'Long' },
    { id: 8, label: 'Ponytail' },
    { id: 4, label: 'Bun' },
    { id: 9, label: 'Bob' },
    { id: 10, label: 'Braids' },
    { id: 2, label: 'Curly' },
    { id: 11, label: 'Pixie' },
  ],
};

export const bodyOf = (a: Pick<AvatarConfig, 'body'>): Body => a.body ?? 'male';
export const buildOf = (a: Pick<AvatarConfig, 'build'>): number => a.build ?? 1;

/**
 * How wide the body is drawn. `torso` scales the chest and hips, `limb` the thickness of arms and
 * legs, `depth` front to back, `height` the whole figure. Differences are kept small on purpose.
 */
export function bodyScale(a: Pick<AvatarConfig, 'body' | 'build'>) {
  const female = bodyOf(a) === 'female';
  const build = buildOf(a);
  const b = [0.92, 1, 1.08][build] ?? 1;
  return {
    torso: (female ? 0.92 : 1) * b,
    limb: (female ? 0.94 : 1) * ([0.92, 1, 1.1][build] ?? 1),
    depth: ([0.95, 1, 1.05][build] ?? 1) * (female ? 0.96 : 1),
    height: female ? 0.97 : 1,
  };
}

/** Where the shoulder joints sit for a torso and limb scale (0.44 at the default size). */
export const armX = (torso: number, limb: number) => 0.33 * torso + 0.105 * limb + 0.005;

/** True if an outfit item is meant for this body (items with no `for` suit everyone). */
export const fitsBody = (it: { for?: string }, body: Body) => !it.for || it.for === body;

const ITEMS = new Map((outfits.items as { id: string; for?: string }[]).map((i) => [i.id, i]));
const SLOTS: OutfitSlot[] = ['hat', 'top', 'bottom', 'feet', 'accessory'];

/**
 * Change body, keeping everything else. The hair moves to a style offered for the new body, and
 * pieces cut for the other body come off (they stay owned and can be worn again from the Style Studio).
 */
export function withBody(a: AvatarConfig, body: Body): AvatarConfig {
  const styles = HAIR_STYLES[body];
  const hairStyle = styles.some((h) => h.id === a.hairStyle) ? a.hairStyle : styles[0].id;
  const out: AvatarConfig = { ...a, body, hairStyle };
  for (const slot of SLOTS) {
    const it = out[slot] ? ITEMS.get(out[slot]!) : undefined;
    if (it && !fitsBody(it, body)) out[slot] = null;
  }
  return out;
}
