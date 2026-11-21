'use client';
/**
 * Creator Economy (Advanced, Tech Campus). Your channel takes off. Work out what views actually
 * pay, read a brand-deal contract, handle the self-employment tax nobody mentions, and survive
 * the month the algorithm changes.
 */
import type { KindProps } from '../../types';
import { C, LineChart, Table, usd } from '../pro/kit';
import { CaseRunner, Feed, choose, dial, flag, pick, type CaseDef } from './kit';

interface S {
  views: number;
  rpm: number;
  profit: number;
}

export default function CreatorEconomy({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<S> = {
    kicker: 'Tech Campus · Creator economy',
    init: (rng) => ({ views: rng.pick([300000, 400000, 500000]), rpm: rng.pick([2.5, 3, 4]), profit: rng.pick([16000, 18000, 20000]) }),
    steps: [
      ({ s }) =>
        dial({
          brief: `Your cooking videos took off. Last month they got ${s.views.toLocaleString('en-US')} views. The platform pays you about ${usd(s.rpm, 2)} for every 1,000 views, after its own cut.`,
          prompt: 'How much did ads pay you last month?',
          min: 0,
          max: 3000,
          step: 25,
          answer: (s.views / 1000) * s.rpm,
          tol: 25,
          fmt: (v) => usd(v),
          why: `${s.views.toLocaleString('en-US')} ÷ 1,000 × ${usd(s.rpm, 2)} = ${usd((s.views / 1000) * s.rpm)}. Huge view counts can still mean a part-time income from ads, which is why most full-time creators rely on brand deals and their own products too.`,
        }),
      () =>
        flag({
          brief: 'A drinks brand, FizzUp, offers you $800 for one video. Their contract arrives.',
          prompt: 'Flag the clauses you should push back on.',
          doc: {
            title: 'FizzUp Creator Agreement',
            sub: 'One sponsored video',
            skin: 'contract',
            lines: [
              { id: 'deliv', l: 'Creator delivers one 60-second video featuring FizzUp by June 1.' },
              { id: 'fee', l: 'Fee: $800.' },
              { id: 'usage', l: 'FizzUp may use the video, your name and your face in its advertising, worldwide, forever.' },
              { id: 'excl', l: 'Creator may not work with any other drinks brand for 12 months.' },
              { id: 'pay', l: 'Payment within 120 days of the video being posted.' },
              { id: 'hide', l: 'Creator must not label the video as sponsored or as an ad.' },
              { id: 'rev', l: 'FizzUp may request one round of edits.' },
            ],
          },
          issues: {
            usage: 'Your face in their ads forever is worth far more than one video. Usage rights should be limited in time, and paid for separately.',
            excl: 'A year blocked from every drinks brand, for $800, could cost you much bigger deals. Exclusivity should be short and paid for.',
            pay: 'Four months is a long wait. Ask for payment within 30 days, or half up front.',
            hide: 'Hiding that a post is paid is illegal in many countries, including the US. You would carry the risk, not FizzUp.',
          },
          fine: {
            deliv: 'Clear and specific: exactly what a contract should say.',
            fee: 'A plain fee. Whether it is enough depends on everything else.',
            rev: 'One round of edits is standard.',
          },
        }),
      ({ s }) =>
        dial({
          brief: `By December, your channel made ${usd(s.profit)} in profit after costs. No employer took any tax out. On top of income tax, self-employed people pay self-employment tax: 15.3% on 92.35% of their profit.`,
          visual: <Table head={['Self-employment tax', '']} rows={[['Profit', usd(s.profit)], ['Taxed portion (92.35%)', '?'], ['Rate', '15.3%']]} />,
          prompt: 'How much self-employment tax do you owe?',
          min: 0,
          max: 4000,
          step: 10,
          answer: Math.round(s.profit * 0.9235 * 0.153),
          tol: 30,
          fmt: (v) => usd(v),
          why: `${usd(s.profit)} × 92.35% × 15.3% ≈ ${usd(s.profit * 0.9235 * 0.153)}. An employee pays half of this and the employer pays the other half; when you are self-employed you pay both. Income tax comes on top. Setting aside 25% to 30% of every payment avoids a painful April.`,
        }),
      () =>
        choose({
          brief: 'Your costs lower your taxable profit, as long as they are genuinely for the business.',
          prompt: 'Which two can you count as business expenses?',
          k: 2,
          options: [
            { label: 'A camera you use only for filming', good: true, why: 'Equipment used for the business is a classic deductible expense.' },
            { label: 'Your video editing software subscription', good: true, why: 'A tool used to make the content you are paid for.' },
            { label: 'Clothes you wear in videos and everyday life', good: false, why: 'Clothes you can wear normally are personal, even if they appear on camera.' },
            { label: 'Dinner with friends, because you filmed a bit of it', good: false, why: 'Filming does not turn a personal meal into a business cost.' },
            { label: 'Your phone bill, all of it, though you also use it personally', good: false, why: 'Only the business share of a mixed-use cost counts, not the whole bill.' },
          ],
        }),
      ({ s }) =>
        pick({
          brief: 'In March, the platform changes how it recommends videos. Your views fall by 60% in three weeks.',
          visual: <LineChart series={[{ pts: [s.views, s.views * 1.05, s.views * 0.98, s.views * 0.7, s.views * 0.45, s.views * 0.4], color: C.red, label: 'Monthly views' }]} fmt={(v) => `${Math.round(v / 1000)}k`} xLabel="Oct to Mar" h={160} />,
          prompt: 'What would have protected your income best?',
          options: [
            { label: 'Several income sources, such as a cookbook or email list you own, plus an emergency fund of a few months’ costs', credit: 1, why: 'You do not own your audience on a platform; the algorithm does. An email list and your own products survive a change in the rules.' },
            { label: 'Posting three times as often', credit: 0.3, why: 'It may help a little, but it does not change the platform’s rules, and it leads to burnout.' },
            { label: 'Nothing. It is a hobby that pays', credit: 0.2, why: 'If you rely on the money, it is a business, and businesses plan for bad months.' },
          ],
        }),
    ],
    alts: {
      0: [
        ({ s }) => {
          const per = s.views / 10;
          return dial({
            brief: `Your gaming videos average ${per.toLocaleString('en-US')} views each. A headphone brand offers to sponsor a 60-second mention, paying $20 for every 1,000 views a video usually gets.`,
            prompt: 'How much should one sponsored mention pay?',
            min: 0,
            max: 3000,
            step: 25,
            answer: (per / 1000) * 20,
            tol: 25,
            fmt: (v) => usd(v),
            why: `${per.toLocaleString('en-US')} ÷ 1,000 × $20 = ${usd((per / 1000) * 20)}. One sponsor can pay more than a month of ad income, which is why creators rely on deals.`,
          });
        },
      ],
      1: [
        () =>
          flag({
            brief: 'A merchandise company offers to print and sell T-shirts with your channel logo. Their contract arrives.',
            prompt: 'Flag the clauses you should push back on.',
            doc: {
              title: 'MerchMakers Partner Agreement',
              sub: 'Creator merchandise',
              skin: 'contract',
              lines: [
                { id: 'cut', l: 'Creator receives 10% of profit, as calculated by MerchMakers.' },
                { id: 'logo', l: 'MerchMakers owns all designs, including your channel logo, once uploaded.' },
                { id: 'term', l: 'The agreement renews automatically every year unless cancelled in a 7-day window.' },
                { id: 'ship', l: 'MerchMakers handles printing, shipping and returns.' },
                { id: 'rep', l: 'Monthly sales reports are sent by email.' },
                { id: 'quit', l: 'Either side may end the agreement with 30 days’ notice after the first year.' },
              ],
            },
            issues: {
              cut: '"Profit as calculated by" them lets them decide how much is left. A share of sales is clearer.',
              logo: 'Giving away your own logo means you could not sell merchandise anywhere else.',
              term: 'A tiny cancellation window makes it easy to be locked in for another year.',
            },
            fine: {
              ship: 'Useful service, and the main reason to use a partner.',
              rep: 'Regular reports let you check the numbers.',
              quit: 'A fair way out.',
            },
          }),
      ],
      2: [
        ({ s }) =>
          dial({
            brief: `Nobody takes tax out of creator income, so you set aside 25% of every payment for tax. This quarter you were paid ${usd(s.profit / 4)} in total.`,
            prompt: 'How much should be in your tax pot from this quarter?',
            min: 0,
            max: 3000,
            step: 25,
            answer: s.profit / 16,
            tol: 25,
            fmt: (v) => usd(v),
            why: `25% of ${usd(s.profit / 4)} is ${usd(s.profit / 16)}. In the US, self-employed people usually pay estimated tax four times a year, so a pot that fills with every payment is ready when it is due.`,
          }),
      ],
      3: [
        () =>
          choose({
            brief: 'At tax time, you list everything you received this year.',
            prompt: 'Which two count as income you must report?',
            k: 2,
            options: [
              { label: 'Payments from brands for sponsored videos', good: true, why: 'Clearly income from your work.' },
              { label: 'A $400 gaming chair a brand sent you in return for a review', good: true, why: 'Products received in exchange for promotion count as income at their value.' },
              { label: 'A birthday card with $50 from your grandmother', good: false, why: 'A personal gift, not payment for work.' },
              { label: 'A refund for headphones you returned', good: false, why: 'Getting your own money back is not income.' },
            ],
          }),
      ],
      4: [
        () =>
          pick({
            brief: 'Your main channel is hacked and taken down for two weeks while the platform investigates. Brand deals are paused.',
            prompt: 'What would have protected you best?',
            options: [
              { label: 'Two-factor login, backups of your videos, and an email list and other income you own', credit: 1, why: 'Strong security makes hacks less likely. Backups and an audience you can reach directly mean a lost account is not a lost business.' },
              { label: 'A longer password', credit: 0.4, why: 'Helps, but two-factor login matters more, and it does nothing for income if something still goes wrong.' },
              { label: 'Nothing; platforms always restore accounts quickly', credit: 0, why: 'Some never come back. A business with one point of failure is fragile.' },
            ],
          }),
      ],
    },
    takeaways: [
      'Views pay little on their own. Most creator income comes from deals and products.',
      'Read brand contracts for usage rights, exclusivity and payment terms. Each one has a price.',
      'Paid posts must be labeled. Hiding it is illegal in many countries.',
      'Self-employed people pay both halves of payroll tax. Set aside 25% to 30% of everything.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
