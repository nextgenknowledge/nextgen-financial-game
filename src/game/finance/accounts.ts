/**
 * Banking rules: deposits, transfers, purchases, the payment waterfall, CDs, loans, credit card, goals.
 * All functions mutate a WorldState draft and push effects.
 */
import type { CD, Goal, Loan, LoanKind, Txn, WorldState } from '../types';
import type { Fx } from '../effects';
import { monthlyPayment } from './loans';
import { creditScore, loanAprFor } from './credit';
import { monthlyRateFromApy, round2 } from './interest';
import { recordEvent } from '../progress/events';
import { uid } from '../world';

const LEDGER_MAX = 250;

export function log(w: WorldState, d: string, a: number, k: Txn['k']) {
  w.finance.ledger.unshift({ m: w.time.month, d, a: round2(a), k });
  if (w.finance.ledger.length > LEDGER_MAX) w.finance.ledger.length = LEDGER_MAX;
}

/** Income lands in checking if you have it, otherwise in your pocket as cash. */
export function receive(w: WorldState, amount: number, desc: string) {
  if (amount <= 0) return;
  const f = w.finance;
  if (f.hasChecking) {
    f.checking = round2(f.checking + amount);
    log(w, desc, amount, 'checking');
  } else {
    f.cash = round2(f.cash + amount);
    log(w, desc, amount, 'cash');
  }
  f.monthIncome += amount;
}

/** Money you can spend without borrowing. */
export function available(w: WorldState) {
  return w.finance.cash + w.finance.checking;
}

export function cardAvailable(w: WorldState) {
  const c = w.finance.card;
  return c.open ? Math.max(0, c.limit - c.balance) : 0;
}

/**
 * Purchases (wants and needs you choose to buy). Uses cash, then checking; optionally the credit card.
 * Fails (returns false) rather than borrowing automatically, the player decides.
 */
export function spend(w: WorldState, fx: Fx, amount: number, desc: string, method: 'auto' | 'card' = 'auto'): boolean {
  const f = w.finance;
  amount = round2(amount);
  if (method === 'card') {
    if (cardAvailable(w) < amount) {
      fx.push({ type: 'toast', text: 'Not enough credit left on your card.', icon: '💳', tone: 'bad' });
      fx.push({ type: 'sfx', name: 'error' });
      return false;
    }
    f.card.balance = round2(f.card.balance + amount);
    log(w, desc, -amount, 'card');
    f.monthSpending += amount;
    return true;
  }
  if (available(w) < amount) {
    fx.push({ type: 'toast', text: `You need ${fmt(amount)} but only have ${fmt(available(w))} in cash + checking.`, icon: '💸', tone: 'bad' });
    fx.push({ type: 'sfx', name: 'error' });
    return false;
  }
  const fromCash = Math.min(f.cash, amount);
  f.cash = round2(f.cash - fromCash);
  if (fromCash > 0) log(w, desc, -fromCash, 'cash');
  const rest = round2(amount - fromCash);
  if (rest > 0) {
    f.checking = round2(f.checking - rest);
    log(w, desc, -rest, 'checking');
  }
  f.monthSpending += amount;
  return true;
}

export interface PayResult {
  paid: number;
  fromSavings: number;
  borrowed: number;
}

/**
 * Bills and surprises must get paid: checking → cash → savings → (Advanced) credit card → a friendly
 * Narwhal IOU. Money never goes negative; borrowing is explained so the player can recover.
 */
export function payBill(w: WorldState, fx: Fx, amount: number, desc: string, opts: { quiet?: boolean } = {}): PayResult {
  const f = w.finance;
  let left = round2(amount);
  const res: PayResult = { paid: left, fromSavings: 0, borrowed: 0 };
  const take = (have: number) => Math.min(have, left);
  let x = take(f.checking);
  if (x > 0) {
    f.checking = round2(f.checking - x);
    left = round2(left - x);
    log(w, desc, -x, 'checking');
  }
  x = take(f.cash);
  if (x > 0) {
    f.cash = round2(f.cash - x);
    left = round2(left - x);
    log(w, desc, -x, 'cash');
  }
  x = take(f.savings);
  if (x > 0) {
    f.savings = round2(f.savings - x);
    left = round2(left - x);
    res.fromSavings = x;
    log(w, desc, -x, 'savings');
    shrinkGoalsTo(w);
  }
  if (left > 0 && w.difficulty === 'advanced' && f.card.open) {
    x = Math.min(cardAvailable(w), left);
    if (x > 0) {
      f.card.balance = round2(f.card.balance + x);
      left = round2(left - x);
      res.borrowed += x;
      log(w, desc, -x, 'card');
      if (!opts.quiet) fx.push({ type: 'narwhal', text: `I put ${fmt(x)} of "${desc}" on your credit card because your accounts were empty. Pay it off soon to avoid ${(f.card.apr * 100).toFixed(0)}% interest!`, mood: 'skeptical' });
    }
  }
  if (left > 0) {
    // Narwhal IOU: small, kind, always available
    const fee = w.difficulty === 'entry' ? 0.05 : 0.08;
    const loan: Loan = {
      id: uid('loan'),
      kind: 'iou',
      name: 'Narwhal Helper Loan',
      principal: round2(left * (1 + fee)),
      balance: round2(left * (1 + fee)),
      apr: 0,
      termMonths: 6,
      payment: round2((left * (1 + fee)) / 6),
      monthsPaid: 0,
      startMonth: w.time.month,
      missed: 0,
    };
    f.loans.push(loan);
    res.borrowed += left;
    log(w, `${desc} (Helper Loan)`, -left, 'other');
    if (!opts.quiet)
      fx.push({
        type: 'narwhal',
        text: `You didn't have enough for "${desc}", so I lent you ${fmt(left)}. You'll pay back ${fmt(loan.principal)} over 6 months. Building an emergency fund will keep this from happening!`,
        entryText: `Uh-oh, you were ${fmt(left)} short for "${desc}". I lent it to you! Pay me back a little each month. Saving some money helps next time!`,
        mood: 'disappointed',
      });
    left = 0;
  }
  f.monthSpending += amount;
  return res;
}

/** Keep goal 'saved' amounts within the savings balance. */
export function shrinkGoalsTo(w: WorldState) {
  const f = w.finance;
  const total = f.goals.reduce((s, g) => s + (g.done ? 0 : g.saved), 0);
  if (total <= f.savings || total === 0) return;
  const ratio = f.savings / total;
  for (const g of f.goals) if (!g.done) g.saved = round2(g.saved * ratio);
}

function fmt(x: number) {
  return `$${x.toLocaleString('en-US', { minimumFractionDigits: x < 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/* ───────── Accounts ───────── */

export function openChecking(w: WorldState, fx: Fx) {
  if (w.finance.hasChecking) return;
  w.finance.hasChecking = true;
  fx.push({ type: 'toast', text: 'Checking account opened!', icon: '🏦', tone: 'good' });
  fx.push({ type: 'sfx', name: 'unlock' });
  recordEvent(w, fx, { type: 'openChecking' });
}

export function openSavings(w: WorldState, fx: Fx) {
  if (w.finance.hasSavings) return;
  w.finance.hasSavings = true;
  fx.push({ type: 'toast', text: 'Savings account opened! It earns interest every month.', icon: '🐷', tone: 'good' });
  fx.push({ type: 'sfx', name: 'unlock' });
  recordEvent(w, fx, { type: 'openSavings' });
}

type Acct = 'cash' | 'checking' | 'savings';

export function transfer(w: WorldState, fx: Fx, from: Acct, to: Acct, amount: number): boolean {
  const f = w.finance;
  amount = round2(amount);
  if (amount <= 0 || from === to) return false;
  if ((to === 'checking' || from === 'checking') && !f.hasChecking) return false;
  if ((to === 'savings' || from === 'savings') && !f.hasSavings) return false;
  if (f[from] < amount - 0.001) {
    fx.push({ type: 'toast', text: `Not enough in ${from}.`, icon: '⚠️', tone: 'bad' });
    fx.push({ type: 'sfx', name: 'error' });
    return false;
  }
  f[from] = round2(f[from] - amount);
  f[to] = round2(f[to] + amount);
  log(w, `Transfer ${from} → ${to}`, -amount, from);
  log(w, `Transfer ${from} → ${to}`, amount, to);
  if (from === 'savings') shrinkGoalsTo(w);
  fx.push({ type: 'sfx', name: 'coin' });
  if (from === 'cash') recordEvent(w, fx, { type: 'deposit', target: to, value: amount });
  if (to === 'savings') recordEvent(w, fx, { type: 'depositSavings', value: amount });
  if (to === 'cash') recordEvent(w, fx, { type: 'withdraw', value: amount });
  return true;
}

/* ───────── Interest rates ───────── */

export function savingsApy(w: WorldState): number {
  const perk = w.progress.perks.includes('saver-perk') ? 0.0025 : 0;
  if (w.difficulty === 'entry') return Math.pow(1.01, 12) - 1 + perk;
  return Math.max(0.005, Math.min(0.08, w.market.reserveRate - 0.0025)) + perk;
}

/** Monthly rate for savings. Entry: a flat, easy 1% a month. */
export function savingsMonthlyRate(w: WorldState): number {
  const perk = w.progress.perks.includes('saver-perk') ? 0.0025 / 12 : 0;
  if (w.difficulty === 'entry') return 0.01 + perk;
  return monthlyRateFromApy(savingsApy(w)) + perk;
}

export const CD_TERMS = [3, 6, 12, 24];

export function cdMonthlyRate(w: WorldState, termMonths: number): number {
  if (w.difficulty === 'entry') return termMonths >= 6 ? 0.016 : 0.014;
  const bonus = termMonths >= 24 ? 0.01 : termMonths >= 12 ? 0.008 : termMonths >= 6 ? 0.005 : 0.0025;
  return monthlyRateFromApy(savingsApy(w) + bonus);
}

export function openCD(w: WorldState, fx: Fx, amount: number, termMonths: number): boolean {
  const f = w.finance;
  amount = round2(amount);
  const from: Acct = f.savings >= amount ? 'savings' : 'checking';
  if (f[from] < amount || amount < 50) {
    fx.push({ type: 'toast', text: amount < 50 ? 'CDs start at $50.' : 'Not enough money in savings or checking.', icon: '🔒', tone: 'bad' });
    return false;
  }
  f[from] = round2(f[from] - amount);
  if (from === 'savings') shrinkGoalsTo(w);
  const cd: CD = { id: uid('cd'), principal: amount, value: amount, monthlyRate: cdMonthlyRate(w, termMonths), termMonths, startMonth: w.time.month };
  f.cds.push(cd);
  log(w, `Opened ${termMonths}-month CD`, -amount, from);
  fx.push({ type: 'toast', text: `CD opened: ${fmt(amount)} locked for ${termMonths} months. A money tree was planted in Singapore! 🌱`, icon: '🔒', tone: 'good' });
  fx.push({ type: 'sfx', name: 'unlock' });
  recordEvent(w, fx, { type: 'openCD', value: amount });
  return true;
}

/** Break a CD early: lose 3 months of interest (never below principal in Entry). */
export function breakCD(w: WorldState, fx: Fx, id: string) {
  const f = w.finance;
  const cd = f.cds.find((c) => c.id === id);
  if (!cd) return;
  const penalty = round2(cd.principal * cd.monthlyRate * 3);
  const payout = w.difficulty === 'entry' ? Math.max(cd.principal, cd.value - penalty) : Math.max(0, cd.value - penalty);
  f.cds = f.cds.filter((c) => c.id !== id);
  f.savings = round2(f.savings + payout);
  log(w, 'Broke CD early', payout, 'savings');
  fx.push({ type: 'toast', text: `CD broken early. Penalty: ${fmt(cd.value - payout)}.`, icon: '🔓', tone: 'info' });
}

/* ───────── Loans & credit ───────── */

export function creditInputs(w: WorldState) {
  const f = w.finance;
  const c = f.credit;
  const months = c.firstAccountMonth === null ? 0 : w.time.month - c.firstAccountMonth;
  return {
    onTime: c.onTime,
    late: c.late,
    lateMonthsAgo: c.lateMonths.map((m) => w.time.month - m),
    utilization: f.card.open && f.card.limit > 0 ? f.card.balance / f.card.limit : null,
    oldestAccountMonths: months,
    hardInquiriesLast12: c.inquiryMonths.filter((m) => w.time.month - m < 12).length,
    hasRevolving: f.card.open,
    hasInstallment: f.loans.some((l) => l.kind !== 'iou') || c.onTime > 0,
  };
}

export function updateCreditScore(w: WorldState) {
  const c = w.finance.credit;
  if (c.firstAccountMonth === null) {
    c.score = null;
    return;
  }
  c.score = creditScore(creditInputs(w));
  c.history.push({ month: w.time.month, score: c.score });
  if (c.history.length > 120) c.history.splice(0, c.history.length - 120);
  w.progress.stats.bestCreditScore = Math.max(w.progress.stats.bestCreditScore ?? 0, c.score);
}

function hardInquiry(w: WorldState) {
  const c = w.finance.credit;
  c.inquiryMonths.push(w.time.month);
  if (c.firstAccountMonth === null) c.firstAccountMonth = w.time.month;
}

export function loanQuote(w: WorldState, kind: Exclude<LoanKind, 'iou'>, amount: number, months: number) {
  const apr = w.difficulty === 'entry' ? 0 : loanAprFor(w.finance.credit.score, w.market.reserveRate, kind);
  const entryFee = 0.05;
  const total = w.difficulty === 'entry' ? amount * (1 + entryFee) : monthlyPayment(amount, apr, months) * months;
  const payment = w.difficulty === 'entry' ? total / months : monthlyPayment(amount, apr, months);
  return { apr, payment: round2(payment), total: round2(total), interest: round2(total - amount) };
}

export function takeLoan(
  w: WorldState,
  fx: Fx,
  kind: Exclude<LoanKind, 'iou'>,
  amount: number,
  months: number,
  opts: { name?: string; collateral?: string; deposit?: boolean } = {},
): Loan {
  const q = loanQuote(w, kind, amount, months);
  const loan: Loan = {
    id: uid('loan'),
    kind,
    name: opts.name ?? `${kind[0].toUpperCase()}${kind.slice(1)} loan`,
    principal: round2(w.difficulty === 'entry' ? q.total : amount),
    balance: round2(w.difficulty === 'entry' ? q.total : amount),
    apr: q.apr,
    termMonths: months,
    payment: q.payment,
    monthsPaid: 0,
    startMonth: w.time.month,
    collateral: opts.collateral,
    missed: 0,
  };
  w.finance.loans.push(loan);
  if (w.difficulty === 'advanced') hardInquiry(w);
  if (opts.deposit !== false) receive(w, amount, `${loan.name} received`);
  w.finance.monthIncome -= amount; // borrowing isn't income
  recordEvent(w, fx, { type: 'loanTaken', target: kind, value: amount });
  fx.push({ type: 'toast', text: `${loan.name}: ${fmt(amount)} at ${(q.apr * 100).toFixed(2)}% APR, ${fmt(q.payment)}/month.`, icon: '📝', tone: 'info' });
  return loan;
}

/** Extra payment toward a loan (from checking, then cash). */
export function payLoanExtra(w: WorldState, fx: Fx, id: string, amount: number): boolean {
  const loan = w.finance.loans.find((l) => l.id === id);
  if (!loan) return false;
  amount = Math.min(round2(amount), loan.balance);
  if (!spend(w, fx, amount, `Extra payment: ${loan.name}`)) return false;
  w.finance.monthSpending -= amount; // paying debt isn't consumption
  loan.balance = round2(loan.balance - amount);
  if (loan.balance <= 0.01) closeLoan(w, fx, loan);
  else fx.push({ type: 'toast', text: `Paid ${fmt(amount)} extra. ${fmt(loan.balance)} left.`, icon: '💪', tone: 'good' });
  return true;
}

export function closeLoan(w: WorldState, fx: Fx, loan: Loan) {
  w.finance.loans = w.finance.loans.filter((l) => l.id !== loan.id);
  fx.push({ type: 'toast', text: `${loan.name} paid off! 🎉`, icon: '🕊️', tone: 'good' });
  fx.push({ type: 'confetti' });
  recordEvent(w, fx, { type: 'loanPaidOff', target: loan.kind });
}

export function openCard(w: WorldState, fx: Fx): boolean {
  const f = w.finance;
  if (w.difficulty !== 'advanced' || f.card.open) return false;
  const score = f.credit.score;
  const limit = score === null ? 500 : score >= 760 ? 5000 : score >= 700 ? 3000 : score >= 640 ? 1500 : 800;
  hardInquiry(w);
  f.card = { ...f.card, open: true, limit, balance: 0, statementBalance: 0, minDue: 0, openedMonth: w.time.month, apr: score !== null && score >= 740 ? 0.1999 : 0.2499 };
  fx.push({ type: 'toast', text: `Credit card approved! Limit ${fmt(limit)}, APR ${(f.card.apr * 100).toFixed(2)}%.`, icon: '💳', tone: 'good' });
  recordEvent(w, fx, { type: 'openCard' });
  return true;
}

export function payCard(w: WorldState, fx: Fx, amount: number): boolean {
  const f = w.finance;
  amount = Math.min(round2(amount), f.card.balance);
  if (amount <= 0) return false;
  if (!spend(w, fx, amount, 'Credit card payment')) return false;
  f.monthSpending -= amount;
  f.card.balance = round2(f.card.balance - amount);
  f.card.statementBalance = Math.max(0, round2(f.card.statementBalance - amount));
  fx.push({ type: 'toast', text: `Paid ${fmt(amount)} on your card.`, icon: '💳', tone: 'good' });
  return true;
}

/* ───────── Goals ───────── */

export function addGoal(w: WorldState, fx: Fx, name: string, icon: string, target: number) {
  const g: Goal = { id: uid('goal'), name: name.slice(0, 30), icon, target: round2(target), saved: 0, done: false };
  w.finance.goals.push(g);
  fx.push({ type: 'toast', text: `New goal: ${icon} ${g.name} (${fmt(g.target)})`, icon: '🎯', tone: 'good' });
  recordEvent(w, fx, { type: 'setGoal', value: target });
}

/** Moves money from cash/checking into savings, earmarked for a goal. Opens savings if needed. */
export function fundGoal(w: WorldState, fx: Fx, id: string, amount: number): boolean {
  const g = w.finance.goals.find((x) => x.id === id);
  if (!g || g.done) return false;
  amount = Math.min(round2(amount), round2(g.target - g.saved));
  if (amount <= 0) return false;
  if (!w.finance.hasSavings) openSavings(w, fx);
  const f = w.finance;
  if (available(w) < amount) {
    fx.push({ type: 'toast', text: 'Not enough cash or checking for that.', icon: '⚠️', tone: 'bad' });
    return false;
  }
  const fromCash = Math.min(f.cash, amount);
  f.cash = round2(f.cash - fromCash);
  f.checking = round2(f.checking - (amount - fromCash));
  f.savings = round2(f.savings + amount);
  g.saved = round2(g.saved + amount);
  log(w, `Saved for ${g.name}`, amount, 'savings');
  fx.push({ type: 'sfx', name: 'coin' });
  recordEvent(w, fx, { type: 'fundGoal', value: amount });
  if (g.saved >= g.target - 0.005) {
    g.done = true;
    fx.push({ type: 'narwhal', text: `You reached your goal: ${g.icon} ${g.name}! Saving on purpose works. The money is waiting in savings whenever you're ready.`, mood: 'hyped' });
    fx.push({ type: 'confetti' });
    recordEvent(w, fx, { type: 'goalReached' });
  }
  return true;
}

export function deleteGoal(w: WorldState, id: string) {
  w.finance.goals = w.finance.goals.filter((g) => g.id !== id);
}
