'use client';
/**
 * Life Happens (Advanced, Emergency Center). Twelve months on a first full-time paycheck, with
 * four surprise bills drawn at random. Decide how much to put aside, then pay for each hit without
 * sliding into expensive debt. Ends with the true price of a payday loan.
 */
import type { KindProps } from '../../types';
import type { Rng } from '@/game/rng';
import { Table, usd } from '../pro/kit';
import { CaseRunner, Cards, Say, dial, pick, type CaseDef, type Option, type PickStep } from './kit';

interface Hit {
  icon: string;
  title: string;
  text: string;
  cost: number;
}

const HITS: Hit[] = [
  { icon: '🚗', title: 'Car trouble', text: 'Your car will not start. A new alternator and labor', cost: 780 },
  { icon: '🩺', title: 'Toothache', text: 'A cracked tooth needs a crown. After insurance, your share is', cost: 460 },
  { icon: '📱', title: 'Broken phone', text: 'Your phone slides off the roof of the car. A basic replacement costs', cost: 320 },
  { icon: '🐶', title: 'Sick dog', text: 'Your dog swallowed a sock. The emergency vet bill is', cost: 690 },
  { icon: '✂️', title: 'Hours cut', text: 'Your employer cuts shifts for a month. You will be short by', cost: 600 },
  { icon: '🏠', title: 'Rent rise', text: 'The landlord adds a one-time fee for a new lease, due now:', cost: 400 },
  { icon: '🚗', title: 'Flat tires', text: 'Two tires blow out on a pothole. Replacing them costs', cost: 340 },
  { icon: '🩺', title: 'Sprained ankle', text: 'An urgent care visit, an X-ray and a brace. Your share is', cost: 520 },
  { icon: '🏠', title: 'Sudden move', text: 'Your building is sold and you must move. Movers and the gap between deposits cost', cost: 850 },
  { icon: '✂️', title: 'Flu week', text: 'You miss a week of shifts with the flu, with no sick pay. You are short by', cost: 450 },
  { icon: '📱', title: 'Laptop dies', text: 'Your laptop, which you need for night classes, will not turn on. A refurbished one costs', cost: 560 },
  { icon: '🐶', title: 'Pet surgery', text: 'Your cat needs a dental operation. The vet bill is', cost: 640 },
];

interface S {
  fund: number;
  save: number;
  debt: number;
  hits: Hit[];
  month: number;
}

/** Add the monthly saving up to month `to`. Saving clears any debt first; the $200 plan eases to $100 once the fund reaches $1,000. */
const grow = (s: S, to: number) => {
  for (; s.month < to; s.month++) {
    const amt = s.save === 200 && s.fund >= 1000 && s.debt === 0 ? 100 : s.save;
    const pay = Math.min(s.debt, amt);
    s.debt = Math.round(s.debt - pay);
    s.fund += amt - pay;
  }
};

function hitStep(s: S, k: number, month: number): PickStep<S> {
  grow(s, month);
  const h = s.hits[k];
  const covers = s.fund >= h.cost;
  const opts: Option<S>[] = covers
    ? [
        { label: `Pay ${usd(h.cost)} from the emergency fund`, credit: 1, why: 'Exactly what the fund is for. No interest, no stress, and it refills over the next months.', apply: (st) => void (st.fund -= h.cost) },
        { label: 'Put it on a credit card and keep the fund for something serious', credit: 0.3, why: 'This is serious. A fund you never use while paying 24% on a card is the worst of both.', apply: (st) => void (st.debt += h.cost) },
        { label: 'Take a payday loan, due on your next payday', credit: 0, why: 'You had the cash. A payday loan’s fee is equal to a yearly rate of several hundred percent.', apply: (st) => void (st.debt += h.cost * 1.15) },
      ]
    : [
        { label: `Use the ${usd(Math.max(0, s.fund))} in the fund, put the rest on a card, and clear it within two months`, credit: 1, why: 'Use every dollar of cash first, then borrow as little as possible on the cheapest option, with a plan to repay quickly.', apply: (st) => void ((st.debt += h.cost - Math.max(0, st.fund)), (st.fund = 0)) },
        { label: 'Put the whole thing on a credit card and pay the minimum', credit: 0.2, why: 'Minimum payments stretch a few hundred dollars into years of interest, and the cash in your fund sits there earning far less.', apply: (st) => void (st.debt += h.cost * 1.25) },
        { label: 'Take a payday loan, due on your next payday', credit: 0, why: 'Payday loans charge fees equal to hundreds of percent a year, and most borrowers end up renewing them.', apply: (st) => void ((st.debt += h.cost * 1.4), (st.fund = Math.max(0, st.fund))) },
        { label: 'Skip paying it for now', credit: 0.1, why: h.title === 'Hours cut' ? 'Being short on rent brings late fees and risk to your lease.' : 'Ignoring it usually makes it worse, or more expensive, later.', apply: (st) => void (st.debt += h.cost * 1.2) },
      ];
  return {
    kind: 'pick',
    brief: `Month ${month}. ${h.title}.`,
    visual: <Cards cards={[{ icon: h.icon, title: h.title, facts: [[h.text, usd(h.cost)], ['Emergency fund now', usd(s.fund)]] }]} />,
    prompt: 'How do you pay for it?',
    options: opts,
  };
}

export default function LifeHappens({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<S> = {
    kicker: 'Emergency Center · Life happens',
    init: (rng: Rng) => ({ fund: 300, save: 0, debt: 0, hits: rng.shuffle([...HITS]).slice(0, 4), month: 0 }),
    meters: (s) => [
      ['Emergency fund', usd(s.fund), s.fund >= 1000 ? 'good' : s.fund < 200 ? 'bad' : undefined],
      ['Debt', usd(s.debt), s.debt > 0 ? 'bad' : 'good'],
      ['Month', String(Math.max(1, s.month))],
    ],
    steps: [
      () =>
        pick({
          brief: 'You are 19, in your first full-time job. After rent, food, transport and your phone, about $300 is left each month. You have $300 in savings.',
          visual: <Say who="Your older cousin">Nobody plans for the car breaking. Then it breaks.</Say>,
          prompt: 'How much do you put into an emergency fund each month?',
          ordered: true,
          options: [
            { label: '$0. I will save once I earn more', credit: 0, why: 'Emergencies do not wait for a raise. Without a fund, every surprise becomes debt.' },
            { label: '$100, and keep $200 for fun', credit: 0.6, why: 'A real start. It builds slowly, so an early surprise could still outrun it.', apply: (s) => void (s.save = 100) },
            { label: '$200 until the fund reaches $1,000, then $100', credit: 1, why: 'Fast at first, while you are most exposed, then easing off. A first goal of about $1,000 covers most single surprises.', apply: (s) => void (s.save = 200) },
            { label: 'All $300, every month', credit: 0.7, why: 'Builds the fund fastest, but a budget with no fun in it is one most people quit.', apply: (s) => void (s.save = 300) },
          ],
        }),
      ({ s }) => hitStep(s, 0, 2),
      ({ s }) => hitStep(s, 1, 5),
      ({ s }) => hitStep(s, 2, 8),
      ({ s }) => hitStep(s, 3, 11),
      () =>
        dial({
          brief: 'A storefront near your work advertises: "Borrow $400 until payday. Just $60!" Payday is two weeks away.',
          visual: <Table head={['Payday loan', '']} rows={[['Borrow', '$400'], ['Fee', '$60 for 2 weeks'], ['Two-week periods in a year', '26']]} />,
          prompt: 'If you kept renewing it all year, what yearly interest rate is that fee equal to?',
          min: 0,
          max: 600,
          step: 5,
          answer: 390,
          tol: 10,
          fmt: (v) => `${v}%`,
          why: '$60 ÷ $400 is 15% every two weeks. Over 26 periods, that is 390% a year, around 16 times a typical credit card. Most payday borrowers do renew, again and again.',
        }),
      ({ s }) => {
        grow(s, 12);
        return pick({
          brief: `Month 12. You come through the year with ${usd(s.fund)} in the fund${s.debt > 0 ? ` and ${usd(s.debt)} of debt` : ' and no debt'}. Your monthly costs are about $1,900.`,
          prompt: 'What should the fund grow to over the next few years?',
          options: [
            { label: 'Three to six months of essential costs, about $6,000 to $11,000', credit: 1, why: 'A first $1,000 handles a broken phone. Months of costs handle losing a job, the emergency that hurts most.' },
            { label: '$1,000 is enough forever', credit: 0.3, why: 'A great first goal, but it would not cover even one month without a paycheck.' },
            { label: 'As much as possible; never invest until it is $50,000', credit: 0.2, why: 'Beyond a few months of costs, extra cash loses ground to inflation. Investing is for money you will not need soon.' },
          ],
        });
      },
    ],
    alts: {
      0: [
        () =>
          pick({
            brief: 'You are 20 and just started full-time work at a warehouse. After every bill, about $300 is left each month, and you have $300 saved. A coworker says emergency funds are for older people.',
            visual: <Say who="Your manager">Every year somebody on this team gets hit with a big bill they did not see coming.</Say>,
            prompt: 'What is your monthly emergency savings plan?',
            ordered: true,
            options: [
              { label: '$0 for now. My coworker is probably right', credit: 0, why: 'Surprises happen at every age. Without a fund, each one becomes debt.' },
              { label: '$100 a month', credit: 0.6, why: 'A real start, though an early surprise could outrun it.', apply: (s) => void (s.save = 100) },
              { label: '$200 a month until the fund hits $1,000, then $100', credit: 1, why: 'Build fast while you are most exposed, then ease off once the first goal is met.', apply: (s) => void (s.save = 200) },
              { label: 'All $300 every month', credit: 0.7, why: 'Fastest, but a plan with no breathing room is hard to keep.', apply: (s) => void (s.save = 300) },
            ],
          }),
      ],
      5: [
        () =>
          dial({
            brief: 'A shop offers a car title loan: borrow $1,000 using your car as security, for a fee of $250 a month.',
            visual: <Table head={['Car title loan', '']} rows={[['Borrow', '$1,000'], ['Fee', '$250 a month'], ['If you cannot repay', 'The lender can take your car']]} />,
            prompt: 'If you kept it for a year, what yearly interest rate is that fee equal to?',
            min: 0,
            max: 600,
            step: 5,
            answer: 300,
            tol: 10,
            fmt: (v) => `${v}%`,
            why: '$250 ÷ $1,000 is 25% a month, × 12 = 300% a year. And if you fall behind, you can lose the car you need to get to work.',
          }),
      ],
      6: [
        ({ s }) => {
          grow(s, 12);
          return pick({
            brief: `Month 12. You come through the year with ${usd(s.fund)} in the fund${s.debt > 0 ? ` and ${usd(s.debt)} of debt` : ' and no debt'}. Now you decide where to keep the fund.`,
            visual: <Table head={['Option', 'Return', 'Access']} rows={[['Checking account', 'Almost 0%', 'Instant'], ['High-yield savings account', 'About 4%', '1 to 2 days'], ['Stock index fund', 'About 7% on average, can fall 30%', 'A few days']]} />,
            prompt: 'Where should the emergency fund live?',
            options: [
              { label: 'A high-yield savings account: safe, earning interest, and reachable within a day or two', credit: 1, why: 'An emergency fund must be there in full when needed. Stocks could be down right when you lose your job.' },
              { label: 'A stock index fund, for the higher return', credit: 0.2, why: 'Good for long-term money, but emergencies often arrive during the same downturns that sink stocks.' },
              { label: 'Checking, so it is instant', credit: 0.5, why: 'Safe and instant, but it earns nothing and is easy to spend by accident.' },
            ],
          });
        },
      ],
    },
    outcome: (s) => ({
      headline: s.debt === 0 ? `A year of surprises, and no debt` : `Through the year, with ${usd(s.debt)} still owed`,
      bonus: s.debt === 0 ? 5 : s.debt < 500 ? 0 : -8,
    }),
    takeaways: [
      'Surprises are not rare. Four in a year is normal, so plan for them.',
      'Build a first $1,000 fast, then work toward three to six months of costs.',
      'When the fund falls short, use the cash first and borrow as little, and as cheaply, as you can.',
      'A payday loan fee of $15 per $100 for two weeks is equal to about 390% a year.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
