'use client';
import type { KindProps } from '../types';
import { MakeChange } from '../skills';

/** Timed making-change game at the Corner Shop (reuses the cashier skill). */
export default function ChangeCounter({ params, difficulty, onFinish, seed }: KindProps<{ rounds: number }>) {
  return <MakeChange entry={difficulty === 'entry'} tier={difficulty === 'entry' ? 1 : 3} seed={seed} rounds={params.rounds} onDone={(score) => onFinish({ score })} />;
}
