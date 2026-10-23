'use client';
/**
 * City Budget Office (Advanced). Balance a city's operating budget across three years: set the
 * property tax rate, fund services with diminishing returns, and decide whether to borrow with a
 * municipal bond for capital projects. Deficits and heavy debt cut the credit rating, which raises
 * the interest on any bond.
 */
import { useMemo, useState } from 'react';
import type { KindProps } from '../types';
import { Button } from '@/ui/common';
import { playSfx } from '@/engine/audio';
import { Bars, C, ProHead, Slider, Stats, Table, Verdict, clamp01 } from './pro/kit';

const SERVICES = [
  { id: 'schools', name: 'Schools', need: 160, w: 0.32, color: C.blue },
  { id: 'safety', name: 'Police & fire', need: 110, w: 0.28, color: C.red },
  { id: 'transit', name: 'Transit & roads', need: 70, w: 0.22, color: C.gold },
  { id: 'parks', name: 'Parks & libraries', need: 30, w: 0.18, color: C.green },
] as const;

const BASE = 24_000; // $M of taxable property
const PENSIONS = 38; // $M fixed

const YEARS = [
  { title: 'Year 1: a normal year', brief: 'Revenue is steady. Build a balanced budget your residents like.', sales: 95, aid: 45, best: 0.775, project: null as null | { name: string; cost: number; boost: number } },
  { title: 'Year 2: recession', brief: 'Shops are quiet and the state cut its aid. Sales tax is down 25%, state aid down 20%.', sales: 71, aid: 36, best: 0.74, project: null },
  { title: 'Year 3: the bridge', brief: 'Engineers closed the river bridge. Rebuilding costs $150M. You can fund it with a 20-year municipal bond.', sales: 90, aid: 42, best: 0.85, project: { name: 'River bridge', cost: 150, boost: 0.25 } },
];

function rating(debtLoad: number, deficit: number) {
  const s = debtLoad * 1.5 + Math.max(0, deficit) / 10;
  return s < 0.6 ? { r: 'AA', rate: 0.035 } : s < 1.1 ? { r: 'A', rate: 0.042 } : s < 1.8 ? { r: 'BBB', rate: 0.052 } : { r: 'BB (junk)', rate: 0.068 };
}

export default function CityBudget({ onFinish, addReview }: KindProps) {
  const [y, setY] = useState(0);
  const [tax, setTax] = useState(1.0); // % of property value
  const [spend, setSpend] = useState<number[]>([120, 90, 45, 15]);
  const [bond, setBond] = useState(false);
  const [debt, setDebt] = useState(60); // $M outstanding from before
  const [done, setDone] = useState<null | { score: number; happy: number; deficit: number; rr: string }>(null);
  const [scores, setScores] = useState<number[]>([]);
  const yr = YEARS[y];

  const calc = useMemo(() => {
    const prop = (BASE * tax) / 100;
    const revenue = prop + yr.sales + yr.aid;
    const newDebt = yr.project && bond ? yr.project.cost : 0;
    const totalDebt = debt + newDebt;
    const pre = rating(totalDebt / revenue, 0);
    const service = totalDebt * (pre.rate + 1 / 20); // interest + principal over 20 years
    const ops = spend.reduce((a, b) => a + b, 0) + PENSIONS + service;
    const deficit = ops - revenue;
    const rr = rating(totalDebt / revenue, deficit);
    const quality = SERVICES.map((s, i) => 1 - Math.exp(-(spend[i] / s.need) * 1.6));
    let happy = SERVICES.reduce((a, s, i) => a + s.w * quality[i], 0);
    if (yr.project) happy = bond ? happy + yr.project.boost * 0.4 : happy - yr.project.boost;
    happy -= Math.max(0, tax - 1.0) * 0.35; // tax rises are unpopular
    return { prop, revenue, ops, deficit, service, rr, happy: clamp01(happy), quality, totalDebt };
  }, [tax, spend, bond, debt, yr]);

  const submit = () => {
    const balanced = calc.deficit <= 0.5;
    const ratingOk = !calc.rr.r.startsWith('BB');
    // Satisfaction 55% is a city in trouble; `best` is the most a balanced budget can reach that year
    const score = clamp01((calc.happy - 0.55) / (yr.best - 0.55)) * (balanced ? 1 : 0.4) * (ratingOk ? 1 : 0.7);
    setDone({ score, happy: calc.happy, deficit: calc.deficit, rr: calc.rr.r });
    setScores((s) => [...s, score]);
    playSfx(score > 0.85 ? 'correct' : score > 0.6 ? 'star' : 'wrong');
    addReview?.({
      q: yr.title,
      ok: score > 0.8,
      answer: `${balanced ? 'Balanced' : `Deficit $${calc.deficit.toFixed(0)}M`}, rating ${calc.rr.r}, satisfaction ${(calc.happy * 100).toFixed(0)}%`,
      explanation: y === 2 ? 'Borrowing for a long-lived asset like a bridge is normal: residents who use it for 40 years help pay for it. Borrowing to pay salaries is not.' : y === 1 ? 'In a recession revenue falls just as needs rise. Cities trim lower-value spending first, use reserves, and avoid raising taxes on struggling households if they can.' : 'Each extra dollar of a service helps less than the one before (diminishing returns), so spreading money where it does the most good beats maxing one service.',
    });
  };
  const next = () => {
    if (y + 1 >= YEARS.length) {
      const all = [...scores];
      onFinish({ score: (all.reduce((a, b) => a + b, 0) / all.length) * 100, summary: `Average budget score ${Math.round((all.reduce((a, b) => a + b, 0) / all.length) * 100)}%.` });
      return;
    }
    setDebt(calc.totalDebt * 0.95);
    setY(y + 1);
    setDone(null);
    setBond(false);
  };

  return (
    <div className="pro">
      <ProHead kicker={`City budget office · ${yr.title}`} title="Balance the budget" sub={yr.brief} right={<div className="pro-price"><span className="pro-kicker">Credit rating</span><b>{calc.rr.r}</b></div>} />
      <div className="pro-grid">
        <section className="pro-panel">
          <h4>Revenue</h4>
          <Slider label="Property tax rate" value={tax} min={0.6} max={1.6} step={0.05} onChange={setTax} show={`${tax.toFixed(2)}%`} disabled={!!done} />
          <Table compact head={['Source', '$M']} rows={[['Property tax', calc.prop.toFixed(0)], ['Sales tax', yr.sales], ['State aid', yr.aid], ['Total revenue', calc.revenue.toFixed(0)]]} hl={[3]} />
          <h4 style={{ marginTop: 10 }}>Spending ($M)</h4>
          {SERVICES.map((s, i) => (
            <Slider key={s.id} label={s.name} color={s.color} value={spend[i]} min={0} max={Math.round(s.need * 1.8)} step={1} onChange={(v) => setSpend(spend.map((x, j) => (j === i ? v : x)))} show={`$${spend[i]}M`} disabled={!!done} />
          ))}
          {yr.project && (
            <label className="row" style={{ gap: 8, marginTop: 6, fontWeight: 800 }}>
              <input type="checkbox" checked={bond} disabled={!!done} onChange={(e) => setBond(e.target.checked)} /> Issue a ${yr.project.cost}M bond to rebuild the {yr.project.name.toLowerCase()}
            </label>
          )}
        </section>
        <section className="pro-panel">
          <h4>The budget</h4>
          <Stats
            items={[
              ['Revenue', `$${calc.revenue.toFixed(0)}M`],
              ['Spending', `$${calc.ops.toFixed(0)}M`],
              [calc.deficit > 0 ? 'Deficit' : 'Surplus', `$${Math.abs(calc.deficit).toFixed(0)}M`, calc.deficit > 0.5 ? 'bad' : 'good'],
              ['Satisfaction', `${(calc.happy * 100).toFixed(0)}%`],
            ]}
          />
          <p className="tiny muted">Includes ${PENSIONS}M of pensions and ${calc.service.toFixed(1)}M of debt service on ${calc.totalDebt.toFixed(0)}M of bonds at {(calc.rr.rate * 100).toFixed(1)}%. Cities must balance their operating budget by law.</p>
          <h4>Service quality</h4>
          <Bars items={SERVICES.map((s, i) => ({ label: s.name, value: calc.quality[i] * 100, color: s.color }))} fmt={(v) => `${v.toFixed(0)}%`} />
          {done && (
            <Verdict ok={done.score > 0.8} title={`Score ${Math.round(done.score * 100)}%`}>
              {done.deficit > 0.5 ? `A $${done.deficit.toFixed(0)}M deficit is not allowed. ` : 'Balanced. '}Rating {done.rr}. Satisfaction {(done.happy * 100).toFixed(0)}%.
            </Verdict>
          )}
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
            {!done ? (
              <Button variant="gold" size="big" onClick={submit}>
                Pass the budget
              </Button>
            ) : (
              <Button variant="primary" size="big" onClick={next}>
                {y + 1 >= YEARS.length ? 'See results ▶' : 'Next year ▶'}
              </Button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
