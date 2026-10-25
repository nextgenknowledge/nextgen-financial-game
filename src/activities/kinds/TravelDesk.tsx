'use client';
/**
 * Global Travel Desk (Advanced). Budget a semester abroad: convert a budget into the local
 * currency, compare card foreign-transaction fees, spot the dynamic currency conversion trap,
 * price travel insurance by expected value and size the emergency buffer.
 */
import { useMemo } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { VisualQuiz, rq, shuffled, type VisualItem } from './VisualQuiz';
import { Bars, C, Table, usd } from './pro/kit';

const CITIES = [
  { city: 'Madrid', ccy: 'EUR', sym: '€', rate: 0.92, rent: 650, food: 320, transit: 40, fun: 180 },
  { city: 'Tokyo', ccy: 'JPY', sym: '¥', rate: 150, rent: 95_000, food: 48_000, transit: 9_000, fun: 25_000 },
  { city: 'London', ccy: 'GBP', sym: '£', rate: 0.79, rent: 900, food: 300, transit: 160, fun: 200 },
  { city: 'Seoul', ccy: 'KRW', sym: '₩', rate: 1350, rent: 700_000, food: 420_000, transit: 60_000, fun: 250_000 },
];

const loc = (v: number, sym: string) => `${sym}${Math.round(v).toLocaleString('en-US')}`;

export default function TravelDesk({ onFinish, addReview, seed }: KindProps) {
  const items = useMemo<VisualItem[]>(() => {
    const rng = makeRng(seed * 31 + 9);
    const r = () => rng.next();
    const c = rng.pick(CITIES);
    const months = rng.pick([4, 5]);
    const monthly = c.rent + c.food + c.transit + c.fun;
    const usdMonthly = monthly / c.rate;
    const out: VisualItem[] = [];

    out.push({
      brief: `You are spending a ${months}-month semester in ${c.city}. Typical monthly costs are below. The exchange rate is 1 USD = ${c.rate.toLocaleString('en-US')} ${c.ccy}.`,
      visual: (
        <Table
          head={['Monthly cost', c.ccy]}
          rows={[['Rent (shared flat)', loc(c.rent, c.sym)], ['Groceries & meals', loc(c.food, c.sym)], ['Transit pass', loc(c.transit, c.sym)], ['Going out & trips', loc(c.fun, c.sym)], ['Total per month', loc(monthly, c.sym)]]}
          hl={[4]}
        />
      ),
      q: rq({ id: 'tr-usd', topic: 'budgeting', type: 'numeric', format: 'money', value: Math.round(usdMonthly * months), tolRel: 0.02, prompt: `What does the whole semester cost in US dollars?`, hint: `Divide the local total by the rate, then multiply by ${months} months.`, explanation: `${loc(monthly, c.sym)} ÷ ${c.rate} = ${usd(usdMonthly)} a month × ${months} = ${usd(usdMonthly * months)}.` }),
    });

    const spend = Math.round((usdMonthly * months) / 100) * 100;
    const cards = [
      { name: 'Debit card A', fee: 0.03, atm: 5 },
      { name: 'Credit card B', fee: 0, atm: 0 },
      { name: 'Prepaid card C', fee: 0.015, atm: 2.5 },
    ];
    const withdrawals = months * 4;
    const cost = (k: (typeof cards)[number]) => spend * k.fee + withdrawals * k.atm;
    const best = cards.reduce((a, b) => (cost(b) < cost(a) ? b : a));
    const s2 = shuffled(
      cards.map((k) => k.name),
      cards.indexOf(best),
      r,
    );
    out.push({
      brief: `You will spend about ${usd(spend)} abroad on cards and take out cash ${withdrawals} times. Each card charges a foreign transaction fee on spending and a fee per ATM withdrawal.`,
      visual: <Table head={['Card', 'Foreign transaction fee', 'ATM fee', 'Semester cost']} rows={cards.map((k) => [k.name, `${(k.fee * 100).toFixed(1)}%`, usd(k.atm, 2), '?'])} />,
      q: rq({ id: 'tr-card', topic: 'banking', prompt: 'Which card is cheapest for the semester?', ...s2, explanation: cards.map((k) => `${k.name}: ${usd(cost(k), 2)}`).join(' · ') + '. A 3% fee sounds small but is charged on every purchase.' }),
    });

    const bill = rng.pick([60, 85, 120, 240]);
    const local = Math.round(bill * c.rate);
    const dccRate = c.rate * (1 - rng.pick([0.05, 0.06, 0.07]));
    const dccUsd = local / dccRate;
    const fairUsd = local / c.rate;
    out.push({
      brief: `A restaurant bill is ${loc(local, c.sym)}. The card machine offers: "Pay ${usd(dccUsd, 2)} in USD (guaranteed rate)" or "Pay ${loc(local, c.sym)} in ${c.ccy}". Your card has no foreign transaction fee.`,
      visual: <Bars items={[{ label: `Pay in ${c.ccy}`, value: fairUsd, color: C.green }, { label: 'Pay in USD (DCC)', value: dccUsd, color: C.red }]} fmt={(v) => usd(v, 2)} />,
      q: rq({ id: 'tr-dcc', topic: 'shopping', type: 'numeric', format: 'money', value: Math.round((dccUsd - fairUsd) * 100) / 100, tolAbs: 0.05, tolRel: 0.01, prompt: 'How much extra would you pay by accepting the USD option?', hint: 'Convert the local bill at the real rate and compare.', explanation: `At the real rate the bill is ${usd(fairUsd, 2)}. "Dynamic currency conversion" quietly uses a worse rate, here ${usd(dccUsd - fairUsd, 2)} more. Always pay in the local currency.` }),
    });

    const premium = rng.pick([140, 180, 220]);
    const pMed = rng.pick([0.03, 0.04, 0.05]);
    const medCost = rng.pick([6000, 8000, 12000]);
    const pBag = 0.08;
    const bagCost = 900;
    const ev = pMed * medCost + pBag * bagCost;
    out.push({
      brief: `Travel insurance costs ${usd(premium)} for the semester. Chances: ${(pMed * 100).toFixed(0)}% of a medical emergency costing ${usd(medCost)}, and 8% of a lost or stolen bag worth ${usd(bagCost)}.`,
      visual: <Table head={['Risk', 'Chance', 'Cost', 'Expected cost']} rows={[['Medical emergency', `${(pMed * 100).toFixed(0)}%`, usd(medCost), '?'], ['Lost or stolen bag', '8%', usd(bagCost), '?'], ['Insurance premium', '100%', usd(premium), usd(premium)]]} />,
      q: rq({ id: 'tr-ev', topic: 'insurance', type: 'numeric', format: 'money', value: ev, tolRel: 0.02, prompt: 'What is the expected cost of these risks without insurance?', hint: 'Expected cost = chance × cost, added up.', explanation: `${pMed} × ${usd(medCost)} + 0.08 × ${usd(bagCost)} = ${usd(ev)}. ${ev < premium ? 'The premium is higher than the expected loss (that is how insurers profit), but insurance is for the loss you could not afford: one emergency would wreck the budget.' : 'Here the premium is even below the expected loss, an easy yes.'}` }),
    });

    const buffer = Math.round(usdMonthly * 1.5);
    const s5 = shuffled([`About ${usd(buffer)}: 1 to 2 months of costs, easy to reach`, 'Nothing: the credit card will cover any emergency abroad', `About ${usd(Math.round(usdMonthly * 0.25))}: one week of costs in cash`, 'Everything you have, in cash, hidden in your rented room'], 0, r);
    out.push({
      brief: 'Last item: an emergency buffer for a cancelled flight, a deposit or a sudden trip home.',
      visual: <Bars items={[{ label: 'Monthly cost', value: usdMonthly, color: C.blue }, { label: '1.5 months', value: buffer, color: C.green }]} fmt={(v) => usd(v)} />,
      q: rq({ id: 'tr-buffer', topic: 'saving', prompt: 'How big should the buffer be, and where should it live?', ...s5, explanation: 'A buffer of one to two months of costs covers most travel emergencies. Keep it in a bank account with a card that works abroad: cash can be lost, and a credit card charges interest if you cannot clear it.' }),
    });
    return out;
  }, [seed]);
  return <VisualQuiz items={items} kicker="Global travel desk · Study abroad budget" onFinish={onFinish} addReview={addReview} />;
}
