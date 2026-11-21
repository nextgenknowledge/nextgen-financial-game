'use client';
/**
 * Summer Job $2,000 (Advanced, Retirement Tower). Maya, 16, earned $2,000 lifeguarding. Match each
 * goal to the right account, learn what a Roth IRA allows at her age, and build a plan that saves,
 * invests and still lets her enjoy some of it.
 */
import type { KindProps } from '../../types';
import { Table, usd } from '../pro/kit';
import { CaseRunner, Cards, Say, dial, pick, type CaseDef } from './kit';

interface S {
  roth: number;
}

export default function SummerJob({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<S> = {
    kicker: 'Retirement Tower · Summer job $2,000',
    init: (rng) => ({ roth: rng.pick([400, 500, 600]) }),
    steps: [
      () =>
        pick({
          brief: 'Maya, 16, earned $2,000 lifeguarding this summer. She wants a used car in about two years, has no savings at all, and would love a concert trip with friends in October.',
          visual: <Say who="Maya">I could just put it all in stocks, right? Stocks grow the most.</Say>,
          prompt: 'What should come first?',
          options: [
            { label: 'A small emergency cushion in savings, then the car fund, then investing what is truly long-term', credit: 1, why: 'Money needed soon, or in an emergency, must not be in stocks, which can fall 30% in the year she needs them. Long-term money is where stocks make sense.' },
            { label: 'All of it in stocks, for the most growth', credit: 0.2, why: 'Stocks suit money left for many years. Car money needed in two years could be down sharply right when she needs it.' },
            { label: 'Spend it; she is 16', credit: 0.2, why: 'Some fun money is healthy, but a first paycheck is the best time to build the habit of saving.' },
          ],
        }),
      () =>
        pick({
          brief: 'Maya compares accounts for the car fund.',
          visual: (
            <Cards
              cards={[
                { icon: '🏦', title: 'Checking account', facts: [['Interest', '0.01% a year'], ['Risk', 'None (insured)'], ['Access', 'Instant']] },
                { icon: '🪴', title: 'High-yield savings', facts: [['Interest', '4% a year'], ['Risk', 'None (insured)'], ['Access', '1 to 2 days']] },
                { icon: '📈', title: 'Stock index fund', facts: [['Return', 'About 7% a year on average'], ['Risk', 'Can fall 30% or more in a year'], ['Access', 'A few days']] },
              ]}
            />
          ),
          prompt: 'Where should the car money go?',
          ordered: true,
          options: [
            { label: 'Checking account', credit: 0.3, why: 'Safe, but earns almost nothing. Fine for spending money, not for savings.' },
            { label: 'High-yield savings', credit: 1, why: 'Insured, so it cannot fall, and it earns real interest for two years. Short-term goals belong in safe accounts.' },
            { label: 'Stock index fund', credit: 0.2, why: 'Two years is too short. A bad year could leave her short of the car right when she needs it.' },
          ],
        }),
      () =>
        pick({
          brief: 'Her aunt suggests a Roth IRA, a retirement account for people with earned income, which a parent can open for a minor.',
          visual: <Table head={['Roth IRA basics', '']} rows={[['Who can contribute', 'Anyone with earned income, even a teenager'], ['Most she can put in this year', 'Her earned income, up to the yearly limit'], ['Taxes', 'No tax on growth, or on withdrawals in retirement'], ['Contributions', 'Can be withdrawn any time without tax or penalty']]} />,
          prompt: 'Which statement is true for Maya?',
          options: [
            { label: 'She can put in up to $2,000 this year, because that is what she earned', credit: 1, why: 'Contributions are capped at earned income, so a teenager with a summer job qualifies. Money from a gift or allowance alone would not.' },
            { label: 'She cannot open one until she is 18', credit: 0, why: 'A parent can open a custodial Roth IRA for a minor with earned income.' },
            { label: 'She can put in up to the full yearly limit, regardless of earnings', credit: 0.1, why: 'The limit for each year is the smaller of the yearly cap or what you earned.' },
          ],
        }),
      ({ s }) =>
        dial({
          brief: `Maya puts ${usd(s.roth)} into a Roth IRA in an index fund and leaves it alone.`,
          visual: <Table head={['At 7% a year', '$1 grows to']} rows={[['10 years', '$1.97'], ['30 years', '$7.61'], ['50 years', '$29.46']]} />,
          prompt: `What could the ${usd(s.roth)} grow to by the time she is 66, 50 years from now?`,
          min: 0,
          max: 25000,
          step: 50,
          answer: Math.round(s.roth * 29.46),
          tol: 250,
          fmt: (v) => usd(v),
          why: `${usd(s.roth)} × 29.46 ≈ ${usd(s.roth * 29.46)}, and in a Roth IRA, all of it can come out tax free in retirement. One summer’s savings, left alone for 50 years.`,
        }),
      () =>
        pick({
          brief: 'Maya worries: "What if I need that money before I am old?"',
          prompt: 'What is accurate?',
          options: [
            { label: 'She can take out what she put in at any time without tax or penalty, but the growth is meant to stay until retirement', credit: 1, why: 'That flexibility makes a Roth a gentle first retirement account. Still, every dollar taken out loses its decades of compounding.' },
            { label: 'The money is locked until age 59 and a half, no exceptions', credit: 0.2, why: 'Earnings mostly are, but her own contributions can come out any time.' },
            { label: 'She can take out everything, growth included, any time, tax free', credit: 0, why: 'Early withdrawals of earnings can be taxed and penalized.' },
          ],
        }),
      ({ s }) =>
        pick({
          brief: 'Time to set the whole plan.',
          visual: <Table head={['Plan', 'Emergency', 'Car fund', 'Roth IRA', 'Concert trip']} rows={[['A', '$500', '$700', usd(s.roth), usd(800 - s.roth)], ['B', '$0', '$0', '$2,000', '$0'], ['C', '$0', '$0', '$0', '$2,000'], ['D', '$0', '$2,000', '$0', '$0']]} />,
          prompt: 'Which plan is strongest?',
          ordered: true,
          options: [
            { label: 'Plan A', credit: 1, why: 'Every goal gets a share: a cushion for surprises, steady progress on the car, a long-term start, and fun money so the plan feels worth keeping.' },
            { label: 'Plan B', credit: 0.4, why: 'Wonderful for retirement, but nothing for emergencies or the car, so the first surprise could mean pulling money out.' },
            { label: 'Plan C', credit: 0, why: 'A great trip, and nothing left of a whole summer’s work.' },
            { label: 'Plan D', credit: 0.5, why: 'Disciplined, but no cushion and no fun. Plans with zero enjoyment tend not to last.' },
          ],
        }),
    ],
    alts: {
      0: [
        () =>
          pick({
            brief: 'Leo, 17, earned $2,000 at a pizza place this summer. He needs a laptop for college in a year, has $50 in savings, and keeps hearing about a crypto coin his friends are buying.',
            visual: <Say who="Leo">If the coin goes up 10 times, I could buy ten laptops.</Say>,
            prompt: 'What should come first?',
            options: [
              { label: 'A small emergency cushion, then the laptop fund in a safe account, then long-term investing with what is left', credit: 1, why: 'Money needed within a year must be safe. A speculative coin can halve in a week, and the laptop is a real need.' },
              { label: 'All of it into the coin', credit: 0, why: 'If it falls, there is no laptop and no cushion.' },
              { label: 'Spend it now and worry later', credit: 0.2, why: 'Some fun is fine, but the laptop is coming whether he saves or not.' },
            ],
          }),
      ],
      1: [
        () =>
          pick({
            brief: 'Maya wants a home for her $500 emergency cushion.',
            visual: (
              <Cards
                cards={[
                  { icon: '🏦', title: 'Checking account', facts: [['Interest', '0.01% a year'], ['Access', 'Instant']] },
                  { icon: '🪴', title: 'High-yield savings', facts: [['Interest', '4% a year'], ['Access', '1 to 2 days']] },
                  { icon: '🔒', title: '5-year certificate of deposit', facts: [['Interest', '4.5% a year'], ['Access', 'Penalty to withdraw early']] },
                ]}
              />
            ),
            prompt: 'Where should the emergency money go?',
            ordered: true,
            options: [
              { label: 'Checking account', credit: 0.4, why: 'Easy to reach, but it earns nothing and is easy to spend by accident.' },
              { label: 'High-yield savings', credit: 1, why: 'Safe, earns interest, and available within a day or two. Exactly what an emergency fund needs.' },
              { label: '5-year certificate of deposit', credit: 0.2, why: 'A slightly better rate, but emergencies do not wait five years, and early withdrawal costs a penalty.' },
            ],
          }),
      ],
      2: [
        () =>
          pick({
            brief: 'Maya can choose a Roth IRA (pay tax now, withdraw tax free later) or a Traditional IRA (tax break now, pay tax when withdrawing in retirement).',
            visual: <Table head={['', 'Roth IRA', 'Traditional IRA']} rows={[['Tax on money going in', 'Taxed now', 'Not taxed now'], ['Tax in retirement', 'None', 'Taxed as income'], ['Maya’s tax rate today', 'About 0%', 'About 0%']]} />,
            prompt: 'Which suits Maya better?',
            options: [
              { label: 'The Roth, because she pays almost no tax now, and decades of growth come out tax free', credit: 1, why: 'A tax break is worth little when your rate is near zero. Paying tax later on 50 years of growth would cost far more.' },
              { label: 'The Traditional, because tax breaks are always better', credit: 0.2, why: 'A break is only valuable when you would otherwise pay tax. At 16, she mostly would not.' },
              { label: 'They are exactly the same', credit: 0, why: 'They tax different things at different times, and for a teen the difference is large.' },
            ],
          }),
      ],
      3: [
        ({ s }) =>
          dial({
            brief: `Maya puts ${usd(s.roth)} into a Roth IRA in an index fund and leaves it alone.`,
            visual: <Table head={['At 7% a year', '$1 grows to']} rows={[['10 years', '$1.97'], ['30 years', '$7.61'], ['50 years', '$29.46']]} />,
            prompt: `What could the ${usd(s.roth)} grow to in 30 years, when she is 46?`,
            min: 0,
            max: 10000,
            step: 25,
            answer: Math.round(s.roth * 7.61),
            tol: 50,
            fmt: (v) => usd(v),
            why: `${usd(s.roth)} × 7.61 ≈ ${usd(s.roth * 7.61)}. Leave it another 20 years and it would be nearly four times that again.`,
          }),
      ],
      4: [
        () =>
          pick({
            brief: 'A year later, Maya checks her Roth IRA. The balance is exactly what she put in. Nothing has grown.',
            prompt: 'What most likely went wrong?',
            options: [
              { label: 'The money is sitting in cash inside the account. She never chose an investment', credit: 1, why: 'An IRA is a container. Money must be invested, for example in an index fund, to grow. Many first-time savers miss this step.' },
              { label: 'Roth IRAs do not grow until you are 18', credit: 0, why: 'There is no age rule on growth.' },
              { label: 'The market was flat to the cent', credit: 0.1, why: 'Very unlikely. Exactly zero change usually means nothing was invested.' },
            ],
          }),
      ],
      5: [
        ({ s }) =>
          pick({
            brief: 'Next summer Maya earns $2,000 again. Her emergency cushion is already full, and she has saved $1,200 toward the car.',
            visual: <Table head={['Plan', 'Car fund', 'Roth IRA', 'Fun']} rows={[['A', '$1,000', usd(s.roth + 400), usd(600 - s.roth)], ['B', '$0', '$0', '$2,000'], ['C', '$2,000', '$0', '$0'], ['D', '$0', '$2,000', '$0']]} />,
            prompt: 'Which plan is strongest?',
            ordered: true,
            options: [
              { label: 'Plan A', credit: 1, why: 'The car goal moves forward, the long-term savings grow, and some fun keeps the plan worth sticking to.' },
              { label: 'Plan B', credit: 0, why: 'A great summer, and no progress on anything else.' },
              { label: 'Plan C', credit: 0.5, why: 'Strong for the car, but misses a year of tax-free growth and leaves no fun.' },
              { label: 'Plan D', credit: 0.4, why: 'Great for retirement, but the car is still a year away and needs funding.' },
            ],
          }),
      ],
    },
    takeaways: [
      'Match the account to the goal: safe savings for soon, investments for decades.',
      'A teenager with earned income can open a Roth IRA, up to what they earned.',
      'Roth contributions can come out any time; the growth is meant for retirement.',
      'A good plan funds safety, goals, the future and some fun.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
