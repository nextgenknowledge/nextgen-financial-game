/**
 * Month rollover: interest, bills, loans, card statement, business & rental income, dividends,
 * inflation, depreciation, life events, happiness, credit score, taxes, net-worth snapshot.
 */
import type { WorldState } from '../types';
import type { Fx } from '../effects';
import { makeRng, type Rng } from '../rng';
import { round2 } from '../finance/interest';
import { cardMinimumPayment } from '../finance/loans';
import { payBill, receive, savingsMonthlyRate, updateCreditScore, log, closeLoan } from '../finance/accounts';
import { marketMonthEnd, monthReturn } from '../market/market';
import { netWorthPoint } from '../finance/netWorth';
import { recordEvent } from '../progress/events';
import { PROPERTY_TAX_RATE } from '../finance/tax';
import { monthlyBills, houseDef, condoDef, businessType, petDef, insurancePlan, collectibleDef } from './catalog';
import { vehicleDef } from './vehicleCatalog';
import community from '@/data/community.json';
import eventsData from '@/data/events.json';
import { MONTH_NAMES } from '../world';
import { resolveStartups } from '../finance/startups';

interface LifeEvent {
  id: string;
  title: string;
  text: string;
  category?: string;
  cost?: number[];
  gain?: number[];
  weight: number;
  requires?: string;
  difficulty?: string;
  tip?: string;
  cashOnly?: boolean;
}
const EVENTS = eventsData.events as LifeEvent[];

export function processMonth(w: WorldState, fx: Fx) {
  const rng = makeRng(w.rng);
  const f = w.finance;
  const notes: string[] = [];
  const advanced = w.difficulty === 'advanced';
  let interestEarned = 0;

  // 1. Savings interest
  if (f.hasSavings && f.savings > 0) {
    const i = round2(f.savings * savingsMonthlyRate(w));
    if (i > 0) {
      f.savings = round2(f.savings + i);
      interestEarned += i;
      log(w, 'Savings interest', i, 'savings');
    }
  }
  // CDs grow and mature
  for (const cd of [...f.cds]) {
    const i = round2(cd.value * cd.monthlyRate);
    cd.value = round2(cd.value + i);
    interestEarned += i;
    if (w.time.month + 1 - cd.startMonth >= cd.termMonths) {
      f.cds = f.cds.filter((c) => c.id !== cd.id);
      f.savings = round2(f.savings + cd.value);
      f.hasSavings = true;
      log(w, 'CD matured', cd.value, 'savings');
      notes.push(`A CD matured: ${money(cd.value)} moved to savings (you earned ${money(cd.value - cd.principal)}).`);
      fx.push({ type: 'toast', text: `CD matured! +${money(cd.value - cd.principal)} interest`, icon: '🌳', tone: 'good' });
    }
  }
  f.monthInterest = interestEarned;
  if (advanced) f.tax.ytdOther += interestEarned;

  // Market month-end (rates, inflation, dividends)
  const mk = marketMonthEnd(w, rng);
  if (mk.dividends > 0) {
    receive(w, mk.dividends, 'Dividends');
    if (advanced) f.tax.ytdOther += mk.dividends;
    notes.push(`Your investments paid ${money(mk.dividends)} in dividends.`);
    recordEvent(w, fx, { type: 'dividend', value: mk.dividends });
  }
  // Retirement account grows with the total-market index (80%) and bonds (20%)
  if (f.retirement.balance > 0) {
    const r = 0.8 * monthReturn(w, 'FCX') + 0.2 * monthReturn(w, 'TBND');
    f.retirement.balance = round2(Math.max(0, f.retirement.balance * (1 + r)));
  }

  // 2. Recurring bills
  const bills = monthlyBills(w);
  let billTotal = 0;
  for (const b of bills) {
    const amount = round2(b.amount * w.market.priceIndex ** (b.inflates ? 1 : 0));
    if (amount <= 0) continue;
    billTotal += amount;
    payBill(w, fx, amount, b.name);
  }
  // Leases count down; when they end, the car goes back to the dealer
  for (const v of [...w.assets.vehicles]) {
    if (!v.lease) continue;
    v.lease.monthsLeft--;
    if (v.lease.monthsLeft <= 0) {
      w.assets.vehicles = w.assets.vehicles.filter((x) => x.uid !== v.uid);
      if (w.assets.activeVehicle === v.uid) w.assets.activeVehicle = null;
      notes.push(`Your lease ended and the ${vehicleDef(v.itemId)?.name ?? 'vehicle'} went back to the dealer. Leasing = renting: you never owned it.`);
    }
  }
  if (billTotal > 0) {
    notes.push(`Bills paid: ${money(billTotal)}.`);
    fx.push({ type: 'sfx', name: 'bill' });
  }

  // 3. Loan payments
  for (const loan of [...f.loans]) {
    if (loan.balance <= 0.005) {
      closeLoan(w, fx, loan);
      continue;
    }
    const interest = loan.kind === 'iou' ? 0 : round2((loan.balance * loan.apr) / 12);
    const due = Math.min(round2(loan.balance + interest), loan.payment);
    const canPay = f.checking + f.cash + f.savings >= due;
    if (canPay) {
      // Pay from checking → cash → savings (never borrow to repay a loan)
      let left = due;
      for (const k of ['checking', 'cash', 'savings'] as const) {
        const x = Math.min(f[k], left);
        f[k] = round2(f[k] - x);
        left = round2(left - x);
        if (x > 0) log(w, `${loan.name} payment`, -x, k);
      }
      loan.balance = round2(loan.balance + interest - due);
      loan.monthsPaid++;
      if (loan.kind !== 'iou') f.credit.onTime++;
      if (loan.balance <= 0.01) closeLoan(w, fx, loan);
    } else {
      // Missed: interest still grows, small late fee, credit damage (Advanced)
      const fee = advanced ? 25 : 2;
      loan.balance = round2(loan.balance + interest + fee);
      loan.missed++;
      if (loan.kind !== 'iou' && advanced) {
        f.credit.late++;
        f.credit.lateMonths.push(w.time.month);
      }
      fx.push({
        type: 'narwhal',
        text: `You couldn't make your ${loan.name} payment (${money(due)}). A ${money(fee)} late fee was added${advanced && loan.kind !== 'iou' ? ' and your credit score will drop' : ''}. Earn some money and it'll get paid next month, you can recover!`,
        entryText: `You didn't have enough to pay back your loan this month. A small fee was added. Let's earn some money so you can pay it next time!`,
        mood: 'disappointed',
      });
    }
  }

  // 4. Credit card statement (Advanced)
  if (advanced && f.card.open) {
    const c = f.card;
    if (c.balance > 0.005) {
      const minDue = cardMinimumPayment(c.balance, c.apr);
      const want = c.autopay === 'full' ? c.balance : c.autopay === 'minimum' ? minDue : 0;
      const can = Math.min(want, f.checking + f.savings);
      let left = round2(can);
      for (const k of ['checking', 'savings'] as const) {
        const x = Math.min(f[k], left);
        f[k] = round2(f[k] - x);
        left = round2(left - x);
      }
      if (can > 0) log(w, 'Credit card payment', -can, 'checking');
      c.balance = round2(c.balance - can);
      if (can + 0.005 >= minDue) f.credit.onTime++;
      else {
        f.credit.late++;
        f.credit.lateMonths.push(w.time.month);
        c.balance = round2(c.balance + 30);
        fx.push({ type: 'narwhal', text: `Your credit card minimum (${money(minDue)}) wasn't paid. That's a $30 late fee and a hit to your credit score. Turn on autopay in FinPhone → Bank!`, mood: 'disappointed' });
      }
      if (c.balance > 0.005) {
        const interest = round2((c.balance * c.apr) / 12);
        c.balance = round2(c.balance + interest);
        notes.push(`Credit card interest charged: ${money(interest)} (carrying a balance costs ${(c.apr * 100).toFixed(1)}% APR).`);
      }
      c.statementBalance = c.balance;
      c.minDue = cardMinimumPayment(c.balance, c.apr);
    }
  }

  // 5. Businesses
  let bizProfit = 0;
  for (const b of w.assets.businesses) {
    const t = businessType(b.typeId);
    if (!t) continue;
    const season = t.season.includes(w.time.month % 12) ? 1.3 : 1;
    const levelMult = 1 + t.levelBoost * (b.level - 1);
    const staffMult = 1 + t.staffBoost * b.staff;
    const vehicleBoost = w.assets.vehicles.some((v) => vehicleDef(v.itemId)?.bizBoost) ? 1.05 : 1;
    const revenue = t.revenue * levelMult * staffMult * season * vehicleBoost * (1 + rng.normal() * t.risk * 0.6) * w.market.priceIndex;
    const expenses = (t.expenses * (1 + 0.18 * (b.level - 1)) + b.staff * t.wage) * w.market.priceIndex;
    const profit = round2(revenue - expenses);
    b.profits.push(profit);
    if (b.profits.length > 12) b.profits.shift();
    bizProfit += profit;
    if (profit >= 0) receive(w, profit, `${b.name} profit`);
    else payBill(w, fx, -profit, `${b.name} loss`, { quiet: true });
  }
  if (w.assets.businesses.length) {
    notes.push(`Your businesses ${bizProfit >= 0 ? 'earned' : 'lost'} ${money(Math.abs(bizProfit))} this month.`);
    if (advanced) f.tax.ytdOther += Math.max(0, bizProfit);
  }

  // Rental income
  let rent = 0;
  for (const p of w.assets.properties) {
    if (!p.rented) continue;
    const def = p.houseId ? houseDef(p.houseId) : condoDef(p.itemId);
    if (!def) continue;
    if (rng.chance(0.08)) {
      notes.push(`One of your rentals was empty this month (no tenant). Vacancies happen!`);
      continue;
    }
    rent += round2(def.rent * (1 + (p.level - 1) * 0.08) * w.market.priceIndex);
  }
  if (rent > 0) {
    receive(w, rent, 'Rent from tenants');
    if (advanced) f.tax.ytdOther += rent;
    notes.push(`Tenants paid you ${money(rent)} in rent.`);
    recordEvent(w, fx, { type: 'rent', value: rent });
  }

  // Startup stakes that are due
  notes.push(...resolveStartups(w, fx, rng));

  // 6. Asset values: depreciation, appreciation, collectibles
  for (const v of w.assets.vehicles) {
    const def = vehicleDef(v.itemId);
    if (!def) continue;
    v.value = round2(Math.max(v.price * 0.15, v.value * (1 - def.depreciation / 12)));
  }
  for (const p of w.assets.properties) {
    const def = p.houseId ? houseDef(p.houseId) : condoDef(p.itemId);
    const appr = def?.appreciation ?? 0.03;
    p.value = round2(p.value * (1 + (appr + rng.normal() * 0.03) / 12));
  }
  for (const it of w.assets.items) {
    const c = collectibleDef(it.itemId);
    if (!c) continue;
    const r = c.mu / 12 + (c.sigma / Math.sqrt(12)) * rng.normal() - (c.sigma * c.sigma) / 24;
    it.value = round2(Math.max(1, it.value * Math.exp(r)));
  }

  // 7. Life event
  const ev = maybeLifeEvent(w, fx, rng);
  if (ev) notes.push(ev);

  // 8. Happiness
  let h = w.player.happiness;
  h += (50 - h) * 0.08; // drifts toward neutral
  for (const p of w.assets.pets) h += (petDef(p.itemId)?.happiness ?? 0) * 0.5;
  for (const s of f.subscriptions) h += 0.5;
  const home = w.assets.properties.find((p) => p.uid === w.player.residence);
  if (home) h += ((home.houseId ? houseDef(home.houseId) : condoDef(home.itemId))?.happiness ?? 0) * 0.15;
  for (const p of community.projects) if ((w.progress.community[p.id] ?? 0) >= p.cost && 'happiness' in p) h += (p.happiness as number) ?? 0;
  w.player.happiness = Math.round(Math.max(0, Math.min(100, h)));
  w.progress.stats.bestHappiness = Math.max(w.progress.stats.bestHappiness ?? 0, w.player.happiness);

  // 9. Credit score
  if (advanced) updateCreditScore(w);

  // 10. Taxes: year end (Advanced)
  const monthOfYear = w.time.month % 12;
  if (advanced && monthOfYear === 11) {
    const year = Math.floor(w.time.month / 12) + 1;
    f.tax.w2s.push({ year, gross: round2(f.tax.ytdGross), withheld: round2(f.tax.ytdWithheld), fica: round2(f.tax.ytdFica), city: round2(f.tax.ytdCity), other: round2(f.tax.ytdOther) });
    f.tax.ytdGross = f.tax.ytdWithheld = f.tax.ytdFica = f.tax.ytdCity = f.tax.ytdOther = 0;
    if (f.tax.w2s[f.tax.w2s.length - 1].gross + f.tax.w2s[f.tax.w2s.length - 1].other > 0) {
      fx.push({ type: 'narwhal', text: `Happy new year! Your Year ${year} W-2 is ready. Tax season is open, file your return at the San Francisco Tax Office before the end of April.`, mood: 'talking' });
    }
  }
  if (advanced && monthOfYear === 3) {
    // End of April: auto-file any unfiled year with a small penalty, so taxes can never pile up forever.
    const year = Math.floor(w.time.month / 12); // previous year
    const w2 = f.tax.w2s.find((x) => x.year === year);
    if (w2 && !f.tax.filed.includes(year) && w2.gross + w2.other > 0) {
      fx.push({ type: 'narwhal', text: `You missed the tax deadline for Year ${year}, so the FCRS filed for you and added a 5% late penalty. Next year, visit the SF Tax Office before May!`, mood: 'disappointed' });
      f.tax.filed.push(year);
      f.tax.owed = round2(f.tax.owed + autoTaxDue(w2) * 1.05);
    }
  }
  if (f.tax.owed > 0) {
    const pay = f.tax.owed;
    payBill(w, fx, pay, 'Taxes owed (FCRS)');
    f.tax.owed = 0;
  }

  // 11. Snapshot & summary
  const month = w.time.month;
  const nw = netWorthPoint(w);
  w.progress.netWorth.push(nw);
  if (w.progress.netWorth.length > 240) w.progress.netWorth.shift();
  f.summaries.unshift({ month, income: round2(f.monthIncome), spending: round2(f.monthSpending), interest: round2(interestEarned), netWorth: nw.total, notes });
  if (f.summaries.length > 24) f.summaries.length = 24;
  fx.push({ type: 'monthSummary', month });
  f.monthIncome = 0;
  f.monthSpending = 0;

  w.time.month++;
  w.rng = rng.state();
  fx.push({ type: 'toast', text: `A new month: ${MONTH_NAMES[w.time.month % 12]}, Year ${Math.floor(w.time.month / 12) + 1}`, icon: '📅', tone: 'info' });
  recordEvent(w, fx, { type: 'month' });
}

function autoTaxDue(w2: { gross: number; withheld: number; other: number }): number {
  // Simple: what's owed beyond withholding, at least 0
  const taxable = Math.max(0, w2.gross + w2.other - 15000);
  let tax = 0;
  let lower = 0;
  for (const [upTo, rate] of [
    [11925, 0.1],
    [48475, 0.12],
    [103350, 0.22],
    [197300, 0.24],
    [250525, 0.32],
    [626350, 0.35],
    [Infinity, 0.37],
  ]) {
    if (taxable <= lower) break;
    tax += (Math.min(taxable, upTo) - lower) * rate;
    lower = upTo;
  }
  return Math.max(0, tax - w2.withheld);
}

function hasReq(w: WorldState, req?: string) {
  switch (req) {
    case undefined:
      return true;
    case 'vehicle':
      return w.assets.vehicles.length > 0;
    case 'car':
      return w.assets.vehicles.some((v) => ['car', 'kart'].includes(vehicleDef(v.itemId)?.type ?? '') && !v.leased) || w.assets.vehicles.some((v) => v.leased);
    case 'boat':
      return w.assets.vehicles.some((v) => vehicleDef(v.itemId)?.type === 'boat');
    case 'pet':
      return w.assets.pets.length > 0;
    case 'property':
      return w.assets.properties.length > 0;
    case 'business':
      return w.assets.businesses.length > 0;
    case 'job':
      return Object.keys(w.progress.jobs).length > 0;
    default:
      return true;
  }
}

function maybeLifeEvent(w: WorldState, fx: Fx, rng: Rng): string | null {
  if (w.time.month < 1) return null; // give new players a calm first month
  if (!rng.chance(0.35)) return null;
  const pool = EVENTS.filter((e) => hasReq(w, e.requires) && (!e.difficulty || e.difficulty === w.difficulty));
  const total = pool.reduce((s, e) => s + e.weight, 0);
  let r = rng.next() * total;
  let ev = pool[0];
  for (const e of pool) {
    r -= e.weight;
    if (r <= 0) {
      ev = e;
      break;
    }
  }
  if (!ev) return null;
  const scale = w.market.priceIndex * (w.difficulty === 'entry' ? 0.5 : 1);
  if (ev.gain) {
    const amt = round2(rng.range(ev.gain[0], ev.gain[1]) * scale);
    receive(w, amt, ev.title);
    fx.push({ type: 'narwhal', text: `🎉 ${ev.title}: ${ev.text} +${money(amt)}! Maybe save some of it?`, mood: 'hyped' });
    return `${ev.title}: +${money(amt)}`;
  }
  let cost = round2(rng.range(ev.cost![0], ev.cost![1]) * scale);
  if (ev.cashOnly) {
    cost = Math.min(cost, w.finance.cash);
    if (cost <= 0) return null;
    w.finance.cash = round2(w.finance.cash - cost);
    log(w, ev.title, -cost, 'cash');
    fx.push({ type: 'narwhal', text: `😬 ${ev.title}: ${ev.text} You lost ${money(cost)}. ${ev.tip ?? ''}`, mood: 'disappointed' });
    return `${ev.title}: −${money(cost)}`;
  }
  // Insurance
  let note = '';
  const planId = ev.category ? w.finance.insurance[ev.category] : null;
  const plan = planId ? insurancePlan(planId) : null;
  if (plan) {
    const youPay = round2(Math.min(cost, plan.deductible + Math.max(0, cost - plan.deductible) * (1 - plan.coverage)));
    note = ` Your ${plan.name} insurance covered ${money(cost - youPay)}!`;
    cost = youPay;
    recordEvent(w, fx, { type: 'insuranceClaim', value: cost });
  }
  const before = w.finance.checking + w.finance.cash + w.finance.savings;
  const res = payBill(w, fx, cost, ev.title, { quiet: true });
  if (res.borrowed === 0 && before >= cost) {
    w.progress.stats.eventsCovered = (w.progress.stats.eventsCovered ?? 0) + 1;
  }
  const tip = ev.tip ? ` ${ev.tip}` : '';
  fx.push({
    type: 'narwhal',
    text: `😮 ${ev.title}: ${ev.text} It cost ${money(cost)}.${note}${res.borrowed > 0 ? ` You were short, so ${money(res.borrowed)} was borrowed.` : ''}${tip}`,
    mood: res.borrowed > 0 ? 'disappointed' : 'shocked',
  });
  return `${ev.title}: −${money(cost)}${note}`;
}

function money(x: number) {
  return `$${x.toLocaleString('en-US', { minimumFractionDigits: x < 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

export { PROPERTY_TAX_RATE };
