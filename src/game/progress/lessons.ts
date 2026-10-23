import data from '@/data/lessons.json';
import community from '@/data/community.json';
import type { WorldState } from '../types';
import type { Fx } from '../effects';
import { grantXp } from './xp';
import { recordEvent } from './events';

export interface LessonDef {
  id: string;
  topic: string;
  icon: string;
  title: string;
  slides: { entry: string; advanced: string }[];
  check: { prompt: string; choices: string[]; answer: number; explanation: string };
  perk?: { id: string; name: string; desc: string };
  reward: { xp: number; cash: number };
}

export const LESSONS = data.lessons as LessonDef[];

/** Activity reward multiplier from perks (e.g. Market Eye for Stock Exchange games). */
export const PERK_ACTIVITY_BOOST: Record<string, { activities?: string[]; cities?: string[]; boost: number }> = {
  'budget-boss': { activities: ['budget-planner', 'grocery', 'pet-budget', 'travel-budget'], boost: 0.1 },
  'market-eye': { activities: ['candle-predict', 'newsroom', 'portfolio-challenge'], boost: 0.1 },
  'safe-surfer': { activities: ['cyber-lab'], boost: 0.1 },
  'biz-savvy': { cities: ['hong-kong'], boost: 0.1 },
};

export function perkBoost(w: WorldState, activityId: string, city: string): number {
  let b = 0;
  for (const p of w.progress.perks) {
    const d = PERK_ACTIVITY_BOOST[p];
    if (!d) continue;
    if (d.activities?.includes(activityId) || d.cities?.includes(city)) b += d.boost;
  }
  return b;
}

export function completeLesson(w: WorldState, fx: Fx, id: string, correct: boolean) {
  const l = LESSONS.find((x) => x.id === id);
  if (!l) return;
  const first = !w.progress.lessons.includes(id);
  recordEvent(w, fx, { type: 'answer', correct, topic: l.topic });
  if (!correct) return;
  if (!first) {
    grantXp(w, fx, 10);
    return;
  }
  w.progress.lessons.push(id);
  w.progress.stats.lessonsRead = (w.progress.stats.lessonsRead ?? 0) + 1;
  w.progress.collection[`lesson:${l.title}`] = 1;
  const wing = (w.progress.community['library-wing'] ?? 0) >= (community.projects.find((p) => p.id === 'library-wing')?.cost ?? Infinity) ? 1.1 : 1;
  if (l.reward.cash) w.finance.cash += Math.round(l.reward.cash * wing);
  grantXp(w, fx, Math.round(l.reward.xp * wing));
  if (l.perk && !w.progress.perks.includes(l.perk.id)) {
    w.progress.perks.push(l.perk.id);
    fx.push({ type: 'toast', text: `Perk unlocked: ${l.perk.name}, ${l.perk.desc}`, icon: '✨', tone: 'gold' });
  }
  fx.push({ type: 'sfx', name: 'star' });
  fx.push({ type: 'toast', text: `Lesson complete: ${l.title}`, icon: l.icon, tone: 'good' });
  recordEvent(w, fx, { type: 'lesson', target: id });
}
