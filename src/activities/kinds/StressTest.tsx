'use client';
/**
 * Personal Finance Stress Test (Advanced). A young professional loses their job for five months,
 * then a medical bill and a rate rise land. Choose which costs to cut and in what order to draw on
 * savings, the credit card and investments. Scored on getting through without missed payments,
 * at the lowest long-run cost (interest and selling investments in a slump), without cutting so
 * deep that life falls apart.
 */
import { useMemo, useState } from 'react';
import type { KindProps } from '../types';
import { Button } from '@/ui/common';
import { playSfx } from '@/engine/audio';
import { cls } from '@/ui/format';
import { C, LineChart, ProHead, Stats, Table, Verdict, usd } from './pro/kit';
import { variantIndex } from '../variant';

interface Cut {
  id: string;
  name: string;
  save: number;
  pain: number;
  income?: boolean; // adds income instead of cutting a cost
  trap?: boolean; // dropping cover that the year's emergency needs
}
interface Scenario {
  title: string;
  sub: string;
  pay: number;
  low: number; // income during the bad months
  lowMonths: number;
  budget: { k: string; amt: number }[];
  cuts: Cut[];
  savings: number;
  cardLimit: number;
  invest: number;
  dip: number; // how far investments are down at the start
  event: { month: number; insured: number; uninsured: number; what: string };
  rise?: { from: number; amt: number };
  extra?: { month: number; amt: number };
}

// Four different bad years. Each has its own budget, emergency and tempting wrong cut.
const SCENARIOS: Scenario[] = [
  {
    title: 'Laid off',
    sub: 'Take-home pay $4,200/month. You lose your job for 5 months (unemployment benefit $1,800). Month 2: a medical bill. Month 4: your variable loan payment rises $120.',
    pay: 4200, low: 1800, lowMonths: 5, savings: 9000, cardLimit: 5000, invest: 12000, dip: 0.2,
    budget: [{ k: 'Rent', amt: 1600 }, { k: 'Groceries', amt: 600 }, { k: 'Transport', amt: 350 }, { k: 'Insurance', amt: 200 }, { k: 'Loan minimum', amt: 150 }, { k: 'Phone & internet', amt: 110 }, { k: 'Subscriptions', amt: 90 }, { k: 'Eating out & fun', amt: 380 }],
    cuts: [
      { id: 'subs', name: 'Cancel subscriptions', save: 90, pain: 0.02 },
      { id: 'fun', name: 'Cut eating out & fun to $100', save: 280, pain: 0.08 },
      { id: 'cook', name: 'Cook everything at home (groceries −$150)', save: 150, pain: 0.04 },
      { id: 'phone', name: 'Switch to a cheap phone plan', save: 60, pain: 0.01 },
      { id: 'bike', name: 'Bike instead of driving (−$200)', save: 200, pain: 0.05 },
      { id: 'gig', name: 'Weekend delivery side gig (+$600/month)', save: 600, pain: 0.12, income: true },
      { id: 'trap', name: 'Drop health insurance (−$200)', save: 200, pain: 0.02, trap: true },
    ],
    event: { month: 1, insured: 600, uninsured: 6000, what: 'The medical bill' },
    rise: { from: 3, amt: 120 },
  },
  {
    title: 'Hours cut',
    sub: 'Take-home pay $3,000/month. The store cuts your hours for 6 months, so you bring home $1,900. Month 3: a car crash. Month 5: your rent rises $80 at lease renewal.',
    pay: 3000, low: 1900, lowMonths: 6, savings: 3500, cardLimit: 4000, invest: 8000, dip: 0.25,
    budget: [{ k: 'Rent', amt: 1100 }, { k: 'Groceries', amt: 450 }, { k: 'Gas & parking', amt: 300 }, { k: 'Car insurance', amt: 140 }, { k: 'Loan minimum', amt: 100 }, { k: 'Phone & internet', amt: 90 }, { k: 'Subscriptions', amt: 70 }, { k: 'Eating out & fun', amt: 300 }],
    cuts: [
      { id: 'subs', name: 'Cancel subscriptions', save: 70, pain: 0.02 },
      { id: 'fun', name: 'Cut eating out & fun to $80', save: 220, pain: 0.08 },
      { id: 'cook', name: 'Cook everything at home (groceries −$120)', save: 120, pain: 0.04 },
      { id: 'phone', name: 'Switch to a cheap phone plan', save: 50, pain: 0.01 },
      { id: 'bus', name: 'Take the bus to work (gas −$150)', save: 150, pain: 0.05 },
      { id: 'gig', name: 'Tutoring on weekends (+$500/month)', save: 500, pain: 0.12, income: true },
      { id: 'trap', name: 'Drop car insurance (−$140)', save: 140, pain: 0.02, trap: true },
    ],
    event: { month: 2, insured: 500, uninsured: 4500, what: 'The car crash' },
    rise: { from: 4, amt: 80 },
  },
  {
    title: 'Freelance dry spell',
    sub: 'You usually earn $5,000/month as a freelance designer. Your biggest client leaves, and for 4 months small jobs bring in $1,200. Month 2: a burst pipe ruins your laptop and desk. Month 6: a $1,500 tax payment is due.',
    pay: 5000, low: 1200, lowMonths: 4, savings: 7000, cardLimit: 6000, invest: 15000, dip: 0.2,
    budget: [{ k: 'Rent', amt: 1800 }, { k: 'Groceries', amt: 550 }, { k: 'Transport', amt: 150 }, { k: "Renters' & health insurance", amt: 220 }, { k: 'Loan minimum', amt: 200 }, { k: 'Phone & internet', amt: 130 }, { k: 'Software & subscriptions', amt: 160 }, { k: 'Eating out & fun', amt: 420 }],
    cuts: [
      { id: 'subs', name: 'Cancel software you are not using (−$100)', save: 100, pain: 0.02 },
      { id: 'fun', name: 'Cut eating out & fun to $100', save: 320, pain: 0.08 },
      { id: 'cook', name: 'Cook everything at home (groceries −$150)', save: 150, pain: 0.04 },
      { id: 'phone', name: 'Switch to a cheap phone plan', save: 60, pain: 0.01 },
      { id: 'bike', name: 'Bike instead of the bus (−$100)', save: 100, pain: 0.03 },
      { id: 'gig', name: 'Teach an evening design class (+$700/month)', save: 700, pain: 0.12, income: true },
      { id: 'trap', name: "Drop renters' insurance (−$220)", save: 220, pain: 0.02, trap: true },
    ],
    event: { month: 1, insured: 250, uninsured: 3000, what: 'The water damage' },
    extra: { month: 5, amt: 1500 },
  },
  {
    title: 'Injured',
    sub: 'Take-home pay $4,600/month. A bad fall means 4 months off work on disability pay of $2,700. Month 1: the emergency room. From month 2: physical therapy adds $150 a month.',
    pay: 4600, low: 2700, lowMonths: 4, savings: 5500, cardLimit: 5000, invest: 20000, dip: 0.25,
    budget: [{ k: 'Rent', amt: 1900 }, { k: 'Groceries', amt: 650 }, { k: 'Transport', amt: 300 }, { k: 'Health insurance', amt: 260 }, { k: 'Loan minimum', amt: 250 }, { k: 'Phone & internet', amt: 120 }, { k: 'Gym & subscriptions', amt: 80 }, { k: 'Eating out & fun', amt: 400 }],
    cuts: [
      { id: 'subs', name: 'Pause the gym and subscriptions', save: 80, pain: 0.02 },
      { id: 'fun', name: 'Cut eating out & fun to $100', save: 300, pain: 0.08 },
      { id: 'cook', name: 'Cook at home with help from friends (groceries −$150)', save: 150, pain: 0.04 },
      { id: 'phone', name: 'Switch to a cheap phone plan', save: 60, pain: 0.01 },
      { id: 'car', name: 'Pause car costs while you cannot drive (−$200)', save: 200, pain: 0.02 },
      { id: 'gig', name: 'Paid online surveys from bed (+$150/month)', save: 150, pain: 0.06, income: true },
      { id: 'trap', name: 'Drop health insurance (−$260)', save: 260, pain: 0.02, trap: true },
    ],
    event: { month: 0, insured: 1000, uninsured: 9000, what: 'The emergency room bill' },
    rise: { from: 1, amt: 150 },
  },
];

type Src = 'savings' | 'card' | 'invest';
const MONTHS = 8;

function sources(s: Scenario) {
  return [
    { id: 'savings' as Src, name: 'Emergency savings', note: `${usd(s.savings)} in a savings account` },
    { id: 'card' as Src, name: 'Credit card', note: `${usd(s.cardLimit)} limit at 24% APR` },
    { id: 'invest' as Src, name: 'Sell index fund', note: `${usd(s.invest)}, currently down ${Math.round(s.dip * 100)}% in a slump` },
  ];
}

function simulate(s: Scenario, cuts: Set<string>, order: Src[]) {
  let savings = s.savings;
  let card = 0;
  let investUnits = s.invest; // value before the slump
  let sold = 0;
  let realised = 0;
  let missed = 0;
  let interest = 0;
  const savePath: number[] = [];
  const insured = !cuts.has('trap');
  const total = s.budget.reduce((a, b) => a + b.amt, 0);
  for (let m = 0; m < MONTHS; m++) {
    let income = m < s.lowMonths ? s.low : s.pay;
    let spend = total + (s.rise && m >= s.rise.from ? s.rise.amt : 0) + (m === s.event.month ? (insured ? s.event.insured : s.event.uninsured) : 0) + (s.extra && m === s.extra.month ? s.extra.amt : 0);
    for (const c of s.cuts) if (cuts.has(c.id)) c.income ? (income += c.save) : (spend -= c.save);
    let gap = spend - income;
    const marketMult = m < 4 ? 1 - s.dip : 1 - s.dip + ((m - 3) * s.dip) / 4;
    interest += card * 0.02;
    card *= 1.02;
    if (gap < 0) {
      // Surplus repays the card first, then rebuilds savings
      const pay = Math.min(card, -gap);
      card -= pay;
      savings += -gap - pay;
      gap = 0;
    }
    for (const src of order) {
      if (gap <= 0) break;
      if (src === 'savings') {
        const use = Math.min(savings, gap);
        savings -= use;
        gap -= use;
      } else if (src === 'card') {
        const use = Math.min(s.cardLimit - card, gap);
        card += use;
        gap -= use;
      } else {
        const value = investUnits * marketMult;
        const use = Math.min(value, gap);
        investUnits -= use / marketMult;
        sold += use;
        realised += use / marketMult - use; // value given up by selling low
        gap -= use;
      }
    }
    if (gap > 1) missed++;
    savePath.push(savings + investUnits - card);
  }
  const pain = s.cuts.filter((c) => cuts.has(c.id)).reduce((a, c) => a + c.pain, 0);
  return { savings, card, interest, sold, realised, missed, savePath, pain, insured };
}

export default function StressTest({ seed, onFinish, addReview }: KindProps) {
  const [s] = useState(() => SCENARIOS[variantIndex('stress-test', SCENARIOS.length, seed)]);
  const SOURCES = sources(s);
  const [cuts, setCuts] = useState<Set<string>>(new Set());
  const [order, setOrder] = useState<Src[]>(['card', 'invest', 'savings']);
  const [done, setDone] = useState(false);
  const sim = useMemo(() => simulate(s, cuts, order), [s, cuts, order]);
  const cost = sim.interest + sim.realised + (sim.insured ? 0 : s.event.uninsured - s.event.insured) + sim.missed * 800;
  const score = Math.max(0, Math.min(1, 1 - cost / 4000 - sim.missed * 0.25 - Math.max(0, sim.pain - 0.2) * 1.5));

  const toggle = (id: string) => {
    if (done) return;
    const n = new Set(cuts);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setCuts(n);
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (done || j < 0 || j >= order.length) return;
    const n = [...order];
    [n[i], n[j]] = [n[j], n[i]];
    setOrder(n);
  };
  const commit = () => {
    setDone(true);
    playSfx(score > 0.8 ? 'correct' : score > 0.5 ? 'star' : 'wrong');
    addReview?.({ q: 'Order of funding sources', ok: order[0] === 'savings', answer: 'Emergency savings first, then the credit card for a short gap, investments last', explanation: 'Emergency savings exist for exactly this. Selling investments in a slump locks in the loss, and a 24% card balance grows fast, so use it only briefly.' });
    const trap = s.cuts.find((c) => c.trap)!;
    if (!sim.insured) addReview?.({ q: trap.name, ok: false, answer: 'Keep it', explanation: `Insurance is cheapest to keep precisely when you can least afford a big bill. ${s.event.what} cost ${usd(s.event.uninsured)} without it instead of ${usd(s.event.insured)}.` });
    setTimeout(() => onFinish({ score: score * 100, summary: `${sim.missed ? `${sim.missed} missed payments` : 'No missed payments'}. Long-run cost ${usd(cost)}.` }), 2200);
  };

  return (
    <div className="pro">
      <ProHead kicker={`Risk & resilience center · Personal stress test · ${s.title}`} title="Survive the bad year" sub={s.sub} right={<div className="pro-price"><span className="pro-kicker">Long-run cost</span><b style={{ color: cost > 2000 ? C.red : undefined }}>{usd(cost)}</b></div>} />
      <div className="pro-grid">
        <section className="pro-panel">
          <h4>1 · Cut costs</h4>
          <Table compact head={['Monthly budget', '']} rows={s.budget.map((b) => [b.k, usd(b.amt)])} />
          <div className="col" style={{ gap: 6, marginTop: 8 }}>
            {s.cuts.map((c) => (
              <label key={c.id} className="row" style={{ gap: 8, fontWeight: 700 }}>
                <input type="checkbox" checked={cuts.has(c.id)} disabled={done} onChange={() => toggle(c.id)} /> {c.name}
              </label>
            ))}
          </div>
        </section>
        <section className="pro-panel">
          <h4>2 · Cover the gap, in this order</h4>
          <div className="col" style={{ gap: 6 }}>
            {order.map((id, i) => {
              const src = SOURCES.find((x) => x.id === id)!;
              return (
                <div key={id} className={cls('st-src')}>
                  <b>
                    {i + 1}. {src.name}
                  </b>
                  <span className="tiny muted grow">{src.note}</span>
                  <button type="button" className="pro-pill" disabled={done || i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                    ▲
                  </button>
                  <button type="button" className="pro-pill" disabled={done || i === order.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                    ▼
                  </button>
                </div>
              );
            })}
          </div>
          <LineChart series={[{ pts: sim.savePath, color: C.blue, label: 'Net savings (savings + investments − card)' }]} h={140} fmt={(v) => usd(v)} xLabel="Months →" />
          <Stats items={[['Missed payments', sim.missed, sim.missed ? 'bad' : 'good'], ['Card interest', usd(sim.interest)], ['Lost selling low', usd(sim.realised)], ['Lifestyle squeeze', `${Math.round(sim.pain * 100)}%`, sim.pain > 0.25 ? 'bad' : undefined]]} />
          {done ? (
            <Verdict ok={score > 0.8} title={`Resilience score ${Math.round(score * 100)}%`}>
              {sim.missed ? 'Missed payments hurt your credit for years.' : 'You made it through.'} Savings first, card briefly, never sell investments at the bottom, and keep insurance.
            </Verdict>
          ) : (
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
              <Button variant="gold" size="big" onClick={commit}>
                Live through the year
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
