/** Activity results → stars, scaling rewards, best scores and events. */
import type { ActivityDef } from '../content';
import type { WorldState } from '../types';
import type { Fx } from '../effects';
import { grantXp } from './xp';
import { recordEvent } from './events';
import { perkBoost } from './lessons';
import { adaptLevel, type RuntimeQuestion } from '../questions/engine';
import { todayKey } from './challenges';

export interface ActivityResult {
  /** 0..100 */
  score: number;
  correct?: number;
  total?: number;
  /** Cash already paid by the activity itself (jobs, delivery tips…), shown, not paid again. */
  earned?: number;
  /** Skip the standard cash reward (e.g. jobs pay wages instead). */
  noCash?: boolean;
  summary?: string;
  stats?: Record<string, number>;
}

export interface RewardOutcome {
  stars: number;
  cash: number;
  xp: number;
  tickets: number;
  newBest: boolean;
  firstTime: boolean;
  repeatFactor: number;
}

export function starsFor(def: ActivityDef, score: number): number {
  const t = def.stars ?? [40, 70, 90];
  return score >= t[2] ? 3 : score >= t[1] ? 2 : score >= t[0] ? 1 : 0;
}

/** Full rewards for the first 2 plays each day, then tapering (never below 30%). */
export function repeatFactor(w: WorldState, id: string): number {
  const key = `plays:${todayKey()}:${id}`;
  const n = w.progress.stats[key] ?? 0;
  return Math.max(0.3, 1 - Math.max(0, n - 1) * 0.2);
}

export function finishActivity(w: WorldState, fx: Fx, def: ActivityDef, result: ActivityResult): RewardOutcome {
  const stars = starsFor(def, result.score);
  const st = (w.progress.activities[def.id] ??= { best: 0, stars: 0, plays: 0, last: 0 });
  const firstTime = st.plays === 0;
  const newBest = result.score > st.best;
  const rf = repeatFactor(w, def.id);
  const boost = 1 + perkBoost(w, def.id, def.city);
  const diffMult = w.difficulty === 'advanced' ? 1.25 : 1;
  let cash = 0;
  let tickets = 0;
  if (stars > 0) {
    if (def.tickets) tickets = def.tickets[stars - 1];
    else if (!result.noCash) cash = Math.round(def.rewards.cash[stars - 1] * rf * boost * diffMult * w.market.priceIndex);
  }
  if (newBest && stars > st.stars && !def.tickets && !result.noCash) cash += 5 * (stars - st.stars);
  const xp = Math.round((stars > 0 ? def.rewards.xp[stars - 1] : 5) * Math.max(0.5, rf) * boost);
  st.best = Math.max(st.best, result.score);
  st.stars = Math.max(st.stars, stars);
  st.plays++;
  st.last = Date.now();
  const k = `plays:${todayKey()}:${def.id}`;
  w.progress.stats[k] = (w.progress.stats[k] ?? 0) + 1;
  if (cash > 0) {
    w.finance.cash = Math.round((w.finance.cash + cash) * 100) / 100;
    w.finance.monthIncome += cash;
    w.finance.ledger.unshift({ m: w.time.month, d: `Reward: ${def.name}`, a: cash, k: 'cash' });
    fx.push({ type: 'sfx', name: 'cash' });
  }
  if (tickets > 0) {
    w.progress.tickets += tickets;
    w.progress.stats.ticketsWon = (w.progress.stats.ticketsWon ?? 0) + tickets;
  }
  grantXp(w, fx, xp);
  if (stars === 3) {
    fx.push({ type: 'confetti' });
    w.progress.stats.threeStarRuns = (w.progress.stats.threeStarRuns ?? 0) + 1;
  }
  for (const [kk, v] of Object.entries(result.stats ?? {})) {
    if (kk.startsWith('best')) w.progress.stats[kk] = Math.max(w.progress.stats[kk] ?? 0, v);
    else w.progress.stats[kk] = (w.progress.stats[kk] ?? 0) + v;
  }
  recordEvent(w, fx, { type: 'activityComplete', target: def.id, stars, city: def.city, value: result.score });
  return { stars, cash, xp, tickets, newBest, firstTime, repeatFactor: rf };
}

/** Record one answered question: topic stats, events and Entry adaptive level. */
export function recordAnswer(w: WorldState, fx: Fx, q: Pick<RuntimeQuestion, 'topic' | 'id'>, correct: boolean) {
  const p = w.progress;
  if (correct) {
    p.streakRight++;
    p.streakWrong = 0;
  } else {
    p.streakWrong++;
    p.streakRight = 0;
  }
  if (w.difficulty === 'entry') {
    const next = adaptLevel(p.subLevel, p.streakRight, p.streakWrong);
    if (next !== p.subLevel) {
      if (next > p.subLevel) fx.push({ type: 'toast', text: `Questions are getting a little harder, you're on a roll! (Level ${next})`, icon: '🚀', tone: 'good' });
      p.subLevel = next;
      p.streakRight = 0;
      p.streakWrong = 0;
    }
  }
  const seen = (p.flags.recentQ as string | undefined)?.split(',') ?? [];
  p.flags.recentQ = [q.id, ...seen.filter((x) => x !== q.id)].slice(0, 60).join(',');
  recordEvent(w, fx, { type: 'answer', correct, topic: q.topic });
}
