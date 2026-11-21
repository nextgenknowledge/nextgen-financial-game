'use client';
/**
 * Investor's Seat (Advanced, Pitch Theater). Three founders pitch for your money. Ask the
 * questions that matter, read a pitch deck for red flags, check whether customers are worth what
 * they cost to win, and decide how much of your own money belongs in startups at all.
 */
import type { KindProps } from '../../types';
import { Table, usd } from '../pro/kit';
import { CaseRunner, Cards, Say, choose, dial, flag, pick, type CaseDef } from './kit';

interface S {
  price: number;
  churn: number;
}

export default function InvestorSeat({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<S> = {
    kicker: 'Pitch Theater · Investor’s seat',
    init: (rng) => ({ price: rng.pick([12, 15, 18]), churn: rng.pick([10, 12.5, 20]) }),
    steps: [
      ({ s }) =>
        choose({
          brief: `Pitch 1: Brewly delivers cold brew coffee by subscription for ${usd(s.price)} a month. The founder is confident: "We have 10,000 customers and we are growing 30% a month!"`,
          visual: <Cards cards={[{ icon: '☕', title: 'Brewly', sub: 'Seed round', facts: [['Customers', '10,000'], ['Growth', '30% a month'], ['Price', `${usd(s.price)} a month`], ['Asking for', '$400,000']] }]} />,
          prompt: 'You get two questions. Which two?',
          k: 2,
          options: [
            { label: 'How many of the 10,000 are paying, not on a free trial?', good: true, why: 'Free trials inflate customer counts. Paying customers are the business.' },
            { label: 'What share of customers cancel each month?', good: true, why: 'Growth means little if customers leave as fast as they arrive. Monthly cancellations decide what each customer is worth.' },
            { label: 'Where do you see Brewly in ten years?', good: false, why: 'Every founder has an inspiring answer. It tells you nothing you can check.' },
            { label: 'Do you drink your own coffee?', good: false, why: 'A nice moment, but not information.' },
            { label: 'Who designed your logo?', good: false, why: 'Branding matters later. It does not tell you if the business works.' },
          ],
        }),
      ({ s }) => {
        const life = 100 / s.churn;
        const margin = s.price / 2;
        return dial({
          brief: `The answers: 6,000 pay, and ${s.churn}% of paying customers cancel each month, so the average customer stays about ${life.toFixed(1)} months. Brewly keeps half of each payment after coffee and shipping. Ads cost about $45 to win each new customer.`,
          visual: <Table head={['', '']} rows={[['Monthly price', usd(s.price)], ['Kept after coffee and shipping', `${usd(margin, 2)} a month`], ['Average months a customer stays', life.toFixed(1)], ['Cost to win one customer', '$45']]} />,
          prompt: 'How much does Brewly earn from an average customer over their whole time subscribed?',
          min: 0,
          max: 150,
          step: 1,
          answer: Math.round(margin * life),
          tol: 3,
          fmt: (v) => usd(v),
          why: `${usd(margin, 2)} × ${life.toFixed(1)} months ≈ ${usd(margin * life)}. ${margin * life > 60 ? 'That is comfortably more than the $45 it costs to win them, so growth adds value.' : margin * life >= 45 ? 'Barely more than the $45 it costs to win them: growth adds very little value.' : 'Less than the $45 it costs to win them, so every new customer loses money. Faster growth means faster losses.'}`,
        });
      },
      () =>
        flag({
          brief: 'Pitch 2: Pantri, an app that plans your weekly meals. Here is the deck.',
          prompt: 'Flag the red flags.',
          doc: {
            title: 'Pantri: Investor Deck',
            sub: 'Confidential',
            skin: 'paper',
            lines: [
              { id: 'team', l: 'Team: two co-founders, both full time. One built a meal app that was bought in 2021.' },
              { id: 'market', l: 'Market: $1.5 trillion, the entire US food industry.' },
              { id: 'comp', l: 'Competition: none. Nobody else does what we do.' },
              { id: 'pilot', l: 'Traction: a signed pilot with a 40-store grocery chain.' },
              { id: 'money', l: 'Use of funds: 60% to hire engineers, 40% to marketing.' },
              { id: 'profit', l: 'We will be profitable once we reach 20 million users.' },
            ],
          },
          issues: {
            market: 'Pantri will never sell groceries; it sells meal plans. A real estimate counts people who might pay for one.',
            comp: 'There is always competition, even if it is a notebook and a recipe website. "None" means the founders have not looked, or are hiding it.',
            profit: '20 million users is a size very few apps ever reach. A plan that only works at that scale is not a plan.',
          },
          fine: {
            team: 'Committed founders with a track record is exactly what investors want to see.',
            pilot: 'A signed deal with a real customer is the strongest evidence in the deck.',
            money: 'A clear, sensible plan for the money.',
          },
        }),
      () =>
        pick({
          brief: 'Pitch 3: Kiln, a pottery studio booking app. The founder asks for $50,000 in exchange for 10% of the company.',
          visual: <Say who="Founder">So you are valuing us at $500,000. Honestly, that is a steal.</Say>,
          prompt: 'What does the founder’s offer actually say about the company?',
          options: [
            { label: 'Kiln claims to be worth $500,000 after your money arrives. Your $50,000 buys a 10% slice, which future funding rounds will shrink', credit: 1, why: '$50,000 for 10% means the company is valued at $500,000 including your cash. Later investors will get new shares, so your 10% is a starting point, not a forever number.' },
            { label: 'Kiln is worth $500,000 because someone said so', credit: 0.2, why: 'A valuation is just the price two sides agree on. It is only true if someone pays it.' },
            { label: 'You will get $500,000 back if it works', credit: 0, why: 'You would own 10% of whatever Kiln is worth later, and most startups end up worth less than their early valuation.' },
          ],
        }),
      () =>
        pick({
          brief: 'Your aunt heard about Pitch Night. She wants to put $60,000, most of her retirement savings, into whichever startup you like best.',
          visual: <Table head={['What usually happens to early-stage startups', 'Rough share']} rows={[['Fail and return nothing', 'Most'], ['Return roughly the money put in', 'Some'], ['Return many times the money', 'A small few']]} />,
          prompt: 'What do you tell her?',
          options: [
            { label: 'Only invest what she can afford to lose completely, spread across many startups, and never retirement money', credit: 1, why: 'Professional investors expect most of their startups to fail and count on one big win to pay for the rest. That only works with many small bets and money you will not need.' },
            { label: 'Put it all in Brewly; the numbers looked good', credit: 0.1, why: 'Even a good startup can fail. One bet with most of her retirement is a risk no professional would take.' },
            { label: 'Split it between two startups to diversify', credit: 0.3, why: 'Two bets is still almost no diversification, and it is still retirement money.' },
            { label: 'Do not invest at all, ever', credit: 0.6, why: 'Safe and probably right for her situation, but startups can be a fine small slice for someone with money to spare.' },
          ],
        }),
    ],
    alts: {
      0: [
        () =>
          choose({
            brief: 'Pitch 1: Fetchly, an app that matches dog owners with local walkers. "50,000 downloads in six months!" says the founder.',
            visual: <Cards cards={[{ icon: '🐕', title: 'Fetchly', sub: 'Seed round', facts: [['Downloads', '50,000'], ['Cities', '3'], ['Fee', '20% of each walk'], ['Asking for', '$300,000']] }]} />,
            prompt: 'You get two questions. Which two?',
            k: 2,
            options: [
              { label: 'How many owners booked a walk last month?', good: true, why: 'Downloads cost nothing. Monthly bookings show real use.' },
              { label: 'How many owners book again after their first walk?', good: true, why: 'Repeat bookings show the service is worth paying for. A marketplace lives on repeat customers.' },
              { label: 'What is your favorite dog breed?', good: false, why: 'Friendly, but not information.' },
              { label: 'How big is the global pet industry?', good: false, why: 'Huge, and irrelevant to whether Fetchly works.' },
              { label: 'Are you planning a TV ad?', good: false, why: 'Spending plans say nothing about whether customers stay.' },
            ],
          }),
      ],
      1: [
        ({ s }) => {
          const price = s.price + 10;
          const life = 100 / s.churn;
          const keep = price * 0.4;
          const ltv = keep * life;
          return dial({
            brief: `Tutorly sells online tutoring for ${usd(price)} a month and keeps 40% after paying tutors. ${s.churn}% of customers cancel each month, so they stay about ${life.toFixed(1)} months. Winning each customer costs $80 in ads.`,
            visual: <Table head={['', '']} rows={[['Monthly price', usd(price)], ['Kept after paying tutors', `${usd(keep, 2)} a month`], ['Average months a customer stays', life.toFixed(1)], ['Cost to win one customer', '$80']]} />,
            prompt: 'How much does Tutorly earn from an average customer over their whole time subscribed?',
            min: 0,
            max: 200,
            step: 1,
            answer: Math.round(ltv),
            tol: 3,
            fmt: (v) => usd(v),
            why: `${usd(keep, 2)} × ${life.toFixed(1)} months ≈ ${usd(ltv)}. ${ltv > 100 ? 'Comfortably more than the $80 cost, so growth adds value.' : ltv >= 80 ? 'Barely more than the $80 cost: growth adds very little.' : 'Less than the $80 cost, so every new customer loses money.'}`,
          });
        },
      ],
      2: [
        () =>
          flag({
            brief: 'Pitch 2: Glide, an e-bike subscription. Here is the deck.',
            prompt: 'Flag the red flags.',
            doc: {
              title: 'Glide: Investor Deck',
              sub: 'Confidential',
              skin: 'paper',
              lines: [
                { id: 'cust', l: 'Traction: 1,200 paying subscribers, 4% cancel each month.' },
                { id: 'guar', l: 'Returns: investors are guaranteed 10 times their money within 3 years.' },
                { id: 'team', l: 'Team: a founder who ran bike repair shops for 8 years.' },
                { id: 'part', l: 'Founders: three, all keeping their full-time jobs for now.' },
                { id: 'repair', l: 'Each bike needs about $40 of repairs a month, paid by Glide.' },
                { id: 'val', l: 'Valuation: $40 million, based on what we will be worth in five years.' },
              ],
            },
            issues: {
              guar: 'No honest startup can guarantee returns. A promise like this is a warning sign of fraud.',
              part: 'Founders not working on it full time suggests they are not committed yet.',
              val: 'Valuing today’s company at its imagined future size leaves no reward for the risk you take.',
            },
            fine: {
              cust: 'Real paying customers and a low cancellation rate.',
              team: 'Directly relevant experience.',
              repair: 'An honest cost that investors need to know.',
            },
          }),
      ],
      3: [
        () =>
          pick({
            brief: 'Pitch 3: Sprout, a garden-planning app. The founder asks for $200,000 in exchange for 20% of the company.',
            visual: <Say who="Founder">And if we raise again next year, you will still own your shares.</Say>,
            prompt: 'What is true about this offer?',
            options: [
              { label: 'It values Sprout at $1 million including your money, and your 20% will shrink when new shares are sold later', credit: 1, why: '$200,000 ÷ 20% = $1 million. Future rounds create new shares, so you keep your shares but own a smaller percentage.' },
              { label: 'It values Sprout at $200,000', credit: 0.1, why: 'That is your investment. The whole company is valued at five times that.' },
              { label: 'You will always own 20%', credit: 0, why: 'Later rounds usually dilute early investors.' },
            ],
          }),
      ],
      4: [
        () =>
          pick({
            brief: 'A classmate found a website where anyone can invest $100 in startups. They want to put in their whole $2,000 college fund. "One of these could be the next big thing!"',
            prompt: 'What do you tell them?',
            options: [
              { label: 'Startup shares are hard to sell and most fail. Only put in a small amount they could lose, never money they need for college', credit: 1, why: 'Startup shares often cannot be sold for years, and most go to zero. Money with a job to do needs to be safe.' },
              { label: 'Spread it across 20 startups at $100 each', credit: 0.4, why: 'Better spread, but still the entire college fund in the riskiest place.' },
              { label: 'Pick the one with the best video', credit: 0, why: 'A slick video is marketing, not evidence.' },
            ],
          }),
      ],
    },
    takeaways: [
      'Ask for numbers you can check: paying customers, cancellations, cost to win a customer.',
      'A customer is only worth winning if they bring in more than they cost.',
      '"No competition" and trillion-dollar markets are red flags, not selling points.',
      'Most startups fail. Invest small, spread wide, and never with money you need.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
