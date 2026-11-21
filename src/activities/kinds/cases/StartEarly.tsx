'use client';
/**
 * Start at 18 or 28? (Advanced, Savings Garden). Two savers race to 65: one invests for ten years
 * and stops, the other starts ten years later and never stops. Predict the winner, see why, find
 * the money to start, and account for crashes and inflation along the way.
 */
import type { KindProps } from '../../types';
import { C, LineChart, Table, usd, usdK } from '../pro/kit';
import { CaseRunner, Cards, choose, dial, pick, type CaseDef } from './kit';

type S = Record<string, never>;

const R = 0.07;
const YEAR = 2400;

function paths() {
  const ava = [0];
  const ben = [0];
  for (let age = 18; age < 65; age++) {
    ava.push(ava[ava.length - 1] * (1 + R) + (age < 28 ? YEAR : 0));
    ben.push(ben[ben.length - 1] * (1 + R) + (age >= 28 ? YEAR : 0));
  }
  return { ava, ben };
}

function grow(from: number, to: number, perYear: number, r = R) {
  let v = 0;
  for (let age = 18; age < 65; age++) v = v * (1 + r) + (age >= from && age < to ? perYear : 0);
  return v;
}

export default function StartEarly({ seed, onFinish, addReview }: KindProps) {
  const { ava, ben } = paths();
  const end = ava.length - 1;
  const cam = grow(18, 65, 1200);
  const dee = grow(38, 65, 2400);
  const lowFee = grow(18, 28, YEAR, 0.0695);
  const highFee = grow(18, 28, YEAR, 0.055);
  const def: CaseDef<S> = {
    kicker: 'Savings Garden · Start at 18 or 28?',
    init: () => ({}),
    steps: [
      () =>
        pick({
          brief: 'Twins with different plans. Both invest in the same index fund, which grows about 7% a year on average.',
          visual: (
            <Cards
              cards={[
                { icon: '🌱', title: 'Ava', sub: 'Starts at 18', facts: [['Invests', '$200 a month'], ['From', 'Age 18 to 28, then stops forever'], ['Total put in', '$24,000']] },
                { icon: '🌳', title: 'Ben', sub: 'Starts at 28', facts: [['Invests', '$200 a month'], ['From', 'Age 28 to 65, never stops'], ['Total put in', '$88,800']] },
              ]}
            />
          ),
          prompt: 'At 65, who has more?',
          ordered: true,
          options: [
            { label: 'Ava', credit: 1, why: `Ava ends with about ${usdK(ava[end])} against Ben’s ${usdK(ben[end])}, despite putting in $64,800 less. Her first ten years of money had ten extra years to compound, and the last decades of growth are the biggest.` },
            { label: 'Ben', credit: 0, why: `Ben put in nearly four times as much but ends with ${usdK(ben[end])} against Ava’s ${usdK(ava[end])}. Time did more than money.` },
            { label: 'About the same', credit: 0.4, why: `Close, but Ava is ahead: ${usdK(ava[end])} against ${usdK(ben[end])}, with a quarter of the contributions.` },
          ],
        }),
      () =>
        pick({
          brief: 'Twins Ava and Ben each invest $200 a month at about 7% a year. Ava invests from 18 to 28 and stops; Ben invests from 28 to 65. Here is the race, year by year.',
          visual: (
            <LineChart
              series={[
                { pts: ava, color: C.green, label: 'Ava (18 to 28)' },
                { pts: ben, color: C.blue, label: 'Ben (28 to 65)' },
              ]}
              fmt={(v) => usdK(v)}
              xLabel="Age 18 to 65"
              h={200}
            />
          ),
          prompt: 'Where does most of Ava’s money come from?',
          options: [
            { label: 'Growth on growth: by 65, almost all of it is returns earned on earlier returns, not her $24,000', credit: 1, why: `Of her roughly ${usdK(ava[end])}, only $24,000 was ever deposited. The rest is compounding, and most of it arrives in the final decades.` },
            { label: 'Her deposits', credit: 0, why: '$24,000 is a small fraction of the total.' },
            { label: 'Luck in the market', credit: 0.1, why: 'Both twins had the same returns every year. The only difference is time.' },
          ],
        }),
      () =>
        dial({
          brief: 'A quick way to see compounding: the rule of 72. Divide 72 by the yearly return to find how many years it takes money to double. At 7.2%, money doubles every 10 years.',
          prompt: 'Roughly what does $1,000 invested at 18 become by age 68, at 7.2% a year?',
          min: 0,
          max: 64000,
          step: 500,
          answer: 32000,
          tol: 1000,
          fmt: (v) => usd(v),
          why: '50 years is five doublings: $1,000 → $2,000 → $4,000 → $8,000 → $16,000 → $32,000. Each $1,000 not spent at 18 is roughly $32,000 at retirement, which is the real price of an impulse buy at 18.',
        }),
      () =>
        choose({
          brief: 'At 18, $200 a month is real money. Ava has to find it somewhere.',
          prompt: 'Which two sources make the most sense?',
          k: 2,
          options: [
            { label: 'Part of every paycheck from her part-time job, saved automatically on payday', good: true, why: 'Paying yourself first, automatically, is the habit that keeps saving going when motivation fades.' },
            { label: 'Cutting food delivery and a couple of unused subscriptions', good: true, why: 'Small recurring costs are the easiest to redirect, and she barely notices them gone.' },
            { label: 'Paying her phone bill late to free up cash', good: false, why: 'Late fees and possible credit damage cost more than investing earns.' },
            { label: 'Putting her other spending on a credit card', good: false, why: 'Card interest of 20% or more wipes out a 7% return many times over.' },
            { label: 'Skipping required textbooks', good: false, why: 'Hurting her grades to invest is a terrible trade. Education is the bigger investment at 18.' },
          ],
        }),
      () =>
        pick({
          brief: 'At 25, the market crashes and Ava’s balance falls by a third. She is tempted to stop and move to cash.',
          visual: <Table head={['Ava at 25', 'Before crash', 'After']} rows={[['Balance', '$22,000', '$14,700'], ['Years until she needs the money', '40', '40']]} />,
          prompt: 'What should she do?',
          options: [
            { label: 'Keep investing as planned. Her $200 now buys shares a third cheaper, and she has 40 years to recover', credit: 1, why: 'Crashes early in life hurt least: there is little money at stake and decades to recover. Selling locks in the loss.' },
            { label: 'Move everything to cash until things settle', credit: 0.1, why: 'Markets often recover before things feel settled, and she would miss the rebound.' },
            { label: 'Stop adding money but leave what is there', credit: 0.4, why: 'Better than selling, but she would miss buying while prices are low.' },
          ],
        }),
      () =>
        pick({
          brief: `Ava’s ${usdK(ava[end])} at 65 sounds enormous. But prices will rise over 47 years too.`,
          prompt: 'How should she think about that number?',
          options: [
            { label: 'Inflation will shrink what it buys. At 3% inflation, it buys about what a quarter of that would buy today, which is still a lot from $24,000', credit: 1, why: 'Prices roughly quadruple over 47 years at 3% a year. The real return, about 4% after inflation, is what matters, and starting early still wins.' },
            { label: 'It will buy exactly as much as it would today', credit: 0, why: 'Inflation means each dollar buys less over time.' },
            { label: 'Inflation makes saving pointless', credit: 0, why: 'Cash loses to inflation; investing has historically beaten it. That is the reason to invest.' },
          ],
        }),
    ],
    alts: {
      0: [
        () =>
          pick({
            brief: 'Two friends invest in the same index fund, which grows about 7% a year on average.',
            visual: (
              <Cards
                cards={[
                  { icon: '🌱', title: 'Cam', sub: 'Starts at 18', facts: [['Invests', '$100 a month'], ['From', 'Age 18 to 65'], ['Total put in', '$56,400']] },
                  { icon: '🌳', title: 'Dee', sub: 'Starts at 38', facts: [['Invests', '$200 a month'], ['From', 'Age 38 to 65'], ['Total put in', '$64,800']] },
                ]}
              />
            ),
            prompt: 'At 65, who has more?',
            ordered: true,
            options: [
              { label: 'Cam', credit: 1, why: `Cam ends with about ${usdK(cam)} against Dee’s ${usdK(dee)}. Half the monthly amount, twenty years earlier, more than doubles the result.` },
              { label: 'Dee', credit: 0, why: `Dee put in more but ends with ${usdK(dee)} against Cam’s ${usdK(cam)}. Twenty extra years of compounding beat doubling the payment.` },
              { label: 'About the same', credit: 0.3, why: `Not close: ${usdK(cam)} against ${usdK(dee)}.` },
            ],
          }),
      ],
      1: [
        () =>
          pick({
            brief: 'Two twins invest $200 a month in the same fund. Ava saves from 18 to 28 and stops; Ben saves from 28 to 65. Here is the race.',
            visual: (
              <LineChart
                series={[
                  { pts: ava, color: C.green, label: 'Ava (18 to 28)' },
                  { pts: ben, color: C.blue, label: 'Ben (28 to 65)' },
                ]}
                fmt={(v) => usdK(v)}
                xLabel="Age 18 to 65"
                h={200}
              />
            ),
            prompt: 'Why do both lines curve upward most steeply near the end?',
            options: [
              { label: 'Each year’s growth is a percentage of a bigger balance, so the dollar gains keep getting larger', credit: 1, why: '7% of $10,000 is $700; 7% of $300,000 is $21,000. The same rate produces far bigger gains later.' },
              { label: 'Markets always rise faster as you get older', credit: 0, why: 'Both had the same 7% every year. Only the balance changed.' },
              { label: 'They added more money near the end', credit: 0.1, why: 'Ava added nothing after 28, and her line curves up too.' },
            ],
          }),
      ],
      2: [
        () =>
          dial({
            brief: 'The rule of 72: divide 72 by the yearly return to find how many years it takes money to double. At 9% a year, money doubles every 8 years.',
            prompt: 'Roughly what does $500 invested at 20 become by age 68, at 9% a year?',
            min: 0,
            max: 64000,
            step: 500,
            answer: 32000,
            tol: 1000,
            fmt: (v) => usd(v),
            why: '48 years is six doublings: $500 → $1,000 → $2,000 → $4,000 → $8,000 → $16,000 → $32,000.',
          }),
      ],
      3: [
        () =>
          choose({
            brief: 'Ava knows she will not stick to saving if she has to remember every month.',
            prompt: 'Which two ways make saving automatic?',
            k: 2,
            options: [
              { label: 'An automatic transfer to her investment account the day she is paid', good: true, why: 'Money that moves before she sees it is money she does not miss.' },
              { label: 'Joining her employer’s retirement plan, so contributions come straight out of her pay', good: true, why: 'Payroll saving is the most reliable habit there is, and may come with a match.' },
              { label: 'Saving whatever is left at the end of the month', good: false, why: 'There is rarely anything left. Save first, spend the rest.' },
              { label: 'Waiting until she earns more', good: false, why: 'Every year of waiting costs years of compounding.' },
            ],
          }),
      ],
      4: [
        () =>
          pick({
            brief: 'Ava invests $200 a month from 18 to 28. She can pick an index fund with a 0.05% yearly fee or an actively managed fund charging 1.5% a year. Both earn about 7% before fees.',
            visual: <Table head={['At 65', 'Balance']} rows={[['Low-fee fund (6.95% after fees)', usdK(lowFee)], ['High-fee fund (5.5% after fees)', usdK(highFee)]]} />,
            prompt: 'Which should she pick?',
            options: [
              { label: 'The low-fee index fund. A small yearly fee compounds into a huge difference', credit: 1, why: `${usdK(lowFee)} against ${usdK(highFee)}. A 1.5% fee sounds small but is taken every year from a growing balance.` },
              { label: 'The managed fund, because experts pick the stocks', credit: 0.1, why: 'Most actively managed funds fail to beat the index after fees over long periods.' },
              { label: 'It makes little difference', credit: 0, why: 'It makes a difference of hundreds of thousands of dollars by 65.' },
            ],
          }),
      ],
      5: [
        () =>
          pick({
            brief: 'Ava is 18. A friend says she should keep her retirement savings in a high-yield savings account at 4% instead of an index fund, "because it never goes down".',
            prompt: 'What is the best response?',
            options: [
              { label: 'For money she will not touch for 47 years, the extra growth of investing is worth the ups and downs', credit: 1, why: 'Savings accounts are perfect for short-term goals. Over decades, a 3% higher average return can mean several times more money, and time smooths out crashes.' },
              { label: 'The friend is right; safety matters most', credit: 0.2, why: 'Safety matters for money needed soon. For retirement, inflation eats much of a savings rate.' },
              { label: 'Put it all in one exciting stock instead', credit: 0, why: 'That adds risk without the safety of spreading money across many companies.' },
            ],
          }),
      ],
    },
    takeaways: [
      'Time does more than money. Ten early years can beat thirty-seven later ones.',
      'Rule of 72: divide 72 by the return to find the years to double.',
      'Pay yourself first, automatically, and keep going through crashes.',
      'Judge long-term numbers after inflation. Starting early still wins.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
