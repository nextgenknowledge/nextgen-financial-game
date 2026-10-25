'use client';
/**
 * Impact Investing Desk (Advanced). Compare charities by cost per outcome rather than overhead,
 * work out what a deduction is really worth, why giving appreciated shares beats giving cash, and
 * how matching gifts and donor-advised funds stretch a budget.
 */
import { useMemo } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { VisualQuiz, rq, shuffled, type VisualItem } from './VisualQuiz';
import { Bars, C, Table, usd } from './pro/kit';

export default function ImpactDesk({ onFinish, addReview, seed }: KindProps) {
  const items = useMemo<VisualItem[]>(() => {
    const rng = makeRng(seed * 43 + 6);
    const r = () => rng.next();
    const out: VisualItem[] = [];
    const orgs = [
      { name: 'ReadAhead Tutors', budget: rng.pick([2, 3]) * 1e6, overhead: 0.22, outcomes: rng.pick([3200, 4000]), unit: 'children reading at grade level' },
      { name: 'BrightPages Books', budget: rng.pick([4, 5]) * 1e6, overhead: 0.06, outcomes: rng.pick([1100, 1400]), unit: 'children reading at grade level' },
    ];
    const cpo = (o: (typeof orgs)[number]) => o.budget / o.outcomes;
    const best = cpo(orgs[0]) < cpo(orgs[1]) ? 0 : 1;
    out.push({
      brief: 'Two literacy charities report their yearly results, checked by an independent study:',
      visual: <Table head={['Charity', 'Budget', 'Overhead', 'Outcome']} rows={orgs.map((o) => [o.name, usd(o.budget), `${(o.overhead * 100).toFixed(0)}%`, `${o.outcomes.toLocaleString()} ${o.unit}`])} />,
      q: rq({ id: 'im-cpo', topic: 'giving', type: 'numeric', format: 'money', value: Math.round(cpo(orgs[best])), tolRel: 0.01, prompt: 'What is the lowest cost per child helped?', hint: 'Cost per outcome = budget ÷ outcomes.', explanation: orgs.map((o) => `${o.name}: ${usd(cpo(o))}`).join(' · ') + `. ${orgs[best].name} helps more children per dollar${orgs[best].overhead > 0.1 ? ', even with higher overhead: training and measurement cost money and can make programs work' : ''}.` }),
    });
    out.push({
      brief: 'A friend says: "Only give to charities with the lowest overhead."',
      visual: <Bars items={orgs.map((o, i) => ({ label: o.name, value: cpo(o), color: i === best ? C.green : C.red }))} fmt={(v) => `${usd(v)} per child`} />,
      q: rq({ id: 'im-overhead', topic: 'giving', prompt: 'Is overhead the right test?', ...shuffled(['No: look at results per dollar instead', 'Yes: every dollar of overhead is money wasted', 'Yes: the charity with the smallest budget is best', 'Only for religious charities'], 0, r), explanation: 'The "overhead myth": starving charities of staff, data and systems can make them less effective. Cost per outcome measures what donors actually care about.' }),
    });
    const gift = rng.pick([2000, 5000, 10000]);
    const rate = rng.pick([0.22, 0.24, 0.32]);
    out.push({
      brief: `You give ${usd(gift)} and itemise deductions. Your top income tax rate is ${(rate * 100).toFixed(0)}%.`,
      visual: <Bars items={[{ label: 'Gift', value: gift, color: C.blue }, { label: 'Tax saved', value: gift * rate, color: C.green }, { label: 'Real cost to you', value: gift * (1 - rate), color: C.gold }]} fmt={(v) => usd(v)} />,
      q: rq({ id: 'im-deduct', topic: 'taxes', type: 'numeric', format: 'money', value: Math.round(gift * (1 - rate)), tolRel: 0.005, prompt: 'What does the gift really cost you after tax?', explanation: `A deduction saves tax at your top rate: ${usd(gift)} × ${(rate * 100).toFixed(0)}% = ${usd(gift * rate)} saved, so the gift costs ${usd(gift * (1 - rate))}. If you take the standard deduction instead of itemising, it saves nothing.` }),
    });
    const basis = Math.round(gift * rng.pick([0.3, 0.4, 0.5]));
    const cg = 0.15;
    const saved = (gift - basis) * cg;
    out.push({
      brief: `Instead of cash, you could give shares now worth ${usd(gift)} that you bought for ${usd(basis)}. Selling them would mean 15% capital gains tax. Charities pay no tax when they sell.`,
      visual: <Table head={['Option', 'Charity gets', 'Capital gains tax you pay']} rows={[['Sell shares, give cash', usd(gift - saved), usd(saved)], ['Give the shares directly', usd(gift), usd(0)]]} />,
      q: rq({ id: 'im-stock', topic: 'taxes', type: 'numeric', format: 'money', value: Math.round(saved), tolRel: 0.01, prompt: 'How much tax does giving the shares directly avoid?', explanation: `Gain = ${usd(gift)} − ${usd(basis)} = ${usd(gift - basis)} × 15% = ${usd(saved)}. Giving appreciated shares directly avoids the tax and the charity receives the full value.` }),
    });
    const match = rng.pick([0.5, 1]);
    out.push({
      brief: `Your employer matches donations ${match === 1 ? 'dollar for dollar' : '50 cents per dollar'}. You also have a windfall year and want to give now but choose charities slowly.`,
      visual: <Bars items={[{ label: 'Your gift', value: 1000, color: C.blue }, { label: 'Employer match', value: 1000 * match, color: C.green }]} fmt={(v) => usd(v)} />,
      q: rq({ id: 'im-daf', topic: 'giving', prompt: 'What is the best plan?', ...shuffled(['Take the match; put the windfall in a donor-advised fund', 'Skip the employer match, since matched gifts are taxable', 'Wait several years to give so the tax deduction is bigger', 'Give the whole windfall to the first charity that asks you'], 0, r), explanation: `Matching turns $1,000 into ${usd(1000 * (1 + match))} of impact. A donor-advised fund takes the gift (and deduction) in the high-income year, invests it, and lets you recommend grants later after doing your research.` }),
    });
    return out;
  }, [seed]);
  return <VisualQuiz items={items} kicker="Impact investing desk · Smarter giving" onFinish={onFinish} addReview={addReview} />;
}
