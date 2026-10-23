'use client';
/**
 * Retail Analyst Desk (Advanced). Two department-store chains side by side: gross margin,
 * inventory turnover and days of inventory, same-store sales against total growth, and the call.
 */
import { useMemo } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { VisualQuiz, rq, shuffled, type VisualItem } from './VisualQuiz';
import { Bars, C, Table, pc, usdK } from './pro/kit';

export default function RetailAnalyst({ onFinish, addReview, seed }: KindProps) {
  const items = useMemo<VisualItem[]>(() => {
    const rng = makeRng(seed * 29 + 11);
    const r = () => rng.next();
    const out: VisualItem[] = [];
    const A = { name: 'Harrow & Finch', sales: rng.pick([4.2, 4.8, 5.4]) * 1e9, gm: rng.pick([0.42, 0.44, 0.46]), inv: rng.pick([1.1, 1.3]) * 1e9, sss: rng.pick([0.031, 0.042]), stores: rng.pick([0.01, 0.02]) };
    const B = { name: 'MegaMart', sales: rng.pick([6.5, 7.5]) * 1e9, gm: rng.pick([0.29, 0.31, 0.33]), inv: rng.pick([0.7, 0.8]) * 1e9, sss: rng.pick([-0.012, -0.02]), stores: rng.pick([0.09, 0.11]) };
    const cogs = (x: typeof A) => x.sales * (1 - x.gm);
    const turns = (x: typeof A) => cogs(x) / x.inv;
    const days = (x: typeof A) => 365 / turns(x);
    const growth = (x: typeof A) => (1 + x.sss) * (1 + x.stores) - 1;
    const table = (
      <Table
        head={['', A.name, B.name]}
        rows={[
          ['Revenue', usdK(A.sales), usdK(B.sales)],
          ['Cost of goods sold', usdK(cogs(A)), usdK(cogs(B))],
          ['Average inventory', usdK(A.inv), usdK(B.inv)],
          ['Same-store sales growth', pc(A.sss), pc(B.sss)],
          ['Growth from new stores', pc(A.stores), pc(B.stores)],
        ]}
      />
    );
    out.push({
      brief: 'You cover two retailers. Start with profitability per dollar of sales.',
      visual: table,
      q: rq({ id: 'ra-gm', topic: 'business', type: 'numeric', format: 'pct', value: Math.round(B.gm * 1000) / 10, tolAbs: 0.2, tolRel: 0, prompt: `What is ${B.name}’s gross margin?`, hint: 'Gross margin = (revenue − cost of goods) ÷ revenue.', explanation: `(${usdK(B.sales)} − ${usdK(cogs(B))}) ÷ ${usdK(B.sales)} = ${pc(B.gm)}. ${A.name} earns ${pc(A.gm)}: it sells pricier brands, ${B.name} competes on price.` }),
    });
    out.push({
      brief: 'Inventory ties up cash and goes out of fashion. How fast does each chain sell through its stock?',
      visual: table,
      q: rq({ id: 'ra-turns', topic: 'business', type: 'numeric', value: Math.round(turns(B) * 10) / 10, tolAbs: 0.15, tolRel: 0, prompt: `What is ${B.name}’s inventory turnover (times per year)?`, hint: 'Inventory turnover = cost of goods sold ÷ average inventory.', explanation: `${usdK(cogs(B))} ÷ ${usdK(B.inv)} = ${turns(B).toFixed(1)}× a year, about ${days(B).toFixed(0)} days of stock. ${A.name} turns ${turns(A).toFixed(1)}× (${days(A).toFixed(0)} days). Low margins need fast turns.` }),
    });
    out.push({
      brief: 'Days of inventory for the higher-end chain:',
      visual: <Bars items={[{ label: A.name, value: days(A), color: C.violet }, { label: B.name, value: days(B), color: C.blue }]} fmt={(v) => `${v.toFixed(0)} days`} />,
      q: rq({ id: 'ra-days', topic: 'business', type: 'numeric', value: Math.round(days(A)), tolAbs: 2, tolRel: 0, prompt: `How many days of inventory does ${A.name} hold?`, hint: 'Days of inventory = 365 ÷ inventory turnover.', explanation: `365 ÷ ${turns(A).toFixed(2)} = ${days(A).toFixed(0)} days. Slower-moving stock is normal for premium goods, but rising days can mean unsold items heading for markdowns.` }),
    });
    out.push({
      brief: `${B.name}’s headline sales grew ${pc(growth(B))} this year. Same-store sales strip out new stores.`,
      visual: <Bars items={[{ label: `${B.name} total`, value: growth(B) * 100, color: C.blue }, { label: `${B.name} same-store`, value: B.sss * 100 }, { label: `${A.name} same-store`, value: A.sss * 100, color: C.green }]} fmt={(v) => `${v.toFixed(1)}%`} />,
      q: rq({ id: 'ra-sss', topic: 'investing', prompt: `What does this tell you about ${B.name}?`, ...shuffled(['Growth is bought by opening stores while existing stores sell less', 'Customers love it: total sales are growing fast', 'Same-store sales do not matter to analysts', 'Its margins must be rising'], 0, r), explanation: 'Negative same-store sales mean the average existing store is shrinking. Opening stores hides it in the headline number, but new stores cost capital and eventually run out of places to go.' }),
    });
    out.push({
      brief: 'Both trade at a similar price-to-earnings ratio. Write the call.',
      visual: table,
      q: rq({ id: 'ra-call', topic: 'investing', prompt: 'Which stock would you rate higher, and why?', ...shuffled([`${A.name}: higher margins and positive same-store sales at the same valuation`, `${B.name}: it has more revenue`, `${B.name}: more stores means more growth`, 'Neither: retail stocks always fall'], 0, r), explanation: `${A.name} grows from its existing stores and keeps more of each sale. ${B.name}’s growth comes from expansion while the core shrinks. At the same multiple, quality is cheaper.` }),
    });
    return out;
  }, [seed]);
  return <VisualQuiz items={items} kicker="Retail analyst desk · Equity research" onFinish={onFinish} addReview={addReview} />;
}
