import data from '@/data/startups.json';
import type { WorldState } from '../types';
import type { Fx } from '../effects';
import type { Rng } from '../rng';
import { spend, receive } from './accounts';
import { round2 } from './interest';
import { uid } from '../world';
import { recordEvent } from '../progress/events';

export interface StartupDef {
  id: string;
  name: string;
  icon: string;
  pitch: string;
  facts: string[];
  quality: number;
  odds: number[];
}
export const STARTUPS = data.startups as StartupDef[];
export const STARTUP_BY_ID = new Map(STARTUPS.map((s) => [s.id, s]));

/** Sample an outcome multiple from the odds: fail = 0, meh = 0.5–1.5, hit = 3–15. */
export function sampleOutcome(s: StartupDef, rng: Rng): number {
  const r = rng.next();
  if (r < s.odds[0]) return 0;
  if (r < s.odds[0] + s.odds[1]) return round2(rng.range(0.5, 1.5));
  return round2(rng.range(3, 15));
}

export function expectedMultiple(s: StartupDef): number {
  return s.odds[1] * 1 + s.odds[2] * 9;
}

/** Invest real money in a startup; it resolves in 3–6 months. */
export function investStartup(w: WorldState, fx: Fx, id: string, amount: number, rng: Rng): boolean {
  if (amount < 10) return false;
  if (!spend(w, fx, amount, `Startup stake: ${STARTUP_BY_ID.get(id)?.name}`)) return false;
  w.finance.monthSpending -= amount;
  w.finance.startups.push({ uid: uid('stake'), startupId: id, amount: round2(amount), resolveMonth: w.time.month + rng.int(3, 6) });
  recordEvent(w, fx, { type: 'invest', target: `startup:${id}`, value: amount });
  return true;
}

/** Called at month end: settle any stakes that are due. */
export function resolveStartups(w: WorldState, fx: Fx, rng: Rng): string[] {
  const notes: string[] = [];
  for (const st of w.finance.startups) {
    if (st.outcome !== undefined || w.time.month < st.resolveMonth) continue;
    const def = STARTUP_BY_ID.get(st.startupId);
    if (!def) continue;
    st.outcome = sampleOutcome(def, rng);
    const payout = round2(st.amount * st.outcome);
    if (payout > 0) receive(w, payout, `${def.name} payout`);
    const text =
      st.outcome === 0
        ? `${def.icon} ${def.name} shut down. Your ${fmt(st.amount)} stake is gone, that's why startup money should be money you can afford to lose.`
        : st.outcome >= 3
          ? `${def.icon} ${def.name} was a hit! Your ${fmt(st.amount)} stake returned ${fmt(payout)} (${st.outcome.toFixed(1)}×)!`
          : `${def.icon} ${def.name} sold to a bigger company. Your ${fmt(st.amount)} became ${fmt(payout)}.`;
    notes.push(text);
    fx.push({ type: 'narwhal', text, mood: st.outcome === 0 ? 'disappointed' : st.outcome >= 3 ? 'hyped' : 'talking' });
  }
  // Keep the last 20 resolved stakes for history
  const open = w.finance.startups.filter((s) => s.outcome === undefined);
  const done = w.finance.startups.filter((s) => s.outcome !== undefined).slice(-20);
  w.finance.startups = [...done, ...open];
  return notes;
}

function fmt(x: number) {
  return `$${x.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}
