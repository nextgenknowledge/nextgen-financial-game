import data from '@/data/seasonal.json';
import type { WorldState } from '../types';
import type { Fx } from '../effects';
import type { GameEvent } from './events';
import { grantXp } from './xp';

export interface SeasonalDef {
  id: string;
  months: number[];
  name: string;
  icon: string;
  text: string;
  xpBoost: number;
  challenge: { text: string; event: string; target?: string; topic?: string; city?: string; count: number; useValue?: boolean };
  reward: { cash?: number; xp?: number; title?: string };
}

export const SEASONAL = data.events as SeasonalDef[];

export function currentSeason(now = new Date()): SeasonalDef | null {
  return SEASONAL.find((s) => s.months.includes(now.getMonth())) ?? null;
}

function key(s: SeasonalDef, now = new Date()) {
  return `season:${s.id}:${now.getFullYear()}`;
}

export function seasonalProgress(w: WorldState, now = new Date()) {
  const s = currentSeason(now);
  if (!s) return null;
  const k = key(s, now);
  return { def: s, progress: (w.progress.stats[k] as number) ?? 0, claimed: !!w.progress.flags[`${k}:claimed`] };
}

export function seasonalOnEvent(w: WorldState, fx: Fx, ev: GameEvent, now = new Date()) {
  const s = currentSeason(now);
  if (!s) return;
  const c = s.challenge;
  if (ev.type !== c.event) return;
  if (c.target && ev.target !== c.target) return;
  if (c.topic && ev.topic !== c.topic) return;
  if (c.city && ev.city !== c.city) return;
  if (ev.type === 'answer' && !ev.correct) return;
  const k = key(s, now);
  const before = w.progress.stats[k] ?? 0;
  if (before >= c.count) return;
  w.progress.stats[k] = Math.min(c.count, before + (c.useValue ? ev.value ?? 0 : 1));
  if (w.progress.stats[k] >= c.count) fx.push({ type: 'toast', text: `${s.icon} ${s.name} challenge complete, claim it in FinPhone → Quests!`, icon: '🎉', tone: 'gold' });
}

export function claimSeasonal(w: WorldState, fx: Fx, now = new Date()) {
  const p = seasonalProgress(w, now);
  if (!p || p.claimed || p.progress < p.def.challenge.count) return;
  w.progress.flags[`${key(p.def, now)}:claimed`] = true;
  if (p.def.reward.cash) w.finance.cash += p.def.reward.cash;
  if (p.def.reward.xp) grantXp(w, fx, p.def.reward.xp);
  if (p.def.reward.title && !w.progress.titles.includes(p.def.reward.title)) w.progress.titles.push(p.def.reward.title);
  fx.push({ type: 'confetti' });
  fx.push({ type: 'sfx', name: 'cash' });
}
