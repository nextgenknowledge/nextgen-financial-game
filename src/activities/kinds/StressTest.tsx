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

const BUDGET = [
  { k: 'Rent', amt: 1600, fixed: true },
  { k: 'Groceries', amt: 600 },
  { k: 'Transport', amt: 350 },
  { k: 'Insurance', amt: 200, fixed: true },
  { k: 'Loan minimum', amt: 150, fixed: true },
  { k: 'Phone & internet', amt: 110 },
  { k: 'Subscriptions', amt: 90 },
  { k: 'Eating out & fun', amt: 380 },
];

const CUTS = [
  { id: 'subs', name: 'Cancel subscriptions', save: 90, pain: 0.02 },
  { id: 'fun', name: 'Cut eating out & fun to $100', save: 280, pain: 0.08 },
  { id: 'cook', name: 'Cook everything at home (groceries −$150)', save: 150, pain: 0.04 },
  { id: 'phone', name: 'Switch to a cheap phone plan', save: 60, pain: 0.01 },
  { id: 'bike', name: 'Bike instead of driving (−$200)', save: 200, pain: 0.05 },
  { id: 'gig', name: 'Weekend delivery side gig (+$600/month)', save: 600, pain: 0.12 },
  { id: 'insurance', name: 'Drop health insurance (−$200)', save: 200, pain: 0.02, trap: true },
];

const SOURCES = [
  { id: 'savings', name: 'Emergency savings', note: '$9,000 in a savings account' },
  { id: 'card', name: 'Credit card', note: '$5,000 limit at 24% APR' },
  { id: 'invest', name: 'Sell index fund', note: '$12,000, currently down 20% in a slump' },
] as const;

type Src = (typeof SOURCES)[number]['id'];
const MONTHS = 8;
const BENEFIT = 1800;
const PAY = 4200;

function simulate(cuts: Set<string>, order: Src[]) {
  let savings = 9000;
  let card = 0;
  let investUnits = 12000; // value before the slump
  let sold = 0;
  let realised = 0;
  let missed = 0;
  let interest = 0;
  const savePath: number[] = [];
  const medical = cuts.has('insurance') ? 6000 : 600;
  for (let m = 0; m < MONTHS; m++) {
    const income = (m < 5 ? BENEFIT : PAY) + (cuts.has('gig') ? 600 : 0);
    let spend = BUDGET.reduce((a, b) => a + b.amt, 0) + (m >= 3 ? 120 : 0) + (m === 1 ? medical : 0);
    for (const c of CUTS) if (c.id !== 'gig' && cuts.has(c.id)) spend -= c.save;
    let gap = spend - income;
    const marketMult = m < 4 ? 0.8 : 0.8 + (m - 3) * 0.05;
    interest += card * 0.02;
    card *= 1.02;
    if (gap < 0) {
      // Surplus repays the card first, then rebuilds savings
      const pay = Math.min(card, -gap);
      card -= pay;
      savings += -gap - pay;
      gap = 0;
    }
    for (const s of order) {
      if (gap <= 0) break;
      if (s === 'savings') {
        const use = Math.min(savings, gap);
        savings -= use;
        gap -= use;
      } else if (s === 'card') {
        const use = Math.min(5000 - card, gap);
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
  const pain = CUTS.filter((c) => cuts.has(c.id)).reduce((a, c) => a + c.pain, 0);
  return { savings, card, interest, sold, realised, missed, savePath, pain, insured: !cuts.has('insurance') };
}

export default function StressTest({ onFinish, addReview }: KindProps) {
  const [cuts, setCuts] = useState<Set<string>>(new Set());
  const [order, setOrder] = useState<Src[]>(['card', 'invest', 'savings']);
  const [done, setDone] = useState(false);
  const sim = useMemo(() => simulate(cuts, order), [cuts, order]);
  const cost = sim.interest + sim.realised + (sim.insured ? 0 : 5400) + sim.missed * 800;
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
    if (!sim.insured) addReview?.({ q: 'Dropping health insurance', ok: false, answer: 'Keep it', explanation: 'Insurance is cheapest to keep precisely when you can least afford a big bill. Here the medical bill went from $600 to $6,000 without it.' });
    setTimeout(() => onFinish({ score: score * 100, summary: `${sim.missed ? `${sim.missed} missed payments` : 'No missed payments'}. Long-run cost ${usd(cost)}.` }), 2200);
  };

  return (
    <div className="pro">
      <ProHead kicker="Risk & resilience center · Personal stress test" title="Survive the bad year" sub={`Take-home pay ${usd(PAY)}/month. You lose your job for 5 months (unemployment benefit ${usd(BENEFIT)}). Month 2: a medical bill. Month 4: your variable loan payment rises $120.`} right={<div className="pro-price"><span className="pro-kicker">Long-run cost</span><b style={{ color: cost > 2000 ? C.red : undefined }}>{usd(cost)}</b></div>} />
      <div className="pro-grid">
        <section className="pro-panel">
          <h4>1 · Cut costs</h4>
          <Table compact head={['Monthly budget', '']} rows={BUDGET.map((b) => [b.k, usd(b.amt)])} />
          <div className="col" style={{ gap: 6, marginTop: 8 }}>
            {CUTS.map((c) => (
              <label key={c.id} className="row" style={{ gap: 8, fontWeight: 700 }}>
                <input type="checkbox" checked={cuts.has(c.id)} disabled={done} onChange={() => toggle(c.id)} /> {c.name}
              </label>
            ))}
          </div>
        </section>
        <section className="pro-panel">
          <h4>2 · Cover the gap, in this order</h4>
          <div className="col" style={{ gap: 6 }}>
            {order.map((s, i) => {
              const src = SOURCES.find((x) => x.id === s)!;
              return (
                <div key={s} className={cls('st-src')}>
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
