import type { ActivityDef } from '@/game/content';
import type { Difficulty } from '@/game/types';
import type { ActivityResult } from '@/game/progress/activities';

export interface KindProps<P = Record<string, unknown>> {
  def: ActivityDef;
  params: P;
  difficulty: Difficulty;
  /** Call once when the round ends. */
  onFinish: (r: ActivityResult) => void;
  /** Review items shown on the results screen. */
  addReview?: (item: ReviewItem) => void;
  seed: number;
}

export interface ReviewItem {
  q: string;
  ok: boolean;
  answer: string;
  explanation: string;
}
