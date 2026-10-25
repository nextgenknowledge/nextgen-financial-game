import type { Mood } from '@/game/effects';
import { asset } from './common';

/*
 * NextGen Narwhal's picture and faces, cut out of the character sheet in
 * public/brand/nextgen-narwhal-sheet.png (same art, transparent background).
 */
export const NARWHAL_ART = asset('/guide/narwhal.png');

export const narwhalFace = (mood: Mood) => asset(`/guide/narwhal-${mood}.png`);
