/**
 * Learning milestones for Google Analytics. Only event names and game content ids are ever sent,
 * never nicknames, world names or answers. "First" comes from the event tallies, so a save that
 * reached a milestone before this existed doesn't report it again.
 */
import type { WorldState } from '../types';
import type { Fx } from '../effects';
import { sameActivity } from '../activities';
import type { GameEvent } from './events';

export function milestonesOnEvent(w: WorldState, fx: Fx, ev: GameEvent) {
  const st = w.progress.stats;
  const track = (name: string, params?: Record<string, string | number>) => fx.push({ type: 'track', name, params });
  switch (ev.type) {
    case 'activityComplete':
      if (sameActivity(ev.target, 'first-quiz') && st[`ev:activityComplete:${ev.target}`] === 1) track('first_quiz');
      if ((ev.stars ?? 0) >= 3 && st.threeStars === 1) track('first_three_star');
      break;
    case 'buy':
      if (st['ev:buy'] === 1) track('first_purchase');
      break;
    case 'invest':
      if (st['ev:invest'] === 1) track('first_investment');
      break;
    case 'travel': {
      if (!ev.target || ev.target === 'park') break;
      const cities = Object.keys(st).filter((k) => k.startsWith('ev:travel:') && k !== 'ev:travel:park');
      if (cities.length === 1 && st[cities[0]] === 1) track('first_city', { city: ev.target });
      break;
    }
    case 'lesson':
      if (st[`ev:lesson:${ev.target}`] === 1) track('lesson_completed', { lesson: ev.target ?? '' });
      break;
  }
}
