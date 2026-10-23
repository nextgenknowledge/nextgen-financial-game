/**
 * The event bus. Everything that "happens" in the game is recorded here once, and quests,
 * challenges, achievements, stats and badges all react to it. New content only needs data.
 */
import type { WorldState } from '../types';
import type { Fx } from '../effects';
import { addStat } from './xp';
import { questsOnEvent } from './quests';
import { challengesOnEvent } from './challenges';
import { checkAchievements } from './achievements';
import { seasonalOnEvent } from './seasonal';

export interface GameEvent {
  type: string;
  target?: string;
  value?: number;
  stars?: number;
  topic?: string;
  correct?: boolean;
  city?: string;
}

export function recordEvent(w: WorldState, fx: Fx, ev: GameEvent) {
  if (ev.type !== 'move') {
    addStat(w, `ev:${ev.type}`);
    if (ev.target) addStat(w, `ev:${ev.type}:${ev.target}`);
  } else {
    addStat(w, 'metersWalked', ev.value ?? 0);
  }
  switch (ev.type) {
    case 'enterBuilding':
      if (ev.target && !w.progress.seenBuildings.includes(ev.target)) w.progress.seenBuildings.push(ev.target);
      break;
    case 'answer':
      addStat(w, ev.correct ? 'questionsCorrect' : 'questionsWrong');
      if (ev.topic) {
        const t = (w.progress.topics[ev.topic] ??= { correct: 0, total: 0 });
        t.total++;
        if (ev.correct) t.correct++;
      }
      break;
    case 'activityComplete':
      addStat(w, 'activitiesCompleted');
      if ((ev.stars ?? 0) >= 3) addStat(w, 'threeStars');
      if (ev.city) addStat(w, `city:${ev.city}`);
      break;
  }
  questsOnEvent(w, fx, ev);
  challengesOnEvent(w, fx, ev);
  seasonalOnEvent(w, fx, ev);
  if (ev.type !== 'move') checkAchievements(w, fx);
}
