import jobsData from '@/data/jobs.json';
import type { WorldState } from '../types';
import type { Fx } from '../effects';
import { paycheck, type Paycheck } from './tax';
import { receive } from './accounts';
import { round2 } from './interest';
import { recordEvent } from '../progress/events';

export interface JobDef {
  id: string;
  board: string;
  name: string;
  icon: string;
  skill: string;
  pay: number;
  promoteEvery: number;
  titles: string[];
  blurb: string;
  match?: boolean;
  level?: number;
}

export const JOBS = jobsData.jobs as JobDef[];
export const JOB_BY_ID = new Map(JOBS.map((j) => [j.id, j]));
/** Shifts are frequent, so withholding is annualized over ~100 shifts a year. */
export const SHIFTS_PER_YEAR = 100;

export function jobTitle(w: WorldState, j: JobDef) {
  const lvl = w.progress.jobs[j.id]?.level ?? 1;
  return j.titles[Math.min(j.titles.length - 1, lvl - 1)];
}

export function shiftGross(w: WorldState, j: JobDef, score: number) {
  const lvl = w.progress.jobs[j.id]?.level ?? 1;
  const perk = w.progress.perks.includes('negotiator') ? 1.05 : 1;
  const performance = 0.5 + Math.max(0, Math.min(100, score)) / 200; // 50%..100%
  return round2(j.pay * Math.pow(1.15, lvl - 1) * performance * perk * w.market.priceIndex);
}

export interface ShiftResult {
  stub: Paycheck;
  match: number;
  promoted: string | null;
  title: string;
}

export function workShift(w: WorldState, fx: Fx, jobId: string, score: number, stars: number): ShiftResult | null {
  const j = JOB_BY_ID.get(jobId);
  if (!j) return null;
  const st = (w.progress.jobs[jobId] ??= { shifts: 0, level: 1, best: 0 });
  const gross = shiftGross(w, j, score);
  const r = w.finance.retirement;
  const advanced = w.difficulty === 'advanced';
  const pct = r.open && j.board !== 'park' ? r.pct : 0;
  const stub = paycheck(gross, SHIFTS_PER_YEAR, { retirementPct: pct, roth: r.roth, advanced });
  // Employer match: 50% of what you save, up to 6% of pay
  const match = j.match && pct > 0 ? round2(gross * Math.min(pct, 0.06) * 0.5) : 0;
  if (stub.retirement > 0) {
    r.balance = round2(r.balance + stub.retirement + match);
    r.contributed = round2(r.contributed + stub.retirement);
    r.matched = round2(r.matched + match);
  }
  receive(w, round2(stub.net), `Paycheck: ${j.name}`);
  if (advanced) {
    const t = w.finance.tax;
    t.ytdGross = round2(t.ytdGross + gross);
    t.ytdWithheld = round2(t.ytdWithheld + stub.federal);
    t.ytdFica = round2(t.ytdFica + stub.socialSecurity + stub.medicare);
    t.ytdCity = round2(t.ytdCity + stub.city);
  }
  st.shifts++;
  st.best = Math.max(st.best, score);
  let promoted: string | null = null;
  const good = (w.progress.stats[`goodShifts:${jobId}`] = (w.progress.stats[`goodShifts:${jobId}`] ?? 0) + (stars >= 2 ? 1 : 0));
  if (stars >= 2 && good >= j.promoteEvery * st.level && st.level < j.titles.length) {
    st.level++;
    promoted = j.titles[st.level - 1];
    fx.push({ type: 'narwhal', text: `You got promoted to ${promoted}! 🎉 Your pay per shift went up 15%. Great work pays off!`, mood: 'hyped' });
    fx.push({ type: 'confetti' });
    recordEvent(w, fx, { type: 'promotion', target: jobId });
  }
  recordEvent(w, fx, { type: 'job', target: jobId, value: gross });
  recordEvent(w, fx, { type: 'paycheck', value: stub.net });
  return { stub, match, promoted, title: jobTitle(w, j) };
}
