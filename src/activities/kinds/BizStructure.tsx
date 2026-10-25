'use client';
/**
 * Choose a Business Structure (Advanced). Sole proprietorship, partnership, LLC and corporation:
 * personal liability, pass-through vs double taxation, raising venture money and self-employment
 * tax, each worked through with numbers.
 */
import { useMemo } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { VisualQuiz, rq, shuffled, type VisualItem } from './VisualQuiz';
import { Bars, C, Table, usd } from './pro/kit';

const MATRIX = (
  <Table
    head={['Structure', 'Owners personally liable?', 'Taxed', 'Can sell shares to investors?']}
    rows={[
      ['Sole proprietor', 'Yes, everything', 'Owner’s tax return', 'No'],
      ['General partnership', 'Yes, for partners’ debts too', 'Partners’ returns', 'No'],
      ['LLC', 'No (limited)', 'Pass-through by default', 'Units, awkward for VCs'],
      ['C corporation', 'No (limited)', 'Company tax, then dividend tax', 'Yes, preferred stock'],
    ]}
  />
);

export default function BizStructure({ onFinish, addReview, seed }: KindProps) {
  const items = useMemo<VisualItem[]>(() => {
    const rng = makeRng(seed * 23 + 1);
    const r = () => rng.next();
    const out: VisualItem[] = [];

    const s1 = shuffled(['An LLC: their homes stay safe from business debts', 'A sole proprietorship: it is the cheapest to set up', 'A general partnership: the partners share the risk equally', 'It makes no difference to liability'], 0, r);
    out.push({
      brief: 'Two friends are opening a climbing gym. A customer injury lawsuit could exceed their insurance. Both own homes.',
      visual: MATRIX,
      q: rq({ id: 'bs-liab', topic: 'business', prompt: 'Which structure protects their personal assets?', ...s1, explanation: 'LLCs and corporations have limited liability: creditors can take the business’s assets, not the owners’ houses. In a sole proprietorship or general partnership the owner is the business.' }),
    });

    const profit = rng.pick([200, 250, 300]) * 1000;
    const corp = 0.21;
    const div = 0.15;
    const personal = rng.pick([0.24, 0.32]);
    const cTake = profit * (1 - corp) * (1 - div);
    const pTake = profit * (1 - personal);
    out.push({
      brief: `A business earns ${usd(profit)} and pays all of it to its single owner. As a C corporation it pays 21% corporate tax, then the owner pays 15% tax on the dividend.`,
      visual: <Bars items={[{ label: 'Profit', value: profit, color: C.blue }, { label: 'After 21% corporate tax', value: profit * (1 - corp), color: C.gold }, { label: 'After 15% dividend tax', value: cTake, color: C.green }]} fmt={(v) => usd(v)} />,
      q: rq({ id: 'bs-double', topic: 'taxes', type: 'numeric', format: 'money', value: Math.round(cTake), tolRel: 0.005, prompt: 'How much does the owner keep?', explanation: `${usd(profit)} × 0.79 × 0.85 = ${usd(cTake)}. Profit is taxed twice: an effective ${(100 * (1 - cTake / profit)).toFixed(1)}% rate. That is "double taxation".` }),
    });
    out.push({
      brief: `As an LLC the same ${usd(profit)} passes straight through to the owner, taxed once at a ${(personal * 100).toFixed(0)}% rate.`,
      visual: <Bars items={[{ label: 'C corporation', value: cTake, color: C.gold }, { label: 'LLC (pass-through)', value: pTake, color: C.green }]} fmt={(v) => usd(v)} />,
      q: rq({ id: 'bs-pass', topic: 'taxes', type: 'numeric', format: 'money', value: Math.round(pTake - cTake), tolRel: 0.01, prompt: 'How much more does the owner keep as an LLC?', explanation: `${usd(pTake)} − ${usd(cTake)} = ${usd(pTake - cTake)}. Pass-through taxation is why small, profitable businesses that pay out their profits often choose an LLC or S corp.` }),
    });

    const s4 = shuffled(['A C corporation: it can issue preferred stock and options', 'Stay a sole proprietor and borrow the money from the VC fund', 'Become a general partnership with the VC', 'An LLC: pass-through losses help the VC'], 0, r);
    out.push({
      brief: 'A software startup wants $3M from a venture capital fund, plans to grant stock options to employees, and hopes to list on the stock market one day.',
      visual: MATRIX,
      q: rq({ id: 'bs-vc', topic: 'business', prompt: 'Which structure fits?', ...s4, explanation: 'Venture funds almost always require a (usually Delaware) C corporation: it can issue preferred stock and stock options cleanly, and avoids passing taxable income to the fund’s own investors. The double tax matters less when profits are reinvested for growth.' }),
    });

    const net = rng.pick([60, 80, 100]) * 1000;
    const se = net * 0.9235 * 0.153;
    out.push({
      brief: `A freelancer (sole proprietor) nets ${usd(net)}. There is no employer, so they pay both halves of Social Security and Medicare: 15.3% self-employment tax on 92.35% of net earnings.`,
      visual: <Table head={['Item', 'Amount']} rows={[['Net earnings', usd(net)], ['× 92.35%', usd(net * 0.9235)], ['× 15.3% self-employment tax', '?']]} hl={[2]} />,
      q: rq({ id: 'bs-se', topic: 'taxes', type: 'numeric', format: 'money', value: Math.round(se), tolRel: 0.01, prompt: 'How much self-employment tax do they owe (before income tax)?', explanation: `${usd(net)} × 0.9235 × 0.153 = ${usd(se)}. Employees only see half of this (7.65%) because their employer pays the rest. Freelancers should set aside money for it every month.` }),
    });
    return out;
  }, [seed]);
  return <VisualQuiz items={items} kicker="Business registry · Choose a structure" onFinish={onFinish} addReview={addReview} />;
}
