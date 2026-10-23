import questsData from '@/data/quests.json';
import type { QuestDef, QuestStep } from '../content';
import { PRO_TWIN, sameActivity } from '../activities';
import type { LocationId, WorldState } from '../types';
import type { Fx } from '../effects';
import { grantXp } from './xp';
import { netWorth } from '../finance/netWorth';
import type { GameEvent } from './events';
import outfits from '@/data/shop/outfits.json';

export const QUESTS = questsData.quests as unknown as QuestDef[];
export const QUEST_BY_ID = new Map(QUESTS.map((q) => [q.id, q]));

/** Derived stats quests can check without anyone having to keep them up to date. */
export function derivedStat(w: WorldState, key: string): number {
  switch (key) {
    case 'savingsBalance':
      return w.finance.savings;
    case 'holdingsCount':
      return Object.values(w.finance.holdings).filter((h) => h.shares > 0).length;
    case 'propertiesOwned':
      return w.assets.properties.length;
    case 'businessesOwned':
      return w.assets.businesses.length;
    case 'buildingsVisited':
      return w.progress.seenBuildings.length;
    case 'vehiclesOwned':
      return w.assets.vehicles.length;
    case 'petsOwned':
      return w.assets.pets.length;
    case 'level':
      return w.progress.level;
    default:
      return w.progress.stats[key] ?? 0;
  }
}

function stepTarget(step: QuestStep) {
  return step.goal.count ?? (step.goal.type === 'move' ? step.goal.value ?? 1 : 1);
}

/** How much this event advances a step's goal (0 = not relevant). */
function stepProgress(w: WorldState, step: QuestStep, ev: GameEvent): number {
  const g = step.goal;
  switch (g.type) {
    case 'move':
      return ev.type === 'move' ? ev.value ?? 0 : 0;
    case 'jump':
      return ev.type === 'jump' ? 1 : 0;
    case 'menu':
      return ev.type === 'menu' && ev.target === g.target ? 1 : 0;
    case 'enter':
      return ev.type === 'enterBuilding' && ev.target === g.target ? 1 : 0;
    case 'travel':
      return ev.type === 'travel' && ev.target === g.target ? 1 : 0;
    case 'talk':
      return ev.type === 'talk' && (!g.target || ev.target === g.target) ? 1 : 0;
    case 'activity':
      if (ev.type !== 'activityComplete') return 0;
      if (g.target && g.target !== '*' && !sameActivity(ev.target, g.target)) return 0;
      if (g.value && (ev.stars ?? 0) < g.value) return 0;
      return 1;
    case 'event':
      if (ev.type !== g.target) return 0;
      if (g.value && (ev.value ?? 0) < g.value) return 0;
      return 1;
    default:
      return 0;
  }
}

/**
 * True when a step's goal is already satisfied, either a state goal (net worth, stats) or an
 * action the player did earlier, before the quest asked for it. Every event is tallied in
 * `stats['ev:<type>:<target>']`, so out-of-order play never leaves a step impossible to finish.
 */
function stateComplete(w: WorldState, step: QuestStep): boolean {
  const g = step.goal;
  const st = w.progress.stats;
  const need = g.count ?? 1;
  switch (g.type) {
    case 'netWorth':
      return netWorth(w).total >= (g.value ?? 0);
    case 'stat':
      return derivedStat(w, g.target ?? '') >= (g.value ?? 1);
    case 'jump':
      return (st['ev:jump'] ?? 0) >= need;
    case 'menu':
      return (st[`ev:menu:${g.target}`] ?? 0) >= need;
    case 'enter':
      return w.progress.seenBuildings.includes(g.target ?? '');
    case 'travel':
      return w.player.location === g.target || (st[`ev:travel:${g.target}`] ?? 0) >= 1;
    case 'talk':
      return (st[g.target ? `ev:talk:${g.target}` : 'ev:talk'] ?? 0) >= need;
    case 'activity': {
      const stars = g.value ?? 0;
      if (!g.target || g.target === '*') return Object.values(w.progress.activities).some((a) => a.plays > 0 && a.stars >= stars);
      const a = w.progress.activities[g.target] ?? w.progress.activities[PRO_TWIN.get(g.target) ?? ''];
      return !!a && a.plays > 0 && a.stars >= stars;
    }
    case 'event':
      return !g.value && (st[`ev:${g.target}`] ?? 0) >= need;
    default:
      return false;
  }
}

export function sayStep(w: WorldState, fx: Fx, step: QuestStep) {
  const lines = w.difficulty === 'entry' ? step.entrySay ?? step.say : step.proSay ?? step.say;
  for (const text of lines ?? []) fx.push({ type: 'narwhal', text, mood: 'talking' });
}

export function startQuest(w: WorldState, fx: Fx, id: string, silent = false) {
  const q = QUEST_BY_ID.get(id);
  if (!q) return;
  if (w.progress.quests.completed.includes(id) || w.progress.quests.active.some((a) => a.id === id)) return;
  w.progress.quests.active.push({ id, step: 0, progress: 0 });
  // Skip straight past anything the player already did; otherwise introduce step 1.
  if (stateComplete(w, q.steps[0])) questsOnEvent(w, fx, { type: '__none' });
  else if (!silent && !q.epic) sayStep(w, fx, q.steps[0]);
}

/** Legendary quests run alongside the story from the start (once per world, per difficulty). */
export function startEpics(w: WorldState, fx: Fx) {
  for (const q of QUESTS) if (q.epic && (!q.difficulty || q.difficulty === w.difficulty)) startQuest(w, fx, q.id, true);
}

export function unlockLocation(w: WorldState, fx: Fx, loc: LocationId) {
  if (w.progress.unlocked.includes(loc)) return;
  w.progress.unlocked.push(loc);
  fx.push({ type: 'unlock', location: loc });
  fx.push({ type: 'toast', text: `New portal unlocked!`, icon: '🌀', tone: 'gold' });
}

function completeQuest(w: WorldState, fx: Fx, q: QuestDef) {
  w.progress.quests.active = w.progress.quests.active.filter((a) => a.id !== q.id);
  w.progress.quests.completed.push(q.id);
  fx.push({ type: 'questComplete', title: q.title });
  fx.push({ type: 'confetti' });
  const r = q.reward;
  if (r.cash) {
    w.finance.cash += r.cash;
    fx.push({ type: 'toast', text: `Quest reward: +$${r.cash}`, icon: '💵', tone: 'good' });
    fx.push({ type: 'sfx', name: 'cash' });
  }
  if (r.xp) grantXp(w, fx, r.xp);
  for (const loc of r.unlock ?? []) unlockLocation(w, fx, loc);
  if (r.title && !w.progress.titles.includes(r.title)) {
    w.progress.titles.push(r.title);
    w.progress.activeTitle = r.title;
    fx.push({ type: 'toast', text: `New title: ${r.title}`, icon: '🏅', tone: 'gold' });
  }
  if (r.item) {
    const it = outfits.items.find((i) => i.id === r.item);
    if (it && !w.assets.items.some((x) => x.itemId === it.id)) {
      w.assets.items.push({ uid: `reward_${it.id}`, itemId: it.id, value: 0, price: 0, boughtMonth: w.time.month });
      fx.push({ type: 'toast', text: `Reward: ${it.name}!`, icon: it.icon, tone: 'gold' });
    }
  }
  for (const n of q.next ?? []) startQuest(w, fx, n);
}

/** Feed an event to all active quests. Returns true if anything advanced. */
export function questsOnEvent(w: WorldState, fx: Fx, ev: GameEvent): boolean {
  let changed = false;
  // Copy: completing a quest can start new ones.
  for (const a of [...w.progress.quests.active]) {
    const q = QUEST_BY_ID.get(a.id);
    if (!q) continue;
    let guard = 0;
    while (guard++ < 30) {
      const step = q.steps[a.step];
      if (!step) break;
      const inc = stepProgress(w, step, ev);
      let done = false;
      if (inc > 0) {
        a.progress += inc;
        changed = true;
        done = a.progress >= stepTarget(step);
      }
      if (!done && stateComplete(w, step)) done = true;
      if (!done) break;
      // Step complete
      if (step.reward?.cash) w.finance.cash += step.reward.cash;
      if (step.reward?.xp) grantXp(w, fx, step.reward.xp);
      fx.push({ type: 'sfx', name: 'star' });
      a.step++;
      a.progress = 0;
      changed = true;
      if (a.step >= q.steps.length) {
        completeQuest(w, fx, q);
        break;
      }
      // The next step only advances on a *new* event, unless it was already done earlier,
      // in which case we skip it without Narwhal announcing it.
      ev = { type: '__none' };
      if (q.epic) fx.push({ type: 'toast', text: `${q.title}: milestone reached!`, icon: q.icon, tone: 'gold' });
      else if (!stateComplete(w, q.steps[a.step])) sayStep(w, fx, q.steps[a.step]);
    }
  }
  return changed;
}

export function currentStep(w: WorldState): { quest: QuestDef; step: QuestStep; index: number; progress: number } | null {
  // Onboarding first, then side quests
  const sorted = [...w.progress.quests.active].sort((a, b) => Number(!!QUEST_BY_ID.get(b.id)?.onboarding) - Number(!!QUEST_BY_ID.get(a.id)?.onboarding));
  for (const a of sorted) {
    const q = QUEST_BY_ID.get(a.id);
    if (q?.epic) continue;
    if (q && q.steps[a.step]) return { quest: q, step: q.steps[a.step], index: a.step, progress: a.progress };
  }
  return null;
}
