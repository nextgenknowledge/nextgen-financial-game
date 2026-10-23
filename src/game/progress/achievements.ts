import data from '@/data/achievements.json';
import type { WorldState } from '../types';
import type { Fx } from '../effects';
import { derivedStat } from './quests';
import { netWorth } from '../finance/netWorth';
import { grantXp } from './xp';

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  condition: { stat?: string; gte?: number; netWorth?: number; level?: number; topicCorrect?: string };
  xp: number;
  advanced?: boolean;
}

export const ACHIEVEMENTS = data.achievements as AchievementDef[];

export function achievementProgress(w: WorldState, a: AchievementDef): { value: number; target: number } {
  const c = a.condition;
  if (c.netWorth !== undefined) return { value: Math.max(0, netWorth(w).total), target: c.netWorth };
  if (c.level !== undefined) return { value: w.progress.level, target: c.level };
  if (c.topicCorrect) return { value: w.progress.topics[c.topicCorrect]?.correct ?? 0, target: c.gte ?? 1 };
  if (c.stat === 'citiesVisited') {
    const n = ['new-york', 'london', 'hong-kong', 'san-francisco', 'singapore'].filter((x) => (w.progress.stats[`ev:travel:${x}`] ?? 0) > 0).length;
    return { value: n, target: c.gte ?? 1 };
  }
  if (c.stat === 'outfitsOwned' || c.stat === 'collectiblesOwned') {
    return { value: w.progress.stats[c.stat] ?? 0, target: c.gte ?? 1 };
  }
  return { value: derivedStat(w, c.stat ?? ''), target: c.gte ?? 1 };
}

export function checkAchievements(w: WorldState, fx: Fx) {
  for (const a of ACHIEVEMENTS) {
    if (w.progress.achievements[a.id]) continue;
    if (a.advanced && w.difficulty === 'entry') continue;
    const p = achievementProgress(w, a);
    if (p.value >= p.target) {
      w.progress.achievements[a.id] = Date.now();
      fx.push({ type: 'achievement', id: a.id, name: a.name, icon: a.icon });
      grantXp(w, fx, a.xp, { raw: true });
    }
  }
}

/** Skill badges per topic: bronze / silver / gold by correct answers. */
export const BADGE_TIERS = [
  { name: 'Bronze', at: 10, color: '#c98e4a' },
  { name: 'Silver', at: 40, color: '#b9bec9' },
  { name: 'Gold', at: 100, color: '#ffcf3f' },
];

export function badgeTier(w: WorldState, topic: string): number {
  const c = w.progress.topics[topic]?.correct ?? 0;
  let tier = 0;
  for (let i = 0; i < BADGE_TIERS.length; i++) if (c >= BADGE_TIERS[i].at) tier = i + 1;
  return tier;
}
