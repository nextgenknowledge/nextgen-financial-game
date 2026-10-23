'use client';
/**
 * Short Seller's Desk (Advanced). Pick apart a hyped company: profits that never turn into cash,
 * customers paying slower and slower, insiders selling. Then the maths of a short: borrow fees,
 * the profit if you are right and why the loss has no ceiling.
 */
import { useMemo } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { VisualQuiz, rq, shuffled, type VisualItem } from './VisualQuiz';
import { Bars, C, LineChart, Table, usd, usdK } from './pro/kit';

export default function ShortDesk({ onFinish, addReview, seed }: KindProps) {
  const items = useMemo<VisualItem[]>(() => {
    const rng = makeRng(seed * 37 + 2);
    const r = () => rng.next();
    const out: VisualItem[] = [];
    const co = rng.pick(['NovaGrid AI', 'Quantum Hydro', 'StellarPay', 'HyperLoop Freight']);
    const ni = [40, 85, 150, 240].map((v) => v * rng.range(0.9, 1.1));
    const ocf = [35, 30, -10, -60].map((v) => v * rng.range(0.9, 1.1));
    out.push({
      brief: `${co} is the market’s favourite story stock. Its reported profit is soaring. Here is profit against operating cash flow ($M):`,
      visual: <LineChart series={[{ pts: ni, color: C.green, label: 'Net income' }, { pts: ocf, color: C.red, label: 'Operating cash flow' }]} fmt={(v) => `$${v.toFixed(0)}M`} xLabel="Last 4 years →" />,
      q: rq({ id: 'sh-cash', topic: 'investing', prompt: 'What is the warning sign?', ...shuffled(['Profits rise while cash flow falls: earnings may come from aggressive accounting', 'Nothing: profit is what matters', 'Cash flow is falling because the company is too successful', 'Net income is too low'], 0, r), explanation: 'Real profits eventually show up as cash. When reported earnings keep diverging from cash flow, revenue may be booked before customers pay, or costs pushed into the future.' }),
    });
    const rev = rng.pick([800, 900, 1000]);
    const ar = [90, 130, 210].map((v) => (v * rev) / 900);
    const dso = (ar[2] / rev) * 365;
    out.push({
      brief: `Revenue this year was $${rev}M. Money owed by customers (accounts receivable) over three years:`,
      visual: <Table head={['Year', 'Receivables']} rows={ar.map((v, i) => [`Year ${i + 1}`, `$${v.toFixed(0)}M`])} />,
      q: rq({ id: 'sh-dso', topic: 'business', type: 'numeric', value: Math.round(dso), tolAbs: 2, tolRel: 0, prompt: 'How many days does it take customers to pay (days sales outstanding) this year?', hint: 'DSO = receivables ÷ revenue × 365.', explanation: `$${ar[2].toFixed(0)}M ÷ $${rev}M × 365 = ${dso.toFixed(0)} days. Receivables growing far faster than sales suggests the company is "selling" to customers who are not paying, or stuffing distributors with stock.` }),
    });
    out.push({
      brief: 'In the last quarter the CEO and CFO sold 40% of their shares, and the auditor resigned.',
      visual: <Bars items={[{ label: 'Insider buys', value: 0.4, color: C.green }, { label: 'Insider sales', value: 38, color: C.red }]} fmt={(v) => `$${v.toFixed(1)}M`} />,
      q: rq({ id: 'sh-insider', topic: 'investing', prompt: 'How should you read this?', ...shuffled(['Red flags: the people with the most information are getting out', 'Bullish: the executives are diversifying', 'Irrelevant to the share price', 'A sign the auditor was too strict'], 0, r), explanation: 'Insiders sell for many reasons, but heavy selling plus an auditor quitting is a classic pattern before accounting problems come out.' }),
    });
    const sh = rng.pick([500, 1000, 2000]);
    const p0 = rng.pick([80, 90, 120]);
    const p1 = Math.round(p0 * rng.pick([0.6, 0.65, 0.7]));
    const fee = rng.pick([0.06, 0.08, 0.12]);
    const months = 3;
    const pnl = sh * (p0 - p1) - sh * p0 * fee * (months / 12);
    out.push({
      brief: `You short ${sh.toLocaleString()} shares at $${p0}: you borrow them, sell them now and must buy them back later. The borrow fee is ${(fee * 100).toFixed(0)}% a year on the value shorted. After ${months} months the stock is $${p1} and you buy back.`,
      visual: <LineChart series={[{ pts: [p0, p0 * 1.04, p0 * 0.92, p0 * 0.85, p1], color: C.blue, label: 'Share price' }]} fmt={(v) => `$${v.toFixed(0)}`} hlines={[{ y: p0, label: 'Shorted here', color: C.gold }]} />,
      q: rq({ id: 'sh-pnl', topic: 'investing', type: 'numeric', format: 'money', value: Math.round(pnl), tolRel: 0.01, prompt: 'What is your profit after the borrow fee?', explanation: `Gain: ${sh} × ($${p0} − $${p1}) = ${usd(sh * (p0 - p1))}. Fee: ${sh} × $${p0} × ${(fee * 100).toFixed(0)}% × ${months}/12 = ${usd(sh * p0 * fee * 0.25)}. Profit ${usd(pnl)}.` }),
    });
    const squeeze = p0 * 3;
    out.push({
      brief: `Instead, a meme rally sends ${co} to $${squeeze} and short sellers rush to buy back (a short squeeze).`,
      visual: <Bars items={[{ label: 'Best case for a short (stock to $0)', value: sh * p0, color: C.green }, { label: `Loss at $${squeeze}`, value: -sh * (squeeze - p0), color: C.red }]} fmt={usdK} />,
      q: rq({ id: 'sh-squeeze', topic: 'investing', type: 'numeric', format: 'money', value: sh * (squeeze - p0), tolRel: 0.005, prompt: 'How much would you lose (ignoring fees)?', explanation: `${sh} × ($${squeeze} − $${p0}) = ${usd(sh * (squeeze - p0))}. A short can make at most 100%, but a stock can rise without limit. Professionals size shorts small and use stop-losses.` }),
    });
    return out;
  }, [seed]);
  return <VisualQuiz items={items} kicker="Short seller’s desk · Forensic accounting" onFinish={onFinish} addReview={addReview} />;
}
