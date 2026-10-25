'use client';
/**
 * Franchise & M&A Office (Advanced). First the franchise: royalties, the ad fund and the payback
 * on the upfront fee. Then the acquisition: EBITDA, an enterprise value from a comps multiple,
 * equity value after net debt, and the most you should pay once synergies are counted.
 */
import { useMemo } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { VisualQuiz, rq, shuffled, type VisualItem } from './VisualQuiz';
import { Bars, C, Table, usd, usdK } from './pro/kit';

export default function FranchiseDeal({ onFinish, addReview, seed }: KindProps) {
  const items = useMemo<VisualItem[]>(() => {
    const rng = makeRng(seed * 41 + 7);
    const r = () => rng.next();
    const out: VisualItem[] = [];
    const brand = rng.pick(['Harbour Tea Co.', 'Jade Noodle Bar', 'Peak Coffee', 'Lantern Bao']);

    // Franchise economics
    const sales = rng.pick([600, 750, 900]) * 1000;
    const royalty = rng.pick([0.05, 0.06, 0.07]);
    const adFund = rng.pick([0.02, 0.03]);
    const cogs = 0.32;
    const labour = 0.28;
    const rent = rng.pick([84, 96, 120]) * 1000;
    const fee = rng.pick([45, 50, 60]) * 1000;
    const buildOut = rng.pick([250, 300, 350]) * 1000;
    const ebitda = sales * (1 - cogs - labour - royalty - adFund) - rent;
    const payback = (fee + buildOut) / ebitda;
    const pl: [string, number][] = [
      ['Sales', sales],
      ['Food & packaging (32%)', -sales * cogs],
      ['Staff (28%)', -sales * labour],
      [`Royalty (${(royalty * 100).toFixed(0)}% of sales)`, -sales * royalty],
      [`Ad fund (${(adFund * 100).toFixed(0)}% of sales)`, -sales * adFund],
      ['Rent', -rent],
    ];
    out.push({
      brief: `You can buy a ${brand} franchise. The franchisor's disclosure document shows a typical store's year:`,
      visual: <Table head={['Line', 'Per year']} rows={[...pl.map(([k, v]) => [k, usd(v)]), ['Store profit (EBITDA)', '?']]} hl={[pl.length]} />,
      q: rq({ id: 'fr-ebitda', topic: 'business', type: 'numeric', format: 'money', value: Math.round(ebitda), tolRel: 0.01, prompt: 'What is the store’s yearly profit before interest, tax and depreciation (EBITDA)?', explanation: `Sales minus every cost line: ${usd(ebitda)}. The franchisor takes ${usd(sales * (royalty + adFund))} off the top every year, whether or not the store makes money.` }),
    });
    out.push({
      brief: `Opening costs ${usd(fee)} as a franchise fee plus ${usd(buildOut)} to fit out the store.`,
      visual: <Bars items={[{ label: 'Upfront cost', value: fee + buildOut, color: C.red }, { label: 'Profit per year', value: ebitda, color: C.green }]} fmt={usdK} />,
      q: rq({ id: 'fr-payback', topic: 'business', type: 'numeric', format: 'years', value: Math.round(payback * 10) / 10, tolAbs: 0.15, tolRel: 0, prompt: 'How many years until the store pays back what you put in?', hint: 'Payback = upfront cost ÷ yearly profit.', explanation: `${usd(fee + buildOut)} ÷ ${usd(ebitda)} = ${payback.toFixed(1)} years. Investors usually want payback well inside the franchise term (often 10 years).` }),
    });

    // Acquisition
    const target = rng.pick(['Golden Wok Group', 'Kowloon Bakeries', 'Victoria Dumpling Co.']);
    const rev = rng.pick([18, 24, 30]) * 1e6;
    const margin = rng.pick([0.14, 0.16, 0.18]);
    const da = rev * 0.03;
    const ebit = rev * margin - da;
    const tEbitda = ebit + da;
    const multiple = rng.pick([7, 8, 9]);
    const ev = tEbitda * multiple;
    const debt = rng.pick([6, 8, 10]) * 1e6;
    const cash = rng.pick([1, 2, 3]) * 1e6;
    const equity = ev - debt + cash;
    out.push({
      brief: `Next you want to buy a rival chain, ${target}. Its last year:`,
      visual: <Table head={['Line', 'Amount']} rows={[['Revenue', usdK(rev)], ['Operating profit (EBIT)', usdK(ebit)], ['Depreciation & amortisation', usdK(da)], ['EBITDA', '?']]} hl={[3]} />,
      q: rq({ id: 'ma-ebitda', topic: 'business', type: 'numeric', format: 'money', value: Math.round(tEbitda), tolRel: 0.01, prompt: 'What is the target’s EBITDA?', explanation: `EBITDA = EBIT + depreciation & amortisation = ${usdK(ebit)} + ${usdK(da)} = ${usdK(tEbitda)}. It strips out financing and accounting choices so companies compare fairly.` }),
    });
    out.push({
      brief: `Similar restaurant groups sell for about ${multiple}× EBITDA. ${target} has ${usdK(debt)} of debt and ${usdK(cash)} of cash.`,
      visual: <Bars items={[{ label: `Enterprise value (${multiple}× EBITDA)`, value: ev, color: C.blue }, { label: 'Less net debt', value: -(debt - cash), color: C.red }, { label: 'Equity value', value: equity, color: C.green }]} fmt={usdK} />,
      q: rq({ id: 'ma-equity', topic: 'investing', type: 'numeric', format: 'money', value: Math.round(equity), tolRel: 0.01, prompt: 'What should you pay the shareholders for 100% of the equity?', hint: 'Equity value = enterprise value − debt + cash.', explanation: `${multiple} × ${usdK(tEbitda)} = ${usdK(ev)} for the whole business. You also take on the debt and get the cash, so the shareholders get ${usdK(ev)} − ${usdK(debt)} + ${usdK(cash)} = ${usdK(equity)}.` }),
    });
    const syn = rng.pick([1, 1.5, 2]) * 1e6;
    const maxBid = equity + syn * 0.5 * multiple;
    const s5 = shuffled([`Up to about ${usdK(maxBid)}: split the synergies 50/50`, `${usdK(equity + syn * multiple)}: pay the seller for all of the synergies`, `${usdK(equity * 0.6)}: always open with a lowball bid`, `Whatever it takes to beat the other bidder`], 0, r);
    out.push({
      brief: `Combining kitchens and buying in bulk should save ${usdK(syn)} a year (synergies), worth about ${multiple}× that in value. Another bidder is circling.`,
      visual: <Bars items={[{ label: 'Stand-alone equity', value: equity, color: C.blue }, { label: 'Value of synergies', value: syn * multiple, color: C.gold }]} fmt={usdK} />,
      q: rq({ id: 'ma-bid', topic: 'business', prompt: 'What is a disciplined top bid?', ...s5, explanation: 'Synergies only exist because you buy the company, so paying the seller for all of them hands them every bit of the gain (the "winner’s curse"). Disciplined buyers share some synergy to win, and walk away above their limit.' }),
    });
    return out;
  }, [seed]);
  return <VisualQuiz items={items} kicker="Franchise & M&A · Deal desk" onFinish={onFinish} addReview={addReview} />;
}
